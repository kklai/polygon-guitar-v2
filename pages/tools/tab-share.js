import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { Download, RefreshCw } from 'lucide-react'

const splitLyricLine = (lyric, maxLen) => {
  if (!lyric) return [lyric]
  if (maxLen === undefined) {
    const stripped = lyric.replace(/[\s()]/g, '')
    const allChinese = stripped.length > 0 && /^[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3000-\u303f\uff00-\uffef，。、！？；：「」『』（）《》…—]+$/.test(stripped)
    maxLen = allChinese ? 20 : 50
  }
  // Tokenize into chars and (X) groups, each with display length (spaces = 0)
  const tokens = []
  let i = 0
  while (i < lyric.length) {
    if (lyric[i] === '(') {
      const end = lyric.indexOf(')', i)
      if (end !== -1) { tokens.push({ raw: lyric.slice(i, end + 1), dLen: end - i - 1 }); i = end + 1; continue }
    }
    tokens.push({ raw: lyric[i], dLen: lyric[i] === ' ' ? 0 : 1 })
    i++
  }
  // Greedy wrap: break at nearest space before limit, or force-break if no space
  const lines = []
  let cur = [], curLen = 0, lastSpacePos = -1
  for (const tok of tokens) {
    if (tok.dLen === 0) {
      // Space: record position but don't count
      lastSpacePos = cur.length
      cur.push(tok)
    } else if (curLen + tok.dLen > maxLen && curLen > 0) {
      if (lastSpacePos >= 0) {
        lines.push(cur.slice(0, lastSpacePos).map(t => t.raw).join('').trim())
        cur = cur.slice(lastSpacePos + 1)
        curLen = cur.reduce((s, t) => s + t.dLen, 0)
        lastSpacePos = -1
      } else {
        lines.push(cur.map(t => t.raw).join(''))
        cur = []; curLen = 0; lastSpacePos = -1
      }
      cur.push(tok); curLen += tok.dLen
    } else {
      cur.push(tok); curLen += tok.dLen
    }
  }
  if (cur.length > 0) { const l = cur.map(t => t.raw).join('').trim(); if (l) lines.push(l) }
  return lines.filter(Boolean)
}

const combineChords = (chords, maxLines = 2) => {
  if (chords.length <= maxLines) return [...chords]
  const perLine = Math.ceil(chords.length / maxLines)
  const result = []
  for (let i = 0; i < chords.length; i += perLine) {
    result.push(chords.slice(i, i + perLine).join('  '))
  }
  return result
}

const PREVIEW_W = 400
const PREVIEW_H = 711
const S = 3
const p = (n) => n / S
const OUT_W = PREVIEW_W * S
const OUT_H = PREVIEW_H * S
const ITEM_H = 40
const HANDLE_H = 15
const PICKER_PAD = 15

export default function TabShareTool() {
  const router = useRouter()
  const [selectedTab, setSelectedTab] = useState(null)
  const [selectionStart, setSelectionStart] = useState(null)
  const [selectionEnd, setSelectionEnd] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewScale, setPreviewScale] = useState(1)
  const [dominantColor, setDominantColor] = useState(null)
  const [savedImageUrl, setSavedImageUrl] = useState(null)
  const containerRef = useRef(null)
  const pickerRef = useRef(null)
  const dragTarget = useRef(null)
  const dragOffset = useRef(0)
  const selStartRef = useRef(null)
  const selEndRef = useRef(null)

  useEffect(() => {
    if (router.query.tabId) selectTab({ id: router.query.tabId })
  }, [router.query.tabId])

  useEffect(() => {
    const artSrc = getArtistImage()
    if (!artSrc) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setDominantColor(getDominantColor(img))
    img.onerror = () => setDominantColor(null)
    img.src = artSrc
  }, [selectedTab])

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth
        const maxHeight = window.innerHeight * 0.5
        setPreviewScale(Math.min(1, width / PREVIEW_W, maxHeight / PREVIEW_H))
      }
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [selectedTab])

  const selectTab = async (tab) => {
    try {
      const tabDoc = await getDoc(doc(db, 'tabs', tab.id))
      if (tabDoc.exists()) {
        const data = tabDoc.data()
        const parsed = parseTabContent(data.content)
        setSelectedTab({ ...data, id: tab.id, parsedContent: parsed })
        if (parsed.lyrics.length > 0) {
          let start, end
          if (parsed.chorusStart >= 0 && parsed.chorusEnd >= parsed.chorusStart) {
            const chorusLen = parsed.chorusEnd - parsed.chorusStart + 1
            start = parsed.chorusStart
            end = chorusLen <= 4 ? parsed.chorusEnd : parsed.chorusStart + 3
          } else {
            start = 0
            end = Math.min(3, parsed.lyrics.length - 1)
          }
          setSelectionStart(start)
          setSelectionEnd(end)
          setTimeout(() => {
            if (pickerRef.current) {
              const selMid = ((start + end) / 2) * ITEM_H + PICKER_PAD
              const containerH = pickerRef.current.clientHeight
              pickerRef.current.scrollTop = Math.max(0, selMid - containerH / 2)
            }
          }, 50)
        }
      }
    } catch (error) {
      console.error('Error loading tab:', error)
    }
  }

  const parseTabContent = (content) => {
    if (!content) return { chords: [], lyrics: [] }
    const lines = content.split('\n')
    const isChord = (t) => {
      const n = t.replace(/[｜]/g, '|')
      if (!/[A-G][#b]?/.test(n)) return false
      const chinese = (n.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
      if (chinese >= 2) return false
      if (n.includes('|')) return true
      return /^[\sA-G#bmsujnaddimaug0-9\/|\-\u3000]+$/.test(n)
    }
    const isHeader = (t) =>
      /^(key\s*:|intro|verse|chor|chrou|pre.?chor|pre.?chrou|bridge|outro|solo)/i.test(t) ||
      /^\[[^\]]*\]\s*$/.test(t) ||
      /^\([^)]{1,20}\)\s*$/.test(t) ||
      /^\/(v|p|c|i|o|b)\s*$/i.test(t)
    const isNumericNotation = (t) => {
      const digits = (t.match(/\d/g) || []).length
      const chinese = (t.match(/[\u4e00-\u9fff]/g) || []).length
      const letters = (t.match(/[a-zA-Z]/g) || []).filter(c => !/[b#]/i.test(c))
      if (letters.length > digits) return false
      return digits > 3 && chinese < 3 && !/\|[\s]*[A-G]/.test(t)
    }

    const isChorus = (t) =>
      /^(chor|chrou|副歌|\*)/i.test(t) ||
      /^\[chorus\]/i.test(t) ||
      /^\(副歌\)\s*$/i.test(t) ||
      /^\/c\s*$/i.test(t)

    const classified = []
    lines.forEach(line => {
      const trimmed = line.replace(/[\u200B\u200C\u200D\uFEFF]/g, '').trim()
      if (!trimmed) return
      if (isChord(trimmed)) classified.push({ type: 'chord', text: trimmed })
      else if (isHeader(trimmed)) classified.push({ type: 'header', text: trimmed, isChorus: isChorus(trimmed) })
      else if (!isNumericNotation(trimmed)) classified.push({ type: 'lyric', text: trimmed.replace(/\s*\/(v|p|c|i|o|b)\s*$/i, '').trim() })
    })

    const chords = []
    const lyrics = []
    let chorusStart = -1
    let chorusEnd = -1
    let inChorus = false
    for (let i = 0; i < classified.length; i++) {
      if (classified[i].type === 'header') {
        if (classified[i].isChorus && chorusStart === -1) {
          inChorus = true
        } else if (inChorus) {
          chorusEnd = lyrics.length - 1
          inChorus = false
        }
        continue
      }
      if (classified[i].type === 'chord') {
        const next = classified[i + 1]
        if (next && next.type === 'lyric') {
          if (inChorus && chorusStart === -1) chorusStart = lyrics.length
          const chunks = splitLyricLine(next.text).filter(c => c.replace(/[()\s\u3000\u200B\u200C\u200D\uFEFF]/g, ''))
          if (chunks.length > 0) {
            chords.push(classified[i].text.replace(/[\s\u3000]+/g, ' ').trim())
            lyrics.push(chunks[0])
            for (let j = 1; j < chunks.length; j++) { chords.push(null); lyrics.push(chunks[j]) }
          }
          i++
        }
      } else {
        if (inChorus && chorusStart === -1) chorusStart = lyrics.length
        splitLyricLine(classified[i].text).filter(c => c.replace(/[()\s\u3000\u200B\u200C\u200D\uFEFF]/g, '')).forEach(chunk => { lyrics.push(chunk); chords.push(null) })
      }
    }
    if (inChorus && chorusEnd === -1) chorusEnd = lyrics.length - 1
    return { chords, lyrics, chorusStart, chorusEnd }
  }

  const getEffectiveSection = () => {
    if (!selectedTab || selectionStart === null || selectionEnd === null) return null
    const start = Math.min(selectionStart, selectionEnd)
    const end = Math.max(selectionStart, selectionEnd)
    return {
      lyrics: selectedTab.parsedContent.lyrics.slice(start, end + 1),
      chords: selectedTab.parsedContent.chords.slice(start, end + 1).filter(Boolean),
    }
  }

  const getIdxFromClientY = (clientY) => {
    if (!pickerRef.current) return 0
    const lyrics = selectedTab?.parsedContent?.lyrics || []
    const rect = pickerRef.current.getBoundingClientRect()
    const rel = clientY - rect.top + pickerRef.current.scrollTop - PICKER_PAD
    return Math.max(0, Math.min(lyrics.length - 1, Math.floor(rel / ITEM_H)))
  }

  useEffect(() => { selStartRef.current = selectionStart }, [selectionStart])
  useEffect(() => { selEndRef.current = selectionEnd }, [selectionEnd])

  const onHandlePointerDown = (e, target) => {
    e.preventDefault()
    dragTarget.current = target
    if (target === 'middle') {
      const normStart = Math.min(selStartRef.current ?? 0, selEndRef.current ?? 0)
      dragOffset.current = getIdxFromClientY(e.clientY) - normStart
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const MAX_SELECTION = 3 // max 4 lines (0-indexed span)

  const onHandlePointerMove = (e) => {
    if (!dragTarget.current) return
    const idx = getIdxFromClientY(e.clientY)
    const lyricsLen = selectedTab?.parsedContent?.lyrics?.length ?? 0
    if (dragTarget.current === 'start') {
      const end = selEndRef.current ?? 0
      setSelectionStart(Math.max(end - MAX_SELECTION, Math.min(end, idx)))
    } else if (dragTarget.current === 'end') {
      const start = selStartRef.current ?? 0
      setSelectionEnd(Math.min(start + MAX_SELECTION, Math.max(start, idx)))
    } else if (dragTarget.current === 'middle') {
      const selLen = Math.min(Math.abs((selEndRef.current ?? 0) - (selStartRef.current ?? 0)), MAX_SELECTION)
      const newStart = Math.max(0, Math.min(lyricsLen - 1 - selLen, idx - dragOffset.current))
      setSelectionStart(newStart)
      setSelectionEnd(newStart + selLen)
    }
  }

  const onHandlePointerUp = () => { dragTarget.current = null }

  const parseLyricSegments = (lyric) => {
    if (!lyric || !/\([^)]*\)/.test(lyric)) return [{ text: lyric || '', hasStar: false }]
    const segments = []
    let lastIdx = 0
    const regex = /\(([^)]*)\)/g
    let match
    while ((match = regex.exec(lyric)) !== null) {
      if (match.index > lastIdx) segments.push({ text: lyric.slice(lastIdx, match.index), hasStar: false })
      const content = match[1].trim() ? match[1] : '\u3000'
      segments.push({ text: content, hasStar: true })
      lastIdx = match.index + match[0].length
    }
    if (lastIdx < lyric.length) segments.push({ text: lyric.slice(lastIdx), hasStar: false })
    return segments
  }

  const getArtistImage = () => {
    if (!selectedTab) return null
    return selectedTab.thumbnail || selectedTab.albumImage ||
      (selectedTab.youtubeUrl ? `https://img.youtube.com/vi/${extractYouTubeId(selectedTab.youtubeUrl)}/hqdefault.jpg` : null)
  }

  const getDominantColor = (img) => {
    const size = 100
    const tmp = document.createElement('canvas')
    tmp.width = size; tmp.height = size
    tmp.getContext('2d').drawImage(img, 0, 0, size, size)
    const data = tmp.getContext('2d').getImageData(0, 0, size, size).data
    let rSum = 0, gSum = 0, bSum = 0, wSum = 0
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      const saturation = max === 0 ? 0 : (max - min) / max
      const w = saturation * (max / 255) + 0.05
      rSum += r * w; gSum += g * w; bSum += b * w; wSum += w
    }
    return { r: Math.round(rSum / wSum), g: Math.round(gSum / wSum), b: Math.round(bSum / wSum) }
  }

  const extractYouTubeId = (url) => {
    if (!url) return null
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/)
    return (match && match[2].length === 11) ? match[2] : null
  }

  const generateImage = async () => {
    const effectiveSection = getEffectiveSection()
    if (!selectedTab || !effectiveSection) return
    setIsGenerating(true)
    try {
      await document.fonts.ready
      await Promise.allSettled([
        document.fonts.load(`500 60px "Barlow Condensed"`),
        document.fonts.load(`300 60px "Noto Sans TC"`),
      ])
      const loadImg = (src) => new Promise((resolve) => {
        if (!src) return resolve(null)
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => resolve(null)
        img.src = src
      })

      const [logoImg, artImg, starImg, bottomImg] = await Promise.all([
        loadImg('/polygon-logo-white.png'),
        loadImg(getArtistImage()),
        loadImg('/star.png'),
        loadImg('/polygon-web-ig-story.png'),
      ])

      const canvas = document.createElement('canvas')
      canvas.width = OUT_W; canvas.height = OUT_H
      const ctx = canvas.getContext('2d')

      const dc = artImg ? getDominantColor(artImg) : { r: 30, g: 30, b: 30 }
      const gradient = ctx.createLinearGradient(0, 0, 0, OUT_H)
      gradient.addColorStop(0, `rgb(${dc.r}, ${dc.g}, ${dc.b})`)
      gradient.addColorStop(1, '#000000')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, OUT_W, OUT_H)

      ctx.textBaseline = 'top'

      const logoW = 360
      const logoH = logoImg ? (logoImg.naturalHeight / logoImg.naturalWidth) * logoW : 0
      const artSize = 712
      const titleH = 50 * 1.2
      const artistH = 40 * 1.2

      const starW = 20
      const starH = 20 * (35 / 30)
      const baseFontPx = p(58)
      const availPx = PREVIEW_W - p(80)
      const lyricFontSize = effectiveSection.lyrics.reduce((min, lyric) => {
        const estW = [...lyric].reduce((w, ch) => w + (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch) ? 1 : 0.55), 0) * min
        return estW > availPx ? min * (availPx / estW) : min
      }, baseFontPx) * S
      const lyricLineHeight = lyricFontSize * (100 / 58)

      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
      const displayChords = combineChords(effectiveSection.chords, 3)
      const chordFontSize = displayChords.reduce((min, chord) =>
        Math.min(min, availPx / (chord.length * 0.6)), 60 / S) * S

      const bottomW = 532
      const bottomH = bottomImg ? (bottomImg.naturalHeight / bottomImg.naturalWidth) * bottomW : 0

      const totalContentH = logoH + 40 + (artImg ? artSize : 0) + 30 + titleH + 10 + artistH + 60
        + lyricLineHeight * effectiveSection.lyrics.length + 20
        + chordFontSize * 1.3 * displayChords.length + 50 + bottomH

      let y = Math.max(20, (OUT_H - totalContentH) / 2)

      if (logoImg) {
        ctx.drawImage(logoImg, (OUT_W - logoW) / 2, y, logoW, logoH)
        y += logoH
      }

      y += 40
      if (artImg) {
        const srcSize = Math.min(artImg.naturalWidth, artImg.naturalHeight)
        const srcX = (artImg.naturalWidth - srcSize) / 2
        const srcY = (artImg.naturalHeight - srcSize) / 2
        ctx.drawImage(artImg, srcX, srcY, srcSize, srcSize, (OUT_W - artSize) / 2, y, artSize, artSize)
        y += artSize
      }

      y += 30
      ctx.font = `600 50px "Noto Sans TC", "Microsoft JhengHei", sans-serif`
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(selectedTab.title, OUT_W / 2, y)
      y += titleH

      y += 10
      ctx.font = `400 40px "Noto Sans TC", "Microsoft JhengHei", sans-serif`
      ctx.fillStyle = '#cccccc'
      ctx.fillText(selectedTab.artist, OUT_W / 2, y)
      y += artistH

      y += 60
      ctx.font = `500 ${lyricFontSize}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`
      ctx.fillStyle = '#ffffff'; ctx.lineWidth = 0
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${lyricFontSize * 0.07}px`

      for (const lyric of effectiveSection.lyrics) {
        const segments = parseLyricSegments(lyric)
        const hasStars = segments.some(s => s.hasStar)
        if (!hasStars) {
          ctx.textAlign = 'center'
          ctx.fillText(lyric, OUT_W / 2, y)
        } else {
          ctx.textAlign = 'left'
          const totalWidth = segments.reduce((sum, seg) => sum + ctx.measureText(seg.text).width, 0)
          let x = (OUT_W - totalWidth) / 2
          for (const seg of segments) {
            const segW = ctx.measureText(seg.text).width
            if (seg.hasStar && starImg) {
              ctx.drawImage(starImg, x + segW / 2 - starW / 2, y - starH - 2, starW, starH)
            }
            ctx.fillText(seg.text, x, y)
            x += segW
          }
          ctx.textAlign = 'center'
        }
        y += lyricLineHeight
      }

      y += 20
      ctx.fillStyle = '#d5b26e'; ctx.lineWidth = 0
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
      ctx.font = `500 ${chordFontSize}px "Barlow Condensed", sans-serif`
      for (const chord of displayChords) {
        ctx.fillText(chord, OUT_W / 2, y)
        y += chordFontSize * 1.3
      }

      y += 50
      if (bottomImg) {
        ctx.drawImage(bottomImg, (OUT_W - bottomW) / 2, y, bottomW, bottomH)
      }

      const fileName = `${selectedTab.title}-${selectedTab.artist}-polygon.png`
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

      if (isMobile) {
        const dataUrl = canvas.toDataURL('image/png')
        setSavedImageUrl(dataUrl)
      } else {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
        const link = document.createElement('a')
        link.download = fileName
        link.href = URL.createObjectURL(blob)
        link.click()
        URL.revokeObjectURL(link.href)
      }
    } catch (error) {
      console.error('Generate error:', error)
      alert('生成圖片失敗')
    } finally {
      setIsGenerating(false)
    }
  }

  const renderLyric = (lyric, fontSize) => {
    if (!lyric) return null
    const segments = parseLyricSegments(lyric)
    if (segments.length === 1 && !segments[0].hasStar) return lyric
    return segments.map((seg, i) =>
      seg.hasStar ? (
        <span key={i} style={{ position: 'relative', display: 'inline-block' }}>
          <img src="/star.png" alt="" style={{ position: 'absolute', top: '-5px', left: '50%', transform: 'translateX(-50%)', width: `${fontSize}px`, height: `${fontSize * (35 / 30)}px` }} />
          {seg.text}
        </span>
      ) : seg.text
    )
  }

  const renderImageContent = () => {
    const effectiveSection = getEffectiveSection()
    if (!effectiveSection) return null
    return (
      <>
        <img src="/polygon-logo-white.png" alt="Polygon" style={{ width: `${p(360)}px`, objectFit: 'contain' }} />
        <img src={getArtistImage() || ''} alt={selectedTab.title} style={{ width: `${p(712)}px`, height: `${p(712)}px`, objectFit: 'cover', marginTop: `${p(40)}px`, flexShrink: 0 }} />
        <p style={{ marginTop: `${p(30)}px`, fontSize: `${p(50)}px`, fontWeight: 600, color: '#ffffff', textAlign: 'center', lineHeight: 1.2, paddingLeft: `${p(40)}px`, paddingRight: `${p(40)}px` }}>
          {selectedTab.title}
        </p>
        <p style={{ marginTop: `${p(10)}px`, fontSize: `${p(40)}px`, fontWeight: 400, color: '#cccccc', textAlign: 'center', lineHeight: 1.2 }}>
          {selectedTab.artist}
        </p>
        <div style={{ marginTop: `${p(60)}px`, textAlign: 'center', paddingLeft: `${p(40)}px`, paddingRight: `${p(40)}px` }}>
          {(() => {
            const baseFontPx = p(58)
            const availPx = PREVIEW_W - p(80)
            const lyricSize = effectiveSection.lyrics.reduce((min, lyric) => {
              const estW = [...lyric].reduce((w, ch) => w + (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch) ? 1 : 0.55), 0) * min
              return estW > availPx ? min * (availPx / estW) : min
            }, baseFontPx)
            const lyricLH = lyricSize * (100 / 58)
            return effectiveSection.lyrics.map((lyric, idx) => (
              <p key={idx} style={{ fontSize: `${lyricSize}px`, fontWeight: 500, color: '#ffffff', lineHeight: `${lyricLH}px`, letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
                {renderLyric(lyric, lyricSize * 0.35)}
              </p>
            ))
          })()}
        </div>
        <div style={{ marginTop: `${p(20)}px`, textAlign: 'center' }}>
          {(() => {
            const availPx = PREVIEW_W - p(80)
            const previewChords = combineChords(effectiveSection.chords, 3)
            const sharedSize = previewChords.reduce((min, chord) => Math.min(min, availPx / (chord.length * 0.6)), 60 / S)
            return previewChords.map((chord, idx) => (
              <p key={idx} style={{ fontSize: `${sharedSize}px`, color: '#d5b26e', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 500, lineHeight: 1.3, whiteSpace: 'nowrap' }}>
                {chord}
              </p>
            ))
          })()}
        </div>
        <img src="/polygon-web-ig-story.png" alt="" style={{ width: `${p(532)}px`, marginTop: `${p(50)}px`, objectFit: 'contain' }} />
      </>
    )
  }

  const hasSelection = selectionStart !== null && selectionEnd !== null

  // Picker geometry
  const lyrics = selectedTab?.parsedContent?.lyrics || []
  const normStart = hasSelection ? Math.min(selectionStart, selectionEnd) : 0
  const normEnd = hasSelection ? Math.max(selectionStart, selectionEnd) : 0
  const totalH = lyrics.length * ITEM_H
  const selTop = normStart * ITEM_H
  const selBottom = (normEnd + 1) * ITEM_H

  const handleAttrs = (target) => ({
    onPointerDown: (e) => onHandlePointerDown(e, target),
    onPointerMove: onHandlePointerMove,
    onPointerUp: onHandlePointerUp,
  })

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Preview */}
          <div>
            <div ref={containerRef} className="w-full">
              <div style={{ width: `${PREVIEW_W * previewScale}px`, height: `${PREVIEW_H * previewScale}px`, overflow: 'hidden', margin: '0 auto', border: '1px solid rgb(255, 215, 0)' }}>
                {selectedTab && hasSelection ? (
                  <div style={{ width: `${PREVIEW_W}px`, height: `${PREVIEW_H}px`, transform: `scale(${previewScale})`, transformOrigin: 'top left', background: dominantColor ? `linear-gradient(to bottom, rgb(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}), #000000)` : '#121212', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontFamily: "'Noto Sans TC', 'Microsoft JhengHei', sans-serif" }}>
                    {renderImageContent()}
                  </div>
                ) : (
                  <div style={{ width: `${PREVIEW_W * previewScale}px`, height: `${PREVIEW_H * previewScale}px` }} className="bg-[#121212] rounded-xl border border-gray-800 flex items-center justify-center">
                    <p className="text-gray-500">{selectedTab ? '選擇段落' : '載入中...'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section picker + download */}
          <div className="flex flex-col gap-4 flex-1">
            {selectedTab && (
              <>
                <div className="bg-[#121212] rounded-xl border border-gray-800 p-4">
                  <h3 className="text-white font-bold">選擇段落</h3>
                  <div
                    ref={pickerRef}
                    style={{ position: 'relative', maxHeight: 320, overflowY: 'auto', paddingTop: PICKER_PAD, paddingBottom: PICKER_PAD }}
                  >
                    <div style={{ position: 'relative', height: totalH }}>
                      {/* Lyric rows */}
                      {lyrics.map((lyric, idx) => (
                        <div
                          key={idx}
                          style={{
                            position: 'absolute', top: idx * ITEM_H, left: 0, right: 0,
                            height: ITEM_H, display: 'flex', alignItems: 'center',
                            paddingLeft: 12, paddingRight: 12, fontSize: 15,
                            color: idx >= normStart && idx <= normEnd ? '#ffffff' : '#6b7280',
                          }}
                        >
                          {lyric.replace(/[()]/g, '')}
                        </div>
                      ))}

                      {/* Selected region */}
                      {hasSelection && (
                        <div style={{
                          position: 'absolute', top: selTop, height: selBottom - selTop,
                          left: 0, right: 0, pointerEvents: 'none',
                          background: 'rgba(255, 215, 0, 0.08)',
                          borderLeft: '3px solid #FFD700',
                          borderRight: '3px solid #FFD700',
                        }} />
                      )}

                      {/* Middle drag area */}
                      {hasSelection && selBottom - selTop > HANDLE_H && (
                        <div
                          {...handleAttrs('middle')}
                          style={{
                            position: 'absolute', top: selTop + HANDLE_H / 2, left: 0, right: 0,
                            height: selBottom - selTop - HANDLE_H,
                            cursor: 'grab', userSelect: 'none', touchAction: 'none',
                            zIndex: 5,
                          }}
                        />
                      )}

                      {/* Top handle — straddles the top boundary */}
                      {hasSelection && (
                        <div
                          {...handleAttrs('start')}
                          style={{
                            position: 'absolute', top: selTop - HANDLE_H / 2, left: 0, right: 0,
                            height: HANDLE_H, background: '#FFD700',
                            borderRadius: 4,
                            cursor: 'ns-resize', userSelect: 'none', touchAction: 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 10,
                          }}
                        >
                          <div style={{ width: 32, height: 3, background: 'rgba(0,0,0,0.3)', borderRadius: 2 }} />
                        </div>
                      )}

                      {/* Bottom handle — straddles the bottom boundary */}
                      {hasSelection && (
                        <div
                          {...handleAttrs('end')}
                          style={{
                            position: 'absolute', top: selBottom - HANDLE_H / 2, left: 0, right: 0,
                            height: HANDLE_H, background: '#FFD700',
                            borderRadius: 4,
                            cursor: 'ns-resize', userSelect: 'none', touchAction: 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 10,
                          }}
                        >
                          <div style={{ width: 32, height: 3, background: 'rgba(0,0,0,0.3)', borderRadius: 2 }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={generateImage}
                  disabled={isGenerating || !hasSelection}
                  className="w-full py-4 bg-[#FFD700] text-black rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGenerating ? <><RefreshCw className="animate-spin" size={18} /> 生成中...</> : <><Download size={18} /> 下載圖片</>}
                </button>
              </>
            )}
          </div>

        </div>
      </div>

      {savedImageUrl && (
        <div
          className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setSavedImageUrl(null)}
        >
          <p className="text-white text-center mb-4 text-sm">長按圖片 → 加入相片</p>
          <img
            src={savedImageUrl}
            alt="Generated"
            className="max-w-full max-h-[80vh] rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setSavedImageUrl(null)}
            className="mt-4 px-6 py-2 bg-[#FFD700] text-black rounded-full font-bold"
          >
            關閉
          </button>
        </div>
      )}
    </Layout>
  )
}

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { Download, RefreshCw } from 'lucide-react'

const splitLyricLine = (lyric, maxLen = 15) => {
  if (!lyric) return [lyric]
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

const PREVIEW_W = 400
const PREVIEW_H = 711
const S = 3
const p = (n) => n / S
const OUT_W = PREVIEW_W * S
const OUT_H = PREVIEW_H * S
const ITEM_H = 34
const HANDLE_H = 11
const PICKER_PAD = 15

export default function TabShareTool() {
  const router = useRouter()
  const [selectedTab, setSelectedTab] = useState(null)
  const [selectionStart, setSelectionStart] = useState(null)
  const [selectionEnd, setSelectionEnd] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewScale, setPreviewScale] = useState(1)
  const [dominantColor, setDominantColor] = useState(null)
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
          setSelectionStart(0)
          setSelectionEnd(Math.min(1, parsed.lyrics.length - 1))
        }
      }
    } catch (error) {
      console.error('Error loading tab:', error)
    }
  }

  const parseTabContent = (content) => {
    if (!content) return { chords: [], lyrics: [] }
    const lines = content.split('\n')
    const chords = []
    const lyrics = []
    lines.forEach(line => {
      const trimmed = line.trim()
      if (!trimmed) return
      if (trimmed.match(/[A-G][#b]?(m|maj|min|sus|add|dim|aug)?[0-9]?/) &&
          (trimmed.includes('|') || trimmed.match(/^[\sA-G#bmsusadddimaug0-9\/|\-]+$/))) {
        chords.push(trimmed)
      } else if (!trimmed.match(/^(key\s*:|intro|verse|chor|chrou|pre.?chor|pre.?chrou|bridge|outro|solo|\[|\()/i)) {
        splitLyricLine(trimmed).forEach(chunk => lyrics.push(chunk))
      }
    })
    return { chords, lyrics }
  }

  const getEffectiveSection = () => {
    if (!selectedTab || selectionStart === null || selectionEnd === null) return null
    const start = Math.min(selectionStart, selectionEnd)
    const end = Math.max(selectionStart, selectionEnd)
    return {
      lyrics: selectedTab.parsedContent.lyrics.slice(start, end + 1),
      chords: selectedTab.parsedContent.chords.slice(start, end + 1),
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
    if (!lyric || !/\([^)]+\)/.test(lyric)) return [{ text: lyric || '', hasStar: false }]
    const segments = []
    let lastIdx = 0
    const regex = /\(([^)]+)\)/g
    let match
    while ((match = regex.exec(lyric)) !== null) {
      if (match.index > lastIdx) segments.push({ text: lyric.slice(lastIdx, match.index), hasStar: false })
      segments.push({ text: match[1], hasStar: true })
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
        document.fonts.load(`400 60px "Source Code Pro"`),
        document.fonts.load(`400 60px "Noto Sans TC"`),
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
      let y = 172

      if (logoImg) {
        const logoW = 360
        const logoH = (logoImg.naturalHeight / logoImg.naturalWidth) * logoW
        ctx.drawImage(logoImg, (OUT_W - logoW) / 2, y, logoW, logoH)
        y += logoH
      }

      y += 50
      if (artImg) {
        const artSize = 712
        const srcSize = Math.min(artImg.naturalWidth, artImg.naturalHeight)
        const srcX = (artImg.naturalWidth - srcSize) / 2
        const srcY = (artImg.naturalHeight - srcSize) / 2
        ctx.drawImage(artImg, srcX, srcY, srcSize, srcSize, (OUT_W - artSize) / 2, y, artSize, artSize)
        y += artSize
      }

      y += 40
      ctx.font = `bold 50px "Noto Sans TC", "Microsoft JhengHei", sans-serif`
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(selectedTab.title, OUT_W / 2, y)
      y += 50 * 1.2

      y += 10
      ctx.font = `40px "Noto Sans TC", "Microsoft JhengHei", sans-serif`
      ctx.fillStyle = '#cccccc'
      ctx.fillText(selectedTab.artist, OUT_W / 2, y)
      y += 40 * 1.2

      y += 60
      const lyricFontSize = 58
      const lyricLineHeight = 120
      const starSize = 20
      ctx.font = `${lyricFontSize}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`
      ctx.fillStyle = '#ffffff'; ctx.lineWidth = 0

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
              ctx.drawImage(starImg, x + segW / 2 - starSize / 2, y - starSize * 1.3, starSize, starSize)
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
      const available = OUT_W - 80
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
      if ('wordSpacing' in ctx) ctx.wordSpacing = '0px'
      const REF = 60
      ctx.font = `${REF}px "Source Code Pro", monospace`
      const chordFontSize = effectiveSection.chords.reduce((min, chord) => {
        const w = ctx.measureText(chord).width
        return Math.min(min, w > 0 ? (available / w) * REF : min)
      }, REF)
      ctx.font = `${chordFontSize}px "Source Code Pro", monospace`
      for (const chord of effectiveSection.chords) {
        ctx.fillText(chord, OUT_W / 2, y)
        y += chordFontSize * 1.6
      }

      y += 50
      if (bottomImg) {
        const bottomW = 532
        const bottomH = (bottomImg.naturalHeight / bottomImg.naturalWidth) * bottomW
        ctx.drawImage(bottomImg, (OUT_W - bottomW) / 2, y, bottomW, bottomH)
      }

      const link = document.createElement('a')
      link.download = `${selectedTab.title}-${selectedTab.artist}-polygon.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
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
          <img src="/star.png" alt="" style={{ position: 'absolute', bottom: '90%', left: '50%', transform: 'translateX(-50%)', width: `${fontSize}px`, height: `${fontSize}px`, objectFit: 'contain' }} />
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
        <img src="/polygon-logo-white.png" alt="Polygon" style={{ width: `${p(360)}px`, marginTop: `${p(172)}px`, objectFit: 'contain' }} />
        <img src={getArtistImage() || ''} alt={selectedTab.title} style={{ width: `${p(712)}px`, height: `${p(712)}px`, objectFit: 'cover', marginTop: `${p(50)}px`, flexShrink: 0 }} />
        <p style={{ marginTop: `${p(40)}px`, fontSize: `${p(50)}px`, fontWeight: 'bold', color: '#ffffff', textAlign: 'center', lineHeight: 1.2, paddingLeft: `${p(40)}px`, paddingRight: `${p(40)}px` }}>
          {selectedTab.title}
        </p>
        <p style={{ marginTop: `${p(10)}px`, fontSize: `${p(40)}px`, color: '#cccccc', textAlign: 'center', lineHeight: 1.2 }}>
          {selectedTab.artist}
        </p>
        <div style={{ marginTop: `${p(50)}px`, textAlign: 'center', paddingLeft: `${p(40)}px`, paddingRight: `${p(40)}px` }}>
          {effectiveSection.lyrics.map((lyric, idx) => (
            <p key={idx} style={{ fontSize: `${p(58)}px`, color: '#ffffff', lineHeight: `${p(120)}px` }}>
              {renderLyric(lyric, p(20))}
            </p>
          ))}
        </div>
        <div style={{ marginTop: `${p(20)}px`, textAlign: 'center' }}>
          {(() => {
            const availPx = PREVIEW_W - p(80)
            const sharedSize = effectiveSection.chords.reduce((min, chord) => Math.min(min, availPx / (chord.length * 0.6)), p(60))
            return effectiveSection.chords.map((chord, idx) => (
              <p key={idx} style={{ fontSize: `${sharedSize}px`, color: '#d5b26e', fontFamily: "'Source Code Pro', monospace", lineHeight: 1.6, whiteSpace: 'nowrap' }}>
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
              <div style={{ width: `${PREVIEW_W * previewScale}px`, height: `${PREVIEW_H * previewScale}px`, overflow: 'hidden', margin: '0 auto' }}>
                {selectedTab && hasSelection ? (
                  <div style={{ width: `${PREVIEW_W}px`, height: `${PREVIEW_H}px`, transform: `scale(${previewScale})`, transformOrigin: 'top left', background: dominantColor ? `linear-gradient(to bottom, rgb(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}), #000000)` : '#121212', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden', fontFamily: "'Noto Sans TC', 'Microsoft JhengHei', sans-serif" }}>
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
                          {lyric}
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
    </Layout>
  )
}

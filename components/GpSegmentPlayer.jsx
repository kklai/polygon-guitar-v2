import { useEffect, useRef, useState } from 'react'

// 固定顏色 - 黑底黃字
const COLORS = {
  backgroundColor: '#1a1a1a',
  barNumberColor: '#FFD700',
  staffLineColor: '#FFFFFF',
  barSeparatorColor: '#FFFFFF',
  fretNumberColor: '#FFD700',
  chordNameColor: '#FFD700',
  timeSignatureColor: '#FFD700',
  tabTuningTextColor: '#FFD700',
  beatLineColor: '#FFFFFF',
  chordDiagramColor: '#FFFFFF',
  chordDiagramFretColor: '#FFD700',
  tabIndicatorColor: '#FFD700',
  noteStemColor: '#FFFFFF',
  restColor: '#FFD700'
}

export default function GpSegmentPlayer({ segment }) {
  const containerRef = useRef(null)
  const apiRef = useRef(null)
  const [isReady, setIsReady] = useState(false)
  const [isClient, setIsClient] = useState(false)
  
  const fileUrl = segment?.fileUrl || segment?.cloudinaryUrl
  const startBar = segment?.startBar || 1
  const endBar = segment?.endBar || 4

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || !containerRef.current || !fileUrl) return
    
    // 清理
    if (apiRef.current) {
      try { apiRef.current.destroy() } catch (e) {}
      apiRef.current = null
    }
    containerRef.current.innerHTML = ''
    setIsReady(false)
    
    let isMounted = true
    
    const init = async () => {
      try {
        const AlphaTab = await import('@coderline/alphatab')
        if (!isMounted || !containerRef.current) return
        
        const isMobile = window.innerWidth < 768
        const width = containerRef.current.clientWidth || 800
        
        const api = new AlphaTab.AlphaTabApi(containerRef.current, {
          core: {
            engine: 'svg',
            file: fileUrl,
            useWorkers: false,
            fontDirectory: '/fonts/'
          },
          display: {
            staveProfile: 'Tab',
            scale: isMobile ? 0.8 : 1.2,
            width: width,
            barsPerRow: isMobile ? 2 : 4,
            startBar: startBar,
            barCount: endBar - startBar + 1,
            resources: {
              barNumberColor: COLORS.barNumberColor,
              staffLineColor: COLORS.staffLineColor,
              barSeparatorColor: COLORS.barSeparatorColor,
              fretNumberColor: COLORS.fretNumberColor,
              chordNameColor: COLORS.chordNameColor,
              timeSignatureColor: COLORS.timeSignatureColor,
              tabTuningTextColor: COLORS.tabTuningTextColor,
              // 字體大小：FRET NUM 16
              tablatureFont: '16px Arial, sans-serif',
              barNumberFont: 'bold 14px Arial, sans-serif'
            }
          },
          notation: {
            elements: {
              scoreTitle: false,
              scoreSubTitle: false,
              scoreArtist: false,
              scoreAlbum: false,
              guitarTuning: false,
              effectTempo: false,
              trackNames: false
            }
          }
        })
        
        apiRef.current = api
        
        api.scoreLoaded.on(() => {
          if (isMounted) setIsReady(true)
        })
        
        api.renderFinished.on(() => {
          setTimeout(() => {
            runFixColorsMultipleTimes()
          }, 100)
        })
      } catch (err) {
        console.error(err)
      }
    }
    
    setTimeout(init, 100)
    
    return () => {
      isMounted = false
      if (apiRef.current) {
        try { apiRef.current.destroy() } catch (e) {}
      }
    }
  }, [isClient, fileUrl, startBar, endBar])

  // 顏色修復 - 確保所有元素都被處理
  const fixColors = () => {
    if (!containerRef.current) return
    const svg = containerRef.current.querySelector('svg')
    if (!svg) return

    // 0. 先注入強制 CSS 樣式到 SVG
    let styleEl = svg.querySelector('style[data-fix]')
    if (!styleEl) {
      styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      styleEl.setAttribute('data-fix', 'true')
      svg.insertBefore(styleEl, svg.firstChild)
    }
    styleEl.textContent = `
      * { stroke-width: 0.3 !important; }
      line, path { stroke: ${COLORS.staffLineColor} !important; stroke-width: 0.3 !important; }
      text, tspan { fill: ${COLORS.fretNumberColor} !important; }
      circle { fill: ${COLORS.chordDiagramFretColor} !important; stroke: ${COLORS.chordDiagramColor} !important; stroke-width: 0.3 !important; }
      rect { stroke: ${COLORS.chordDiagramColor} !important; stroke-width: 0.3 !important; }
    `

    // 1. 修改所有 text/tspan 元素 - 更全面的邏輯
    const texts = svg.querySelectorAll('text, tspan')
    texts.forEach(text => {
      const content = text.textContent?.trim() || ''
      const fontSize = parseFloat(text.getAttribute('font-size') || '12')
      const parentText = text.closest('text')
      const parentY = parentText ? parseFloat(parentText.getAttribute('y') || '0') : 0
      const selfY = parseFloat(text.getAttribute('y') || '0')
      const y = selfY || parentY
      
      // 隱藏水印
      const lowerContent = content.toLowerCase()
      if (lowerContent.includes('rendered') || lowerContent.includes('alphatab') || lowerContent.includes('by')) {
        text.style.display = 'none'
        return
      }
      
      // 判斷元素類型
      let fillColor = COLORS.fretNumberColor // 默認黃色
      
      if (content.includes('TAB')) {
        fillColor = COLORS.tabIndicatorColor
      }
      else if (/^[0-9]$/.test(content) && fontSize < 15) {
        // 品位數字
        fillColor = COLORS.fretNumberColor
      }
      else if (/^[0-9]+$/.test(content) && fontSize >= 15) {
        // 小節號（大號數字）
        fillColor = COLORS.barNumberColor
      }
      else if (/^[EADGBe]$/.test(content)) {
        // 調音文字
        fillColor = COLORS.tabTuningTextColor
      }
      else if (/^\d\/\d$/.test(content)) {
        // 拍號如 4/4
        fillColor = COLORS.timeSignatureColor
      }
      else if (/^[A-G][m#b0-9]*(sus|add|dim|aug)?[0-9]*$/.test(content)) {
        // 和弦名稱 - 關鍵！確保所有和弦名都是黃色
        fillColor = COLORS.chordNameColor
      }
      else if (content === 'C' || content === 'common') {
        // Common time
        fillColor = COLORS.timeSignatureColor
      }
      else if (y < 50 && /^[0-9ox]+$/.test(content)) {
        // 和弦圖上的品位標記（頂部區域）
        fillColor = COLORS.chordDiagramFretColor
      }
      
      // 強制設置顏色
      text.setAttribute('fill', fillColor)
      text.style.fill = fillColor
      text.style.color = fillColor
    })
    
    // 2. 修改所有 line 元素 - 極細線條
    const lines = svg.querySelectorAll('line')
    lines.forEach(line => {
      line.setAttribute('stroke', COLORS.staffLineColor)
      line.setAttribute('stroke-width', '0.3')
      line.style.stroke = COLORS.staffLineColor
      line.style.strokeWidth = '0.3'
    })
    
    // 3. 修改所有 path 元素
    const paths = svg.querySelectorAll('path')
    paths.forEach(path => {
      const d = path.getAttribute('d') || ''
      const hasFill = path.getAttribute('fill') && path.getAttribute('fill') !== 'none'
      
      // 判斷是否為和弦圖線條（簡單的直線）
      const isChordLine = d.match(/^[ML\s\d.-]+$/) && !d.includes('C')
      
      if (isChordLine) {
        path.setAttribute('stroke', COLORS.chordDiagramColor)
        path.style.stroke = COLORS.chordDiagramColor
      } else {
        path.setAttribute('stroke', COLORS.barSeparatorColor)
        path.style.stroke = COLORS.barSeparatorColor
      }
      
      path.setAttribute('stroke-width', '0.3')
      path.style.strokeWidth = '0.3'
      
      if (hasFill) {
        path.setAttribute('fill', COLORS.chordDiagramFretColor)
        path.style.fill = COLORS.chordDiagramFretColor
      }
    })
    
    // 4. 修改 rect 元素（和弦圖格子）
    const rects = svg.querySelectorAll('rect')
    rects.forEach(rect => {
      rect.setAttribute('stroke', COLORS.chordDiagramColor)
      rect.setAttribute('stroke-width', '0.3')
      rect.style.stroke = COLORS.chordDiagramColor
      rect.style.strokeWidth = '0.3'
      
      const hasFill = rect.getAttribute('fill') && rect.getAttribute('fill') !== 'none'
      if (hasFill) {
        rect.setAttribute('fill', COLORS.chordDiagramFretColor)
        rect.style.fill = COLORS.chordDiagramFretColor
      }
    })
    
    // 5. 修改 circle 元素（和弦圖上的點）
    const circles = svg.querySelectorAll('circle')
    circles.forEach(circle => {
      circle.setAttribute('fill', COLORS.chordDiagramFretColor)
      circle.setAttribute('stroke', COLORS.chordDiagramColor)
      circle.setAttribute('stroke-width', '0.3')
      circle.style.fill = COLORS.chordDiagramFretColor
      circle.style.stroke = COLORS.chordDiagramColor
      circle.style.strokeWidth = '0.3'
    })
    
    // 6. 修改 ellipse 元素（如果有）
    const ellipses = svg.querySelectorAll('ellipse')
    ellipses.forEach(ellipse => {
      ellipse.setAttribute('stroke', COLORS.staffLineColor)
      ellipse.setAttribute('stroke-width', '0.3')
      ellipse.style.stroke = COLORS.staffLineColor
      ellipse.style.strokeWidth = '0.3'
    })
  }
  
  // 多次執行確保渲染完成
  const runFixColorsMultipleTimes = () => {
    fixColors()
    setTimeout(fixColors, 200)
    setTimeout(fixColors, 500)
  }

  if (!isClient) return null

  return (
    <div className="my-2">
      {segment?.title && (
        <p className="text-sm text-[#FFD700] mb-1">
          {segment.title} (小節 {startBar}-{endBar})
        </p>
      )}
      <div 
        ref={containerRef} 
        className="w-full rounded-lg overflow-hidden"
        style={{ minHeight: '100px', backgroundColor: COLORS.backgroundColor }}
      />
    </div>
  )
}

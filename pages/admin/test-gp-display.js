/**
 * GP 顯示測試頁面（完整顏色控制版 + 自動載入範例）
 */

import { useState, useRef, useEffect } from 'react'
import Head from 'next/head'
import Layout from '@/components/Layout'

// 預設顏色方案
const PRESETS = {
  dark: {
    name: '🌙 黑底黃字',
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
  },
  light: {
    name: '☀️ 白底黑字',
    backgroundColor: '#FFFFFF',
    barNumberColor: '#000000',
    staffLineColor: '#000000',
    barSeparatorColor: '#000000',
    fretNumberColor: '#000000',
    chordNameColor: '#000000',
    timeSignatureColor: '#000000',
    tabTuningTextColor: '#000000',
    beatLineColor: '#000000',
    chordDiagramColor: '#000000',
    chordDiagramFretColor: '#000000',
    tabIndicatorColor: '#000000',
    noteStemColor: '#000000',
    restColor: '#000000'
  }
}

// 範例文件
const SAMPLE_FILE = {
  name: '幸福摩天輪.gp',
  path: '/samples/幸福摩天輪.gp'
}

export default function TestGpDisplay() {
  const [file, setFile] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [logs, setLogs] = useState([])
  const [totalBars, setTotalBars] = useState(0)
  const [startBar, setStartBar] = useState(1)
  const [endBar, setEndBar] = useState(4)
  
  // 顏色狀態
  const [colors, setColors] = useState(PRESETS.dark)
  
  const containerRef = useRef(null)
  const apiRef = useRef(null)

  const addLog = (msg) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  // 自動載入範例文件
  useEffect(() => {
    loadSampleFile()
  }, [])

  // 載入範例文件
  const loadSampleFile = async () => {
    try {
      addLog('載入範例文件...')
      const response = await fetch(SAMPLE_FILE.path)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const blob = await response.blob()
      const fakeFile = new File([blob], SAMPLE_FILE.name, { 
        type: 'application/guitar-pro'
      })
      setFile(fakeFile)
      setFileUrl(SAMPLE_FILE.path)
      addLog(`範例文件載入成功: ${SAMPLE_FILE.name}`)
      
      // 延遲渲染
      setTimeout(() => renderGp(fakeFile, SAMPLE_FILE.path), 500)
    } catch (err) {
      addLog(`❌ 範例文件載入失敗: ${err.message}`)
    }
  }

  const applyPreset = (presetKey) => {
    setColors(PRESETS[presetKey])
    addLog(`套用預設: ${PRESETS[presetKey].name}`)
    if (file) {
      setTimeout(() => renderGp(file, fileUrl), 100)
    }
  }

  const updateColor = (key, value) => {
    setColors(prev => ({ ...prev, [key]: value }))
  }

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return
    
    setFile(selectedFile)
    const newUrl = URL.createObjectURL(selectedFile)
    setFileUrl(newUrl)
    setLogs([])
    setIsReady(false)
    
    setTimeout(() => renderGp(selectedFile, newUrl), 300)
  }

  // 直接修改 SVG 顏色（渲染後）
  const applyColorsToSvg = () => {
    if (!containerRef.current) return
    const svg = containerRef.current.querySelector('svg')
    if (!svg) {
      addLog('❌ 找不到 SVG')
      return
    }

    addLog('直接修改 SVG 顏色...')
    
    // 1. 修改所有 text 元素
    const texts = svg.querySelectorAll('text, tspan')
    texts.forEach(text => {
      const content = text.textContent?.trim() || ''
      const fontSize = parseFloat(text.getAttribute('font-size') || '12')
      
      // 如果是 [TAB] 標記
      if (content.includes('TAB')) {
        text.setAttribute('fill', colors.tabIndicatorColor)
        text.style.fill = colors.tabIndicatorColor
      }
      // 如果是數字（品位數字）- 小字體
      else if (/^[0-9]$/.test(content) && fontSize < 15) {
        text.setAttribute('fill', colors.fretNumberColor)
        text.style.fill = colors.fretNumberColor
      }
      // 如果是小節號碼（在頂部的大數字）
      else if (/^[0-9]+$/.test(content) && fontSize >= 15) {
        text.setAttribute('fill', colors.barNumberColor)
        text.style.fill = colors.barNumberColor
      }
      // 調音文字（E, A, D, G, B, e）
      else if (/^[EADGBe]$/.test(content)) {
        text.setAttribute('fill', colors.tabTuningTextColor)
        text.style.fill = colors.tabTuningTextColor
      }
      // 拍子記號（4/4, 3/4, C 等）
      else if (/^\d\/\d$/.test(content) || content === 'C') {
        text.setAttribute('fill', colors.timeSignatureColor)
        text.style.fill = colors.timeSignatureColor
      }
      // 和弦名（通常是大寫字母開頭）
      else if (/^[A-G][m#b0-9]*$/.test(content)) {
        text.setAttribute('fill', colors.chordNameColor)
        text.style.fill = colors.chordNameColor
      }
      // 其他文字（和弦圖上的數字等）
      else {
        text.setAttribute('fill', colors.chordDiagramFretColor)
        text.style.fill = colors.chordDiagramFretColor
      }
    })
    
    // 2. 修改所有 line 元素
    const lines = svg.querySelectorAll('line')
    lines.forEach(line => {
      // 判斷是譜線還是拍子線
      const y1 = parseFloat(line.getAttribute('y1') || 0)
      const y2 = parseFloat(line.getAttribute('y2') || 0)
      const strokeWidth = parseFloat(line.getAttribute('stroke-width') || 1)
      
      // 拍子線通常比較短（垂直線）
      if (Math.abs(y1 - y2) < 5 && strokeWidth <= 1) {
        line.setAttribute('stroke', colors.beatLineColor)
        line.style.stroke = colors.beatLineColor
      } else {
        line.setAttribute('stroke', colors.staffLineColor)
        line.style.stroke = colors.staffLineColor
      }
    })
    
    // 3. 修改所有 path 元素
    const paths = svg.querySelectorAll('path')
    paths.forEach(path => {
      // 小節線通常是垂直的粗線
      const d = path.getAttribute('d') || ''
      
      // 和弦圖的格仔（矩形框）
      if (d.includes('M') && d.includes('L') && !d.includes('C')) {
        path.setAttribute('stroke', colors.chordDiagramColor)
        path.style.stroke = colors.chordDiagramColor
      } else {
        path.setAttribute('stroke', colors.barSeparatorColor)
        path.style.stroke = colors.barSeparatorColor
      }
      
      // 如果有 fill 屬性（和弦圓圈等）
      if (path.getAttribute('fill') && path.getAttribute('fill') !== 'none') {
        path.setAttribute('fill', colors.chordDiagramFretColor)
        path.style.fill = colors.chordDiagramFretColor
      }
    })
    
    // 4. 修改 rect 元素（和弦圖的格子）
    const rects = svg.querySelectorAll('rect')
    rects.forEach(rect => {
      rect.setAttribute('stroke', colors.chordDiagramColor)
      rect.style.stroke = colors.chordDiagramColor
      if (rect.getAttribute('fill') && rect.getAttribute('fill') !== 'none') {
        rect.setAttribute('fill', colors.chordDiagramFretColor)
        rect.style.fill = colors.chordDiagramFretColor
      }
    })
    
    // 5. 修改 circle 元素（和弦圓圈）
    const circles = svg.querySelectorAll('circle')
    circles.forEach(circle => {
      circle.setAttribute('fill', colors.chordDiagramFretColor)
      circle.style.fill = colors.chordDiagramFretColor
      circle.setAttribute('stroke', colors.chordDiagramColor)
      circle.style.stroke = colors.chordDiagramColor
    })
    
    addLog('✅ SVG 顏色已修改')
  }

  const renderGp = async (fileToRender = file, urlToUse = fileUrl) => {
    if (!fileToRender || !containerRef.current) return
    
    setIsLoading(true)
    addLog(`開始渲染: ${fileToRender.name}`)
    
    // 清理舊實例
    if (apiRef.current) {
      try { apiRef.current.destroy() } catch (e) {}
      apiRef.current = null
    }
    containerRef.current.innerHTML = ''
    
    try {
      const AlphaTab = await import('@coderline/alphatab')
      addLog('AlphaTab 載入成功')
      
      const isMobile = window.innerWidth < 768
      const containerWidth = containerRef.current.clientWidth || (isMobile ? 350 : 800)
      
      addLog(`${isMobile ? '手機' : '桌面'} ${containerWidth}px`)
      
      const settings = {
        core: {
          engine: 'svg',
          file: urlToUse,
          logLevel: 'warning',
          useWorkers: false,
          fontDirectory: '/fonts/'
        },
        display: {
          staveProfile: 'Tab',
          scale: isMobile ? 0.8 : 1.2,
          width: containerWidth,
          barsPerRow: isMobile ? 2 : 4,
          startBar: startBar,
          barCount: endBar - startBar + 1,
          resources: {
            barNumberColor: colors.barNumberColor,
            staffLineColor: colors.staffLineColor,
            barSeparatorColor: colors.barSeparatorColor,
            fretNumberColor: colors.fretNumberColor,
            chordNameColor: colors.chordNameColor,
            timeSignatureColor: colors.timeSignatureColor,
            tabTuningTextColor: colors.tabTuningTextColor,
            tablatureFont: '14px Arial, sans-serif',
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
      }
      
      addLog('創建 API...')
      const api = new AlphaTab.AlphaTabApi(containerRef.current, settings)
      apiRef.current = api
      
      api.scoreLoaded.on((score) => {
        addLog(`✅ 譜面載入: ${score.masterBars.length} 小節`)
        setTotalBars(score.masterBars.length)
        if (endBar > score.masterBars.length) {
          setEndBar(Math.min(4, score.masterBars.length))
        }
      })
      
      api.renderFinished.on(() => {
        addLog('✅ 渲染完成')
        setTimeout(() => {
          applyColorsToSvg()
          setIsReady(true)
          setIsLoading(false)
        }, 100)
      })
      
      api.error.on((e) => {
        addLog(`❌ 錯誤: ${e.message || JSON.stringify(e)}`)
        setIsLoading(false)
      })
      
      addLog('等待載入...')
      
    } catch (err) {
      addLog(`❌ ${err.message}`)
      setIsLoading(false)
    }
  }

  // 顏色控制項定義
  const colorControls = [
    { key: 'backgroundColor', label: '底色 (Background)', desc: '譜面背景顏色', important: false },
    { key: 'fretNumberColor', label: '品位數字 (Fret Numbers)', desc: 'TAB上的 0, 1, 2, 3...', important: true },
    { key: 'chordNameColor', label: '和弦名 (Chord Names)', desc: 'C, G, Am, F 等', important: true },
    { key: 'chordDiagramColor', label: '和弦圖格線 (Chord Diagram Lines)', desc: '和弦圖的框線', important: true },
    { key: 'chordDiagramFretColor', label: '和弦圓點 (Chord Dots)', desc: '和弦圖上的圓點和數字', important: true },
    { key: 'barNumberColor', label: '小節號碼 (Bar Numbers)', desc: '小節編號 1, 2, 3...', important: true },
    { key: 'timeSignatureColor', label: '拍子記號 (Time Signature)', desc: '4/4, 3/4, C 等', important: true },
    { key: 'beatLineColor', label: '拍子線 (Beat Lines)', desc: '拍子之間的垂直線', important: true },
    { key: 'tabIndicatorColor', label: '[TAB] 標記 (Tab Indicator)', desc: '左上角的 TAB 字樣', important: true },
    { key: 'staffLineColor', label: 'TAB 譜線 (Tab Lines)', desc: '六條橫線', important: false },
    { key: 'barSeparatorColor', label: '小節線 (Bar Lines)', desc: '分隔小節的粗線', important: false },
    { key: 'tabTuningTextColor', label: '調音文字 (Tuning)', desc: 'E A D G B e', important: false },
    { key: 'noteStemColor', label: '符桿 (Stems)', desc: '音符的直線', important: false },
    { key: 'restColor', label: '休止符 (Rests)', desc: '休止符號', important: false }
  ]

  return (
    <Layout>
      <Head><title>GP 顏色測試</title></Head>
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-white mb-4">🎨 GP 顏色完整控制</h1>
        
        {/* 文件選擇 */}
        <div className="bg-[#121212] rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium text-white">1. 選擇 GP 文件</h2>
            <button
              onClick={loadSampleFile}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition"
            >
              🔄 重新載入範例
            </button>
          </div>
          <input
            type="file"
            accept=".gp3,.gp4,.gp5,.gpx,.gp"
            onChange={handleFileSelect}
            className="block w-full text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#FFD700] file:text-black"
          />
          {file && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-green-400 text-sm">{file.name}</span>
              {file.name === SAMPLE_FILE.name && (
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">範例文件</span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* 左側：顏色控制 */}
          <div className="xl:col-span-1 space-y-4">
            {/* 預設方案 */}
            <div className="bg-[#121212] rounded-xl p-4">
              <h2 className="text-lg font-medium text-white mb-3">快速預設</h2>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition text-left"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
            
            {/* 詳細顏色控制 */}
            <div className="bg-[#121212] rounded-xl p-4 max-h-[600px] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-medium text-white">逐個調色</h2>
                <button
                  onClick={() => renderGp()}
                  disabled={!file || isLoading}
                  className="px-3 py-1 bg-[#FFD700] text-black rounded text-sm font-medium disabled:opacity-50"
                >
                  {isLoading ? '渲染中...' : '重新渲染'}
                </button>
              </div>
              
              <div className="space-y-2">
                {colorControls.map(({ key, label, desc, important }) => (
                  <div 
                    key={key} 
                    className={`bg-gray-900 rounded-lg p-3 ${important ? 'border-2 border-[#FFD700]' : ''}`}
                  >
                    <label className={`block text-sm ${important ? 'text-[#FFD700]' : 'text-gray-300'} mb-1`}>
                      {label}
                    </label>
                    <p className="text-xs text-gray-500 mb-2">{desc}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={colors[key] || '#FFD700'}
                        onChange={(e) => updateColor(key, e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border-0"
                      />
                      <input
                        type="text"
                        value={colors[key] || '#FFD700'}
                        onChange={(e) => updateColor(key, e.target.value)}
                        className="flex-1 px-2 py-1 bg-black border border-gray-700 rounded text-white text-sm font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* 右側：譜面預覽 */}
          <div className="xl:col-span-2">
            <div className="bg-[#121212] rounded-xl p-4 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-white">譜面預覽</h2>
                
                {isReady && totalBars > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">小節</span>
                    <input
                      type="number"
                      min={1}
                      max={totalBars}
                      value={startBar}
                      onChange={(e) => setStartBar(parseInt(e.target.value) || 1)}
                      className="w-14 px-2 py-1 bg-black border border-gray-700 rounded text-white text-sm text-center"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="number"
                      min={startBar}
                      max={totalBars}
                      value={endBar}
                      onChange={(e) => setEndBar(parseInt(e.target.value) || startBar)}
                      className="w-14 px-2 py-1 bg-black border border-gray-700 rounded text-white text-sm text-center"
                    />
                    <span className="text-gray-500 text-sm">/ {totalBars}</span>
                  </div>
                )}
              </div>
              
              {/* AlphaTab 容器 */}
              <div 
                ref={containerRef}
                className="rounded-lg overflow-hidden"
                style={{ 
                  minHeight: '300px',
                  backgroundColor: colors.backgroundColor,
                  width: '100%',
                  display: 'block'
                }}
              >
                {!file && (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    載入範例文件中...
                  </div>
                )}
                {isLoading && file && (
                  <div className="h-[300px] flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full" />
                  </div>
                )}
              </div>
              
              {/* 日誌 */}
              <div className="mt-4 bg-black rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">日誌</span>
                  <button
                    onClick={() => setLogs([])}
                    className="text-xs text-gray-500 hover:text-white"
                  >
                    清除
                  </button>
                </div>
                <div className="h-[120px] overflow-y-auto font-mono text-xs space-y-1">
                  {logs.length === 0 ? (
                    <p className="text-gray-600">等待操作...</p>
                  ) : (
                    logs.map((log, i) => (
                      <div 
                        key={i} 
                        className={log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : 'text-gray-400'}
                      >
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

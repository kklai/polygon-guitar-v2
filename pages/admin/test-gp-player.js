/**
 * GP 播放器測試頁面（獨立版本）
 * 測試 AlphaTab 的播放功能
 */

import { useState, useRef, useEffect } from 'react'
import Head from 'next/head'
import Layout from '@/components/Layout'

// 範例文件
const SAMPLE_FILE = {
  name: '幸福摩天輪.gp',
  path: '/samples/幸福摩天輪.gp'
}

export default function TestGpPlayer() {
  const [file, setFile] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [logs, setLogs] = useState([])
  const [totalBars, setTotalBars] = useState(0)
  const [currentBar, setCurrentBar] = useState(1)
  const [playbackSpeed, setPlaybackSpeed] = useState(100)
  const [volume, setVolume] = useState(100)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalTime, setTotalTime] = useState(0)
  const [audioInitialized, setAudioInitialized] = useState(false)
  const [initError, setInitError] = useState(null)
  
  const containerRef = useRef(null)
  const apiRef = useRef(null)

  const addLog = (msg) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  useEffect(() => {
    loadSampleFile()
    return () => {
      if (apiRef.current) {
        try { apiRef.current.destroy() } catch (e) {}
      }
    }
  }, [])

  const loadSampleFile = async () => {
    try {
      addLog('載入範例文件...')
      const response = await fetch(SAMPLE_FILE.path)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const fakeFile = new File([blob], SAMPLE_FILE.name, { type: 'application/guitar-pro' })
      setFile(fakeFile)
      setFileUrl(SAMPLE_FILE.path)
      addLog(`✅ 範例文件載入成功`)
      setTimeout(() => renderGp(fakeFile, SAMPLE_FILE.path), 500)
    } catch (err) {
      addLog(`❌ 範例文件載入失敗: ${err.message}`)
    }
  }

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return
    setFile(selectedFile)
    const newUrl = URL.createObjectURL(selectedFile)
    setFileUrl(newUrl)
    setLogs([])
    setIsReady(false)
    setIsPlaying(false)
    setInitError(null)
    setAudioInitialized(false)
    setTimeout(() => renderGp(selectedFile, newUrl), 300)
  }

  const renderGp = async (fileToRender = file, urlToUse = fileUrl) => {
    if (!fileToRender || !containerRef.current) return
    
    setIsLoading(true)
    setInitError(null)
    addLog(`開始渲染...`)
    
    if (apiRef.current) {
      try { apiRef.current.destroy() } catch (e) {}
      apiRef.current = null
    }
    containerRef.current.innerHTML = ''
    
    try {
      const AlphaTab = await import('@coderline/alphatab')
      addLog('✅ AlphaTab 載入成功')
      
      const isMobile = window.innerWidth < 768
      const containerWidth = containerRef.current.clientWidth || (isMobile ? 350 : 800)
      
      // 檢查 player 是否可用
      addLog(`檢查 Player API...`)
      
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
          scale: isMobile ? 0.7 : 1.0,
          width: containerWidth,
          barsPerRow: isMobile ? 2 : 4
        },
        // AlphaTab 1.8+ 的 player 設置
        player: {
          enablePlayer: true,
          soundFont: 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.8.1/dist/soundfont/sonivox.sf2'
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
      
      addLog('創建 AlphaTab API...')
      const api = new AlphaTab.AlphaTabApi(containerRef.current, settings)
      apiRef.current = api
      
      // 檢查 player 是否存在
      if (!api.player) {
        addLog('⚠️ Player 不可用，嘗試手動創建...')
      } else {
        addLog('✅ Player 已創建')
      }
      
      // 事件監聽
      if (api.player) {
        api.player.stateChanged.on((e) => {
          const states = ['stopped', 'paused', 'playing']
          addLog(`播放狀態: ${states[e.state] || e.state}`)
          setIsPlaying(e.state === 2)
        })
        
        api.player.positionChanged.on((e) => {
          setCurrentTime(e.currentTime)
          setTotalTime(e.endTime)
          
          if (api.score) {
            const barIndex = api.score.masterBars.findIndex(b => 
              e.currentTime >= b.start && e.currentTime < b.end
            )
            if (barIndex !== -1) setCurrentBar(barIndex + 1)
          }
        })
        
        // SoundFont 加載事件
        api.player.soundFontLoaded.on(() => {
          addLog('✅ SoundFont 加載完成')
          setAudioInitialized(true)
          setInitError(null)
        })
        
        api.player.soundFontLoadFailed.on((e) => {
          addLog(`❌ SoundFont 加載失敗: ${e}`)
          setInitError(`SoundFont 加載失敗: ${e}`)
        })
      }
      
      api.scoreLoaded.on((score) => {
        addLog(`✅ 譜面載入: ${score.masterBars.length} 小節, ${Math.floor(score.duration/1000)}秒`)
        setTotalBars(score.masterBars.length)
        setTotalTime(score.duration)
        setIsReady(true)
        setIsLoading(false)
        
        // 嘗試初始化音頻
        if (api.player) {
          addLog('初始化音頻播放器...')
          // AlphaTab 1.8+ 不需要手動調用 ready()，player 會自動加載 SoundFont
          // 只需要檢查是否已經加載
          if (api.player.state) {
            addLog('✅ 音頻播放器已就緒')
          }
        }
      })
      
      api.renderFinished.on(() => {
        addLog('✅ 渲染完成')
      })
      
      api.error.on((e) => {
        const errorMsg = typeof e === 'string' ? e : (e.message || JSON.stringify(e))
        addLog(`❌ 錯誤: ${errorMsg}`)
        if (errorMsg.includes('audio') || errorMsg.includes('player') || errorMsg.includes('instance')) {
          setInitError(errorMsg)
        }
      })
      
    } catch (err) {
      addLog(`❌ ${err.message}`)
      setInitError(err.message)
      setIsLoading(false)
    }
  }

  // 播放控制
  const togglePlay = async () => {
    if (!apiRef.current?.player) {
      addLog('❌ Player 不可用')
      return
    }
    
    try {
      // AlphaTab 1.8+ 不需要調用 ready()，直接播放即可
      if (isPlaying) {
        apiRef.current.player.pause()
      } else {
        apiRef.current.player.play()
      }
      setAudioInitialized(true)
    } catch (e) {
      addLog(`❌ 播放錯誤: ${e.message}`)
      setInitError(e.message)
    }
  }

  const stopPlayback = () => {
    if (!apiRef.current?.player) return
    try {
      apiRef.current.player.stop()
      setCurrentTime(0)
      setCurrentBar(1)
    } catch (e) {
      addLog(`❌ ${e.message}`)
    }
  }

  const seekToBar = (barNumber) => {
    if (!apiRef.current?.player || !apiRef.current.score) return
    try {
      const barIndex = Math.max(0, Math.min(barNumber - 1, totalBars - 1))
      const bar = apiRef.current.score.masterBars[barIndex]
      if (bar) {
        apiRef.current.player.tickPosition = bar.start
      }
    } catch (e) {
      addLog(`❌ ${e.message}`)
    }
  }

  const changeSpeed = (speed) => {
    if (!apiRef.current) return
    try {
      setPlaybackSpeed(speed)
      apiRef.current.playbackSpeed = speed / 100
    } catch (e) {
      addLog(`❌ ${e.message}`)
    }
  }

  const changeVolume = (vol) => {
    if (!apiRef.current?.player) return
    try {
      setVolume(vol)
      apiRef.current.player.volume = vol / 100
    } catch (e) {
      addLog(`❌ ${e.message}`)
    }
  }

  const formatTime = (ms) => {
    if (!ms || isNaN(ms)) return '0:00'
    const secs = Math.floor(ms / 1000)
    return `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`
  }

  return (
    <Layout>
      <Head><title>GP 播放器測試</title></Head>
      
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-white mb-2">🎵 GP 播放器測試</h1>
        
        {initError && (
          <div className="bg-red-900/50 border border-red-700 rounded-xl p-4 mb-4">
            <h3 className="text-red-400 font-medium mb-2">⚠️ 播放器錯誤</h3>
            <p className="text-red-300 text-sm mb-3">{initError}</p>
            <p className="text-gray-400 text-xs mb-3">
              這可能是 SoundFont 加載問題。嘗試重新載入頁面或使用不同的音頻設置。
            </p>
          </div>
        )}
        
        {/* 文件選擇 */}
        <div className="bg-[#121212] rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium text-white">選擇 GP 文件</h2>
            <button
              onClick={loadSampleFile}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
            >
              🔄 重新載入
            </button>
          </div>
          <input
            type="file"
            accept=".gp3,.gp4,.gp5,.gpx,.gp"
            onChange={handleFileSelect}
            className="block w-full text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:bg-[#FFD700] file:text-black file:border-0"
          />
          {file && (
            <div className="mt-2 text-green-400 text-sm">{file.name}</div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 控制面板 */}
          <div className="space-y-4">
            {/* 播放控制 */}
            <div className="bg-[#121212] rounded-xl p-4">
              <h2 className="text-lg font-medium text-white mb-4">播放控制</h2>
              
              <div className="flex items-center justify-center gap-3 mb-4">
                <button
                  onClick={stopPlayback}
                  disabled={!isReady}
                  className="w-12 h-12 rounded-full bg-gray-700 text-white flex items-center justify-center disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12"/></svg>
                </button>
                
                <button
                  onClick={togglePlay}
                  disabled={!isReady}
                  className={`w-16 h-16 rounded-full flex items-center justify-center disabled:opacity-50 ${
                    apiRef.current?.player ? 'bg-[#FFD700] text-black' : 'bg-gray-600 text-gray-400'
                  }`}
                >
                  {isPlaying ? (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                    </svg>
                  ) : (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  )}
                </button>
              </div>
              
              {/* 狀態指示 */}
              <div className="text-center mb-4">
                <span className={`text-xs px-2 py-1 rounded ${
                  apiRef.current?.player ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
                }`}>
                  {apiRef.current?.player ? '🔊 Player 可用' : '❌ Player 不可用'}
                </span>
              </div>
              
              {/* 時間 */}
              <div className="text-center mb-4">
                <div className="text-2xl font-mono text-[#FFD700]">
                  {formatTime(currentTime)} / {formatTime(totalTime)}
                </div>
                <div className="text-sm text-gray-400">
                  小節 {currentBar} / {totalBars}
                </div>
              </div>
              
              {/* 進度條 */}
              <div className="mb-4">
                <input
                  type="range"
                  min={1}
                  max={totalBars || 1}
                  value={currentBar}
                  onChange={(e) => {
                    const bar = parseInt(e.target.value)
                    setCurrentBar(bar)
                    seekToBar(bar)
                  }}
                  disabled={!isReady}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
              </div>
              
              {/* 速度 */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">速度: {playbackSpeed}%</label>
                <input
                  type="range"
                  min={25}
                  max={200}
                  step={5}
                  value={playbackSpeed}
                  onChange={(e) => changeSpeed(parseInt(e.target.value))}
                  disabled={!isReady}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
              </div>
              
              {/* 音量 */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">音量: {volume}%</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => changeVolume(parseInt(e.target.value))}
                  disabled={!isReady}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
              </div>
            </div>
            
            {/* 快速跳轉 */}
            <div className="bg-[#121212] rounded-xl p-4">
              <h2 className="text-lg font-medium text-white mb-3">快速跳轉</h2>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: Math.min(8, totalBars) }, (_, i) => i + 1).map(bar => (
                  <button
                    key={bar}
                    onClick={() => seekToBar(bar)}
                    disabled={!isReady}
                    className={`px-2 py-1 rounded text-sm ${
                      currentBar === bar ? 'bg-[#FFD700] text-black' : 'bg-gray-800 text-white'
                    } disabled:opacity-50`}
                  >
                    {bar}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* 譜面顯示 */}
          <div className="lg:col-span-2">
            <div className="bg-[#121212] rounded-xl p-4">
              <h2 className="text-lg font-medium text-white mb-4">譜面顯示</h2>
              
              <div 
                ref={containerRef}
                className="rounded-lg overflow-hidden bg-[#1a1a1a] min-h-[400px]"
              >
                {!file && <div className="h-[400px] flex items-center justify-center text-gray-500">載入中...</div>}
                {isLoading && <div className="h-[400px] flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full"/></div>}
              </div>
              
              {/* 日誌 */}
              <div className="mt-4 bg-black rounded-lg p-3">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-400">日誌</span>
                  <button onClick={() => setLogs([])} className="text-xs text-gray-500">清除</button>
                </div>
                <div className="h-[150px] overflow-y-auto font-mono text-xs">
                  {logs.map((log, i) => (
                    <div key={i} className={log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : 'text-gray-400'}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

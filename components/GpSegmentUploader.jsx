/**
 * Guitar Pro 段落上傳組件（簡化版）
 */

import { useState, useRef } from 'react'
import { uploadGpFile, getGpFileInfo } from '@/lib/cloudinaryGp'
import { uploadGpFileToFirebase } from '@/lib/firebaseStorage'

const SEGMENT_TYPES = [
  { value: 'intro', label: '前奏', icon: '🎵' },
  { value: 'verse', label: '主歌', icon: '🎤' },
  { value: 'chorus', label: '副歌', icon: '🎸' },
  { value: 'interlude', label: '間奏', icon: '✨' },
  { value: 'solo', label: 'Solo', icon: '🎸' },
  { value: 'outro', label: '尾奏', icon: '🔚' },
  { value: 'bridge', label: '橋段', icon: '🌉' },
  { value: 'prechorus', label: '導歌', icon: '🎶' }
]

export default function GpSegmentUploader({ 
  songTitle = '',
  onSegmentAdd,
  existingSegments = [],
  theme = 'dark' // 'dark' | 'light'
}) {
  const [file, setFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [totalBars, setTotalBars] = useState(0)
  const [isLoadingScore, setIsLoadingScore] = useState(false)
  const [segmentType, setSegmentType] = useState('intro')
  const [startBar, setStartBar] = useState(1)
  const [endBar, setEndBar] = useState(4)
  const [error, setError] = useState(null)
  
  // 顯示設置（預設值）
  const [displaySettings, setDisplaySettings] = useState({
    barsPerRow: 2,        // 預設每行 2 個小節
    lineThickness: 0.3,   // 預設線條 0.3
    fretFontSize: 16      // 預設字體 16
  })
  
  const containerRef = useRef(null)
  const fileInputRef = useRef(null)
  const apiRef = useRef(null)

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return
    
    try {
      const fileInfo = getGpFileInfo(selectedFile.name)
      console.log('Selected file:', fileInfo)
      setFile(selectedFile)
      setError(null)
      
      // 開始上傳和解析
      await processFile(selectedFile)
    } catch (err) {
      setError(err.message)
    }
  }

  const processFile = async (fileToProcess) => {
    setIsUploading(true)
    
    // 1. 先上傳
    let uploadResult
    try {
      try {
        uploadResult = await uploadGpFile(fileToProcess, songTitle)
      } catch (cloudinaryErr) {
        console.log('Cloudinary failed, trying Firebase...', cloudinaryErr)
        uploadResult = await uploadGpFileToFirebase(fileToProcess, songTitle)
      }
      setUploadedFile(uploadResult)
    } catch (uploadErr) {
      setError('上傳失敗: ' + uploadErr.message)
      setIsUploading(false)
      return
    }
    
    // 2. 等待 UI 更新後再初始化 AlphaTab
    setTimeout(() => {
      loadWithAlphaTab(fileToProcess)
    }, 100)
  }

  const loadWithAlphaTab = async (file) => {
    if (!containerRef.current) {
      console.error('Container not ready')
      setError('容器未準備好')
      return
    }
    
    setIsLoadingScore(true)
    
    try {
      console.log('Loading AlphaTab...')
      const AlphaTab = await import('@coderline/alphatab')
      console.log('AlphaTab loaded:', AlphaTab)
      
      // 創建 Blob URL
      const blobUrl = URL.createObjectURL(file)
      console.log('Blob URL:', blobUrl)
      
      // 根據主題設置資源
      let resources
      if (typeof theme === 'object' && theme !== null) {
        // 如果是完整的顏色對象
        resources = {
          barNumberColor: theme.barNumberColor || '#FFD700',
          staffLineColor: theme.staffLineColor || '#FFFFFF',
          barSeparatorColor: theme.barSeparatorColor || '#FFFFFF',
          fretNumberColor: theme.fretNumberColor || '#FFD700',
          chordNameColor: theme.chordNameColor || '#FFD700',
          timeSignatureColor: theme.timeSignatureColor || '#FFD700',
          tabTuningTextColor: theme.tabTuningTextColor || '#FFD700',
          noteDotColor: theme.noteDotColor || theme.fretNumberColor || '#FFD700',
          noteStemColor: theme.noteStemColor || theme.fretNumberColor || '#FFD700',
          restColor: theme.restColor || theme.fretNumberColor || '#FFD700',
          clefColor: theme.clefColor || theme.fretNumberColor || '#FFD700',
          tripletFeelColor: theme.tripletFeelColor || theme.fretNumberColor || '#FFD700',
          tablatureFont: '14px Arial, sans-serif',
          barNumberFont: 'bold 14px Arial, sans-serif'
        }
      } else if (theme === 'light') {
        // 白底黑字主題
        resources = {
          barNumberColor: '#000000',
          staffLineColor: '#000000',
          barSeparatorColor: '#000000',
          fretNumberColor: '#000000',
          chordNameColor: '#000000',
          timeSignatureColor: '#000000',
          tabTuningTextColor: '#000000',
          noteDotColor: '#000000',
          noteStemColor: '#000000',
          restColor: '#000000',
          clefColor: '#000000',
          tripletFeelColor: '#000000',
          tablatureFont: '14px Arial, sans-serif',
          barNumberFont: 'bold 14px Arial, sans-serif'
        }
      } else {
        // 默認黑底黃字
        resources = {
          barNumberColor: '#FFD700',
          staffLineColor: '#FFFFFF',
          barSeparatorColor: '#FFFFFF',
          fretNumberColor: '#FFD700',
          chordNameColor: '#FFD700',
          timeSignatureColor: '#FFD700',
          tabTuningTextColor: '#FFD700',
          noteDotColor: '#FFD700',
          noteStemColor: '#FFD700',
          restColor: '#FFD700',
          clefColor: '#FFD700',
          tripletFeelColor: '#FFD700',
          tablatureFont: '14px Arial, sans-serif',
          barNumberFont: 'bold 14px Arial, sans-serif'
        }
      }
      
      const settings = {
        core: {
          engine: 'svg',
          file: blobUrl,
          logLevel: 'warning',
          useWorkers: false,
          fontDirectory: '/fonts/'
        },
        display: {
          staveProfile: 'Tab',
          scale: 0.8,
          width: containerRef.current.clientWidth || 600,
          barsPerRow: 4,
          resources
        },
        notation: {
          elements: {
            scoreTitle: false,
            scoreSubTitle: false,
            scoreArtist: false,
            scoreAlbum: false,
            guitarTuning: false,
            effectTempo: false
          }
        }
      }
      
      console.log('Creating API with settings:', settings)
      const api = new AlphaTab.AlphaTabApi(containerRef.current, settings)
      apiRef.current = api
      
      api.scoreLoaded.on((score) => {
        console.log('Score loaded! Bars:', score.masterBars.length)
        setTotalBars(score.masterBars.length)
        setEndBar(Math.min(4, score.masterBars.length))
        setIsLoadingScore(false)
        URL.revokeObjectURL(blobUrl)
      })
      
      api.error.on((err) => {
        console.error('AlphaTab error:', err)
        setError('無法讀取 GP 文件: ' + (err.message || JSON.stringify(err)))
        setIsLoadingScore(false)
        URL.revokeObjectURL(blobUrl)
      })
      
      api.renderFinished.on(() => {
        console.log('Render finished')
      })
      
    } catch (err) {
      console.error('Init error:', err)
      setError('初始化失敗: ' + err.message)
      setIsLoadingScore(false)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = () => {
    if (!uploadedFile) {
      setError('請等待上傳完成')
      return
    }
    
    // 清理數據，確保沒有 undefined
    const segment = {
      id: `gp-${Date.now()}`,
      type: segmentType || 'intro',
      cloudinaryUrl: uploadedFile.url || uploadedFile.cloudinaryUrl || null,
      cloudinaryPublicId: uploadedFile.publicId || uploadedFile.cloudinaryPublicId || null,
      fileUrl: uploadedFile.url || null,
      filePath: uploadedFile.path || null,
      storageType: uploadedFile.path ? 'firebase' : 'cloudinary',
      startBar: parseInt(startBar) || 1,
      endBar: parseInt(endBar) || 1,
      originalFilename: uploadedFile.originalFilename || file?.name || 'unknown.gp',
      fileSize: uploadedFile.fileSize || 0,
      format: uploadedFile.format || 'gp',
      totalBars: totalBars || 0,
      // 儲存顯示設置
      displaySettings: {
        barsPerRow: displaySettings.barsPerRow,
        lineThickness: displaySettings.lineThickness,
        fretFontSize: displaySettings.fretFontSize
      },
      createdAt: new Date().toISOString()
    }
    
    // 移除所有 null/undefined 值
    Object.keys(segment).forEach(key => {
      if (segment[key] === undefined) {
        delete segment[key]
      }
    })
    
    console.log('Saving segment:', segment)
    onSegmentAdd(segment)
    
    // 重置
    setFile(null)
    setUploadedFile(null)
    setTotalBars(0)
    setStartBar(1)
    setEndBar(4)
    setSegmentType('intro')
    if (apiRef.current) {
      try {
        apiRef.current.destroy()
      } catch (e) {
        console.error('Error destroying API:', e)
      }
      apiRef.current = null
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemove = () => {
    setFile(null)
    setUploadedFile(null)
    setTotalBars(0)
    setError(null)
    if (apiRef.current) {
      apiRef.current.destroy()
      apiRef.current = null
    }
    // 不要直接操作 DOM，讓 React 處理
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const isValid = totalBars > 0 && startBar <= endBar && endBar <= totalBars

  return (
    <div className="bg-[#121212] rounded-xl border border-gray-800 p-6">
      <h3 className="text-lg font-medium text-white mb-4">🎸 Guitar Pro 段落</h3>
      
      {!uploadedFile ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".gp3,.gp4,.gp5,.gpx,.gp"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div 
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed border-gray-700 rounded-xl p-8 text-center transition ${
              isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#FFD700] cursor-pointer'
            }`}
          >
            <div className="text-4xl mb-3">📁</div>
            <p className="text-gray-400 mb-2">
              {isUploading ? '上傳中...' : '點擊上傳 Guitar Pro 文件'}
            </p>
            <p className="text-xs text-gray-600">支援 .gp3, .gp4, .gp5, .gpx, .gp</p>
          </div>
          
          {error && (
            <div className="mt-3 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
              ❌ {error}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* 文件信息 */}
          <div className="p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎵</span>
                <div>
                  <p className="text-green-300 font-medium">{uploadedFile.originalFilename}</p>
                  <p className="text-xs text-green-500/70">
                    {(uploadedFile.fileSize / 1024).toFixed(1)} KB • {totalBars > 0 ? `${totalBars} 小節` : '讀取中...'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleRemove}
                className="text-gray-500 hover:text-red-400 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* 主題切換提示 */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>預覽主題：</span>
            <span className="text-gray-300">
              {typeof theme === 'object' ? '🎨 自定義顏色' : (theme === 'dark' ? '🌙 黑底黃字' : '☀️ 白底黑字')}
            </span>
          </div>
          
          {/* AlphaTab 預覽 */}
          <div 
            className="rounded-lg overflow-hidden"
            style={{ 
              minHeight: '200px',
              backgroundColor: typeof theme === 'object' ? (theme.backgroundColor || '#1a1a1a') : (theme === 'light' ? '#FFFFFF' : '#1a1a1a')
            }}
          >
            {isLoadingScore && (
              <div className="h-[200px] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full" />
              </div>
            )}
            <div 
              ref={containerRef}
              style={{ minHeight: isLoadingScore ? 0 : '200px' }}
            />
          </div>
          
          {/* 段落設置 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">段落類型</label>
              <select
                value={segmentType}
                onChange={(e) => setSegmentType(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white outline-none"
              >
                {SEGMENT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm text-gray-400 mb-2">開始小節</label>
                <input
                  type="number"
                  min={1}
                  max={totalBars || 1}
                  value={startBar}
                  onChange={(e) => setStartBar(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">結束小節</label>
                <input
                  type="number"
                  min={startBar}
                  max={totalBars || 1}
                  value={endBar}
                  onChange={(e) => setEndBar(parseInt(e.target.value) || startBar)}
                  className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white outline-none"
                />
              </div>
            </div>
          </div>
          
          {/* 顯示設置 - 手機版優化 */}
          <div className="bg-gray-900/50 rounded-lg p-3 space-y-3">
            <p className="text-xs text-gray-500 font-medium">📱 手機版顯示設置</p>
            
            <div className="grid grid-cols-3 gap-3">
              {/* 每行小節數 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">每行小節</label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setDisplaySettings(prev => ({ ...prev, barsPerRow: 1 }))}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition ${
                      displaySettings.barsPerRow === 1 
                        ? 'bg-[#FFD700] text-black' 
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    1
                  </button>
                  <button
                    onClick={() => setDisplaySettings(prev => ({ ...prev, barsPerRow: 2 }))}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition ${
                      displaySettings.barsPerRow === 2 
                        ? 'bg-[#FFD700] text-black' 
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    2
                  </button>
                </div>
              </div>
              
              {/* 線條粗細 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">線條粗幼</label>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.1"
                  value={displaySettings.lineThickness}
                  onChange={(e) => setDisplaySettings(prev => ({ 
                    ...prev, 
                    lineThickness: parseFloat(e.target.value) 
                  }))}
                  className="w-full h-5 bg-gray-800 rounded cursor-pointer"
                />
                <span className="text-[10px] text-gray-500">{displaySettings.lineThickness.toFixed(1)}</span>
              </div>
              
              {/* 字體大小 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">字體大小</label>
                <input
                  type="range"
                  min="12"
                  max="20"
                  step="1"
                  value={displaySettings.fretFontSize}
                  onChange={(e) => setDisplaySettings(prev => ({ 
                    ...prev, 
                    fretFontSize: parseInt(e.target.value) 
                  }))}
                  className="w-full h-5 bg-gray-800 rounded cursor-pointer"
                />
                <span className="text-[10px] text-gray-500">{displaySettings.fretFontSize}px</span>
              </div>
            </div>
          </div>
          
          {!isValid && totalBars > 0 && (
            <p className="text-red-400 text-sm">
              ⚠️ 結束小節必須大於開始小節且不超過總小節數
            </p>
          )}
          
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="w-full px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            ✓ 添加段落
          </button>
        </div>
      )}
      
      {/* 現有段落列表 */}
      {existingSegments.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-800">
          <h4 className="text-sm font-medium text-gray-400 mb-3">
            已添加段落 ({existingSegments.length})
          </h4>
          <div className="space-y-2">
            {existingSegments.map((segment, index) => (
              <div 
                key={segment.id || index}
                className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {SEGMENT_TYPES.find(t => t.value === segment.type)?.icon || '🎵'}
                  </span>
                  <div>
                    <p className="text-white text-sm">
                      {SEGMENT_TYPES.find(t => t.value === segment.type)?.label || segment.type}
                    </p>
                    <p className="text-xs text-gray-500">
                      小節 {segment.startBar}-{segment.endBar} • {segment.originalFilename}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

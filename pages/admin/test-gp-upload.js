/**
 * GP 文件上傳測試頁面
 * 測試 Cloudinary 和 Firebase Storage 上傳功能
 */

import { useState, useRef } from 'react'
import { uploadGpFile, getGpFileInfo } from '@/lib/cloudinaryGp'
import { uploadGpFileToFirebase } from '@/lib/firebaseStorage'
import Layout from '@/components/Layout'

export default function TestGpUpload() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState([])
  const [alphaTabResult, setAlphaTabResult] = useState(null)
  const fileInputRef = useRef(null)
  const containerRef = useRef(null)

  const addResult = (type, message, data = null) => {
    setResults(prev => [{
      id: Date.now(),
      type,
      message,
      data,
      time: new Date().toLocaleTimeString()
    }, ...prev])
  }

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return

    try {
      const fileInfo = getGpFileInfo(selectedFile.name)
      setFile({
        ...fileInfo,
        originalFile: selectedFile,
        size: selectedFile.size
      })
      addResult('info', `選擇文件: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`, fileInfo)
    } catch (err) {
      addResult('error', err.message)
    }
  }

  const testCloudinary = async () => {
    if (!file?.originalFile) {
      addResult('error', '請先選擇文件')
      return
    }

    setUploading(true)
    addResult('info', '開始測試 Cloudinary 上傳...')

    try {
      const result = await uploadGpFile(file.originalFile, 'test-song')
      addResult('success', 'Cloudinary 上傳成功！', result)
    } catch (err) {
      addResult('error', `Cloudinary 上傳失敗: ${err.message}`, err)
    } finally {
      setUploading(false)
    }
  }

  const testFirebase = async () => {
    if (!file?.originalFile) {
      addResult('error', '請先選擇文件')
      return
    }

    setUploading(true)
    addResult('info', '開始測試 Firebase Storage 上傳...')

    try {
      const result = await uploadGpFileToFirebase(file.originalFile, 'test-song')
      addResult('success', 'Firebase Storage 上傳成功！', result)
    } catch (err) {
      addResult('error', `Firebase Storage 上傳失敗: ${err.message}`, err)
    } finally {
      setUploading(false)
    }
  }

  const testBoth = async () => {
    await testCloudinary()
    await testFirebase()
  }

  const testAlphaTab = async () => {
    if (!file?.originalFile) {
      addResult('error', '請先選擇文件')
      return
    }

    if (!containerRef.current) {
      addResult('error', '渲染容器未準備好')
      return
    }

    setAlphaTabResult({ status: 'loading', message: '正在初始化 AlphaTab...' })
    addResult('info', '開始測試 AlphaTab 讀取...')

    try {
      addResult('info', '正在載入 AlphaTab 模組...')
      const AlphaTab = await import('@coderline/alphatab')
      addResult('success', 'AlphaTab 模組載入成功', { version: AlphaTab.version })

      // 清理容器
      containerRef.current.innerHTML = ''
      
      // 創建 Blob URL
      const blobUrl = URL.createObjectURL(file.originalFile)
      addResult('info', '已創建 Blob URL', { url: blobUrl })
      
      const settings = {
        core: {
          engine: 'svg',
          file: blobUrl,
          logLevel: 'info',
          useWorkers: false,
        },
        display: {
          staveProfile: 'Tab',
          scale: 0.8,
          width: containerRef.current.clientWidth || 600,
          barsPerRow: 4
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
      
      addResult('info', '正在創建 AlphaTab API...')
      const api = new AlphaTab.AlphaTabApi(containerRef.current, settings)
      addResult('success', 'AlphaTab API 創建成功')
      
      // 監聽事件
      api.scoreLoaded.on((score) => {
        const info = {
          totalBars: score.masterBars.length,
          tracks: score.tracks.length,
          title: score.title,
          artist: score.artist
        }
        addResult('success', `AlphaTab 讀取成功！共 ${info.totalBars} 小節`, info)
        setAlphaTabResult({ status: 'success', message: `讀取成功！${info.totalBars} 小節`, info })
        URL.revokeObjectURL(blobUrl)
      })
      
      api.error.on((error) => {
        const errorInfo = {
          message: error.message,
          type: error.type,
          details: error.details
        }
        addResult('error', 'AlphaTab 讀取失敗: ' + error.message, errorInfo)
        setAlphaTabResult({ status: 'error', message: error.message, info: errorInfo })
        URL.revokeObjectURL(blobUrl)
      })
      
      addResult('info', '等待 AlphaTab 讀取文件...')
      
    } catch (err) {
      addResult('error', 'AlphaTab 測試失敗: ' + err.message, { stack: err.stack })
      setAlphaTabResult({ status: 'error', message: err.message })
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-2">🧪 GP 文件上傳測試</h1>
        <p className="text-neutral-400 mb-8">測試 Cloudinary 和 Firebase Storage 上傳功能</p>

        {/* 文件選擇 */}
        <div className="bg-[#121212] rounded-xl p-6 mb-6">
          <h2 className="text-lg font-medium text-white mb-4">1. 選擇 GP 文件</h2>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".gp3,.gp4,.gp5,.gpx,.gp"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-neutral-700 rounded-xl p-8 text-center hover:border-[#FFD700] transition cursor-pointer"
          >
            {file ? (
              <div>
                <div className="text-4xl mb-2">🎵</div>
                <p className="text-white font-medium">{file.originalFile.name}</p>
                <p className="text-neutral-400 text-sm">
                  {(file.size / 1024).toFixed(1)} KB • {file.format}
                </p>
              </div>
            ) : (
              <div>
                <div className="text-4xl mb-2">📁</div>
                <p className="text-neutral-400">點擊選擇 Guitar Pro 文件</p>
                <p className="text-neutral-600 text-sm">支援 .gp3, .gp4, .gp5, .gpx, .gp</p>
              </div>
            )}
          </div>
        </div>

        {/* 測試按鈕 */}
        {file && (
          <div className="bg-[#121212] rounded-xl p-6 mb-6">
            <h2 className="text-lg font-medium text-white mb-4">2. 選擇測試</h2>
            
            <div className="flex flex-wrap gap-3">
              <button
                onClick={testCloudinary}
                disabled={uploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                ☁️ 測試 Cloudinary
              </button>
              
              <button
                onClick={testFirebase}
                disabled={uploading}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
              >
                🔥 測試 Firebase
              </button>
              
              <button
                onClick={testBoth}
                disabled={uploading}
                className="px-4 py-2 bg-[#FFD700] text-black rounded-lg hover:opacity-90 transition disabled:opacity-50"
              >
                🚀 測試兩者
              </button>
              
              <button
                onClick={testAlphaTab}
                disabled={uploading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
              >
                🎸 測試 AlphaTab
              </button>
            </div>

            {uploading && (
              <div className="mt-4 flex items-center gap-2 text-neutral-400">
                <div className="animate-spin w-4 h-4 border-2 border-[#FFD700] border-t-transparent rounded-full" />
                上傳中...
              </div>
            )}
          </div>
        )}

        {/* AlphaTab 渲染區域 */}
        {file && (
          <div className="bg-[#121212] rounded-xl p-6 mb-6">
            <h2 className="text-lg font-medium text-white mb-4">🎸 AlphaTab 渲染測試</h2>
            
            {alphaTabResult && (
              <div className={`p-3 rounded-lg mb-4 ${
                alphaTabResult.status === 'success' ? 'bg-green-900/30 border border-green-700' :
                alphaTabResult.status === 'error' ? 'bg-red-900/30 border border-red-700' :
                'bg-blue-900/30 border border-blue-700'
              }`}>
                <p className={
                  alphaTabResult.status === 'success' ? 'text-green-200' :
                  alphaTabResult.status === 'error' ? 'text-red-200' :
                  'text-blue-200'
                }>
                  {alphaTabResult.status === 'loading' && '⏳ '}
                  {alphaTabResult.status === 'success' && '✅ '}
                  {alphaTabResult.status === 'error' && '❌ '}
                  {alphaTabResult.message}
                </p>
                {alphaTabResult.info?.totalBars && (
                  <p className="text-sm text-neutral-400 mt-1">
                    音軌數: {alphaTabResult.info.tracks} | 
                    標題: {alphaTabResult.info.title || 'N/A'} |
                    藝人: {alphaTabResult.info.artist || 'N/A'}
                  </p>
                )}
              </div>
            )}
            
            <div 
              ref={containerRef}
              className="min-h-[200px] bg-[#1a1a1a] rounded-lg overflow-hidden"
            >
              <p className="text-neutral-500 text-center py-8">
                點擊「測試 AlphaTab」按鈕在此處渲染譜面
              </p>
            </div>
          </div>
        )}

        {/* 結果日誌 */}
        <div className="bg-[#121212] rounded-xl p-6">
          <h2 className="text-lg font-medium text-white mb-4">📋 測試結果</h2>
          
          {results.length === 0 ? (
            <p className="text-neutral-500">尚未進行測試</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {results.map((result) => (
                <div 
                  key={result.id}
                  className={`p-4 rounded-lg ${
                    result.type === 'success' ? 'bg-green-900/30 border border-green-700' :
                    result.type === 'error' ? 'bg-red-900/30 border border-red-700' :
                    'bg-neutral-800/50 border border-neutral-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <span className={`text-xs font-medium ${
                        result.type === 'success' ? 'text-green-400' :
                        result.type === 'error' ? 'text-red-400' :
                        'text-blue-400'
                      }`}>
                        {result.type === 'success' ? '✓ SUCCESS' :
                         result.type === 'error' ? '✗ ERROR' :
                         'ℹ INFO'}
                      </span>
                      <p className={`mt-1 ${
                        result.type === 'success' ? 'text-green-200' :
                        result.type === 'error' ? 'text-red-200' :
                        'text-neutral-300'
                      }`}>
                        {result.message}
                      </p>
                      
                      {result.data && (
                        <pre className="mt-2 p-2 bg-black/50 rounded text-xs text-neutral-400 overflow-x-auto">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      )}
                    </div>
                    <span className="text-xs text-neutral-600 ml-4">{result.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 環境變數檢查 */}
        <div className="bg-[#121212] rounded-xl p-6 mt-6">
          <h2 className="text-lg font-medium text-white mb-4">⚙️ 環境配置</h2>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-400">Cloudinary Cloud Name:</span>
              <span className={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ? 'text-green-400' : 'text-red-400'}>
                {process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '未設置'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Firebase Storage Bucket:</span>
              <span className={process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? 'text-green-400' : 'text-red-400'}>
                {process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? '已設置' : '未設置'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

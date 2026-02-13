import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { getAllTabs } from '@/lib/tabs'
import { extractYouTubeVideoId } from '@/lib/wikipedia'

// 搜尋 YouTube
async function searchYouTube(artist, title, apiKey) {
  try {
    const query = `${artist} ${title}`
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
      `part=snippet&` +
      `q=${encodeURIComponent(query)}&` +
      `type=video&` +
      `maxResults=1&` +
      `relevanceLanguage=zh-HK&` +
      `key=${apiKey}`
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      if (response.status === 403 && errorData.error?.errors?.[0]?.reason === 'quotaExceeded') {
        throw new Error('API quota 已用完')
      }
      throw new Error(`API 錯誤: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.items && data.items.length > 0) {
      const videoId = data.items[0].id.videoId
      return {
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: data.items[0].snippet.title,
        thumbnail: data.items[0].snippet.thumbnails?.default?.url
      }
    }
    
    return null
  } catch (error) {
    throw error
  }
}

function BulkYouTubePage() {
  const router = useRouter()
  const [apiKey, setApiKey] = useState('')
  const [tabs, setTabs] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [logs, setLogs] = useState([])
  const [filter, setFilter] = useState('no-youtube') // 'no-youtube' | 'all'
  const [batchSize, setBatchSize] = useState(50)
  const [isPaused, setIsPaused] = useState(false)

  // 載入 API Key
  useEffect(() => {
    const savedKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || ''
    if (savedKey && savedKey !== 'your_youtube_api_key_here') {
      setApiKey(savedKey)
    }
  }, [])

  // 載入譜列表
  const loadTabs = async () => {
    setIsLoading(true)
    try {
      const allTabs = await getAllTabs()
      
      // 過濾
      let filtered = allTabs
      if (filter === 'no-youtube') {
        filtered = allTabs.filter(tab => !tab.youtubeUrl || tab.youtubeUrl.trim() === '')
      }
      
      setTabs(filtered)
      addLog(`已載入 ${filtered.length} 份譜`)
    } catch (error) {
      addLog(`載入失敗: ${error.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }])
  }

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  // 開始批量處理
  const startProcessing = async () => {
    if (!apiKey) {
      alert('請先輸入 YouTube API Key')
      return
    }

    setIsProcessing(true)
    setProgress({ current: 0, total: Math.min(batchSize, tabs.length) })
    addLog(`開始處理，目標: ${Math.min(batchSize, tabs.length)} 份譜`)

    const toProcess = tabs.slice(0, batchSize)
    let successCount = 0
    let failCount = 0
    let skipCount = 0

    for (let i = 0; i < toProcess.length; i++) {
      if (isPaused) {
        addLog('⏸️ 處理已暫停', 'warning')
        break
      }

      const tab = toProcess[i]
      setProgress({ current: i + 1, total: toProcess.length })

      // 檢查是否已有 YouTube
      if (tab.youtubeUrl && tab.youtubeUrl.trim() !== '') {
        addLog(`[${i + 1}] ${tab.artist} - ${tab.title}: 已存在，跳過`, 'skip')
        skipCount++
        continue
      }

      try {
        addLog(`[${i + 1}] 搜尋: ${tab.artist} - ${tab.title}...`)
        
        const result = await searchYouTube(tab.artist, tab.title, apiKey)
        
        if (!result) {
          addLog(`  ❌ 找不到結果`, 'error')
          failCount++
          continue
        }

        // 更新數據庫
        const { updateDoc, doc, getFirestore } = await import('firebase/firestore')
        const { db } = await import('@/lib/firebase')
        
        await updateDoc(doc(db, 'tabs', tab.id), {
          youtubeUrl: result.url,
          youtubeVideoId: result.videoId,
          updatedAt: new Date().toISOString()
        })

        addLog(`  ✅ 已添加: ${result.title.substring(0, 40)}...`, 'success')
        successCount++

        // 更新本地數據
        tab.youtubeUrl = result.url
        tab.youtubeVideoId = result.videoId

      } catch (error) {
        if (error.message.includes('quota')) {
          addLog(`  ❌ API Quota 已用完，請明日再試`, 'error')
          break
        }
        addLog(`  ❌ 錯誤: ${error.message}`, 'error')
        failCount++
      }

      // 每 50 個額外等待
      if (i % 50 === 49) {
        addLog('⏳ 已處理 50 個，額外等待 5 秒...', 'warning')
        await sleep(5000)
      } else {
        await sleep(500) // 每次間隔 500ms
      }
    }

    addLog(`\n📊 處理完成: 成功 ${successCount}, 跳過 ${skipCount}, 失敗 ${failCount}`, 'success')
    setIsProcessing(false)
    setIsPaused(false)
  }

  const stopProcessing = () => {
    setIsPaused(true)
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 pb-8">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-gray-800 -mx-4 px-4 py-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">批量添加 YouTube</h1>
              <p className="text-sm text-[#B3B3B3]">自動為舊譜添加 YouTube 連結</p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="text-[#B3B3B3] hover:text-white transition"
            >
              返回後台
            </button>
          </div>
        </div>

        {/* API Key 輸入 */}
        <div className="bg-[#121212] rounded-xl p-4 border border-gray-800 mb-6">
          <label className="block text-sm font-medium text-white mb-2">
            YouTube API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="輸入你的 YouTube Data API v3 Key"
            className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-gray-600"
          />
          <p className="text-xs text-gray-500 mt-2">
            每日限額 10,000 quota，約可處理 100 個影片搜尋
          </p>
        </div>

        {/* 設定 */}
        <div className="bg-[#121212] rounded-xl p-4 border border-gray-800 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">過濾條件</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white"
              >
                <option value="no-youtube">只顯示冇 YouTube 嘅譜</option>
                <option value="all">顯示所有譜</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">每次處理數量</label>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white"
              >
                <option value={10}>10 份</option>
                <option value={50}>50 份</option>
                <option value={100}>100 份</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={loadTabs}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-[#282828] text-white rounded-lg hover:bg-[#3E3E3E] transition disabled:opacity-50"
              >
                {isLoading ? '載入中...' : '載入譜列表'}
              </button>
            </div>
          </div>
        </div>

        {/* 統計 */}
        {tabs.length > 0 && (
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">待處理譜數量</p>
                <p className="text-2xl font-bold text-white">{tabs.length}</p>
              </div>
              <div className="text-right">
                {!isProcessing ? (
                  <button
                    onClick={startProcessing}
                    disabled={tabs.length === 0}
                    className="px-6 py-3 bg-[#FFD700] text-black rounded-lg font-medium hover:bg-yellow-400 transition disabled:opacity-50"
                  >
                    ⚡ 開始批量處理
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm text-gray-400">處理進度</p>
                      <p className="text-lg font-bold text-white">
                        {progress.current} / {progress.total}
                      </p>
                    </div>
                    <button
                      onClick={stopProcessing}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                    >
                      暫停
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* 進度條 */}
            {isProcessing && (
              <div className="mt-4">
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#FFD700] transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 日誌 */}
        <div className="bg-[#121212] rounded-xl border border-gray-800">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="font-medium text-white">處理日誌</h3>
            <button
              onClick={() => setLogs([])}
              className="text-sm text-gray-400 hover:text-white"
            >
              清除
            </button>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto font-mono text-sm space-y-1">
            {logs.length === 0 ? (
              <p className="text-gray-500">等待開始...</p>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={`${
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-green-400' :
                    log.type === 'warning' ? 'text-yellow-400' :
                    log.type === 'skip' ? 'text-gray-500' :
                    'text-gray-300'
                  }`}
                >
                  <span className="text-gray-600">[{log.time}]</span> {log.message}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 使用說明 */}
        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800 rounded-xl">
          <h4 className="text-blue-400 font-medium mb-2">使用說明</h4>
          <ul className="text-sm text-blue-200/80 space-y-1 list-disc list-inside">
            <li>你需要先申請 YouTube Data API v3 Key</li>
            <li>每個 Google 帳戶每日有 10,000 quota，約可處理 100 個搜尋</li>
            <li>建議分批處理，每次 50 份譜</li>
            <li>處理過程中請勿關閉頁面</li>
            <li>API Key 只會保存在你的瀏覽器，不會上傳到伺服器</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

export default function BulkYouTubeGuard() {
  return (
    <AdminGuard>
      <BulkYouTubePage />
    </AdminGuard>
  )
}

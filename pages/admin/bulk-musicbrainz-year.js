// 專門用 MusicBrainz 批量獲取最早年份
// 特點：速度快、無配額限制、選最早年份

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { getAllTabs } from '@/lib/tabs'
import { updateDoc, doc } from '@/lib/firestore-tracked'
import { db } from '@/lib/firebase'

function BulkMusicBrainzYearPage() {
  const router = useRouter()
  const [tabs, setTabs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [logs, setLogs] = useState([])
  
  // 處理狀態
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  
  // 批次大小（MusicBrainz 較寬鬆，可以設大啲）
  const [batchSize, setBatchSize] = useState(100)
  
  // 目標歌曲（沒有年份的）
  const [targetTabs, setTargetTabs] = useState([])
  
  // 處理結果
  const [results, setResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  
  // 統計
  const [stats, setStats] = useState({
    total: 0,
    noYear: 0,
    withMbYear: 0,
    success: 0,
    failed: 0
  })

  useEffect(() => {
    loadData()
  }, [])
  
  const loadData = async () => {
    setIsLoading(true)
    try {
      const tabsData = await getAllTabs()
      // 只保留沒有年份的歌曲
      const validTabs = tabsData.filter(tab => 
        tab.title && tab.title.trim() && 
        !tab.songYear && // 沒有年份
        tab.artist // 有歌手名
      )
      setTabs(tabsData)
      setTargetTabs(validTabs)
      setStats(prev => ({
        ...prev,
        total: tabsData.length,
        noYear: validTabs.length,
        withMbYear: tabsData.filter(t => t.musicbrainzYear).length
      }))
      addLog(`載入 ${tabsData.length} 首歌曲，其中 ${validTabs.length} 首需要補充年份`, 'info')
    } catch (error) {
      console.error('Error loading tabs:', error)
      addLog(`載入失敗: ${error.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev.slice(-199), { message, type, time: new Date().toLocaleTimeString() }])
  }

  // ===== 查詢 MusicBrainz 獲取最早年份 =====
  const fetchEarliestYearFromMusicBrainz = async (artist, title) => {
    try {
      // 策略 1: 用歌手+歌名精確搜尋
      let query = encodeURIComponent(`artist:"${artist}" AND recording:"${title}"`)
      let response = await fetch(
        `https://musicbrainz.org/ws/2/recording?query=${query}&fmt=json&limit=5`,
        { 
          headers: { 
            'User-Agent': 'PolygonGuitar/1.0 (kermit.tam@gmail.com)'
          } 
        }
      )
      
      if (!response.ok) {
        // 如果失敗，嘗試寬鬆搜尋
        query = encodeURIComponent(`${artist} ${title}`)
        response = await fetch(
          `https://musicbrainz.org/ws/2/recording?query=${query}&fmt=json&limit=10`,
          { 
            headers: { 
              'User-Agent': 'PolygonGuitar/1.0 (kermit.tam@gmail.com)'
            } 
          }
        )
      }
      
      if (!response.ok) return null
      
      const data = await response.json()
      if (!data.recordings || data.recordings.length === 0) return null
      
      // 在所有結果中找最早年份
      let earliestYear = null
      let earliestRelease = null
      let foundRecording = null
      
      for (const recording of data.recordings) {
        if (recording.releases && recording.releases.length > 0) {
          for (const release of recording.releases) {
            if (release.date) {
              const year = parseInt(release.date.split('-')[0])
              if (year && year > 1900 && year <= new Date().getFullYear()) {
                if (!earliestYear || year < earliestYear) {
                  earliestYear = year
                  earliestRelease = {
                    title: release.title,
                    date: release.date,
                    id: release.id
                  }
                  foundRecording = recording
                }
              }
            }
          }
        }
      }
      
      if (!earliestYear) return null
      
      return {
        year: earliestYear,
        release: earliestRelease,
        recording: {
          id: foundRecording?.id,
          title: foundRecording?.title
        }
      }
    } catch (error) {
      console.error('MusicBrainz error:', error)
      return null
    }
  }

  // ===== 執行批量處理 =====
  const runBatchUpdate = async () => {
    const toProcess = targetTabs.slice(0, batchSize)
    
    if (toProcess.length === 0) {
      alert('沒有需要處理的歌曲（所有歌曲已有年份）')
      return
    }
    
    if (!confirm(`確定要處理 ${toProcess.length} 首歌曲嗎？\n\n將會：\n1. 用 MusicBrainz 查詢每首歌的最早發行年份\n2. 直接寫入資料庫\n\n預計需時約 ${Math.ceil(toProcess.length * 1.2)} 秒`)) return
    
    setIsProcessing(true)
    setProgress({ current: 0, total: toProcess.length })
    setResults([])
    setShowResults(true)
    
    let successCount = 0
    let failedCount = 0
    const processed = []
    
    for (let i = 0; i < toProcess.length; i++) {
      const tab = toProcess[i]
      setProgress({ current: i + 1, total: toProcess.length })
      
      const result = {
        tabId: tab.id,
        title: tab.title,
        artist: tab.artist,
        year: null,
        album: null,
        updated: false,
        error: null
      }
      
      try {
        addLog(`[${i+1}/${toProcess.length}] ${tab.artist} - ${tab.title}`, 'info')
        
        const mbData = await fetchEarliestYearFromMusicBrainz(tab.artist, tab.title)
        
        if (mbData && mbData.year) {
          result.year = mbData.year
          result.album = mbData.release?.title
          
          // 寫入資料庫
          await updateDoc(doc(db, 'tabs', tab.id), {
            songYear: mbData.year,
            yearSource: 'musicbrainz',
            musicbrainzYear: mbData.year,
            musicbrainzRecordingId: mbData.recording?.id,
            ...(mbData.release?.title && { album: mbData.release.title }),
            updatedAt: new Date().toISOString()
          })
          
          result.updated = true
          successCount++
          addLog(`  ✅ ${mbData.year} (${mbData.release?.title || '未知專輯'})`, 'success')
        } else {
          addLog(`  ⚠️ 未找到年份`, 'warning')
        }
      } catch (error) {
        result.error = error.message
        failedCount++
        addLog(`  ❌ ${error.message}`, 'error')
      }
      
      processed.push(result)
      setResults([...processed])
      
      // MusicBrainz 限制：每秒約 1 個請求，但實際可以更快
      // 用 800ms 確保穩定
      await new Promise(r => setTimeout(r, 800))
    }
    
    setIsProcessing(false)
    setStats(prev => ({
      ...prev,
      success: prev.success + successCount,
      failed: prev.failed + failedCount
    }))
    
    addLog(`========== 批次完成 ==========`, 'success')
    addLog(`成功: ${successCount} | 失敗: ${failedCount} | 總計: ${processed.length}`, 'success')
    
    alert(`處理完成！\n✅ 成功更新: ${successCount} 首\n❌ 失敗: ${failedCount} 首`)
    
    // 刷新數據
    loadData()
  }

  // 繼續處理下一批
  const processNextBatch = () => {
    setShowResults(false)
    setResults([])
    runBatchUpdate()
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-gray-800 -mx-4 px-4 py-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>🧠</span> MusicBrainz 批量補充年份
              </h1>
              <p className="text-sm text-[#B3B3B3]">
                快速獲取所有歌曲的最早發行年份（無 API 配額限制）
              </p>
            </div>
            <button onClick={() => router.push('/admin')} className="text-[#B3B3B3] hover:text-white transition">
              返回後台
            </button>
          </div>
        </div>

        {/* 統計卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-sm text-gray-400">總歌曲數</div>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-red-900/50">
            <div className="text-2xl font-bold text-red-400">{stats.noYear}</div>
            <div className="text-sm text-gray-400">❌ 無年份</div>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-purple-900/50">
            <div className="text-2xl font-bold text-purple-400">{stats.withMbYear}</div>
            <div className="text-sm text-gray-400">🧠 已有 MB 年份</div>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-green-900/50">
            <div className="text-2xl font-bold text-green-400">{stats.success}</div>
            <div className="text-sm text-gray-400">✅ 本次成功</div>
          </div>
        </div>

        {/* 說明 */}
        <div className="mb-6 p-4 bg-[#1a1a2e] rounded-xl border border-purple-900/50">
          <h3 className="text-purple-300 font-medium mb-2">💡 為什麼用 MusicBrainz？</h3>
          <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
            <li><b>無配額限制</b>：不像 Spotify 有每日限制，可以大量處理</li>
            <li><b>準確年份</b>：找最早發行的版本（通常是原版）</li>
            <li><b>速度快</b>：每秒約 1 個請求，100 首歌約需 2 分鐘</li>
            <li><b>資料詳細</b>：包含專輯名稱、發行日期等</li>
          </ul>
          <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
            <p className="text-yellow-400 text-sm">
              ⚠️ <b>注意</b>：MusicBrainz 只提供年份和專輯名，不提供封面圖片。
              封面圖片需要之後用 Spotify 或其他方式補充。
            </p>
          </div>
        </div>

        {/* 操作區 */}
        {!showResults && (
          <div className="mb-6 p-4 bg-[#121212] rounded-xl border border-gray-800">
            <h3 className="text-white font-medium mb-4">開始批量處理</h3>
            
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="px-4 py-2 bg-black border border-gray-700 rounded-lg text-white"
              >
                <option value={50}>每次 50 首（穩定）</option>
                <option value={100}>每次 100 首（推薦）</option>
                <option value={200}>每次 200 首（快速）</option>
                <option value={500}>每次 500 首（大量）</option>
              </select>
              
              <button
                onClick={runBatchUpdate}
                disabled={isProcessing || targetTabs.length === 0}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    處理中... {progress.current}/{progress.total}
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    開始處理 ({Math.min(batchSize, targetTabs.length)} 首)
                  </>
                )}
              </button>
            </div>
            
            <p className="text-sm text-gray-500">
              💡 建議：{targetTabs.length > 0 ? `還有 ${targetTabs.length} 首需要處理` : '所有歌曲已有年份'}。
              每次處理後可以點「繼續下一批」直到全部完成。
            </p>
          </div>
        )}

        {/* 處理結果 */}
        {showResults && results.length > 0 && (
          <div className="mb-6 bg-[#121212] rounded-xl border border-purple-500 overflow-hidden">
            <div className="p-4 border-b border-gray-800 bg-purple-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-purple-300 font-medium">處理結果</h3>
                  <p className="text-sm text-gray-400">
                    成功: {results.filter(r => r.updated).length} / {results.length}
                  </p>
                </div>
                <div className="flex gap-2">
                  {targetTabs.length > results.length && (
                    <button
                      onClick={processNextBatch}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-500 transition disabled:opacity-50"
                    >
                      繼續下一批 ({targetTabs.length - results.length} 首)
                    </button>
                  )}
                  <button
                    onClick={() => setShowResults(false)}
                    className="px-4 py-2 text-gray-400 hover:text-white transition"
                  >
                    返回
                  </button>
                </div>
              </div>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-black sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-3 text-gray-400 font-medium">歌曲</th>
                    <th className="text-center p-3 text-gray-400 font-medium">最早年份</th>
                    <th className="text-left p-3 text-gray-400 font-medium">專輯</th>
                    <th className="text-center p-3 text-gray-400 font-medium">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {results.map((item) => (
                    <tr key={item.tabId} className={`${
                      item.updated ? 'bg-purple-900/10' : 'bg-gray-900/30'
                    }`}>
                      <td className="p-3">
                        <div className="text-white font-medium">{item.title}</div>
                        <div className="text-gray-500 text-xs">{item.artist}</div>
                      </td>
                      <td className="p-3 text-center">
                        {item.year ? (
                          <span className="text-[#FFD700] font-bold text-lg">{item.year}</span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {item.album ? (
                          <span className="text-gray-400 text-sm">{item.album}</span>
                        ) : (
                          <span className="text-gray-600 text-sm">-</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {item.updated ? (
                          <span className="text-green-400">✅ 已更新</span>
                        ) : item.error ? (
                          <span className="text-red-400">❌ 失敗</span>
                        ) : (
                          <span className="text-gray-500">⏭️ 未找到</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 日誌 */}
        {logs.length > 0 && (
          <div className="bg-[#121212] rounded-xl border border-gray-800">
            <div className="p-3 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-medium text-white">處理日誌</h3>
              <button onClick={() => setLogs([])} className="text-xs text-gray-500 hover:text-white">清除</button>
            </div>
            <div className="p-3 max-h-96 overflow-y-auto font-mono text-sm space-y-1">
              {logs.map((log, i) => (
                <div key={i} className={`${
                  log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-gray-300'
                }`}>
                  <span className="text-gray-600">[{log.time}]</span> {log.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default function BulkMusicBrainzYearGuard() {
  return (
    <AdminGuard>
      <BulkMusicBrainzYearPage />
    </AdminGuard>
  )
}

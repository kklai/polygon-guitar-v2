// 兩步驟批量更新：1) MusicBrainz 拿年份 → 2) Spotify 補充專輯/封面
// 最終年份選兩者中最早的

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { getAllTabs } from '@/lib/tabs'
import { updateDoc, doc } from '@/lib/firestore-tracked'
import { db } from '@/lib/firebase'

function BulkUpdateYearPage() {
  const router = useRouter()
  const [tabs, setTabs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [logs, setLogs] = useState([])
  
  // 處理狀態
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' })
  
  // 批次大小
  const [batchSize, setBatchSize] = useState(50)
  
  // 篩選：只處理沒有年份的歌曲
  const [targetTabs, setTargetTabs] = useState([])
  
  // 處理結果
  const [results, setResults] = useState([])
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    loadData()
  }, [])
  
  const loadData = async () => {
    setIsLoading(true)
    try {
      const tabsData = await getAllTabs()
      // 只保留有歌名但沒有年份的歌曲
      const validTabs = tabsData.filter(tab => 
        tab.title && tab.title.trim() && 
        !tab.songYear && // 沒有年份
        tab.artist // 有歌手名
      )
      setTabs(tabsData)
      setTargetTabs(validTabs)
      addLog(`載入 ${tabsData.length} 首歌曲，其中 ${validTabs.length} 首需要補充年份`, 'info')
    } catch (error) {
      console.error('Error loading tabs:', error)
      addLog(`載入失敗: ${error.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev.slice(-99), { message, type, time: new Date().toLocaleTimeString() }])
  }

  // ===== 第一步：用 MusicBrainz 獲取年份 =====
  const fetchMusicBrainzYear = async (artist, title) => {
    try {
      const query = encodeURIComponent(`artist:"${artist}" AND recording:"${title}"`)
      const response = await fetch(
        `https://musicbrainz.org/ws/2/recording?query=${query}&fmt=json&limit=5`,
        { 
          headers: { 
            'User-Agent': 'PolygonGuitar/1.0 (kermit.tam@gmail.com)'
          } 
        }
      )
      
      if (!response.ok) return null
      
      const data = await response.json()
      if (!data.recordings || data.recordings.length === 0) return null
      
      // 找到最早年份
      let earliestYear = null
      let earliestRelease = null
      
      for (const recording of data.recordings.slice(0, 3)) {
        if (recording.releases && recording.releases.length > 0) {
          for (const release of recording.releases) {
            if (release.date) {
              const year = parseInt(release.date.split('-')[0])
              if (year && (!earliestYear || year < earliestYear)) {
                earliestYear = year
                earliestRelease = {
                  title: release.title,
                  date: release.date,
                  id: release.id
                }
              }
            }
          }
        }
      }
      
      return earliestYear ? { year: earliestYear, release: earliestRelease } : null
    } catch (error) {
      console.error('MusicBrainz error:', error)
      return null
    }
  }

  // ===== 第二步：用 Spotify 獲取專輯/封面 =====
  const fetchSpotifyData = async (artist, title) => {
    try {
      const searchRes = await fetch('/api/spotify/search-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title })
      })
      
      if (!searchRes.ok) return null
      
      const data = await searchRes.json()
      if (!data.results || data.results.length === 0) return null
      
      // 返回第一個結果（已按年份排序，最早的在前）
      return data.results[0]
    } catch (error) {
      console.error('Spotify error:', error)
      return null
    }
  }

  // ===== 執行兩步驟批量更新 =====
  const runBatchUpdate = async () => {
    const toProcess = targetTabs.slice(0, batchSize)
    
    if (toProcess.length === 0) {
      alert('沒有需要處理的歌曲')
      return
    }
    
    if (!confirm(`確定要處理 ${toProcess.length} 首歌曲嗎？\n\n流程：\n1. 用 MusicBrainz 查年份\n2. 用 Spotify 查專輯/封面\n3. 選最早年份寫入\n\n預計需時 ${Math.ceil(toProcess.length * 3)} 秒`)) return
    
    setIsProcessing(true)
    setProgress({ current: 0, total: toProcess.length, phase: '開始處理' })
    setResults([])
    setShowResults(true)
    
    const processed = []
    
    for (let i = 0; i < toProcess.length; i++) {
      const tab = toProcess[i]
      setProgress({ current: i + 1, total: toProcess.length, phase: `處理: ${tab.title}` })
      
      const result = {
        tabId: tab.id,
        title: tab.title,
        artist: tab.artist,
        mbYear: null,
        spotifyYear: null,
        finalYear: null,
        album: null,
        albumImage: null,
        spotifyId: null,
        updated: false,
        error: null
      }
      
      try {
        // 第一步：MusicBrainz（800ms 延遲）
        addLog(`🔍 [${i+1}/${toProcess.length}] ${tab.artist} - ${tab.title} | 查詢 MusicBrainz...`, 'info')
        const mbData = await fetchMusicBrainzYear(tab.artist, tab.title)
        
        if (mbData) {
          result.mbYear = mbData.year
          addLog(`  ✅ MusicBrainz: ${mbData.year}`, 'success')
        } else {
          addLog(`  ⚠️ MusicBrainz: 未找到`, 'warning')
        }
        
        await new Promise(r => setTimeout(r, 800))
        
        // 第二步：Spotify（1500ms 延遲）
        addLog(`  🎧 查詢 Spotify...`, 'info')
        const spotifyData = await fetchSpotifyData(tab.artist, tab.title)
        
        if (spotifyData) {
          result.spotifyYear = parseInt(spotifyData.releaseYear)
          result.album = spotifyData.album
          result.albumImage = spotifyData.albumImage
          result.spotifyId = spotifyData.id
          addLog(`  ✅ Spotify: ${spotifyData.releaseYear} (${spotifyData.album})`, 'success')
        } else {
          addLog(`  ⚠️ Spotify: 未找到`, 'warning')
        }
        
        // 決定最終年份：選最早的
        if (result.mbYear && result.spotifyYear) {
          result.finalYear = Math.min(result.mbYear, result.spotifyYear)
          result.yearSource = result.mbYear < result.spotifyYear ? 'musicbrainz' : 'spotify'
        } else if (result.mbYear) {
          result.finalYear = result.mbYear
          result.yearSource = 'musicbrainz'
        } else if (result.spotifyYear) {
          result.finalYear = result.spotifyYear
          result.yearSource = 'spotify'
        }
        
        // 寫入資料庫（如果有年份）
        if (result.finalYear) {
          const updateData = {
            songYear: result.finalYear,
            yearSource: result.yearSource,
            ...(result.mbYear && { musicbrainzYear: result.mbYear }),
            ...(result.spotifyYear && { spotifyYear: result.spotifyYear }),
            ...(result.album && { album: result.album }),
            ...(result.albumImage && { albumImage: result.albumImage }),
            ...(result.spotifyId && { spotifyTrackId: result.spotifyId }),
            updatedAt: new Date().toISOString()
          }
          
          await updateDoc(doc(db, 'tabs', tab.id), updateData)
          result.updated = true
          addLog(`  💾 已更新: ${result.finalYear} (${result.yearSource})`, 'success')
        } else {
          addLog(`  ❌ 未找到任何年份`, 'warning')
        }
        
      } catch (error) {
        result.error = error.message
        addLog(`  ❌ 錯誤: ${error.message}`, 'error')
      }
      
      processed.push(result)
      setResults([...processed])
      
      // 延遲避免 rate limit
      await new Promise(r => setTimeout(r, 1500))
    }
    
    setIsProcessing(false)
    
    const successCount = processed.filter(r => r.updated).length
    const withMb = processed.filter(r => r.mbYear).length
    const withSpotify = processed.filter(r => r.spotifyYear).length
    
    addLog(`========== 完成 ==========`, 'success')
    addLog(`總計: ${processed.length} | 成功: ${successCount} | MusicBrainz: ${withMb} | Spotify: ${withSpotify}`, 'success')
    
    alert(`處理完成！\n✅ 成功更新: ${successCount} 首\n🧠 MusicBrainz: ${withMb} 首\n🎧 Spotify: ${withSpotify} 首`)
    
    // 刷新數據
    loadData()
  }

  const stats = {
    total: tabs.length,
    noYear: targetTabs.length,
    hasMbYear: tabs.filter(t => t.musicbrainzYear).length,
    hasSpotifyYear: tabs.filter(t => t.spotifyYear).length,
    hasAlbumImage: tabs.filter(t => t.albumImage).length
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-gray-800 -mx-4 px-4 py-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>📅</span> 批量補充年份（兩步驟）
              </h1>
              <p className="text-sm text-[#B3B3B3]">
                🧠 MusicBrainz 查年份 → 🎧 Spotify 查專輯 → 選最早年份
              </p>
            </div>
            <button onClick={() => router.push('/admin')} className="text-[#B3B3B3] hover:text-white transition">
              返回後台
            </button>
          </div>
        </div>

        {/* 統計卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-sm text-gray-400">總歌曲數</div>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-red-900/50">
            <div className="text-2xl font-bold text-red-400">{stats.noYear}</div>
            <div className="text-sm text-gray-400">❌ 無年份</div>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <div className="text-2xl font-bold text-purple-400">{stats.hasMbYear}</div>
            <div className="text-sm text-gray-400">🧠 MB 年份</div>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <div className="text-2xl font-bold text-green-400">{stats.hasSpotifyYear}</div>
            <div className="text-sm text-gray-400">🎧 Spotify 年份</div>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <div className="text-2xl font-bold text-blue-400">{stats.hasAlbumImage}</div>
            <div className="text-sm text-gray-400">🖼️ 有專輯圖</div>
          </div>
        </div>

        {/* 操作流程說明 */}
        <div className="mb-6 p-4 bg-[#1a1a2e] rounded-xl border border-purple-900/50">
          <h3 className="text-purple-300 font-medium mb-3 flex items-center gap-2">
            <span>🔄</span> 處理流程
          </h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="bg-black/50 p-3 rounded-lg">
              <div className="text-purple-400 font-bold mb-1">步驟 1: MusicBrainz</div>
              <div className="text-gray-400">查詢歌曲最早發行年份</div>
              <div className="text-gray-500 text-xs mt-1">Rate limit: 每秒 1 個請求</div>
            </div>
            <div className="bg-black/50 p-3 rounded-lg">
              <div className="text-green-400 font-bold mb-1">步驟 2: Spotify</div>
              <div className="text-gray-400">查詢專輯封面和 Spotify 年份</div>
              <div className="text-gray-500 text-xs mt-1">Rate limit: 每秒 1-2 個請求</div>
            </div>
            <div className="bg-black/50 p-3 rounded-lg">
              <div className="text-yellow-400 font-bold mb-1">步驟 3: 對比 & 寫入</div>
              <div className="text-gray-400">選兩者中最早的年份寫入</div>
              <div className="text-gray-500 text-xs mt-1">更新 Firestore 資料庫</div>
            </div>
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
                <option value={10}>每次 10 首（測試）</option>
                <option value={50}>每次 50 首（推薦）</option>
                <option value={100}>每次 100 首</option>
                <option value={200}>每次 200 首</option>
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
              💡 建議：先用 10 首測試，確認正常後再用 50 首批量處理
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
                <button
                  onClick={() => setShowResults(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition"
                >
                  返回
                </button>
              </div>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-black sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-3 text-gray-400 font-medium">歌曲</th>
                    <th className="text-center p-3 text-gray-400 font-medium">MB 年份</th>
                    <th className="text-center p-3 text-gray-400 font-medium">Spotify</th>
                    <th className="text-center p-3 text-gray-400 font-medium">最終年份</th>
                    <th className="text-left p-3 text-gray-400 font-medium">來源</th>
                    <th className="text-center p-3 text-gray-400 font-medium">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {results.map((item) => (
                    <tr key={item.tabId} className="hover:bg-gray-900/50">
                      <td className="p-3">
                        <div className="text-white font-medium">{item.title}</div>
                        <div className="text-gray-500 text-xs">{item.artist}</div>
                      </td>
                      <td className="p-3 text-center">
                        {item.mbYear ? (
                          <span className="text-purple-400">{item.mbYear}</span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {item.spotifyYear ? (
                          <span className="text-green-400">{item.spotifyYear}</span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {item.finalYear ? (
                          <span className="text-[#FFD700] font-bold text-lg">{item.finalYear}</span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {item.yearSource && (
                          <span className={`text-xs px-2 py-1 rounded ${
                            item.yearSource === 'musicbrainz' 
                              ? 'bg-purple-900/50 text-purple-400' 
                              : 'bg-green-900/50 text-green-400'
                          }`}>
                            {item.yearSource === 'musicbrainz' ? '🧠 MB' : '🎧 Spotify'}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {item.updated ? (
                          <span className="text-green-400">✅ 已更新</span>
                        ) : item.error ? (
                          <span className="text-red-400">❌ 失敗</span>
                        ) : (
                          <span className="text-gray-500">⏭️ 跳過</span>
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

export default function BulkUpdateYearGuard() {
  return (
    <AdminGuard>
      <BulkUpdateYearPage />
    </AdminGuard>
  )
}

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { getAllTabs } from '@/lib/tabs'
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

function UpdateTrackInfoPage() {
  const router = useRouter()
  const [tabs, setTabs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [logs, setLogs] = useState([])
  
  // 批量更新狀態
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  
  // 篩選條件
  const [filter, setFilter] = useState('all') // 'all' | 'no-spotify' | 'no-bpm' | 'no-credits'
  
  // 選中的歌曲
  const [selectedTabs, setSelectedTabs] = useState(new Set())
  
  // 預覽結果
  const [previewResults, setPreviewResults] = useState([])
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const tabsData = await getAllTabs()
      // 過濾掉沒有標題的
      const validTabs = tabsData.filter(tab => tab.title && tab.title.trim())
      setTabs(validTabs)
      addLog(`載入 ${validTabs.length} 首歌曲`, 'info')
    } catch (error) {
      console.error('Error loading tabs:', error)
      addLog(`載入失敗: ${error.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }])
  }

  // 搜尋 Spotify 並獲取詳細資訊
  const searchSpotify = async (artist, title) => {
    try {
      // 1. 搜尋歌曲
      const searchRes = await fetch('/api/spotify/search-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title })
      })
      
      if (!searchRes.ok) {
        const error = await searchRes.json()
        throw new Error(error.error || '搜尋失敗')
      }
      
      const searchData = await searchRes.json()
      
      if (!searchData.results || searchData.results.length === 0) {
        return { found: false, error: '未找到歌曲' }
      }
      
      const bestMatch = searchData.results[0]
      
      // 2. 獲取詳細資訊（BPM、調性等）
      const detailsRes = await fetch('/api/spotify/track-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: bestMatch.id })
      })
      
      let details = null
      if (detailsRes.ok) {
        const detailsData = await detailsRes.json()
        details = detailsData.result
      }
      
      return {
        found: true,
        track: bestMatch,
        details
      }
    } catch (error) {
      return { found: false, error: error.message }
    }
  }

  // 批量搜尋預覽
  const runBatchSearchPreview = async () => {
    const targetTabs = getFilteredTabs().slice(0, 50) // 限制每次預覽 50 首
    
    if (targetTabs.length === 0) {
      alert('沒有符合條件的歌曲')
      return
    }
    
    setIsProcessing(true)
    setProgress({ current: 0, total: targetTabs.length })
    setPreviewResults([])
    
    const results = []
    
    for (let i = 0; i < targetTabs.length; i++) {
      const tab = targetTabs[i]
      setProgress({ current: i + 1, total: targetTabs.length })
      
      const result = await searchSpotify(tab.artist, tab.title)
      
      results.push({
        tabId: tab.id,
        tabTitle: tab.title,
        tabArtist: tab.artist,
        ...result,
        selected: result.found
      })
      
      // 更新預覽（即時顯示）
      setPreviewResults([...results])
      
      // 延遲避免 rate limit
      await new Promise(r => setTimeout(r, 200))
    }
    
    setIsProcessing(false)
    setShowPreview(true)
    
    const foundCount = results.filter(r => r.found).length
    addLog(`預覽完成：找到 ${foundCount}/${targetTabs.length} 首`, 'success')
  }

  // 獲取過濾後的歌曲列表
  const getFilteredTabs = () => {
    switch (filter) {
      case 'no-spotify':
        return tabs.filter(tab => !tab.spotifyTrackId)
      case 'no-bpm':
        return tabs.filter(tab => !tab.bpm)
      case 'no-credits':
        return tabs.filter(tab => !tab.composer && !tab.lyricist)
      case 'all':
      default:
        return tabs
    }
  }

  // 執行批量更新
  const executeBatchUpdate = async () => {
    const toUpdate = previewResults.filter(r => r.selected && r.found)
    
    if (toUpdate.length === 0) {
      alert('請至少選擇一項進行更新')
      return
    }
    
    if (!confirm(`確定要更新 ${toUpdate.length} 首歌曲的資訊嗎？`)) return
    
    setIsProcessing(true)
    setProgress({ current: 0, total: toUpdate.length })
    
    let success = 0, failed = 0
    
    for (let i = 0; i < toUpdate.length; i++) {
      const item = toUpdate[i]
      setProgress({ current: i + 1, total: toUpdate.length })
      
      try {
        const track = item.track
        const details = item.details
        
        const updateData = {
          // Spotify 基本資訊
          spotifyTrackId: track.id,
          spotifyAlbumId: track.albumId,
          spotifyArtistId: track.artistId,
          spotifyUrl: track.spotifyUrl,
          albumImage: track.albumImage,
          
          // 歌曲資訊
          songYear: track.releaseYear,
          album: track.album,
          duration: track.duration,
          
          // BPM 和音樂特徵
          bpm: details?.bpm || null,
          spotifyKey: details?.key,
          timeSignature: details?.timeSignature,
          
          // Credits（作曲、填詞等）
          composer: details?.composers || null,
          lyricist: details?.lyricists || null,
          producer: details?.producers || null,
          
          updatedAt: new Date().toISOString()
        }
        
        // 移除 null 值
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === null) delete updateData[key]
        })
        
        await updateDoc(doc(db, 'tabs', item.tabId), updateData)
        
        success++
        addLog(`✅ 已更新：${item.tabArtist} - ${item.tabTitle} ${details?.bpm ? `(BPM: ${details.bpm})` : ''}`, 'success')
      } catch (error) {
        failed++
        addLog(`❌ 失敗：${item.tabTitle} - ${error.message}`, 'error')
      }
    }
    
    setIsProcessing(false)
    addLog(`\n========== 批量更新完成 ==========`, 'success')
    addLog(`✅ 成功：${success} 首，❌ 失敗：${failed} 首`, success > failed ? 'success' : 'warning')
    
    // 從預覽中移除已更新的項目
    const updatedIds = new Set(toUpdate.map(item => item.tabId))
    setPreviewResults(prev => prev.filter(r => !updatedIds.has(r.tabId)))
    
    // 顯示成功提示
    setTimeout(() => {
      if (success > 0) {
        alert(`✅ 更新完成！\n\n成功：${success} 首\n失敗：${failed} 首\n\n已成功更新的歌曲已從列表中移除。`)
      } else {
        alert(`❌ 更新失敗\n\n沒有歌曲被更新，請檢查日誌了解詳情。`)
      }
    }, 100)
    
    // 如果全部更新完成，關閉預覽
    if (success === toUpdate.length && success > 0) {
      setTimeout(() => {
        setShowPreview(false)
        setPreviewResults([])
      }, 500)
    }
    
    // 刷新數據
    loadData()
  }

  // 切換選擇
  const toggleSelection = (index) => {
    setPreviewResults(prev => prev.map((item, i) => 
      i === index ? { ...item, selected: !item.selected } : item
    ))
  }

  // 全選/全不選
  const selectAll = () => {
    setPreviewResults(prev => prev.map(item => ({ ...item, selected: item.found })))
  }
  const deselectAll = () => {
    setPreviewResults(prev => prev.map(item => ({ ...item, selected: false })))
  }

  const filteredTabs = getFilteredTabs()

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-gray-800 -mx-4 px-4 py-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>🎵</span> 批量更新歌曲資訊
              </h1>
              <p className="text-sm text-[#B3B3B3]">從 Spotify 獲取 BPM、作曲、填詞等資訊</p>
            </div>
            <button onClick={() => router.push('/admin')} className="text-[#B3B3B3] hover:text-white transition">
              返回後台
            </button>
          </div>
        </div>

        {/* 統計卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <div className="text-2xl font-bold text-white">{tabs.length}</div>
            <div className="text-sm text-gray-400">總歌曲數</div>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <div className="text-2xl font-bold text-[#1DB954]">{tabs.filter(t => t.spotifyTrackId).length}</div>
            <div className="text-sm text-gray-400">有 Spotify</div>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <div className="text-2xl font-bold text-[#FFD700]">{tabs.filter(t => t.bpm).length}</div>
            <div className="text-sm text-gray-400">有 BPM</div>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <div className="text-2xl font-bold text-blue-400">{tabs.filter(t => t.composer || t.lyricist).length}</div>
            <div className="text-sm text-gray-400">有作曲/填詞</div>
          </div>
        </div>

        {/* 操作區 */}
        {!showPreview && (
          <div className="mb-6 p-4 bg-[#1a1a2e] rounded-xl border border-blue-900/50">
            <h3 className="text-blue-300 font-medium mb-4">⚡ 批量搜尋 Spotify</h3>
            
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-4 py-2 bg-black border border-gray-700 rounded-lg text-white"
              >
                <option value="all">全部歌曲 ({tabs.length})</option>
                <option value="no-spotify">無 Spotify ({tabs.filter(t => !t.spotifyTrackId).length})</option>
                <option value="no-bpm">無 BPM ({tabs.filter(t => !t.bpm).length})</option>
                <option value="no-credits">無作曲/填詞 ({tabs.filter(t => !t.composer && !t.lyricist).length})</option>
              </select>
              
              <button
                onClick={runBatchSearchPreview}
                disabled={isProcessing || filteredTabs.length === 0}
                className="px-6 py-2 bg-[#1DB954] text-white rounded-lg font-medium hover:bg-[#1ed760] transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    搜尋中... {progress.current}/{progress.total}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2z"/>
                    </svg>
                    搜尋 Spotify (最多50首)
                  </>
                )}
              </button>
            </div>
            
            <p className="text-sm text-gray-500">
              💡 會使用現有的歌手名和歌名搜尋 Spotify，獲取 BPM、專輯封面、作曲填詞等資訊
            </p>
          </div>
        )}

        {/* 預覽表格 */}
        {showPreview && (
          <div className="mb-6 bg-[#121212] rounded-xl border border-[#1DB954] overflow-hidden">
            <div className="p-4 border-b border-gray-800 bg-[#1DB954]/5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-[#1DB954] font-medium mb-1">搜尋結果預覽</h3>
                  <p className="text-sm text-gray-400">
                    找到 {previewResults.filter(r => r.found).length} / {previewResults.length} 首
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={selectAll} className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition">
                    全選找到的
                  </button>
                  <button onClick={deselectAll} className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition">
                    全不選
                  </button>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="px-4 py-1.5 text-gray-400 hover:text-white transition"
                  >
                    返回
                  </button>
                  <button
                    onClick={executeBatchUpdate}
                    disabled={isProcessing || previewResults.filter(r => r.selected).length === 0}
                    className="px-6 py-1.5 bg-[#1DB954] text-white rounded-lg font-medium hover:bg-[#1ed760] transition disabled:opacity-50"
                  >
                    {isProcessing ? `更新中... ${progress.current}/${progress.total}` : `確認更新 (${previewResults.filter(r => r.selected).length})`}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-black sticky top-0 z-10">
                  <tr>
                    <th className="text-center p-3 text-gray-400 font-medium w-12">選</th>
                    <th className="text-left p-3 text-gray-400 font-medium">現有資訊</th>
                    <th className="text-left p-3 text-gray-400 font-medium">Spotify 搜尋結果</th>
                    <th className="text-center p-3 text-gray-400 font-medium w-24">BPM</th>
                    <th className="text-left p-3 text-gray-400 font-medium">Credits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {previewResults.map((item, index) => (
                    <tr key={item.tabId} className={`${item.selected ? 'bg-green-900/10' : 'bg-gray-900/30'}`}>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => toggleSelection(index)}
                          disabled={!item.found}
                          className="w-4 h-4 accent-[#1DB954] cursor-pointer"
                        />
                      </td>
                      <td className="p-3">
                        <div className="text-white font-medium">{item.tabTitle}</div>
                        <div className="text-gray-500 text-xs">{item.tabArtist}</div>
                      </td>
                      <td className="p-3">
                        {item.found ? (
                          <div className="flex items-center gap-3">
                            {item.track.albumImage && (
                              <img src={item.track.albumImage} alt="" className="w-10 h-10 rounded object-cover" />
                            )}
                            <div>
                              <div className="text-[#1DB954] font-medium">{item.track.name}</div>
                              <div className="text-gray-400 text-xs">{item.track.artist}</div>
                              <div className="text-gray-600 text-xs">{item.track.album} · {item.track.releaseYear}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-red-400 text-xs">❌ {item.error || '未找到'}</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {item.details?.bpm ? (
                          <span className="text-[#FFD700] font-bold">{item.details.bpm}</span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {item.details ? (
                          <div className="text-xs space-y-1">
                            {item.details.composers && (
                              <div className="text-gray-400">曲: <span className="text-gray-300">{item.details.composers.substring(0, 30)}</span></div>
                            )}
                            {item.details.lyricists && (
                              <div className="text-gray-400">詞: <span className="text-gray-300">{item.details.lyricists.substring(0, 30)}</span></div>
                            )}
                            {item.details.producers && (
                              <div className="text-gray-400">監: <span className="text-gray-300">{item.details.producers.substring(0, 30)}</span></div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-600 text-xs">-</span>
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
            <div className="p-3 max-h-64 overflow-y-auto font-mono text-sm space-y-1">
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

        {/* 說明 */}
        <div className="mt-6 bg-[#1a1a2e] rounded-xl p-4 border border-blue-900/50">
          <h3 className="text-blue-300 font-medium mb-2">💡 使用說明</h3>
          <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
            <li>選擇要更新的歌曲類型（全部、無 Spotify、無 BPM 等）</li>
            <li>點擊「搜尋 Spotify」批量搜尋歌曲資訊（每次最多 50 首）</li>
            <li>預覽結果中可以看到 Spotify 匹配的資訊、BPM、作曲填詞等</li>
            <li>勾選要更新的項目，點「確認更新」寫入資料庫</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

export default function UpdateTrackInfoGuard() {
  return (
    <AdminGuard>
      <UpdateTrackInfoPage />
    </AdminGuard>
  )
}

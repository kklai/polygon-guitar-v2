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
  
  // 數據源選擇
  const [dataSource, setDataSource] = useState('musicbrainz') // 'spotify' | 'musicbrainz'
  
  // 批量更新狀態
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  
  // 篩選條件
  const [filter, setFilter] = useState('no-credits') // 默認搜尋無作曲填詞的
  
  // 批次大小
  const [batchSize, setBatchSize] = useState(50)
  
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
    setLogs(prev => [...prev.slice(-49), { message, type, time: new Date().toLocaleTimeString() }])
  }

  // ===== MusicBrainz 搜尋 =====
  const searchMusicBrainz = async (artist, title) => {
    try {
      const res = await fetch('/api/musicbrainz/track-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title })
      })
      
      const data = await res.json()
      
      if (!res.ok || !data.result) {
        return { found: false, error: data.error || '未找到' }
      }
      
      const firstRelease = data.result.releases?.[0]
      return {
        found: true,
        track: {
          id: data.result.id,
          name: data.result.title,
          artist: data.result.artist,
          album: firstRelease?.title || null,
          albumImage: null, // MusicBrainz 沒有專輯封面
          releaseYear: firstRelease?.date ? firstRelease.date.split('-')[0] : null,
          spotifyUrl: null
        },
        details: {
          bpm: data.result.audioFeatures?.bpm,
          key: data.result.audioFeatures?.key,
          composers: data.result.credits?.composers?.join(', ') || null,
          lyricists: data.result.credits?.lyricists?.join(', ') || null,
          arrangers: data.result.credits?.arrangers?.join(', ') || null
        }
      }
    } catch (error) {
      return { found: false, error: error.message }
    }
  }

  // ===== Spotify 搜尋 =====
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
      
      return {
        found: true,
        track: bestMatch,
        details: {
          bpm: null, // Spotify API 已棄用
          key: null,
          composers: null,
          lyricists: null
        }
      }
    } catch (error) {
      return { found: false, error: error.message }
    }
  }

  // ===== 批量搜尋預覽 =====
  const runBatchSearchPreview = async () => {
    const targetTabs = getFilteredTabs().slice(0, batchSize)
    
    if (targetTabs.length === 0) {
      alert('沒有符合條件的歌曲')
      return
    }
    
    setIsProcessing(true)
    setProgress({ current: 0, total: targetTabs.length })
    setPreviewResults([])
    
    const results = []
    const failedTabs = [] // 記錄失敗嘅歌曲
    const searchFn = dataSource === 'spotify' ? searchSpotify : searchMusicBrainz
    
    for (let i = 0; i < targetTabs.length; i++) {
      const tab = targetTabs[i]
      setProgress({ current: i + 1, total: targetTabs.length })
      
      try {
        const result = await searchFn(tab.artist, tab.title)
        
        if (!result.found) {
          // 搜尋失敗，放到失敗列表
          failedTabs.push({
            tabId: tab.id,
            tabTitle: tab.title,
            tabArtist: tab.artist,
            ...result,
            selected: false
          })
          addLog(`❌ ${tab.artist} - ${tab.title}: 未找到`, 'warning')
        } else {
          // 搜尋成功
          results.push({
            tabId: tab.id,
            tabTitle: tab.title,
            tabArtist: tab.artist,
            ...result,
            selected: result.found && (result.details?.composers || result.details?.lyricists || result.details?.bpm)
          })
        }
      } catch (error) {
        // 單個請求失敗，放到失敗列表
        failedTabs.push({
          tabId: tab.id,
          tabTitle: tab.title,
          tabArtist: tab.artist,
          found: false,
          error: error.message || '請求失敗',
          selected: false
        })
        addLog(`⚠️ ${tab.artist} - ${tab.title}: ${error.message}`, 'warning')
      }
      
      // 顯示進度：成功 + 失敗
      setPreviewResults([...results, ...failedTabs])
      
      // MusicBrainz 限制較寬，可以快啲；Spotify 要慢啲
      // 每 10 首後多等一陣，避免 rate limit
      const baseDelay = dataSource === 'spotify' ? 1500 : 800
      const extraDelay = (i > 0 && i % 10 === 0) ? 2000 : 0
      await new Promise(r => setTimeout(r, baseDelay + extraDelay))
    }
    
    // 將失敗嘅歌曲排到最后
    const finalResults = [...results, ...failedTabs]
    setPreviewResults(finalResults)
    
    setIsProcessing(false)
    setShowPreview(true)
    
    const foundCount = results.filter(r => r.found).length
    const withCredits = results.filter(r => r.found && (r.details?.composers || r.details?.lyricists)).length
    const failedCount = failedTabs.length
    
    if (failedCount > 0) {
      addLog(`預覽完成：找到 ${foundCount}/${targetTabs.length} 首，${withCredits} 首有作曲/填詞，${failedCount} 首失敗已排至最後`, 'warning')
    } else {
      addLog(`預覽完成：找到 ${foundCount}/${targetTabs.length} 首，${withCredits} 首有作曲/填詞`, 'success')
    }
  }

  // 獲取過濾後的歌曲列表
  const getFilteredTabs = () => {
    switch (filter) {
      case 'no-credits':
        return tabs.filter(tab => !tab.composer && !tab.lyricist)
      case 'no-year':
        return tabs.filter(tab => !tab.songYear && !tab.uploadYear)
      case 'no-spotify':
        return tabs.filter(tab => !tab.spotifyTrackId)
      case 'all':
      default:
        return tabs
    }
  }

  // ===== 執行批量更新 =====
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
          // 基本資訊
          songYear: track.releaseYear || details?.releaseYear,
          album: track.album,
          
          // Spotify 專有
          ...(dataSource === 'spotify' && {
            spotifyTrackId: track.id,
            spotifyAlbumId: track.albumId,
            spotifyArtistId: track.artistId,
            spotifyUrl: track.spotifyUrl,
            albumImage: track.albumImage,
            duration: track.duration,
          }),
          
          // MusicBrainz 專有（作曲填詞 BPM）
          ...(dataSource === 'musicbrainz' && {
            musicbrainzId: track.id,
            bpm: details?.bpm || null,
            songKey: details?.key || null,
            composer: details?.composers || null,
            lyricist: details?.lyricists || null,
            arranger: details?.arrangers || null,
          }),
          
          updatedAt: new Date().toISOString()
        }
        
        // 移除 null 和 undefined 值
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === null || updateData[key] === undefined) delete updateData[key]
        })
        
        await updateDoc(doc(db, 'tabs', item.tabId), updateData)
        
        success++
        addLog(`✅ ${item.tabArtist} - ${item.tabTitle} ${details?.composers ? `(曲:${details.composers})` : ''}`, 'success')
      } catch (error) {
        failed++
        addLog(`❌ ${item.tabTitle} - ${error.message}`, 'error')
      }
    }
    
    setIsProcessing(false)
    addLog(`========== 完成：${success} 成功，${failed} 失敗 ==========`, success > failed ? 'success' : 'warning')
    
    alert(`更新完成！\n✅ 成功：${success} 首\n❌ 失敗：${failed} 首`)
    
    // 刷新數據
    loadData()
    setShowPreview(false)
    setPreviewResults([])
  }

  // 切換選擇
  const toggleSelection = (index) => {
    setPreviewResults(prev => prev.map((item, i) => 
      i === index ? { ...item, selected: !item.selected } : item
    ))
  }

  // 全選/全不選
  const selectAll = () => setPreviewResults(prev => prev.map(item => ({ ...item, selected: item.found })))
  const deselectAll = () => setPreviewResults(prev => prev.map(item => ({ ...item, selected: false })))

  const filteredTabs = getFilteredTabs()
  const hasCreditsCount = tabs.filter(t => t.composer || t.lyricist).length
  const hasYearCount = tabs.filter(t => t.songYear || t.uploadYear).length

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
              <p className="text-sm text-[#B3B3B3]">
                從 MusicBrainz 獲取作曲、填詞、BPM 等資訊
                <span className="text-yellow-500 ml-2">(Spotify API 已棄用，建議用 MusicBrainz)</span>
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
            <div className="text-2xl font-bold text-white">{tabs.length}</div>
            <div className="text-sm text-gray-400">總歌曲數</div>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <div className="text-2xl font-bold text-green-400">{hasCreditsCount}</div>
            <div className="text-sm text-gray-400">有作曲/填詞</div>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <div className="text-2xl font-bold text-yellow-400">{tabs.filter(t => t.bpm).length}</div>
            <div className="text-sm text-gray-400">有 BPM</div>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <div className="text-2xl font-bold text-blue-400">{hasYearCount}</div>
            <div className="text-sm text-gray-400">有年份</div>
          </div>
        </div>

        {/* 操作區 */}
        {!showPreview && (
          <div className="mb-6 p-4 bg-[#1a1a2e] rounded-xl border border-purple-900/50">
            <h3 className="text-purple-300 font-medium mb-4 flex items-center gap-2">
              <span>🧠</span> 批量搜尋 MusicBrainz（推薦）
            </h3>
            
            {/* 數據源選擇 */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setDataSource('musicbrainz')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  dataSource === 'musicbrainz' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                🧠 MusicBrainz（作曲/填詞/BPM）
              </button>
              <button
                onClick={() => setDataSource('spotify')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  dataSource === 'spotify' 
                    ? 'bg-[#1DB954] text-white' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                🎧 Spotify（專輯封面/連結）
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-4 py-2 bg-black border border-gray-700 rounded-lg text-white"
              >
                <option value="no-credits">無作曲/填詞 ({tabs.filter(t => !t.composer && !t.lyricist).length})</option>
                <option value="no-year">無年份 ({tabs.filter(t => !t.songYear && !t.uploadYear).length})</option>
                <option value="no-spotify">無 Spotify ({tabs.filter(t => !t.spotifyTrackId).length})</option>
                <option value="all">全部歌曲 ({tabs.length})</option>
              </select>
              
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="px-4 py-2 bg-black border border-gray-700 rounded-lg text-white"
              >
                <option value={50}>每次 50 首（穩定）</option>
                <option value={100}>每次 100 首</option>
                <option value={200}>每次 200 首（快速）</option>
              </select>
              
              <button
                onClick={runBatchSearchPreview}
                disabled={isProcessing || filteredTabs.length === 0}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
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
                    <span>🔍</span>
                    開始搜尋 (最多{batchSize}首)
                  </>
                )}
              </button>
            </div>
            
            <p className="text-sm text-gray-500">
              {dataSource === 'musicbrainz' ? (
                <>💡 MusicBrainz 提供作曲、填詞、BPM 等資訊。建議先用 50 首測試，穩定後再用 200 首。</>
              ) : (
                <>⚠️ Spotify 已棄用 Audio Features API，只能獲取專輯封面和連結。</>
              )}
            </p>
          </div>
        )}

        {/* 預覽表格 */}
        {showPreview && (
          <div className="mb-6 bg-[#121212] rounded-xl border border-purple-500 overflow-hidden">
            <div className="p-4 border-b border-gray-800 bg-purple-900/20">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-purple-300 font-medium mb-1">搜尋結果預覽</h3>
                  <p className="text-sm text-gray-400">
                    找到 {previewResults.filter(r => r.found).length} / {previewResults.length} 首
                    {previewResults.filter(r => r.found && (r.details?.composers || r.details?.lyricists)).length > 0 && (
                      <span className="text-green-400 ml-2">
                        ({previewResults.filter(r => r.found && (r.details?.composers || r.details?.lyricists)).length} 首有作曲/填詞)
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={selectAll} className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition">
                    全選
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
                    className="px-6 py-1.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500 transition disabled:opacity-50"
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
                    <th className="text-left p-3 text-gray-400 font-medium">搜尋結果</th>
                    <th className="text-center p-3 text-gray-400 font-medium w-20">年份</th>
                    <th className="text-left p-3 text-gray-400 font-medium">作曲/填詞</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {previewResults.map((item, index) => (
                    <tr key={item.tabId} className={`${
                      item.selected ? 'bg-purple-900/10' : 'bg-gray-900/30'
                    }`}>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => toggleSelection(index)}
                          disabled={!item.found}
                          className="w-4 h-4 accent-purple-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3">
                        <div className="text-white font-medium">{item.tabTitle}</div>
                        <div className="text-gray-500 text-xs">{item.tabArtist}</div>
                      </td>
                      <td className="p-3">
                        {item.found && item.track ? (
                          <div>
                            <div className="text-green-400 font-medium">{item.track.name}</div>
                            <div className="text-gray-400 text-xs">{item.track.artist}</div>
                            {item.track.album && (
                              <div className="text-gray-600 text-xs">{item.track.album}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-red-400 text-xs">❌ {item.error || '未找到'}</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {item.track?.releaseYear ? (
                          <span className="text-[#FFD700] font-bold">{item.track.releaseYear}</span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {item.details ? (
                          <div className="text-xs space-y-1">
                            {item.details.composers && (
                              <div className="text-gray-400">曲: <span className="text-green-300">{item.details.composers}</span></div>
                            )}
                            {item.details.lyricists && (
                              <div className="text-gray-400">詞: <span className="text-green-300">{item.details.lyricists}</span></div>
                            )}
                            {item.details.bpm && (
                              <div className="text-gray-400">BPM: <span className="text-yellow-300">{item.details.bpm}</span></div>
                            )}
                            {!item.details.composers && !item.details.lyricists && !item.details.bpm && (
                              <span className="text-gray-600">無額外資訊</span>
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
        <div className="mt-6 bg-[#1a1a2e] rounded-xl p-4 border border-purple-900/50">
          <h3 className="text-purple-300 font-medium mb-2">💡 使用說明</h3>
          <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
            <li>建議使用 <b>MusicBrainz</b> 獲取作曲、填詞、BPM 等資訊</li>
            <li>Spotify 只提供專輯封面和連結（Audio Features API 已棄用）</li>
            <li>選擇「無作曲/填詞」可快速找到需要更新的歌曲</li>
            <li>每次處理 50-200 首，建議先用 50 首測試</li>
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

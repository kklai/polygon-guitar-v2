import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { getAllArtists } from '@/lib/tabs'
import { getAllTabs } from '@/lib/tabs'

function SpotifyManager() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('artists') // 'artists' | 'songs' | 'bulk'
  const [artists, setArtists] = useState([])
  const [tabs, setTabs] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 })
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [forceUpdate, setForceUpdate] = useState(false)
  const [showAllArtists, setShowAllArtists] = useState(false)
  const [logs, setLogs] = useState([])

  // 載入數據
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [artistsData, tabsData] = await Promise.all([
        getAllArtists(),
        getAllTabs()
      ])
      setArtists(artistsData)
      setTabs(tabsData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }])
  }

  // 搜尋 Spotify
  const searchSpotify = async (query, type = 'artist') => {
    try {
      const response = await fetch('/api/spotify/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, type })
      })
      
      if (!response.ok) {
        throw new Error('Search failed')
      }
      
      return await response.json()
    } catch (error) {
      console.error('Search error:', error)
      return null
    }
  }

  // 批量更新歌手
  const bulkUpdateArtists = async () => {
    // 如果強制更新，處理所有歌手；否則只處理冇相片的
    const artistsToUpdate = forceUpdate 
      ? artists 
      : artists.filter(a => !a.photoURL && !a.wikiPhotoURL)
    
    if (artistsToUpdate.length === 0) {
      addLog('沒有需要更新的歌手', 'success')
      return
    }

    setIsBulkUpdating(true)
    setBulkProgress({ current: 0, total: artistsToUpdate.length, success: 0, failed: 0 })
    addLog(`${forceUpdate ? '【強制更新模式】' : ''}開始批量更新 ${artistsToUpdate.length} 個歌手...`, 'info')

    for (let i = 0; i < artistsToUpdate.length; i++) {
      const artist = artistsToUpdate[i]
      setBulkProgress(prev => ({ ...prev, current: i + 1 }))
      
      try {
        const result = await searchSpotify(artist.name, 'artist')
        
        if (result && result.images && result.images.length > 0) {
          // 更新歌手資料
          const { updateDoc, doc, getFirestore } = await import('firebase/firestore')
          const { db } = await import('@/lib/firebase')
          
          await updateDoc(doc(db, 'artists', artist.id), {
            wikiPhotoURL: result.images[0].url,
            spotifyId: result.id,
            spotifyFollowers: result.followers || 0,
            spotifyPopularity: result.popularity || 0,
            spotifyGenres: result.genres || [],
            updatedAt: new Date().toISOString()
          })
          
          const followerText = result.followers ? ` (${result.followers.toLocaleString()} 粉絲)` : ''
          addLog(`✅ ${artist.name}: 已更新相片${followerText}`, 'success')
          setBulkProgress(prev => ({ ...prev, success: prev.success + 1 }))
        } else {
          addLog(`⚠️ ${artist.name}: 找不到 Spotify 資料`, 'warning')
          setBulkProgress(prev => ({ ...prev, failed: prev.failed + 1 }))
        }
        
        // 避免 API 限制（開發模式限額很低，需要較長間隔）
        await new Promise(r => setTimeout(r, 2000))
        
      } catch (error) {
        addLog(`❌ ${artist.name}: ${error.message}`, 'error')
        setBulkProgress(prev => ({ ...prev, failed: prev.failed + 1 }))
      }
    }
    
    setIsBulkUpdating(false)
    addLog('批量更新完成！', 'success')
    loadData() // 重新載入數據
  }

  // 搜尋並更新歌曲
  const searchAndUpdateSong = async () => {
    if (!searchQuery.trim()) return
    
    setIsLoading(true)
    addLog(`搜尋: ${searchQuery}...`, 'info')
    
    try {
      const result = await searchSpotify(searchQuery, 'track')
      setSearchResults(result)
      
      if (result) {
        addLog(`✅ 找到: ${result.name}`, 'success')
      } else {
        addLog('❌ 找不到結果', 'error')
      }
    } catch (error) {
      addLog(`❌ 錯誤: ${error.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // 統計數據
  const stats = {
    totalArtists: artists.length,
    artistsWithoutPhoto: artists.filter(a => !a.photoURL && !a.wikiPhotoURL).length,
    totalTabs: tabs.length,
    tabsWithoutSpotify: tabs.filter(t => !t.spotifyId).length
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 pb-8">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-gray-800 -mx-4 px-4 py-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-[#1DB954]">Spotify</span> 整合管理
              </h1>
              <p className="text-sm text-[#B3B3B3]">管理歌手相片、歌曲資訊、批量更新</p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="text-[#B3B3B3] hover:text-white transition"
            >
              返回後台
            </button>
          </div>
        </div>

        {/* 統計卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-sm">歌手總數</p>
            <p className="text-2xl font-bold text-white">{stats.totalArtists}</p>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-sm">冇相片</p>
            <p className="text-2xl font-bold text-[#FFD700]">{stats.artistsWithoutPhoto}</p>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-sm">譜總數</p>
            <p className="text-2xl font-bold text-white">{stats.totalTabs}</p>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-sm">冇 Spotify</p>
            <p className="text-2xl font-bold text-[#FFD700]">{stats.tabsWithoutSpotify}</p>
          </div>
        </div>

        {/* 分頁標籤 */}
        <div className="flex gap-2 mb-6 border-b border-gray-800">
          {[
            { id: 'artists', label: '👤 歌手管理', icon: '👤' },
            { id: 'songs', label: '🎵 歌曲搜尋', icon: '🎵' },
            { id: 'bulk', label: '⚡ 批量更新', icon: '⚡' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium transition border-b-2 ${
                activeTab === tab.id
                  ? 'text-[#1DB954] border-[#1DB954]'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 歌手管理分頁 */}
        {activeTab === 'artists' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-medium text-white">
                  {forceUpdate ? '所有歌手（強制更新）' : '冇相片嘅歌手'}
                </h2>
                <p className="text-sm text-gray-500">
                  {forceUpdate ? `將更新全部 ${stats.totalArtists} 個歌手` : `只更新 ${stats.artistsWithoutPhoto} 個冇相片的歌手`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceUpdate}
                    onChange={(e) => setForceUpdate(e.target.checked)}
                    disabled={isBulkUpdating}
                    className="w-4 h-4 rounded border-gray-600 text-[#1DB954]"
                  />
                  強制更新所有歌手
                </label>
                <button
                  onClick={bulkUpdateArtists}
                  disabled={isBulkUpdating || (forceUpdate ? artists.length === 0 : stats.artistsWithoutPhoto === 0)}
                  className="px-4 py-2 bg-[#1DB954] text-black rounded-lg font-medium hover:bg-[#1ed760] transition disabled:opacity-50"
                >
                  {isBulkUpdating ? '更新緊...' : `批量更新 ${forceUpdate ? stats.totalArtists : stats.artistsWithoutPhoto} 個`}
                </button>
              </div>
            </div>

            {isBulkUpdating && (
              <div className="bg-[#121212] rounded-xl p-4 border border-gray-800 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white">進度: {bulkProgress.current} / {bulkProgress.total}</span>
                  <span className="text-green-400">✅ {bulkProgress.success}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1DB954] transition-all"
                    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* 顯示切換 */}
            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAllArtists}
                  onChange={(e) => setShowAllArtists(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 text-[#1DB954]"
                />
                顯示全部歌手（{artists.length} 個）
              </label>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {(showAllArtists ? artists : artists.filter(a => !a.photoURL && !a.wikiPhotoURL))
                .map(artist => (
                  <div key={artist.id} className="bg-[#121212] rounded-lg p-3 border border-gray-800">
                    <div className="aspect-square rounded-lg bg-gray-800 mb-2 flex items-center justify-center text-2xl overflow-hidden">
                      {artist.photoURL || artist.wikiPhotoURL ? (
                        <img 
                          src={artist.photoURL || artist.wikiPhotoURL} 
                          alt={artist.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        '🎤'
                      )}
                    </div>
                    <p className="text-white text-sm truncate">{artist.name}</p>
                    <p className="text-gray-500 text-xs">{artist.songCount || 0} 首歌</p>
                    {artist.wikiPhotoURL && (
                      <p className="text-[#1DB954] text-xs">✓ Spotify 相片</p>
                    )}
                    {artist.photoURL && !artist.wikiPhotoURL && (
                      <p className="text-blue-400 text-xs">✓ 已上傳相片</p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 歌曲搜尋分頁 */}
        {activeTab === 'songs' && (
          <div className="space-y-4">
            <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋歌曲或歌手..."
                  className="flex-1 px-4 py-2 bg-[#282828] border-0 rounded-full text-white placeholder-[#666] outline-none"
                  onKeyPress={(e) => e.key === 'Enter' && searchAndUpdateSong()}
                />
                <button
                  onClick={searchAndUpdateSong}
                  disabled={isLoading || !searchQuery.trim()}
                  className="px-6 py-2 bg-[#1DB954] text-black rounded-lg font-medium hover:bg-[#1ed760] transition disabled:opacity-50"
                >
                  {isLoading ? '搜尋緊...' : '搜尋'}
                </button>
              </div>
            </div>

            {searchResults && (
              <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
                <h3 className="text-lg font-medium text-white mb-3">搜尋結果</h3>
                <div className="flex gap-4">
                  {searchResults.images?.[0]?.url && (
                    <img
                      src={searchResults.images[0].url}
                      alt={searchResults.name}
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-white">{searchResults.name}</h4>
                    <p className="text-gray-400">Spotify ID: {searchResults.id}</p>
                    <p className="text-gray-400">圖片: {searchResults.images?.length || 0} 張</p>
                    <button
                      onClick={() => {/* 更新到譜 */}}
                      className="mt-3 px-4 py-2 bg-[#1DB954] text-black rounded-lg text-sm font-medium hover:bg-[#1ed760] transition"
                    >
                      使用呢個資料
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 批量更新分頁 */}
        {activeTab === 'bulk' && (
          <div className="space-y-4">
            <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
              <h3 className="text-lg font-medium text-white mb-3">批量更新選項</h3>
              <div className="space-y-3">
                <button
                  onClick={bulkUpdateArtists}
                  disabled={isBulkUpdating}
                  className="w-full flex items-center justify-between p-4 bg-gray-900 rounded-lg hover:bg-gray-800 transition"
                >
                  <div className="text-left">
                    <p className="text-white font-medium">🖼️ 更新所有歌手相片</p>
                    <p className="text-gray-500 text-sm">為 {stats.artistsWithoutPhoto} 個冇相片嘅歌手搜尋 Spotify 相片</p>
                  </div>
                  <span className="text-[#1DB954] font-bold">
                    {isBulkUpdating ? '進行中...' : '開始'}
                  </span>
                </button>
              </div>
            </div>

            {/* 日誌 */}
            <div className="bg-[#121212] rounded-xl border border-gray-800">
              <div className="p-3 border-b border-gray-800 flex items-center justify-between">
                <h3 className="font-medium text-white">處理日誌</h3>
                <button
                  onClick={() => setLogs([])}
                  className="text-xs text-gray-500 hover:text-white"
                >
                  清除
                </button>
              </div>
              <div className="p-3 max-h-64 overflow-y-auto font-mono text-sm space-y-1">
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
                        'text-gray-300'
                      }`}
                    >
                      <span className="text-gray-600">[{log.time}]</span> {log.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default function SpotifyManagerGuard() {
  return (
    <AdminGuard>
      <SpotifyManager />
    </AdminGuard>
  )
}

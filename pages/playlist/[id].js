import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { getPlaylist, getPlaylistSongs, AUTO_PLAYLIST_TYPES } from '@/lib/playlists'
import Layout from '@/components/Layout'
import Link from 'next/link'
import { recordPlaylistView } from '@/lib/recentViews'
import { useAuth } from '@/contexts/AuthContext'

export default function PlaylistDetail() {
  const router = useRouter()
  const { id } = router.query
  const { user } = useAuth()
  const [playlist, setPlaylist] = useState(null)
  const [songs, setSongs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState('list') // 'list' | 'grid'

  useEffect(() => {
    if (id) {
      loadPlaylistData()
    }
  }, [id])

  const loadPlaylistData = async () => {
    try {
      setIsLoading(true)
      
      // 獲取歌單資料
      let playlistData = await getPlaylist(id)
      
      // 如果是自動歌單類型，使用預設資訊
      if (!playlistData && AUTO_PLAYLIST_TYPES[id]) {
        // 從資料庫重新獲取自動歌單（如果存在）
        const { refreshAllAutoPlaylists } = await import('@/lib/playlists')
        await refreshAllAutoPlaylists()
        
        // 重新載入
        playlistData = await getPlaylist(id)
        
        // 如果還是沒有，顯示錯誤
        if (!playlistData) {
          router.push('/')
          return
        }
      }
      
      if (!playlistData) {
        router.push('/')
        return
      }
      
      setPlaylist(playlistData)
      
      // 記錄瀏覽（支援未登入用戶）
      recordPlaylistView(user?.uid || null, playlistData);
      
      // 如果歌單有設置默認視圖模式，使用它
      if (playlistData.viewMode) {
        setViewMode(playlistData.viewMode)
      }
      
      // 獲取歌曲詳情
      if (playlistData.songIds && playlistData.songIds.length > 0) {
        const songDetails = await getPlaylistSongs(playlistData.songIds)
        setSongs(songDetails)
      }
    } catch (error) {
      console.error('Error loading playlist:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getThumbnail = (song) => {
    // 1. 優先使用 Spotify 專輯封面
    if (song.albumImage) {
      return song.albumImage
    }
    // 2. 其次使用 YouTube 縮圖
    if (song.youtubeVideoId) {
      return `https://img.youtube.com/vi/${song.youtubeVideoId}/hqdefault.jpg`
    }
    if (song.youtubeUrl) {
      const match = song.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)
      if (match) {
        return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`
      }
    }
    // 3. 最後使用歌手相片做 fallback
    if (song.artistPhoto) {
      return song.artistPhoto
    }
    return null
  }

  const handleSongClick = (songId) => {
    router.push(`/tabs/${songId}`)
  }

  // 格式化時間
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return ''
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    const now = new Date()
    const diff = Math.floor((now - date) / 1000)
    
    if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`
    if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`
    return date.toLocaleDateString('zh-HK')
  }

  // 獲取歌單漸變色
  const getGradient = (playlist) => {
    if (!playlist) return 'from-gray-800 to-black'
    
    if (playlist.source === 'auto') {
      // 自動歌單 - 冷色調
      switch (playlist.autoType) {
        case 'monthly': return 'from-blue-900/40 to-black'
        case 'weekly': return 'from-cyan-900/40 to-black'
        case 'trending': return 'from-purple-900/40 to-black'
        case 'alltime': return 'from-indigo-900/40 to-black'
        default: return 'from-blue-900/40 to-black'
      }
    } else {
      // 手動歌單 - 暖色調
      switch (playlist.manualType) {
        case 'artist': return 'from-orange-900/40 to-black'
        case 'theme': return 'from-amber-900/40 to-black'
        case 'series': return 'from-yellow-900/40 to-black'
        case 'mood': return 'from-rose-900/40 to-black'
        default: return 'from-[#FFD700]/20 to-black'
      }
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-black pb-24">
          <div className="h-64 bg-gray-800 animate-pulse" />
          <div className="px-6 py-4 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  if (!playlist) return null

  return (
    <Layout fullWidth>
      <div className="min-h-screen bg-black pb-24">
        {/* Header */}
        <div className="px-4 py-4 flex items-center">
          <Link
            href="/"
            className="inline-flex items-center text-white/80 hover:text-white transition"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回
          </Link>
        </div>

        {/* Playlist Info Section - 簡潔設計 */}
        <div className="px-6 pb-4">
          {/* 1:1 正方形封面圖 - 更細 */}
          <div className="flex justify-center mb-4">
            <div className="w-[250px] aspect-square rounded-lg overflow-hidden bg-[#282828]">
              {playlist.coverImage ? (
                <img 
                  src={playlist.coverImage} 
                  alt={playlist.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#FFD700] to-orange-500">
                  <span className="text-5xl">🎵</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Title - 更小字體 */}
          <h1 className="text-2xl font-bold text-white mb-2">{playlist.title}</h1>
          
          {/* Description - 更小字體 */}
          {playlist.description && (
            <p className="text-gray-400 text-xs mb-2 leading-relaxed">{playlist.description}</p>
          )}
          
          {/* Meta info - 更小字體 */}
          <p className="text-xs text-gray-500">
            共 {songs.length} 首
            {playlist.source === 'auto' && playlist.lastUpdated && (
              <span> • 更新於 {formatTimeAgo(playlist.lastUpdated)}</span>
            )}
            {playlist.source === 'manual' && playlist.curatedBy && (
              <span> • By {playlist.curatedBy}</span>
            )}
          </p>
        </div>



        {/* Auto Playlist Notice */}
        {playlist.source === 'auto' && (
          <div className="mx-6 mb-4 p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
            <p className="text-sm text-blue-300 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              此歌單由系統根據瀏覽數據自動生成，內容會定期更新。
            </p>
          </div>
        )}

        {/* Songs List / Grid */}
        {viewMode === 'list' ? (
          /* 列表視圖 */
          <div className="px-6">
            {songs.map((song, index) => (
              <button
                key={song.id}
                onClick={() => handleSongClick(song.id)}
                className="w-full flex items-center gap-4 py-3 hover:bg-white/5 transition group"
              >
                {/* Number */}
                <span className="text-gray-500 w-8 text-center text-sm">
                  {index + 1}
                </span>

                {/* Thumbnail */}
                <div className="w-12 h-12 rounded bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {getThumbnail(song) ? (
                    <img
                      src={getThumbnail(song)}
                      alt={song.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl">🎸</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 text-left min-w-0">
                  <h3 className="text-white font-medium truncate group-hover:text-[#FFD700] transition">
                    {song.title}
                  </h3>
                  <p className="text-sm text-gray-500 truncate">{song.artist}</p>
                </div>

                {/* Key */}
                <span className="text-xs text-[#FFD700] bg-[#FFD700]/10 px-2 py-1 rounded">
                  {song.originalKey || 'C'}
                </span>

                {/* Views - 只在自動歌單顯示 */}
                {playlist.source === 'auto' && (
                  <span className="text-xs text-gray-600 hidden sm:block">
                    {(song.viewCount || 0).toLocaleString()} 瀏覽
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          /* 網格視圖 - 似首頁熱門譜咁 */
          <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4 pb-4">
            {songs.map((song, index) => (
              <button
                key={song.id}
                onClick={() => handleSongClick(song.id)}
                className="flex-shrink-0 flex flex-col group text-left w-32"
              >
                {/* Square Cover */}
                <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-800 mb-3 transition-transform duration-300 group-hover:scale-105 shadow-lg relative">
                  {getThumbnail(song) ? (
                    <img
                      src={getThumbnail(song)}
                      alt={song.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      🎸
                    </div>
                  )}
                  
                  {/* Number Badge */}
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-medium">
                    {index + 1}
                  </div>
                </div>
                
                {/* Song Info */}
                <h3 className="text-sm text-white font-medium truncate group-hover:text-[#FFD700] transition">
                  {song.title}
                </h3>
                <p className="text-xs text-gray-500 truncate">{song.artist}</p>
                <p className="text-xs text-[#FFD700] mt-1">
                  {song.originalKey || 'C'} Key
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Empty State */}
        {songs.length === 0 && (
          <div className="text-center py-16">
            <span className="text-6xl block mb-4">🎸</span>
            <h3 className="text-xl text-white mb-2">暫時冇歌曲</h3>
            <p className="text-gray-500 mb-6">呢個歌單暫時未有歌曲</p>
            <Link
              href="/"
              className="inline-flex items-center px-6 py-3 bg-[#FFD700] text-black rounded-full font-medium hover:opacity-90 transition"
            >
              返回首頁
            </Link>
          </div>
        )}

        {/* Bottom Controls - 視圖切換 + 分享 */}
        {songs.length > 0 && (
          <div className="px-6 py-6 border-t border-gray-800 mt-4">
            {/* View Mode Toggle */}
            <div className="flex justify-center mb-4">
              <div className="flex bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded transition flex items-center gap-2 ${
                    viewMode === 'list' 
                      ? 'bg-[#FFD700] text-black' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="列表視圖"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span className="text-sm">列表</span>
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-4 py-2 rounded transition flex items-center gap-2 ${
                    viewMode === 'grid' 
                      ? 'bg-[#FFD700] text-black' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="網格視圖"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  <span className="text-sm">網格</span>
                </button>
              </div>
            </div>

            {/* Copy Link Button */}
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: playlist.title,
                    text: playlist.description,
                    url: window.location.href
                  })
                } else {
                  navigator.clipboard.writeText(window.location.href)
                  alert('連結已複製到剪貼簿')
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-3 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              複製連結分享
            </button>
          </div>
        )}
      </div>

      {/* Custom Styles for scrollbar-hide */}
      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </Layout>
  )
}

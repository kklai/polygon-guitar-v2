import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { getPlaylist, getPlaylistSongs, AUTO_PLAYLIST_TYPES } from '@/lib/playlists'
import Layout from '@/components/Layout'
import Link from 'next/link'

export default function PlaylistDetail() {
  const router = useRouter()
  const { id } = router.query
  const [playlist, setPlaylist] = useState(null)
  const [songs, setSongs] = useState([])
  const [isLoading, setIsLoading] = useState(true)

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
    if (song.youtubeVideoId) {
      return `https://img.youtube.com/vi/${song.youtubeVideoId}/hqdefault.jpg`
    }
    if (song.youtubeUrl) {
      const match = song.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)
      if (match) {
        return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`
      }
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
        {/* Hero Section */}
        <div className={`relative h-64 bg-gradient-to-b ${getGradient(playlist)}`}>
          {/* Back Button */}
          <Link
            href="/"
            className="absolute top-4 left-4 z-10 inline-flex items-center text-white/80 hover:text-white transition bg-black/30 backdrop-blur-sm px-3 py-2 rounded-full"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回
          </Link>

          {/* Playlist Info */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent">
            {/* Source Badge */}
            <div className="mb-2">
              {playlist.source === 'auto' ? (
                <span className="inline-flex items-center gap-1 text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  系統自動生成
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs bg-[#FFD700]/20 text-[#FFD700] px-2 py-1 rounded">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  編輯精選
                </span>
              )}
            </div>
            
            <h1 className="text-4xl font-bold text-white mb-2">{playlist.title}</h1>
            <p className="text-gray-400">{playlist.description}</p>
            <p className="text-sm text-gray-500 mt-2">
              共 {songs.length} 首
              {playlist.source === 'auto' && playlist.lastUpdated && (
                <span> • 更新於 {formatTimeAgo(playlist.lastUpdated)}</span>
              )}
              {playlist.source === 'manual' && playlist.curatedBy && (
                <span> • By {playlist.curatedBy}</span>
              )}
            </p>
          </div>
        </div>

        {/* Play All Button */}
        {songs.length > 0 && (
          <div className="px-6 py-4 flex items-center gap-4">
            <button
              onClick={() => handleSongClick(songs[0].id)}
              className="w-14 h-14 bg-[#FFD700] rounded-full flex items-center justify-center hover:scale-105 transition shadow-lg"
            >
              <svg className="w-7 h-7 text-black ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
            
            {/* Share Button */}
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
              className="p-3 text-gray-400 hover:text-white transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
          </div>
        )}

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

        {/* Songs List */}
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
      </div>
    </Layout>
  )
}

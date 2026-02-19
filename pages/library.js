import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { getAllTabs } from '@/lib/tabs'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { 
  getUserPlaylists, 
  getUserLikedSongs, 
  createPlaylist,
  deletePlaylist,
  toggleLikeSong
} from '@/lib/playlistApi'
import { RatingDisplay } from '@/components/RatingSystem'

export default function Library() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [activeTab, setActiveTab] = useState('liked') // 'liked', 'playlists', 'recent'
  const [likedSongs, setLikedSongs] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [recentSongs, setRecentSongs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('')
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('')

  useEffect(() => {
    loadLibraryData()
  }, [user])

  const loadLibraryData = async () => {
    setIsLoading(true)
    try {
      // 載入所有歌曲（用於匹配喜愛的歌曲）
      const allTabs = await getAllTabs()
      
      // 獲取喜愛的歌曲 ID
      if (user) {
        const likedIds = await getUserLikedSongs(user.uid)
        const liked = allTabs.filter(tab => likedIds.includes(tab.id))
        setLikedSongs(liked)

        // 獲取用戶歌單
        const userPlaylists = await getUserPlaylists(user.uid)
        setPlaylists(userPlaylists)
      }
      
      // 最近瀏覽（按創建時間）
      const recent = [...allTabs]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10)
      setRecentSongs(recent)
    } catch (error) {
      console.error('Error loading library:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreatePlaylist = async () => {
    if (!newPlaylistTitle.trim() || !user) return
    
    try {
      const result = await createPlaylist(user.uid, newPlaylistTitle, newPlaylistDesc)
      setNewPlaylistTitle('')
      setNewPlaylistDesc('')
      setShowCreateModal(false)
      // 重新載入歌單
      const userPlaylists = await getUserPlaylists(user.uid)
      setPlaylists(userPlaylists)
    } catch (error) {
      console.error('Error creating playlist:', error)
      alert('創建歌單失敗: ' + error.message)
    }
  }

  const handleDeletePlaylist = async (playlistId) => {
    if (!confirm('確定要刪除這個歌單嗎？') || !user) return
    
    try {
      await deletePlaylist(playlistId, user.uid)
      setPlaylists(playlists.filter(p => p.id !== playlistId))
    } catch (error) {
      console.error('Error deleting playlist:', error)
      alert('刪除失敗: ' + error.message)
    }
  }

  const handleUnlikeSong = async (songId) => {
    if (!user) return
    
    try {
      await toggleLikeSong(user.uid, songId)
      // 從列表中移除
      setLikedSongs(likedSongs.filter(s => s.id !== songId))
    } catch (error) {
      console.error('Error unliking song:', error)
    }
  }

  const handleSongClick = (songId) => {
    router.push(`/tabs/${songId}`)
  }

  const getThumbnail = (song) => {
    if (song.thumbnail) return song.thumbnail
    if (song.youtubeVideoId) {
      return `https://img.youtube.com/vi/${song.youtubeVideoId}/mqdefault.jpg`
    }
    if (song.youtubeUrl) {
      const match = song.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)
      if (match) {
        return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`
      }
    }
    return null
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-black pb-24 px-6 py-6">
          <h1 className="text-2xl font-bold text-white mb-6">音樂庫</h1>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="min-h-screen bg-black pb-24">
        {/* Header */}
        <div className="px-6 py-6">
          <h1 className="text-2xl font-bold text-white mb-2">音樂庫</h1>
          <p className="text-gray-500">
            {user ? '你的結他譜收藏' : '登入以查看你的收藏'}
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 mb-6">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {user && (
              <>
                <button
                  onClick={() => setActiveTab('liked')}
                  className={`px-4 py-2 rounded-full whitespace-nowrap transition ${
                    activeTab === 'liked'
                      ? 'bg-[#FFD700] text-black font-medium'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  喜愛歌曲 ({likedSongs.length})
                </button>
                <button
                  onClick={() => setActiveTab('playlists')}
                  className={`px-4 py-2 rounded-full whitespace-nowrap transition ${
                    activeTab === 'playlists'
                      ? 'bg-[#FFD700] text-black font-medium'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  我的歌單 ({playlists.length})
                </button>
              </>
            )}
            <button
              onClick={() => setActiveTab('recent')}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition ${
                activeTab === 'recent'
                  ? 'bg-[#FFD700] text-black font-medium'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              最近新增
            </button>
          </div>
        </div>

        {/* Liked Songs Tab */}
        {activeTab === 'liked' && user && (
          <div className="px-6">
            {likedSongs.length > 0 ? (
              <div className="space-y-2">
                {likedSongs.map((song, index) => (
                  <div
                    key={song.id}
                    className="w-full flex items-center gap-4 p-3 hover:bg-white/10 rounded-lg transition group"
                  >
                    <button
                      onClick={() => handleSongClick(song.id)}
                      className="flex-1 flex items-center gap-4 min-w-0"
                    >
                      <span className="text-gray-500 w-6 text-center">{index + 1}</span>
                      <div className="w-14 h-14 rounded bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {getThumbnail(song) ? (
                          <img
                            src={getThumbnail(song)}
                            alt={song.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-700" />
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <h3 className="text-white font-medium group-hover:text-[#FFD700] transition truncate">
                          {song.title}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">{song.artist}</p>
                        <RatingDisplay 
                          rating={song.averageRating || 0} 
                          count={song.ratingCount}
                          size="sm"
                        />
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-[#FFD700]">{song.originalKey || 'C'}</p>
                      </div>
                    </button>
                    <button
                      onClick={() => handleUnlikeSong(song.id)}
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded-full transition"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">還沒有喜愛的歌曲</p>
                <a
                  href="/search"
                  className="inline-block px-6 py-2 bg-[#FFD700] text-black rounded-full font-medium hover:opacity-90 transition"
                >
                  去發現音樂
                </a>
              </div>
            )}
          </div>
        )}

        {/* Playlists Tab */}
        {activeTab === 'playlists' && user && (
          <div className="px-6">
            {/* Create Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full mb-4 p-4 border-2 border-dashed border-gray-700 rounded-lg text-gray-400 hover:border-[#FFD700] hover:text-[#FFD700] transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              創建新歌單
            </button>

            {/* Playlists Grid */}
            {playlists.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <a
                        href={`/playlist/${playlist.id}?type=user`}
                        className="flex-1 min-w-0"
                      >
                        <h3 className="text-white font-medium truncate group-hover:text-[#FFD700] transition">
                          {playlist.title}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">
                          {(playlist.songIds || []).length} 首歌
                        </p>
                      </a>
                      <button
                        onClick={() => handleDeletePlaylist(playlist.id)}
                        className="p-2 text-gray-500 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    {playlist.description && (
                      <p className="text-xs text-gray-600 line-clamp-2">{playlist.description}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">還沒有創建歌單</p>
              </div>
            )}
          </div>
        )}

        {/* Recent Tab */}
        {activeTab === 'recent' && (
          <div className="px-6">
            {recentSongs.length > 0 ? (
              <div className="space-y-2">
                {recentSongs.map((song, index) => (
                  <button
                    key={song.id}
                    onClick={() => handleSongClick(song.id)}
                    className="w-full flex items-center gap-4 p-3 hover:bg-white/10 rounded-lg transition group"
                  >
                    <span className="text-gray-500 w-6 text-center">{index + 1}</span>
                    <div className="w-14 h-14 rounded bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {getThumbnail(song) ? (
                        <img
                          src={getThumbnail(song)}
                          alt={song.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-700" />
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <h3 className="text-white font-medium group-hover:text-[#FFD700] transition truncate">
                        {song.title}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">{song.artist}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-[#FFD700]">{song.originalKey || 'C'}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">暫時沒有歌曲</p>
              </div>
            )}
          </div>
        )}

        {/* Login Prompt */}
        {!user && activeTab !== 'recent' && (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500 mb-4">請登入以查看你的收藏</p>
            <a
              href="/login"
              className="inline-block px-6 py-2 bg-[#FFD700] text-black rounded-full font-medium hover:opacity-90 transition"
            >
              登入
            </a>
          </div>
        )}
      </div>

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">創建新歌單</h2>
            <input
              type="text"
              placeholder="歌單名稱"
              value={newPlaylistTitle}
              onChange={(e) => setNewPlaylistTitle(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 rounded-lg text-white placeholder-gray-500 mb-3 focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
            />
            <textarea
              placeholder="描述（可選）"
              value={newPlaylistDesc}
              onChange={(e) => setNewPlaylistDesc(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white/10 rounded-lg text-white placeholder-gray-500 mb-4 focus:outline-none focus:ring-2 focus:ring-[#FFD700] resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
              >
                取消
              </button>
              <button
                onClick={handleCreatePlaylist}
                disabled={!newPlaylistTitle.trim()}
                className="flex-1 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                創建
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </Layout>
  )
}

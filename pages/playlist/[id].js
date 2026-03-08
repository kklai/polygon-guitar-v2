import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { getPlaylist, getPlaylistSongs, getAllActivePlaylists, AUTO_PLAYLIST_TYPES } from '@/lib/playlists'
import { getSongThumbnail } from '@/lib/getSongThumbnail'
import Layout from '@/components/Layout'
import Link from 'next/link'
import { recordPlaylistView } from '@/lib/recentViews'
import { useAuth } from '@/contexts/AuthContext'
import { MoreVertical, Share2, Heart, BookmarkPlus, Music } from 'lucide-react'
import { toggleLikeSong, getUserPlaylists, addSongToPlaylist, createPlaylist } from '@/lib/playlistApi'

export default function PlaylistDetail() {
  const router = useRouter()
  const { id } = router.query
  const { user, isAdmin } = useAuth()
  const [playlist, setPlaylist] = useState(null)
  const [songs, setSongs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortMode, setSortMode] = useState('default') // 'default' | 'artist' | 'year' | 'shuffle'
  const [shuffleOrder, setShuffleOrder] = useState([]) // shuffle 時用嘅固定次序（indices），避免每次 re-render 重排

  // 操作選單狀態
  const [selectedSong, setSelectedSong] = useState(null)
  const [showActionModal, setShowActionModal] = useState(false)
  const [userPlaylists, setUserPlaylists] = useState([])
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false)
  const [showCreatePlaylistInput, setShowCreatePlaylistInput] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [otherPlaylists, setOtherPlaylists] = useState([]) // 其他歌單（頁底 section）

  useEffect(() => {
    if (id) {
      loadPlaylistData()
    }
  }, [id])

  // 載入其他歌單：最多 2 自動 + 7 自製，合併後隨機排序，次序每次不一
  useEffect(() => {
    if (!id) return
    let cancelled = false
    getAllActivePlaylists()
      .then(({ auto, manual }) => {
        if (cancelled) return
        const autoFiltered = (auto || []).filter((p) => p.id !== id).slice(0, 2)
        const manualFiltered = (manual || []).filter((p) => p.id !== id).slice(0, 7)
        const combined = [...autoFiltered, ...manualFiltered]
        for (let i = combined.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[combined[i], combined[j]] = [combined[j], combined[i]]
        }
        setOtherPlaylists(combined)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [id])

  // 隨機排序：只喺撳 shuffle 或歌曲載入時 shuffle 一次，唔會因 scroll/re-render 重排
  const computeShuffleOrder = (length) => {
    const indices = Array.from({ length }, (_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    return indices
  }
  // 切換歌單時清空 shuffle 次序，等下次用新歌單再算
  useEffect(() => {
    setShuffleOrder([])
  }, [id])
  useEffect(() => {
    if (sortMode !== 'shuffle' || !songs.length) return
    if (shuffleOrder.length !== songs.length) {
      setShuffleOrder(computeShuffleOrder(songs.length))
    }
  }, [sortMode, songs.length])

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

  const handleSongClick = (songId) => {
    router.push(`/tabs/${songId}`)
  }

  // 獲取排序後的歌曲列表（預設=撳排序 icon，歌手/年份/隨機）
  const getSortedSongs = () => {
    const sorted = [...songs]
    switch (sortMode) {
      case 'default':
        return sorted
      case 'artist':
        return sorted.sort((a, b) => {
          const artistA = (a.artist || '').toLowerCase()
          const artistB = (b.artist || '').toLowerCase()
          return artistA.localeCompare(artistB, 'zh-HK')
        })
      
      case 'year':
        return sorted.sort((a, b) => {
          // 先按年份排序，冇年份排最後
          const yearA = a.songYear || a.uploadYear || 0
          const yearB = b.songYear || b.uploadYear || 0
          if (yearA && yearB) return yearB - yearA // 年份由新到舊
          if (yearA) return -1
          if (yearB) return 1
          return 0
        })
      
      case 'shuffle':
        // 用已固定嘅 shuffleOrder，唔會因 re-render 再亂序
        if (shuffleOrder.length === sorted.length) {
          return shuffleOrder.map((i) => sorted[i])
        }
        return sorted
      
      default:
        return sorted
    }
  }

  const sortedSongs = getSortedSongs()

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

  // 更多操作
  const handleMoreClick = async (e, song) => {
    e.stopPropagation()
    setSelectedSong(song)
    if (user) {
      const playlists = await getUserPlaylists(user.uid)
      setUserPlaylists(playlists)
    }
    setShowActionModal(true)
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/tabs/${selectedSong.id}`
    if (navigator.share) {
      await navigator.share({
        title: `${selectedSong.title} - ${selectedSong.artist}`,
        url
      })
    } else {
      await navigator.clipboard.writeText(url)
      alert('已複製連結到剪貼簿')
    }
    setShowActionModal(false)
  }

  const handleAddToLiked = async () => {
    if (!selectedSong || !user) {
      alert('請先登入後即可收藏喜愛的結他譜')
      return
    }
    try {
      const result = await toggleLikeSong(user.uid, selectedSong.id)
      alert(result.isLiked ? '已加到最喜愛 ❤️' : '已取消最喜愛')
      setShowActionModal(false)
    } catch (error) {
      alert('操作失敗：' + error.message)
    }
  }

  const handleAddToPlaylistClick = () => {
    if (!user) {
      alert('請先登入後即可收藏喜愛的結他譜')
      return
    }
    setShowActionModal(false)
    setShowAddToPlaylist(true)
  }

  const addToPlaylist = async (playlistId) => {
    if (!selectedSong) return
    try {
      await addSongToPlaylist(playlistId, selectedSong.id)
      setShowAddToPlaylist(false)
      alert('已加入歌單')
    } catch (error) {
      alert('加入失敗：' + error.message)
    }
  }

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim() || !user || !selectedSong) return
    try {
      const result = await createPlaylist(user.uid, newPlaylistName.trim())
      await addSongToPlaylist(result.playlistId, selectedSong.id)
      setShowCreatePlaylistInput(false)
      setShowAddToPlaylist(false)
      setNewPlaylistName('')
      alert(`已創建歌單「${newPlaylistName.trim()}」並加入歌曲`)
    } catch (error) {
      alert('創建歌單失敗：' + error.message)
    }
  }

  if (isLoading) {
    return (
      <Layout fullWidth hideHeader>
        <Head>
          <meta name="theme-color" content="transparent" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        </Head>
        <div className="relative z-10 min-h-screen pb-24 pt-[env(safe-area-inset-top)] bg-black">
          <div className="h-64 bg-gray-800/50 animate-pulse" />
          <div className="px-6 py-4 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-800/50 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  if (!playlist) return null

  return (
    <Layout fullWidth hideHeader>
      <Head>
        <meta name="theme-color" content="transparent" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>
      <div className="relative z-10 min-h-screen pb-24 bg-black" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        {/* 返回：絕對定位；封面：置中 */}
        <div className="relative px-4 sm:px-6 pt-4 pb-4">
          <Link
            href="/"
            className="absolute left-4 top-4 z-10 inline-flex items-center text-white hover:text-white/90 transition p-1.5 -ml-1.5"
            aria-label="返回"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          {/* 複製連結分享 - 頁面右上方 */}
          {songs.length > 0 && (
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
              className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 text-white hover:text-white/90 transition p-1.5"
              aria-label="複製連結分享"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span className="text-sm hidden sm:inline">複製連結分享</span>
            </button>
          )}
          <div className="flex justify-center">
          <div className="w-full max-w-[300px] max-h-[300px] aspect-square overflow-hidden rounded bg-[#282828] shadow-xl">
            {playlist.coverImage ? (
              <img 
                src={playlist.coverImage} 
                alt={playlist.title}
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#282828]" />
            )}
          </div>
          </div>
        </div>

        {/* 標題行：SVG 32px 白字 + 右 15px 灰「共17首 • By Benji」 */}
        <div className="px-4 sm:px-6 pb-1">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h1 className="font-bold text-white truncate" style={{ fontSize: '1.5rem' }}>
                {playlist.title}
              </h1>
              {isAdmin && playlist.source === 'manual' && (
                <Link
                  href={`/admin/playlists/edit/${id}`}
                  className="p-1.5 bg-[#FFD700] text-black rounded-lg hover:bg-yellow-400 transition flex-shrink-0"
                  title="編輯歌單"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </Link>
              )}
            </div>
            <span className="text-[12px] md:text-[14px] text-gray-500 whitespace-nowrap flex-shrink-0">
              共 {songs.length} 首
              {playlist.source === 'manual' && playlist.curatedBy && (
                <> • By {playlist.curatedBy}</>
              )}
              {playlist.source === 'auto' && playlist.lastUpdated && (
                <> • 更新於 {formatTimeAgo(playlist.lastUpdated)}</>
              )}
            </span>
          </div>
        </div>

        {/* 簡介 - 與下面歌手名同 style：0.85rem #999 */}
        {playlist.description && (
          <div className="px-4 sm:px-6 pb-0">
            <p className="text-[0.85rem] text-[#999] leading-snug line-clamp-4 whitespace-pre-line">{playlist.description}</p>
          </div>
        )}

        {/* Action Bar：左緣與簡介對齊 (px-4 sm:px-6)，四粒排序 icon 統一 padding 等距 */}
        {songs.length > 0 && (
          <div className="px-4 sm:px-6 mb-1 pt-0 pb-1 flex items-center gap-3">
            <div className="flex flex-1 min-w-0 overflow-x-auto scrollbar-hide items-center gap-0">
              <button
                type="button"
                onClick={() => setSortMode('default')}
                className={`pl-0 pr-2.5 py-2.5 rounded transition shrink-0 outline-none ${sortMode === 'default' ? 'text-[#FFD700]' : 'text-gray-400 hover:text-white'}`}
                title="預設次序"
              >
                <svg className="w-7 h-7 block shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 36.42 41.51" preserveAspectRatio="xMidYMid meet">
                  <line x1="24.56" y1="7.91" x2="24.56" y2="33.33" />
                  <polyline points="19.87 29.9 24.56 34.59 29.25 29.9" />
                  <line x1="11.86" y1="33.59" x2="11.86" y2="8.17" />
                  <polyline points="16.55 11.6 11.86 6.91 7.17 11.6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setSortMode('artist')}
                className={`-ml-2 p-2.5 rounded transition shrink-0 outline-none ${sortMode === 'artist' ? 'text-[#FFD700]' : 'text-gray-400 hover:text-white'}`}
                title="按歌手排序"
              >
                <svg className="w-7 h-7 block shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 36.42 41.51" preserveAspectRatio="xMidYMid meet">
                  <circle cx="18.21" cy="13.13" r="6.22" />
                  <path d="M29.54,34.59c0-6.26-5.07-11.33-11.33-11.33s-11.33,5.07-11.33,11.33h22.66Z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setSortMode('year')}
                className={`p-2.5 rounded transition shrink-0 outline-none ${sortMode === 'year' ? 'text-[#FFD700]' : 'text-gray-400 hover:text-white'}`}
                title="按年份排序"
              >
                <svg className="w-6 h-6 block shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 34.26 32.9" preserveAspectRatio="xMidYMid meet">
                  <line x1="23.31" y1="4.82" x2="10.94" y2="4.82" />
                  <path d="M27.01,4.82h2.84c1.32,0,2.39,1.07,2.39,2.4v21.2c0,1.33-1.07,2.4-2.39,2.4H4.4c-1.32,0-2.39-1.07-2.39-2.4V7.22c0-1.33,1.07-2.4,2.39-2.4h2.84" />
                  <path d="M9.09,2.07h0c1.02,0,1.85.83,1.85,1.85v1.82c0,1.02-.83,1.85-1.85,1.85h0c-1.02,0-1.85-.83-1.85-1.85v-1.82c0-1.02.83-1.85,1.85-1.85Z" />
                  <path d="M25.15,2.07h0c1.02,0,1.85.83,1.85,1.85v1.82c0,1.02-.83,1.85-1.85,1.85h0c-1.02,0-1.85-.83-1.85-1.85v-1.82c0-1.02.83-1.85,1.85-1.85Z" />
                  <line x1="2.55" y1="11.11" x2="31.83" y2="11.11" />
                  <line x1="6.98" y1="16.58" x2="27.27" y2="16.58" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (songs.length) {
                    setShuffleOrder(computeShuffleOrder(songs.length))
                    setSortMode('shuffle')
                  }
                }}
                className={`p-2.5 rounded transition shrink-0 outline-none ${sortMode === 'shuffle' ? 'text-[#FFD700]' : 'text-gray-400 hover:text-white'}`}
                title="隨機排序"
              >
                <svg className="w-6 h-6 block shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" viewBox="35 5 34 34" preserveAspectRatio="xMidYMid meet">
                  <polyline points="62.42 28.27 65.96 31.81 62.42 35.35" />
                  <path d="M37.68,10.76h3.03c2.29,0,4.45,1.27,5.8,3.41l8.95,14.22c1.35,2.15,3.51,3.41,5.8,3.41h4.27" />
                  <path d="M37.68,31.81h3.03c2.29,0,4.45-1.27,5.8-3.41l8.95-14.22c1.35-2.15,3.51-3.41,5.8-3.41h4.27" />
                  <polyline points="62.42 14.3 65.96 10.76 62.42 7.22" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Songs List */}
        {songs.length > 0 && (
          <div className="px-4 sm:px-6">
            {sortedSongs.map((song) => (
              <div key={song.id} className="group">
                <button
                  onClick={() => handleSongClick(song.id)}
                  className="w-full flex items-center gap-3 py-2 px-2 -mx-2 rounded-[7px] md:hover:bg-white/5 md:transition"
                >
                  <div className="w-[49px] h-[49px] rounded-[5px] bg-gray-800 flex-shrink-0 overflow-hidden">
                    {getSongThumbnail(song) ? (
                      <img
                        src={getSongThumbnail(song)}
                        alt={song.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-2xl">🎸</span>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <h3 className="text-[1rem] font-medium text-[#e6e6e6] truncate md:group-hover:text-[#FFD700] md:transition">
                      {song.title}
                    </h3>
                    <p className="text-[0.85rem] text-[#999] truncate">{song.artist}</p>
                  </div>
                  {playlist.source === 'auto' && (
                    <span className="text-xs text-gray-600 hidden sm:block">
                      {(song.viewCount || 0).toLocaleString()} 瀏覽
                    </span>
                  )}
                  <button
                    onClick={(e) => handleMoreClick(e, song)}
                    className="p-2 text-[#999] hover:text-white transition"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 14.96 2.54" fill="currentColor" aria-hidden>
                      <circle cx="1.27" cy="1.27" r="1.27" />
                      <circle cx="7.48" cy="1.27" r="1.27" />
                      <circle cx="13.69" cy="1.27" r="1.27" />
                    </svg>
                  </button>
                </button>
              </div>
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

        {/* 其他歌單 - 一行過橫向滾動，同首頁 Section 一樣 */}
        {otherPlaylists.length > 0 && (
          <section className="pt-8 pb-6" style={{ marginBottom: 25 }}>
            <h2 className="font-bold text-white pr-6 pb-2 pt-0" style={{ fontSize: '1.375rem', paddingLeft: '1rem' }}>其他歌單</h2>
            <div className="flex overflow-x-auto scrollbar-hide pr-6 py-2 -my-2" style={{ gap: 14, paddingLeft: '1rem' }}>
              {otherPlaylists.map((pl) => (
                <Link
                  key={pl.id}
                  href={`/playlist/${pl.id}`}
                  className="flex-shrink-0 w-36 flex flex-col group"
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-[#282828] mb-2 transition-transform duration-300 group-hover:scale-105">
                    {pl.coverImage ? (
                      <img
                        src={pl.coverImage}
                        alt={pl.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">🎵</div>
                    )}
                  </div>
                  <h3 className="text-[1rem] font-medium text-white truncate group-hover:text-[#FFD700] transition">
                    {pl.title}
                  </h3>
                </Link>
              ))}
            </div>
          </section>
        )}

        </div>
        {/* Action Modal */}
        {showActionModal && (
          <>
            <div 
              className="fixed inset-0 bg-black/60 z-50" 
              onClick={() => setShowActionModal(false)} 
            />
            <div className="fixed bottom-0 left-0 right-0 bg-[#121212] rounded-t-2xl z-[60] p-4 pb-24">
              <div className="w-12 h-1 bg-[#3E3E3E] rounded-full mx-auto mb-4" />
              
              {selectedSong && (
                <div className="mb-4 pb-4 border-b border-gray-800">
                  <p className="text-white font-medium truncate">{selectedSong.title}</p>
                  <p className="text-gray-400 text-sm truncate">{selectedSong.artist}</p>
                </div>
              )}
              
              <div className="space-y-1">
                <button 
                  onClick={handleShare}
                  className="w-full flex items-center space-x-4 p-3 hover:bg-[#1a1a1a] rounded-lg"
                >
                  <Share2 className="w-5 h-5 text-[#B3B3B3]" />
                  <span className="text-white">分享</span>
                </button>
                
                <button 
                  onClick={handleAddToLiked}
                  className="w-full flex items-center space-x-4 p-3 hover:bg-[#1a1a1a] rounded-lg"
                >
                  <Heart className="w-5 h-5 text-red-500" />
                  <span className="text-white">加到我最喜愛</span>
                </button>
                
                <button 
                  onClick={handleAddToPlaylistClick}
                  className="w-full flex items-center space-x-4 p-3 hover:bg-[#1a1a1a] rounded-lg"
                >
                  <BookmarkPlus className="w-5 h-5 text-[#B3B3B3]" />
                  <span className="text-white">加入歌單</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* 加入歌單 Modal */}
        {showAddToPlaylist && (
          <>
            <div 
              className="fixed inset-0 bg-black/60 z-50" 
              onClick={() => {
                setShowAddToPlaylist(false)
                setShowCreatePlaylistInput(false)
                setNewPlaylistName('')
              }} 
            />
            <div className="fixed bottom-0 left-0 right-0 bg-[#121212] rounded-t-2xl z-[60] p-4 pb-24 max-h-[70vh] overflow-y-auto">
              <div className="w-12 h-1 bg-[#3E3E3E] rounded-full mx-auto mb-4" />
              <h3 className="text-white text-lg font-bold mb-4">加入歌單</h3>
              
              <div className="space-y-2">
                {userPlaylists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => addToPlaylist(pl.id)}
                    className="w-full flex items-center space-x-3 p-3 hover:bg-[#1a1a1a] rounded-lg text-left"
                  >
                    <div className="w-12 h-12 rounded-[4px] bg-[#282828] flex items-center justify-center">
                      <Music className="w-6 h-6 text-[#3E3E3E]" />
                    </div>
                    <span className="text-white font-medium">{pl.title}</span>
                  </button>
                ))}
                
                {/* 創建新歌單按鈕 */}
                <button
                  onClick={() => setShowCreatePlaylistInput(true)}
                  className="w-full flex items-center space-x-3 p-3 hover:bg-[#1a1a1a] rounded-lg text-left border-t border-gray-800 mt-2"
                >
                  <div className="w-12 h-12 rounded-[4px] bg-[#FFD700] flex items-center justify-center">
                    <span className="text-black text-2xl font-light">+</span>
                  </div>
                  <span className="text-[#FFD700] font-medium">創建新歌單</span>
                </button>

                {/* 創建輸入框 */}
                {showCreatePlaylistInput && (
                  <div className="mt-3 p-3 bg-[#1a1a1a] rounded-lg">
                    <input
                      type="text"
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      placeholder="輸入歌單名稱"
                      className="w-full bg-[#282828] text-white px-3 py-2 rounded-lg mb-2 outline-none focus:ring-2 focus:ring-[#FFD700]"
                      autoFocus
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={handleCreatePlaylist}
                        disabled={!newPlaylistName.trim()}
                        className="flex-1 bg-[#FFD700] text-black py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        創建並加入
                      </button>
                      <button
                        onClick={() => {
                          setShowCreatePlaylistInput(false)
                          setNewPlaylistName('')
                        }}
                        className="flex-1 bg-[#282828] text-white py-2 rounded-lg"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

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

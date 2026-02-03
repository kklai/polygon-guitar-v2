import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getAllArtists, getAllTabs } from '@/lib/tabs'
import { getAutoPlaylists, getManualPlaylists } from '@/lib/playlists'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import Link from 'next/link'

// 歌手分類預設資料
const DEFAULT_CATEGORIES = [
  {
    id: 'male',
    name: '男歌手',
    image: 'https://images.unsplash.com/photo-1516280440614-6697288d5d38?w=600&h=400&fit=crop',
    color: 'from-blue-900/80 to-black/80'
  },
  {
    id: 'female',
    name: '女歌手',
    image: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=600&h=400&fit=crop',
    color: 'from-pink-900/80 to-black/80'
  },
  {
    id: 'group',
    name: '組合',
    image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&h=400&fit=crop',
    color: 'from-purple-900/80 to-black/80'
  }
]

// 靜態備用自動歌單（當 Firestore 冇數據時使用）
const FALLBACK_AUTO_PLAYLISTS = [
  {
    id: 'monthly',
    title: '本月熱門',
    description: '過去 30 天最多人瀏覽的結他譜',
    source: 'auto',
    coverImage: null,
    songIds: []
  },
  {
    id: 'weekly',
    title: '本週新歌',
    description: '最近 7 天上架的結他譜',
    source: 'auto',
    coverImage: null,
    songIds: []
  },
  {
    id: 'trending',
    title: '大家都在彈',
    description: '過去 24 小時熱門趨勢',
    source: 'auto',
    coverImage: null,
    songIds: []
  },
  {
    id: 'alltime',
    title: '經典排行榜',
    description: '歷史累積最多瀏覽',
    source: 'auto',
    coverImage: null,
    songIds: []
  }
]

// 靜態備用手動歌單
const FALLBACK_MANUAL_PLAYLISTS = [
  {
    id: 'featured-1',
    title: '陳奕迅結他精選',
    description: '香港樂壇天王的經典結他譜',
    source: 'manual',
    manualType: 'artist',
    curatedBy: 'Polygon',
    coverImage: null,
    songIds: []
  },
  {
    id: 'featured-2',
    title: '夭心夭肺 Vol.1',
    description: '慘情歌系列精選',
    source: 'manual',
    manualType: 'series',
    curatedBy: 'Polygon',
    coverImage: null,
    songIds: []
  },
  {
    id: 'featured-3',
    title: '新手入門系列',
    description: '適合初學者的簡單譜',
    source: 'manual',
    manualType: 'theme',
    curatedBy: 'Polygon',
    coverImage: null,
    songIds: []
  }
]

// 時間格式化
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

export default function Home() {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const [artists, setArtists] = useState([])
  const [latestSongs, setLatestSongs] = useState([])
  const [autoPlaylists, setAutoPlaylists] = useState([])
  const [manualPlaylists, setManualPlaylists] = useState([])
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadHomeData()
  }, [])

  const loadHomeData = async () => {
    try {
      // 獲取熱門歌手（按歌曲數量排序）
      const allArtists = await getAllArtists()
      const sortedArtists = allArtists
        .sort((a, b) => (b.tabCount || 0) - (a.tabCount || 0))
        .slice(0, 10)
      setArtists(sortedArtists)

      // 獲取最新歌曲
      const allTabs = await getAllTabs()
      const sortedTabs = allTabs
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10)
      setLatestSongs(sortedTabs)

      // 獲取自動歌單（熱門歌單區）
      let auto = []
      try {
        auto = await getAutoPlaylists()
        console.log('Auto playlists loaded:', auto)
      } catch (e) {
        console.log('Error loading auto playlists, using fallback:', e)
      }
      // 如果 Firestore 冇數據，使用靜態備用數據
      if (!auto || auto.length === 0) {
        auto = FALLBACK_AUTO_PLAYLISTS
      }
      setAutoPlaylists(auto)

      // 獲取精選手動歌單（編輯精選區）
      let manual = []
      try {
        manual = await getManualPlaylists(8)
        console.log('Manual playlists loaded:', manual)
      } catch (e) {
        console.log('Error loading manual playlists, using fallback:', e)
      }
      // 如果 Firestore 冇數據，使用靜態備用數據
      if (!manual || manual.length === 0) {
        manual = FALLBACK_MANUAL_PLAYLISTS
      }
      setManualPlaylists(manual)

      // 獲取自定義分類圖片
      try {
        const docRef = doc(db, 'settings', 'categoryImages')
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          const data = docSnap.data()
          // 更新分類圖片
          setCategories(prev => prev.map(cat => ({
            ...cat,
            image: data[cat.id] || cat.image
          })))
        }
      } catch (e) {
        console.log('Error loading category images:', e)
      }
    } catch (error) {
      console.error('Error loading home data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 獲取歌曲/歌單縮圖
  const getThumbnail = (item) => {
    // 如果是歌單且有封面
    if (item.coverImage) {
      return item.coverImage
    }
    // 如果是歌曲
    if (item.youtubeVideoId) {
      return `https://img.youtube.com/vi/${item.youtubeVideoId}/mqdefault.jpg`
    }
    if (item.youtubeUrl) {
      const match = item.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)
      if (match) {
        return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`
      }
    }
    return null
  }

  // 處理分類點擊
  const handleCategoryClick = (categoryId) => {
    router.push(`/artists?category=${categoryId}`)
  }

  // 處理歌手點擊
  const handleArtistClick = (artist) => {
    const slug = artist.normalizedName || artist.id
    router.push(`/songs/${slug}`)
  }

  // 處理歌曲點擊
  const handleSongClick = (songId) => {
    router.push(`/tabs/${songId}`)
  }

  // 處理歌單點擊
  const handlePlaylistClick = (playlistId) => {
    router.push(`/playlist/${playlistId}`)
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-black pb-24">
          <div className="px-6 py-8">
            <div className="h-8 bg-gray-800 rounded w-48 mb-6 animate-pulse" />
            <div className="flex gap-4 overflow-x-auto">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[40vw] h-[25vh] bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout fullWidth>
      <div className="min-h-screen bg-black pb-24">
        {/* Logo Header */}
        <div className="px-6 py-4">
          <h1 className="text-xl font-bold text-white">
            <span className="text-[#FFD700]">Polygon</span> 結他譜
          </h1>
        </div>

        {/* 第一區：歌手分類 */}
        <section className="mb-8">
          <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className="flex-shrink-0 relative w-[40vw] md:w-[30vw] h-[25vh] rounded-xl overflow-hidden group"
              >
                {/* Background Image */}
                <img
                  src={category.image}
                  alt={category.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {/* Gradient Overlay */}
                <div className={`absolute inset-0 bg-gradient-to-t ${category.color}`} />
                {/* Text */}
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-white text-xl font-bold">{category.name}</h3>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 第二區：熱門結他譜 */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-white px-6 py-4">熱門結他譜</h2>
          <div className="flex overflow-x-auto scrollbar-hide px-6 gap-6">
            {artists.map((artist) => (
              <button
                key={artist.id}
                onClick={() => handleArtistClick(artist)}
                className="flex-shrink-0 flex flex-col items-center group"
              >
                {/* Circular Avatar */}
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-gray-800 mb-3 transition-transform duration-300 group-hover:scale-105 shadow-lg">
                  {artist.photo ? (
                    <img
                      src={artist.photo}
                      alt={artist.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      {artist.artistType === 'male' ? '👨‍🎤' : 
                       artist.artistType === 'female' ? '👩‍🎤' : '🎸'}
                    </div>
                  )}
                </div>
                {/* Artist Name */}
                <span className="text-sm text-gray-300 text-center max-w-[100px] truncate group-hover:text-white transition">
                  {artist.name}
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  {artist.tabCount || 0} 首
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* 第三區：熱門歌單（數據驅動 - Auto） */}
        {autoPlaylists.length > 0 && (
          <section className="mb-8">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-2xl font-bold text-white">熱門歌單 🔥</h2>
              </div>
              <p className="text-sm text-gray-500">根據瀏覽數據自動更新</p>
            </div>
            
            <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
              {autoPlaylists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => handlePlaylistClick(playlist.id)}
                  className="flex-shrink-0 flex flex-col group text-left w-36"
                >
                  {/* Square Cover - 冷色調 */}
                  <div className="relative w-36 h-36 rounded-lg overflow-hidden bg-gradient-to-br from-blue-900/30 to-gray-800 mb-3 transition-transform duration-300 group-hover:scale-105 shadow-lg">
                    {getThumbnail(playlist) ? (
                      <img
                        src={getThumbnail(playlist)}
                        alt={playlist.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        📊
                      </div>
                    )}
                    
                    {/* Auto Badge */}
                    <div className="absolute top-2 right-2">
                      <span className="text-xs bg-black/60 text-gray-400 px-2 py-0.5 rounded">
                        自動
                      </span>
                    </div>
                    
                    {/* Play Overlay */}
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <div className="w-12 h-12 bg-[#FFD700] rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* Playlist Info */}
                  <h3 className="text-base text-white font-medium truncate group-hover:text-[#FFD700] transition">
                    {playlist.title}
                  </h3>
                  <p className="text-sm text-gray-500 truncate">
                    {playlist.description}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {playlist.songIds?.length || 0} 首 • 更新於 {formatTimeAgo(playlist.lastUpdated)}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 第四區：編輯精選（人工策劃 - Manual） */}
        {manualPlaylists.length > 0 && (
          <section className="mb-8">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-2xl font-bold text-white">編輯精選 ✨</h2>
              </div>
              <p className="text-sm text-gray-500">精心策劃的音樂旅程</p>
            </div>
            
            <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
              {manualPlaylists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => handlePlaylistClick(playlist.id)}
                  className="flex-shrink-0 flex flex-col group text-left w-36"
                >
                  {/* Square Cover - 暖色調 */}
                  <div className="relative w-36 h-36 rounded-lg overflow-hidden bg-gradient-to-br from-[#FFD700]/20 to-orange-900/20 mb-3 transition-transform duration-300 group-hover:scale-105 shadow-lg border border-[#FFD700]/20">
                    {getThumbnail(playlist) ? (
                      <img
                        src={getThumbnail(playlist)}
                        alt={playlist.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        ✨
                      </div>
                    )}
                    
                    {/* Featured Badge */}
                    <div className="absolute top-2 right-2">
                      <span className="text-xs bg-[#FFD700] text-black px-2 py-0.5 rounded font-medium">
                        精選
                      </span>
                    </div>
                    
                    {/* Play Overlay */}
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <div className="w-12 h-12 bg-[#FFD700] rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* Playlist Info */}
                  <h3 className="text-base text-white font-medium truncate group-hover:text-[#FFD700] transition">
                    {playlist.title}
                  </h3>
                  <p className="text-sm text-gray-500 truncate">
                    {playlist.description}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {playlist.songIds?.length || 0} 首 • By {playlist.curatedBy || 'Polygon'}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 第五區：最新上架 */}
        {latestSongs.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white px-6 py-4">最新上架</h2>
            <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
              {latestSongs.map((song) => (
                <button
                  key={song.id}
                  onClick={() => handleSongClick(song.id)}
                  className="flex-shrink-0 flex flex-col group text-left w-32"
                >
                  {/* Square Cover */}
                  <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-800 mb-3 transition-transform duration-300 group-hover:scale-105 shadow-lg">
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
                  </div>
                  {/* Song Info */}
                  <h3 className="text-sm text-white font-medium truncate group-hover:text-[#FFD700] transition">
                    {song.title}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">{song.artist}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {song.originalKey || 'C'} Key
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 底部 Spacer */}
        <div className="h-8" />
        
        {/* Admin Notice - 如果係管理員，顯示歌單管理提示 */}
        {isAdmin && (
          <div className="px-6 pb-24">
            <div className="p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-400 font-medium">管理員提示</p>
                  <p className="text-yellow-200/70 text-sm mt-1">
                    如果歌單未有數據，請到管理後台創建
                  </p>
                </div>
                <Link
                  href="/admin/playlists"
                  className="px-4 py-2 bg-yellow-700 text-white rounded-lg hover:bg-yellow-600 transition text-sm"
                >
                  管理歌單
                </Link>
              </div>
            </div>
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

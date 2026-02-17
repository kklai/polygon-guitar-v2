import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getAllArtists, getAllTabs, getCategoryImages } from '@/lib/tabs'
import { getAutoPlaylists, getManualPlaylists } from '@/lib/playlists'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import Link from 'next/link'
import Head from 'next/head'
import { siteConfig, generateBreadcrumbSchema } from '@/lib/seo'

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

// 裁剪維基百科圖片URL（顯示頭部區域）
function getCroppedWikiImage(url) {
  if (!url) return url
  
  // 維基百科圖片通過添加參數來裁剪
  // /thumb/ 路徑的圖片可以修改尺寸
  if (url.includes('/thumb/')) {
    // 將現有尺寸改為正方形頭像尺寸（例如 200x200）
    // 維基圖片格式: .../thumb/.../檔名/寬度px-檔名
    // 改為: .../thumb/.../檔名/200px-檔名
    return url.replace(/\/\d+px-/, '/200px-')
  }
  
  return url
}

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
  const [hotTabs, setHotTabs] = useState([]) // 最近一個月熱門譜
  const [hotArtists, setHotArtists] = useState({
    male: [],
    female: [],
    group: []
  })
  const [autoPlaylists, setAutoPlaylists] = useState([])
  const [manualPlaylists, setManualPlaylists] = useState([])
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [isLoading, setIsLoading] = useState(true)
  const [totalViewCount, setTotalViewCount] = useState(0)
  
  // 首頁設置
  const [homeSettings, setHomeSettings] = useState({
    manualSelection: { male: [], female: [], group: [] },
    useManualSelection: { male: false, female: false, group: false },
    hotArtistSortBy: 'viewCount',
    displayCount: 20
  })

  useEffect(() => {
    loadHomeData()
  }, [])

  const loadHomeData = async () => {
    try {
      // 獲取首頁設置
      let settings = {}
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'home'))
        settings = settingsDoc.exists() ? settingsDoc.data() : {}
        setHomeSettings(prev => ({ ...prev, ...settings }))
      } catch (settingsError) {
        console.error('Error loading home settings:', settingsError)
      }
      
      // 獲取所有譜（先獲取用於計算歌手瀏覽量）
      const allTabs = await getAllTabs()
      
      // 計算網站總瀏覽量
      const totalViews = allTabs.reduce((sum, tab) => sum + (tab.viewCount || 0), 0)
      setTotalViewCount(totalViews)
      
      // 計算每個歌手嘅總瀏覽量（基於所有歌嘅瀏覽量總和）
      const artistViewCounts = {}
      allTabs.forEach(tab => {
        const artistId = tab.artistId || tab.artist?.toLowerCase().replace(/\s+/g, '-')
        if (artistId) {
          if (!artistViewCounts[artistId]) {
            artistViewCounts[artistId] = 0
          }
          artistViewCounts[artistId] += (tab.viewCount || 0)
        }
      })
      
      // 獲取所有歌手
      const allArtists = await getAllArtists()
      
      // 為每個歌手添加計算出嘅總瀏覽量
      const artistsWithViews = allArtists.map(artist => {
        const artistId = artist.normalizedName || artist.id
        // 優先使用計算嘅總瀏覽量，其次使用歌手本身嘅 viewCount
        const calculatedViews = artistViewCounts[artistId] || 0
        const storedViews = artist.viewCount || 0
        return {
          ...artist,
          viewCount: calculatedViews || storedViews // 使用計算值或存儲值
        }
      })
      
      // 根據設置排序
      const displayCount = settings.displayCount || 20
      const sortBy = settings.hotArtistSortBy || 'viewCount'
      
      const sortedArtists = artistsWithViews.sort((a, b) => {
        if (sortBy === 'tabCount') {
          // 按譜數排序
          return (b.songCount || b.tabCount || 0) - (a.songCount || a.tabCount || 0)
        } else if (sortBy === 'adminScore') {
          // 按 adminScore 排序
          return (b.adminScore || 0) - (a.adminScore || 0)
        } else if (sortBy === 'mixed') {
          // 混合排序：瀏覽量(50%) + 譜數(30%) + 評分(20%)
          const scoreA = (a.viewCount || 0) * 0.5 + 
                        (a.songCount || a.tabCount || 0) * 30 + 
                        (a.adminScore || 0) * 200
          const scoreB = (b.viewCount || 0) * 0.5 + 
                        (b.songCount || b.tabCount || 0) * 30 + 
                        (b.adminScore || 0) * 200
          return scoreB - scoreA
        } else {
          // 默認：按瀏覽量排序（同分按評分、歌曲數）
          const viewsA = a.viewCount || 0
          const viewsB = b.viewCount || 0
          if (viewsB !== viewsA) return viewsB - viewsA
          
          const scoreA = a.adminScore || 0
          const scoreB = b.adminScore || 0
          if (scoreB !== scoreA) return scoreB - scoreA
          
          return (b.songCount || b.tabCount || 0) - (a.songCount || a.tabCount || 0)
        }
      })
      
      // 分類熱門歌手（根據設置決定手動或自動）
      const getCategoryArtists = (category) => {
        const useManual = settings.useManualSelection?.[category]
        const manualList = settings.manualSelection?.[category] || []
        
        if (useManual && manualList.length > 0) {
          // 使用手動揀選，並補充自動排序至指定數量
          const manualIds = new Set(manualList.map(a => a.id))
          const autoFill = sortedArtists
            .filter(a => (a.artistType || a.gender) === category && !manualIds.has(a.id))
            .slice(0, displayCount - manualList.length)
          return [...manualList, ...autoFill].slice(0, displayCount)
        } else {
          // 自動排序
          return sortedArtists
            .filter(a => (a.artistType || a.gender) === category)
            .slice(0, displayCount)
        }
      }
      
      setHotArtists({
        male: getCategoryArtists('male'),
        female: getCategoryArtists('female'),
        group: getCategoryArtists('group')
      })
      
      // 保留原來的總熱門歌手（向後兼容）
      setArtists(sortedByViews.slice(0, 10))
      
      // 獲取最新歌曲（顯示40個）
      const sortedTabs = allTabs
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 40)
      setLatestSongs(sortedTabs)
      
      // 獲取最近一個月熱門譜（按瀏覽量排序，顯示40個）
      const oneMonthAgo = new Date()
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
      
      const recentHotTabs = allTabs
        .filter(tab => new Date(tab.createdAt) >= oneMonthAgo || tab.viewCount > 0)
        .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
        .slice(0, 40)
      setHotTabs(recentHotTabs)

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

      // 獲取自定義分類圖片（使用熱門歌手相片）
      try {
        const categoryImages = await getCategoryImages()
        if (categoryImages) {
          // 更新分類圖片（維基圖片裁剪為頭像）
          setCategories(prev => prev.map(cat => {
            const catData = categoryImages[cat.id]
            let imageUrl = cat.image
            
            if (catData) {
              // 處理新格式（對象）或舊格式（字符串）
              if (typeof catData === 'string') {
                imageUrl = catData
              } else if (catData.image) {
                imageUrl = catData.image
              }
            }
            
            // 如果是維基百科圖片，添加裁剪參數顯示頭部
            if (imageUrl && imageUrl.includes('wikipedia.org')) {
              imageUrl = getCroppedWikiImage(imageUrl)
            }
            return { ...cat, image: imageUrl }
          }))
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
    router.push(`/artists/${slug}`)
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

  // SEO 配置
  const seoTitle = siteConfig.name
  const seoDescription = siteConfig.description
  const seoUrl = siteConfig.url
  
  // 結構化數據 - 網站主頁
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteConfig.url}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  }
  
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: '首頁', url: siteConfig.url }
  ])

  return (
    <>
      <Head>
        {/* 基本 Meta */}
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={seoUrl} />
        
        {/* Open Graph */}
        <meta property="og:url" content={seoUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:image" content={`${siteConfig.url}/og-image.jpg`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Polygon Guitar - 香港最大結他譜庫" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content={`${siteConfig.url}/og-image.jpg`} />
        
        {/* 結構化數據 JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([websiteSchema, breadcrumbSchema])
          }}
        />
      </Head>
      <Layout fullWidth>
        <div className="min-h-screen bg-black pb-24">
        {/* 搜尋 Bar + Admin 設置 */}
        <div className="px-6 pb-4 flex gap-3">
          <button
            onClick={() => router.push('/search')}
            className="flex-1 flex items-center gap-3 px-4 py-3 bg-[#121212] border border-gray-800 rounded-full text-left hover:border-[#FFD700]/50 transition"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-gray-500">搜尋歌手、歌名...</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => router.push('/admin/home-settings')}
              className="px-4 py-3 bg-[#FFD700] text-black rounded-full font-medium hover:opacity-90 transition"
              title="首頁設置"
            >
              ⚙️
            </button>
          )}
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
                  className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
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

        {/* 第二區：熱門結他譜（最近一個月最多瀏覽） */}
        {hotTabs.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white px-6 py-4">熱門結他譜 🔥</h2>
            <p className="text-sm text-gray-500 px-6 -mt-3 mb-3">過去 30 天最多人瀏覽</p>
            <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
              {hotTabs.map((song) => (
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

        {/* 第四區：熱門男歌手 */}
        {hotArtists.male.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white px-6 py-4">熱門男歌手</h2>
            <div className="flex overflow-x-auto scrollbar-hide px-6 gap-6">
              {hotArtists.male.map((artist) => (
                <button
                  key={artist.id}
                  onClick={() => handleArtistClick(artist)}
                  className="flex-shrink-0 flex flex-col items-center group"
                >
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-gray-800 mb-3 transition-transform duration-300 group-hover:scale-105 shadow-lg">
                    {artist.photoURL || artist.wikiPhotoURL || artist.photo ? (
                      <img 
                        src={artist.photoURL || artist.wikiPhotoURL || artist.photo} 
                        alt={artist.name} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">👨‍🎤</div>
                    )}
                  </div>
                  <span className="text-sm text-gray-300 text-center max-w-[100px] truncate group-hover:text-white transition">
                    {artist.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 第五區：熱門女歌手 */}
        {hotArtists.female.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white px-6 py-4">熱門女歌手</h2>
            <div className="flex overflow-x-auto scrollbar-hide px-6 gap-6">
              {hotArtists.female.map((artist) => (
                <button
                  key={artist.id}
                  onClick={() => handleArtistClick(artist)}
                  className="flex-shrink-0 flex flex-col items-center group"
                >
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-gray-800 mb-3 transition-transform duration-300 group-hover:scale-105 shadow-lg">
                    {artist.photo ? (
                      <img src={artist.photo} alt={artist.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">👩‍🎤</div>
                    )}
                  </div>
                  <span className="text-sm text-gray-300 text-center max-w-[100px] truncate group-hover:text-white transition">
                    {artist.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 第六區：熱門組合 */}
        {hotArtists.group.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white px-6 py-4">熱門組合</h2>
            <div className="flex overflow-x-auto scrollbar-hide px-6 gap-6">
              {hotArtists.group.map((artist) => (
                <button
                  key={artist.id}
                  onClick={() => handleArtistClick(artist)}
                  className="flex-shrink-0 flex flex-col items-center group"
                >
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-gray-800 mb-3 transition-transform duration-300 group-hover:scale-105 shadow-lg">
                    {artist.photo ? (
                      <img src={artist.photo} alt={artist.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">🎸</div>
                    )}
                  </div>
                  <span className="text-sm text-gray-300 text-center max-w-[100px] truncate group-hover:text-white transition">
                    {artist.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 第七區：熱門歌單（數據驅動 - Auto） */}
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

        {/* 第八區：編輯精選（人工策劃 - Manual） */}
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

        {/* 最新上架（移到底部） */}
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
    </>
  )
}

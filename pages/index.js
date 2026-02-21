import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPopularArtists, getHotTabs, getRecentTabs, getCategoryImages, getTabsByIds } from '@/lib/tabs'
import { getAutoPlaylists, getManualPlaylists } from '@/lib/playlists'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import Link from 'next/link'
import Head from 'next/head'
import { siteConfig, generateBreadcrumbSchema } from '@/lib/seo'
import RecentItems from '@/components/RecentItems'

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
    id: 'trending',
    title: '24小時熱門',
    source: 'auto',
    coverImage: null,
    songIds: []
  },
  {
    id: 'weekly',
    title: '7日熱門',
    source: 'auto',
    coverImage: null,
    songIds: []
  },
  {
    id: 'monthly',
    title: '本月熱門',
    source: 'auto',
    coverImage: null,
    songIds: []
  },
  {
    id: 'last-month',
    title: '上月熱門',
    source: 'auto',
    coverImage: null,
    songIds: []
  },
  {
    id: '2025',
    title: '2025年熱門',
    source: 'auto',
    coverImage: null,
    songIds: []
  },
  {
    id: '2024',
    title: '2024年熱門',
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
  const { user, isAdmin } = useAuth()
  const [artists, setArtists] = useState([])
  const [latestSongs, setLatestSongs] = useState([])
  const [hotTabs, setHotTabs] = useState([]) // 最近一個月熱門譜
  const [hotArtists, setHotArtists] = useState({
    male: [],
    female: [],
    group: [],
    all: []
  })
  const [artistPhotoMap, setArtistPhotoMap] = useState({})
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
    displayCount: 20,
    sectionOrder: [
      { id: 'categories', enabled: true },
      { id: 'recent', enabled: true },
      { id: 'hotTabs', enabled: true },
      { id: 'hotArtists', enabled: true },
      { id: 'autoPlaylists', enabled: true },
      { id: 'latest', enabled: true },
      { id: 'manualPlaylists', enabled: true }
    ]
  })
  const [recentItems, setRecentItems] = useState([])

  useEffect(() => {
    loadHomeData()
  }, [user])

  const loadHomeData = async () => {
    setIsLoading(true)
    try {
      // 載入最近瀏覽
      const saved = typeof window !== 'undefined' ? localStorage.getItem('recentViews') : null;
      let items = saved ? JSON.parse(saved).slice(0, 10) : [];
      
      // 如果用戶已登入，添加「我的喜愛」到最前面
      if (user) {
        try {
          // 檢查用戶是否有喜愛的歌曲
          const likedQuery = query(
            collection(db, 'userLikes'),
            where('userId', '==', user.uid),
            limit(1)
          );
          const likedSnapshot = await getDocs(likedQuery);
          
          if (!likedSnapshot.empty) {
            // 用戶有喜愛的歌曲，添加「我的喜愛」項目
            const likedSongsItem = {
              type: 'liked-songs',
              id: 'liked-songs',
              title: '我的喜愛',
              subtitle: '歌單',
              isLikedSongs: true,
              timestamp: new Date().toISOString()
            };
            // 檢查是否已經在列表中
            const exists = items.some(item => item.type === 'liked-songs');
            if (!exists) {
              items = [likedSongsItem, ...items].slice(0, 10);
            }
          }
        } catch (e) {
          console.error('Error checking liked songs:', e);
        }
      }
      
      setRecentItems(items);
      
      // 獲取首頁設置
      let settings = {}
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'home'))
        settings = settingsDoc.exists() ? settingsDoc.data() : {}
        setHomeSettings(prev => ({ ...prev, ...settings }))
      } catch (settingsError) {
        console.error('Error loading home settings:', settingsError)
      }

      // 獲取熱門樂譜（支援手動揀選+自動補充）
      let hotTabsData = []
      const targetCount = settings.hotTabs?.displayCount || 20
      
      if (settings.hotTabs?.useManual && settings.hotTabs?.manualSelection?.length > 0) {
        // 使用手動揀選，並自動補充至指定數量
        const manualIds = settings.hotTabs.manualSelection.map(t => t.id)
        
        // 直接通過 ID 獲取揀選嘅歌曲（唔使靠瀏覽量或時間）
        const manualTabs = await getTabsByIds(manualIds)
        
        // 如果手動揀選唔夠，自動補充熱門歌曲
        if (manualTabs.length < targetCount) {
          const manualIdsSet = new Set(manualIds)
          const hotTabs = await getHotTabs(targetCount + 10) // 獲取多啲用嚟補充
          const autoFill = hotTabs
            .filter(t => !manualIdsSet.has(t.id)) // 排除已揀選嘅
            .slice(0, targetCount - manualTabs.length)
          hotTabsData = [...manualTabs, ...autoFill]
        } else {
          hotTabsData = manualTabs.slice(0, targetCount)
        }
        console.log('Hot tabs (manual + auto-fill):', hotTabsData.length)
      } else {
        // 自動排序：按瀏覽量
        hotTabsData = await getHotTabs(targetCount)
        console.log('Hot tabs (auto):', hotTabsData.length)
      }
      setHotTabs(hotTabsData)

      // 獲取熱門歌手（限制數量，提升性能）
      let popularArtists = await getPopularArtists(60)
      
      // 檢查手動揀選嘅歌手係咪全部喺 popularArtists 入面
      const manualIds = Array.isArray(settings.manualSelection) 
        ? settings.manualSelection 
        : [
            ...(settings.manualSelection?.male || []),
            ...(settings.manualSelection?.female || []),
            ...(settings.manualSelection?.group || [])
          ]
      
      if (manualIds.length > 0) {
        const existingIds = new Set(popularArtists.map(a => a.id))
        const missingIds = manualIds.filter(id => !existingIds.has(id))
        
        if (missingIds.length > 0) {
          // 額外獲取缺少嘅歌手
          const missingArtists = await Promise.all(
            missingIds.map(async (id) => {
              try {
                const artistDoc = await getDoc(doc(db, 'artists', id))
                if (artistDoc.exists()) {
                  const data = artistDoc.data()
                  return {
                    id: artistDoc.id,
                    ...data,
                    photo: data.photoURL || data.wikiPhotoURL || data.photo || null,
                    tabCount: data.songCount || data.tabCount || 0
                  }
                }
              } catch (e) {
                console.error('Error fetching artist:', id, e)
              }
              return null
            })
          )
          
          // 將缺少嘅歌手加入 popularArtists
          popularArtists = [...popularArtists, ...missingArtists.filter(Boolean)]
        }
      }
      
      // 建立歌手照片 lookup（給歌曲封面 fallback 用）
      const photoMap = {}
      popularArtists.forEach(artist => {
        photoMap[artist.id] = artist.photoURL || artist.wikiPhotoURL || artist.photo || null
        // 同時用歌手名作 key（因為 songs 用 artist 欄位）
        if (artist.name) {
          photoMap[artist.name] = artist.photoURL || artist.wikiPhotoURL || artist.photo || null
        }
      })
      setArtistPhotoMap(photoMap)

      // 計算網站總瀏覽量（基於熱門樂譜估算）
      const totalViews = popularArtists.reduce((sum, artist) => sum + (artist.viewCount || 0), 0)
      setTotalViewCount(totalViews)
      
      // 根據設置排序
      const displayCount = settings.displayCount || 20
      const sortBy = settings.hotArtistSortBy || 'viewCount'
      
      // 根據設置排序歌手
      const sortArtists = (artists) => {
        return [...artists].sort((a, b) => {
          if (sortBy === 'tabCount') {
            return (b.songCount || b.tabCount || 0) - (a.songCount || a.tabCount || 0)
          } else if (sortBy === 'adminScore') {
            return (b.adminScore || 0) - (a.adminScore || 0)
          } else if (sortBy === 'mixed') {
            const scoreA = (a.viewCount || 0) * 0.5 +
                          (a.songCount || a.tabCount || 0) * 30 +
                          (a.adminScore || 0) * 200
            const scoreB = (b.viewCount || 0) * 0.5 +
                          (b.songCount || b.tabCount || 0) * 30 +
                          (b.adminScore || 0) * 200
            return scoreB - scoreA
          } else {
            const viewsA = a.viewCount || 0
            const viewsB = b.viewCount || 0
            if (viewsB !== viewsA) return viewsB - viewsA
            const scoreA = a.adminScore || 0
            const scoreB = b.adminScore || 0
            if (scoreB !== scoreA) return scoreB - scoreA
            return (b.songCount || b.tabCount || 0) - (a.songCount || a.tabCount || 0)
          }
        })
      }

      const sortedArtists = sortArtists(popularArtists)
      
      // 熱門歌手（不分類別，綜合排名）
      const getHotArtists = () => {
        // 新版：單一 manualSelection 陣列
        // 舊版兼容：如果是對象格式，合併三個分類
        let manualIds = []
        if (Array.isArray(settings.manualSelection)) {
          manualIds = settings.manualSelection
        } else if (typeof settings.manualSelection === 'object' && settings.manualSelection) {
          // 舊格式兼容
          manualIds = [
            ...(settings.manualSelection?.male || []),
            ...(settings.manualSelection?.female || []),
            ...(settings.manualSelection?.group || [])
          ]
        }
        
        // 檢查是否有手動揀選（新版直接用陣列長度判斷，舊版用 useManualSelection）
        const hasManualSelection = Array.isArray(settings.manualSelection) 
          ? manualIds.length > 0 
          : (settings.useManualSelection?.male || settings.useManualSelection?.female || settings.useManualSelection?.group)

        if (hasManualSelection && manualIds.length > 0) {
          // 使用手動揀選，但從實時數據中獲取最新資料
          const manualArtists = manualIds
            .map(id => popularArtists.find(a => a.id === id))
            .filter(Boolean)

          // 補充自動排序至指定數量
          const manualIdsSet = new Set(manualIds)
          const autoFill = sortedArtists
            .filter(a => !manualIdsSet.has(a.id))
            .slice(0, displayCount - manualArtists.length)

          return [...manualArtists, ...autoFill].slice(0, displayCount)
        } else {
          // 自動排序
          return sortedArtists.slice(0, displayCount)
        }
      }
      
      setHotArtists({
        all: getHotArtists(),
        male: sortedArtists.filter(a => (a.artistType || a.gender) === 'male').slice(0, 5),
        female: sortedArtists.filter(a => (a.artistType || a.gender) === 'female').slice(0, 5),
        group: sortedArtists.filter(a => (a.artistType || a.gender) === 'group').slice(0, 5)
      })
      
      // 保留原來的總熱門歌手（向後兼容）
      setArtists(sortedArtists.slice(0, 10))
      
      // 獲取最新歌曲（限制數量提升性能）
      try {
        const recentTabs = await getRecentTabs(20)
        setLatestSongs(recentTabs)
      } catch (e) {
        console.error('Error setting latest songs:', e)
        setLatestSongs([])
      }
      
      // 熱門譜已於上方獲取，此處保留手動揀選邏輯（如需要）
      // 注意：手動揀選功能需要額外實現支持

      // 獲取自動歌單（熱門歌單區）
      try {
        const auto = await getAutoPlaylists()
        console.log('Auto playlists loaded:', auto?.length || 0)
        setAutoPlaylists(auto?.length > 0 ? auto : FALLBACK_AUTO_PLAYLISTS)
      } catch (e) {
        console.error('Error loading auto playlists:', e)
        setAutoPlaylists(FALLBACK_AUTO_PLAYLISTS)
      }

      // 獲取精選手動歌單（編輯精選區）
      try {
        const manual = await getManualPlaylists(8)
        console.log('Manual playlists loaded:', manual?.length || 0)
        setManualPlaylists(manual?.length > 0 ? manual : FALLBACK_MANUAL_PLAYLISTS)
      } catch (e) {
        console.error('Error loading manual playlists:', e)
        setManualPlaylists(FALLBACK_MANUAL_PLAYLISTS)
      }

      // 獲取自定義分類圖片（使用熱門歌手相片）
      // 注意：呢個係獨立嘅 try-catch，唔會影響其他數據載入
      try {
        console.log('Loading category images...')
        const categoryImages = await getCategoryImages()
        console.log('Category images loaded:', categoryImages)

        if (categoryImages) {
          // 對於有 artistId 嘅分類，實時獲取歌手最新圖片
          const updatedCategories = await Promise.all(
            DEFAULT_CATEGORIES.map(async (cat) => {
              const catData = categoryImages[cat.id]
              let imageUrl = cat.image // 默認圖片

              if (catData) {
                // 如果有 artistId，實時獲取歌手最新圖片
                if (catData.artistId) {
                  try {
                    const artistDoc = await getDoc(doc(db, 'artists', catData.artistId))
                    if (artistDoc.exists()) {
                      const artistData = artistDoc.data()
                      // 按優先順序獲取最新圖片
                      imageUrl = artistData.photoURL || 
                                 artistData.wikiPhotoURL || 
                                 artistData.photo || 
                                 catData.image || // 後備：存儲的圖片
                                 cat.image
                      console.log(`[${cat.name}] 動態獲取歌手圖片:`, artistData.name, imageUrl?.substring(0, 50))
                    } else {
                      // 歌手不存在，使用存儲的圖片
                      imageUrl = catData.image || cat.image
                    }
                  } catch (err) {
                    console.error(`[${cat.name}] 獲取歌手圖片失敗:`, err)
                    imageUrl = catData.image || cat.image
                  }
                } else if (catData.image) {
                  // 沒有 artistId，使用存儲的靜態圖片
                  imageUrl = catData.image
                }
              }

              // 如果是維基百科圖片，添加裁剪參數顯示頭部
              if (imageUrl && imageUrl.includes('wikipedia.org')) {
                imageUrl = getCroppedWikiImage(imageUrl)
              }

              return { ...cat, image: imageUrl }
            })
          )

          setCategories(updatedCategories)
          console.log('Categories updated with dynamic images:', updatedCategories)
        }
      } catch (e) {
        console.error('Error loading category images (non-critical):', e)
        // 唔會影響其他數據，繼續執行
      }
    } catch (error) {
      console.error('Error loading home data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 獲取歌曲/歌單縮圖
  const getThumbnail = (item, artistPhoto = null) => {
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
    // 如果提供了歌手照片，用作 fallback
    if (artistPhoto) {
      return artistPhoto
    }
    // 歌曲自己有 thumbnail
    if (item.thumbnail) {
      return item.thumbnail
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
        {/* Admin 設置按鈕（右上角） */}
        {isAdmin && (
          <div className="px-6 pb-2 flex justify-end">
            <button
              onClick={() => router.push('/admin/home-settings')}
              className="px-3 py-2 bg-[#FFD700] text-black rounded-full font-medium hover:opacity-90 transition text-sm"
              title="首頁設置"
            >
              首頁設置
            </button>
          </div>
        )}

        {/* 根據 sectionOrder 動態渲染各區域 */}
        {(homeSettings.sectionOrder || [
          { id: 'categories', enabled: true },
          { id: 'recent', enabled: true },
          { id: 'hotTabs', enabled: true },
          { id: 'hotArtists', enabled: true },
          { id: 'autoPlaylists', enabled: true },
          { id: 'latest', enabled: true },
          { id: 'manualPlaylists', enabled: true }
        ])
          .filter(section => section.enabled !== false)
          .map((section) => {
            switch (section.id) {
              case 'categories':
                return (
                  <section key={section.id} className="mb-6 pt-2">
                    <div className="flex overflow-x-auto scrollbar-hide px-6 gap-3">
                      {categories.map((category) => (
                        <button
                          key={category.id}
                          onClick={() => handleCategoryClick(category.id)}
                          className="flex-shrink-0 flex flex-col group"
                        >
                          <div className="relative w-[32vw] sm:w-[28vw] md:w-[22vw] lg:w-[18vw] aspect-square rounded-[4px] overflow-hidden">
                            <img
                              src={category.image}
                              alt={category.name}
                              className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute bottom-2 right-0 w-1/2">
                              <span className={`text-black text-[106%] font-bold px-2 py-[0.2px] rounded-none block text-center whitespace-nowrap leading-tight tracking-[0.1em] ${
                                category.id === 'male' ? 'bg-[#1fc3df]' :
                                category.id === 'female' ? 'bg-[#ff9b98]' :
                                'bg-[#fed702]'
                              }`}>
                                {category.name}
                              </span>
                            </div>
                          </div>
                          <div className="w-[32vw] sm:w-[28vw] md:w-[22vw] lg:w-[18vw] mt-2 px-1">
                            <p className="text-xs text-gray-400 truncate text-left leading-relaxed">
                              {hotArtists[category.id]?.slice(0, 5).map(a => a.name).join(' · ')}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )

              case 'recent':
                return <RecentItems key={section.id} items={recentItems} />

              case 'hotTabs':
                return hotTabs.length > 0 && (
                  <section key={section.id} className="mb-10">
                    <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">熱門結他譜</h2>
                    <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
                      {hotTabs.map((song) => (
                        <button
                          key={song.id}
                          onClick={() => handleSongClick(song.id)}
                          className="flex-shrink-0 flex flex-col group text-left w-32"
                        >
                          <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-800 mb-3 transition-transform duration-300 group-hover:scale-105 shadow-lg relative">
                            {getThumbnail(song, artistPhotoMap[song.artistId] || artistPhotoMap[song.artist]) ? (
                              <img
                                src={getThumbnail(song, artistPhotoMap[song.artistId] || artistPhotoMap[song.artist])}
                                alt={song.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-4xl">🎵</div>
                            )}
                          </div>
                          <h3 className="text-sm text-white font-medium truncate group-hover:text-[#FFD700] transition">
                            {song.title}
                          </h3>
                          <p className="text-xs text-gray-500 truncate">{song.artist}</p>
                        </button>
                      ))}
                    </div>
                  </section>
                )

              case 'hotArtists':
                return hotArtists.all?.length > 0 && (
                  <section key={section.id} className="mb-10">
                    <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">熱門歌手</h2>
                    <div className="flex overflow-x-auto scrollbar-hide px-6 gap-6">
                      {hotArtists.all.map((artist) => (
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
                              <div className="w-full h-full flex items-center justify-center text-4xl"></div>
                            )}
                          </div>
                          <span className="text-sm text-gray-300 text-center max-w-[100px] truncate group-hover:text-white transition">
                            {artist.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )

              case 'autoPlaylists':
                return autoPlaylists.length > 0 && (
                  <section key={section.id} className="mb-10">
                    <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">熱門歌單</h2>
                    <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
                      {autoPlaylists.map((playlist) => (
                        <button
                          key={playlist.id}
                          onClick={() => handlePlaylistClick(playlist.id)}
                          className="flex-shrink-0 flex flex-col group text-left w-36"
                        >
                          <div className="relative w-36 h-36 rounded-lg overflow-hidden bg-gradient-to-br from-blue-900/30 to-gray-800 mb-3 transition-transform duration-300 group-hover:scale-105 shadow-lg">
                            {getThumbnail(playlist) ? (
                              <img
                                src={getThumbnail(playlist)}
                                alt={playlist.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-4xl"></div>
                            )}
                          </div>
                          <h3 className="text-base text-white font-medium truncate group-hover:text-[#FFD700] transition">
                            {playlist.title}
                          </h3>
                          {playlist.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {playlist.description}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                )

              case 'latest':
                return latestSongs.length > 0 && (
                  <section key={section.id} className="mb-10">
                    <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">最新上架</h2>
                    <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
                      {latestSongs.map((song) => (
                        <button
                          key={song.id}
                          onClick={() => handleSongClick(song.id)}
                          className="flex-shrink-0 flex flex-col group text-left w-32"
                        >
                          <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-800 mb-3 transition-transform duration-300 group-hover:scale-105 shadow-lg">
                            {getThumbnail(song, artistPhotoMap[song.artistId] || artistPhotoMap[song.artist]) ? (
                              <img
                                src={getThumbnail(song, artistPhotoMap[song.artistId] || artistPhotoMap[song.artist])}
                                alt={song.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-4xl">🎵</div>
                            )}
                          </div>
                          <h3 className="text-sm text-white font-medium truncate group-hover:text-[#FFD700] transition">
                            {song.title}
                          </h3>
                          <p className="text-xs text-gray-500 truncate">{song.artist}</p>
                        </button>
                      ))}
                    </div>
                  </section>
                )

              case 'manualPlaylists':
                return manualPlaylists.length > 0 && (
                  <section key={section.id} className="mb-10">
                    <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">推薦歌單</h2>
                    <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
                      {manualPlaylists.map((playlist) => (
                        <button
                          key={playlist.id}
                          onClick={() => handlePlaylistClick(playlist.id)}
                          className="flex-shrink-0 flex flex-col group text-left w-36"
                        >
                          <div className="relative w-36 h-36 rounded-lg overflow-hidden bg-gradient-to-br from-[#FFD700]/20 to-orange-900/20 mb-3 transition-transform duration-300 group-hover:scale-105 shadow-lg border border-[#FFD700]/20">
                            {getThumbnail(playlist) ? (
                              <img
                                src={getThumbnail(playlist)}
                                alt={playlist.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-4xl"></div>
                            )}
                          </div>
                          <h3 className="text-base text-white font-medium truncate group-hover:text-[#FFD700] transition">
                            {playlist.title}
                          </h3>
                        </button>
                      ))}
                    </div>
                  </section>
                )

              default:
                return null
            }
          })}

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

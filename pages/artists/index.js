import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/router'
import { getAllArtists } from '@/lib/tabs'
import Layout from '@/components/Layout'
import ArtistCard from '@/components/ArtistCard'
import Head from 'next/head'
import { generateBreadcrumbSchema, siteConfig } from '@/lib/seo'

const CATEGORY_LABELS = {
  male: { label: '男歌手' },
  female: { label: '女歌手' },
  group: { label: '組合' },
  soundtrack: { label: '主題曲' },
  other: { label: '其他' }
}

const REGION_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'hongkong', label: '香港' },
  { value: 'taiwan', label: '台灣' },
  { value: 'china', label: '中國' },
  { value: 'foreign', label: '外國' }
]



// 橢圓形 Pill 按鈕組件（設計圖樣式）
function PillButton({ isActive, onClick, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-5 py-2 rounded-full text-sm font-medium transition ${
        isActive
          ? 'bg-[#FFD700] text-black'
          : 'bg-[#282828] text-white hover:bg-[#3E3E3E]'
      }`}
    >
      {label}
    </button>
  )
}

export default function Artists() {
  const router = useRouter()
  const { category } = router.query
  
  const [artists, setArtists] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeRegion, setActiveRegion] = useState('all')
  const [sortBy, setSortBy] = useState('default')
  // 唔再需要使用 showMoreCategories
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const sortDropdownRef = useRef(null)

  // 從 URL 讀取分類參數
  useEffect(() => {
    if (category && ['male', 'female', 'group'].includes(category)) {
      setActiveCategory(category)
    }
  }, [category])

  // 唔再需要 sort dropdown 事件監聽

  useEffect(() => {
    loadArtists()
  }, [])

  // 使用 useMemo 優化排序性能
  const filteredArtists = useMemo(() => {
    let result = [...artists] // 創建新數組避免修改原數據
    
    // 搜尋過濾
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase()
      result = result.filter(artist => 
        artist.name.toLowerCase().includes(query)
      )
    }
    
    // 第一層：類型過濾
    if (activeCategory !== 'all') {
      result = result.filter(artist => {
        const type = artist.artistType || artist.gender || 'other'
        const normalizedType = (type === 'unknown' || type === '') ? 'other' : type
        return normalizedType === activeCategory
      })
    }
    
    // 第二層：地區過濾
    if (activeRegion !== 'all') {
      result = result.filter(artist => artist.region === activeRegion)
    }
    
    // 根據選擇的排序方式排序
    switch (sortBy) {
      case 'songCount': // 樂譜數目 - songCount desc
        result.sort((a, b) => (b.songCount || b.tabCount || 0) - (a.songCount || a.tabCount || 0))
        break
      
      case 'alphabet': // 筆畫/A-Z
        result.sort((a, b) => a.name.localeCompare(b.name, 'zh-HK'))
        break
      
      case 'likes': // 用戶讚好 - likes desc
        result.sort((a, b) => (b.likes || 0) - (a.likes || 0))
        break
      
      case 'spotifyChoice': // Spotify Choice - 按粉絲數排序
        result.sort((a, b) => {
          const followersA = a.spotifyFollowers || 0
          const followersB = b.spotifyFollowers || 0
          // 有粉絲數的優先，然後按數量排序
          if (followersB !== followersA) return followersB - followersA
          // 同分按瀏覽數
          return (b.totalViewCount || b.viewCount || 0) - (a.totalViewCount || a.viewCount || 0)
        })
        break
      
      case 'polygonChoice': // Polygon Choice - 1000分優先
        result.sort((a, b) => {
          const scoreA = a.adminScore || 0
          const scoreB = b.adminScore || 0
          // 1000分優先，然後其他分數
          if (scoreA === 1000 && scoreB !== 1000) return -1
          if (scoreB === 1000 && scoreA !== 1000) return 1
          if (scoreB !== scoreA) return scoreB - scoreA
          // 同分按瀏覽
          return (b.totalViewCount || b.viewCount || 0) - (a.totalViewCount || a.viewCount || 0)
        })
        break
      
      case 'default': // 預設（熱門）
      default:
        result.sort((a, b) => {
          const viewsA = a.totalViewCount || a.viewCount || 0
          const viewsB = b.totalViewCount || b.viewCount || 0
          if (viewsB !== viewsA) return viewsB - viewsA
          return (b.songCount || b.tabCount || 0) - (a.songCount || a.tabCount || 0)
        })
    }
    
    return result
  }, [searchQuery, artists, activeCategory, activeRegion, sortBy])

  const loadArtists = async () => {
    try {
      const data = await getAllArtists()
      setArtists(data)
    } catch (error) {
      console.error('Error loading artists:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 按類型分組歌手
  const groupedByCategory = filteredArtists.reduce((acc, artist) => {
    let type = artist.artistType || artist.gender || 'other'
    // 'unknown' 和 '' 都歸入 'other' 分類
    if (type === 'unknown' || type === '') {
      type = 'other'
    }
    if (!acc[type]) {
      acc[type] = []
    }
    acc[type].push(artist)
    return acc
  }, {})

  // 排序類型：male, female, group, soundtrack, other
  const categoryOrder = ['male', 'female', 'group', 'soundtrack', 'other']
  const sortedCategories = categoryOrder.filter(cat => groupedByCategory[cat]?.length > 0)

  // 統計各類型數量
  const categoryCounts = categoryOrder.reduce((acc, type) => {
    acc[type] = artists.filter(a => {
      let artistType = a.artistType || a.gender || 'other'
      if (artistType === 'unknown' || artistType === '') {
        artistType = 'other'
      }
      return artistType === type
    }).length
    return acc
  }, {})

  // 統計各地區數量
  const regionCounts = REGION_OPTIONS.reduce((acc, region) => {
    if (region.value === 'all') {
      acc[region.value] = artists.length
    } else {
      acc[region.value] = artists.filter(a => a.region === region.value).length
    }
    return acc
  }, {})

  // SEO 配置
  const seoTitle = '歌手分類 - Polygon Guitar'
  const seoDescription = '瀏覽所有歌手的結他譜，按男歌手、女歌手、組合、地區分類。Polygon Guitar 提供超過 3000 份香港廣東歌、國語歌結他譜。'
  const seoUrl = `${siteConfig.url}/artists`
  
  // 結構化數據
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: '首頁', url: siteConfig.url },
    { name: '歌手', url: seoUrl }
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
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content={`${siteConfig.url}/og-image.jpg`} />
        
        {/* 結構化數據 JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([breadcrumbSchema])
          }}
        />
      </Head>
      <Layout>
        <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-bold text-white mb-2">
            歌手分類
          </h1>
          <p className="text-[#B3B3B3]">
            按歌手類型瀏覽結他譜
          </p>
        </div>

        {/* Search - 白色搜尋框 */}
        <div className="px-4 -mx-4">
          <div className="relative">
            <input
              type="text"
              placeholder="搜尋歌手..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white rounded-xl text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
            />
            <svg 
              className="absolute left-4 top-3.5 w-5 h-5 text-gray-500"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* 兩行橢圓形篩選按鈕 */}
        <div className="space-y-3">
          
          {/* 第一行：類型篩選 */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <PillButton
              isActive={activeCategory === 'all'}
              onClick={() => setActiveCategory('all')}
              label="全部"
            />
            {['male', 'female', 'group', 'soundtrack', 'other'].map(type => (
              <PillButton
                key={type}
                isActive={activeCategory === type}
                onClick={() => setActiveCategory(type)}
                label={CATEGORY_LABELS[type].label}
              />
            ))}
          </div>
          
          {/* 第二行：地區篩選 */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {REGION_OPTIONS.map(region => (
              <PillButton
                key={region.value}
                isActive={activeRegion === region.value}
                onClick={() => setActiveRegion(region.value)}
                label={region.label}
              />
            ))}
          </div>
        </div>
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-1 text-[#888] hover:text-white text-sm px-3 py-1.5 rounded-lg transition"
              >
                <span>排序</span>
                <svg 
                  className={`w-4 h-4 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Dropdown Menu */}
              {showSortDropdown && (
                <div className="absolute right-0 top-full mt-1 w-[180px] bg-[#121212] border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                  {SORT_OPTIONS.map((option, index) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        if (!option.disabled) {
                          setSortBy(option.value)
                          setShowSortDropdown(false)
                        }
                      }}
                      disabled={option.disabled}
                      className={`
                        w-full text-left px-4 py-2.5 text-sm transition
                        ${option.disabled 
                          ? 'text-gray-600 cursor-not-allowed bg-[#0a0a0a]' 
                          : sortBy === option.value
                            ? 'text-[#FFD700] bg-[#1a1a1a]'
                            : 'text-white hover:bg-[#1a1a1a]'
                        }
                        ${index !== SORT_OPTIONS.length - 1 ? 'border-b border-gray-800' : ''}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span>{option.label}</span>
                        {sortBy === option.value && !option.disabled && (
                          <svg className="w-4 h-4 text-[#FFD700]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Artists List */}
        {isLoading ? (
          <div className="grid grid-cols-4 gap-3">
            {[...Array(16)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-[#282828] rounded-full mb-2"></div>
                <div className="h-4 bg-[#282828] rounded w-full mx-auto"></div>
              </div>
            ))}
          </div>
        ) : filteredArtists.length > 0 ? (
          <div className="space-y-8">
            {sortedCategories.map(category => (
              <div key={category}>
                <h2 className="text-xl font-bold text-white mb-4">
                  {CATEGORY_LABELS[category].label}
                </h2>
                {/* 歌手卡片網格：每行4個 */}
                <div className="grid grid-cols-4 gap-3">
                  {groupedByCategory[category].map(artist => (
                    <ArtistCard 
                      key={artist.id} 
                      artist={artist} 
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-[#121212] rounded-xl shadow-md border border-gray-800">
            <span className="text-4xl mb-4 block"></span>
            <h3 className="text-lg font-medium text-white mb-2">
              暫時冇歌手
            </h3>
            <p className="text-[#B3B3B3]">
              {searchQuery ? '試下其他關鍵字' : '上傳第一個譜就會自動建立歌手分類'}
            </p>
          </div>
        )}
      </div>
    </Layout>
    </>
  )
}

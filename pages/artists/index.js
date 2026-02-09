import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/router'
import { getAllArtists } from '@/lib/tabs'
import Layout from '@/components/Layout'
import ArtistCard from '@/components/ArtistCard'
import Head from 'next/head'
import { generateBreadcrumbSchema, siteConfig } from '@/lib/seo'

const CATEGORY_LABELS = {
  male: { label: '男歌手', emoji: '👨‍🎤' },
  female: { label: '女歌手', emoji: '👩‍🎤' },
  group: { label: '組合', emoji: '🎸' },
  soundtrack: { label: '劇集電影動漫', emoji: '🎬' },
  other: { label: '其他', emoji: '🎵' }
}

const REGION_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'hongkong', label: '香港' },
  { value: 'taiwan', label: '台灣' },
  { value: 'china', label: '中國' },
  { value: 'foreign', label: '外國' }
]

// 排序選項
const SORT_OPTIONS = [
  { value: 'default', label: '預設（熱門）' },
  { value: 'polygonChoice', label: 'Polygon Choice' },
  { value: 'likes', label: '用戶讚好' },
  { value: 'songCount', label: '樂譜數目' },
  { value: 'alphabet', label: '筆畫 / A-Z' }
]

// 垂直排列的分類 Tab 組件
function CategoryTab({ isActive, onClick, emoji, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[64px] py-2 px-2 rounded-xl transition ${
        isActive
          ? 'bg-[#FFD700] text-black'
          : 'bg-[#121212] text-gray-300 border border-gray-700 hover:border-[#FFD700]'
      }`}
    >
      {emoji && <span className="text-lg leading-none mb-1">{emoji}</span>}
      <span className={`text-xs font-medium leading-tight ${isActive ? 'text-black' : 'text-white'}`}>
        {label}
      </span>
      <span className={`text-[10px] leading-tight ${isActive ? 'text-black/70' : 'text-gray-500'}`}>
        ({count})
      </span>
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
  const [showMoreCategories, setShowMoreCategories] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const sortDropdownRef = useRef(null)

  // 從 URL 讀取分類參數
  useEffect(() => {
    if (category && ['male', 'female', 'group'].includes(category)) {
      setActiveCategory(category)
    }
  }, [category])

  // 點擊外部關閉 sort dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showSortDropdown &&
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(event.target)
      ) {
        setShowSortDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSortDropdown])

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

        {/* Search */}
        <div className="max-w-md">
          <div className="relative">
            <input
              type="text"
              placeholder="搜尋歌手..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[#121212] border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
            />
            <svg 
              className="absolute left-3 top-3.5 w-5 h-5 text-[#B3B3B3]"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* 兩層篩選：第一層類型 + 第二層地區 */}
        <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md -mx-4 px-4 py-3 border-b border-gray-800 space-y-3">
          
          {/* 第一層：類型 - 垂直排列 + 摺疊設計 */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide sm:overflow-visible pb-1 sm:pb-0">
            {/* 全部 Tab */}
            <CategoryTab
              isActive={activeCategory === 'all'}
              onClick={() => setActiveCategory('all')}
              emoji=""
              label="全部"
              count={categoryCounts['all'] || artists.length}
            />
            
            {/* 常駐分類：男歌手、女歌手、組合 */}
            {['male', 'female', 'group'].map(type => (
              <CategoryTab
                key={type}
                isActive={activeCategory === type}
                onClick={() => setActiveCategory(type)}
                emoji={CATEGORY_LABELS[type].emoji}
                label={CATEGORY_LABELS[type].label}
                count={categoryCounts[type]}
              />
            ))}
            
            {/* 桌面版：直接顯示剩餘分類 */}
            <div className="hidden sm:flex gap-2">
              {['soundtrack', 'other'].map(type => (
                <CategoryTab
                  key={type}
                  isActive={activeCategory === type}
                  onClick={() => setActiveCategory(type)}
                  emoji={CATEGORY_LABELS[type].emoji}
                  label={CATEGORY_LABELS[type].label}
                  count={categoryCounts[type]}
                />
              ))}
            </div>
            
            {/* 手機版：⋯ 展開按鈕 */}
            <div className="sm:hidden">
              <button
                onClick={() => setShowMoreCategories(!showMoreCategories)}
                className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[56px] py-2 px-3 rounded-xl transition ${
                  ['soundtrack', 'other'].includes(activeCategory) && !showMoreCategories
                    ? 'bg-[#FFD700] text-black'
                    : 'bg-[#121212] text-gray-300 border border-gray-700 hover:border-[#FFD700]'
                }`}
              >
                <span className="text-lg">{showMoreCategories ? '✕' : '⋯'}</span>
              </button>
            </div>
          </div>
          
          {/* 手機版：展開的額外分類（在下一行） */}
          {showMoreCategories && (
            <div className="sm:hidden flex gap-2 mt-2 overflow-x-auto scrollbar-hide">
              {['soundtrack', 'other'].map(type => (
                <CategoryTab
                  key={type}
                  isActive={activeCategory === type}
                  onClick={() => {
                    setActiveCategory(type)
                    setShowMoreCategories(false)
                  }}
                  emoji={CATEGORY_LABELS[type].emoji}
                  label={CATEGORY_LABELS[type].label}
                  count={categoryCounts[type]}
                />
              ))}
            </div>
          )}
          
          {/* 第二層：地區 + 排序 */}
          <div className="flex items-center justify-between border-t border-gray-800 pt-3">
            {/* 地區篩選 */}
            <div className="flex gap-1 overflow-x-auto scrollbar-hide flex-1">
              {REGION_OPTIONS.map(region => (
                <button
                  key={region.value}
                  onClick={() => setActiveRegion(region.value)}
                  className={`flex-shrink-0 px-3 py-1.5 text-sm rounded-lg transition ${
                    activeRegion === region.value
                      ? 'bg-[#FFD700] text-black font-medium'
                      : 'text-[#888] hover:text-white'
                  }`}
                >
                  {region.label}
                  <span className={`ml-1 text-xs ${activeRegion === region.value ? 'text-black/60' : 'text-gray-600'}`}>
                    ({regionCounts[region.value]})
                  </span>
                </button>
              ))}
            </div>
            
            {/* 排序 Dropdown */}
            <div className="relative ml-2" ref={sortDropdownRef}>
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
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
            {[...Array(16)].map((_, i) => (
              <div key={i} className="bg-[#121212] rounded-[10px] p-[8px_6px] animate-pulse">
                <div className="aspect-[1/1.2] bg-gray-800 rounded-md mb-2"></div>
                <div className="h-3 bg-gray-800 rounded w-full mb-1.5"></div>
                <div className="h-3 bg-gray-800 rounded w-1/2 mx-auto"></div>
              </div>
            ))}
          </div>
        ) : filteredArtists.length > 0 ? (
          <div className="space-y-8">
            {sortedCategories.map(category => (
              <div key={category}>
                <h2 className="text-xl font-bold text-[#FFD700] mb-4 pb-2 border-b border-gray-800 flex items-center gap-2">
                  <span>{CATEGORY_LABELS[category].emoji}</span>
                  <span>{CATEGORY_LABELS[category].label}</span>
                  <span className="text-sm text-gray-500 font-normal">
                    ({groupedByCategory[category].length})
                  </span>
                </h2>
                {/* 歌手卡片網格：手機4個/平板6個/桌面8個 */}
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
                  {groupedByCategory[category].map(artist => (
                    <ArtistCard 
                      key={artist.id} 
                      artist={artist} 
                      category={category}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-[#121212] rounded-xl shadow-md border border-gray-800">
            <span className="text-4xl mb-4 block">🎤</span>
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

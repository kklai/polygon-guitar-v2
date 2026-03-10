import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '@/components/Layout'
import Head from 'next/head'
import { getSearchData } from '@/lib/searchData'
import { generateBreadcrumbSchema, siteConfig } from '@/lib/seo'

const ARTISTS_CACHE_KEY = 'pg_artists_list'
const ARTISTS_CACHE_TTL = 10 * 60 * 1000 // 10 min
const ARTISTS_CACHE_FRESH = 2 * 60 * 1000 // 2 min = skip fetch

function saveArtistsCache(data) {
  try {
    localStorage.setItem(ARTISTS_CACHE_KEY, JSON.stringify({ _ts: Date.now(), artists: data }))
  } catch (e) { /* quota exceeded */ }
}

function loadArtistsCache() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(ARTISTS_CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Date.now() - data._ts > ARTISTS_CACHE_TTL) return null
    return { artists: data.artists, fresh: (Date.now() - data._ts) < ARTISTS_CACHE_FRESH }
  } catch (e) { return null }
}

const CATEGORY_LABELS = {
  male: { label: '男歌手', color: '#1fc3df' },
  female: { label: '女歌手', color: '#ff9b98' },
  group: { label: '組合', color: '#fed702' },
  soundtrack: { label: '主題曲', color: '#b388ff' },
  other: { label: '其他', color: '#888888' }
}

const REGION_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'hongkong', label: '香港' },
  { value: 'taiwan', label: '台灣' },
  { value: 'china', label: '中國' },
  { value: 'asia', label: '亞洲' },
  { value: 'foreign', label: '外國' }
]

// 橢圓形 Pill 按鈕組件
function PillButton({ isActive, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-[72px] py-2 rounded-full text-sm font-normal transition ${
        isActive
          ? 'bg-[#FFD700] text-black'
          : 'bg-[#282828] text-white hover:bg-[#3E3E3E]'
      }`}
    >
      {label}
    </button>
  )
}

// 歌手卡片組件（圓形大頭）
function ArtistCircle({ artist, href }) {
  const photoUrl = artist.photoURL || artist.wikiPhotoURL || artist.photo
  
  return (
    <Link 
      href={href}
      className="flex-shrink-0 w-[100px] cursor-pointer select-none touch-manipulation"
    >
      <div className="aspect-square rounded-full overflow-hidden bg-[#282828] mb-2 transition-transform duration-200 active:scale-105 active:z-20">
        {photoUrl ? (
          <img 
            src={photoUrl} 
            alt={artist.name}
            className="w-full h-full object-cover pointer-events-none select-none"
            draggable="false"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">
            🎤
          </div>
        )}
      </div>
      <p className="text-white text-xs text-center truncate">
        {artist.name}
      </p>
    </Link>
  )
}

// 排序：與後台 artists-sort 一致 — Tier → displayOrder → 譜數
const DEFAULT_TIER = 5
const ORDER_LAST = 999999
function distributeToColumns(artists) {
  const sorted = [...artists].sort((a, b) => {
    const ta = a.tier ?? DEFAULT_TIER
    const tb = b.tier ?? DEFAULT_TIER
    if (ta !== tb) return ta - tb
    const oa = a.displayOrder ?? ORDER_LAST
    const ob = b.displayOrder ?? ORDER_LAST
    if (oa !== ob) return oa - ob
    const ca = a.tabCount ?? 0
    const cb = b.tabCount ?? 0
    if (cb !== ca) return cb - ca
    return (a.name || '').localeCompare(b.name || '')
  })
  
  // 每3個一組：[1,2,3], [4,5,6], [7,8,9]...
  const columns = []
  for (let i = 0; i < sorted.length; i += 3) {
    columns.push(sorted.slice(i, i + 3))
  }
  
  return columns
}

// 橫向滾動區域組件（3行一齊滾動）
function HorizontalScrollSection({ title, color, artists, onArtistClick }) {
  const columns = useMemo(() => distributeToColumns(artists), [artists])
  
  if (artists.length === 0) return null
  
  return (
    <div className="mb-8">
      {/* 標題 */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="w-1 h-6 rounded-full" style={{ backgroundColor: color }}></div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <span className="text-sm text-gray-500">({artists.length})</span>
      </div>
      
      {/* 3行一齊橫向滾動 */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
          {columns.map((column, colIndex) => (
            <div key={colIndex} className="flex flex-col gap-4">
              {column.map(artist => (
                <ArtistCircle 
                  key={artist.id} 
                  artist={artist} 
                  href={`/artists/${artist.id}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Artists({ initialArtists = [] }) {
  const router = useRouter()
  const { category } = router.query
  
  const [artists, setArtists] = useState(initialArtists)
  const [isLoading, setIsLoading] = useState(!initialArtists?.length)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeRegion, setActiveRegion] = useState('all')

  // 從 URL 讀取分類參數
  useEffect(() => {
    if (category && ['male', 'female', 'group'].includes(category)) {
      setActiveCategory(category)
    }
  }, [category])

  useEffect(() => {
    if (initialArtists?.length) {
      setArtists(initialArtists)
      setIsLoading(false)
      return
    }
    const cached = loadArtistsCache()
    if (cached) {
      setArtists(cached.artists)
      setIsLoading(false)
      if (cached.fresh) {
        console.log('[Artists] Using fresh localStorage cache, skipping fetch')
        return
      }
      console.log('[Artists] Cache stale, refreshing in background')
    }
    loadArtists()
  }, [initialArtists])

  const loadArtists = async () => {
    const t0 = performance.now()
    try {
      let url = '/api/search-data?only=artists'
      const bust = localStorage.getItem('pg_artists_bust')
      if (bust) {
        url += `&bust=${bust}`
        localStorage.removeItem('pg_artists_bust')
      }
      const res = await fetch(url)
      const data = await res.json()
      const list = data?.artists ?? []
      console.log('[Artists] search-data API took', Math.round(performance.now() - t0), 'ms, got', list.length, 'artists')
      setArtists(list)
      saveArtistsCache(list)
    } catch (error) {
      console.error('Error loading artists:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 過濾歌手
  const filteredArtists = useMemo(() => {
    let result = [...artists]
    
    // 搜尋過濾
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase()
      result = result.filter(artist => 
        artist.name.toLowerCase().includes(query)
      )
    }
    
    // 類型過濾
    if (activeCategory !== 'all') {
      result = result.filter(artist => {
        const type = artist.artistType || artist.gender || 'other'
        const normalizedType = (type === 'unknown' || type === '') ? 'other' : type
        return normalizedType === activeCategory
      })
    }
    
    // 地區過濾（支援單一地區或多地區陣列）
    if (activeRegion !== 'all') {
      result = result.filter(artist => {
        const regions = artist.regions || (artist.region ? [artist.region] : [])
        return regions.includes(activeRegion)
      })
    }
    
    return result
  }, [searchQuery, artists, activeCategory, activeRegion])

  // 按類型分組
  const groupedByCategory = useMemo(() => {
    const groups = { male: [], female: [], group: [], soundtrack: [], other: [] }
    
    filteredArtists.forEach(artist => {
      // 標準化類型值
      let rawType = artist.artistType || artist.gender || 'other'
      let type = String(rawType).toLowerCase().trim()
      
      // 處理 unknown/空值
      if (type === 'unknown' || type === '' || type === 'null' || type === 'undefined') {
        type = 'other'
      }
      
      // 確保類型有效
      if (!groups[type]) {
        type = 'other'
      }
      
      groups[type].push(artist)
    })
    
    // Debug log (開發時用)
    if (typeof window !== 'undefined' && activeCategory === 'all') {
      console.log('Artists grouping:', {
        male: groups.male.length,
        female: groups.female.length,
        group: groups.group.length,
        other: groups.other.length,
        total: filteredArtists.length
      })
    }
    
    return groups
  }, [filteredArtists, activeCategory])

  const handleArtistClick = (artistId) => {
    router.push(`/artists/${artistId}`)
  }

  // SEO 配置
  const seoTitle = '歌手分類 - Polygon Guitar'
  const seoDescription = '瀏覽所有歌手的結他譜，按男歌手、女歌手、組合分類。Polygon Guitar 提供超過 3000 份香港廣東歌、國語歌結他譜。'
  const seoUrl = `${siteConfig.url}/artists`
  
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: '首頁', url: siteConfig.url },
    { name: '歌手', url: seoUrl }
  ])

  return (
    <>
      <Head>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={seoUrl} />
        <meta property="og:url" content={seoUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:image" content={`${siteConfig.url}/og-image.jpg`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content={`${siteConfig.url}/og-image.jpg`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([breadcrumbSchema])
          }}
        />
      </Head>
      <Layout fullWidth>
        <div 
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 space-y-6" 
          style={{ paddingTop: '24px' }}
        >
          {/* Search */}
          <div className="px-4 -mx-4">
            <div className="relative">
              <input
                type="text"
                placeholder="搜尋歌手..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-[#282828] rounded-full text-white placeholder-[#666] outline-none"
              />
              <svg 
                className="absolute left-4 top-3.5 w-5 h-5 text-[#666]"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* 篩選按鈕 */}
          <div className="space-y-3">
            {/* 第一行：類型篩選 */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
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

          {/* Artists List */}
          {isLoading ? (
            <div className="space-y-8">
              {[1, 2, 3].map(section => (
                <div key={section}>
                  <div className="h-6 bg-[#282828] rounded w-24 mb-4"></div>
                  <div className="space-y-4">
                    {[1, 2, 3].map(row => (
                      <div key={row} className="flex gap-4">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="w-[100px] flex-shrink-0">
                            <div className="aspect-square bg-[#282828] rounded-full mb-2"></div>
                            <div className="h-3 bg-[#282828] rounded w-20 mx-auto"></div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : filteredArtists.length > 0 ? (
            <div>
              {activeCategory === 'all' ? (
                // 「全部」模式：分類區域，每類3行橫滾
                <>
                  <HorizontalScrollSection 
                    title={CATEGORY_LABELS.male.label}
                    color={CATEGORY_LABELS.male.color}
                    artists={groupedByCategory.male}
                    onArtistClick={handleArtistClick}
                  />
                  <HorizontalScrollSection 
                    title={CATEGORY_LABELS.female.label}
                    color={CATEGORY_LABELS.female.color}
                    artists={groupedByCategory.female}
                    onArtistClick={handleArtistClick}
                  />
                  <HorizontalScrollSection 
                    title={CATEGORY_LABELS.group.label}
                    color={CATEGORY_LABELS.group.color}
                    artists={groupedByCategory.group}
                    onArtistClick={handleArtistClick}
                  />
                  {groupedByCategory.soundtrack.length > 0 && (
                    <HorizontalScrollSection 
                      title={CATEGORY_LABELS.soundtrack.label}
                      color={CATEGORY_LABELS.soundtrack.color}
                      artists={groupedByCategory.soundtrack}
                      onArtistClick={handleArtistClick}
                    />
                  )}
                  {groupedByCategory.other.length > 0 && (
                    <HorizontalScrollSection 
                      title={CATEGORY_LABELS.other.label}
                      color={CATEGORY_LABELS.other.color}
                      artists={groupedByCategory.other}
                      onArtistClick={handleArtistClick}
                    />
                  )}
                </>
              ) : (
                // 單一分類模式：保持同樣嘅橫滾佈局
                <HorizontalScrollSection 
                  title={CATEGORY_LABELS[activeCategory]?.label || '歌手'}
                  color={CATEGORY_LABELS[activeCategory]?.color || '#888888'}
                  artists={filteredArtists}
                  onArtistClick={handleArtistClick}
                />
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-[#121212] rounded-xl border border-gray-800">
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

// ISR: use search-data cache (1 read when fresh) so artist list shares same source as search
export async function getStaticProps() {
  try {
    const data = await getSearchData()
    const initialArtists = data?.artists ?? []
    return { props: { initialArtists }, revalidate: 300 }
  } catch (e) {
    console.error('[Artists] getStaticProps:', e?.message)
    return { props: { initialArtists: [] }, revalidate: 60 }
  }
}

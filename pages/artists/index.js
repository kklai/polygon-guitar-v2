import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { getAllArtists } from '@/lib/tabs'
import Layout from '@/components/Layout'

const CATEGORY_LABELS = {
  male: { label: '男歌手', emoji: '👨‍🎤' },
  female: { label: '女歌手', emoji: '👩‍🎤' },
  group: { label: '組合', emoji: '🎸' },
  other: { label: '其他', emoji: '🎵' }
}

export default function Artists() {
  const router = useRouter()
  const { category } = router.query
  
  const [artists, setArtists] = useState([])
  const [filteredArtists, setFilteredArtists] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  // 從 URL 讀取分類參數
  useEffect(() => {
    if (category && ['male', 'female', 'group'].includes(category)) {
      setActiveCategory(category)
    }
  }, [category])

  useEffect(() => {
    loadArtists()
  }, [])

  useEffect(() => {
    let result = artists
    
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
        const type = artist.artistType || 'other'
        return type === activeCategory
      })
    }
    
    setFilteredArtists(result)
  }, [searchQuery, artists, activeCategory])

  const loadArtists = async () => {
    try {
      const data = await getAllArtists()
      setArtists(data)
      setFilteredArtists(data)
    } catch (error) {
      console.error('Error loading artists:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 按類型分組歌手
  const groupedByCategory = filteredArtists.reduce((acc, artist) => {
    const type = artist.artistType || 'other'
    if (!acc[type]) {
      acc[type] = []
    }
    acc[type].push(artist)
    return acc
  }, {})

  // 排序類型：male, female, group, other
  const categoryOrder = ['male', 'female', 'group', 'other']
  const sortedCategories = categoryOrder.filter(cat => groupedByCategory[cat]?.length > 0)

  // 統計各類型數量
  const categoryCounts = categoryOrder.reduce((acc, type) => {
    acc[type] = artists.filter(a => (a.artistType || 'other') === type).length
    return acc
  }, {})

  return (
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

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              activeCategory === 'all'
                ? 'bg-[#FFD700] text-black'
                : 'bg-[#121212] text-gray-300 border border-gray-700 hover:border-[#FFD700]'
            }`}
          >
            全部 ({artists.length})
          </button>
          {categoryOrder.map(type => (
            <button
              key={type}
              onClick={() => setActiveCategory(type)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                activeCategory === type
                  ? 'bg-[#FFD700] text-black'
                  : 'bg-[#121212] text-gray-300 border border-gray-700 hover:border-[#FFD700]'
              }`}
            >
              {CATEGORY_LABELS[type].emoji} {CATEGORY_LABELS[type].label} ({categoryCounts[type]})
            </button>
          ))}
        </div>

        {/* Results count */}
        <p className="text-[#B3B3B3]">
          顯示 {filteredArtists.length} 位歌手
        </p>

        {/* Artists List */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-[#121212] rounded-lg shadow p-4 animate-pulse border border-gray-800">
                <div className="h-5 bg-gray-800 rounded w-3/4"></div>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {groupedByCategory[category]
                    .sort((a, b) => a.name.localeCompare(b.name, 'zh-HK'))
                    .map(artist => (
                      <Link
                        key={artist.id}
                        href={`/songs/${artist.normalizedName}`}
                        className="bg-[#121212] rounded-lg shadow hover:shadow-lg transition-all p-4 flex items-center space-x-3 group border border-gray-800 hover:border-[#FFD700]"
                      >
                        {artist.photo ? (
                          <img 
                            src={artist.photo} 
                            alt={artist.name}
                            className="w-10 h-10 rounded-full object-cover border border-gray-700 group-hover:border-[#FFD700] transition"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700 group-hover:border-[#FFD700] transition">
                            <span className="text-lg">{CATEGORY_LABELS[category].emoji}</span>
                          </div>
                        )}
                        <div className="flex-grow min-w-0">
                          <span className="font-medium text-white group-hover:text-[#FFD700] transition block truncate">
                            {artist.name}
                          </span>
                        </div>
                        <span className="text-sm text-[#B3B3B3] bg-black px-2 py-1 rounded-full flex-shrink-0">
                          {artist.tabCount || 0}
                        </span>
                      </Link>
                    ))
                  }
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
  )
}

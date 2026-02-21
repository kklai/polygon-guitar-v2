import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { getAllTabs, getAllArtists, getHotTabs, getPopularArtists, getRecentTabs } from '@/lib/tabs'
import Layout from '@/components/Layout'

export default function Search() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [songs, setSongs] = useState([])
  const [artists, setArtists] = useState([])
  const [filteredSongs, setFilteredSongs] = useState([])
  const [filteredArtists, setFilteredArtists] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  
  // 熱門數據
  const [hotSongs, setHotSongs] = useState([])
  const [hotArtists, setHotArtists] = useState([])
  const [categoryCovers, setCategoryCovers] = useState({
    male: null,
    female: null,
    group: null,
    recent: null
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredSongs([])
      setFilteredArtists([])
      return
    }

    const query = searchQuery.toLowerCase()
    
    setFilteredSongs(
      songs.filter(song => 
        song.title.toLowerCase().includes(query) ||
        song.artist.toLowerCase().includes(query) ||
        (song.composer && song.composer.toLowerCase().includes(query)) ||
        (song.lyricist && song.lyricist.toLowerCase().includes(query)) ||
        (song.arranger && song.arranger.toLowerCase().includes(query)) ||
        (song.arrangedBy && song.arrangedBy.toLowerCase().includes(query))
      )
      // 完全冇限制，顯示所有結果
    )
    
    setFilteredArtists(
      artists.filter(artist => 
        artist.name.toLowerCase().includes(query)
      )
      // 完全冇限制，顯示所有結果
    )
  }, [searchQuery, songs, artists])

  const loadData = async () => {
    try {
      // 載入所有數據
      const [songsData, artistsData] = await Promise.all([
        getAllTabs(),
        getAllArtists()
      ])
      setSongs(songsData)
      setArtists(artistsData)
      
      // 載入熱門數據
      const [hotSongsData, hotArtistsData, recentSongsData] = await Promise.all([
        getHotTabs(12),
        getPopularArtists(12),
        getRecentTabs(4)
      ])
      
      setHotSongs(hotSongsData)
      setHotArtists(hotArtistsData)
      
      // 找分類封面圖（按 adminScore 評分排序）
      const maleArtists = artistsData.filter(a => 
        a.artistType === 'male' || a.gender === 'male'
      ).sort((a, b) => (b.adminScore || 0) - (a.adminScore || 0))
      
      const femaleArtists = artistsData.filter(a => 
        a.artistType === 'female' || a.gender === 'female'
      ).sort((a, b) => (b.adminScore || 0) - (a.adminScore || 0))
      
      const groupArtists = artistsData.filter(a => 
        a.artistType === 'group' || a.gender === 'group' ||
        a.artistType === 'band' || a.gender === 'band'
      ).sort((a, b) => (b.adminScore || 0) - (a.adminScore || 0))
      
      // 最新上架用男歌手評分第二高的
      const secondMaleArtist = maleArtists[1] || maleArtists[0] || null
      
      setCategoryCovers({
        male: maleArtists[0] || null,
        female: femaleArtists[0] || null,
        group: groupArtists[0] || null,
        recent: secondMaleArtist
      })
      
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSongClick = (songId) => {
    router.push(`/tabs/${songId}`)
  }

  const handleArtistClick = (artist) => {
    const slug = artist.normalizedName || artist.id
    router.push(`/artists/${slug}`)
  }
  
  const handleCategoryClick = (category) => {
    if (category === 'latest') {
      router.push('/')
    } else {
      router.push(`/artists?category=${category}`)
    }
  }

  // 熱門搜尋建議
  const popularSearches = ['陳奕迅', '張敬軒', 'Dear Jane', '方皓玟', '姜濤', '柳應廷']

  // 分類卡片數據
  const categories = [
    { 
      id: 'male', 
      name: '男歌手', 
      color: '#1E90FF',
      gradient: 'from-[#1E90FF] to-[#0066CC]'
    },
    { 
      id: 'female', 
      name: '女歌手', 
      color: '#FF6B9D',
      gradient: 'from-[#FF6B9D] to-[#D63384]'
    },
    { 
      id: 'group', 
      name: '組合', 
      color: '#8B4513',
      gradient: 'from-[#A0522D] to-[#8B4513]'
    },
    { 
      id: 'latest', 
      name: '最新上架', 
      color: '#2E8B57',
      gradient: 'from-[#3CB371] to-[#2E8B57]'
    }
  ]

  // 獲取歌手照片
  const getArtistPhoto = (artist) => {
    return artist?.photoURL || artist?.wikiPhotoURL || artist?.photo || null
  }

  return (
    <Layout>
      <div className="min-h-screen bg-black pb-24">
        {/* Header */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            {/* 用戶頭像 placeholder */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-black font-bold text-sm">
              你
            </div>
            <h1 className="text-2xl font-bold text-white">搜尋</h1>
          </div>
          
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="想彈咩歌？"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border-0 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#FFD700] transition text-base"
              autoFocus
            />
            <svg 
              className="absolute left-4 top-4 w-6 h-6 text-gray-500"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Search Results */}
        {searchQuery.trim() !== '' ? (
          <div className="px-4 space-y-6">
            {/* Artists Results */}
            {filteredArtists.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-white mb-4">歌手</h2>
                <div className="flex overflow-x-auto scrollbar-hide gap-4">
                  {filteredArtists.map((artist) => (
                    <button
                      key={artist.id}
                      onClick={() => handleArtistClick(artist)}
                      className="flex-shrink-0 flex flex-col items-center group"
                    >
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-800 mb-2 transition-transform group-hover:scale-105">
                        {getArtistPhoto(artist) ? (
                          <img
                            src={getArtistPhoto(artist)}
                            alt={artist.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            🎤
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-gray-300 group-hover:text-white transition">
                        {artist.name}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Songs Results */}
            {filteredSongs.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-white mb-4">歌曲</h2>
                <div className="space-y-2">
                  {filteredSongs.map((song, index) => (
                    <button
                      key={song.id}
                      onClick={() => handleSongClick(song.id)}
                      className="w-full flex items-center gap-4 p-3 hover:bg-white/10 rounded-lg transition group"
                    >
                      <span className="text-gray-500 w-6 text-center">{index + 1}</span>
                      <div className="w-12 h-12 rounded bg-gray-800 flex items-center justify-center text-xl overflow-hidden">
                        {song.youtubeVideoId ? (
                          <img
                            src={`https://img.youtube.com/vi/${song.youtubeVideoId}/default.jpg`}
                            alt={song.title}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          '🎵'
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-white font-medium group-hover:text-[#FFD700] transition">
                          {song.title}
                        </h3>
                        <p className="text-sm text-gray-500">{song.artist}</p>
                        {(song.composer || song.lyricist || song.arranger) && (
                          <p className="text-xs text-gray-600 mt-0.5">
                            {song.composer && <span>曲：{song.composer} </span>}
                            {song.lyricist && <span>詞：{song.lyricist} </span>}
                            {song.arranger && <span>編：{song.arranger}</span>}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-600">{song.originalKey || 'C'}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* No Results */}
            {filteredSongs.length === 0 && filteredArtists.length === 0 && (
              <div className="text-center py-12">
                <span className="text-4xl mb-4 block">🔍</span>
                <p className="text-gray-500">找不到「{searchQuery}」的結果</p>
              </div>
            )}
          </div>
        ) : (
          /* Default View */
          <div className="px-4 space-y-6">
            {/* 分類卡片 2x2 */}
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                  className={`relative h-24 rounded-xl overflow-hidden bg-gradient-to-br ${cat.gradient} p-4 flex items-center justify-between group active:scale-95 transition-transform`}
                >
                  <span className="text-white font-bold text-lg z-10 relative">
                    {cat.name}
                  </span>
                  
                  {/* 右側正方形歌手圖 */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden shadow-lg z-10 relative">
                    {cat.id === 'male' && categoryCovers.male && getArtistPhoto(categoryCovers.male) ? (
                      <img 
                        src={getArtistPhoto(categoryCovers.male)} 
                        alt={categoryCovers.male.name}
                        className="w-full h-full object-cover"
                      />
                    ) : cat.id === 'female' && categoryCovers.female && getArtistPhoto(categoryCovers.female) ? (
                      <img 
                        src={getArtistPhoto(categoryCovers.female)} 
                        alt={categoryCovers.female.name}
                        className="w-full h-full object-cover"
                      />
                    ) : cat.id === 'group' && categoryCovers.group && getArtistPhoto(categoryCovers.group) ? (
                      <img 
                        src={getArtistPhoto(categoryCovers.group)} 
                        alt={categoryCovers.group.name}
                        className="w-full h-full object-cover"
                      />
                    ) : cat.id === 'latest' && categoryCovers.recent?.thumbnail ? (
                      <img 
                        src={categoryCovers.recent.thumbnail} 
                        alt="最新上架"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-black/30 flex items-center justify-center text-2xl">
                        {cat.id === 'male' && '👨'}
                        {cat.id === 'female' && '👩'}
                        {cat.id === 'group' && '👥'}
                        {cat.id === 'latest' && '✨'}
                      </div>
                    )}
                  </div>
                  
                  {/* 裝飾性背景圓形 */}
                  <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-white/10" />
                </button>
              ))}
            </div>

            {/* 熱門歌曲 */}
            {!isLoading && hotSongs.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-white mb-4">熱門歌曲</h2>
                <div className="flex overflow-x-auto scrollbar-hide gap-3 -mx-4 px-4">
                  {hotSongs.map((song) => (
                    <button
                      key={song.id}
                      onClick={() => handleSongClick(song.id)}
                      className="flex-shrink-0 w-32 group"
                    >
                      <div className="aspect-square rounded-xl overflow-hidden bg-gray-800 mb-2 transition-transform group-hover:scale-105 shadow-md">
                        {song.thumbnail || song.youtubeVideoId ? (
                          <img
                            src={song.thumbnail || `https://img.youtube.com/vi/${song.youtubeVideoId}/mqdefault.jpg`}
                            alt={song.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl">
                            🎵
                          </div>
                        )}
                      </div>
                      <h3 className="text-white text-sm font-medium truncate text-left">
                        {song.title}
                      </h3>
                      <p className="text-gray-500 text-xs truncate text-left">
                        {song.artist}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* 熱門歌手 */}
            {!isLoading && hotArtists.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-white mb-4">熱門歌手</h2>
                <div className="flex overflow-x-auto scrollbar-hide gap-4 -mx-4 px-4">
                  {hotArtists.map((artist) => (
                    <button
                      key={artist.id}
                      onClick={() => handleArtistClick(artist)}
                      className="flex-shrink-0 flex flex-col items-center group"
                    >
                      <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-800 mb-2 transition-transform group-hover:scale-105 border-2 border-transparent group-hover:border-[#FFD700] shadow-lg">
                        {getArtistPhoto(artist) ? (
                          <img
                            src={getArtistPhoto(artist)}
                            alt={artist.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-br from-gray-700 to-gray-800">
                            🎤
                          </div>
                        )}
                      </div>
                      <h3 className="text-white text-sm font-medium text-center max-w-24 truncate">
                        {artist.name}
                      </h3>
                      <p className="text-gray-500 text-xs text-center">
                        {artist.artistType === 'male' || artist.gender === 'male' ? '男歌手' :
                         artist.artistType === 'female' || artist.gender === 'female' ? '女歌手' :
                         artist.artistType === 'group' || artist.gender === 'group' ? '組合' :
                         artist.artistType === 'band' || artist.gender === 'band' ? '樂隊' : '歌手'}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* 熱門搜尋 */}
            <section>
              <h2 className="text-lg font-bold text-white mb-4">熱門搜尋</h2>
              <div className="flex flex-wrap gap-2">
                {popularSearches.map((term) => (
                  <button
                    key={term}
                    onClick={() => setSearchQuery(term)}
                    className="px-4 py-2 bg-[#282828] rounded-full text-white text-sm hover:bg-[#3E3E3E] transition"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

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

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { getAllTabs, getAllArtists } from '@/lib/tabs'
import Layout from '@/components/Layout'

export default function Search() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [songs, setSongs] = useState([])
  const [artists, setArtists] = useState([])
  const [filteredSongs, setFilteredSongs] = useState([])
  const [filteredArtists, setFilteredArtists] = useState([])
  const [isLoading, setIsLoading] = useState(true)

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
        song.artist.toLowerCase().includes(query)
      ).slice(0, 10)
    )
    
    setFilteredArtists(
      artists.filter(artist => 
        artist.name.toLowerCase().includes(query)
      ).slice(0, 8)
    )
  }, [searchQuery, songs, artists])

  const loadData = async () => {
    try {
      const [songsData, artistsData] = await Promise.all([
        getAllTabs(),
        getAllArtists()
      ])
      setSongs(songsData)
      setArtists(artistsData)
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

  // 熱門搜尋建議
  const popularSearches = ['陳奕迅', '張敬軒', 'Dear Jane', '方皓玟', '姜濤', '柳應廷']

  return (
    <Layout>
      <div className="min-h-screen bg-black pb-24">
        {/* Header */}
        <div className="px-6 py-6">
          <h1 className="text-2xl font-bold text-white mb-6">搜尋</h1>
          
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="搜尋歌名、歌手..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white/10 border-0 rounded-full text-white placeholder-gray-500 focus:ring-2 focus:ring-white focus:bg-white/20 transition text-base"
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
                className="absolute right-4 top-4 text-gray-500 hover:text-white"
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
          <div className="px-6 space-y-6">
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
                        {artist.photoURL || artist.wikiPhotoURL || artist.photo ? (
                          <img
                            src={artist.photoURL || artist.wikiPhotoURL || artist.photo}
                            alt={artist.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            
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
                      <div className="w-12 h-12 rounded bg-gray-800 flex items-center justify-center text-xl">
                        {song.youtubeVideoId ? (
                          <img
                            src={`https://img.youtube.com/vi/${song.youtubeVideoId}/default.jpg`}
                            alt={song.title}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          ''
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-white font-medium group-hover:text-[#FFD700] transition">
                          {song.title}
                        </h3>
                        <p className="text-sm text-gray-500">{song.artist}</p>
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
                <span className="text-4xl mb-4 block"></span>
                <p className="text-gray-500">找不到「{searchQuery}」的結果</p>
              </div>
            )}
          </div>
        ) : (
          /* Popular Searches */
          <div className="px-6">
            <h2 className="text-lg font-bold text-white mb-4">熱門搜尋</h2>
            <div className="flex flex-wrap gap-3">
              {popularSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => setSearchQuery(term)}
                  className="px-4 py-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition"
                >
                  {term}
                </button>
              ))}
            </div>

            {/* Browse All Categories */}
            <h2 className="text-lg font-bold text-white mt-8 mb-4">瀏覽全部</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: '男歌手', color: 'from-blue-600 to-blue-900' },
                { name: '女歌手', color: 'from-pink-600 to-pink-900' },
                { name: '組合', color: 'from-purple-600 to-purple-900' },
                { name: '最新上架', color: 'from-green-600 to-green-900' }
              ].map((item) => (
                <a
                  key={item.name}
                  href={item.name === '最新上架' ? '/' : `/artists?category=${item.name === '男歌手' ? 'male' : item.name === '女歌手' ? 'female' : 'group'}`}
                  className={`h-24 rounded-lg bg-gradient-to-br ${item.color} p-4 flex items-end`}
                >
                  <span className="text-white font-bold">{item.name}</span>
                </a>
              ))}
            </div>
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

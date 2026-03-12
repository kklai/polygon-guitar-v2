import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import Link from '@/components/Link'
import Layout from '@/components/Layout'
import { SongCard } from '@/components/LazyImage'
import { addSongToPlaylist } from '@/lib/playlistApi'
import { useAuth } from '@/contexts/AuthContext'

const STORAGE_KEY = 'searchPageData'
const CACHE_TTL = 10 * 60 * 1000    // 10 min full cache
const FRESH_TTL = 2 * 60 * 1000     // 2 min = skip fetch entirely
const HOMEPAGE_LOCAL_CACHE_KEY = 'pg_home_cache_v2'
const HOMEPAGE_LOCAL_CACHE_TTL_MS = 60 * 60 * 1000

function readCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Date.now() - parsed.ts > CACHE_TTL) return null
    return parsed
  } catch { return null }
}

function writeCache(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, ts: Date.now() }))
  } catch {}
}

// 與首頁一致：裁剪維基圖 URL
function getCroppedWikiImage(url) {
  if (!url) return url
  if (url.includes('/thumb/')) return url.replace(/\/\d+px-/, '/200px-')
  return url
}

export default function Search() {
  const router = useRouter()
  const { user } = useAuth()
  const addToPlaylistId = router.query.addToPlaylist
  const [searchQuery, setSearchQuery] = useState('')
  const [addingToPlaylist, setAddingToPlaylist] = useState(null)
  const [songs, setSongs] = useState([])
  const [artists, setArtists] = useState([])
  const [filteredSongs, setFilteredSongs] = useState([])
  const [filteredArtists, setFilteredArtists] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [hotSongs, setHotSongs] = useState([])
  // 與首頁同款：{ male: [], female: [], group: [], all: [] }，用於分類卡下方歌手預覽 + 熱門歌手區
  const [hotArtists, setHotArtists] = useState({ male: [], female: [], group: [], all: [] })
  const [categoryCovers, setCategoryCovers] = useState({
    male: null, female: null, group: null, recent: null
  })
  const fetchedRef = useRef(false)

  const applyData = useCallback((data) => {
    setSongs(data.tabs || [])
    setArtists(data.artists || [])
  }, [])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    const cached = readCache()
    if (cached) {
      applyData(cached)
      setIsLoading(false)
      if (Date.now() - cached.ts < FRESH_TTL) return
    }

    fetch('/api/search-data')
      .then(r => {
        if (!r.ok) throw new Error(r.statusText || 'Search data failed')
        return r.json()
      })
      .then(data => {
        if (data.error) throw new Error(data.message || data.error)
        applyData(data)
        writeCache(data)
      })
      .catch(err => {
        console.error('Error loading search data:', err)
        try { localStorage.removeItem(STORAGE_KEY) } catch {}
      })
      .finally(() => setIsLoading(false))
  }, [applyData])

  // 熱門歌曲、熱門歌手、分類卡片圖片: all from home-data (cache or /api/home-data)
  useEffect(() => {
    function applyHomeHot(data) {
      if (data?.hotTabs?.length) setHotSongs(data.hotTabs)
      if (data?.hotArtists) {
        const ha = data.hotArtists
        setHotArtists(ha && !Array.isArray(ha) ? ha : { male: [], female: [], group: [], all: Array.isArray(ha) ? ha : (ha?.all || []) })
      }
      // 男歌手、女歌手、組合: image from home categories. 最新上架: first item in 最近上架 (latestSongs)
      const cats = data?.categories || []
      const firstLatest = data?.latestSongs?.[0]
      const recentUrl = firstLatest ? (firstLatest.coverImage || firstLatest.artistPhoto || null) : null
      setCategoryCovers({
        male: cats.find((c) => c.id === 'male')?.image ?? null,
        female: cats.find((c) => c.id === 'female')?.image ?? null,
        group: cats.find((c) => c.id === 'group')?.image ?? null,
        recent: recentUrl
      })
    }
    try {
      const raw = typeof window !== 'undefined' && localStorage.getItem(HOMEPAGE_LOCAL_CACHE_KEY)
      if (raw) {
        const { data, _ts } = JSON.parse(raw)
        if (data && _ts && Date.now() - _ts <= HOMEPAGE_LOCAL_CACHE_TTL_MS) {
          applyHomeHot(data)
          return
        }
      }
    } catch {}
    fetch('/api/home-data')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(r.statusText)))
      .then(applyHomeHot)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredSongs([])
      setFilteredArtists([])
      return
    }

    const q = searchQuery.toLowerCase()
    
    setFilteredSongs(
      songs.filter(song => 
        song.title?.toLowerCase().includes(q) ||
        song.artist?.toLowerCase().includes(q) ||
        (song.composer && song.composer.toLowerCase().includes(q)) ||
        (song.lyricist && song.lyricist.toLowerCase().includes(q)) ||
        (song.arranger && song.arranger.toLowerCase().includes(q)) ||
        (song.uploaderPenName && song.uploaderPenName.toLowerCase().includes(q))
      )
    )
    
    setFilteredArtists(
      artists.filter(artist => 
        artist.name?.toLowerCase().includes(q)
      )
    )
  }, [searchQuery, songs, artists])

  const handleSongClick = async (songId) => {
    if (addToPlaylistId && user?.uid) {
      setAddingToPlaylist(songId)
      try {
        await addSongToPlaylist(addToPlaylistId, songId)
        router.push(`/library/playlist/${addToPlaylistId}`)
      } catch (e) {
        console.error(e)
        alert('加入失敗，請重試')
      } finally {
        setAddingToPlaylist(null)
      }
      return
    }
    router.push(`/tabs/${songId}`)
  }

  const handleArtistClick = (artist) => {
    // 使用 artist.id 確保連結不變（即使歌手改名）
    router.push(`/artists/${artist.id}`)
  }

  // 首頁同款：男/女/組合三類，用於分類卡（結構與 index.js HomeCategoryCard 一致）
  const categories = [
    { id: 'male', name: '男歌手' },
    { id: 'female', name: '女歌手' },
    { id: 'group', name: '組合' }
  ]

  const popularSearches = ['陳奕迅', '張敬軒', 'Dear Jane', '方皓玟', '姜濤', '柳應廷']

  // 獲取歌手照片
  const getArtistPhoto = (artist) => {
    return artist?.photoURL || artist?.wikiPhotoURL || artist?.photo || null
  }

  return (
    <Layout>
      <div className="min-h-screen bg-black pb-24">
        {/* Header */}
        <div className="py-4 px-4">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="想彈咩歌？"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-[#282828] border-0 rounded-full text-white placeholder-[#666] outline-none transition text-base"
              autoFocus
            />
            <svg 
              className="absolute left-4 top-4 w-6 h-6 text-[#666]"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-4 text-[#666] hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {addToPlaylistId && (
          <p className="py-2 text-sm text-[#FFD700] bg-[#282828] rounded-lg mb-2">
            為歌單加歌：揀一首會加入歌單並返回
          </p>
        )}

        {/* Search Results */}
        {searchQuery.trim() !== '' ? (
          <div className="space-y-6 pl-4">
            {/* Artists Results */}
            {filteredArtists.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-white mb-4">歌手</h2>
                <div className="flex overflow-x-auto scrollbar-hide gap-4 pr-4">
                  {filteredArtists.map((artist) => (
                    <div
                      key={artist.id}
                      onClick={() => handleArtistClick(artist)}
                      className="flex-shrink-0 flex flex-col items-center cursor-pointer"
                    >
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-800 mb-2">
                        {getArtistPhoto(artist) ? (
                          <img
                            src={getArtistPhoto(artist)}
                            alt={artist.name}
                            className="w-full h-full object-cover pointer-events-none"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            🎤
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-gray-300">
                        {artist.name}
                      </span>
                    </div>
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
                      className="w-full flex items-center gap-3 p-3 hover:bg-white/10 rounded-lg transition"
                    >
                      <span className="text-gray-500 w-6 text-center flex-shrink-0">{index + 1}</span>
                      <div className="flex-1 text-left min-w-0">
                        <h3 className="text-white font-medium">
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

            {/* No Results / Loading */}
            {filteredSongs.length === 0 && filteredArtists.length === 0 && (
              <div className="text-center py-12">
                {isLoading ? (
                  <>
                    <div className="w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500">搜尋中...</p>
                  </>
                ) : (
                  <>
                    <span className="text-4xl mb-4 block">🔍</span>
                    <p className="text-gray-500">找不到「{searchQuery}」的結果</p>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Default View - 分類區與首頁同款：橫向滾動、正方形卡、右下標籤、下方歌手預覽 */
          <div className="space-y-6">
            {/* 歌手分類 - 手機三格 fit 屏寬，桌面橫向滾動 */}
            <section className="pt-2 px-4 md:pl-4 md:pr-0" style={{ marginBottom: 25 }}>
              <div className="flex gap-2 md:flex-nowrap md:overflow-x-auto md:scrollbar-hide md:pr-6 md:gap-3">
                {categories.map((category) => {
                  const coverUrl = typeof categoryCovers[category.id] === 'string'
                    ? categoryCovers[category.id]
                    : (categoryCovers[category.id] && getArtistPhoto(categoryCovers[category.id]))
                  return (
                    <Link
                      key={category.id}
                      href={`/artists?category=${category.id}`}
                      className="flex-1 min-w-0 flex flex-col cursor-pointer md:flex-initial md:w-36 md:min-w-0 md:shrink-0"
                    >
                      <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-800 md:w-36 md:h-36 md:aspect-auto">
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={category.name}
                            className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <>
                            <div className="absolute inset-0 bg-gray-800" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-2xl opacity-50">🎵</span>
                            </div>
                          </>
                        )}
                        <div className="absolute bottom-2 right-0">
                          <span className={`text-black text-[106%] font-bold px-2 py-[0.2px] rounded-none block text-center whitespace-nowrap leading-tight tracking-[0.1em] ${
                            category.id === 'male' ? 'bg-[#1fc3df]' :
                            category.id === 'female' ? 'bg-[#ff9b98]' :
                            'bg-[#fed702]'
                          }`}>
                            {category.name}
                          </span>
                        </div>
                      </div>
                      <div className="w-full mt-2 px-0.5 md:w-36 md:px-1">
                        <p className="text-xs text-gray-400 text-left line-clamp-2" style={{ lineHeight: 1.3 }}>
                          {hotArtists[category.id]?.slice(0, 5).map(a => a.name).join(' · ')}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>

            {/* 熱門歌曲 - same data and component as home (home-data API + SongCard) */}
            {!isLoading && hotSongs.length > 0 && (
              <section className="pl-4">
                <h2 className="text-lg font-bold text-white mb-4">熱門歌曲</h2>
                <div className="flex overflow-x-auto scrollbar-hide gap-3 pr-4">
                  {hotSongs.map((song) => (
                    <SongCard
                      key={song.id}
                      song={song}
                      artistPhoto={song.artistPhoto}
                      href={addToPlaylistId ? undefined : `/tabs/${song.id}`}
                      onClick={addToPlaylistId ? () => handleSongClick(song.id) : undefined}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 熱門歌手 - same data as home (home-data API) */}
            {!isLoading && (hotArtists.all?.length > 0) && (
              <section className="pl-4">
                <h2 className="text-lg font-bold text-white mb-4">熱門歌手</h2>
                <div className="flex overflow-x-auto scrollbar-hide gap-4 pr-4">
                  {(hotArtists.all || []).map((artist) => (
                    <button
                      key={artist.id}
                      onClick={() => handleArtistClick(artist)}
                      className="flex-shrink-0 flex flex-col items-center"
                    >
                      <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-800 mb-2 shadow-lg">
                        {getArtistPhoto(artist) ? (
                          <img
                            src={getArtistPhoto(artist)}
                            alt={artist.name}
                            className="w-full h-full object-cover pointer-events-none"
                            loading="lazy"
                            decoding="async"
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
            <section className="pl-4">
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

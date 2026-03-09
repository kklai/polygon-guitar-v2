import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { addSongToPlaylist } from '@/lib/playlistApi'
import { useAuth } from '@/contexts/AuthContext'

const STORAGE_KEY = 'searchPageData'
const CACHE_TTL = 10 * 60 * 1000    // 10 min full cache
const FRESH_TTL = 2 * 60 * 1000     // 2 min = skip fetch entirely

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
  const [hotArtists, setHotArtists] = useState([])
  const [categoryCovers, setCategoryCovers] = useState({
    male: null, female: null, group: null, recent: null
  })
  // 與首頁同款：後台設定的分類封面圖（優先於「該類第一位歌手」）
  const [categoryImageUrls, setCategoryImageUrls] = useState({ male: null, female: null, group: null })
  const fetchedRef = useRef(false)

  const applyData = useCallback((data) => {
    setSongs(data.tabs || [])
    setArtists(data.artists || [])
    setHotSongs(data.hotTabs || [])
    setHotArtists(data.hotArtists || [])
    
    const byType = (type) => (data.artists || [])
      .filter(a => a.artistType === type || a.gender === type)
      .sort((a, b) => (b.adminScore || 0) - (a.adminScore || 0))
    const male = byType('male')
    const female = byType('female')
    const group = [...byType('group'), ...byType('band')]
    setCategoryCovers({
      male: male[0] || null,
      female: female[0] || null,
      group: group[0] || null,
      recent: male[1] || male[0] || null
    })

    // 解析分類封面：與首頁一致，用後台設定嘅圖（或指定歌手相）
    if (data.categoryImages && data.artists?.length) {
      const artistMap = new Map(data.artists.map(a => [a.id, a]))
      const urls = {}
      for (const catId of ['male', 'female', 'group']) {
        const catData = data.categoryImages[catId]
        let imageUrl = null
        if (catData?.artistId && artistMap.has(catData.artistId)) {
          const artist = artistMap.get(catData.artistId)
          imageUrl = artist.photoURL || artist.wikiPhotoURL || artist.photo || catData.image || null
        } else if (catData?.image) {
          imageUrl = catData.image
        }
        if (imageUrl?.includes('wikipedia.org')) imageUrl = getCroppedWikiImage(imageUrl)
        urls[catId] = imageUrl || null
      }
      setCategoryImageUrls(urls)
    } else {
      setCategoryImageUrls({ male: null, female: null, group: null })
    }
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
  
  // 首頁同款：男/女/組合三類，用於分類卡
  const categories = [
    { id: 'male', name: '男歌手' },
    { id: 'female', name: '女歌手' },
    { id: 'group', name: '組合' }
  ]
  const byType = (type) => (artists || [])
    .filter(a => a.artistType === type || a.gender === type)
    .sort((a, b) => (b.adminScore || 0) - (a.adminScore || 0))
  const hotArtistsByCategory = {
    male: byType('male'),
    female: byType('female'),
    group: [...byType('group'), ...byType('band')]
  }

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
                            className="w-full h-full object-cover pointer-events-none select-none"
                            draggable="false"
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
                      className="w-full flex items-center gap-4 p-3 hover:bg-white/10 rounded-lg transition"
                    >
                      <span className="text-gray-500 w-6 text-center">{index + 1}</span>
                      <div className="w-12 h-12 rounded bg-gray-800 flex items-center justify-center text-xl overflow-hidden">
                        {song.youtubeVideoId ? (
                          <img
                            src={`https://img.youtube.com/vi/${song.youtubeVideoId}/default.jpg`}
                            alt={song.title}
                            className="w-full h-full object-cover rounded pointer-events-none select-none"
                            draggable="false"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          '🎵'
                        )}
                      </div>
                      <div className="flex-1 text-left">
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
          /* Default View */
          <div className="space-y-6">
            {/* 分類卡片：電話版 3 張跟 screen width 平分 + 左右 1rem，桌面版維持橫捲 */}
            <div className="flex gap-2 md:gap-3 md:overflow-x-auto scrollbar-hide px-4 md:px-0 md:pr-4">
              {categories.map((category) => {
                const cover = categoryCovers[category.id]
                const imageUrl = categoryImageUrls[category.id] ?? (cover && getArtistPhoto(cover))
                return (
                  <Link
                    key={category.id}
                    href={`/artists?category=${category.id}`}
                    className="flex-1 min-w-0 flex flex-col md:flex-shrink-0 md:w-36"
                  >
                    <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-800">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={cover?.name ?? category.name}
                          className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none select-none"
                          draggable="false"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl opacity-50">🎵</span>
                        </div>
                      )}
                      <div className="absolute bottom-2 right-0">
                        <span className={`inline-block text-black text-[106%] font-bold px-2 py-[0.2px] rounded-none whitespace-nowrap leading-tight tracking-[0.1em] ${
                          category.id === 'male' ? 'bg-[#1fc3df]' :
                          category.id === 'female' ? 'bg-[#ff9b98]' :
                          'bg-[#fed702]'
                        }`}>
                          {category.name}
                        </span>
                      </div>
                    </div>
                    <div className="w-full mt-2 px-0 md:px-1 md:w-36">
                      <p className="text-xs text-gray-400 text-left line-clamp-2" style={{ lineHeight: 1.3 }}>
                        {hotArtistsByCategory[category.id]?.slice(0, 5).map(a => a.name).join(' · ')}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* 熱門歌曲 */}
            {!isLoading && hotSongs.length > 0 && (
              <section className="pl-4">
                <h2 className="text-lg font-bold text-white mb-4">熱門歌曲</h2>
                <div className="flex overflow-x-auto scrollbar-hide gap-3 pr-4">
                  {hotSongs.map((song) => (
                    <button
                      key={song.id}
                      onClick={() => handleSongClick(song.id)}
                      className="flex-shrink-0 w-32"
                    >
                      <div className="aspect-square rounded-xl overflow-hidden bg-gray-800 mb-2 shadow-md">
                        {song.thumbnail || song.youtubeVideoId ? (
                          <img
                            src={song.thumbnail || `https://img.youtube.com/vi/${song.youtubeVideoId}/mqdefault.jpg`}
                            alt={song.title}
                            className="w-full h-full object-cover pointer-events-none select-none"
                            draggable="false"
                            loading="lazy"
                            decoding="async"
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
              <section className="pl-4">
                <h2 className="text-lg font-bold text-white mb-4">熱門歌手</h2>
                <div className="flex overflow-x-auto scrollbar-hide gap-4 pr-4">
                  {hotArtists.map((artist) => (
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
                            className="w-full h-full object-cover pointer-events-none select-none"
                            draggable="false"
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

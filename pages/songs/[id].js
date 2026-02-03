import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { getArtistBySlug, getTopSongsByArtist, getAllSongsByArtistGrouped } from '@/lib/tabs'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'

const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export default function ArtistPage() {
  const router = useRouter()
  const { id } = router.query
  const { isAdmin } = useAuth()
  const [artist, setArtist] = useState(null)
  const [topSongs, setTopSongs] = useState([])
  const [groupedSongs, setGroupedSongs] = useState({})
  const [uploaderNames, setUploaderNames] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [debugInfo, setDebugInfo] = useState(null)

  useEffect(() => {
    if (id) {
      loadArtistData()
    }
  }, [id])

  // Load uploader names for all songs
  useEffect(() => {
    const loadUploaderNames = async () => {
      const allSongs = [...topSongs]
      Object.values(groupedSongs).forEach(group => {
        allSongs.push(...group)
      })
      
      const uniqueUserIds = [...new Set(allSongs.map(s => s.createdBy).filter(Boolean))]
      const names = {}
      
      for (const userId of uniqueUserIds) {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId))
          if (userDoc.exists()) {
            names[userId] = userDoc.data().displayName || '未知用戶'
          }
        } catch (e) {
          console.error('Error loading user:', e)
        }
      }
      
      setUploaderNames(names)
    }
    
    if (topSongs.length > 0 || Object.keys(groupedSongs).length > 0) {
      loadUploaderNames()
    }
  }, [topSongs, groupedSongs])

  const loadArtistData = async () => {
    try {
      setIsLoading(true)
      
      console.log('Loading artist with slug:', id)
      
      // Get artist info
      const artistData = await getArtistBySlug(id)
      console.log('Artist data:', artistData)
      
      if (!artistData) {
        console.log('Artist not found, redirecting...')
        router.push('/')
        return
      }
      setArtist(artistData)

      // Get top 5 songs by view count
      console.log('Loading songs for artist:', artistData.name, 'normalizedName:', artistData.normalizedName)
      const top = await getTopSongsByArtist(artistData.name, artistData.normalizedName, 5)
      console.log('Top songs:', top)
      setTopSongs(top)

      // Get all songs grouped by year
      const allSongs = await getAllSongsByArtistGrouped(artistData.name, artistData.normalizedName)
      console.log('All songs:', allSongs)
      
      // Set debug info
      setDebugInfo({
        slug: id,
        artistName: artistData.name,
        artistId: artistData.id,
        normalizedName: artistData.normalizedName,
        possibleIds: [artistData.normalizedName, artistData.name.toLowerCase().replace(/\s+/g, '-')],
        topSongsCount: top.length,
        allSongsCount: allSongs.length
      })
      
      // Group by year
      const grouped = allSongs.reduce((acc, song) => {
        // Use songYear if available, otherwise extract from createdAt
        let year = song.songYear
        if (!year && song.createdAt) {
          year = new Date(song.createdAt).getFullYear()
        }
        year = year || '未知年份'
        
        if (!acc[year]) acc[year] = []
        acc[year].push(song)
        return acc
      }, {})
      
      // Sort years descending
      const sortedGrouped = Object.keys(grouped)
        .sort((a, b) => {
          if (a === '未知年份') return 1
          if (b === '未知年份') return -1
          return parseInt(b) - parseInt(a)
        })
        .reduce((acc, year) => {
          acc[year] = grouped[year]
          return acc
        }, {})
      
      setGroupedSongs(sortedGrouped)
    } catch (error) {
      console.error('Error loading artist:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Get YouTube thumbnail from video ID
  const getThumbnail = (song) => {
    if (song.youtubeVideoId) {
      return `https://img.youtube.com/vi/${song.youtubeVideoId}/hqdefault.jpg`
    }
    if (song.youtubeUrl) {
      const match = song.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)
      if (match) {
        return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`
      }
    }
    return null
  }

  // Handle key badge click
  const handleKeyClick = (e, songId, key) => {
    e.stopPropagation()
    router.push(`/tabs/${songId}?key=${key}`)
  }

  // Handle song row click
  const handleSongClick = (songId) => {
    router.push(`/tabs/${songId}`)
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-black">
          {/* Hero Skeleton */}
          <div className="h-[45vh] bg-gradient-to-b from-gray-800 to-black animate-pulse" />
          <div className="px-6 -mt-20 relative z-10">
            <div className="h-8 bg-gray-800 rounded w-1/3 mb-4" />
            <div className="h-4 bg-gray-800 rounded w-1/4" />
          </div>
        </div>
      </Layout>
    )
  }

  if (!artist) return null

  const totalSongs = Object.values(groupedSongs).flat().length

  return (
    <Layout fullWidth>
      <div className="min-h-screen bg-black">
        {/* Hero Section - 響應式設計：手機正方形/圓形，網頁橫向長方形 */}
        <div className="relative">
          {/* 網頁版：全闊 Hero 圖片 */}
          <div className="hidden md:block relative h-[45vh]">
            {artist.heroPhoto || artist.photo ? (
              <img
                src={artist.heroPhoto || artist.photo}
                alt={artist.name}
                className="absolute inset-0 w-full h-full object-cover object-top"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                <span className="text-9xl">🎤</span>
              </div>
            )}
            
            {/* Gradient Overlay */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 40%, transparent 70%)'
              }}
            />
          </div>

          {/* 手機版：正方形/圓形頭像設計 */}
          <div className="md:hidden bg-gradient-to-b from-gray-800 to-black pt-8 pb-4 px-6">
            <div className="flex items-end gap-4">
              {/* 圓形/正方形歌手頭像 */}
              <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0 shadow-2xl border-2 border-[#FFD700]">
                {artist.photo ? (
                  <img
                    src={artist.photo}
                    alt={artist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl">
                    🎤
                  </div>
                )}
              </div>
              
              {/* 歌手資訊 */}
              <div className="flex-1 pb-2">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">歌手</p>
                
                {/* 歌手名 + Hover Tooltip */}
                <div className="relative group/tooltip">
                  <h1 className="text-3xl font-bold text-white mb-1 cursor-help">
                    {artist.name}
                    {artist.bio && (
                      <span className="ml-2 text-gray-500 text-lg">
                        <svg className="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    )}
                  </h1>
                  
                  {/* Tooltip - 顯示歌手簡介 */}
                  {artist.bio && (
                    <div className="absolute left-0 bottom-full mb-2 w-72 p-4 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                      {/* 小三角 */}
                      <div className="absolute bottom-0 left-6 transform translate-y-1/2 rotate-45 w-3 h-3 bg-gray-900 border-r border-b border-gray-700"></div>
                      
                      <div className="flex items-start gap-3">
                        {/* 歌手小頭像 */}
                        {artist.photo && (
                          <img 
                            src={artist.photo} 
                            alt={artist.name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-[#FFD700] flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm mb-1">{artist.name}</p>
                          <p className="text-gray-400 text-xs line-clamp-4 leading-relaxed">
                            {artist.bio}
                          </p>
                          {artist.year && (
                            <p className="text-[#FFD700] text-xs mt-2">
                              {artist.year}年出道
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-gray-400">
                  {totalSongs} 首結他譜
                </p>
              </div>
            </div>
          </div>
          
          {/* Back Button */}
          <Link
            href="/artists"
            className="absolute top-4 md:top-6 left-4 md:left-6 z-20 inline-flex items-center text-white/80 hover:text-white transition bg-black/30 backdrop-blur-sm px-3 py-2 rounded-full"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回
          </Link>
          
          {/* Admin Edit Button */}
          {isAdmin && artist && (
            <Link
              href={`/artists/${artist.id}/edit`}
              className="absolute top-4 md:top-6 right-4 md:right-6 z-20 inline-flex items-center text-white/80 hover:text-white transition bg-[#FFD700]/90 hover:bg-[#FFD700] text-black px-3 py-2 rounded-full"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              編輯
            </Link>
          )}
          
          {/* 網頁版歌手資訊 */}
          <div className="hidden md:block absolute bottom-8 left-6 z-10">
            {/* 歌手名 + Hover Tooltip */}
            <div className="relative group/tooltip inline-block">
              <h1 className="text-5xl md:text-6xl font-bold text-white mb-2 drop-shadow-lg cursor-help">
                {artist.name}
                {artist.bio && (
                  <span className="ml-3 text-gray-400 text-2xl">
                    <svg className="w-8 h-8 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                )}
              </h1>
              
              {/* Tooltip - 顯示歌手簡介 */}
              {artist.bio && (
                <div className="absolute left-0 bottom-full mb-3 w-96 p-5 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                  {/* 小三角 */}
                  <div className="absolute bottom-0 left-8 transform translate-y-1/2 rotate-45 w-4 h-4 bg-gray-900 border-r border-b border-gray-700"></div>
                  
                  <div className="flex items-start gap-4">
                    {/* 歌手小頭像 */}
                    {artist.photo && (
                      <img 
                        src={artist.photo} 
                        alt={artist.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-[#FFD700] flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-lg mb-2">{artist.name}</p>
                      <p className="text-gray-300 text-sm leading-relaxed line-clamp-5">
                        {artist.bio}
                      </p>
                      {artist.year && (
                        <p className="text-[#FFD700] text-sm mt-3">
                          🎵 {artist.year}年出道
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <p className="text-lg text-gray-300 drop-shadow">
              {totalSongs} 首結他譜
              {artist.year && ` • ${artist.year}年出道`}
            </p>
          </div>
        </div>

        {/* Hot Songs Section */}
        {topSongs.length > 0 && (
          <div className="px-4 md:px-6 pt-8">
            <h2 className="text-2xl font-bold text-white mb-4">熱門</h2>
            
            <div className="space-y-1">
              {topSongs.map((song, index) => (
                <div
                  key={song.id}
                  onClick={() => handleSongClick(song.id)}
                  className="group flex items-center h-20 px-4 rounded-md hover:bg-white/10 transition cursor-pointer"
                >
                  {/* Rank */}
                  <span className="text-gray-500 text-lg w-10 text-center font-medium">
                    {index + 1}
                  </span>
                  
                  {/* Thumbnail - 響應式：手機 48px，網頁 56px */}
                  <div className="ml-2 w-12 h-12 md:w-14 md:h-14 rounded-md overflow-hidden bg-gray-800 flex-shrink-0">
                    {getThumbnail(song) ? (
                      <img
                        src={getThumbnail(song)}
                        alt={song.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl md:text-2xl">
                        🎸
                      </div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 ml-3 md:ml-4 flex flex-col justify-center min-w-0">
                    <h3 className="text-white font-semibold text-sm md:text-base truncate group-hover:text-[#FFD700] transition">
                      {song.title}
                    </h3>
                    
                    {/* Key Selection - 響應式：手機 20px，網頁 22px */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {KEYS.map((key) => (
                        <button
                          key={key}
                          onClick={(e) => handleKeyClick(e, song.id, key)}
                          className={`w-5 h-5 md:w-[22px] md:h-[22px] rounded-full text-[9px] md:text-[10px] font-bold inline-flex items-center justify-center transition transform hover:scale-110 ${
                            key === song.originalKey
                              ? 'bg-[#FFD700] text-black ring-2 ring-white'
                              : 'bg-[#FFD700] text-black hover:bg-[#FFE44D]'
                          }`}
                          title={`以 ${key} Key 演奏`}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* View Count */}
                  <div className="ml-4 text-gray-400 text-sm hidden sm:block">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {(song.viewCount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Songs Section - Grouped by Year */}
        {Object.keys(groupedSongs).length > 0 && (
          <div className="px-4 md:px-6 pt-10 pb-16">
            <h2 className="text-2xl font-bold text-white mb-4">所有歌曲</h2>
            
            <div className="space-y-6">
              {Object.entries(groupedSongs).map(([year, songs]) => (
                <div key={year}>
                  {/* Year Header - Sticky */}
                  <div className="sticky top-0 bg-black z-10 py-3 border-b border-gray-800">
                    <h3 className="text-[#FFD700] text-3xl font-bold">
                      {year}
                    </h3>
                  </div>
                  
                  {/* Songs List */}
                  <div className="mt-2">
                    {songs.map((song) => (
                      <div
                        key={song.id}
                        onClick={() => handleSongClick(song.id)}
                        className="group flex items-center justify-between py-4 px-4 border-b border-gray-900 hover:bg-gray-900 transition cursor-pointer"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white text-base font-medium truncate group-hover:text-[#FFD700] transition">
                            {song.title}
                          </h4>
                          <p className="text-gray-500 text-sm mt-0.5">
                            出譜：{uploaderNames[song.createdBy] || '載入中...'}
                          </p>
                        </div>
                        
                        {/* Key Badge - Simple display */}
                        <div className="ml-4 flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-[#FFD700] text-black text-xs font-bold rounded">
                            {song.originalKey || 'C'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {topSongs.length === 0 && Object.keys(groupedSongs).length === 0 && (
          <div className="px-6 py-16 text-center">
            <span className="text-6xl block mb-4">🎸</span>
            <h3 className="text-xl font-medium text-white mb-2">暫時冇譜</h3>
            <p className="text-gray-500 mb-6">呢位歌手暫時未有結他譜</p>
            
            {/* Debug Info */}
            {debugInfo && (
              <div className="max-w-md mx-auto mb-6 p-4 bg-gray-900 rounded-lg text-left text-sm">
                <p className="text-gray-400 mb-2">除錯資訊：</p>
                <p className="text-gray-500">Slug: {debugInfo.slug}</p>
                <p className="text-gray-500">歌手名: {debugInfo.artistName}</p>
                <p className="text-gray-500">normalizedName: {debugInfo.normalizedName}</p>
                <p className="text-gray-500">嘗試的 ID: {debugInfo.possibleIds?.join(', ')}</p>
                <p className="text-gray-500">熱門歌曲: {debugInfo.topSongsCount}</p>
                <p className="text-gray-500">所有歌曲: {debugInfo.allSongsCount}</p>
              </div>
            )}
            
            <Link
              href="/tabs/new"
              className="inline-flex items-center px-6 py-3 bg-[#FFD700] text-black rounded-full font-medium hover:opacity-90 transition"
            >
              上傳第一個譜
            </Link>
          </div>
        )}
      </div>
    </Layout>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { getTabsByArtist, getAllArtists } from '@/lib/tabs'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import ArtistSongsList from '@/components/ArtistSongsList'
import { ArtistHeroImage } from '@/components/ArtistImage'

const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export default function ArtistDetail() {
  const router = useRouter()
  const { id } = router.query
  const { isAdmin } = useAuth()
  const [tabs, setTabs] = useState([])
  const [artist, setArtist] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showBioPopover, setShowBioPopover] = useState(false)
  const popoverRef = useRef(null)
  const infoButtonRef = useRef(null)
  
  // Debug 狀態
  const [debugInfo, setDebugInfo] = useState({
    urlId: null,
    artistId: null,
    queryResultCount: 0,
    allArtists: [],
    error: null
  })

  // 點擊外部關閉 popover
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showBioPopover &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        infoButtonRef.current &&
        !infoButtonRef.current.contains(event.target)
      ) {
        setShowBioPopover(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showBioPopover])

  useEffect(() => {
    if (id) {
      loadArtistData()
    }
  }, [id])

  const loadArtistData = async () => {
    try {
      setDebugInfo(prev => ({ ...prev, urlId: id }))
      
      // Get all artists to find the artist info
      const artists = await getAllArtists()
      setDebugInfo(prev => ({ ...prev, allArtists: artists.map(a => ({ name: a.name, normalizedName: a.normalizedName })) }))
      
      const currentArtist = artists.find(a => a.normalizedName === id)
      
      if (!currentArtist) {
        setDebugInfo(prev => ({ 
          ...prev, 
          error: `搵唔到歌手: normalizedName === "${id}"`
        }))
        setIsLoading(false)
        return
      }

      setArtist(currentArtist)

      // Get tabs for this artist
      const artistTabs = await getTabsByArtist(currentArtist.name)
      setTabs(artistTabs)
      
      // 計算 artistId
      const calculatedArtistId = currentArtist.name.toLowerCase().replace(/\s+/g, '-')
      setDebugInfo(prev => ({ 
        ...prev, 
        artistId: calculatedArtistId,
        queryResultCount: artistTabs.length
      }))
      
    } catch (error) {
      console.error('Error loading artist data:', error)
      setDebugInfo(prev => ({ ...prev, error: error.message }))
    } finally {
      setIsLoading(false)
    }
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

  // 獲取 YouTube 縮圖
  const getYouTubeThumbnail = (song) => {
    // 1. 優先使用歌曲自己的縮圖
    if (song.thumbnail) return song.thumbnail
    if (song.coverImage) return song.coverImage
    
    // 2. 其次使用 YouTube 縮圖
    if (song.youtubeVideoId) {
      return `https://img.youtube.com/vi/${song.youtubeVideoId}/mqdefault.jpg`
    }
    if (song.youtubeUrl) {
      const match = song.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)
      if (match) {
        return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`
      }
    }
    
    // 3. 預設 fallback
    return null
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-black">
          <div className="animate-pulse space-y-4">
            <div className="h-[45vh] bg-gradient-to-b from-gray-800 to-black" />
            <div className="px-4">
              <div className="h-8 bg-gray-800 rounded w-1/3 mb-4" />
              <div className="h-4 bg-gray-800 rounded w-1/4" />
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  // 歌手資料 Popover
  const BioPopover = () => {
    if (!showBioPopover) return null
    
    return (
      <div 
        ref={popoverRef}
        className="absolute z-50 animate-popover-in"
        style={{
          top: '100%',
          left: '0',
          marginTop: '8px'
        }}
      >
        <div className="w-[280px] bg-[#1a1a1a] border border-[#FFD700] rounded-xl overflow-hidden shadow-2xl">
          {/* 歌手相 */}
          <div className="h-32 bg-gradient-to-b from-gray-800 to-[#1a1a1a] flex items-center justify-center">
            {artist?.photoURL || artist?.wikiPhotoURL || artist?.photo ? (
              <img
                src={artist?.photoURL || artist?.wikiPhotoURL || artist?.photo}
                alt={artist?.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-[#FFD700]"
              />
            ) : (
              <span className="text-5xl">🎤</span>
            )}
          </div>
          
          {/* 內容 */}
          <div className="px-4 pb-4 text-center">
            <h3 className="text-lg font-bold text-white mb-1">{artist?.name}</h3>
            <p className="text-[#FFD700] text-xs mb-3">{tabs.length} 首結他譜</p>
            
            {artist?.bio ? (
              <p className="text-gray-300 text-xs leading-relaxed line-clamp-4">
                {artist.bio}
              </p>
            ) : (
              <p className="text-gray-500 text-xs italic">暫無簡介</p>
            )}
            
            {artist?.year && (
              <p className="text-gray-400 text-[10px] mt-3">
                🎵 {artist.year}年出道
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Layout fullWidth>
      <div className="min-h-screen bg-black">
        {/* Hero Section */}
        <div className="relative">
          {/* 網頁版：全闊 Hero 圖片 */}
          <div className="hidden md:block relative h-[45vh]">
            <ArtistHeroImage artist={artist} size="hero" />
            
            {/* Gradient Overlay */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 40%, transparent 70%)'
              }}
            />
          </div>

          {/* 手機版：16:9 Hero 設計 */}
          <div className="md:hidden relative">
            {/* Hero Image - 16:9 */}
            <div className="relative w-full aspect-[16/9]">
              <ArtistHeroImage artist={artist} size="hero" />
              
              {/* 漸變遮罩 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              
              {/* 歌手名稱 - 左下角 + Popover */}
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <div className="relative inline-block">
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-3xl font-bold text-white">{artist?.name}</h1>
                    {/* 資料圖標 ⓘ */}
                    <button
                      ref={infoButtonRef}
                      onClick={() => setShowBioPopover(!showBioPopover)}
                      className={`w-6 h-6 rounded-full text-xs flex items-center justify-center transition ${
                        showBioPopover 
                          ? 'bg-[#FFD700] text-black' 
                          : 'bg-gray-600 text-white hover:bg-[#FFD700] hover:text-black'
                      }`}
                    >
                      ⓘ
                    </button>
                  </div>
                  
                  {/* Bio Popover */}
                  <BioPopover />
                </div>
                
                <p className="text-gray-300 text-sm">
                  {tabs.length} 首結他譜
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
              href={`/artists/${id}/edit`}
              className="absolute top-4 md:top-6 right-4 md:right-6 z-20 inline-flex items-center text-white/80 hover:text-white transition bg-[#FFD700]/90 hover:bg-[#FFD700] text-black px-3 py-2 rounded-full"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              編輯
            </Link>
          )}
          
          {/* 網頁版歌手資訊 */}
          <div className="hidden md:block absolute bottom-8 left-6 z-10 max-w-2xl">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-2 drop-shadow-lg">
              {artist?.name}
            </h1>
            
            {/* 簡介（電腦版直接顯示） */}
            {artist?.bio && (
              <p className="text-gray-300 text-sm leading-relaxed mb-3 line-clamp-2 drop-shadow">
                {artist.bio}
              </p>
            )}
            
            <p className="text-lg text-gray-300 drop-shadow">
              {tabs.length} 首結他譜
              {artist?.year && ` • ${artist.year}年出道`}
            </p>
          </div>
        </div>

        {/* Hot Songs Section */}
        {tabs.length > 0 && (
          <div className="px-3 md:px-6 pt-6">
            <h2 className="text-xl font-bold text-white mb-3">熱門</h2>
            
            <div className="space-y-1">
              {tabs.map((song, index) => (
                <div
                  key={song.id}
                  onClick={() => handleSongClick(song.id)}
                  className="group py-2 px-2 rounded-md hover:bg-white/10 transition cursor-pointer"
                >
                  {/* 第一行：歌名 + 瀏覽 + 讚好 */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-semibold text-sm truncate flex-1 pr-3 group-hover:text-[#FFD700] transition">
                      {song.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 flex-shrink-0">
                      <span className="flex items-center gap-0.5">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {song.viewCount || 0}
                      </span>
                      {song.likes > 0 && (
                        <span className="flex items-center gap-0.5">
                          <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                          </svg>
                          {song.likes}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* 第二行：排名 + 縮圖 + Key 圓圈 */}
                  <div className="flex items-center gap-2">
                    {/* 排名 - 縮細 w-4 h-4 */}
                    <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                      <span className={`
                        text-[10px] font-bold
                        ${index === 0 ? 'text-[#FFD700]' : 
                          index === 1 ? 'text-gray-300' : 
                          index === 2 ? 'text-amber-600' : 'text-gray-500'}
                      `}>
                        {index + 1}
                      </span>
                    </div>
                    
                    {/* 縮圖 - 縮細 w-8 h-8，使用 YouTube 縮圖 */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-md overflow-hidden bg-gray-800">
                      {getYouTubeThumbnail(song) ? (
                        <img
                          src={getYouTubeThumbnail(song)}
                          alt={song.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm">
                          🎸
                        </div>
                      )}
                    </div>
                    
                    {/* Key Selection - 新規格 w-7 h-7 */}
                    <div className="flex-1 flex flex-nowrap gap-1.5 overflow-x-auto scrollbar-hide">
                      {KEYS.map((key) => (
                        <button
                          key={key}
                          onClick={(e) => handleKeyClick(e, song.id, key)}
                          className={`flex-shrink-0 w-7 h-7 rounded-full text-[11px] font-bold inline-flex items-center justify-center transition hover:scale-105 ${
                            key === song.originalKey
                              ? 'bg-black text-[#FFD700] border border-[#FFD700]'
                              : 'bg-[#FFD700] text-black'
                          }`}
                          title={`以 ${key} Key 演奏`}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {tabs.length === 0 && (
          <div className="px-6 py-16 text-center">
            <span className="text-6xl block mb-4">🎸</span>
            <h3 className="text-xl font-medium text-white mb-2">暫時冇譜</h3>
            <p className="text-gray-500 mb-6">呢位歌手暫時未有結他譜</p>
            
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

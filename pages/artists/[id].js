import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { getTabsByArtist, getAllArtists } from '@/lib/tabs'
import { getArtistTabsWithCollabs } from '@/lib/collaborations'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { ArtistHeroImage } from '@/components/ArtistImage'
import ArtistTabRequests from '@/components/ArtistTabRequests'
import { recordArtistView } from '@/lib/recentViews'
import { RatingDisplay } from '@/components/RatingSystem'
import Head from 'next/head'
import { generateArtistTitle, generateArtistDescription, generateArtistSchema, generateBreadcrumbSchema, siteConfig } from '@/lib/seo'

const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export default function ArtistDetail() {
  const router = useRouter()
  const { id } = router.query
  const { user, isAdmin } = useAuth()
  const [tabs, setTabs] = useState([])
  const [artist, setArtist] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sortBy, setSortBy] = useState('views')
  const [selectedKeys, setSelectedKeys] = useState({})

  // 獲取 YouTube 縮圖
  const getYouTubeThumbnail = (song) => {
    if (song.thumbnail) return song.thumbnail
    if (song.youtubeUrl) {
      const match = song.youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
      if (match) return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`
    }
    return null
  }

  // 排序函數
  const getSortedTabs = () => {
    const sorted = [...tabs]
    switch (sortBy) {
      case 'views':
        return sorted.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
      case 'default':
      default:
        return sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }
  }

  // 加載數據
  useEffect(() => {
    if (!id) return
    
    const loadArtistData = async () => {
      setIsLoading(true)
      try {
        // 獲取所有歌手
        const allArtists = await getAllArtists()
        const foundArtist = allArtists.find(a => 
          a.normalizedName === id || 
          a.id === id || 
          a.slug === id
        )
        
        if (foundArtist) {
          // 調試：檢查 artist 對象
          console.log('Artist data:', {
            id: foundArtist.id,
            name: foundArtist.name,
            photoURL: foundArtist.photoURL,
            wikiPhotoURL: foundArtist.wikiPhotoURL,
            spotifyPhotoURL: foundArtist.spotifyPhotoURL,
            photo: foundArtist.photo,
            heroPhoto: foundArtist.heroPhoto ? 'exists' : 'null'
          })
          setArtist(foundArtist)
          // 記錄歌手瀏覽
          if (user) {
            recordArtistView(user.uid, foundArtist)
          }
          // 獲取歌手歌曲（包括合作歌曲）
          const artistTabs = await getArtistTabsWithCollabs(foundArtist.id, foundArtist.name)
          setTabs(artistTabs)
        }
      } catch (error) {
        console.error('Error loading artist:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadArtistData()
  }, [id])

  // 處理歌曲點擊
  const handleSongClick = (songId, key) => {
    const url = key ? `/tabs/${songId}?key=${key}` : `/tabs/${songId}`
    router.push(url)
  }

  // 處理 Key 選擇
  const handleKeyClick = (e, songId, key) => {
    e.stopPropagation()
    setSelectedKeys(prev => ({
      ...prev,
      [songId]: key
    }))
  }

  // SEO 配置
  const seoTitle = artist ? generateArtistTitle(artist.name, tabs.length) : ''
  const seoDescription = artist ? generateArtistDescription(artist.name, tabs.length) : ''
  const seoUrl = artist ? `${siteConfig.url}/artists/${id}` : ''
  
  const artistSchema = artist ? generateArtistSchema(artist, tabs) : null
  const breadcrumbSchema = artist ? generateBreadcrumbSchema([
    { name: '首頁', url: siteConfig.url },
    { name: '歌手', url: `${siteConfig.url}/artists` },
    { name: artist.name, url: seoUrl }
  ]) : null

  if (isLoading) {
    return (
      <Layout fullWidth>
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-[#FFD700] text-xl">載入中...</div>
        </div>
      </Layout>
    )
  }

  const sortedTabs = getSortedTabs()

  return (
    <>
      {artist && (
        <Head>
          <title>{seoTitle}</title>
          <meta name="description" content={seoDescription} />
          <link rel="canonical" href={seoUrl} />
          <meta property="og:url" content={seoUrl} />
          <meta property="og:type" content="profile" />
          <meta property="og:title" content={seoTitle} />
          <meta property="og:description" content={seoDescription} />
          <meta property="og:image" content={artist.photoURL || artist.wikiPhotoURL || `${siteConfig.url}/og-image.jpg`} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify([artistSchema, breadcrumbSchema])
            }}
          />
        </Head>
      )}
      
      <Layout fullWidth>
        <div className="min-h-screen bg-black pb-24">
          {/* 手機版 Hero - 3:2 比例 */}
          <div className="md:hidden relative w-full" style={{ aspectRatio: '3/2' }}>
            {/* 背景圖片 */}
            <ArtistHeroImage artist={artist} size="hero" />
            
            {/* 底部漸變遮罩 */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 40%, transparent 70%)'
              }}
            />
            
            {/* 歌手資訊 - 左下角 */}
            <div className="absolute bottom-0 left-0 p-4" style={{ width: '60%' }}>
              <h1 
                className="text-white font-bold leading-tight" 
                style={{ fontSize: '36px', whiteSpace: 'nowrap' }}
              >
                {artist?.name}
              </h1>
              <p className="mt-1" style={{ fontSize: '14px', color: '#aaa' }}>
                {tabs.length} 首歌
              </p>
            </div>
          </div>

          {/* 網頁版 Hero - 保持原有設計 */}
          <div className="hidden md:block relative h-[45vh]">
            <ArtistHeroImage artist={artist} size="hero" />
            
            {/* 圖片來源標示（僅 Admin 可見）*/}
            {isAdmin && (
              <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {artist.heroPhoto ? 'Hero 圖片' : 
                 artist.spotifyPhotoURL ? 'Spotify' : 
                 artist.photoURL ? '用戶上傳' : 
                 artist.wikiPhotoURL ? '維基' : '預設'}
              </div>
            )}
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 40%, transparent 70%)'
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <h1 className="text-5xl font-bold text-white mb-2">{artist?.name}</h1>
              <p className="text-gray-300">{tabs.length} 首結他譜</p>
            </div>
          </div>

          {/* 歌曲列表區域 */}
          <div className="px-4 pt-6">
            {/* 標題 */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white" style={{ fontSize: '18px' }}>熱門</h2>
            </div>

            {/* 歌曲列表 */}
            <div className="space-y-3">
              {sortedTabs.map((song, index) => {
                const selectedKey = selectedKeys[song.id] || song.originalKey || 'C'
                
                return (
                  <div
                    key={song.id}
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => handleSongClick(song.id, selectedKey)}
                  >
                    {/* 排名 */}
                    <div 
                      className="flex-shrink-0 flex items-center justify-center text-gray-500"
                      style={{ width: '20px', fontSize: '14px' }}
                    >
                      {index + 1}
                    </div>

                    {/* 縮圖 */}
                    <div 
                      className="flex-shrink-0 overflow-hidden bg-gray-800"
                      style={{ width: '60px', height: '60px', borderRadius: '4px' }}
                    >
                      {getYouTubeThumbnail(song) ? (
                        <img
                          src={getYouTubeThumbnail(song)}
                          alt={song.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-700" />
                      )}
                    </div>

                    {/* 歌曲資訊 */}
                    <div className="flex-1 min-w-0" style={{ minWidth: 0 }}>
                      {/* 歌名 */}
                      <h3 
                        className="font-bold text-white truncate group-hover:text-[#f8e119] transition"
                        style={{ fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {song.title}
                      </h3>
                      
                      {/* 瀏覽次數和評分 */}
                      <div className="flex items-center gap-3">
                        <p style={{ fontSize: '12px', color: '#888' }}>
                          {song.viewCount || 0} 瀏覽
                        </p>
                        {song.averageRating > 0 && (
                          <RatingDisplay 
                            rating={song.averageRating} 
                            count={song.ratingCount}
                            size="sm"
                          />
                        )}
                      </div>
                      
                      {/* Key 圓圈 - 一行緊貼排列 */}
                      <div 
                        className="flex overflow-hidden mt-1"
                        style={{ flexWrap: 'nowrap', gap: '0px' }}
                      >
                        {KEYS.map((key) => (
                          <button
                            key={key}
                            onClick={(e) => handleKeyClick(e, song.id, key)}
                            className="flex-shrink-0 rounded-full flex items-center justify-center transition"
                            style={{
                              width: '15px',
                              height: '15px',
                              backgroundColor: key === selectedKey ? '#f8e119' : '#645f0f',
                              color: 'black',
                              fontSize: '10px',
                              fontWeight: 400,
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer'
                            }}
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 無歌曲時 */}
            {tabs.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">暫時冇歌曲</p>
              </div>
            )}
          </div>

          {/* 求譜區 */}
          <div className="px-4 mt-8">
            <ArtistTabRequests 
              artistId={artist?.id || id} 
              artistName={artist?.name || ''}
            />
          </div>
        </div>
      </Layout>
    </>
  )
}

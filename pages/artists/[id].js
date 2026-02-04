import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { getTabsByArtist, getAllArtists } from '@/lib/tabs'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import ArtistSongsList from '@/components/ArtistSongsList'

export default function ArtistDetail() {
  const router = useRouter()
  const { id } = router.query
  const { isAdmin } = useAuth()
  const [tabs, setTabs] = useState([])
  const [artist, setArtist] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Debug 狀態
  const [debugInfo, setDebugInfo] = useState({
    urlId: null,
    artistId: null,
    queryResultCount: 0,
    allArtists: [],
    error: null
  })

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

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-800 rounded w-1/3"></div>
            <div className="bg-[#121212] rounded-xl h-64"></div>
            <div className="bg-[#121212] rounded-xl h-48"></div>
          </div>
        </div>
      </Layout>
    )
  }

  // 取得 Hero 圖片：優先使用 photoURL，其次 wikiPhotoURL
  const heroImage = artist?.photoURL || artist?.wikiPhotoURL || artist?.photo

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <Link 
          href="/artists"
          className="inline-flex items-center text-[#B3B3B3] hover:text-white transition"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回歌手列表
        </Link>

        {/* Artist Hero Section - 16:9 大圖設計 */}
        {artist && (
          <div className="relative rounded-xl overflow-hidden border border-gray-800">
            {/* Hero Image - 16:9 比例 */}
            <div className="relative w-full aspect-[16/9] md:h-[45vh] md:aspect-auto">
              {heroImage ? (
                <img 
                  src={heroImage} 
                  alt={artist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#FFD700] to-orange-500 flex items-center justify-center">
                  <span className="text-8xl">🎤</span>
                </div>
              )}
              
              {/* 漸變遮罩 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              
              {/* 歌手名稱 - 左下角 */}
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-2">
                  {artist.name}
                </h1>
                <p className="text-gray-300 text-base md:text-lg">
                  {tabs.length} 首結他譜
                </p>
              </div>
            </div>

            {/* Artist Info Section */}
            <div className="bg-[#121212] p-6">
              {/* Admin Edit Button */}
              {isAdmin && (
                <div className="flex justify-end mb-4">
                  <Link
                    href={`/artists/${id}/edit`}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    編輯歌手資料
                  </Link>
                </div>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {artist.year && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#FFD700] text-black text-sm font-medium">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {artist.year}年
                  </span>
                )}
                {artist.artistType && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-900 text-blue-200 text-sm">
                    {artist.artistType === 'male' ? '男歌手' : 
                     artist.artistType === 'female' ? '女歌手' : '組合'}
                  </span>
                )}
              </div>
              
              {/* Bio */}
              {artist.bio && (
                <p className="text-[#B3B3B3] leading-relaxed">
                  {artist.bio}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 熱門歌曲列表 - 使用新組件 */}
        {tabs.length > 0 ? (
          <ArtistSongsList 
            songs={tabs} 
            artistPhoto={heroImage}
          />
        ) : (
          <div className="text-center py-12 bg-[#121212] rounded-xl shadow-md border border-gray-800">
            <span className="text-4xl mb-4 block">🎸</span>
            <h3 className="text-lg font-medium text-white mb-2">
              暫時冇譜
            </h3>
            <p className="text-[#B3B3B3] mb-4">
              呢位歌手暫時未有譜
            </p>
            <Link
              href="/tabs/new"
              className="inline-flex items-center px-4 py-2 bg-[#FFD700] text-black rounded-lg hover:opacity-90 transition font-medium"
            >
              上傳第一個譜
            </Link>
          </div>
        )}
      </div>
    </Layout>
  )
}

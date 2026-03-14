import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { db } from '@/lib/firebase'
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from '@/lib/firestore-tracked'
import { getUserPlaylists } from '@/lib/playlistApi'
import Layout from '@/components/Layout'
import Link from '@/components/Link'
import { useAuth } from '@/contexts/AuthContext'
import { getSongThumbnail } from '@/lib/getSongThumbnail'
import { ArrowLeft } from 'lucide-react'
import { useArtistMap } from '@/lib/useArtistMap'

// 社交媒體圖標組件
const SocialIcon = ({ platform, url }) => {
  if (!url) return null
  
  const icons = {
    facebook: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    instagram: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
      </svg>
    ),
    youtube: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
    whatsapp: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
    spotify: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
      </svg>
    ),
    website: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c2.333 0 4.44.881 6.057 2.324l-1.28 1.28C15.661 4.756 13.896 4.179 12 4.179c-1.896 0-3.661.577-5.777 1.425l-1.28-1.28C7.56 2.881 9.667 2 12 2zm-8 8c0-.677.073-1.337.209-1.972l2.02.554c-.107.461-.179.939-.179 1.418 0 2.55 1.39 4.77 3.455 5.956l-.971 1.728C5.832 17.718 4 15.076 4 12zm16 0c0 3.076-1.832 5.718-4.534 6.684l-.971-1.728c2.065-1.186 3.455-3.406 3.455-5.956 0-.479-.072-.957-.179-1.418l2.02-.554c.136.635.209 1.295.209 1.972z"/>
      </svg>
    ),
    twitter: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    threads: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 960 960" role="img" aria-label="Threads">
        {/* Official Threads (Meta) logo - G/a symbol from Wikimedia Commons */}
        <path d="M404.63 392.13c-11.92-7.93-51.53-35.49-51.53-35.49 33.4-47.88 77.46-66.52 138.36-66.52 43.07 0 79.64 14.52 105.75 42 26.12 27.49 41.02 66.8 44.41 117.07 14.48 6.07 27.85 13.22 39.99 21.4 48.96 33 75.92 82.34 75.92 138.91 0 120.23-98.34 224.67-276.35 224.67-152.84 0-311.63-89.11-311.63-354.45 0-263.83 153.81-353.92 311.2-353.92 72.68 0 243.16 10.76 307.27 222.94l-60.12 15.63C678.33 213.2 574.4 189.14 479.11 189.14c-157.52 0-246.62 96.13-246.62 300.65 0 183.38 99.59 280.8 248.71 280.8 122.68 0 214.15-63.9 214.15-157.44 0-63.66-53.37-94.14-56.1-94.14-10.42 54.62-38.36 146.5-161.01 146.5-71.46 0-133.07-49.47-133.07-114.29 0-92.56 87.61-126.06 156.8-126.06 25.91 0 57.18 1.75 73.46 5.07 0-28.21-23.81-76.49-83.96-76.49-55.15-.01-69.14 17.92-86.84 38.39zm105.8 96.25c-90.13 0-101.79 38.51-101.79 62.7 0 38.86 46.07 51.74 70.65 51.74 45.06 0 91.35-12.52 98.63-107.31-22.85-5.14-39.88-7.13-67.49-7.13z" />
      </svg>
    )
  }

  const getFullUrl = (url, type) => {
    if (!url) return null
    if (url.startsWith('http')) return url
    
    const prefixes = {
      facebook: 'https://facebook.com/',
      instagram: 'https://instagram.com/',
      youtube: 'https://youtube.com/@',
      whatsapp: 'https://wa.me/',
      spotify: 'https://open.spotify.com/user/',
      twitter: 'https://twitter.com/',
      threads: 'https://threads.net/@'
    }
    
    return prefixes[type] ? prefixes[type] + url : url
  }

  const fullUrl = getFullUrl(url, platform)
  if (!fullUrl) return null

  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="w-11 h-11 rounded-full bg-[#FFD700] flex items-center justify-center text-black hover:scale-110 transition-transform"
      title={platform}
    >
      {icons[platform] || icons.website}
    </a>
  )
}

export default function PublicProfile() {
  const router = useRouter()
  const { id } = router.query
  const { user: currentUser } = useAuth()
  const { getArtistName } = useArtistMap()
  
  const [profile, setProfile] = useState(null)
  const [uploads, setUploads] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)

  useEffect(() => {
    if (id) {
      loadProfile()
    }
  }, [id])

  const loadProfile = async () => {
    setIsLoading(true)
    try {
      const userDoc = await getDoc(doc(db, 'users', id))
      
      if (!userDoc.exists()) {
        setError('用戶不存在')
        setIsLoading(false)
        return
      }

      const userData = { id: userDoc.id, ...userDoc.data() }
      
      if (userData.isPublicProfile === false && currentUser?.uid !== id) {
        setError('此用戶的個人主頁未公開')
        setIsLoading(false)
        return
      }

      setProfile(userData)
      setFollowerCount(userData.followerCount || 0)
      
      // 載入上傳的樂譜 - 獲取所有
      try {
        const tabsQuery = query(
          collection(db, 'tabs'),
          where('createdBy', '==', id),
          orderBy('createdAt', 'desc')
        )
        const tabsSnapshot = await getDocs(tabsQuery)
        setUploads(tabsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      } catch (e) {
        console.log('Error loading uploads:', e)
      }
      
      // 載入歌單
      if (userData.showPlaylists !== false) {
        try {
          const userPlaylists = await getUserPlaylists(id)
          setPlaylists(userPlaylists.slice(0, 5))
        } catch (e) {
          console.error('Error loading playlists:', e)
        }
      }

      // 檢查是否已追蹤
      if (currentUser) {
        try {
          const followDoc = await getDoc(doc(db, 'users', id, 'followers', currentUser.uid))
          setIsFollowing(followDoc.exists())
        } catch (e) {
          console.log('Error checking follow status:', e)
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      setError('載入資料失敗: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFollow = async () => {
    if (!currentUser) {
      router.push('/login')
      return
    }
    
    if (currentUser.uid === id) return
    
    try {
      const { doc, setDoc, deleteDoc, increment, updateDoc } = await import('@/lib/firestore-tracked')
      
      if (isFollowing) {
        await deleteDoc(doc(db, 'users', id, 'followers', currentUser.uid))
        await updateDoc(doc(db, 'users', id), {
          followerCount: increment(-1)
        })
        setFollowerCount(prev => Math.max(0, prev - 1))
        setIsFollowing(false)
      } else {
        await setDoc(doc(db, 'users', id, 'followers', currentUser.uid), {
          createdAt: new Date().toISOString()
        })
        await updateDoc(doc(db, 'users', id), {
          followerCount: increment(1)
        })
        setFollowerCount(prev => prev + 1)
        setIsFollowing(true)
      }
    } catch (error) {
      console.error('Follow error:', error)
    }
  }

  const totalViews = uploads.reduce((sum, tab) => sum + (tab.viewCount || 0), 0)
  const isOwnProfile = currentUser?.uid === id
  const socialMedia = profile?.socialMedia || {}
  const hasSocialLinks = Object.values(socialMedia).some(url => url && url.trim() !== '')

  if (isLoading) {
    return (
      <Layout hideHeader>
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full"></div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout hideHeader>
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <p className="text-neutral-400 mb-4">{error}</p>
            <Link href="/" className="inline-flex items-center text-[#FFD700] hover:underline" aria-label="返回首頁">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  if (!profile) return null

  return (
    <Layout>
      <div className="min-h-screen bg-black pb-24 pl-4">

        {/* Profile Header - 參考設計布局 */}
        <div className="py-6">
          {/* 第一行：頭像 + 名稱/按鈕 + 統計 */}
          <div className="flex gap-4">
            {/* 左側：頭像 */}
            <img 
              src={profile.photoURL || '/default-avatar.png'} 
              alt={profile.displayName}
              className="w-24 h-24 md:w-28 md:h-28 rounded-full object-cover border-2 border-[#FFD700] flex-shrink-0"
            />
            
            {/* 右側：名字、按鈕、統計 */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              {/* 名字 + 編輯/追蹤按鈕 同一行 */}
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-white text-2xl font-bold truncate">
                  {profile.displayName || '未命名用戶'}
                </h1>
                
                {/* 編輯按鈕 - 對自己顯示 */}
                {isOwnProfile && (
                  <Link
                    href="/profile/edit"
                    className="px-4 py-1 rounded-full text-sm font-medium bg-[#FFD700] text-black hover:opacity-90 transition flex-shrink-0"
                  >
                    編輯
                  </Link>
                )}
                
                {/* 追蹤按鈕 - 對非自己顯示 */}
                {!isOwnProfile && currentUser && (
                  <button
                    onClick={handleFollow}
                    className={`px-4 py-1 rounded-full text-sm font-medium transition flex-shrink-0 ${
                      isFollowing 
                        ? 'bg-neutral-700 text-white' 
                        : 'bg-[#FFD700] text-black'
                    }`}
                  >
                    {isFollowing ? '追蹤中' : '追蹤'}
                  </button>
                )}
                
                {/* 未登入提示 */}
                {!currentUser && !isOwnProfile && (
                  <Link
                    href="/login"
                    className="px-4 py-1 rounded-full text-sm font-medium bg-[#FFD700] text-black hover:opacity-90 transition flex-shrink-0"
                  >
                    追蹤
                  </Link>
                )}
              </div>
              
              {/* Pen Name */}
              {profile.penName && (
                <p className="text-[#FFD700] text-sm mb-3">@{profile.penName}</p>
              )}
              
              {/* 統計數字一排 - 防止換行 */}
              <div className="flex items-center gap-4 md:gap-6">
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-[#FFD700] text-lg md:text-xl font-bold">{uploads.length}</span>
                  <span className="text-neutral-400 text-xs md:text-sm">出譜</span>
                </div>
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-[#FFD700] text-lg md:text-xl font-bold">{totalViews.toLocaleString()}</span>
                  <span className="text-neutral-400 text-xs md:text-sm">瀏覽</span>
                </div>
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-[#FFD700] text-lg md:text-xl font-bold">{followerCount}</span>
                  <span className="text-neutral-400 text-xs md:text-sm">粉絲</span>
                </div>
              </div>
            </div>
          </div>

          {/* Social Media Icons - 左對齊 */}
          {hasSocialLinks && (
            <div className="flex items-center gap-3 mt-4">
              <SocialIcon platform="facebook" url={socialMedia.facebook} />
              <SocialIcon platform="instagram" url={socialMedia.instagram} />
              <SocialIcon platform="youtube" url={socialMedia.youtube} />
              <SocialIcon platform="whatsapp" url={socialMedia.whatsapp} />
              <SocialIcon platform="spotify" url={socialMedia.spotify} />
              <SocialIcon platform="website" url={socialMedia.website} />
              <SocialIcon platform="twitter" url={socialMedia.twitter} />
              <SocialIcon platform="threads" url={socialMedia.threads} />
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <p className="text-neutral-300 text-base mt-4 leading-relaxed whitespace-pre-wrap">
              {profile.bio}
            </p>
          )}
        </div>

        {/* Popular Tabs - 熱門（前5首有縮圖，參考設計風格）*/}
        {profile.showUploads !== false && uploads.length > 0 && (
          <div className="mt-6">
            <h2 className="text-white font-bold text-lg mb-4">熱門</h2>
            <div className="space-y-4">
              {uploads.slice(0, 5).map((tab, index) => {
                const thumbnail = getSongThumbnail(tab)
                return (
                  <Link key={tab.id} href={`/tabs/${tab.id}`}>
                    <div className="flex items-center gap-3 p-2 hover:bg-neutral-900/50 rounded-lg transition cursor-pointer group">
                      {/* 排名數字 */}
                      <span className="text-neutral-500 text-lg w-6 text-center flex-shrink-0">{index + 1}</span>
                      
                      {/* 封面圖 - 更大 */}
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={tab.title}
                          className="w-16 h-16 rounded object-cover flex-shrink-0 bg-neutral-800"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded bg-neutral-800 flex items-center justify-center flex-shrink-0">
                          <span className="text-2xl">🎵</span>
                        </div>
                      )}
                      
                      {/* 歌曲信息 */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate group-hover:text-[#FFD700] transition">{tab.title}</h3>
                        <p className="text-neutral-500 text-sm">{getArtistName(tab)}</p>
                      </div>
                      
                      {/* 瀏覽量 */}
                      <div className="text-right text-sm text-neutral-400 flex-shrink-0">
                        <p>{(tab.viewCount || 0).toLocaleString()} 瀏覽</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* All Songs - 所有歌曲（白色文字，無縮圖）*/}
        {profile.showUploads !== false && uploads.length > 5 && (
          <div className="mt-6">
            <h2 className="text-white font-bold text-lg mb-4">所有歌曲</h2>
            <div className="space-y-2">
              {uploads.slice(5).map((tab, index) => (
                <Link key={tab.id} href={`/tabs/${tab.id}`}>
                  <div className="flex items-center gap-3 py-3 px-2 hover:bg-neutral-900 rounded-lg transition cursor-pointer border-b border-neutral-800">
                    <span className="text-neutral-500 text-sm w-6 text-center flex-shrink-0">{index + 6}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">{tab.title}</h3>
                      <p className="text-neutral-500 text-sm">{getArtistName(tab)}</p>
                    </div>
                    <div className="text-right text-xs text-neutral-500 flex-shrink-0">
                      <p>{(tab.viewCount || 0).toLocaleString()} 瀏覽</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Playlists */}
        {profile.showPlaylists !== false && playlists.length > 0 && (
          <div className="mt-8">
            <h2 className="text-white font-bold text-lg mb-4">歌單</h2>
            <div className="space-y-3">
              {playlists.map(playlist => (
                <Link 
                  key={playlist.id}
                  href={`/library/playlist/${playlist.id}`}
                  className="flex items-center gap-3 p-3 bg-neutral-900 rounded-lg hover:bg-neutral-800 transition"
                >
                  {playlist.coverImage ? (
                    <img 
                      src={playlist.coverImage} 
                      alt={playlist.title}
                      className="w-14 h-14 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded bg-gradient-to-br from-[#FFD700]/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">🎵</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{playlist.title}</p>
                    <p className="text-neutral-500 text-sm">{playlist.songIds?.length || 0} 首歌</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

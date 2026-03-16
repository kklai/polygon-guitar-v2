import { useState, useEffect, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/router'
import { db } from '@/lib/firebase'
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from '@/lib/firestore-tracked'
import { getUserPlaylists } from '@/lib/playlistApi'
import Layout from '@/components/Layout'
import Link from '@/components/Link'
import { useAuth } from '@/contexts/AuthContext'
import { getSongThumbnail } from '@/lib/getSongThumbnail'
import { ArrowLeft, MoreVertical, Pencil, PenLine, ChevronDown, ChevronUp, Eye, Heart, Bookmark, Music } from 'lucide-react'
import { useArtistMap } from '@/lib/useArtistMap'
import { PROFILE_SOCIAL_ICONS } from '@/components/ProfileSocialIcons'
import { PlaylistCard } from '@/components/LazyImage'

// 社交媒體圖標組件（icon 與 edit 頁共用 PROFILE_SOCIAL_ICONS）
const SocialIcon = ({ platform, url }) => {
  if (!url) return null

  const getFullUrl = (url, type) => {
    if (!url) return null
    if (url.startsWith('http')) return url
    
    const prefixes = {
      facebook: 'https://facebook.com/',
      instagram: 'https://instagram.com/',
      youtube: 'https://youtube.com/@',
      whatsapp: 'https://wa.me/',
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
      className="w-12 h-12 rounded-full bg-[#FFD700] flex items-center justify-center text-black hover:scale-110 transition-transform"
      title={platform}
    >
      {PROFILE_SOCIAL_ICONS[platform] || PROFILE_SOCIAL_ICONS.website}
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
  const [bioExpanded, setBioExpanded] = useState(false)
  const [showProfileMore, setShowProfileMore] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [allTabsExpanded, setAllTabsExpanded] = useState(false)
  const ALL_TABS_INITIAL = 10

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

    setFollowLoading(true)
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
      alert('追蹤操作失敗，請稍後再試。如持續發生請確認 Firestore 規則已部署。')
    } finally {
      setFollowLoading(false)
    }
  }

  const totalViews = uploads.reduce((sum, tab) => sum + (tab.viewCount || 0), 0)
  // 熱門：按瀏覽量取頭 5 首；其餘為所有出譜（保持上傳時間序）
  const popularTabs = [...uploads].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 5)
  const popularIds = new Set(popularTabs.map(t => t.id))
  const otherTabs = uploads.filter(t => !popularIds.has(t.id))
  const isOwnProfile = currentUser?.uid === id
  const socialMedia = profile?.socialMedia || {}
  const hasSocialLinks = Object.values(socialMedia).some(url => url && url.trim() !== '')

  useEffect(() => {
    if (typeof document === 'undefined' || !showProfileMore) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [showProfileMore])

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

  const BIO_COLLAPSED_LINES = 3
  const bioLines = profile.bio ? profile.bio.split('\n') : []
  const bioIsLong = bioLines.length > BIO_COLLAPSED_LINES
  const bioDisplay = profile.bio && (bioExpanded || !bioIsLong)
    ? profile.bio
    : bioLines.slice(0, BIO_COLLAPSED_LINES).join('\n')

  return (
    <Layout>
      <div className="min-h-screen bg-black pb-24 px-4">

        {/* Profile Header - 依 wireframe: photo | name+follow → 統計 → contact 全寬 → description + button */}
        <div className="max-w-2xl mx-auto pt-4 pb-2 relative">
          {/* 右上角：更多（僅自己 profile 顯示）*/}
          {isOwnProfile && (
            <button
              type="button"
              onClick={() => setShowProfileMore(true)}
              className="absolute top-0 right-0 p-2 rounded-full text-[#B3B3B3] hover:text-white hover:bg-white/10 transition"
              aria-label="更多"
            >
              <MoreVertical className="w-6 h-6" />
            </button>
          )}
          {/* 上排：photo + name + follow */}
          <div className="flex gap-4">
            <img
              src={profile.photoURL || '/default-avatar.png'}
              alt={profile.displayName}
              className="w-24 h-24 md:w-28 md:h-28 rounded-full object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0 flex flex-col justify-center -mt-3">
              <div className="flex items-center gap-3 mb-0 flex-wrap">
                <h1 className="text-white text-lg md:text-xl font-bold truncate">
                  {profile.displayName || '未命名用戶'}
                </h1>
                {isOwnProfile && (
                  <Link
                    href="/profile/edit"
                    className="mt-3 px-4 py-1.5 rounded-full text-sm font-medium bg-neutral-700 text-white hover:bg-neutral-600 transition flex-shrink-0 border border-neutral-600"
                  >
                    編輯
                  </Link>
                )}
                {!isOwnProfile && currentUser && (
                  <button
                    type="button"
                    onClick={handleFollow}
                    disabled={followLoading}
                    className={`mt-3 px-4 py-1.5 rounded-full text-sm font-medium transition flex-shrink-0 border border-[#FFD700] disabled:opacity-60 ${
                      isFollowing ? 'bg-neutral-800 text-[#FFD700]' : 'bg-[#FFD700] text-black'
                    }`}
                  >
                    {followLoading ? '處理中...' : (isFollowing ? '追蹤中' : '追蹤')}
                  </button>
                )}
                {!currentUser && !isOwnProfile && (
                  <Link
                    href="/login"
                    className="mt-3 px-4 py-1.5 rounded-full text-sm font-medium border border-[#FFD700] bg-[#FFD700] text-black hover:opacity-90 transition flex-shrink-0 inline-block"
                  >
                    追蹤
                  </Link>
                )}
              </div>
              {profile.penName && (
                <p className="text-[#FFD700] text-sm flex items-center gap-1 -mt-3 mb-3">
                  <PenLine className="w-3.5 h-3.5 flex-shrink-0" />
                  {profile.penName}
                </p>
              )}
              {/* 統計：對齊右欄，數字在上、標籤在下（02 設計：白字）*/}
              <div className="flex gap-6 md:gap-10">
                <div className="flex flex-col gap-0 leading-tight">
                  <span className="text-white text-lg md:text-xl font-bold">{uploads.length}</span>
                  <span className="text-white/80 text-xs -mt-0.5">出譜數目</span>
                </div>
                <div className="flex flex-col gap-0 leading-tight">
                  <span className="text-white text-lg md:text-xl font-bold">{totalViews >= 1000 ? (totalViews / 1000).toFixed(1) + 'k' : totalViews.toLocaleString()}</span>
                  <span className="text-white/80 text-xs -mt-0.5">總瀏覽量</span>
                </div>
                <div className="flex flex-col gap-0 leading-tight">
                  <span className="text-white text-lg md:text-xl font-bold">{followerCount >= 1000 ? (followerCount / 1000).toFixed(0) + 'k' : String(followerCount)}</span>
                  <span className="text-white/80 text-xs -mt-0.5">粉絲</span>
                </div>
              </div>
            </div>
          </div>

          {/* Contact link - 全寬、置中（02：黑底上一排黃色圓鈕）*/}
          {hasSocialLinks && (
            <div className="w-full pt-4 pb-3 mt-0">
              <div className="flex items-center gap-3 flex-wrap">
                <SocialIcon platform="facebook" url={socialMedia.facebook} />
                <SocialIcon platform="instagram" url={socialMedia.instagram} />
                <SocialIcon platform="youtube" url={socialMedia.youtube} />
                <span className="inline-block -mt-0.5"><SocialIcon platform="whatsapp" url={socialMedia.whatsapp} /></span>
                <SocialIcon platform="website" url={socialMedia.website} />
                <SocialIcon platform="threads" url={socialMedia.threads} />
              </div>
            </div>
          )}

          {/* Description + 顯示全部 按鈕在右下（wireframe: description block + button）*/}
          {profile.bio && (
            <div className="mt-0 flex flex-col items-stretch">
              <div
                className={bioIsLong && !bioExpanded ? 'overflow-hidden' : ''}
                style={bioIsLong && !bioExpanded ? {
                  maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)'
                } : undefined}
              >
                <p className="text-[#B3B3B3] text-sm leading-relaxed whitespace-pre-wrap">
                  {bioDisplay}
                  {bioIsLong && !bioExpanded && '……'}
                </p>
              </div>
              {bioIsLong && (
                <div className="flex justify-start mt-2">
                  <button
                    type="button"
                    onClick={() => setBioExpanded(!bioExpanded)}
                    className="flex items-center gap-1 text-white/90 text-xs hover:text-[#FFD700] transition"
                  >
                    {bioExpanded ? (
                      <>
                        收起
                        <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" />
                      </>
                    ) : (
                      <>
                        顯示全部
                        <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 熱門 / 所有出譜 / 自創歌單 - 統一容器 */}
        <div className="max-w-2xl mx-auto mt-4 space-y-4">
          {profile.showUploads !== false && uploads.length > 0 && (
            <section>
              <h2 className="text-white font-bold text-lg mb-0">熱門</h2>
              <div className="space-y-0">
                {popularTabs.map((tab) => {
                  const thumbnail = getSongThumbnail(tab)
                  return (
                    <Link key={tab.id} href={`/tabs/${tab.id}`}>
                      <div className="flex items-center gap-3 py-1.5 pl-0 pr-3 rounded-lg hover:bg-[#181818] transition cursor-pointer group">
                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt={tab.title}
                            className="w-12 h-12 rounded-[4px] object-cover flex-shrink-0 bg-[#282828]"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-[4px] bg-[#282828] flex items-center justify-center flex-shrink-0">
                            <Music className="w-5 h-5 text-neutral-500" strokeWidth={1.5} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white text-sm font-medium truncate group-hover:text-[#FFD700] transition">{tab.title}</h3>
                          <p className="text-[#B3B3B3] text-xs">{getArtistName(tab)}</p>
                        </div>
<div className="text-[#B3B3B3] text-xs flex-shrink-0 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          {(tab.viewCount || 0).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-0">
                          <Heart className="w-3.5 h-3.5 text-neutral-500 fill-neutral-500 flex-shrink-0" />
                          <Bookmark className="w-3.5 h-3.5 text-neutral-500 fill-neutral-500 flex-shrink-0" />
                          {(tab.likes ?? 0) + (tab.playlistCount ?? 0)}
                        </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {profile.showUploads !== false && otherTabs.length > 0 && (
            <section>
              <h2 className="text-white font-bold text-lg mb-2">所有出譜 <span className="text-[#B3B3B3] font-normal text-base">({otherTabs.length})</span></h2>
              <div className="space-y-0">
                {(allTabsExpanded ? otherTabs : otherTabs.slice(0, ALL_TABS_INITIAL)).map((tab, index) => (
                  <Fragment key={tab.id}>
                    {index > 0 && <div className="h-px bg-neutral-800 min-w-full" aria-hidden="true" />}
                    <Link href={`/tabs/${tab.id}`}>
                      <div className="flex items-center gap-3 py-2 pl-0 pr-3 hover:bg-[#181818] transition rounded-lg">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white text-sm font-medium truncate">{tab.title}</h3>
                        <p className="text-[#B3B3B3] text-xs">{getArtistName(tab)}</p>
                      </div>
                      <div className="text-[#B3B3B3] text-xs flex-shrink-0 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          {(tab.viewCount || 0).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-0">
                          <Heart className="w-3.5 h-3.5 text-neutral-500 fill-neutral-500 flex-shrink-0" />
                          <Bookmark className="w-3.5 h-3.5 text-neutral-500 fill-neutral-500 flex-shrink-0" />
                          {(tab.likes ?? 0) + (tab.playlistCount ?? 0)}
                        </span>
                      </div>
                    </div>
                  </Link>
                  </Fragment>
                ))}
                {otherTabs.length > ALL_TABS_INITIAL && !allTabsExpanded && (
                  <div className="flex justify-center mt-3">
                    <button
                      type="button"
                      onClick={() => setAllTabsExpanded(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-neutral-600 text-white/90 text-xs hover:text-[#FFD700] hover:border-[#FFD700]/50 transition"
                    >
                      顯示全部
                      <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {profile.showPlaylists !== false && playlists.length > 0 && (
            <section className="-mt-1" style={{ marginBottom: 25 }}>
              <h2 className="text-white font-bold text-lg mb-2">自創歌單</h2>
              <div className="flex overflow-x-auto scrollbar-hide pr-6 py-2 -my-2 gap-3">
                {playlists.map(playlist => (
                  <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    href={`/library/playlist/${playlist.id}`}
                    compact
                    small
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Profile 更多 Menu - 底部彈出，僅「編輯個人資料」*/}
      {showProfileMore && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 bg-black/60 z-[9999]" onClick={() => setShowProfileMore(false)} aria-hidden />
          <div
            className="fixed bottom-0 left-0 right-0 bg-[#121212] rounded-t-3xl z-[9999] overflow-hidden animate-slide-up"
            style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0))' }}
          >
            <div className="flex flex-col items-center py-2 px-12">
              <div className="w-10 h-1 rounded-full bg-[#525252]" />
            </div>
            <div className="px-4 pb-4">
              <Link
                href="/profile/edit"
                onClick={() => setShowProfileMore(false)}
                className="w-full flex items-center gap-3 py-3.5 rounded-2xl text-left md:hover:bg-white/5 transition text-white"
              >
                <Pencil className="w-5 h-5 text-[#B3B3B3] shrink-0" />
                編輯個人資料
              </Link>
            </div>
          </div>
        </>,
        document.body
      )}
    </Layout>
  )
}

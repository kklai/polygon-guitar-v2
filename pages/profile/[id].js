import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { db } from '@/lib/firebase'
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'
import Layout from '@/components/Layout'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import TabCard from '@/components/TabCard'

// 選項對照表
const EXPERIENCE_LABELS = {
  'beginner': '初學者（少於1年）',
  '1-2': '1-2年',
  '3-5': '3-5年',
  '6-10': '6-10年',
  '10+': '10年以上',
  'pro': '專業演奏'
}

const STYLE_LABELS = {
  'sing-play': '自彈自唱',
  'accompaniment': '伴奏',
  'fingerstyle': '指彈',
  'lead': '主音結他',
  'all': '全部都有'
}

const LOCATION_LABELS = {
  'home': '家中',
  'studio': 'Band房/練習室',
  'school': '學校',
  'park': '公園/街頭',
  'cafe': '咖啡廳',
  'church': '教會',
  'online': '線上直播'
}

const CHORDS_LABELS = {
  'open': '開放和弦',
  'barre': 'Barre 和弦',
  'jazz': 'Jazz 和弦',
  'power': 'Power Chords',
  'sus': 'Sus4 / Add9',
  'all': '全部我都鍾意'
}

export default function PublicProfile() {
  const router = useRouter()
  const { id } = router.query
  const { user: currentUser } = useAuth()
  
  const [profile, setProfile] = useState(null)
  const [uploads, setUploads] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [currentlyPracticing, setCurrentlyPracticing] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (id) {
      loadProfile()
    }
  }, [id])

  const loadProfile = async () => {
    setIsLoading(true)
    try {
      // 載入用戶資料
      const userDoc = await getDoc(doc(db, 'users', id))
      
      if (!userDoc.exists()) {
        setError('用戶不存在')
        setIsLoading(false)
        return
      }

      const userData = { id: userDoc.id, ...userDoc.data() }
      
      // 檢查是否公開
      if (userData.isPublicProfile === false && currentUser?.uid !== id) {
        setError('此用戶的個人主頁未公開')
        setIsLoading(false)
        return
      }

      setProfile(userData)
      
      // 載入最近瀏覽的譜（如果有 userId 記錄）
      if (currentUser?.uid === id) {
        const viewsQuery = query(
          collection(db, 'pageViews'),
          where('userId', '==', id),
          where('pageType', '==', 'tab'),
          orderBy('timestamp', 'desc'),
          limit(5)
        )
        try {
          const viewsSnapshot = await getDocs(viewsQuery)
          const recentTabIds = viewsSnapshot.docs
            .map(doc => doc.data().pageId)
            .filter((v, i, a) => a.indexOf(v) === i) // 去重
            .slice(0, 5)
          
          // 載入譜詳情
          if (recentTabIds.length > 0) {
            const recentTabs = []
            for (const tabId of recentTabIds) {
              if (tabId) {
                const tabDoc = await getDoc(doc(db, 'songs', tabId))
                if (tabDoc.exists()) {
                  recentTabs.push({ id: tabDoc.id, ...tabDoc.data() })
                }
              }
            }
            setRecentlyViewed(recentTabs)
          }
        } catch (e) {
          console.log('No recent views available')
        }
      }

      // 載入上傳的樂譜
      if (userData.showUploads !== false) {
        const tabsQuery = query(
          collection(db, 'songs'),
          where('uploaderId', '==', id),
          orderBy('createdAt', 'desc'),
          limit(10)
        )
        const tabsSnapshot = await getDocs(tabsQuery)
        setUploads(tabsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      }

      // 載入歌單
      if (userData.showPlaylists !== false) {
        const playlistsQuery = query(
          collection(db, 'playlists'),
          where('createdBy', '==', id),
          orderBy('createdAt', 'desc'),
          limit(5)
        )
        const playlistsSnapshot = await getDocs(playlistsQuery)
        setPlaylists(playlistsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      }

      // 載入「正在練習」
      if (userData.currentlyPracticing) {
        const tabDoc = await getDoc(doc(db, 'songs', userData.currentlyPracticing))
        if (tabDoc.exists()) {
          setCurrentlyPracticing({ id: tabDoc.id, ...tabDoc.data() })
        }
      }

    } catch (error) {
      console.error('Error loading profile:', error)
      setError('載入資料失敗')
    } finally {
      setIsLoading(false)
    }
  }

  const isOwnProfile = currentUser?.uid === id

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full"></div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 mb-4">{error}</p>
            <Link href="/" className="text-[#FFD700] hover:underline">
              返回首頁
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  if (!profile) return null

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {/* Header Card */}
        <div className="bg-[#121212] rounded-2xl border border-gray-800 overflow-hidden mb-6">
          {/* Cover */}
          <div className="h-32 bg-gradient-to-r from-[#FFD700]/20 to-[#FFD700]/5"></div>
          
          {/* Profile Info */}
          <div className="px-6 pb-6">
            <div className="flex flex-col md:flex-row items-center md:items-end -mt-12 mb-4">
              <img 
                src={profile.photoURL || '/default-avatar.png'} 
                alt={profile.displayName}
                className="w-24 h-24 rounded-full border-4 border-[#121212] object-cover"
              />
              <div className="mt-4 md:mt-0 md:ml-4 text-center md:text-left flex-1">
                <h1 className="text-2xl font-bold text-white">{profile.displayName || '未命名用戶'}</h1>
                {profile.penName && (
                  <p className="text-[#FFD700] text-sm">✏️ 編譜筆名：{profile.penName}</p>
                )}
                <p className="text-gray-400 text-sm">{profile.email}</p>
              </div>
              {isOwnProfile && (
                <Link
                  href="/profile/edit"
                  className="mt-4 md:mt-0 px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition"
                >
                  編輯資料
                </Link>
              )}
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="text-gray-300 mt-4">{profile.bio}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#121212] rounded-xl border border-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-[#FFD700]">{uploads.length}</p>
            <p className="text-sm text-gray-400">上傳樂譜</p>
          </div>
          <div className="bg-[#121212] rounded-xl border border-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-[#FFD700]">{playlists.length}</p>
            <p className="text-sm text-gray-400">歌單</p>
          </div>
          <div className="bg-[#121212] rounded-xl border border-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-[#FFD700]">
              {EXPERIENCE_LABELS[profile.guitarExperience] || '-'}
            </p>
            <p className="text-sm text-gray-400">彈結他經驗</p>
          </div>
        </div>

        {/* Currently Practicing */}
        {currentlyPracticing && (
          <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-6">
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <span>🎸</span> 正在練習
            </h2>
            <Link 
              href={`/tabs/${currentlyPracticing.id}`}
              className="flex items-center gap-4 p-4 bg-gray-900 rounded-lg hover:bg-gray-800 transition"
            >
              {currentlyPracticing.thumbnail && (
                <img 
                  src={currentlyPracticing.thumbnail} 
                  alt={currentlyPracticing.title}
                  className="w-16 h-12 rounded object-cover"
                />
              )}
              <div>
                <p className="text-white font-medium">{currentlyPracticing.title}</p>
                <p className="text-sm text-gray-400">{currentlyPracticing.artist}</p>
              </div>
            </Link>
            {isOwnProfile && (
              <button
                onClick={() => router.push('/profile/practicing')}
                className="mt-3 text-sm text-[#FFD700] hover:underline"
              >
                更改正在練習的歌曲
              </button>
            )}
          </div>
        )}

        {/* Music Profile */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-medium text-white mb-4">🎵 音樂人檔案</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.favoriteArtist && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎤</span>
                <div>
                  <p className="text-sm text-gray-400">最喜歡的歌手</p>
                  <p className="text-white">{profile.favoriteArtist}</p>
                </div>
              </div>
            )}
            
            {profile.favoriteKey && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎼</span>
                <div>
                  <p className="text-sm text-gray-400">最喜歡的 Key</p>
                  <p className="text-white">{profile.favoriteKey}</p>
                </div>
              </div>
            )}
            
            {profile.playingStyle && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎸</span>
                <div>
                  <p className="text-sm text-gray-400">演奏風格</p>
                  <p className="text-white">{STYLE_LABELS[profile.playingStyle] || profile.playingStyle}</p>
                </div>
              </div>
            )}
            
            {profile.favoriteChords && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎹</span>
                <div>
                  <p className="text-sm text-gray-400">最喜歡的和弦</p>
                  <p className="text-white">{CHORDS_LABELS[profile.favoriteChords] || profile.favoriteChords}</p>
                </div>
              </div>
            )}
            
            {profile.practiceLocation && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">📍</span>
                <div>
                  <p className="text-sm text-gray-400">練習地點</p>
                  <p className="text-white">{LOCATION_LABELS[profile.practiceLocation] || profile.practiceLocation}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Uploads */}
        {profile.showUploads !== false && uploads.length > 0 && (
          <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-6">
            <h2 className="text-lg font-medium text-white mb-4">📝 上傳的樂譜</h2>
            
            <div className="grid grid-cols-1 gap-3">
              {uploads.slice(0, 5).map(tab => (
                <TabCard key={tab.id} tab={tab} compact />
              ))}
            </div>
            
            {uploads.length > 5 && (
              <p className="text-center text-gray-400 text-sm mt-4">
                還有 {uploads.length - 5} 份樂譜...
              </p>
            )}
          </div>
        )}

        {/* Playlists */}
        {profile.showPlaylists !== false && playlists.length > 0 && (
          <div className="bg-[#121212] rounded-xl border border-gray-800 p-6">
            <h2 className="text-lg font-medium text-white mb-4">🎵 歌單</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {playlists.map(playlist => (
                <Link 
                  key={playlist.id}
                  href={`/playlist/${playlist.id}`}
                  className="p-4 bg-gray-900 rounded-lg hover:bg-gray-800 transition"
                >
                  {playlist.coverImage && (
                    <img 
                      src={playlist.coverImage} 
                      alt={playlist.title}
                      className="w-full h-32 object-cover rounded-lg mb-3"
                    />
                  )}
                  <p className="text-white font-medium">{playlist.title}</p>
                  <p className="text-sm text-gray-400">{playlist.songIds?.length || 0} 首歌</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 最近瀏覽（只有本人看到） */}
        {isOwnProfile && recentlyViewed.length > 0 && (
          <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-6">
            <h2 className="text-lg font-medium text-white mb-4">👁️ 最近瀏覽</h2>
            <div className="grid grid-cols-1 gap-3">
              {recentlyViewed.map(tab => (
                <TabCard key={tab.id} tab={tab} compact />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!currentlyPracticing && uploads.length === 0 && playlists.length === 0 && recentlyViewed.length === 0 && (
          <div className="bg-[#121212] rounded-xl border border-gray-800 p-12 text-center">
            <p className="text-gray-400">此用戶暫時沒有公開內容</p>
          </div>
        )}
      </div>
    </Layout>
  )
}

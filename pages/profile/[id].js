import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { db } from '@/lib/firebase'
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import Layout from '@/components/Layout'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

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
      // 淨係載入用戶基本資料
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
      
      // 載入上傳的樂譜
      try {
        const tabsQuery = query(
          collection(db, 'tabs'),
          where('uploaderId', '==', id),
          orderBy('createdAt', 'desc'),
          limit(10)
        )
        const tabsSnapshot = await getDocs(tabsQuery)
        setUploads(tabsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      } catch (e) {
        console.log('Error loading uploads:', e)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      setError('載入資料失敗: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const isOwnProfile = currentUser?.uid === id

  // 生成個人簡介句子
  const generateBioSentence = () => {
    if (!profile) return ''
    
    const parts = []
    
    if (profile.guitarExperience && EXPERIENCE_LABELS[profile.guitarExperience]) {
      parts.push(EXPERIENCE_LABELS[profile.guitarExperience] + '結他手')
    }
    
    if (profile.practiceLocation && LOCATION_LABELS[profile.practiceLocation]) {
      parts.push('鍾意喺' + LOCATION_LABELS[profile.practiceLocation] + '練習')
    }
    
    if (profile.playingStyle && STYLE_LABELS[profile.playingStyle]) {
      parts.push(STYLE_LABELS[profile.playingStyle])
    }
    
    if (profile.favoriteChords && CHORDS_LABELS[profile.favoriteChords]) {
      parts.push('最愛用' + CHORDS_LABELS[profile.favoriteChords])
    }
    
    if (parts.length === 0) return profile.bio || ''
    
    return '「' + parts.join('，') + '。」'
  }

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

            {/* Bio 句子 */}
            {generateBioSentence() && (
              <p className="text-gray-300 mt-4 text-lg">{generateBioSentence()}</p>
            )}
            
            {/* 原有 Bio */}
            {profile.bio && !generateBioSentence().includes(profile.bio) && (
              <p className="text-gray-400 mt-2 text-sm">{profile.bio}</p>
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
            <p className="text-2xl font-bold text-[#FFD700]">-</p>
            <p className="text-sm text-gray-400">歌單</p>
          </div>
          <div className="bg-[#121212] rounded-xl border border-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-[#FFD700]">
              {EXPERIENCE_LABELS[profile.guitarExperience] || '-'}
            </p>
            <p className="text-sm text-gray-400">彈結他經驗</p>
          </div>
        </div>

        {/* Uploads */}
        {uploads.length > 0 && (
          <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-6">
            <h2 className="text-lg font-medium text-white mb-4">📝 上傳的樂譜</h2>
            <div className="space-y-3">
              {uploads.map(tab => (
                <Link key={tab.id} href={`/tabs/${tab.id}`}>
                  <div className="flex items-center gap-4 p-3 bg-gray-900 rounded-lg hover:bg-gray-800 transition cursor-pointer">
                    {tab.thumbnail && (
                      <img
                        src={tab.thumbnail}
                        alt={tab.title}
                        className="w-16 h-12 rounded object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">{tab.title}</h3>
                      <p className="text-sm text-gray-500">{tab.artist}</p>
                    </div>
                    <div className="text-right text-xs text-gray-400">
                      {tab.viewCount !== undefined && <div>👁 {tab.viewCount}</div>}
                      {tab.likes !== undefined && <div>❤ {tab.likes}</div>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 text-center text-gray-400">
          <p>更多功能開發中...</p>
        </div>
      </div>
    </Layout>
  )
}

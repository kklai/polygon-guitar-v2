import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { uploadToCloudinary, validateImageFile } from '@/lib/cloudinary'
import Link from 'next/link'
import { useRouter } from 'next/router'

// 默認選項（會從資料庫覆蓋）
const DEFAULT_OPTIONS = {
  experience: [
    { value: '', label: '請選擇...' },
    { value: 'beginner', label: '初學者（少於1年）' },
    { value: '1-2', label: '1-2年' },
    { value: '3-5', label: '3-5年' },
    { value: '6-10', label: '6-10年' },
    { value: '10+', label: '10年以上' },
    { value: 'pro', label: '專業演奏' }
  ],
  style: [
    { value: '', label: '請選擇...' },
    { value: 'sing-play', label: '自彈自唱' },
    { value: 'accompaniment', label: '伴奏' },
    { value: 'fingerstyle', label: '指彈' },
    { value: 'lead', label: '主音結他' },
    { value: 'all', label: '全部都有' }
  ],
  location: [
    { value: '', label: '請選擇...' },
    { value: 'home', label: '家中' },
    { value: 'studio', label: 'Band房/練習室' },
    { value: 'school', label: '學校' },
    { value: 'park', label: '公園/街頭' },
    { value: 'cafe', label: '咖啡廳' },
    { value: 'church', label: '教會' },
    { value: 'online', label: '線上直播' }
  ],
  chords: [
    { value: '', label: '請選擇...' },
    { value: 'open', label: '開放和弦 (C, G, D, Am, Em)' },
    { value: 'barre', label: 'Barre 和弦 (F, Bm)' },
    { value: 'jazz', label: 'Jazz 和弦 (maj7, m7, 9th)' },
    { value: 'power', label: 'Power Chords' },
    { value: 'sus', label: 'Sus4 / Add9 和弦' },
    { value: 'all', label: '全部我都鍾意' }
  ]
}

const FAVORITE_KEY_OPTIONS = [
  { value: '', label: '請選擇...' },
  { value: 'C', label: 'C Major' },
  { value: 'G', label: 'G Major' },
  { value: 'D', label: 'D Major' },
  { value: 'A', label: 'A Major' },
  { value: 'E', label: 'E Major' },
  { value: 'F', label: 'F Major' },
  { value: 'Bb', label: 'Bb Major' },
  { value: 'Am', label: 'A Minor' },
  { value: 'Em', label: 'E Minor' },
  { value: 'Dm', label: 'D Minor' },
  { value: 'all', label: '全部都可以' }
]

// 社交媒體配置
const SOCIAL_MEDIA_CONFIG = [
  { key: 'facebook', label: 'Facebook', placeholder: '用戶名或完整網址', icon: 'f' },
  { key: 'instagram', label: 'Instagram', placeholder: '用戶名（不用 @）', icon: '📷' },
  { key: 'youtube', label: 'YouTube', placeholder: '頻道名或 @用戶名', icon: '▶️' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: '電話號碼（如 85291234567）', icon: '💬' },
  { key: 'spotify', label: 'Spotify', placeholder: '用戶名或 Spotify 連結', icon: '🎵' },
  { key: 'twitter', label: 'X (Twitter)', placeholder: '用戶名（不用 @）', icon: '𝕏' },
  { key: 'threads', label: 'Threads', placeholder: '用戶名（不用 @）', icon: '🧵' },
  { key: 'website', label: '個人網站', placeholder: 'https://...', icon: '🌐' }
]

// 自動生成簡介組件
function AutoBioGenerator({ formData, bioOptions, onBioChange }) {
  const [bioConfig, setBioConfig] = useState(null)
  const [selectedStyle, setSelectedStyle] = useState('normal')
  const [generatedBio, setGeneratedBio] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  // 載入 Bio 配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore')
        const { db } = await import('@/lib/firebase')
        const bioDoc = await getDoc(doc(db, 'settings', 'profileBio'))
        if (bioDoc.exists()) {
          setBioConfig(bioDoc.data())
        }
      } catch (e) {
        console.log('Bio config not found')
      }
    }
    loadConfig()
  }, [])

  // 生成簡介
  useEffect(() => {
    if (!bioConfig) return
    
    const style = bioConfig.styles?.find(s => s.id === selectedStyle) || {
      prefix: '「',
      suffix: '。」',
      connector: '，'
    }
    
    const parts = []
    
    // 根據問題 ID 對應 formData 欄位
    const fieldMap = {
      'experience': 'guitarExperience',
      'style': 'playingStyle',
      'location': 'practiceLocation',
      'chords': 'favoriteChords'
    }
    
    bioConfig.questions?.forEach(q => {
      const fieldName = fieldMap[q.id]
      const answer = formData[fieldName]
      if (answer) {
        const option = q.options.find(o => o.value === answer)
        if (option && option.sentences?.[selectedStyle]) {
          parts.push(option.sentences[selectedStyle])
        }
      }
    })
    
    const bio = parts.length > 0 
      ? style.prefix + parts.join(style.connector) + style.suffix
      : ''
    
    setGeneratedBio(bio)
  }, [formData, bioConfig, selectedStyle])

  const applyGeneratedBio = () => {
    onBioChange(generatedBio)
  }

  const styles = bioConfig?.styles || [
    { id: 'normal', name: '普通' },
    { id: 'humor', name: '幽默' },
    { id: 'serious', name: '認真' },
    { id: 'sincere', name: '誠懇' },
    { id: 'teacher', name: '老師' }
  ]

  return (
    <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-6">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            ✨ 自動生成簡介
            <span className="text-xs font-normal text-gray-400">（可選）</span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {isExpanded ? '回答問題，系統會幫你生成簡介' : '點擊展開，快速生成個人簡介'}
          </p>
        </div>
        <svg 
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* 風格選擇 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">選擇風格</label>
            <div className="flex flex-wrap gap-2">
              {styles.map(style => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={`px-3 py-1.5 rounded-full text-sm transition ${
                    selectedStyle === style.id
                      ? 'bg-[#FFD700] text-black'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {style.name}
                </button>
              ))}
            </div>
          </div>

          {/* 預覽 */}
          <div className="bg-black rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-xs">預覽：</span>
              {generatedBio && (
                <button
                  onClick={() => navigator.clipboard.writeText(generatedBio)}
                  className="text-xs text-[#FFD700] hover:underline"
                >
                  複製
                </button>
              )}
            </div>
            <p className="text-white min-h-[3rem]">
              {generatedBio || '（回答上方的音樂檔案問題，這裡會顯示生成的簡介）'}
            </p>
          </div>

          {/* 操作按鈜 */}
          <div className="flex gap-3">
            <button
              onClick={applyGeneratedBio}
              disabled={!generatedBio}
              className="flex-1 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              使用這段簡介
            </button>
          </div>

          {/* 手動編輯區 */}
          <div className="pt-4 border-t border-gray-800">
            <label className="block text-sm text-gray-400 mb-2">
              或自行編輯
              <span className="text-xs text-gray-500 ml-1">（可複製上方修改）</span>
            </label>
            <textarea
              value={formData.bio || ''}
              onChange={(e) => onBioChange(e.target.value)}
              placeholder="例如：大家好，我係Kermit，彈結他十年，鍾意自彈自唱，歡迎交流..."
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 outline-none resize-none"
              rows={4}
            />
          </div>

          <p className="text-gray-500 text-xs">
            💡 小提示：不需要回答所有問題，選擇你想分享的即可。生成的簡介可以複製後自行修改。
          </p>
        </div>
      )}
    </div>
  )
}

export default function EditProfile() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef(null)
  
  const [formData, setFormData] = useState({
    displayName: '',
    penName: '',
    bio: '',
    guitarExperience: '',
    favoriteArtist: '',
    favoriteKey: '',
    playingStyle: '',
    favoriteChords: '',
    practiceLocation: '',
    photoURL: '',
    isPublicProfile: true,
    showPlaylists: true,
    showUploads: true,
    socialMedia: {}
  })
  
  const [originalData, setOriginalData] = useState(null)
  const [bioOptions, setBioOptions] = useState(DEFAULT_OPTIONS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
      return
    }
    
    if (user) {
      loadUserProfile()
    }
  }, [user, authLoading, router])

  const loadUserProfile = async () => {
    try {
      // 同時載入 Bio 配置
      try {
        const bioDoc = await getDoc(doc(db, 'settings', 'profileBio'))
        if (bioDoc.exists()) {
          const config = bioDoc.data()
          setBioOptions({
            experience: [{ value: '', label: '請選擇...' }, ...(config.experience?.options || DEFAULT_OPTIONS.experience.slice(1))],
            style: [{ value: '', label: '請選擇...' }, ...(config.style?.options || DEFAULT_OPTIONS.style.slice(1))],
            location: [{ value: '', label: '請選擇...' }, ...(config.location?.options || DEFAULT_OPTIONS.location.slice(1))],
            chords: [{ value: '', label: '請選擇...' }, ...(config.chords?.options || DEFAULT_OPTIONS.chords.slice(1))]
          })
        }
      } catch (e) {
        console.log('Bio config not found')
      }
      
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (userDoc.exists()) {
        const data = userDoc.data()
        const profileData = {
          displayName: data.displayName || user.displayName || '',
          penName: data.penName || data.displayName || user.displayName || '',
          bio: data.bio || '',
          guitarExperience: data.guitarExperience || '',
          favoriteArtist: data.favoriteArtist || '',
          favoriteKey: data.favoriteKey || '',
          playingStyle: data.playingStyle || '',
          favoriteChords: data.favoriteChords || '',
          practiceLocation: data.practiceLocation || '',
          photoURL: data.photoURL || user.photoURL || '',
          isPublicProfile: data.isPublicProfile !== false,
          showPlaylists: data.showPlaylists !== false,
          showUploads: data.showUploads !== false,
          socialMedia: data.socialMedia || {}
        }
        setFormData(profileData)
        setOriginalData(profileData)
      } else {
        const defaultData = {
          displayName: user.displayName || '',
          penName: user.displayName || '',
          bio: '',
          guitarExperience: '',
          favoriteArtist: '',
          favoriteKey: '',
          playingStyle: '',
          favoriteChords: '',
          practiceLocation: '',
          photoURL: user.photoURL || '',
          isPublicProfile: true,
          showPlaylists: true,
          showUploads: true,
          socialMedia: {}
        }
        setFormData(defaultData)
        setOriginalData(defaultData)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      showMessage('載入資料失敗', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSocialMediaChange = (platform, value) => {
    setFormData(prev => ({
      ...prev,
      socialMedia: {
        ...prev.socialMedia,
        [platform]: value
      }
    }))
  }

  const handlePhotoUpload = async (file) => {
    if (!file) return

    const validation = validateImageFile(file)
    if (!validation.valid) {
      showMessage(validation.error, 'error')
      return
    }

    setUploadProgress(1)

    try {
      const result = await uploadToCloudinary(file, 'user-photos')
      setFormData(prev => ({ ...prev, photoURL: result.url }))
      setUploadProgress(0)
      showMessage('照片上傳成功')
    } catch (error) {
      console.error('Upload error:', error)
      showMessage('上傳失敗：' + error.message, 'error')
      setUploadProgress(0)
    }
  }

  const handleUseGooglePhoto = () => {
    if (user?.photoURL) {
      setFormData(prev => ({ ...prev, photoURL: user.photoURL }))
      showMessage('已使用 Google 頭像')
    }
  }

  const handleSave = async () => {
    if (!user) return

    setIsSaving(true)
    try {
      const userRef = doc(db, 'users', user.uid)
      await updateDoc(userRef, {
        ...formData,
        updatedAt: new Date().toISOString()
      })
      
      setOriginalData(formData)
      showMessage('✅ 個人資料已保存')
    } catch (error) {
      console.error('Save error:', error)
      showMessage('保存失敗：' + error.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalData)

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full"></div>
        </div>
      </Layout>
    )
  }

  if (!user) return null

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
        {/* Header + Save Button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">編輯個人資料</h1>
            <p className="text-gray-400 text-sm">設定你的音樂人檔案</p>
          </div>
          <Link
            href={`/profile/${user.uid}`}
            className="text-[#FFD700] hover:opacity-80 text-sm"
          >
            查看公開頁面 →
          </Link>
        </div>

        {/* Save Button at Top */}
        <div className="mb-6">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {isSaving ? '保存中...' : '💾 保存資料'}
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${
            message.type === 'error' 
              ? 'bg-red-900/30 border border-red-700 text-red-400'
              : 'bg-green-900/30 border border-green-700 text-green-400'
          }`}>
            {message.text}
          </div>
        )}

        {/* Profile Photo */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-medium text-white mb-4">個人頭像</h2>
          
          <div className="flex items-center gap-6">
            <div className="relative">
              <img 
                src={formData.photoURL || '/default-avatar.png'} 
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover border-2 border-[#FFD700]"
              />
              {uploadProgress > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <div className="animate-spin w-6 h-6 border-2 border-[#FFD700] border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>
            
            <div className="flex-1 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handlePhotoUpload(e.target.files[0])}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition"
              >
                📷 上傳新照片
              </button>
              {user?.photoURL && (
                <button
                  onClick={handleUseGooglePhoto}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition text-sm"
                >
                  🌐 使用 Google 頭像
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-medium text-white mb-4">基本資料</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">顯示名稱</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => handleChange('displayName', e.target.value)}
                placeholder="你的名稱"
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 outline-none"
              />
            </div>

            {/* 編譜者筆名 */}
            <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#FFD700]/30">
              <label className="block text-sm text-[#FFD700] mb-2 flex items-center gap-2">
                <span>✏️</span> 編譜者筆名
              </label>
              <input
                type="text"
                value={formData.penName}
                onChange={(e) => handleChange('penName', e.target.value)}
                placeholder="例如：結他小王子、Kermit Guitar"
                className="w-full px-4 py-3 bg-black border border-[#FFD700]/50 rounded-lg text-white placeholder-gray-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-2">
                出譜時會自動使用此筆名，顯示為「編譜：xxx」
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">個人簡介</label>
              <textarea
                value={formData.bio}
                onChange={(e) => handleChange('bio', e.target.value)}
                placeholder="介紹一下自己，例如音樂風格、喜歡的歌手、聯絡方式..."
                rows={4}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Social Media */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-medium text-white mb-4">🔗 社交媒體</h2>
          <p className="text-sm text-gray-400 mb-4">
            添加你的社交媒體帳號，讓其他人可以追蹤你
          </p>
          
          <div className="space-y-4">
            {SOCIAL_MEDIA_CONFIG.map(({ key, label, placeholder, icon }) => (
              <div key={key}>
                <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#FFD700] flex items-center justify-center text-black text-xs">
                    {icon}
                  </span>
                  {label}
                </label>
                <input
                  type="text"
                  value={formData.socialMedia?.[key] || ''}
                  onChange={(e) => handleSocialMediaChange(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Music Profile */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-medium text-white mb-4">音樂人檔案</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">彈結他經驗</label>
              <select
                value={formData.guitarExperience}
                onChange={(e) => handleChange('guitarExperience', e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white outline-none"
              >
                {bioOptions.experience.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">最喜歡的歌手</label>
              <input
                type="text"
                value={formData.favoriteArtist}
                onChange={(e) => handleChange('favoriteArtist', e.target.value)}
                placeholder="例如：陳奕迅、周杰倫、Taylor Swift..."
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">最喜歡的 Key</label>
              <select
                value={formData.favoriteKey}
                onChange={(e) => handleChange('favoriteKey', e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white outline-none"
              >
                {FAVORITE_KEY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">演奏風格</label>
              <select
                value={formData.playingStyle}
                onChange={(e) => handleChange('playingStyle', e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white outline-none"
              >
                {bioOptions.style.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">最喜歡的和弦</label>
              <select
                value={formData.favoriteChords}
                onChange={(e) => handleChange('favoriteChords', e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white outline-none"
              >
                {bioOptions.chords.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">練習地點</label>
              <select
                value={formData.practiceLocation}
                onChange={(e) => handleChange('practiceLocation', e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white outline-none"
              >
                {bioOptions.location.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Auto Bio Generator */}
        <AutoBioGenerator 
          formData={formData}
          bioOptions={bioOptions}
          onBioChange={(bio) => handleChange('bio', bio)}
        />

        {/* Privacy Settings */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-medium text-white mb-4">隱私設定</h2>
          
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isPublicProfile}
                onChange={(e) => handleChange('isPublicProfile', e.target.checked)}
                className="w-5 h-5 text-[#FFD700] rounded"
              />
              <span className="text-white">公開個人主頁</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.showUploads}
                onChange={(e) => handleChange('showUploads', e.target.checked)}
                className="w-5 h-5 text-[#FFD700] rounded"
              />
              <span className="text-white">顯示我上傳的樂譜</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.showPlaylists}
                onChange={(e) => handleChange('showPlaylists', e.target.checked)}
                className="w-5 h-5 text-[#FFD700] rounded"
              />
              <span className="text-white">顯示我的歌單</span>
            </label>
          </div>
        </div>

      </div>
    </Layout>
  )
}

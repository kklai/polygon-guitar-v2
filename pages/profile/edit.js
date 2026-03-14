import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc } from '@/lib/firestore-tracked'
import { uploadToCloudinary, validateImageFile } from '@/lib/cloudinary'
import Link from '@/components/Link'
import { useRouter } from 'next/router'

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

export default function EditProfile() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef(null)
  
  const [formData, setFormData] = useState({
    displayName: '',
    penName: '',
    bio: '',
    photoURL: '',
    isPublicProfile: true,
    showPlaylists: true,
    showUploads: true,
    socialMedia: {}
  })
  
  const [originalData, setOriginalData] = useState(null)
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
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (userDoc.exists()) {
        const data = userDoc.data()
        const profileData = {
          displayName: data.displayName || user.displayName || '',
          penName: data.penName || data.displayName || user.displayName || '',
          bio: data.bio || '',
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
            <p className="text-neutral-400 text-sm">設定你的個人資料</p>
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
        <div className="bg-[#121212] rounded-xl border border-neutral-800 p-6 mb-6">
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
                  className="w-full px-4 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition text-sm"
                >
                  🌐 使用 Google 頭像
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-[#121212] rounded-xl border border-neutral-800 p-6 mb-6">
          <h2 className="text-lg font-medium text-white mb-4">基本資料</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-2">顯示名稱</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => handleChange('displayName', e.target.value)}
                placeholder="你的名稱"
                className="w-full px-4 py-3 bg-black border border-neutral-700 rounded-lg text-white placeholder-neutral-500 outline-none"
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
                className="w-full px-4 py-3 bg-black border border-[#FFD700]/50 rounded-lg text-white placeholder-neutral-500 outline-none"
              />
              <p className="text-xs text-neutral-400 mt-2">
                出譜時會自動使用此筆名，顯示為「編譜：xxx」
              </p>
            </div>

            <div>
              <label className="block text-sm text-neutral-400 mb-2">個人簡介</label>
              <textarea
                value={formData.bio}
                onChange={(e) => handleChange('bio', e.target.value)}
                placeholder="介紹一下自己，例如音樂風格、喜歡的歌手、聯絡方式..."
                rows={4}
                className="w-full px-4 py-3 bg-black border border-neutral-700 rounded-lg text-white placeholder-neutral-500 outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Social Media */}
        <div className="bg-[#121212] rounded-xl border border-neutral-800 p-6 mb-6">
          <h2 className="text-lg font-medium text-white mb-4">🔗 社交媒體</h2>
          <p className="text-sm text-neutral-400 mb-4">
            添加你的社交媒體帳號，讓其他人可以追蹤你
          </p>
          
          <div className="space-y-4">
            {SOCIAL_MEDIA_CONFIG.map(({ key, label, placeholder, icon }) => (
              <div key={key}>
                <label className="block text-sm text-neutral-400 mb-2 flex items-center gap-2">
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
                  className="w-full px-4 py-3 bg-black border border-neutral-700 rounded-lg text-white placeholder-neutral-500 outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="bg-[#121212] rounded-xl border border-neutral-800 p-6 mb-6">
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

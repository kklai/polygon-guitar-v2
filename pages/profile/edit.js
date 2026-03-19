import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc } from '@/lib/firestore-tracked'
import { updateUploaderPenNameForUser } from '@/lib/tabs'
import { uploadToCloudinary, validateImageFile, resizeImageFile } from '@/lib/cloudinary'
import Link from '@/components/Link'
import { useRouter } from 'next/router'
import { PROFILE_SOCIAL_ICONS } from '@/components/ProfileSocialIcons'
import { PenLine } from 'lucide-react'

// 社交媒體配置（icon 與 profile 公開頁一致，用 PROFILE_SOCIAL_ICONS）
const SOCIAL_MEDIA_CONFIG = [
  { key: 'whatsapp', label: 'WhatsApp', placeholder: '電話號碼（如 85291234567）' },
  { key: 'instagram', label: 'Instagram', placeholder: '用戶名（不用 @）' },
  { key: 'youtube', label: 'YouTube', placeholder: '頻道名或 @用戶名' },
  { key: 'threads', label: 'Threads', placeholder: '用戶名（不用 @）' },
  { key: 'facebook', label: 'Facebook', placeholder: '用戶名或完整網址' },
  { key: 'website', label: '個人網站', placeholder: 'https://...' }
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
      // 照片過大時自動縮細（例如 >1.5MB 或 長邊 >1200px）再上傳
      const fileToUpload = await resizeImageFile(file)
      const url = await uploadToCloudinary(fileToUpload, 'user-photos', 'user-photos')
      setFormData(prev => ({ ...prev, photoURL: url }))
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
      // 出譜者名稱唔可以係空：若未填則自動生成（displayName > email 前段 > 結他友）
      const dataToSave = { ...formData, updatedAt: new Date().toISOString() }
      if (!(dataToSave.penName || '').trim()) {
        dataToSave.penName = (formData.displayName || user.displayName || '').trim() || (formData.email || user.email || '').split('@')[0]?.trim() || '結他友'
      }
      await updateDoc(userRef, dataToSave)

      // 若出譜者名稱有改，同步更新該用戶所有樂譜嘅 uploaderPenName（強制每張譜跟住改）
      const penNameChanged = originalData && (originalData.penName || '') !== (dataToSave.penName || '')
      if (penNameChanged) {
        try {
          const { updated } = await updateUploaderPenNameForUser(user.uid, dataToSave.penName || '')
          if (updated > 0) {
            setOriginalData({ ...formData, penName: dataToSave.penName })
            showMessage(`個人資料已保存，並已更新 ${updated} 張樂譜的出譜者名稱`)
            return
          }
        } catch (err) {
          console.error('Sync uploaderPenName for tabs failed:', err)
        }
      }

      setOriginalData({ ...formData, penName: dataToSave.penName })
      showMessage('個人資料已保存')
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">編輯個人資料</h1>
          </div>
          <Link
            href={`/profile/${user.uid}`}
            className="text-[#FFD700] hover:opacity-80 text-sm mt-3"
          >
            返回個人主頁 →
          </Link>
        </div>

        {/* Save Button at Top */}
        <div className="mb-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {isSaving ? '保存中...' : '保存資料'}
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

        {/* 個人頭像與基本資料（合併） */}
        <div className="bg-[#121212] rounded-xl border border-neutral-800 px-6 py-4 mb-4">
          {/* 頭像區 + 個人主頁名稱、出譜者名稱 */}
          <div className="flex items-start gap-6 mb-4">
            <div className="flex-shrink-0 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handlePhotoUpload(e.target.files[0])}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative block rounded-full border-2 border-[#FFD700] focus:outline-none focus:ring-2 focus:ring-[#FFD700]/50"
              >
                <img
                  src={formData.photoURL || '/default-avatar.png'}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover cursor-pointer"
                />
                {uploadProgress > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                    <div className="animate-spin w-6 h-6 border-2 border-[#FFD700] border-t-transparent rounded-full" />
                  </div>
                )}
              </button>
              <p className="mt-2 text-xs text-neutral-400">點擊頭像更改圖片</p>
              {user?.photoURL && (
                <button
                  type="button"
                  onClick={handleUseGooglePhoto}
                  className="mt-1 text-xs text-[#FFD700] hover:underline"
                >
                  使用 Google 頭像
                </button>
              )}
            </div>
            <div className="flex-1 space-y-4 min-w-0">
              <div>
                <label className="flex items-center gap-2 text-sm text-[#FFD700] mb-2 pl-2">
                  <PenLine className="w-4 h-4 text-[#FFD700] flex-shrink-0" />
                  出譜者名稱
                </label>
                <input
                  type="text"
                  value={formData.penName}
                  onChange={(e) => handleChange('penName', e.target.value)}
                  placeholder="例如：結他小王子、Kermit Guitar"
                  className="w-full px-4 py-1.5 bg-black border border-[#FFD700] rounded-lg text-white placeholder-neutral-500 outline-none focus:ring-1 focus:ring-[#FFD700]"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-2 pl-2">個人主頁名稱</label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => handleChange('displayName', e.target.value)}
                  placeholder="你的名稱"
                  className="w-full px-4 py-1.5 bg-black border border-neutral-700 rounded-lg text-white placeholder-neutral-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 個人簡介 - 與右欄對齊 */}
          <div className="flex items-start gap-6">
            <div className="w-24 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <label className="block text-sm text-neutral-400 mb-2 pl-2">個人簡介</label>
              <textarea
                value={formData.bio}
                onChange={(e) => handleChange('bio', e.target.value)}
                placeholder="介紹一下自己，例如音樂風格、喜歡的歌手、聯絡方式..."
                rows={4}
                className="w-full px-4 py-1.5 bg-black border border-neutral-700 rounded-lg text-white placeholder-neutral-500 placeholder:text-sm outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Social Media */}
        <div className="bg-[#121212] rounded-xl border border-neutral-800 px-6 py-4 mb-4">
          <h2 className="text-lg font-medium text-white mb-0">社交媒體</h2>
          <p className="text-sm text-neutral-400 mb-4">
            會於個人主頁顯示，讓更多人追蹤你
          </p>
          
          <div className="space-y-3">
            {SOCIAL_MEDIA_CONFIG.map(({ key, label, placeholder }) => (
              <div key={key} className="flex gap-4 items-start">
                <div className="flex-shrink-0 pt-3">
                  <span className="w-12 h-12 rounded-full bg-[#FFD700] flex items-center justify-center text-black">
                    {PROFILE_SOCIAL_ICONS[key] || PROFILE_SOCIAL_ICONS.website}
                  </span>
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <label className="block text-sm text-neutral-400 pl-2">{label}</label>
                  <input
                    type="text"
                    value={formData.socialMedia?.[key] || ''}
                    onChange={(e) => handleSocialMediaChange(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-4 py-1.5 bg-black border border-neutral-700 rounded-lg text-white placeholder-neutral-500 outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="bg-[#121212] rounded-xl border border-neutral-800 px-6 py-4 mb-4">
          <h2 className="text-lg font-medium text-white mb-4">隱私設定</h2>
          
          <div className="space-y-3">
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

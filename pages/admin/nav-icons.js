import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { uploadToCloudinary } from '@/lib/cloudinary'

const NAV_ITEMS = [
  { id: 'home', label: '首頁', defaultIcon: '首' },
  { id: 'search', label: '搜尋', defaultIcon: '搜' },
  { id: 'artists', label: '歌手', defaultIcon: '歌' },
  { id: 'library', label: '收藏', defaultIcon: '藏' },
  { id: 'upload', label: '上傳', defaultIcon: '傳' },
]

function NavIconsAdmin() {
  const router = useRouter()
  const [icons, setIcons] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [uploadingId, setUploadingId] = useState(null)

  useEffect(() => {
    loadIcons()
  }, [])

  const loadIcons = async () => {
    try {
      const docRef = doc(db, 'settings', 'navIcons')
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        setIcons(docSnap.data())
      }
    } catch (error) {
      console.error('Error loading icons:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (itemId, file) => {
    if (!file) return

    setUploadingId(itemId)
    setMessage('')

    try {
      // 檢查檔案類型
      if (!file.type.startsWith('image/')) {
        alert('請上傳圖片檔案')
        return
      }

      // 檢查檔案大小（最大 500KB）
      if (file.size > 500 * 1024) {
        alert('圖片大小不能超過 500KB')
        return
      }

      // 上傳到 Cloudinary
      const result = await uploadToCloudinary(file, `nav-icon-${itemId}`)

      // 更新本地狀態
      setIcons(prev => ({
        ...prev,
        [itemId]: result.url
      }))

      setMessage(`已上傳 ${NAV_ITEMS.find(i => i.id === itemId)?.label} 圖標`)
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Upload error:', error)
      alert('上傳失敗：' + error.message)
    } finally {
      setUploadingId(null)
    }
  }

  const saveIcons = async () => {
    setSaving(true)
    try {
      await setDoc(doc(db, 'settings', 'navIcons'), icons)
      setMessage('圖標設置已保存')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Save error:', error)
      alert('保存失敗：' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const clearIcon = (itemId) => {
    setIcons(prev => {
      const newIcons = { ...prev }
      delete newIcons[itemId]
      return newIcons
    })
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-[#121212] rounded-lg" />
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">底部導航圖標設置</h1>
            <p className="text-gray-500 mt-1">自定義底部導航欄嘅圖標</p>
          </div>
          <button
            onClick={() => router.push('/admin')}
            className="text-gray-400 hover:text-white"
          >
            返回後台
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-700 rounded-lg text-green-400">
            {message}
          </div>
        )}

        {/* Icons Grid */}
        <div className="space-y-4 mb-8">
          {NAV_ITEMS.map(item => {
            const currentIcon = icons[item.id]
            return (
              <div key={item.id} className="bg-[#121212] rounded-lg p-4 border border-gray-800">
                <div className="flex items-center gap-4">
                  {/* Preview */}
                  <div className="w-16 h-16 bg-[#FFD700] rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {currentIcon ? (
                      <img 
                        src={currentIcon} 
                        alt={item.label}
                        className="w-10 h-10 object-contain"
                      />
                    ) : (
                      <span className="text-black text-2xl font-bold">{item.defaultIcon}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <h3 className="text-white font-medium">{item.label}</h3>
                    <p className="text-gray-500 text-sm">
                      {currentIcon ? '已設置自定義圖標' : '使用預設文字圖標'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <label className={`px-4 py-2 rounded-lg cursor-pointer transition ${
                      uploadingId === item.id
                        ? 'bg-gray-700 text-gray-400'
                        : 'bg-[#FFD700] text-black hover:opacity-90'
                    }`}>
                      {uploadingId === item.id ? '上傳中...' : '上傳圖標'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(item.id, e.target.files[0])}
                        disabled={uploadingId === item.id}
                      />
                    </label>

                    {currentIcon && (
                      <button
                        onClick={() => clearIcon(item.id)}
                        className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </div>

                {currentIcon && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <p className="text-xs text-gray-500 truncate">{currentIcon}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Tips */}
        <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 mb-6">
          <h4 className="text-blue-400 font-medium mb-2">提示</h4>
          <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
            <li>建議使用 48x48px 或 64x64px 嘅 PNG 圖片</li>
            <li>圖片大小不可超過 500KB</li>
            <li>建議使用黑色或深色圖標，因為導航欄係黃色底</li>
            <li>如不上傳圖標，將使用預設文字圖標</li>
          </ul>
        </div>

        {/* Save Button */}
        <button
          onClick={saveIcons}
          disabled={saving}
          className="w-full py-3 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存設置'}
        </button>
      </div>
    </Layout>
  )
}

export default function NavIconsPage() {
  return (
    <AdminGuard>
      <NavIconsAdmin />
    </AdminGuard>
  )
}

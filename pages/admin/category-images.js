import { useState, useEffect } from 'react'
import { collection, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Layout from '@/components/Layout'
import { uploadToCloudinary, validateImageFile, formatFileSize } from '@/lib/cloudinary'
import AdminGuard from '@/components/AdminGuard'

// 歌手分類預設資料
const DEFAULT_CATEGORIES = [
  {
    id: 'male',
    name: '男歌手',
    description: '上傳男歌手的分類封面圖',
    defaultImage: 'https://images.unsplash.com/photo-1516280440614-6697288d5d38?w=600&h=400&fit=crop'
  },
  {
    id: 'female',
    name: '女歌手',
    description: '上傳女歌手的分類封面圖',
    defaultImage: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=600&h=400&fit=crop'
  },
  {
    id: 'group',
    name: '組合',
    description: '上傳組合的分類封面圖',
    defaultImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&h=400&fit=crop'
  }
]

const COLLECTION_NAME = 'settings'
const DOC_ID = 'categoryImages'

function CategoryImagesManagement() {
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [uploadingId, setUploadingId] = useState(null)
  const [message, setMessage] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadCategoryImages()
  }, [])

  const loadCategoryImages = async () => {
    try {
      const docRef = doc(db, COLLECTION_NAME, DOC_ID)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        const data = docSnap.data()
        // 合併已存儲的圖片 URL
        setCategories(prev => prev.map(cat => ({
          ...cat,
          image: data[cat.id] || null
        })))
      }
    } catch (error) {
      console.error('Error loading category images:', error)
      showMessage('載入圖片失敗：' + error.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleFileSelect = async (categoryId, categoryName, file) => {
    if (!file) return

    // 驗證檔案
    const validation = validateImageFile(file)
    if (!validation.valid) {
      showMessage(validation.error, 'error')
      return
    }

    setUploadingId(categoryId)

    try {
      // 上傳到 Cloudinary
      const result = await uploadToCloudinary(file, `category-${categoryId}`)

      // 更新 Firestore
      const docRef = doc(db, COLLECTION_NAME, DOC_ID)
      await setDoc(docRef, {
        [categoryId]: result.url,
        [`${categoryId}PublicId`]: result.publicId,
        [`${categoryId}Width`]: result.width,
        [`${categoryId}Height`]: result.height,
        updatedAt: new Date().toISOString()
      }, { merge: true })

      // 更新本地狀態
      setCategories(prev => prev.map(cat => 
        cat.id === categoryId 
          ? { 
              ...cat, 
              image: result.url,
              publicId: result.publicId,
              width: result.width,
              height: result.height
            }
          : cat
      ))

      showMessage(
        `${categoryName} 上傳成功！${result.width}×${result.height} · ${formatFileSize(result.bytes)}`,
        'success'
      )
    } catch (error) {
      console.error('Upload error:', error)
      showMessage('上傳失敗：' + error.message, 'error')
    } finally {
      setUploadingId(null)
    }
  }

  const handleReset = async (categoryId, categoryName) => {
    if (!confirm(`確定要重置 ${categoryName} 的圖片為預設值嗎？`)) return

    try {
      // 更新 Firestore - 刪除自定義圖片
      const docRef = doc(db, COLLECTION_NAME, DOC_ID)
      await setDoc(docRef, {
        [categoryId]: null,
        [`${categoryId}PublicId`]: null,
        [`${categoryId}Width`]: null,
        [`${categoryId}Height`]: null,
        updatedAt: new Date().toISOString()
      }, { merge: true })

      // 更新本地狀態
      setCategories(prev => prev.map(cat => 
        cat.id === categoryId 
          ? { 
              ...cat, 
              image: null,
              publicId: null,
              width: null,
              height: null
            }
          : cat
      ))

      showMessage(`${categoryName} 已重置為預設圖片`, 'success')
    } catch (error) {
      console.error('Reset error:', error)
      showMessage('重置失敗：' + error.message, 'error')
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-800 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-64 bg-[#121212] rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">🎭 歌手分類圖片管理</h1>
            <p className="text-[#B3B3B3] mt-1">
              管理首頁「歌手分類」區塊的封面圖片
            </p>
          </div>
          <div className="text-sm text-[#B3B3B3]">
            Cloud: drld2cjpo · Preset: artist_photos
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-lg ${
            message.type === 'error' 
              ? 'bg-red-900/20 border border-red-800 text-red-300' 
              : 'bg-green-900/20 border border-green-800 text-green-300'
          }`}>
            {message.text}
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
          <p className="text-blue-300 text-sm">
            💡 提示：建議圖片尺寸為 600×400 像素（3:2 比例），支援 JPG、PNG、GIF、WebP 格式，最大 10MB
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {categories.map(category => (
            <div 
              key={category.id}
              className="bg-[#121212] rounded-xl overflow-hidden border border-gray-800"
            >
              {/* Image Preview */}
              <div className="relative aspect-[3/2] bg-gray-800">
                <img
                  src={category.image || category.defaultImage}
                  alt={category.name}
                  className="w-full h-full object-cover"
                />
                
                {/* Overlay with category name */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end p-4">
                  <h3 className="text-xl font-bold text-white">{category.name}</h3>
                </div>

                {/* Custom indicator */}
                {category.image && (
                  <div className="absolute top-2 right-2">
                    <span className="text-xs bg-[#FFD700] text-black px-2 py-0.5 rounded font-medium">
                      自定義
                    </span>
                  </div>
                )}
              </div>

              {/* Info & Actions */}
              <div className="p-4 space-y-4">
                <p className="text-sm text-[#B3B3B3]">
                  {category.description}
                </p>
                
                {category.width && category.height && (
                  <p className="text-xs text-gray-500">
                    {category.width}×{category.height} 像素
                  </p>
                )}

                <div className="flex gap-2">
                  {/* Upload Button */}
                  <label 
                    className={`
                      flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium cursor-pointer transition
                      ${uploadingId === category.id 
                        ? 'bg-gray-800 text-gray-400 cursor-not-allowed' 
                        : 'bg-[#FFD700] text-black hover:opacity-90'
                      }
                    `}
                  >
                    {uploadingId === category.id ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        上傳中...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {category.image ? '更換圖片' : '上傳圖片'}
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      disabled={uploadingId === category.id}
                      onChange={(e) => {
                        const file = e.target.files[0]
                        if (file) {
                          handleFileSelect(category.id, category.name, file)
                        }
                        e.target.value = ''
                      }}
                    />
                  </label>

                  {/* Reset Button - only show if custom image exists */}
                  {category.image && (
                    <button
                      onClick={() => handleReset(category.id, category.name)}
                      className="px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition"
                      title="重置為預設圖片"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Preview Section */}
        <div className="bg-[#121212] rounded-xl p-6 border border-gray-800">
          <h3 className="text-lg font-bold text-white mb-4">📱 首頁預覽</h3>
          <div className="flex overflow-x-auto gap-4 pb-2">
            {categories.map(category => (
              <div key={category.id} className="flex-shrink-0 relative w-40 h-28 rounded-lg overflow-hidden">
                <img
                  src={category.image || category.defaultImage}
                  alt={category.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                  <span className="text-white font-medium text-sm">{category.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Settings Info */}
        <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
          <h3 className="font-semibold text-white mb-2">📌 設定資訊</h3>
          <ul className="text-sm text-[#B3B3B3] space-y-1 font-mono">
            <li>Firestore Collection: {COLLECTION_NAME}</li>
            <li>Document ID: {DOC_ID}</li>
            <li>Cloudinary Folder: category-images</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

export default function CategoryImagesPage() {
  return (
    <AdminGuard>
      <CategoryImagesManagement />
    </AdminGuard>
  )
}

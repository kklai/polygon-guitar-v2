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
    description: '自動使用最熱門男歌手照片',
    defaultImage: 'https://images.unsplash.com/photo-1516280440614-6697288d5d38?w=600&h=400&fit=crop'
  },
  {
    id: 'female',
    name: '女歌手',
    description: '自動使用最熱門女歌手照片',
    defaultImage: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=600&h=400&fit=crop'
  },
  {
    id: 'group',
    name: '組合',
    description: '自動使用最熱門組合照片',
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
  const [isUpdating, setIsUpdating] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    loadCategoryImages()
  }, [])

  const loadCategoryImages = async () => {
    try {
      const docRef = doc(db, COLLECTION_NAME, DOC_ID)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        const data = docSnap.data()
        setLastUpdate(data.maleUpdatedAt || data.femaleUpdatedAt || data.groupUpdatedAt)
        
        // 合併數據
        setCategories(prev => prev.map(cat => ({
          ...cat,
          image: data[cat.id] || null,
          source: data[`${cat.id}Source`] || 'default',
          artistId: data[`${cat.id}ArtistId`] || null,
          artistName: data[`${cat.id}ArtistName`] || null,
          manualOverride: data[`${cat.id}ManualOverride`] || false,
          updatedAt: data[`${cat.id}UpdatedAt`] || null
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

  // 手動觸發更新
  const handleAutoUpdate = async () => {
    setIsUpdating(true)
    try {
      const res = await fetch('/api/category/update-auto-images', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        }
      })
      
      const data = await res.json()
      
      if (data.success) {
        showMessage(`✅ 已更新！${data.details.filter(d => !d.skipped).length} 個分類`, 'success')
        await loadCategoryImages()
      } else {
        showMessage('更新失敗：' + data.error, 'error')
      }
    } catch (error) {
      showMessage('更新失敗：' + error.message, 'error')
    } finally {
      setIsUpdating(false)
    }
  }

  // 切換手動覆蓋
  const toggleManualOverride = async (categoryId, currentValue) => {
    try {
      const docRef = doc(db, COLLECTION_NAME, DOC_ID)
      await setDoc(docRef, {
        [`${categoryId}ManualOverride`]: !currentValue,
        updatedAt: new Date().toISOString()
      }, { merge: true })
      
      showMessage(`${currentValue ? '已恢復自動更新' : '已啟用手動模式'}`, 'success')
      await loadCategoryImages()
    } catch (error) {
      showMessage('設置失敗：' + error.message, 'error')
    }
  }

  const handleFileSelect = async (categoryId, categoryName, file) => {
    if (!file) return

    const validation = validateImageFile(file)
    if (!validation.valid) {
      showMessage(validation.error, 'error')
      return
    }

    setUploadingId(categoryId)

    try {
      const result = await uploadToCloudinary(file, `category-${categoryId}`)

      const docRef = doc(db, COLLECTION_NAME, DOC_ID)
      await setDoc(docRef, {
        [categoryId]: result.url,
        [`${categoryId}Source`]: 'manual',
        [`${categoryId}PublicId`]: result.publicId,
        [`${categoryId}Width`]: result.width,
        [`${categoryId}Height`]: result.height,
        [`${categoryId}ManualOverride`]: true,
        updatedAt: new Date().toISOString()
      }, { merge: true })

      setCategories(prev => prev.map(cat => 
        cat.id === categoryId 
          ? { 
              ...cat, 
              image: result.url,
              source: 'manual',
              publicId: result.publicId,
              width: result.width,
              height: result.height,
              manualOverride: true
            }
          : cat
      ))

      showMessage(
        `${categoryName} 上傳成功！已設為手動模式`,
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
    if (!confirm(`確定要重置 ${categoryName} 嗎？將恢復自動更新模式。`)) return

    try {
      const docRef = doc(db, COLLECTION_NAME, DOC_ID)
      await setDoc(docRef, {
        [categoryId]: null,
        [`${categoryId}Source`]: null,
        [`${categoryId}PublicId`]: null,
        [`${categoryId}ArtistId`]: null,
        [`${categoryId}ArtistName`]: null,
        [`${categoryId}ManualOverride`]: false,
        updatedAt: new Date().toISOString()
      }, { merge: true })

      setCategories(prev => prev.map(cat => 
        cat.id === categoryId 
          ? { 
              ...cat, 
              image: null,
              source: 'default',
              publicId: null,
              artistId: null,
              artistName: null,
              manualOverride: false
            }
          : cat
      ))

      showMessage(`${categoryName} 已重置，將自動更新`, 'success')
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
              自動使用最熱門歌手照片，每小時更新
            </p>
          </div>
          <button
            onClick={handleAutoUpdate}
            disabled={isUpdating}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#FFD700] text-black rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {isUpdating ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                更新中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                立即更新
              </>
            )}
          </button>
        </div>

        {/* Auto Update Info */}
        <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-blue-300 font-medium">🤖 自動更新已啟用</h3>
              <p className="text-blue-400 text-sm mt-1">
                系統每小時自動獲取最熱門的男女歌手/組合作為分類封面
              </p>
            </div>
            {lastUpdate && (
              <div className="text-right text-sm text-blue-400">
                <div>上次更新</div>
                <div>{new Date(lastUpdate).toLocaleString('zh-HK')}</div>
              </div>
            )}
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
                  <div>
                    <h3 className="text-xl font-bold text-white">{category.name}</h3>
                    {category.artistName && category.source === 'auto' && (
                      <p className="text-sm text-[#FFD700]">⭐ {category.artistName}</p>
                    )}
                  </div>
                </div>

                {/* Source indicator */}
                <div className="absolute top-2 right-2">
                  {category.source === 'auto' && (
                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-medium">
                      自動
                    </span>
                  )}
                  {category.source === 'manual' && (
                    <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded font-medium">
                      手動
                    </span>
                  )}
                  {(!category.source || category.source === 'default') && (
                    <span className="text-xs bg-gray-600 text-white px-2 py-0.5 rounded font-medium">
                      預設
                    </span>
                  )}
                </div>
              </div>

              {/* Info & Actions */}
              <div className="p-4 space-y-3">
                {/* Mode Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">
                    {category.manualOverride ? '手動模式' : '自動模式'}
                  </span>
                  <button
                    onClick={() => toggleManualOverride(category.id, category.manualOverride)}
                    className={`relative w-12 h-6 rounded-full transition ${
                      category.manualOverride ? 'bg-purple-600' : 'bg-gray-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition ${
                      category.manualOverride ? 'left-6.5' : 'left-0.5'
                    }`} style={{ left: category.manualOverride ? '26px' : '2px' }} />
                  </button>
                </div>
                
                <p className="text-xs text-[#B3B3B3]">
                  {category.manualOverride 
                    ? '手動上傳的圖片不會被自動更新覆蓋'
                    : '系統會自動使用最熱門歌手照片'
                  }
                </p>

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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 0 002 2z" />
                        </svg>
                        上傳圖片
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

                  {/* Reset Button */}
                  {(category.image || category.manualOverride) && (
                    <button
                      onClick={() => handleReset(category.id, category.name)}
                      className="px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition"
                      title="恢復自動更新"
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

        {/* Algorithm Info */}
        <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
          <h3 className="font-semibold text-white mb-3">📊 熱度計算方法</h3>
          <ul className="text-sm text-[#B3B3B3] space-y-2">
            <li>• <span className="text-[#FFD700]">瀏覽量 × 0.7</span> + <span className="text-[#FFD700]">總讚數 × 0.3</span> = 熱度分數</li>
            <li>• 每小時自動計算所有歌手的熱度分數</li>
            <li>• 各類別（男/女/組合）分數最高的歌手成為封面</li>
            <li>• 圖片優先順序：Hero Photo → 上傳照片 → 維基百科照片</li>
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

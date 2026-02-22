import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { doc, getDoc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { searchArtistFromWikipedia } from '@/lib/wikipedia'
import { uploadToCloudinary, validateImageFile, formatFileSize } from '@/lib/cloudinary'

function EditArtist() {
  const router = useRouter()
  const { id } = router.query

  
  const [formData, setFormData] = useState({
    name: '',
    photoURL: '',      // 用戶上傳的 Cloudinary 相片
    wikiPhotoURL: '',  // 維基百科相片
    photo: '',         // 舊資料兼容
    heroPhoto: '',     // Hero 照片
    bio: '',
    year: '',
    artistType: '' // male, female, group
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [isSearching, setIsSearching] = useState(false)
  const [searchPreview, setSearchPreview] = useState(null)
  const [originalName, setOriginalName] = useState('') // 記錄原始歌手名
  const [showNameChangeWarning, setShowNameChangeWarning] = useState(false)
  const [updateSongsWithNewName, setUpdateSongsWithNewName] = useState(true) // 默認自動更新歌曲
  const [isFixingSongs, setIsFixingSongs] = useState(false)
  const [fixMessage, setFixMessage] = useState(null)
  const [relatedSongsCount, setRelatedSongsCount] = useState(0)
  const [actualDocId, setActualDocId] = useState(null) // 儲存實際嘅 document ID（處理簡繁體）
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  // 載入歌手資料
  useEffect(() => {
    if (id) {
      loadArtist()
    }
  }, [id])

  // 簡單簡繁轉換（常用字）
  const toTraditional = (name) => {
    const sc2tc = {
      '学': '學', '东': '東', '伟': '偉', '杰': '傑', '强': '強',
      '张': '張', '陈': '陳', '刘': '劉', '黄': '黃', '邓': '鄧'
    };
    return name.split('').map(c => sc2tc[c] || c).join('');
  };

  const loadArtist = async () => {
    try {
      let artistRef = doc(db, 'artists', id)
      let artistSnap = await getDoc(artistRef)
      
      // 如果搵唔到，嘗試用繁體版 ID
      if (!artistSnap.exists()) {
        const traditionalId = toTraditional(id);
        if (traditionalId !== id) {
          artistRef = doc(db, 'artists', traditionalId);
          artistSnap = await getDoc(artistRef);
        }
      }
      
      if (!artistSnap.exists()) {
        alert('搵唔到歌手')
        router.push('/artists')
        return
      }

      const data = artistSnap.data()
      setActualDocId(artistSnap.id) // 儲存實際嘅 document ID
      setOriginalName(data.name || '')
      setFormData({
        name: data.name || '',
        photoURL: data.photoURL || '',
        wikiPhotoURL: data.wikiPhotoURL || '',
        photo: data.photo || '',
        heroPhoto: data.heroPhoto || '',
        bio: data.bio || '',
        year: data.year || '',
        artistType: data.artistType || ''
      })
      
      // 檢查相關歌曲數量
      await checkRelatedSongs(data.name, data.normalizedName || artistSnap.id)
    } catch (error) {
      console.error('Error loading artist:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.name.trim()) {
      newErrors.name = '請輸入歌手名'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validate()) return

    setIsSubmitting(true)
    try {
      // 如果歌手名變更，自動更新所有相關歌曲（強制同步）
      if (originalName && formData.name !== originalName) {
        console.log('歌手名變更，自動更新相關歌曲...')
        await handleFixSongsData(true) // true = 靜默模式（唔顯示確認對話框）
      }
      
      // 使用實際嘅 document ID（處理簡繁體問題）
      const docId = actualDocId || id
      const artistRef = doc(db, 'artists', docId)
      await updateDoc(artistRef, {
        name: formData.name,
        photoURL: formData.photoURL,
        wikiPhotoURL: formData.wikiPhotoURL,
        photo: formData.photo,  // 舊資料兼容
        heroPhoto: formData.heroPhoto,
        bio: formData.bio,
        year: formData.year,
        artistType: formData.artistType || 'other',
        // 保留原有 normalizedName 不變，確保舊連結繼續有效
        updatedAt: new Date().toISOString()
      })
      
      // 保留原有 URL，唔會因改名而改變連結
      router.push(`/artists/${id}`)
    } catch (error) {
      console.error('Update artist error:', error)
      alert('更新失敗：' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  // 處理照片上傳
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 驗證檔案
    const validation = validateImageFile(file)
    if (!validation.valid) {
      setUploadError(validation.error)
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      const result = await uploadToCloudinary(file, formData.name || 'artist')
      setFormData(prev => ({
        ...prev,
        photoURL: result
      }))
    } catch (error) {
      console.error('Upload error:', error)
      setUploadError('上傳失敗：' + error.message)
    } finally {
      setIsUploading(false)
    }
  }

  // 處理 Hero 照片上傳
  const handleHeroUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateImageFile(file)
    if (!validation.valid) {
      setUploadError(validation.error)
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      const result = await uploadToCloudinary(file, `${formData.name || 'artist'}_hero`, 'artists/hero')
      setFormData(prev => ({
        ...prev,
        heroPhoto: result
      }))
    } catch (error) {
      console.error('Hero upload error:', error)
      setUploadError('Hero 上傳失敗：' + error.message)
    } finally {
      setIsUploading(false)
    }
  }

  // 從 Wikipedia 搜尋
  const handleSearchWikipedia = async () => {
    if (!formData.name?.trim()) return
    
    setIsSearching(true)
    setSearchPreview(null)
    
    const data = await searchArtistFromWikipedia(formData.name)
    
    if (data) {
      setSearchPreview(data)
    } else {
      alert('搵唔到資料（可能維基百科未有呢個歌手）')
    }
    
    setIsSearching(false)
  }

  // 檢查相關歌曲
  const checkRelatedSongs = async (name, normalizedName) => {
    try {
      const possibleIds = [
        normalizedName,
        name.toLowerCase().replace(/\s+/g, '-'),
        name
      ].filter(Boolean)
      
      let count = 0
      for (const artistId of possibleIds) {
        const q = query(
          collection(db, 'tabs'),
          where('artistId', '==', artistId)
        )
        const snapshot = await getDocs(q)
        count += snapshot.size
      }
      
      // 同時檢查 artist 欄位
      const q2 = query(
        collection(db, 'tabs'),
        where('artist', '==', name)
      )
      const snapshot2 = await getDocs(q2)
      count += snapshot2.size
      
      setRelatedSongsCount(count)
    } catch (e) {
      console.error('Error checking songs:', e)
    }
  }

  // 處理歌手名變更
  const handleNameChange = (e) => {
    const newName = e.target.value
    setFormData(prev => ({ ...prev, name: newName }))
    
    // 檢查是否修改了歌手名
    if (originalName && newName !== originalName) {
      setShowNameChangeWarning(true)
    } else {
      setShowNameChangeWarning(false)
    }
  }

  // 修復歌曲數據（只更新顯示名稱，保留原有 URL slug）
  const handleFixSongsData = async (silent = false) => {
    if (!silent && !confirm('確定要修復所有相關歌曲的數據嗎？這會更新歌曲的歌手顯示名稱（URL 連結保持不變）。')) return
    
    setIsFixingSongs(true)
    setFixMessage(null)
    
    try {
      const oldArtistId = originalName.toLowerCase().replace(/\s+/g, '-')
      
      // 查找所有相關歌曲（用舊的 artistId 或 artist 名）
      // 使用實際嘅 document ID（處理簡繁體問題）
      const docId = actualDocId || id
      const possibleOldIds = [
        docId, // normalizedName
        oldArtistId,
        originalName
      ].filter(Boolean)
      
      let updatedCount = 0
      const batch = writeBatch(db)
      
      // 方法 1: 用 artistId 查找
      for (const oldId of possibleOldIds) {
        const q = query(
          collection(db, 'tabs'),
          where('artistId', '==', oldId)
        )
        const snapshot = await getDocs(q)
        
        snapshot.docs.forEach(doc => {
          batch.update(doc.ref, {
            artist: formData.name,
            artistName: formData.name,
            // 保留 artistId 和 artistSlug 不變，確保舊連結繼續有效
            updatedAt: new Date().toISOString()
          })
          updatedCount++
        })
      }
      
      // 方法 2: 用 artist 名查找
      const q2 = query(
        collection(db, 'tabs'),
        where('artist', '==', originalName)
      )
      const snapshot2 = await getDocs(q2)
      
      snapshot2.docs.forEach(doc => {
        // 避免重複更新，同時保留原有 artistId/artistSlug
        const data = doc.data()
        if (data.artist !== formData.name) {
          batch.update(doc.ref, {
            artist: formData.name,
            artistName: formData.name,
            // 保留 artistId 和 artistSlug 不變，確保舊連結繼續有效
            updatedAt: new Date().toISOString()
          })
          updatedCount++
        }
      })
      
      if (updatedCount > 0) {
        await batch.commit()
      }
      
      // 非靜默模式先顯示成功消息
      if (!silent) {
        setFixMessage({
          type: 'success',
          text: `✅ 成功更新 ${updatedCount} 首歌曲的歌手資料`
        })
      } else {
        console.log(`已自動更新 ${updatedCount} 首歌曲的歌手資料`)
      }
      
      // 更新相關歌曲計數（使用原有 ID，因為 URL slug 冇改變）
      await checkRelatedSongs(formData.name, id)
      
    } catch (error) {
      console.error('Fix songs error:', error)
      if (!silent) {
        setFixMessage({
          type: 'error',
          text: '❌ 修復失敗：' + error.message
        })
      }
    } finally {
      setIsFixingSongs(false)
    }
  }

  // 使用 Wikipedia 資料
  const handleUseWikipediaData = () => {
    if (searchPreview) {
      setFormData(prev => ({
        ...prev,
        name: searchPreview.name || prev.name,
        wikiPhotoURL: searchPreview.photo || prev.wikiPhotoURL,  // 存入 wikiPhotoURL
        bio: searchPreview.bio || prev.bio,
        year: searchPreview.year || prev.year
      }))
      setSearchPreview(null)
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 pb-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-800 rounded w-1/3"></div>
            <div className="h-12 bg-gray-800 rounded"></div>
            <div className="h-12 bg-gray-800 rounded"></div>
            <div className="h-32 bg-gray-800 rounded"></div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-gray-800 -mx-4 px-4 py-4 mb-6 flex items-center justify-between">
          <div className="flex items-center">
            <Link 
              href={`/artists/${id}`}
              className="inline-flex items-center text-[#B3B3B3] hover:text-white mr-4 transition"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" stroke-linejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              返回
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">編輯歌手資料</h1>
              <p className="text-sm text-[#B3B3B3]">管理員功能</p>
            </div>
          </div>
          
          {/* 頂部保存按鈕 */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>保存中...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>保存更改</span>
              </>
            )}
          </button>
        </div>

        {/* Form */}
        <div className="bg-[#121212] rounded-xl shadow-md p-6 border border-gray-800">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-white mb-1">
                歌手名 <span className="text-[#FFD700]">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleNameChange}
                className={`w-full px-4 py-2 bg-black border rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent ${
                  errors.name ? 'border-red-500' : 'border-gray-800'
                } ${showNameChangeWarning ? 'border-yellow-600' : ''}`}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-400">{errors.name}</p>
              )}
              
              {/* 歌手名變更警告 */}
              {showNameChangeWarning && (
                <div className="mt-3 p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-yellow-400 font-medium text-sm mb-2">
                        你正在修改歌手名稱
                      </p>
                      <p className="text-yellow-200/70 text-sm mb-3">
                        由「{originalName}」改為「{formData.name}」
                      </p>
                      
                      {relatedSongsCount > 0 && (
                        <p className="text-yellow-200/70 text-sm mb-3">
                          發現 {relatedSongsCount} 首相關歌曲需要同步更新
                        </p>
                      )}
                      
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={updateSongsWithNewName}
                          onChange={(e) => setUpdateSongsWithNewName(e.target.checked)}
                          className="w-4 h-4 rounded border-yellow-600 text-[#FFD700] focus:ring-[#FFD700]"
                        />
                        <span className="text-yellow-200 text-sm">
                          同時更新所有歌曲的歌手資料（推薦）
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Artist Type */}
            <div>
              <label htmlFor="artistType" className="block text-sm font-medium text-white mb-1">
                歌手類型 <span className="text-[#FFD700]">*</span>
              </label>
              <select
                id="artistType"
                name="artistType"
                value={formData.artistType}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
              >
                <option value="">請選擇...</option>
                <option value="male">👨‍🎤 男歌手</option>
                <option value="female">👩‍🎤 女歌手</option>
                <option value="group">🎸 組合</option>
              </select>
            </div>

            {/* Wikipedia Search */}
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <h3 className="text-sm font-medium text-[#FFD700] mb-3">從 Wikipedia 自動獲取資料</h3>
              <button
                type="button"
                onClick={handleSearchWikipedia}
                disabled={isSearching || !formData.name}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
              >
                {isSearching ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>搜尋緊...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>喺 Wikipedia 搵 {formData.name}</span>
                  </>
                )}
              </button>

              {/* Wikipedia Preview */}
              {searchPreview && (
                <div className="mt-4 p-4 bg-[#1a1a1a] border border-[#FFD700] rounded-lg">
                  <h4 className="text-[#FFD700] font-medium mb-3">Wikipedia 搜尋結果：</h4>
                  <div className="flex gap-4 mb-4">
                    {searchPreview.photo && (
                      <img 
                        src={searchPreview.photo} 
                        alt={searchPreview.name}
                        className="w-20 h-20 rounded-full object-cover border-2 border-[#FFD700]"
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-white font-medium">{searchPreview.name}</p>
                      {searchPreview.year && (
                        <p className="text-gray-400 text-sm">{searchPreview.year}年</p>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm mb-4 line-clamp-3">
                    {searchPreview.bio}
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleUseWikipediaData}
                      className="px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition"
                    >
                      使用呢個資料
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchPreview(null)}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Photo URLs - 雙欄位顯示 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 用戶上傳相片 (photoURL) */}
              <div>
                <label htmlFor="photoURL" className="block text-sm font-medium text-white mb-1">
                  <span className="text-[#FFD700]">用戶上傳相片</span> (photoURL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    id="photoURL"
                    name="photoURL"
                    value={formData.photoURL}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="flex-1 px-4 py-2 bg-black border border-[#FFD700]/50 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                  />
                  <label className="flex-shrink-0 px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition cursor-pointer">
                    {isUploading ? '上傳中...' : '選擇檔案'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>
                </div>
                {uploadError && (
                  <p className="text-xs text-red-400 mt-1">{uploadError}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  支援 JPG、PNG、GIF，最大 10MB
                </p>
                {formData.photoURL && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-400 mb-2">預覽：</p>
                    <img 
                      src={formData.photoURL} 
                      alt="用戶上傳相片"
                      className="w-24 h-24 rounded-full object-cover border-2 border-[#FFD700]"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'block'
                      }}
                    />
                    <p className="hidden text-red-400 text-sm">圖片載入失敗</p>
                  </div>
                )}
              </div>

              {/* 維基百科相片 (wikiPhotoURL) */}
              <div>
                <label htmlFor="wikiPhotoURL" className="block text-sm font-medium text-white mb-1">
                  <span className="text-gray-400">維基百科相片</span> (wikiPhotoURL)
                </label>
                <input
                  type="url"
                  id="wikiPhotoURL"
                  name="wikiPhotoURL"
                  value={formData.wikiPhotoURL}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="w-full px-4 py-2 bg-black border border-gray-700 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  當無用戶上傳相片時顯示
                </p>
                {formData.wikiPhotoURL && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-400 mb-2">預覽：</p>
                    <img 
                      src={formData.wikiPhotoURL} 
                      alt="維基百科相片"
                      className="w-24 h-24 rounded-full object-cover border-2 border-gray-600"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'block'
                      }}
                    />
                    <p className="hidden text-red-400 text-sm">圖片載入失敗</p>
                  </div>
                )}
              </div>
            </div>

            {/* Hero Photo */}
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                <span className="text-[#FFD700]">Hero 照片</span>（歌手頁面頂部背景）
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  name="heroPhoto"
                  value={formData.heroPhoto}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="flex-1 px-4 py-2 bg-black border border-[#FFD700]/50 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                />
                <label className="flex-shrink-0 px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition cursor-pointer">
                  {isUploading ? '上傳中...' : '選擇檔案'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleHeroUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                建議尺寸：1200 x 800 像素或以上
              </p>
              {formData.heroPhoto && (
                <div className="mt-3">
                  <p className="text-sm text-gray-400 mb-2">預覽：</p>
                  <img 
                    src={formData.heroPhoto} 
                    alt="Hero 照片"
                    className="w-full h-32 object-cover rounded-lg border-2 border-[#FFD700]"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'block'
                    }}
                  />
                  <p className="hidden text-red-400 text-sm">圖片載入失敗</p>
                </div>
              )}
            </div>

            {/* Year */}
            <div>
              <label htmlFor="year" className="block text-sm font-medium text-white mb-1">
                出道/出生年份
              </label>
              <input
                type="text"
                id="year"
                name="year"
                value={formData.year}
                onChange={handleChange}
                placeholder="例如：1990"
                className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
              />
            </div>

            {/* Fix Songs Data Button */}
            {relatedSongsCount > 0 && (
              <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-blue-400 font-medium text-sm">歌曲數據修復</h4>
                    <p className="text-blue-200/70 text-sm mt-1">
                      發現 {relatedSongsCount} 首歌曲使用此歌手的舊資料
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleFixSongsData}
                    disabled={isFixingSongs}
                    className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 text-sm"
                  >
                    {isFixingSongs ? (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        修復中...
                      </span>
                    ) : (
                      '修復歌曲數據'
                    )}
                  </button>
                </div>
                
                {fixMessage && (
                  <div className={`mt-3 p-3 rounded text-sm ${
                    fixMessage.type === 'success' 
                      ? 'bg-green-900/30 text-green-400' 
                      : 'bg-red-900/30 text-red-400'
                  }`}>
                    {fixMessage.text}
                  </div>
                )}
              </div>
            )}

            {/* Bio */}
            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-white mb-1">
                簡介
              </label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows={6}
                placeholder="歌手簡介..."
                className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
              />
              <p className="mt-1 text-sm text-[#B3B3B3]">
                {formData.bio.length} 字
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center space-x-4 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-[#FFD700] text-black py-3 px-6 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '保存中...' : '保存更改'}
              </button>
              <Link
                href={`/artists/${id}`}
                className="px-6 py-3 border border-gray-800 rounded-lg font-medium text-[#B3B3B3] hover:text-white hover:border-[#FFD700] transition"
              >
                取消
              </Link>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}

export default function EditArtistPage() {
  return (
    <AdminGuard>
      <EditArtist />
    </AdminGuard>
  )
}

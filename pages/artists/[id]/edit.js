import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from '@/components/Link'
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from '@/lib/firestore-tracked'
import { db } from '@/lib/firebase'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { searchArtistFromWikipedia } from '@/lib/wikipedia'
import { uploadToCloudinary, validateImageFile, formatFileSize } from '@/lib/cloudinary'
import { nameToSlug, getArtistBySlug, invalidateArtistCaches } from '@/lib/tabs'
import { X, MapPin, ArrowLeft } from 'lucide-react'

const REGIONS = [
  { value: 'hongkong', label: '香港', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { value: 'taiwan', label: '台灣', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'china', label: '中國', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { value: 'asia', label: '亞洲', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  { value: 'foreign', label: '外國', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
]

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
    birthYear: '',     // 出生年份（可填完整日期如 1990-05-15）
    debutYear: '',     // 出道年份（可填完整日期如 2022-07-01）
    year: '',          // 舊資料兼容
    artistType: '', // male, female, group
    regions: [] // 地區陣列
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
      
      // 再搵唔到就試用 normalizedName（slug）查，例如改名後用新 URL 入編輯頁
      if (!artistSnap.exists()) {
        const bySlug = await getArtistBySlug(id);
        if (bySlug) {
          artistRef = doc(db, 'artists', bySlug.id);
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
      // 支援舊版單一地區轉陣列
      const artistRegions = data.regions || (data.region ? [data.region] : [])
      
      setFormData({
        name: data.name || '',
        photoURL: data.photoURL || '',
        wikiPhotoURL: data.wikiPhotoURL || '',
        photo: data.photo || '',
        heroPhoto: data.heroPhoto || '',
        bio: data.bio || '',
        birthYear: data.birthYear || data.year || '',  // 兼容舊資料
        debutYear: data.debutYear || '',
        year: data.year || '',  // 保留舊欄位兼容
        artistType: data.artistType || '',
        regions: artistRegions
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
      // 由新歌手名生成網站 ID（slug），例如 "陳奕迅 Eason Chan" → "陳奕迅-Eason-Chan"
      const newSlug = nameToSlug(formData.name) || id
      
      // 如果歌手名變更，自動更新所有相關歌曲（含 artistId / artistSlug 一齊改為新 slug）
      if (originalName && formData.name !== originalName) {
        console.log('歌手名變更，自動更新相關歌曲及網站 ID...')
        await handleFixSongsData(true, newSlug) // 靜默 + 新 slug，會一齊更新歌曲嘅 artistId/artistSlug
      }
      
      // 使用實際嘅 document ID（處理簡繁體問題）
      const docId = actualDocId || id
      const artistRef = doc(db, 'artists', docId)
      await updateDoc(artistRef, {
        name: formData.name,
        normalizedName: newSlug, // 網站 ID 跟住歌手名一齊變
        photoURL: formData.photoURL,
        wikiPhotoURL: formData.wikiPhotoURL,
        photo: formData.photo,  // 舊資料兼容
        heroPhoto: formData.heroPhoto,
        bio: formData.bio,
        birthYear: formData.birthYear,
        debutYear: formData.debutYear,
        year: formData.birthYear || formData.debutYear || formData.year,  // 兼容舊欄位
        artistType: formData.artistType || 'other',
        regions: formData.regions || [],
        region: formData.regions?.[0] || null, // 保留第一地區向後兼容
        updatedAt: new Date().toISOString()
      })

      // 清除 cache，等歌手列表／搜尋即時反映改動
      if (typeof window !== 'undefined') {
        invalidateArtistCaches()
        fetch('/api/search-data?bust=1').catch(() => {})
      }

      // 跳去新嘅歌手 URL（用新 slug）
      router.push(`/artists/${encodeURIComponent(newSlug)}`)
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

  // 修復歌曲數據。newSlug 有值時會一齊更新 artistId/artistSlug（改名後用）；冇則只更新顯示名稱
  const handleFixSongsData = async (silent = false, newSlug = null) => {
    if (!silent && !confirm('確定要修復所有相關歌曲的數據嗎？' + (newSlug ? '這會更新歌手顯示名稱及網站 ID（URL 會變）。' : '這會更新歌曲的歌手顯示名稱（URL 連結保持不變）。'))) return
    
    setIsFixingSongs(true)
    setFixMessage(null)
    
    try {
      const oldArtistId = originalName.toLowerCase().replace(/\s+/g, '-')
      
      // 查找所有相關歌曲（用舊的 artistId 或 artist 名）
      const docId = actualDocId || id
      const possibleOldIds = [
        docId,
        oldArtistId,
        originalName
      ].filter(Boolean)
      
      const songUpdates = newSlug
        ? { artist: formData.name, artistName: formData.name, artistId: newSlug, artistSlug: newSlug, updatedAt: new Date().toISOString() }
        : { artist: formData.name, artistName: formData.name, updatedAt: new Date().toISOString() }
      
      let updatedCount = 0
      const batch = writeBatch(db)
      const seen = new Set()
      
      // 方法 1: 用 artistId 查找
      for (const oldId of possibleOldIds) {
        const q = query(
          collection(db, 'tabs'),
          where('artistId', '==', oldId)
        )
        const snapshot = await getDocs(q)
        
        snapshot.docs.forEach(d => {
          if (seen.has(d.id)) return
          seen.add(d.id)
          batch.update(d.ref, songUpdates)
          updatedCount++
        })
      }
      
      // 方法 2: 用 artist 名查找
      const q2 = query(
        collection(db, 'tabs'),
        where('artist', '==', originalName)
      )
      const snapshot2 = await getDocs(q2)
      
      snapshot2.docs.forEach(d => {
        if (seen.has(d.id)) return
        seen.add(d.id)
        batch.update(d.ref, songUpdates)
        updatedCount++
      })
      
      if (updatedCount > 0) {
        await batch.commit()
      }
      
      if (!silent) {
        setFixMessage({
          type: 'success',
          text: newSlug
            ? `✅ 成功更新 ${updatedCount} 首歌曲的歌手資料及網站 ID`
            : `✅ 成功更新 ${updatedCount} 首歌曲的歌手資料`
        })
      } else {
        console.log(`已自動更新 ${updatedCount} 首歌曲的歌手資料` + (newSlug ? '及網站 ID' : ''))
      }
      
      await checkRelatedSongs(formData.name, newSlug || id)
      
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
        birthYear: searchPreview.birthYear || prev.birthYear,
        debutYear: searchPreview.debutYear || prev.debutYear,
        year: searchPreview.year || prev.year  // 兼容舊資料
      }))
      setSearchPreview(null)
    }
  }

  // 刪除歌手
  const handleDeleteArtist = async () => {
    // 檢查是否有相關歌曲
    if (relatedSongsCount > 0) {
      if (!confirm(`⚠️ 警告：這位歌手有 ${relatedSongsCount} 首相關歌曲！\n\n刪除歌手不會刪除這些歌曲，但可能導致歌曲頁面顯示異常。\n\n確定要刪除嗎？`)) {
        return
      }
    } else {
      if (!confirm(`確定要刪除歌手「${formData.name}」嗎？\n\n此操作無法復原。`)) {
        return
      }
    }
    
    try {
      const docId = actualDocId || id
      await deleteDoc(doc(db, 'artists', docId))
      alert('✅ 歌手已刪除')
      router.push('/artists')
    } catch (error) {
      console.error('Delete artist error:', error)
      alert('刪除失敗：' + error.message)
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
              aria-label="返回"
            >
              <ArrowLeft className="w-5 h-5" />
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
                className={`w-full px-4 py-2 bg-black border rounded-lg text-white placeholder-[#B3B3B3] ${
                  errors.name ? 'border-red-500' : 'border-gray-800'
                } ${showNameChangeWarning ? 'border-yellow-600' : ''}`}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-400">{errors.name}</p>
              )}
              <p className="mt-1 text-xs text-[#B3B3B3]">
                保存後網址：/artists/{formData.name.trim() ? nameToSlug(formData.name) || id : id}
              </p>
              
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
                          className="w-4 h-4 rounded border-yellow-600 text-[#FFD700]"
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
                className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white"
              >
                <option value="">請選擇...</option>
                <option value="male">👨‍🎤 男歌手</option>
                <option value="female">👩‍🎤 女歌手</option>
                <option value="group">🎸 組合</option>
              </select>
            </div>

            {/* Regions */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                地區 <span className="text-gray-500">(最多 3 個)</span>
              </label>
              <div className="p-3 bg-[#1a1a1a] rounded-lg border border-gray-700">
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.regions?.map((region, idx) => {
                    const regionConfig = REGIONS.find(r => r.value === region)
                    return (
                      <span 
                        key={region}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${regionConfig?.color || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}
                      >
                        <MapPin className="w-3 h-3" />
                        {idx + 1}. {regionConfig?.label || region}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              regions: prev.regions.filter(r => r !== region)
                            }))
                          }}
                          className="hover:opacity-70 ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
                {formData.regions?.length < 3 && (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        setFormData(prev => ({
                          ...prev,
                          regions: [...(prev.regions || []), e.target.value]
                        }))
                      }
                    }}
                    className="w-full bg-black text-white text-sm px-3 py-2 rounded border border-gray-700 outline-none"
                  >
                    <option value="">+ 添加地區 ({(formData.regions?.length || 0) + 1}/3)</option>
                    {REGIONS.filter(r => !formData.regions?.includes(r.value)).map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                第一個地區會作為主要顯示地區
              </p>
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
                      {(searchPreview.birthYear || searchPreview.debutYear) && (
                        <p className="text-gray-400 text-sm">
                          {searchPreview.birthYear && <span>出生：{searchPreview.birthYear}年 </span>}
                          {searchPreview.debutYear && <span>出道：{searchPreview.debutYear}年</span>}
                        </p>
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
                    className="flex-1 px-4 py-2 bg-black border border-[#FFD700]/50 rounded-lg text-white placeholder-[#B3B3B3]"
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
                  className="w-full px-4 py-2 bg-black border border-gray-700 rounded-lg text-white placeholder-[#B3B3B3]"
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
                  className="flex-1 px-4 py-2 bg-black border border-[#FFD700]/50 rounded-lg text-white placeholder-[#B3B3B3]"
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

            {/* 出生日期 */}
            <div>
              <label htmlFor="birthYear" className="block text-sm font-medium text-white mb-1">
                出生日期
              </label>
              <input
                type="text"
                id="birthYear"
                name="birthYear"
                value={formData.birthYear}
                onChange={handleChange}
                placeholder="例如：1990 或 1990-05-15"
                className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3]"
              />
              <p className="text-xs text-gray-500 mt-1">可只填年份，或填完整日期（YYYY-MM-DD）</p>
            </div>

            {/* 出道日期 */}
            <div>
              <label htmlFor="debutYear" className="block text-sm font-medium text-white mb-1">
                出道日期
              </label>
              <input
                type="text"
                id="debutYear"
                name="debutYear"
                value={formData.debutYear}
                onChange={handleChange}
                placeholder="例如：2022 或 2022-07-12"
                className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3]"
              />
              <p className="text-xs text-gray-500 mt-1">可只填年份，或填完整日期（YYYY-MM-DD）</p>
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
                className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3]"
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

            {/* 刪除按鈕 - 僅管理員可見 */}
            <div className="pt-6 mt-6 border-t border-gray-800">
              <button
                type="button"
                onClick={handleDeleteArtist}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-900/30 border border-red-700 text-red-400 rounded-lg hover:bg-red-900/50 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                刪除歌手
                {relatedSongsCount > 0 && (
                  <span className="ml-2 text-xs bg-red-700 text-white px-2 py-0.5 rounded-full">
                    {relatedSongsCount} 首歌
                  </span>
                )}
              </button>
              <p className="mt-2 text-xs text-gray-500 text-center">
                警告：刪除後無法復原。如有歌曲使用此歌手，建議先轉移歌曲至其他歌手。
              </p>
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

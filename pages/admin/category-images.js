import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { doc, getDoc, setDoc, collection, query, where, limit, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { uploadToCloudinary } from '../../lib/cloudinary'
import Layout from '../../components/Layout'
import AdminGuard from '../../components/AdminGuard'

function CategoryImagesAdmin() {
  const [categoryImages, setCategoryImages] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [uploadingCat, setUploadingCat] = useState(null)
  const [message, setMessage] = useState(null)
  
  // 歌手選擇相關狀態
  const [selectedCatForArtist, setSelectedCatForArtist] = useState(null)
  const [categoryArtists, setCategoryArtists] = useState([])
  const [loadingArtists, setLoadingArtists] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadCategoryImages()
  }, [])

  const loadCategoryImages = async () => {
    try {
      const docRef = doc(db, 'settings', 'categoryImages')
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        setCategoryImages(docSnap.data())
      }
    } catch (error) {
      console.error('Error loading category images:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async () => {
    setUpdating(true)
    setMessage(null)
    
    try {
      // 定義各類別及其可能的 artistType/gender 值
      const categories = {
        male: { label: '男歌手', types: ['male'] },
        female: { label: '女歌手', types: ['female'] },
        group: { label: '組合', types: ['group', 'band'] }
      }
      
      const updates = {}
      const details = {}

      for (const [catId, config] of Object.entries(categories)) {
        try {
          let allArtists = []
          
          // 對每種可能的 type 值進行查詢（同時查 artistType 和 gender）
          for (const typeValue of config.types) {
            // 查 artistType
            const q1 = query(
              collection(db, 'artists'),
              where('artistType', '==', typeValue),
              limit(100)
            )
            const snapshot1 = await getDocs(q1)
            snapshot1.docs.forEach(d => {
              allArtists.push({ id: d.id, ...d.data() })
            })
            
            // 查 gender（兼容性）
            const q2 = query(
              collection(db, 'artists'),
              where('gender', '==', typeValue),
              limit(100)
            )
            const snapshot2 = await getDocs(q2)
            snapshot2.docs.forEach(d => {
              allArtists.push({ id: d.id, ...d.data() })
            })
          }
          
          // 去重（根據 ID）
          const uniqueArtists = []
          const seenIds = new Set()
          for (const artist of allArtists) {
            if (!seenIds.has(artist.id)) {
              seenIds.add(artist.id)
              uniqueArtists.push(artist)
            }
          }
          
          // 客戶端排序找出最熱門
          const sortedArtists = uniqueArtists
            .sort((a, b) => (b.tabCount || 0) - (a.tabCount || 0))
          
          // 找出第一個有照片的藝人（優先用戶上傳圖片）
          const artistWithPhoto = sortedArtists.find(a => 
            a.photoURL || a.photo || a.wikiPhotoURL
          )
          
          if (artistWithPhoto) {
            // 優先用戶上傳的 photoURL，其次維基圖片
            const photoUrl = artistWithPhoto.photoURL || artistWithPhoto.photo || artistWithPhoto.wikiPhotoURL
            updates[catId] = {
              image: photoUrl,
              artistId: artistWithPhoto.id,
              artistName: artistWithPhoto.name,
              artistType: artistWithPhoto.artistType,
              updatedAt: new Date().toISOString(),
              hotScore: artistWithPhoto.tabCount || 0
            }
            details[catId] = {
              artistName: artistWithPhoto.name,
              artistType: artistWithPhoto.artistType,
              image: photoUrl,
              hotScore: artistWithPhoto.tabCount || 0
            }
          } else if (sortedArtists.length > 0) {
            // 有藝人但都沒有照片
            const topArtist = sortedArtists[0]
            details[catId] = { 
              error: 'No photo found', 
              artistName: topArtist.name,
              artistType: topArtist.artistType,
              note: `${sortedArtists.length} artists but no photos`
            }
          } else {
            details[catId] = { 
              error: 'No artists found',
              triedTypes: config.types 
            }
          }
        } catch (typeError) {
          details[catId] = { error: typeError.message }
        }
      }

      // 直接更新 Firestore
      if (Object.keys(updates).length > 0) {
        const settingsRef = doc(db, 'settings', 'categoryImages')
        await setDoc(settingsRef, updates, { merge: true })
      }

      setMessage({ 
        type: 'success', 
        text: `更新完成：${Object.keys(updates).length} 個類別已更新` 
      })
      await loadCategoryImages()
      
      // 如果有找不到的，顯示警告
      const notFound = Object.entries(details)
        .filter(([k, v]) => v.error === 'No artists found')
        .map(([k]) => k)
      
      if (notFound.length > 0) {
        console.log('Categories not found:', notFound, details)
      }
      
    } catch (error) {
      console.error('Update error:', error)
      setMessage({ type: 'error', text: '更新失敗：' + error.message })
    } finally {
      setUpdating(false)
    }
  }

  // 上傳自訂分類圖片
  const handleUpload = async (catId, file) => {
    if (!file) return
    
    setUploadingCat(catId)
    setMessage(null)
    
    try {
      const imageUrl = await uploadToCloudinary(file, `category-${catId}`, 'category_covers')
      
      // 更新 Firestore - 清除歌手資料，標記為上傳
      const settingsRef = doc(db, 'settings', 'categoryImages')
      await setDoc(settingsRef, {
        [catId]: {
          image: imageUrl,
          custom: true,
          source: 'upload',  // 標記來源為上傳
          // 清除之前嘅歌手資料
          artistId: null,
          artistName: null,
          artistType: null,
          hotScore: null,
          updatedAt: new Date().toISOString()
        }
      }, { merge: true })
      
      setMessage({ type: 'success', text: '圖片上傳成功' })
      await loadCategoryImages()
    } catch (error) {
      console.error('Upload error:', error)
      setMessage({ type: 'error', text: '上傳失敗：' + error.message })
    } finally {
      setUploadingCat(null)
    }
  }

  // 清除自訂圖片（恢復自動選擇）
  const handleClearCustom = async (catId) => {
    if (!confirm('確定要清除自訂圖片，恢復自動選擇嗎？')) return
    
    try {
      const settingsRef = doc(db, 'settings', 'categoryImages')
      await setDoc(settingsRef, {
        [catId]: {
          custom: false,
          updatedAt: new Date().toISOString()
        }
      }, { merge: true })
      
      setMessage({ type: 'success', text: '已恢復自動選擇' })
      await loadCategoryImages()
    } catch (error) {
      setMessage({ type: 'error', text: '操作失敗：' + error.message })
    }
  }

  // 載入分類下的所有歌手
  const loadCategoryArtists = async (catId) => {
    setLoadingArtists(true)
    setSelectedCatForArtist(catId)
    setSearchTerm('')
    
    const catConfig = {
      male: { types: ['male'] },
      female: { types: ['female'] },
      group: { types: ['group', 'band'] }
    }
    
    try {
      const config = catConfig[catId]
      let allArtists = []
      
      for (const typeValue of config.types) {
        // 查 artistType
        const q1 = query(
          collection(db, 'artists'),
          where('artistType', '==', typeValue),
          limit(100)
        )
        const snapshot1 = await getDocs(q1)
        snapshot1.docs.forEach(d => {
          allArtists.push({ id: d.id, ...d.data() })
        })
        
        // 查 gender
        const q2 = query(
          collection(db, 'artists'),
          where('gender', '==', typeValue),
          limit(100)
        )
        const snapshot2 = await getDocs(q2)
        snapshot2.docs.forEach(d => {
          allArtists.push({ id: d.id, ...d.data() })
        })
      }
      
      // 去重並排序（按譜數）
      const seenIds = new Set()
      const uniqueArtists = []
      for (const artist of allArtists) {
        if (!seenIds.has(artist.id)) {
          seenIds.add(artist.id)
          uniqueArtists.push(artist)
        }
      }
      
      uniqueArtists.sort((a, b) => (b.tabCount || 0) - (a.tabCount || 0))
      setCategoryArtists(uniqueArtists)
    } catch (error) {
      console.error('Error loading artists:', error)
      setMessage({ type: 'error', text: '載入歌手失敗：' + error.message })
    } finally {
      setLoadingArtists(false)
    }
  }

  // 選擇歌手作為封面
  const handleSelectArtist = async (artist) => {
    if (!selectedCatForArtist) return
    
    const photoUrl = artist.photoURL || artist.photo || artist.wikiPhotoURL
    if (!photoUrl) {
      setMessage({ type: 'error', text: '此歌手沒有相片' })
      return
    }
    
    try {
      const settingsRef = doc(db, 'settings', 'categoryImages')
      await setDoc(settingsRef, {
        [selectedCatForArtist]: {
          image: photoUrl,
          artistId: artist.id,
          artistName: artist.name,
          artistType: artist.artistType || artist.gender,
          custom: false,
          source: 'artist',  // 標記來源為歌手選擇
          updatedAt: new Date().toISOString(),
          hotScore: artist.tabCount || 0
        }
      }, { merge: true })
      
      setMessage({ type: 'success', text: `已設定 ${artist.name} 為封面` })
      setSelectedCatForArtist(null)
      await loadCategoryImages()
    } catch (error) {
      setMessage({ type: 'error', text: '設定失敗：' + error.message })
    }
  }

  // 過濾歌手列表
  const filteredArtists = categoryArtists.filter(artist => 
    artist.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const categories = [
    { id: 'male', name: '男歌手', icon: '👨‍🎤' },
    { id: 'female', name: '女歌手', icon: '👩‍🎤' },
    { id: 'group', name: '組合', icon: '👥' }
  ]

  return (
    <Layout>
      <Head>
        <title>分類封面管理 | Polygon Guitar</title>
      </Head>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">分類封面管理</h1>
            <p className="text-gray-400">手動更新首頁歌手分類顯示的封面圖片</p>
          </div>
          <Link href="/admin" className="text-gray-400 hover:text-white">← 返回管理員</Link>
        </div>

        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white mb-1">自動更新封面</h2>
              <p className="text-gray-400 text-sm">
                系統會獲取各類別最熱門的歌手相片作為封面<br/>
                <span className="text-gray-500">（組合會檢查 group / band 兩種類型）</span>
              </p>
            </div>
            <button
              onClick={handleUpdate}
              disabled={updating}
              className={`px-6 py-3 rounded-lg font-medium whitespace-nowrap ${
                updating ? 'bg-gray-700 cursor-not-allowed text-gray-400' : 'bg-[#FFD700] text-black hover:opacity-90'
              }`}
            >
              {updating ? '更新中...' : '立即更新'}
            </button>
          </div>

          {message && (
            <div className={`mt-4 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-900/30 border border-green-700 text-green-400' : 'bg-red-900/30 border border-red-700 text-red-400'
            }`}>
              {message.text}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {categories.map((cat) => {
            const data = categoryImages?.[cat.id]
            const isCustom = data?.custom === true
            
            return (
              <div key={cat.id} className="bg-[#121212] border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition">
                {/* 圖片區域 */}
                <div className="relative aspect-square group">
                  {data?.image ? (
                    <img src={data.image} alt={cat.name} className="w-full h-full object-cover"/>
                  ) : (
                    <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                      <span className="text-6xl">{cat.icon}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  
                  {/* 標籤 */}
                  <div className="absolute top-3 left-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      isCustom ? 'bg-[#FFD700] text-black' : 'bg-blue-600 text-white'
                    }`}>
                      {isCustom ? '✏️ 自訂' : '🤖 自動'}
                    </span>
                  </div>
                  
                  {/* 上傳按鈕 */}
                  <label className={`absolute inset-0 flex flex-col items-center justify-center bg-black/60 cursor-pointer transition ${data?.image ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                    {uploadingCat === cat.id ? (
                      <>
                        <svg className="w-10 h-10 animate-spin text-white mb-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        <span className="text-white text-sm">上傳中...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-10 h-10 text-white mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-white text-sm font-medium">點擊上傳圖片</span>
                        <span className="text-white/60 text-xs mt-1">建議尺寸 600x600</span>
                      </>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      disabled={uploadingCat === cat.id}
                      onChange={(e) => { 
                        const file = e.target.files[0]
                        if (file) handleUpload(cat.id, file)
                      }} 
                    />
                  </label>
                  
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-xl font-bold">{cat.name}</h3>
                    {data?.artistName && !isCustom && <p className="text-slate-300 text-sm">{data.artistName}</p>}
                  </div>
                </div>
                
                {/* 資訊區域 */}
                <div className="p-4 space-y-2">
                  {/* 根據最後操作顯示不同內容 */}
                  {data?.source === 'upload' || (data?.custom && !data?.artistId) ? (
                    // 最後操作係上傳圖片
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#FFD700]">✓ 手動上傳圖片</span>
                      <button
                        onClick={() => handleClearCustom(cat.id)}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/30 transition"
                      >
                        恢復自動
                      </button>
                    </div>
                  ) : data?.source === 'artist' || (data?.artistId && !data?.custom) ? (
                    // 最後操作係選擇歌手
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">來源歌手</span>
                        <span className="text-slate-200">{data.artistName || '未知'}</span>
                      </div>
                      {data?.hotScore !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">熱門分數</span>
                          <span className="text-slate-200">{data.hotScore}</span>
                        </div>
                      )}
                    </>
                  ) : data?.image ? (
                    // 自動獲取（冇 source 標記嘅舊資料，但有圖片）
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">來源歌手</span>
                        <span className="text-slate-200">{data.artistName || '自動選擇'}</span>
                      </div>
                      {data?.hotScore !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">熱門分數</span>
                          <span className="text-slate-200">{data.hotScore}</span>
                        </div>
                      )}
                    </>
                  ) : null}
                  {data?.updatedAt && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">更新時間</span>
                      <span className="text-slate-200">
                        {new Date(data.updatedAt).toLocaleDateString('zh-HK')}
                      </span>
                    </div>
                  )}
                  {!data && <p className="text-gray-500 text-sm text-center py-2">尚未設定封面</p>}
                  
                  {/* 選擇歌手按鈕 */}
                  <button
                    onClick={() => loadCategoryArtists(cat.id)}
                    className="w-full mt-2 py-2 px-4 bg-[#282828] hover:bg-[#3E3E3E] text-white rounded-lg text-sm transition flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    選擇歌手相片
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* 歌手選擇模態框 */}
        {selectedCatForArtist && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <div className="bg-[#121212] rounded-xl border border-gray-800 w-full max-w-md max-h-[80vh] flex flex-col">
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  選擇{categories.find(c => c.id === selectedCatForArtist)?.name}封面
                </h3>
                <button 
                  onClick={() => setSelectedCatForArtist(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* 搜索框 */}
              <div className="p-4 border-b border-gray-800">
                <input
                  type="text"
                  placeholder="搜索歌手名..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 bg-[#282828] border border-gray-700 rounded-lg text-white placeholder-gray-500"
                />
              </div>
              
              {/* 歌手列表 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {loadingArtists ? (
                  <div className="text-center py-8 text-gray-500">載入中...</div>
                ) : filteredArtists.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">找不到歌手</div>
                ) : (
                  filteredArtists.map(artist => {
                    const hasPhoto = artist.photoURL || artist.photo || artist.wikiPhotoURL
                    const photoUrl = artist.photoURL || artist.photo || artist.wikiPhotoURL
                    
                    return (
                      <button
                        key={artist.id}
                        onClick={() => handleSelectArtist(artist)}
                        disabled={!hasPhoto}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition text-left ${
                          hasPhoto 
                            ? 'hover:bg-[#282828] cursor-pointer' 
                            : 'opacity-50 cursor-not-allowed'
                        }`}
                      >
                        {photoUrl ? (
                          <img 
                            src={photoUrl} 
                            alt={artist.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                            <span className="text-xl">🎤</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{artist.name}</p>
                          <p className="text-xs text-gray-500">
                            {artist.tabCount || 0} 首譜
                            {!hasPhoto && ' • 無相片'}
                          </p>
                        </div>
                        {hasPhoto && (
                          <span className="text-[#FFD700]">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 bg-[#121212] border border-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-medium text-white mb-2">說明</h3>
          <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
            <li>點擊圖片區域可直接上傳自訂封面（會顯示「自訂」標籤）</li>
            <li>點擊「選擇歌手相片」可手動揀選該分類下的歌手作為封面</li>
            <li>按「立即更新」會自動從各類別最熱門歌手獲取圖片（會顯示「自動」標籤）</li>
            <li>自訂圖片可隨時恢復為自動選擇</li>
            <li>建議上傳正方形圖片（600x600 或以上）</li>
            <li>支援 JPG、PNG 格式</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

export default function CategoryImagesPage() {
  return (
    <AdminGuard>
      <CategoryImagesAdmin />
    </AdminGuard>
  )
}

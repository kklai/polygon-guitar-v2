import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getAllArtists } from '@/lib/tabs'
import { uploadToCloudinary } from '@/lib/cloudinary'

const CATEGORIES = [
  { id: 'male', name: '男歌手', defaultImage: 'https://images.unsplash.com/photo-1516280440614-6697288d5d38?w=600&h=400&fit=crop' },
  { id: 'female', name: '女歌手', defaultImage: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=600&h=400&fit=crop' },
  { id: 'group', name: '組合', defaultImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&h=400&fit=crop' }
]

const SOURCE_OPTIONS = [
  { id: 'url', name: '圖片 URL', icon: '🔗' },
  { id: 'upload', name: '上傳圖片', icon: '📤' },
  { id: 'artist', name: '揀選歌手', icon: '👤' }
]

function CategoryCovers() {
  const router = useRouter()
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  
  // 分類封面設置
  const [covers, setCovers] = useState({
    male: { source: 'default', image: '', artistId: '' },
    female: { source: 'default', image: '', artistId: '' },
    group: { source: 'default', image: '', artistId: '' }
  })
  
  // 當前編輯嘅分類
  const [activeCategory, setActiveCategory] = useState('male')
  
  // 上傳狀態
  const [uploading, setUploading] = useState(false)
  
  // 歌手搜尋
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [artistsData, coversDoc] = await Promise.all([
        getAllArtists(),
        getDoc(doc(db, 'settings', 'categoryImages'))
      ])
      
      setArtists(artistsData)
      
      if (coversDoc.exists()) {
        const data = coversDoc.data()
        // 轉換舊格式到新格式
        const newCovers = {}
        CATEGORIES.forEach(cat => {
          const catData = data[cat.id]
          if (catData) {
            // 檢查係舊格式（直接係字符串）定新格式（對象）
            if (typeof catData === 'string') {
              newCovers[cat.id] = { 
                source: catData.startsWith('http') ? 'url' : 'artist', 
                image: catData,
                artistId: ''
              }
            } else {
              newCovers[cat.id] = catData
            }
          } else {
            newCovers[cat.id] = { source: 'default', image: '', artistId: '' }
          }
        })
        setCovers(newCovers)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveCovers = async () => {
    setSaving(true)
    try {
      await setDoc(doc(db, 'settings', 'categoryImages'), covers, { merge: true })
      setMessage('✅ 分類封面已保存')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Error saving:', error)
      setMessage('❌ 保存失敗: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  // 處理圖片上傳
  const handleImageUpload = async (file) => {
    if (!file) return
    
    setUploading(true)
    try {
      const result = await uploadToCloudinary(file, `category-${activeCategory}`)
      updateCover(activeCategory, { 
        source: 'upload', 
        image: result.url,
        artistId: ''
      })
      setMessage('✅ 圖片上傳成功')
    } catch (error) {
      setMessage('❌ 上傳失敗: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  // 更新封面設置
  const updateCover = (categoryId, updates) => {
    setCovers(prev => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], ...updates }
    }))
  }

  // 揀選歌手相
  const selectArtistPhoto = (artist) => {
    const photoUrl = artist.photoURL || artist.wikiPhotoURL || artist.photo
    if (photoUrl) {
      updateCover(activeCategory, {
        source: 'artist',
        image: photoUrl,
        artistId: artist.id,
        artistName: artist.name
      })
    } else {
      setMessage('❌ 呢個歌手冇上傳相片')
    }
  }

  // 獲取當前顯示嘅圖片
  const getDisplayImage = (categoryId) => {
    const cover = covers[categoryId]
    if (cover?.source === 'default' || !cover?.image) {
      return CATEGORIES.find(c => c.id === categoryId)?.defaultImage
    }
    return cover.image
  }

  // 過濾歌手
  const filteredArtists = searchTerm.trim() 
    ? artists.filter(a => 
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (a.artistType || a.gender) === activeCategory
      ).slice(0, 10)
    : artists
        .filter(a => (a.artistType || a.gender) === activeCategory)
        .slice(0, 10)

  if (loading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full mx-auto"></div>
        </div>
      </Layout>
    )
  }

  const currentCover = covers[activeCategory]

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 pb-8">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-gray-800 -mx-4 px-4 py-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>🖼️</span> 分類封面管理
              </h1>
              <p className="text-sm text-[#B3B3B3]">自定義首頁歌手分類封面</p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="text-[#B3B3B3] hover:text-white transition"
            >
              返回後台
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${
            message.startsWith('✅') 
              ? 'bg-green-900/30 border border-green-700 text-green-400'
              : 'bg-red-900/30 border border-red-700 text-red-400'
          }`}>
            {message}
          </div>
        )}

        {/* 分類選擇 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id)
                setSearchTerm('')
              }}
              className={`relative rounded-xl overflow-hidden aspect-[3/2] transition ${
                activeCategory === cat.id 
                  ? 'ring-2 ring-[#FFD700] ring-offset-2 ring-offset-black' 
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              <img
                src={getDisplayImage(cat.id)}
                alt={cat.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-white font-bold text-lg">{cat.name}</h3>
                <p className="text-xs text-gray-400">
                  {covers[cat.id]?.source === 'default' ? '使用預設' : 
                   covers[cat.id]?.source === 'artist' ? `歌手: ${covers[cat.id]?.artistName || '已揀選'}` : 
                   '自定義圖片'}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* 編輯區域 */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* 左側：預覽 */}
          <div className="bg-[#121212] rounded-xl border border-gray-800 p-6">
            <h3 className="text-lg font-medium text-white mb-4">預覽</h3>
            <div className="rounded-xl overflow-hidden aspect-[3/2] bg-gray-800">
              <img
                src={getDisplayImage(activeCategory)}
                alt={CATEGORIES.find(c => c.id === activeCategory)?.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => updateCover(activeCategory, { source: 'default', image: '', artistId: '' })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  currentCover?.source === 'default'
                    ? 'bg-[#FFD700] text-black'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                使用預設
              </button>
            </div>
          </div>

          {/* 右側：設置 */}
          <div className="bg-[#121212] rounded-xl border border-gray-800 p-6">
            <h3 className="text-lg font-medium text-white mb-4">
              設置 {CATEGORIES.find(c => c.id === activeCategory)?.name} 封面
            </h3>

            {/* 來源選擇 */}
            <div className="flex gap-2 mb-6">
              {SOURCE_OPTIONS.map(option => (
                <button
                  key={option.id}
                  onClick={() => updateCover(activeCategory, { source: option.id })}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                    currentCover?.source === option.id
                      ? 'bg-[#FFD700] text-black'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span className="mr-1">{option.icon}</span>
                  {option.name}
                </button>
              ))}
            </div>

            {/* URL 輸入 */}
            {currentCover?.source === 'url' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">圖片 URL</label>
                  <input
                    type="url"
                    value={currentCover.image || ''}
                    onChange={(e) => updateCover(activeCategory, { image: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-4 py-2 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:border-[#FFD700] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* 圖片上傳 */}
            {currentCover?.source === 'upload' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-[#FFD700]/50 transition">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e.target.files[0])}
                    className="hidden"
                    id="cover-upload"
                  />
                  <label htmlFor="cover-upload" className="cursor-pointer">
                    <div className="text-4xl mb-2">📤</div>
                    <p className="text-white font-medium mb-1">
                      {uploading ? '上傳中...' : '點擊上傳圖片'}
                    </p>
                    <p className="text-sm text-gray-500">支援 JPG、PNG、WebP</p>
                  </label>
                </div>
                {currentCover.image && (
                  <p className="text-sm text-green-400">✅ 已上傳圖片</p>
                )}
              </div>
            )}

            {/* 揀選歌手 */}
            {currentCover?.source === 'artist' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    搜尋{activeCategory === 'male' ? '男歌手' : activeCategory === 'female' ? '女歌手' : '組合'}
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="輸入歌手名..."
                    className="w-full px-4 py-2 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:border-[#FFD700] focus:outline-none"
                  />
                </div>
                
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {filteredArtists.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">找不到相關歌手</p>
                  ) : (
                    filteredArtists.map(artist => (
                      <button
                        key={artist.id}
                        onClick={() => selectArtistPhoto(artist)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${
                          currentCover.artistId === artist.id
                            ? 'bg-[#FFD700]/20 border border-[#FFD700]'
                            : 'bg-gray-900 hover:bg-gray-800'
                        }`}
                      >
                        {artist.photoURL || artist.wikiPhotoURL || artist.photo ? (
                          <img
                            src={artist.photoURL || artist.wikiPhotoURL || artist.photo}
                            alt={artist.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                            🎤
                          </div>
                        )}
                        <span className="text-white flex-1 text-left">{artist.name}</span>
                        {currentCover.artistId === artist.id && (
                          <span className="text-[#FFD700]">✓</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 保存按 */}
        <div className="mt-8 flex gap-4">
          <button
            onClick={saveCovers}
            disabled={saving}
            className="flex-1 py-3 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? '保存中...' : '💾 保存設置'}
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
          >
            查看首頁
          </button>
        </div>
      </div>
    </Layout>
  )
}

export default function CategoryCoversGuard() {
  return (
    <AdminGuard>
      <CategoryCovers />
    </AdminGuard>
  )
}

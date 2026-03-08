import { useState, useEffect } from 'react'
import { getAllArtists } from '@/lib/tabs'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Layout from '@/components/Layout'
import Link from 'next/link'
import AdminGuard from '@/components/AdminGuard'

function HeroPhotosAdmin() {
  const [artists, setArtists] = useState([])
  const [filteredArtists, setFilteredArtists] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadArtists()
  }, [])

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = artists.filter(a => 
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredArtists(filtered)
    } else {
      setFilteredArtists(artists)
    }
  }, [searchQuery, artists])

  const loadArtists = async () => {
    try {
      const data = await getAllArtists()
      // 排序：冇 heroPhoto 嘅排前面，其次按歌譜數量（多到少）
      const sorted = data.sort((a, b) => {
        const aHasHero = a.heroPhoto ? 1 : 0
        const bHasHero = b.heroPhoto ? 1 : 0
        if (aHasHero !== bHasHero) {
          return aHasHero - bHasHero
        }
        // 第二層：按歌譜數量（多到少）
        return (b.tabCount || 0) - (a.tabCount || 0)
      })
      setArtists(sorted)
      setFilteredArtists(sorted)
    } catch (error) {
      console.error('Error loading artists:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (artistId, file) => {
    if (!file) {
      console.log('No file selected')
      return
    }

    console.log('Starting upload for artist:', artistId, 'file:', file.name, 'size:', file.size)
    setUploadingId(artistId)
    setMessage('')

    // 檢查檔案類型
    if (!file.type.startsWith('image/')) {
      alert('請上傳圖片檔案')
      setUploadingId(null)
      return
    }

    // 檢查檔案大小（最大 2MB）
    if (file.size > 2 * 1024 * 1024) {
      alert('圖片大小不能超過 2MB')
      setUploadingId(null)
      return
    }

    // 轉換為 base64（使用 Promise 包裝）
    try {
      console.log('Converting to base64...')
      const base64String = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          console.log('FileReader completed, result length:', reader.result?.length)
          resolve(reader.result)
        }
        reader.onerror = (e) => {
          console.error('FileReader error:', e)
          reject(new Error('讀取檔案失敗'))
        }
        reader.readAsDataURL(file)
      })

      console.log('Updating Firestore for artist:', artistId)
      // 更新 Firestore
      const artistRef = doc(db, 'artists', artistId)
      await updateDoc(artistRef, {
        heroPhoto: base64String,
        updatedAt: new Date().toISOString()
      })
      console.log('Firestore update successful')

      // 更新本地狀態
      setArtists(prev => prev.map(a => 
        a.id === artistId ? { ...a, heroPhoto: base64String } : a
      ))

      setMessage(`✅ ${artists.find(a => a.id === artistId)?.name} 的 Hero 圖片上傳成功！`)
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Upload error:', error)
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      alert('上傳失敗：' + error.message + ' (請檢查 Console 獲取詳細錯誤)')
    } finally {
      setUploadingId(null)
    }
  }

  const handleDeleteHero = async (artistId) => {
    if (!confirm('確定要刪除 Hero 圖片嗎？')) return

    try {
      const artistRef = doc(db, 'artists', artistId)
      await updateDoc(artistRef, {
        heroPhoto: null,
        updatedAt: new Date().toISOString()
      })

      setArtists(prev => prev.map(a => 
        a.id === artistId ? { ...a, heroPhoto: null } : a
      ))

      setMessage('✅ Hero 圖片已刪除')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Delete error:', error)
      alert('刪除失敗：' + error.message)
    }
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Hero 圖片管理</h1>
            <p className="text-gray-500">
              上傳歌手頁面頂部的大圖片（建議尺寸：1920x1080 或 16:9 比例）
            </p>
          </div>
          <Link
            href="/admin/artists"
            className="inline-flex items-center text-[#FFD700] hover:opacity-80 transition"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回歌手管理
          </Link>
        </div>

        {/* Message */}
        {message && (
          <div className="bg-green-900/50 border border-green-700 text-green-400 px-4 py-3 rounded-lg">
            {message}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#121212] rounded-lg p-4 border border-gray-800">
            <p className="text-gray-500 text-sm">總歌手數</p>
            <p className="text-2xl font-bold text-white">{artists.length}</p>
          </div>
          <div className="bg-[#121212] rounded-lg p-4 border border-gray-800">
            <p className="text-gray-500 text-sm">已有 Hero 圖</p>
            <p className="text-2xl font-bold text-[#FFD700]">
              {artists.filter(a => a.heroPhoto).length}
            </p>
          </div>
          <div className="bg-[#121212] rounded-lg p-4 border border-gray-800">
            <p className="text-gray-500 text-sm">冇 Hero 圖</p>
            <p className="text-2xl font-bold text-red-400">
              {artists.filter(a => !a.heroPhoto).length}
            </p>
          </div>
          <div className="bg-[#121212] rounded-lg p-4 border border-gray-800">
            <p className="text-gray-500 text-sm">完成率</p>
            <p className="text-2xl font-bold text-green-400">
              {artists.length > 0 
                ? Math.round((artists.filter(a => a.heroPhoto).length / artists.length) * 100) 
                : 0}%
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="搜尋歌手..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#282828] border-0 rounded-full text-white placeholder-[#666] focus:ring-1 focus:ring-[#FFD700] outline-none"
          />
          <svg 
            className="absolute left-3 top-3.5 w-5 h-5 text-[#666]"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Artists Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[#121212] rounded-lg h-64 animate-pulse border border-gray-800" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArtists.map(artist => (
              <div 
                key={artist.id} 
                className={`bg-[#121212] rounded-lg overflow-hidden border ${
                  artist.heroPhoto ? 'border-[#FFD700]' : 'border-gray-800'
                }`}
              >
                {/* Preview Area */}
                <div className="relative aspect-video bg-gray-800">
                  {artist.heroPhoto ? (
                    <>
                      <img
                        src={artist.heroPhoto}
                        alt={artist.name}
                        className="w-full h-full object-cover"
                      />
                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteHero(artist.id)}
                        className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition"
                        title="刪除 Hero 圖片"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      {/* Status Badge */}
                      <div className="absolute top-2 left-2 px-2 py-1 bg-[#FFD700] text-black text-xs font-bold rounded">
                        已上傳
                      </div>
                    </>
                  ) : artist.photo ? (
                    <div className="relative w-full h-full">
                      <img
                        src={artist.photo}
                        alt={artist.name}
                        className="w-full h-full object-cover opacity-50"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-gray-400 text-sm">使用歌手頭像</span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-6xl">🎤</span>
                    </div>
                  )}
                </div>

                {/* Info & Upload */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    {/* Avatar - 圓形（手機風格） */}
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-800 flex-shrink-0">
                      {artist.photo ? (
                        <img src={artist.photo} alt={artist.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">🎤</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">{artist.name}</h3>
                      <p className="text-gray-500 text-sm">
                        {artist.tabCount || 0} 個譜
                      </p>
                    </div>
                  </div>

                  {/* Upload Button */}
                  <label className={`block w-full py-2 px-4 rounded-lg text-center cursor-pointer transition ${
                    artist.heroPhoto 
                      ? 'bg-gray-800 text-white hover:bg-gray-700' 
                      : 'bg-[#FFD700] text-black hover:opacity-90'
                  }`}>
                    {uploadingId === artist.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        上傳中...
                      </span>
                    ) : artist.heroPhoto ? (
                      '更換 Hero 圖片'
                    ) : (
                      '上傳 Hero 圖片'
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileUpload(artist.id, e.target.files[0])}
                      disabled={uploadingId === artist.id}
                    />
                  </label>

                  {/* Tips */}
                  {!artist.heroPhoto && (
                    <p className="text-xs text-gray-600 text-center">
                      建議：1920x1080 或 16:9 比例
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredArtists.length === 0 && (
          <div className="text-center py-16">
            <span className="text-6xl block mb-4">🔍</span>
            <h3 className="text-xl text-white mb-2">找不到歌手</h3>
            <p className="text-gray-500">試試其他關鍵字</p>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default function HeroPhotosPage() {
  return (
    <AdminGuard>
      <HeroPhotosAdmin />
    </AdminGuard>
  )
}

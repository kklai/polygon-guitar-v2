import { useState, useEffect } from 'react'
import { collection, getDocs, doc, updateDoc } from '@/lib/firestore-tracked'
import { db } from '@/lib/firebase'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { uploadToCloudinary, validateImageFile, formatFileSize } from '@/lib/cloudinary'

function ArtistManagement() {
  const [artists, setArtists] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadArtists()
  }, [])

  const loadArtists = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'artists'))
      const data = snapshot.docs.map(doc => {
        const artistData = doc.data()
        return {
          id: doc.id,
          ...artistData,
          // 分開存儲兩種相片來源
          photoURL: artistData.photoURL || null,
          wikiPhotoURL: artistData.wikiPhotoURL || null,
          // 顯示用：優先使用用戶上傳的 photoURL
          photo: artistData.photoURL || artistData.wikiPhotoURL || artistData.photo || null
        }
      })
      data.sort((a, b) => a.name.localeCompare(b.name, 'zh-HK'))
      setArtists(data)
    } catch (error) {
      console.error('Error loading artists:', error)
      showMessage('載入失敗：' + error.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleFileSelect = async (artistId, artistName, file) => {
    if (!file) return

    // 驗證檔案
    const validation = validateImageFile(file)
    if (!validation.valid) {
      showMessage(validation.error, 'error')
      return
    }

    setUploadingId(artistId)

    try {
      // 上傳到 Cloudinary
      const result = await uploadToCloudinary(file, artistName)

      // 更新 Firestore - 使用 photoURL 存儲用戶上傳的相片
      const artistRef = doc(db, 'artists', artistId)
      await updateDoc(artistRef, {
        photoURL: result.url,  // 用戶上傳的 Cloudinary 相片
        photoPublicId: result.publicId,
        photoWidth: result.width,
        photoHeight: result.height,
        updatedAt: new Date().toISOString()
      })

      // 更新本地狀態
      setArtists(prev => prev.map(artist => 
        artist.id === artistId 
          ? { 
              ...artist, 
              photo: result.url,  // 顯示用
              photoURL: result.url,  // 用戶上傳
              photoPublicId: result.publicId,
              photoWidth: result.width,
              photoHeight: result.height
            }
          : artist
      ))

      showMessage(
        `上傳成功！${result.width}×${result.height} · ${formatFileSize(result.bytes)}`,
        'success'
      )
    } catch (error) {
      console.error('Upload error:', error)
      showMessage('上傳失敗：' + error.message, 'error')
    } finally {
      setUploadingId(null)
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-[#121212] rounded-lg"></div>
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">🎤 歌手管理</h1>
            <p className="text-[#B3B3B3] mt-1">
              Cloud: drld2cjpo · Preset: artist_photos · Folder: artists
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a 
              href="/admin/hero-photos"
              className="inline-flex items-center px-3 py-2 bg-neutral-800 text-white rounded-lg font-medium hover:bg-neutral-700 transition text-sm"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Hero 圖片
            </a>
            <a 
              href="/admin/category-images"
              className="inline-flex items-center px-3 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition text-sm"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              分類圖片
            </a>
            <div className="text-sm text-[#B3B3B3] border-l border-neutral-700 pl-3">
              共 {artists.length} 位歌手
            </div>
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

        {/* Artists List */}
        <div className="space-y-4">
          {artists.map(artist => (
            <div 
              key={artist.id}
              className="bg-[#121212] rounded-xl p-4 border border-neutral-800"
            >
              <div className="flex items-center space-x-4">
                {/* Photos - 雙相片顯示 */}
                <div className="flex-shrink-0 flex items-center gap-3">
                  {/* 用戶上傳相片 (photoURL) */}
                  <div className="text-center">
                    <div className="relative">
                      {artist.photoURL ? (
                        <img 
                          src={artist.photoURL} 
                          alt={`${artist.name} - 用戶上傳`}
                          className="w-16 h-16 rounded-full object-cover border-2 border-[#FFD700]"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center border-2 border-dashed border-neutral-600">
                          <span className="text-2xl">📷</span>
                        </div>
                      )}
                      {/* 標籤 */}
                      <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 text-[9px] bg-[#FFD700] text-black px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                        用戶上傳
                      </span>
                    </div>
                  </div>
                  
                  {/* 維基百科相片 (wikiPhotoURL) */}
                  <div className="text-center">
                    <div className="relative">
                      {artist.wikiPhotoURL ? (
                        <img 
                          src={artist.wikiPhotoURL} 
                          alt={`${artist.name} - 維基百科`}
                          className="w-16 h-16 rounded-full object-cover border-2 border-neutral-600"
                        />
                      ) : artist.photo && !artist.photoURL ? (
                        <img 
                          src={artist.photo} 
                          alt={`${artist.name} - 維基百科`}
                          className="w-16 h-16 rounded-full object-cover border-2 border-neutral-600"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center border-2 border-dashed border-neutral-600">
                          <span className="text-2xl">🌐</span>
                        </div>
                      )}
                      {/* 標籤 */}
                      <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 text-[9px] bg-neutral-600 text-white px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                        維基百科
                      </span>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-grow min-w-0">
                  <h3 className="text-lg font-bold text-white">{artist.name}</h3>
                  <p className="text-sm text-[#B3B3B3]">
                    ID: {artist.id} · {artist.tabCount || 0} 個譜
                    {artist.photoWidth && ` · ${artist.photoWidth}×${artist.photoHeight}`}
                  </p>
                  {/* 顯示當前使用的相片來源 */}
                  <p className="text-xs mt-1">
                    {artist.photoURL ? (
                      <span className="text-[#FFD700]">✓ 使用用戶上傳相片</span>
                    ) : artist.wikiPhotoURL || artist.photo ? (
                      <span className="text-neutral-500">使用維基百科相片</span>
                    ) : (
                      <span className="text-neutral-600">無相片</span>
                    )}
                  </p>
                </div>

                {/* Upload Button */}
                <div className="flex-shrink-0">
                  <label 
                    className={`
                      inline-flex items-center px-4 py-2 rounded-lg font-medium cursor-pointer transition
                      ${uploadingId === artist.id 
                        ? 'bg-neutral-800 text-neutral-400 cursor-not-allowed' 
                        : 'bg-[#FFD700] text-black hover:opacity-90'
                      }
                    `}
                  >
                    {uploadingId === artist.id ? (
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
                        {artist.photoURL ? '更換相片' : '上傳相片'}
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      disabled={uploadingId === artist.id}
                      onChange={(e) => {
                        const file = e.target.files[0]
                        if (file) {
                          handleFileSelect(artist.id, artist.name, file)
                        }
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="bg-[#121212] rounded-xl p-4 border border-neutral-800">
          <h3 className="font-semibold text-white mb-2">📌 設定資訊</h3>
          <ul className="text-sm text-[#B3B3B3] space-y-1 font-mono">
            <li>Cloud Name: drld2cjpo</li>
            <li>Upload Preset: artist_photos</li>
            <li>Folder: artists</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

export default function ArtistManagementPage() {
  return (
    <AdminGuard>
      <ArtistManagement />
    </AdminGuard>
  )
}

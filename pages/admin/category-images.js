import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { doc, getDoc, setDoc, collection, query, where, limit, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'

export default function CategoryImagesAdmin() {
  const [categoryImages, setCategoryImages] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState(null)

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
      // 定義各類別及其可能的 artistType 值
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
          
          // 對每種可能的 type 值進行查詢
          for (const typeValue of config.types) {
            const q = query(
              collection(db, 'artists'),
              where('artistType', '==', typeValue),
              limit(100)
            )
            
            const snapshot = await getDocs(q)
            snapshot.docs.forEach(d => {
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
          
          // 找出第一個有照片的藝人
          const artistWithPhoto = sortedArtists.find(a => a.wikiPhotoURL || a.photoURL)
          
          if (artistWithPhoto) {
            const photoUrl = artistWithPhoto.wikiPhotoURL || artistWithPhoto.photoURL
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

  const categories = [
    { id: 'male', name: '男歌手', icon: '👨‍🎤' },
    { id: 'female', name: '女歌手', icon: '👩‍🎤' },
    { id: 'group', name: '組合', icon: '👥' }
  ]

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6">
      <Head>
        <title>分類封面管理 | Polygon Guitar</title>
      </Head>

      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">分類封面管理</h1>
            <p className="text-slate-400">手動更新首頁歌手分類顯示的封面圖片</p>
          </div>
          <Link href="/admin" className="text-slate-400 hover:text-white">← 返回管理員</Link>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-1">手動更新封面</h2>
              <p className="text-slate-400 text-sm">
                系統會獲取各類別最熱門的歌手相片作為封面<br/>
                <span className="text-slate-500">（組合會檢查 group / band 兩種類型）</span>
              </p>
            </div>
            <button
              onClick={handleUpdate}
              disabled={updating}
              className={`px-6 py-3 rounded-lg font-medium ${
                updating ? 'bg-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {updating ? '更新中...' : '立即更新'}
            </button>
          </div>

          {message && (
            <div className={`mt-4 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
            }`}>
              {message.text}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {categories.map((cat) => {
            const data = categoryImages?.[cat.id]
            return (
              <div key={cat.id} className="bg-slate-800 rounded-lg overflow-hidden">
                <div className="relative aspect-square">
                  {data?.image ? (
                    <img src={data.image} alt={cat.name} className="w-full h-full object-cover"/>
                  ) : (
                    <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                      <span className="text-6xl">{cat.icon}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-xl font-bold">{cat.name}</h3>
                    {data?.artistName && <p className="text-slate-300">{data.artistName}</p>}
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  {data?.artistType && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">類型</span>
                      <span className="text-slate-200">{data.artistType}</span>
                    </div>
                  )}
                  {data?.hotScore !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">熱門分數</span>
                      <span className="text-slate-200">{data.hotScore}</span>
                    </div>
                  )}
                  {data?.updatedAt && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">更新時間</span>
                      <span className="text-slate-200">
                        {new Date(data.updatedAt).toLocaleDateString('zh-HK')}
                      </span>
                    </div>
                  )}
                  {!data && <p className="text-slate-500 text-sm text-center py-2">尚未設定封面</p>}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-8 bg-slate-800/50 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-2">說明</h3>
          <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
            <li>系統會根據歌手的 tabCount（譜數量）排序，選出最熱門的歌手</li>
            <li>優先使用維基百科圖片，如無則使用用戶上傳的圖片</li>
            <li>組合類別會檢查 artistType = 'group' 或 'band'</li>
            <li>需要時才手動更新，無需自動排程</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

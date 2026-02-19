import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Link from 'next/link'

export default function UpdateSpotifyPhotos() {
  const { user, isAdmin } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, artist: '' })
  const [results, setResults] = useState({ success: 0, failed: 0, skipped: 0 })
  const [log, setLog] = useState([])
  const [artists, setArtists] = useState([])
  const [batchSize, setBatchSize] = useState(100)
  const [startIndex, setStartIndex] = useState(0)

  // 搜索 Spotify 歌手（通過後端 API）
  const searchSpotifyArtist = async (artistName) => {
    try {
      const cleanName = artistName.replace(/\s*[\(\（].*?[\)\）]\s*/g, '').trim()
      
      const response = await fetch('/api/spotify/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: cleanName })
      })
      
      if (!response.ok) {
        if (response.status === 404) return null
        const error = await response.json()
        throw new Error(error.error || 'Search failed')
      }
      
      return await response.json()
    } catch (error) {
      console.error(`搜索 ${artistName} 失敗:`, error)
      throw error
    }
  }

  // 加載歌手列表
  const loadArtists = async () => {
    const snapshot = await getDocs(query(collection(db, 'artists'), orderBy('name')))
    const allArtists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    // 按歌曲數排序
    allArtists.sort((a, b) => (b.songCount || b.tabCount || 0) - (a.songCount || a.tabCount || 0))
    setArtists(allArtists)
  }

  useEffect(() => {
    loadArtists()
  }, [])

  // 開始更新
  const startUpdate = async () => {
    if (isLoading) return
    
    setIsLoading(true)
    setLog([])
    setResults({ success: 0, failed: 0, skipped: 0 })
    
    try {
      const batchArtists = artists.slice(startIndex, startIndex + batchSize)
      
      setProgress({ current: 0, total: batchArtists.length, artist: '' })
      
      let success = 0
      let failed = 0
      let skipped = 0
      
      for (let i = 0; i < batchArtists.length; i++) {
        const artist = batchArtists[i]
        setProgress({ current: i + 1, total: batchArtists.length, artist: artist.name })
        
        // 檢查是否已有用戶上傳的相片
        if (artist.photoURL && !artist.photoURL.includes('spotify')) {
          setLog(prev => [...prev, { name: artist.name, status: 'skipped', msg: '已有用戶上傳相片' }])
          skipped++
          setResults(r => ({ ...r, skipped }))
          continue
        }
        
        // 搜索 Spotify
        const spotifyArtist = await searchSpotifyArtist(artist.name)
        
        if (spotifyArtist && spotifyArtist.images.length > 0) {
          const largestImage = spotifyArtist.images[0]
          
          // 更新 Firestore
          await updateDoc(doc(db, 'artists', artist.id), {
            spotifyId: spotifyArtist.id,
            spotifyPhotoURL: largestImage.url,
            wikiPhotoURL: artist.wikiPhotoURL || null,
            photoSource: 'spotify',
            updatedAt: new Date()
          })
          
          setLog(prev => [...prev, { name: artist.name, status: 'success', msg: `${largestImage.width}x${largestImage.height}` }])
          success++
          setResults(r => ({ ...r, success }))
        } else {
          setLog(prev => [...prev, { name: artist.name, status: 'failed', msg: '找不到 Spotify 資料' }])
          failed++
          setResults(r => ({ ...r, failed }))
        }
        
        // 延遲避免 rate limit（開發模式限額很低，需要較長間隔）
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      
      setLog(prev => [...prev, { name: '完成！', status: 'success', msg: `成功: ${success}, 失敗: ${failed}, 跳過: ${skipped}` }])
      
    } catch (error) {
      console.error(error)
      setLog(prev => [...prev, { name: '錯誤', status: 'failed', msg: error.message }])
    } finally {
      setIsLoading(false)
      setProgress({ current: 0, total: 0, artist: '' })
    }
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="min-h-screen bg-black flex items-center justify-center">
          <p className="text-white">只有管理員可以訪問此頁面</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                <span className="text-[#FFD700]">Spotify</span> 歌手相片更新
              </h1>
              <p className="text-gray-400">從 Spotify 獲取歌手相片並更新到資料庫</p>
            </div>
            <Link 
              href="/admin" 
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
            >
              返回後台
            </Link>
          </div>

          {/* 統計卡片 */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-[#121212] p-4 rounded-lg">
              <p className="text-gray-400 text-sm">總歌手數</p>
              <p className="text-3xl font-bold text-white">{artists.length}</p>
            </div>
            <div className="bg-green-900/30 p-4 rounded-lg border border-green-800">
              <p className="text-green-400 text-sm">成功</p>
              <p className="text-3xl font-bold text-green-400">{results.success}</p>
            </div>
            <div className="bg-red-900/30 p-4 rounded-lg border border-red-800">
              <p className="text-red-400 text-sm">失敗</p>
              <p className="text-3xl font-bold text-red-400">{results.failed}</p>
            </div>
            <div className="bg-yellow-900/30 p-4 rounded-lg border border-yellow-800">
              <p className="text-yellow-400 text-sm">跳過</p>
              <p className="text-3xl font-bold text-yellow-400">{results.skipped}</p>
            </div>
          </div>

          {/* 設置 */}
          <div className="bg-[#121212] p-6 rounded-lg mb-8">
            <h2 className="text-xl font-bold text-white mb-4">更新設置</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-400 text-sm mb-2">批次大小</label>
                <select 
                  value={batchSize} 
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="w-full bg-black border border-gray-700 rounded-lg px-4 py-2 text-white"
                  disabled={isLoading}
                >
                  <option value={10}>10 個（測試）</option>
                  <option value={50}>50 個</option>
                  <option value={100}>100 個（熱門歌手）</option>
                  <option value={200}>200 個</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">開始位置</label>
                <input 
                  type="number" 
                  value={startIndex}
                  onChange={(e) => setStartIndex(Number(e.target.value))}
                  min={0}
                  max={artists.length}
                  className="w-full bg-black border border-gray-700 rounded-lg px-4 py-2 text-white"
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500 mt-1">跳過前 {startIndex} 個歌手</p>
              </div>
            </div>
          </div>

          {/* 進度條 */}
          {isLoading && progress.total > 0 && (
            <div className="bg-[#121212] p-6 rounded-lg mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white">更新進度</span>
                <span className="text-[#FFD700]">{progress.current} / {progress.total}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div 
                  className="bg-[#FFD700] h-2 rounded-full transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-gray-400 text-sm mt-2">正在處理: {progress.artist}</p>
            </div>
          )}

          {/* 開始按鈕 */}
          <button
            onClick={startUpdate}
            disabled={isLoading}
            className={`w-full py-4 rounded-lg font-bold text-lg transition ${
              isLoading 
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                : 'bg-[#FFD700] text-black hover:bg-yellow-400'
            }`}
          >
            {isLoading ? '更新中...' : `開始更新 ${batchSize} 個歌手`}
          </button>

          {/* 日誌 */}
          {log.length > 0 && (
            <div className="mt-8 bg-[#121212] rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              <div className="sticky top-0 bg-[#1a1a1a] px-4 py-2 border-b border-gray-800">
                <span className="text-white font-medium">處理日誌</span>
              </div>
              <div className="divide-y divide-gray-800">
                {log.map((item, index) => (
                  <div key={index} className="px-4 py-2 flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      item.status === 'success' ? 'bg-green-900 text-green-400' :
                      item.status === 'failed' ? 'bg-red-900 text-red-400' :
                      'bg-yellow-900 text-yellow-400'
                    }`}>
                      {item.status === 'success' ? '✓' : item.status === 'failed' ? '✗' : '⏭'}
                    </span>
                    <span className="text-white flex-1">{item.name}</span>
                    <span className="text-gray-500 text-sm">{item.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 說明 */}
          <div className="mt-8 bg-[#121212] p-6 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-3">使用說明</h3>
            <ul className="text-gray-400 space-y-2 text-sm">
              <li>• 歌手按歌曲數排序，熱門歌手優先更新</li>
              <li>• 已有用戶上傳相片的歌手會自動跳過</li>
              <li>• 每次請求間隔 0.5 秒，避免 rate limit</li>
              <li>• 建議先試 10 個測試，確認正常後再更新 100 個</li>
              <li>• 如果中途停止，記住最後位置，下次從該位置繼續</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  )
}

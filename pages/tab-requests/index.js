import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { 
  collection, query, orderBy, getDocs, addDoc, 
  updateDoc, doc, arrayUnion, arrayRemove, serverTimestamp,
  where
} from 'firebase/firestore'
import Link from 'next/link'
import Image from 'next/image'

export default function TabRequestsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // 表單數據
  const [formData, setFormData] = useState({
    songTitle: '',
    artistName: '',
  })
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)

  // 載入求譜列表
  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    try {
      // 使用單一字段排序（避免需要複合索引）
      const q = query(
        collection(db, 'tabRequests'),
        orderBy('voteCount', 'desc')
      )
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      }))
      // 在客戶端進行二次排序：先按 voteCount，再按 createdAt
      data.sort((a, b) => {
        if (b.voteCount !== a.voteCount) {
          return b.voteCount - a.voteCount
        }
        return b.createdAt - a.createdAt
      })
      setRequests(data)
    } catch (error) {
      console.error('Error loading requests:', error)
    } finally {
      setLoading(false)
    }
  }

  // 搜尋歌曲資料（Spotify）
  const searchSong = async () => {
    if (!formData.songTitle || !formData.artistName) return
    
    setSearching(true)
    try {
      const res = await fetch(`/api/spotify/search-track?q=${encodeURIComponent(formData.songTitle)}&artist=${encodeURIComponent(formData.artistName)}`)
      const data = await res.json()
      
      if (data.track) {
        setSearchResults({
          title: data.track.name,
          artist: data.track.artists.map(a => a.name).join(', '),
          albumImage: data.track.album?.images?.[0]?.url,
          albumName: data.track.album?.name,
        })
      } else {
        // 沒找到，用用戶輸入
        setSearchResults({
          title: formData.songTitle,
          artist: formData.artistName,
          albumImage: null,
        })
      }
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults({
        title: formData.songTitle,
        artist: formData.artistName,
        albumImage: null,
      })
    } finally {
      setSearching(false)
    }
  }

  // 提交求譜
  const handleSubmit = async () => {
    if (!user) {
      alert('請先登入')
      return
    }
    if (!searchResults) return

    setSubmitting(true)
    try {
      // 檢查是否已有相同求譜
      const existingQuery = query(
        collection(db, 'tabRequests'),
        where('songTitle', '==', searchResults.title),
        where('artistName', '==', searchResults.artist)
      )
      const existingSnap = await getDocs(existingQuery)
      
      if (!existingSnap.empty) {
        // 已有相同求譜，直接投票（使用內部邏輯避免重複載入）
        const existing = existingSnap.docs[0]
        const requestId = existing.id
        const requestData = existing.data()
        
        const requestRef = doc(db, 'tabRequests', requestId)
        
        if (requestData.voters?.includes(user.uid)) {
          // 取消投票
          await updateDoc(requestRef, {
            voteCount: (requestData.voteCount || 1) - 1,
            voters: arrayRemove(user.uid)
          })
        } else {
          // 投票
          await updateDoc(requestRef, {
            voteCount: (requestData.voteCount || 0) + 1,
            voters: arrayUnion(user.uid)
          })
        }
      } else {
        // 創建新求譜
        await addDoc(collection(db, 'tabRequests'), {
          songTitle: searchResults.title,
          artistName: searchResults.artist,
          albumImage: searchResults.albumImage,
          albumName: searchResults.albumName,
          requestedBy: user.uid,
          requesterName: user.displayName || '匿名用戶',
          requesterPhoto: user.photoURL,
          createdAt: serverTimestamp(),
          voteCount: 1,
          voters: [user.uid],
          status: 'pending',
          fulfilledBy: null,
          fulfilledAt: null,
        })
      }
      
      // 重置表單
      setFormData({ songTitle: '', artistName: '' })
      setSearchResults(null)
      setShowForm(false)
      
      // 稍微延遲確保 Firestore 同步完成，然後重新載入
      setTimeout(() => {
        loadRequests()
      }, 300)
    } catch (error) {
      console.error('Error submitting request:', error)
      alert('提交失敗，請重試')
    } finally {
      setSubmitting(false)
    }
  }

  // 投票（舉手）
  const voteForRequest = async (requestId) => {
    if (!user) {
      alert('請先登入')
      return
    }

    try {
      const requestRef = doc(db, 'tabRequests', requestId)
      const request = requests.find(r => r.id === requestId)
      
      // 先更新本地 state 讓用戶立即看到變化
      const hasUserVoted = request.voters?.includes(user.uid)
      const updatedRequests = requests.map(r => {
        if (r.id === requestId) {
          return {
            ...r,
            voteCount: hasUserVoted ? (r.voteCount || 1) - 1 : (r.voteCount || 0) + 1,
            voters: hasUserVoted 
              ? (r.voters || []).filter(id => id !== user.uid)
              : [...(r.voters || []), user.uid]
          }
        }
        return r
      })
      // 按 voteCount 重新排序
      updatedRequests.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))
      setRequests(updatedRequests)
      
      // 然後更新 Firestore
      if (hasUserVoted) {
        await updateDoc(requestRef, {
          voteCount: (request.voteCount || 1) - 1,
          voters: arrayRemove(user.uid)
        })
      } else {
        await updateDoc(requestRef, {
          voteCount: (request.voteCount || 0) + 1,
          voters: arrayUnion(user.uid)
        })
      }
    } catch (error) {
      console.error('Error voting:', error)
      // 出錯時重新載入
      loadRequests()
    }
  }

  // 檢查是否已投票
  const hasVoted = (request) => {
    return request.voters?.includes(user?.uid)
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">POLYGON求譜區</h1>
            <p className="text-gray-500 text-sm mt-1">搵人幫手出譜，或者幫人出譜</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-[#FFD700] text-black rounded-full font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            求譜
          </button>
        </div>

        {/* 求譜表單 Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-[#121212] rounded-2xl w-full max-w-md overflow-hidden">
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">提交求譜</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">歌名</label>
                  <input
                    type="text"
                    value={formData.songTitle}
                    onChange={(e) => setFormData({...formData, songTitle: e.target.value})}
                    className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-[#FFD700] focus:outline-none"
                    placeholder="輸入歌名"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-400 text-sm mb-2">歌手</label>
                  <input
                    type="text"
                    value={formData.artistName}
                    onChange={(e) => setFormData({...formData, artistName: e.target.value})}
                    className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-[#FFD700] focus:outline-none"
                    placeholder="輸入歌手名"
                  />
                </div>

                <button
                  onClick={searchSong}
                  disabled={!formData.songTitle || !formData.artistName || searching}
                  className="w-full py-3 bg-[#282828] text-white rounded-xl font-medium disabled:opacity-50"
                >
                  {searching ? '搜尋中...' : '搜尋歌曲資料'}
                </button>

                {/* 搜尋結果預覽 */}
                {searchResults && (
                  <div className="bg-[#1a1a1a] rounded-xl p-4 flex items-center gap-4">
                    <div className="w-16 h-16 bg-[#282828] rounded-lg overflow-hidden flex-shrink-0">
                      {searchResults.albumImage ? (
                        <img 
                          src={searchResults.albumImage} 
                          alt="" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">{searchResults.title}</div>
                      <div className="text-gray-500 text-sm truncate">{searchResults.artist}</div>
                      {searchResults.albumName && (
                        <div className="text-gray-600 text-xs truncate">{searchResults.albumName}</div>
                      )}
                    </div>
                  </div>
                )}

                {searchResults && (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full py-3 bg-[#FFD700] text-black rounded-xl font-bold disabled:opacity-50"
                  >
                    {submitting ? '提交中...' : '確認求譜'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 求譜列表 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
            </div>
            <p className="text-gray-500">暫時未有求譜</p>
            <p className="text-gray-600 text-sm mt-1">成為第一個求譜的人吧！</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div 
                key={request.id}
                className="bg-[#121212] rounded-xl p-4 flex items-center gap-4"
              >
                {/* 專輯封面 */}
                <div className="w-14 h-14 bg-[#1a1a1a] rounded-lg overflow-hidden flex-shrink-0">
                  {request.albumImage ? (
                    <img 
                      src={request.albumImage} 
                      alt="" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* 歌曲資訊 */}
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{request.songTitle}</div>
                  <div className="text-gray-500 text-sm truncate">{request.artistName}</div>
                  <div className="text-[#FFD700] text-xs mt-1">
                    {request.voteCount}人求譜
                  </div>
                </div>

                {/* 操作按鈕 */}
                <div className="flex items-center gap-2">
                  {/* 舉手按鈕 */}
                  <button
                    onClick={() => voteForRequest(request.id)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                      hasVoted(request) 
                        ? 'bg-[#FFD700] text-black' 
                        : 'bg-[#1a1a1a] text-white hover:bg-[#282828]'
                    }`}
                    title={hasVoted(request) ? '取消求譜' : '我也需要'}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                    </svg>
                  </button>

                  {/* 出譜按鈕 */}
                  <Link
                    href={`/tabs/new?title=${encodeURIComponent(request.songTitle)}&artist=${encodeURIComponent(request.artistName)}`}
                    className="w-10 h-10 rounded-full bg-[#1a1a1a] text-[#FFD700] flex items-center justify-center hover:bg-[#FFD700] hover:text-black transition"
                    title="我要出譜"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { 
  collection, query, orderBy, getDocs, addDoc, 
  updateDoc, doc, arrayUnion, arrayRemove, serverTimestamp,
  where, deleteDoc
} from 'firebase/firestore'
import Link from 'next/link'
import Image from 'next/image'

export default function TabRequestsPage() {
  const { user, isAdmin } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Admin 編輯狀態
  const [editingRequest, setEditingRequest] = useState(null)
  const [editFormData, setEditFormData] = useState({ songTitle: '', artistName: '' })
  
  // 表單數據
  const [formData, setFormData] = useState({
    songTitle: '',
    artistName: '',
  })
  const [searchResults, setSearchResults] = useState(null)
  const [multipleResults, setMultipleResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchSource, setSearchSource] = useState(null) // 'spotify', 'youtube', 'manual', 'multiple'
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  
  // 檢查現有樂譜
  const [existingTab, setExistingTab] = useState(null)
  const [showExistingTabModal, setShowExistingTabModal] = useState(false)

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

  // 搜尋歌曲資料（Spotify -> YouTube）
  const searchSong = async () => {
    // 必須有歌名才能搜尋
    if (!formData.songTitle) return
    
    setSearching(true)
    setSearchSource(null)
    setMultipleResults([])
    
    try {
      // 1. 先搜尋 Spotify（返回多個結果）
      const searchQuery = formData.songTitle && formData.artistName
        ? `${formData.songTitle} ${formData.artistName}`
        : formData.songTitle || formData.artistName
        
      const spotifyRes = await fetch(`/api/spotify/search-track?q=${encodeURIComponent(searchQuery)}`)
      const spotifyData = await spotifyRes.json()
      
      // 處理多個結果
      if (spotifyData.results && spotifyData.results.length > 0) {
        if (spotifyData.results.length === 1) {
          // 只有一個結果，直接選擇
          const track = spotifyData.results[0]
          setSearchResults({
            title: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            albumImage: track.albumImage,
            albumName: track.album,
            youtubeUrl: null,
            spotifyId: track.id
          })
          setSearchSource('spotify')
        } else {
          // 多個結果，讓用戶選擇
          setMultipleResults(spotifyData.results)
          setSearchSource('multiple')
        }
        setSearching(false)
        return
      }
      
      // 2. Spotify 找不到，改搜尋 YouTube
      let youtubeData = null
      try {
        const youtubeQuery = formData.songTitle && formData.artistName
          ? `${formData.songTitle} ${formData.artistName}`
          : formData.songTitle || formData.artistName
        const youtubeRes = await fetch(`/api/youtube/search?q=${encodeURIComponent(youtubeQuery)}`)
        youtubeData = await youtubeRes.json()
        
        // 檢查是否 quota exceeded
        if (youtubeData.error === 'quotaExceeded') {
          console.warn('YouTube API quota exceeded, falling back to manual')
        } else if (youtubeData.video) {
          setSearchResults({
            title: formData.songTitle || youtubeData.video.title,
            artist: formData.artistName || '',
            albumImage: youtubeData.video.thumbnail,
            albumName: null,
            youtubeUrl: `https://youtube.com/watch?v=${youtubeData.video.id}`,
          })
          setSearchSource('youtube')
          setSearching(false)
          return
        }
      } catch (youtubeError) {
        console.error('YouTube search error:', youtubeError)
      }
      
      // 3. 都找不到（或 API 錯誤），顯示確認對話框
      setShowConfirmModal(true)
      setSearchResults({
        title: formData.songTitle || '',
        artist: formData.artistName || '',
        albumImage: null,
        albumName: null,
        youtubeUrl: null,
      })
      setSearchSource('manual')
      
    } catch (error) {
      console.error('Search error:', error)
      // 出錯時也顯示確認對話框
      setShowConfirmModal(true)
      setSearchResults({
        title: formData.songTitle || '',
        artist: formData.artistName || '',
        albumImage: null,
        albumName: null,
        youtubeUrl: null,
      })
      setSearchSource('manual')
    } finally {
      setSearching(false)
    }
  }

  // 檢查是否已有相同樂譜
  const checkExistingTab = async () => {
    if (!searchResults) return false
    
    try {
      // 搜尋相同歌名和歌手的樂譜
      const tabsQuery = query(
        collection(db, 'tabs'),
        where('title', '==', searchResults.title),
        where('artist', '==', searchResults.artist)
      )
      const tabsSnap = await getDocs(tabsQuery)
      
      if (!tabsSnap.empty) {
        setExistingTab({
          id: tabsSnap.docs[0].id,
          ...tabsSnap.docs[0].data()
        })
        setShowExistingTabModal(true)
        return true
      }
      
      return false
    } catch (error) {
      console.error('Error checking existing tab:', error)
      return false
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
      // 先檢查是否已有相同樂譜
      const hasExistingTab = await checkExistingTab()
      if (hasExistingTab) {
        setSubmitting(false)
        return
      }
      
      // 繼續提交求譜...
      await submitRequest()
    } catch (error) {
      console.error('Error submitting request:', error)
      alert('提交失敗，請重試')
      setSubmitting(false)
    }
  }
  
  // 實際提交求譜的邏輯
  const submitRequest = async () => {
    try {
      // 檢查是否已有相同求譜
      const existingQuery = query(
        collection(db, 'tabRequests'),
        where('songTitle', '==', searchResults.title),
        where('artistName', '==', searchResults.artist)
      )
      const existingSnap = await getDocs(existingQuery)
      
      if (!existingSnap.empty) {
        // 已有相同求譜，直接投票
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
          albumImage: searchResults.albumImage || null,
          albumName: searchResults.albumName || null,
          youtubeUrl: searchResults.youtubeUrl || null,
          searchSource: searchSource || 'manual',
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
      setSearchSource(null)
      setShowConfirmModal(false)
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

  // Admin 刪除求譜
  const deleteRequest = async (requestId) => {
    if (!isAdmin) return
    
    if (!confirm('確定要刪除這個求譜嗎？此操作無法復原。')) return
    
    try {
      await deleteDoc(doc(db, 'tabRequests', requestId))
      // 從本地列表移除
      setRequests(requests.filter(r => r.id !== requestId))
    } catch (error) {
      console.error('Error deleting request:', error)
      alert('刪除失敗，請重試')
    }
  }

  // Admin 開始編輯
  const startEdit = (request) => {
    if (!isAdmin) return
    setEditingRequest(request)
    setEditFormData({
      songTitle: request.songTitle,
      artistName: request.artistName
    })
  }

  // Admin 保存編輯
  const saveEdit = async () => {
    if (!isAdmin || !editingRequest) return
    
    try {
      const requestRef = doc(db, 'tabRequests', editingRequest.id)
      await updateDoc(requestRef, {
        songTitle: editFormData.songTitle,
        artistName: editFormData.artistName
      })
      
      // 更新本地列表
      setRequests(requests.map(r => 
        r.id === editingRequest.id 
          ? { ...r, songTitle: editFormData.songTitle, artistName: editFormData.artistName }
          : r
      ))
      
      setEditingRequest(null)
    } catch (error) {
      console.error('Error updating request:', error)
      alert('更新失敗，請重試')
    }
  }

  // Admin 取消編輯
  const cancelEdit = () => {
    setEditingRequest(null)
    setEditFormData({ songTitle: '', artistName: '' })
  }

  return (
    <Layout>
      <div>
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
                    className="w-full bg-[#282828] border-0 rounded-full px-4 py-3 text-white placeholder-[#666] focus:ring-1 focus:ring-[#FFD700] outline-none"
                    placeholder="輸入歌名"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-400 text-sm mb-2">歌手（選填）</label>
                  <input
                    type="text"
                    value={formData.artistName}
                    onChange={(e) => setFormData({...formData, artistName: e.target.value})}
                    className="w-full bg-[#282828] border-0 rounded-full px-4 py-3 text-white placeholder-[#666] focus:ring-1 focus:ring-[#FFD700] outline-none"
                    placeholder="輸入歌手名"
                  />
                </div>

                <button
                  onClick={searchSong}
                  disabled={!formData.songTitle || searching}
                  className="w-full py-3 bg-[#282828] text-white rounded-xl font-medium disabled:opacity-50"
                >
                  {searching ? '搜尋中...' : '搜尋歌曲資料'}
                </button>

                {/* 多結果選擇 - 當找到多首歌曲時 */}
                {multipleResults.length > 0 && searchSource === 'multiple' && (
                  <div className="bg-[#1a1a1a] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                        </svg>
                        Spotify - 找到 {multipleResults.length} 首歌曲
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm mb-3">請選擇正確的歌曲：</p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {multipleResults.map((track, idx) => (
                        <button
                          key={track.id}
                          onClick={() => {
                            setSearchResults({
                              title: track.name,
                              artist: track.artists.map(a => a.name).join(', '),
                              albumImage: track.albumImage,
                              albumName: track.album,
                              youtubeUrl: null,
                              spotifyId: track.id
                            })
                            setSearchSource('spotify')
                            setMultipleResults([])
                          }}
                          className="w-full flex items-center gap-3 p-3 bg-[#282828] hover:bg-[#333] rounded-lg transition text-left"
                        >
                          <div className="w-12 h-12 bg-[#1a1a1a] rounded overflow-hidden flex-shrink-0">
                            {track.albumImage ? (
                              <img src={track.albumImage} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600">🎵</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium truncate">{track.name}</div>
                            <div className="text-gray-500 text-sm truncate">{track.artists.map(a => a.name).join(', ')}</div>
                            <div className="text-gray-600 text-xs">{track.album} {track.releaseYear && `(${track.releaseYear})`}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={async () => {
                        setMultipleResults([])
                        setSearching(true)
                        
                        // 去 YouTube 搜尋
                        try {
                          const youtubeQuery = formData.songTitle && formData.artistName
                            ? `${formData.songTitle} ${formData.artistName}`
                            : formData.songTitle || formData.artistName
                          const youtubeRes = await fetch(`/api/youtube/search?q=${encodeURIComponent(youtubeQuery)}`)
                          const youtubeData = await youtubeRes.json()
                          
                          if (youtubeData.video) {
                            setSearchResults({
                              title: formData.songTitle || youtubeData.video.title,
                              artist: formData.artistName || '',
                              albumImage: youtubeData.video.thumbnail,
                              albumName: null,
                              youtubeUrl: `https://youtube.com/watch?v=${youtubeData.video.id}`,
                            })
                            setSearchSource('youtube')
                          } else {
                            // YouTube 也找不到，才顯示手動輸入
                            setShowConfirmModal(true)
                            setSearchResults({
                              title: formData.songTitle,
                              artist: formData.artistName,
                              albumImage: null,
                              albumName: null,
                              youtubeUrl: null
                            })
                            setSearchSource('manual')
                          }
                        } catch (err) {
                          console.error('YouTube search error:', err)
                          // 出錯時顯示手動輸入
                          setShowConfirmModal(true)
                          setSearchResults({
                            title: formData.songTitle,
                            artist: formData.artistName,
                            albumImage: null,
                            albumName: null,
                            youtubeUrl: null
                          })
                          setSearchSource('manual')
                        } finally {
                          setSearching(false)
                        }
                      }}
                      className="w-full mt-3 py-2 text-gray-400 hover:text-white text-sm"
                    >
                      都不是，搜尋 YouTube
                    </button>
                  </div>
                )}

                {/* 搜尋結果預覽 */}
                {searchResults && !showConfirmModal && searchSource !== 'multiple' && (
                  <div className="bg-[#1a1a1a] rounded-xl p-4">
                    {/* 來源標籤 */}
                    <div className="flex items-center gap-2 mb-3">
                      {searchSource === 'spotify' && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                          </svg>
                          Spotify
                        </span>
                      )}
                      {searchSource === 'youtube' && (
                        <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full flex items-center gap-1">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                          </svg>
                          YouTube
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4">
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
                  </div>
                )}

                {/* 確認對話框 - 當 Spotify 和 YouTube 都找不到時 */}
                {showConfirmModal && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="text-yellow-400 font-medium text-sm">找不到這首歌</p>
                        <p className="text-gray-400 text-xs mt-1">
                          在 Spotify 和 YouTube 上都找不到「{formData.songTitle} - {formData.artistName}」。
                        </p>
                        <p className="text-gray-500 text-xs mt-2">
                          可能原因：
                        </p>
                        <ul className="text-gray-500 text-xs mt-1 list-disc list-inside">
                          <li>歌名或歌手名輸入錯誤</li>
                          <li>歌曲尚未在這些平台發布</li>
                          <li>YouTube 搜尋配額暫時用完</li>
                        </ul>
                        <p className="text-gray-400 text-xs mt-3 font-medium">
                          你確定要使用這個歌名和歌手名提交求譜嗎？
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => {
                          setShowConfirmModal(false)
                          setSearchResults(null)
                          setSearchSource(null)
                        }}
                        className="flex-1 py-2 bg-[#282828] text-white rounded-lg text-sm"
                      >
                        返回修改
                      </button>
                      <button
                        onClick={() => setShowConfirmModal(false)}
                        className="flex-1 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm font-medium"
                      >
                        確定提交
                      </button>
                    </div>
                  </div>
                )}

                {searchResults && !showConfirmModal && (
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
                  {editingRequest?.id === request.id ? (
                    // 編輯模式
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editFormData.songTitle}
                        onChange={(e) => setEditFormData({...editFormData, songTitle: e.target.value})}
                        className="w-full bg-[#1a1a1a] border border-[#FFD700]/50 rounded px-2 py-1 text-white text-sm"
                        placeholder="歌名"
                      />
                      <input
                        type="text"
                        value={editFormData.artistName}
                        onChange={(e) => setEditFormData({...editFormData, artistName: e.target.value})}
                        className="w-full bg-[#1a1a1a] border border-[#FFD700]/50 rounded px-2 py-1 text-gray-300 text-sm"
                        placeholder="歌手"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={saveEdit}
                          className="px-2 py-1 bg-[#FFD700] text-black rounded text-xs font-medium"
                        >
                          保存
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-2 py-1 bg-[#282828] text-gray-400 rounded text-xs"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    // 顯示模式
                    <>
                      <div className="flex items-center gap-2">
                        <div className={`font-medium truncate ${request.status === 'fulfilled' ? 'text-green-400' : 'text-white'}`}>
                          {request.songTitle}
                        </div>
                        {request.status === 'fulfilled' && (
                          <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded flex-shrink-0">
                            已完成
                          </span>
                        )}
                      </div>
                      <div className="text-gray-500 text-sm truncate">{request.artistName}</div>
                      <div className="text-[#FFD700] text-xs mt-1">
                        {request.status === 'fulfilled' ? (
                          <span className="text-green-400">
                            ✓ 已由 {request.fulfilledByName || '結他友'} 出譜
                          </span>
                        ) : (
                          <span>{request.voteCount}人求譜</span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* 操作按鈕 */}
                <div className="flex items-center gap-2">
                  {/* Admin 編輯按鈕 */}
                  {isAdmin && editingRequest?.id !== request.id && (
                    <button
                      onClick={() => startEdit(request)}
                      className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center hover:bg-blue-500/30 transition"
                      title="編輯"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}

                  {/* Admin 刪除按鈕 */}
                  {isAdmin && (
                    <button
                      onClick={() => deleteRequest(request.id)}
                      className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30 transition"
                      title="刪除"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}

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
                    href={`/tabs/new?title=${encodeURIComponent(request.songTitle)}&artist=${encodeURIComponent(request.artistName)}${request.youtubeUrl ? `&youtube=${encodeURIComponent(request.youtubeUrl)}` : ''}`}
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

        {/* 現有樂譜提示對話框 */}
        {showExistingTabModal && existingTab && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-[#121212] rounded-2xl w-full max-w-md overflow-hidden">
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">已存在相同樂譜</h2>
                <button onClick={() => setShowExistingTabModal(false)} className="text-gray-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-green-400 font-medium text-sm">找到相同樂譜！</p>
                      <p className="text-gray-400 text-xs mt-1">
                        資料庫中已有「{existingTab.title} - {existingTab.artist}」的樂譜。
                      </p>
                    </div>
                  </div>
                </div>

                {/* 現有樂譜預覽 */}
                <div className="bg-[#1a1a1a] rounded-xl p-4 flex items-center gap-4">
                  <div className="w-16 h-16 bg-[#282828] rounded-lg overflow-hidden flex-shrink-0">
                    {existingTab.thumbnail || existingTab.albumImage ? (
                      <img 
                        src={existingTab.thumbnail || existingTab.albumImage} 
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
                    <div className="text-white font-medium truncate">{existingTab.title}</div>
                    <div className="text-gray-500 text-sm truncate">{existingTab.artist}</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Link
                    href={`/tabs/${existingTab.id}`}
                    onClick={() => setShowExistingTabModal(false)}
                    className="flex-1 py-3 bg-[#FFD700] text-black rounded-xl font-bold text-center"
                  >
                    查看樂譜
                  </Link>
                </div>

                <div className="border-t border-gray-800 pt-4">
                  <p className="text-gray-500 text-sm mb-3">
                    這份樂譜不符合你的需求？你仍然可以提交求譜：
                  </p>
                  <button
                    onClick={() => {
                      setShowExistingTabModal(false)
                      submitRequest()
                    }}
                    className="w-full py-2 bg-[#282828] text-gray-400 hover:text-white rounded-lg text-sm"
                  >
                    仍然要求譜（例如：需要不同版本）
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

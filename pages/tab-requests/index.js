import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import {
  collection, query, orderBy, getDocs, addDoc, updateDoc, doc,
  arrayUnion, arrayRemove, serverTimestamp, where, deleteDoc
} from 'firebase/firestore'
import { getTab } from '@/lib/tabs'
import { getSongThumbnail } from '@/lib/getSongThumbnail'
import { getGroupKeys, normalizeTitleForGrouping } from '@/lib/tabGrouping'
import Image from 'next/image'

// 卡片縮圖：來自 request.albumImage。建立求譜時由 Spotify/YouTube 搜尋結果寫入；出譜（fulfill）時會用樂譜 getSongThumbnail(tab) 寫入，無額外 fetch。
// 求譜列表排序：fulfilled 最底；其餘 自己嘅求譜（新至舊）最頂 → 我投過 → voteCount、createdAt
function compareTabRequests(a, b, uid) {
  const aDone = a.status === 'fulfilled'
  const bDone = b.status === 'fulfilled'
  if (aDone && !bDone) return 1
  if (!aDone && bDone) return -1
  if (aDone && bDone) {
    const tA = a.fulfilledAt?.getTime?.() ?? a.fulfilledAt ?? 0
    const tB = b.fulfilledAt?.getTime?.() ?? b.fulfilledAt ?? 0
    return tB - tA
  }
  const aOwn = uid && a.requestedBy === uid
  const bOwn = uid && b.requestedBy === uid
  if (aOwn && !bOwn) return -1
  if (bOwn && !aOwn) return 1
  if (aOwn && bOwn) {
    const tA = a.createdAt?.getTime?.() ?? a.createdAt ?? 0
    const tB = b.createdAt?.getTime?.() ?? b.createdAt ?? 0
    return tB - tA
  }
  const aMine = uid && a.voters?.includes(uid)
  const bMine = uid && b.voters?.includes(uid)
  if (aMine && !bMine) return -1
  if (bMine && !aMine) return 1
  if ((b.voteCount || 0) !== (a.voteCount || 0)) return (b.voteCount || 0) - (a.voteCount || 0)
  const tA = a.createdAt?.getTime?.() ?? a.createdAt ?? 0
  const tB = b.createdAt?.getTime?.() ?? b.createdAt ?? 0
  return tA - tB
}

export default function TabRequestsPage() {
  const router = useRouter()
  const { user, isAdmin, signInWithGoogle } = useAuth()
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
  
  // 未登入按「我要求譜」時顯示登入提示
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const [loginPromptLoading, setLoginPromptLoading] = useState(false)
  // 刪除確認（用自訂 Modal 取代 confirm()，手機版較穩定）
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  // 出譜彈窗：請貼上結他譜連結（與刪除確認同 style）
  const [pasteLinkModalRequest, setPasteLinkModalRequest] = useState(null)
  const [pastedLink, setPastedLink] = useState('')
  const pasteLinkInputRef = useRef(null)
  const pasteCheckDebounceRef = useRef(null)
  const [pasteMessage, setPasteMessage] = useState('') // 貼上失敗時提示
  // 剛撳「我要求譜」：樂觀更新 state 即時顯示 tick；pendingVoteId(ref+state) 令卡片 1s 內留喺「其他」再移
  const [justVotedId, setJustVotedId] = useState(null)
  const justVotedTimerRef = useRef(null)
  const [pendingVoteId, setPendingVoteId] = useState(null)
  const pendingVoteIdRef = useRef(null)
  // 取消求譜：先顯示「已取消求譜」+ transition；然後按鈕變回「我要求譜」，再延遲後卡片先移動
  const [justCancelledId, setJustCancelledId] = useState(null)
  const justCancelledTimerRef = useRef(null)
  const [displayAsUnvotedId, setDisplayAsUnvotedId] = useState(null)
  const displayAsUnvotedTimerRef = useRef(null)
  const scrollPositionRef = useRef(0)
  const modalOpen = showForm || showLoginPrompt || deleteConfirmId || pasteLinkModalRequest

  // 載入求譜列表
  useEffect(() => {
    loadRequests()
  }, [])

  // 彈出視窗打開時鎖住背景 scroll（只改 overflow，唔用 body position:fixed，避免手機 touch 坐標偏移）
  useEffect(() => {
    if (modalOpen) {
      scrollPositionRef.current = typeof window !== 'undefined' ? window.scrollY : 0
      document.body.setAttribute('data-modal-open', 'true')
      document.body.style.overflow = 'hidden'
      if (typeof document.documentElement !== 'undefined') {
        document.documentElement.style.overflow = 'hidden'
      }
    } else {
      document.body.removeAttribute('data-modal-open')
      document.body.style.overflow = ''
      if (typeof document.documentElement !== 'undefined') {
        document.documentElement.style.overflow = ''
      }
      if (typeof window !== 'undefined') {
        window.scrollTo(0, scrollPositionRef.current)
      }
    }
    return () => {
      document.body.removeAttribute('data-modal-open')
      document.body.style.overflow = ''
      if (typeof document.documentElement !== 'undefined') {
        document.documentElement.style.overflow = ''
      }
      if (typeof window !== 'undefined') {
        window.scrollTo(0, scrollPositionRef.current)
      }
    }
  }, [modalOpen])

  useEffect(() => {
    return () => {
      if (justVotedTimerRef.current) clearTimeout(justVotedTimerRef.current)
      if (justCancelledTimerRef.current) clearTimeout(justCancelledTimerRef.current)
      if (displayAsUnvotedTimerRef.current) clearTimeout(displayAsUnvotedTimerRef.current)
    }
  }, [])

  // 輸入連結後自動檢查（debounce 800ms）
  useEffect(() => {
    if (!pasteLinkModalRequest || !pastedLink.trim()) return
    if (pasteCheckDebounceRef.current) clearTimeout(pasteCheckDebounceRef.current)
    if (!parsePolygonTabLink(pastedLink)) return
    pasteCheckDebounceRef.current = setTimeout(() => {
      pasteCheckDebounceRef.current = null
      checkPasteLinkAndConfirm()
    }, 800)
    return () => {
      if (pasteCheckDebounceRef.current) clearTimeout(pasteCheckDebounceRef.current)
    }
  }, [pastedLink, pasteLinkModalRequest])

  // 關閉「提交求譜」視窗時清空歌曲選單、搜尋狀態與輸入欄，下次打開係全新
  useEffect(() => {
    if (!showForm) {
      setFormData({ songTitle: '', artistName: '' })
      setSearchResults(null)
      setMultipleResults([])
      setSearchSource(null)
      setShowConfirmModal(false)
    }
  }, [showForm])

  const loadRequests = async () => {
    try {
      const res = await fetch('/api/tab-requests')
      if (!res.ok) throw new Error('Failed to load requests')
      const { tabRequests: raw } = await res.json()
      const list = Array.isArray(raw) ? raw : []
      const data = list.map((r) => ({
        ...r,
        createdAt: r.createdAt != null ? new Date(r.createdAt) : new Date(),
      }))
      data.sort((a, b) => compareTabRequests(a, b, user?.uid))
      setRequests(data)
      // If API returned empty (e.g. cache not built, Admin not configured), load from Firestore
      if (data.length === 0) {
        const q = query(
          collection(db, 'tabRequests'),
          orderBy('voteCount', 'desc')
        )
        const snapshot = await getDocs(q)
        const fallback = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate?.() || new Date(),
        }))
        fallback.sort((a, b) => compareTabRequests(a, b, user?.uid))
        if (fallback.length > 0) setRequests(fallback)
      }
    } catch (error) {
      console.error('Error loading requests:', error)
    } finally {
      setLoading(false)
    }
  }

  // Keep server cache in sync after writes (fire-and-forget)
  const refreshCache = (payload) => {
    fetch('/api/tab-requests/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  }

  // 只以 YouTube 搜尋
  const searchYouTube = async () => {
    if (!formData.songTitle) return
    setSearching(true)
    setSearchSource(null)
    setMultipleResults([])
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
  // 提交求譜
  const handleSubmit = async () => {
    if (!user) {
      alert('請先登入')
      return
    }
    if (!searchResults) return

    setSubmitting(true)
    try {
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
        const hasVoted = requestData.voters?.includes(user.uid)
        const newVoteCount = hasVoted ? (requestData.voteCount || 1) - 1 : (requestData.voteCount || 0) + 1
        const newVoters = hasVoted
          ? (requestData.voters || []).filter((id) => id !== user.uid)
          : [...(requestData.voters || []), user.uid]

        const requestRef = doc(db, 'tabRequests', requestId)
        if (hasVoted) {
          await updateDoc(requestRef, {
            voteCount: newVoteCount,
            voters: arrayRemove(user.uid)
          })
        } else {
          await updateDoc(requestRef, {
            voteCount: newVoteCount,
            voters: arrayUnion(user.uid)
          })
        }
        setRequests((prev) => {
          const next = prev.map((r) =>
            r.id === requestId ? { ...r, voteCount: newVoteCount, voters: newVoters } : r
          )
          next.sort(compareRequests)
          return next
        })
        refreshCache({ action: 'vote', id: requestId, voteCount: newVoteCount, voters: newVoters })
      } else {
        // 創建新求譜
        const payload = {
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
        }
        const ref = await addDoc(collection(db, 'tabRequests'), payload)
        // Optimistic update: cache won't have new doc yet, so add to local state
        const newRequest = {
          id: ref.id,
          songTitle: searchResults.title,
          artistName: searchResults.artist,
          albumImage: searchResults.albumImage || null,
          albumName: searchResults.albumName || null,
          youtubeUrl: searchResults.youtubeUrl || null,
          searchSource: searchSource || null,
          requestedBy: user.uid,
          requesterName: user.displayName || '匿名用戶',
          requesterPhoto: user.photoURL || null,
          createdAt: new Date(),
          voteCount: 1,
          voters: [user.uid],
          status: 'pending',
          fulfilledBy: null,
          fulfilledByName: null,
          fulfilledAt: null,
          tabId: null,
        }
        setRequests((prev) => {
          const next = [newRequest, ...prev]
          next.sort(compareRequests)
          return next
        })
        refreshCache({
          action: 'add',
          doc: {
            id: ref.id,
            songTitle: searchResults.title,
            artistName: searchResults.artist,
            albumImage: searchResults.albumImage || null,
            albumName: searchResults.albumName || null,
            youtubeUrl: searchResults.youtubeUrl || null,
            searchSource: searchSource || null,
            requestedBy: user.uid,
            requesterName: user.displayName || '匿名用戶',
            requesterPhoto: user.photoURL || null,
            voteCount: 1,
            voters: [user.uid],
            status: 'pending',
            fulfilledBy: null,
            fulfilledByName: null,
            fulfilledAt: null,
            tabId: null,
            createdAt: Date.now(),
          },
        })
      }
      
      // 重置表單
      setFormData({ songTitle: '', artistName: '' })
      setSearchResults(null)
      setSearchSource(null)
      setShowConfirmModal(false)
      setShowForm(false)
    } catch (error) {
      console.error('Error submitting request:', error)
      alert('提交失敗，請重試')
    } finally {
      setSubmitting(false)
    }
  }

  // 投票（舉手）／取消求譜
  const voteForRequest = async (requestId) => {
    if (!user) {
      setShowLoginPrompt(true)
      return
    }
    if (justCancelledId === requestId || displayAsUnvotedId === requestId || justVotedId === requestId || pendingVoteId === requestId) return

    const request = requests.find(r => r.id === requestId)
    const hasUserVoted = request?.voters?.includes(user.uid)

    // 取消求譜：先顯示「已取消求譜」→ 按鈕變回「我要求譜」→ 再延遲後卡片移動
    if (hasUserVoted) {
      if (justCancelledTimerRef.current) clearTimeout(justCancelledTimerRef.current)
      if (displayAsUnvotedTimerRef.current) clearTimeout(displayAsUnvotedTimerRef.current)
      setJustCancelledId(requestId)
      justCancelledTimerRef.current = setTimeout(async () => {
        justCancelledTimerRef.current = null
        setJustCancelledId(null)
        try {
          const requestRef = doc(db, 'tabRequests', requestId)
          await updateDoc(requestRef, {
            voteCount: (request.voteCount || 1) - 1,
            voters: arrayRemove(user.uid)
          })
          const newVoters = (request.voters || []).filter((id) => id !== user.uid)
          const newCount = (request.voteCount || 1) - 1
          setDisplayAsUnvotedId(requestId)
          displayAsUnvotedTimerRef.current = setTimeout(() => {
            displayAsUnvotedTimerRef.current = null
            setDisplayAsUnvotedId(null)
            setRequests((prev) => {
              const next = prev.map((r) =>
                r.id === requestId ? { ...r, voteCount: newCount, voters: newVoters } : r
              )
              next.sort(compareRequests)
              return next
            })
            refreshCache({ action: 'vote', id: requestId, voteCount: newCount, voters: newVoters })
          }, 1000)
        } catch (error) {
          console.error('Error cancelling vote:', error)
          setDisplayAsUnvotedId(null)
          loadRequests()
        }
      }, 1500)
      return
    }

    // 我要求譜：先同步設 ref 再更新 state，分組時讀 ref 令卡留喺「其他」；1s 後清 ref+state 卡先移
    try {
      if (justVotedTimerRef.current) clearTimeout(justVotedTimerRef.current)
      const newCount = (request.voteCount || 0) + 1
      const newVoters = [...(request.voters || []), user.uid]
      pendingVoteIdRef.current = requestId
      setPendingVoteId(requestId)
      setJustVotedId(requestId)
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, voteCount: newCount, voters: newVoters } : r))
      )
      justVotedTimerRef.current = setTimeout(async () => {
        justVotedTimerRef.current = null
        pendingVoteIdRef.current = null
        setJustVotedId(null)
        setPendingVoteId(null)
        try {
          const requestRef = doc(db, 'tabRequests', requestId)
          await updateDoc(requestRef, {
            voteCount: newCount,
            voters: arrayUnion(user.uid)
          })
          refreshCache({ action: 'vote', id: requestId, voteCount: newCount, voters: newVoters })
        } catch (err) {
          console.error('Error voting:', err)
          loadRequests()
        }
      }, 1000)
    } catch (error) {
      console.error('Error voting:', error)
      loadRequests()
    }
  }

  // 檢查是否已投票
  const hasVoted = (request) => {
    return request.voters?.includes(user?.uid)
  }

  const compareRequests = (a, b) => compareTabRequests(a, b, user?.uid)

  // 分組：「你的求譜」= 你發起或你投過；pendingVoteId 嘅卡 1s 內仍當「其他」唔移（用 ref 確保同步）
  const { myRequests, otherRequests } = useMemo(() => {
    const uid = user?.uid
    const pending = pendingVoteIdRef.current ?? pendingVoteId
    const isMine = (r) => r.id !== pending && uid && (r.requestedBy === uid || r.voters?.includes(uid))
    const mine = requests.filter(isMine)
    const other = requests.filter((r) => !isMine(r))
    const sortMine = [...mine].sort((a, b) => {
      const aDone = a.status === 'fulfilled'
      const bDone = b.status === 'fulfilled'
      if (aDone && !bDone) return 1
      if (!aDone && bDone) return -1
      if (aDone && bDone) {
        const tA = a.fulfilledAt?.getTime?.() ?? a.fulfilledAt ?? 0
        const tB = b.fulfilledAt?.getTime?.() ?? b.fulfilledAt ?? 0
        return tB - tA
      }
      const aOwn = uid && a.requestedBy === uid
      const bOwn = uid && b.requestedBy === uid
      if (aOwn && !bOwn) return -1
      if (!aOwn && bOwn) return 1
      const tA = a.createdAt?.getTime?.() ?? a.createdAt ?? 0
      const tB = b.createdAt?.getTime?.() ?? b.createdAt ?? 0
      return tB - tA
    })
    const sortOther = [...other].sort((a, b) => compareTabRequests(a, b, uid))
    return { myRequests: sortMine, otherRequests: sortOther }
  }, [requests, user?.uid, pendingVoteId])

  const renderRequestCard = (request) => (
    <div
      key={request.id}
      role={request.status === 'fulfilled' && request.tabId ? 'link' : undefined}
      tabIndex={request.status === 'fulfilled' && request.tabId ? 0 : undefined}
      onClick={request.status === 'fulfilled' && request.tabId ? () => router.push(`/tabs/${request.tabId}`) : undefined}
      onKeyDown={request.status === 'fulfilled' && request.tabId ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/tabs/${request.tabId}`); } } : undefined}
      className={`rounded-xl p-3 flex items-center gap-3 relative ${request.status === 'fulfilled' ? 'bg-[#0f2418] opacity-75' : 'bg-[#121212]'} ${request.status === 'fulfilled' && request.tabId ? 'cursor-pointer' : ''}`}
    >
      {(isAdmin || (user?.uid && request.requestedBy === user.uid && (request.voteCount || 0) <= 1)) && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteConfirmId(request.id); }}
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shadow-md border-2 border-[#121212] transition touch-manipulation"
          title="刪除"
          aria-label="刪除此求譜"
        >
          <span className="block w-2.5 h-0.5 bg-current rounded-full" aria-hidden />
        </button>
      )}
      <div className="w-12 h-12 bg-[#1a1a1a] rounded-lg overflow-hidden flex-shrink-0">
        {request.albumImage ? (
          <img src={request.albumImage} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 shrink">
        {editingRequest?.id === request.id ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editFormData.songTitle}
              onChange={(e) => setEditFormData({ ...editFormData, songTitle: e.target.value })}
              className="w-full bg-[#1a1a1a] border border-[#FFD700]/50 rounded px-2 py-1 text-white text-sm"
              placeholder="歌名"
            />
            <input
              type="text"
              value={editFormData.artistName}
              onChange={(e) => setEditFormData({ ...editFormData, artistName: e.target.value })}
              className="w-full bg-[#1a1a1a] border border-[#FFD700]/50 rounded px-2 py-1 text-gray-300 text-sm"
              placeholder="歌手"
            />
            <div className="flex gap-2">
              <button onClick={saveEdit} className="px-2 py-1 bg-[#FFD700] text-black rounded text-xs font-medium">保存</button>
              <button onClick={cancelEdit} className="px-2 py-1 bg-[#282828] text-gray-400 rounded text-xs">取消</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="font-medium truncate text-white">
                {request.songTitle}
              </div>
            </div>
            <div className="text-gray-500 text-sm truncate">{request.artistName}</div>
            <div className="text-[#FFD700] text-xs mt-0.5 flex items-center gap-2 min-w-0">
              {request.status === 'fulfilled' ? (
                <span className="text-green-400 truncate min-w-0">{request.voteCount ?? 0} 人求譜成功</span>
              ) : (
                <span>{request.voteCount} 人求譜</span>
              )}
            </div>
          </>
        )}
      </div>
      <div className={`flex items-center gap-2 min-w-0 ${request.status === 'fulfilled' ? '' : 'flex-shrink-0'}`} style={request.status === 'fulfilled' ? { flexShrink: 2 } : undefined}>
        {request.status === 'fulfilled' ? (
          <div className="flex flex-col items-end text-right min-w-0 w-full">
            <span className="text-white text-xs truncate w-full text-right">感謝 {request.fulfilledByName || '結他友'} 出譜</span>
          </div>
        ) : (
          <>
            <button
              onClick={() => voteForRequest(request.id)}
          className={`rounded-full flex items-center justify-center gap-1.5 h-9 transition-all duration-300 ease-out ${
            justCancelledId === request.id
              ? 'bg-[#282828] text-gray-400 cursor-default px-3 py-2 min-w-[2.5rem] w-28'
              : displayAsUnvotedId === request.id
                ? 'w-9 bg-[#FFD700] text-black cursor-default'
                : hasVoted(request)
                  ? 'h-9 px-3 py-1.5 rounded-full bg-[#282828] text-[#FFD700] cursor-default text-sm font-medium'
                  : 'w-9 bg-[#FFD700] text-black hover:opacity-90 rounded-full'
          }`}
          title={justCancelledId === request.id ? '已取消求譜' : displayAsUnvotedId === request.id ? '我要求譜' : hasVoted(request) ? '取消求譜' : '我要求譜'}
        >
          {justCancelledId === request.id ? (
            <span className="text-gray-400 text-sm whitespace-nowrap">已取消求譜</span>
          ) : displayAsUnvotedId === request.id ? (
            <svg className="w-[1.375rem] h-[1.375rem] flex-shrink-0 -translate-y-[0.6px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={62} viewBox="0 0 634.7 905.9">
              <path d="M35.4,454v119.1c0,174.8,109.6,295.3,282,295.3" />
              <path d="M599.4,454v119.1c0,174.8-109.6,295.3-282,295.3" />
              <path d="M261,394.5v-245.7c0-31.2-25.3-56.4-56.4-56.4s-56.4,25.3-56.4,56.4v269.2" />
              <path d="M373.8,315.1V94c0-31.2-25.3-56.4-56.4-56.4s-56.4,25.3-56.4,56.4v221.1" />
              <path d="M486.6,343.3V122.2c0-31.2-25.3-56.4-56.4-56.4s-56.4,25.3-56.4,56.4v267.1" />
              <path d="M148.2,399.7h0c0-31.2-25.3-56.4-56.4-56.4s-56.4,25.3-56.4,56.4h0v140.8" />
              <path d="M263.7,681.3" />
              <path d="M599.4,540.5V238.4c0-31.2-25.3-56.4-56.4-56.4s-56.4,25.3-56.4,56.4v179.6" />
              <path d="M263.7,681.3c0-45.7,5-155.3-115.6-155.3v-126.2" />
            </svg>
          ) : hasVoted(request) ? (
            <span className="text-[#FFD700] text-sm font-medium whitespace-nowrap">已求譜</span>
          ) : (
            <svg className="w-[1.375rem] h-[1.375rem] flex-shrink-0 -translate-y-[0.6px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={62} viewBox="0 0 634.7 905.9">
              <path d="M35.4,454v119.1c0,174.8,109.6,295.3,282,295.3" />
              <path d="M599.4,454v119.1c0,174.8-109.6,295.3-282,295.3" />
              <path d="M261,394.5v-245.7c0-31.2-25.3-56.4-56.4-56.4s-56.4,25.3-56.4,56.4v269.2" />
              <path d="M373.8,315.1V94c0-31.2-25.3-56.4-56.4-56.4s-56.4,25.3-56.4,56.4v221.1" />
              <path d="M486.6,343.3V122.2c0-31.2-25.3-56.4-56.4-56.4s-56.4,25.3-56.4,56.4v267.1" />
              <path d="M148.2,399.7h0c0-31.2-25.3-56.4-56.4-56.4s-56.4,25.3-56.4,56.4h0v140.8" />
              <path d="M263.7,681.3" />
              <path d="M599.4,540.5V238.4c0-31.2-25.3-56.4-56.4-56.4s-56.4,25.3-56.4,56.4v179.6" />
              <path d="M263.7,681.3c0-45.7,5-155.3-115.6-155.3v-126.2" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => openPasteLinkModal(request)}
          className={`h-9 px-3 py-1.5 rounded-full flex items-center justify-center transition text-sm font-medium ${
            hasVoted(request)
              ? 'bg-[#1a1a1a] text-gray-500 cursor-default opacity-70'
              : 'bg-[#282828] text-[#FFD700] hover:bg-[#FFD700] hover:text-black'
          }`}
              title="出譜"
            >
              出譜
            </button>
          </>
        )}
      </div>
    </div>
  )

  // 刪除求譜：Admin 可刪任何；發起者只能刪「冇其他人投票」嘅（voteCount <= 1）
  const executeDeleteRequest = async (requestId) => {
    if (!requestId) return
    const req = requests.find((r) => r.id === requestId)
    const canDelete = isAdmin || (user?.uid && req?.requestedBy === user.uid && (req?.voteCount || 0) <= 1)
    if (!canDelete) {
      setDeleteConfirmId(null)
      if (req?.voteCount > 1) alert('已有其他人求譜，無法刪除')
      return
    }
    try {
      await deleteDoc(doc(db, 'tabRequests', requestId))
      setRequests((prev) => prev.filter((r) => r.id !== requestId))
      refreshCache({ action: 'delete', id: requestId })
      setDeleteConfirmId(null)
    } catch (error) {
      console.error('Error deleting request:', error)
      alert('刪除失敗，請重試')
    }
  }

  // 出譜彈窗：打開時不預填
  const openPasteLinkModal = (request) => {
    setPasteLinkModalRequest(request)
    setPastedLink('')
    setPasteMessage('')
  }

  const handlePasteLink = (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setPasteMessage('讀取中…')
    const run = async () => {
      try {
        const clip = typeof navigator !== 'undefined' && navigator.clipboard
        if (!clip) throw new Error('no clipboard')
        let text = ''
        if (clip.readText) {
          text = await clip.readText()
        } else if (clip.read) {
          const items = await clip.read()
          const item = items.find((i) => i.types?.includes('text/plain')) || items[0]
          if (item) text = await item.getType('text/plain').then((b) => b.text())
        }
        text = (text || '').trim()
        if (text) {
          setPastedLink(text)
          setPasteMessage('已貼上')
          setTimeout(() => setPasteMessage(''), 1500)
          setTimeout(() => checkPasteLinkAndConfirm(text), 350)
        } else {
          setPasteMessage('剪貼簿無文字，請先複製連結')
          setTimeout(() => setPasteMessage(''), 2500)
        }
        return
      } catch (err) {
        console.error('Read clipboard failed:', err)
      }
      pasteLinkInputRef.current?.focus()
      setPasteMessage('無法讀取剪貼簿，請自行在輸入欄內貼上')
      setTimeout(() => setPasteMessage(''), 3000)
    }
    run()
  }

  // 驗證是否為 POLYGON 結他譜連結，並取出 tab ID（支援 polygon.guitars 或本機）
  const parsePolygonTabLink = (url) => {
    const s = (url || '').trim()
    if (!s) return null
    try {
      const u = new URL(s)
      const pathMatch = u.pathname.match(/^\/tabs\/([a-zA-Z0-9_-]+)$/)
      if (!pathMatch) return null
      const host = u.hostname.toLowerCase()
      if (host === 'polygon.guitars' || host.endsWith('.polygon.guitars') || host === 'localhost' || host.startsWith('192.168.') || host.startsWith('127.0.0.1')) {
        return pathMatch[1]
      }
      return null
    } catch {
      return null
    }
  }

  // 檢查連結：用歌手頁合併歌邏輯核對（與 artist 頁一致，唔使 100% 字串吻合）
  const checkPasteLinkAndConfirm = async (linkOverride) => {
    if (!pasteLinkModalRequest) return
    const linkToCheck = linkOverride !== undefined ? linkOverride : pastedLink
    const tabId = parsePolygonTabLink(linkToCheck)
    if (!tabId) {
      setPasteMessage('請貼上 POLYGON 結他譜連結，例如 https://polygon.guitars/tabs/...')
      setTimeout(() => setPasteMessage(''), 3000)
      return
    }
    setPasteMessage('檢查中…')
    try {
      const tab = await getTab(tabId)
      if (!tab) {
        setPasteMessage('出譜失敗，找不到該結他譜')
        setTimeout(() => setPasteMessage(''), 3000)
        return
      }
      const cardTitle = (pasteLinkModalRequest.songTitle || '').trim()
      const tabTitleRaw = (tab.title || '').trim()
      const cardKey = normalizeTitleForGrouping(cardTitle) || cardTitle
      const tabKeys = getGroupKeys(tabTitleRaw, tab.id)
      const matchByGrouping = cardKey && tabKeys.includes(cardKey)
      const matchByNoSpace = (cardTitle.replace(/\s+/g, '') === tabTitleRaw.replace(/\s+/g, ''))
      const titleMatch = matchByGrouping || matchByNoSpace
      if (titleMatch) {
        const requestId = pasteLinkModalRequest.id
        // 顯示該樂譜嘅出譜者（編譜者），唔係貼連結嘅用戶
        const fulfilledByName = (tab.uploaderPenName || tab.arrangedBy || '').trim() || '結他友'
        const albumImage = getSongThumbnail(tab) || null
        try {
          await updateDoc(doc(db, 'tabRequests', requestId), {
            status: 'fulfilled',
            fulfilledBy: user?.uid || null,
            fulfilledByName,
            fulfilledAt: serverTimestamp(),
            tabId,
            ...(albumImage && { albumImage })
          })
          setRequests((prev) =>
            prev.map((r) =>
              r.id === requestId
                ? { ...r, status: 'fulfilled', fulfilledBy: user?.uid ?? null, fulfilledByName, fulfilledAt: new Date(), tabId, ...(albumImage && { albumImage }) }
                : r
            )
          )
          refreshCache({
            action: 'fulfill',
            id: requestId,
            status: 'fulfilled',
            fulfilledBy: user?.uid ?? null,
            fulfilledByName,
            fulfilledAt: Date.now(),
            tabId,
            ...(albumImage && { albumImage })
          })
        } catch (err) {
          console.error('Error marking request fulfilled:', err)
          setPasteMessage('出譜失敗，無法驗證連結')
          setTimeout(() => setPasteMessage(''), 3000)
          return
        }
        setPasteMessage('成功，感謝幫手出譜')
        setTimeout(() => {
          setPasteLinkModalRequest(null)
          setPastedLink('')
          setPasteMessage('')
        }, 1500)
      } else {
        setPasteMessage('出譜失敗，歌名與求譜不一致')
        setTimeout(() => setPasteMessage(''), 3000)
      }
    } catch (err) {
      console.error('Check tab link failed:', err)
      setPasteMessage('出譜失敗，無法驗證連結')
      setTimeout(() => setPasteMessage(''), 3000)
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
      setRequests(requests.map(r =>
        r.id === editingRequest.id
          ? { ...r, songTitle: editFormData.songTitle, artistName: editFormData.artistName }
          : r
      ))
      refreshCache({ action: 'edit', id: editingRequest.id, songTitle: editFormData.songTitle, artistName: editFormData.artistName })
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
      <div className={`px-4 ${modalOpen ? 'pointer-events-none' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">POLYGON求譜區</h1>
            <p className="text-gray-500 text-sm mt-1">搵人求譜．幫人出譜</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-[#FFD700] text-black rounded-full font-medium flex items-center gap-0.5"
          >
            <svg className="w-[1.375rem] h-[1.375rem] flex-shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={62} viewBox="0 0 634.7 905.9">
              <path d="M35.4,454v119.1c0,174.8,109.6,295.3,282,295.3" />
              <path d="M599.4,454v119.1c0,174.8-109.6,295.3-282,295.3" />
              <path d="M261,394.5v-245.7c0-31.2-25.3-56.4-56.4-56.4s-56.4,25.3-56.4,56.4v269.2" />
              <path d="M373.8,315.1V94c0-31.2-25.3-56.4-56.4-56.4s-56.4,25.3-56.4,56.4v221.1" />
              <path d="M486.6,343.3V122.2c0-31.2-25.3-56.4-56.4-56.4s-56.4,25.3-56.4,56.4v267.1" />
              <path d="M148.2,399.7h0c0-31.2-25.3-56.4-56.4-56.4s-56.4,25.3-56.4,56.4h0v140.8" />
              <path d="M263.7,681.3" />
              <path d="M599.4,540.5V238.4c0-31.2-25.3-56.4-56.4-56.4s-56.4,25.3-56.4,56.4v179.6" />
              <path d="M263.7,681.3c0-45.7,5-155.3-115.6-155.3v-126.2" />
            </svg>
            求譜
          </button>
        </div>

        {/* 求譜表單 Modal */}
        {showForm && (
          <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4 pointer-events-auto">
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
                    className="w-full bg-[#282828] border-0 rounded-full px-4 py-3 text-white placeholder-[#666] outline-none"
                    placeholder="輸入歌名"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-400 text-sm mb-2">歌手（選填）</label>
                  <input
                    type="text"
                    value={formData.artistName}
                    onChange={(e) => setFormData({...formData, artistName: e.target.value})}
                    className="w-full bg-[#282828] border-0 rounded-full px-4 py-3 text-white placeholder-[#666] outline-none"
                    placeholder="輸入歌手名"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={searchSong}
                    disabled={!formData.songTitle || searching}
                    className="flex-1 py-3 px-4 bg-[#1DB954] text-white rounded-full font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                    </svg>
                    <span>{searching ? '搜尋中...' : '搜尋(推薦)'}</span>
                  </button>
                  <button
                    onClick={searchYouTube}
                    disabled={!formData.songTitle || searching}
                    className="flex-1 py-3 px-4 bg-[#FF0000] text-white rounded-full font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                    <span>{searching ? '搜尋中...' : '搜尋'}</span>
                  </button>
                </div>

                {/* 多結果選擇 - 當找到多首歌曲時（touch-manipulation + overflow 修復手機 touch 偏移） */}
                {multipleResults.length > 0 && searchSource === 'multiple' && (
                  <div className="bg-[#1a1a1a] rounded-xl p-4">
                    <div className="space-y-2 max-h-64 overflow-y-auto overflow-x-hidden overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                      {multipleResults.map((track, idx) => (
                        <button
                          key={track.id}
                          type="button"
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
                          className="w-full flex items-center gap-2 py-3 px-2.5 bg-[#282828] hover:bg-[#333] rounded-lg transition text-left touch-manipulation min-h-[3.5rem]"
                        >
                          <div className="w-10 h-10 bg-[#1a1a1a] rounded overflow-hidden flex-shrink-0">
                            {track.albumImage ? (
                              <img src={track.albumImage} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600">🎵</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium text-sm truncate">{track.name}</div>
                            <div className="text-gray-500 text-xs truncate">{track.artists.map(a => a.name).join(', ')}</div>
                            <div className="text-gray-600 text-xs truncate">{track.album} {track.releaseYear && `(${track.releaseYear})`}</div>
                          </div>
                        </button>
                      ))}
                    </div>
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

        {/* 未登入按「我要求譜」提示 — 登入 Modal */}
        {showLoginPrompt && (
          <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4 pointer-events-auto">
            <div className="bg-[#121212] rounded-2xl w-full max-w-sm overflow-hidden border border-gray-800">
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">請先登入</h2>
                <button onClick={() => setShowLoginPrompt(false)} className="text-gray-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-4">
                <button
                  onClick={async () => {
                    setLoginPromptLoading(true)
                    try {
                      await signInWithGoogle()
                      setShowLoginPrompt(false)
                    } catch (e) {
                      console.error(e)
                      if (e.code === 'auth/unauthorized-domain') {
                        alert(`Firebase 未授權此域名，請聯繫管理員添加：${window.location.hostname}`)
                      } else {
                        alert('Google 登入失敗：' + (e.message || e))
                      }
                    } finally {
                      setLoginPromptLoading(false)
                    }
                  }}
                  disabled={loginPromptLoading}
                  className="w-full flex items-center justify-center gap-3 bg-[#121212] border-2 border-gray-800 text-white py-3 px-4 rounded-lg font-medium hover:border-[#FFD700] transition disabled:opacity-50"
                >
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>{loginPromptLoading ? '登入中...' : '使用 Google 登入'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 刪除確認 Modal（取代 confirm()，手機版可正常彈出；pointer-events-auto 避免被外層 pointer-events-none 擋住） */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 pointer-events-auto">
            <div className="bg-[#121212] rounded-3xl p-6 w-full max-w-sm shadow-xl border border-[#282828]">
              <p className="text-white text-center mb-6">確定要刪除這個求譜嗎？此操作無法復原。</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-3 rounded-full bg-[#282828] text-gray-300 font-medium touch-manipulation"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => executeDeleteRequest(deleteConfirmId)}
                  className="flex-1 py-3 rounded-full bg-red-500/20 text-red-400 font-medium touch-manipulation"
                >
                  確定刪除
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 出譜彈窗：請貼上 POLYGON 結他譜連結（撳遮罩關閉） */}
        {pasteLinkModalRequest && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 pointer-events-auto"
            onClick={() => { setPasteLinkModalRequest(null); setPastedLink(''); setPasteMessage(''); }}
            role="button"
            tabIndex={0}
            aria-label="關閉"
            onKeyDown={(e) => { if (e.key === 'Escape') { setPasteLinkModalRequest(null); setPastedLink(''); setPasteMessage(''); } }}
          >
            <div
              className="bg-[#121212] rounded-3xl p-6 w-full max-w-sm shadow-xl border border-[#282828]"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-white text-center mb-1">請貼上結他譜連結</p>
              <p className="text-gray-500 text-xs text-center mb-4">必須為 POLYGON 結他譜連結</p>
              <input
                ref={pasteLinkInputRef}
                type="url"
                value={pastedLink}
                onChange={(e) => setPastedLink(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && checkPasteLinkAndConfirm()}
                placeholder="https://polygon.guitars/tabs/..."
                className="w-full bg-[#282828] border-0 rounded-full px-4 py-3 text-white placeholder-[#666] outline-none text-base mb-3"
              />
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); checkPasteLinkAndConfirm(); }}
                onPointerDown={(e) => e.stopPropagation()}
                className={`w-full rounded-full font-medium py-3 text-base hover:opacity-90 transition ${pasteMessage && pasteMessage.includes('失敗') ? 'bg-[#282828] text-red-500' : 'bg-[#FFD700] text-black'}`}
              >
                {pasteMessage || '確定'}
              </button>
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
          <div className="space-y-4">
            {/* 你的求譜：登入後顯示，新至舊 */}
            {user && (
              <section>
                <h2 className="text-[#FFD700] font-medium text-sm mb-3 px-0.5">你的求譜</h2>
                {myRequests.length === 0 ? (
                  <p className="text-gray-500 text-sm py-2">你尚未發起求譜</p>
                ) : (
                  <div className="space-y-3">
                    {myRequests.map((request) => renderRequestCard(request))}
                  </div>
                )}
              </section>
            )}

            {user && myRequests.length > 0 && otherRequests.length > 0 && (
              <hr className="border-[#282828]" />
            )}

            {otherRequests.length === 0 && !user ? (
              <p className="text-gray-500 text-sm py-2">暫時未有求譜</p>
            ) : otherRequests.length === 0 ? (
              <p className="text-gray-500 text-sm py-2">暫無其他求譜</p>
            ) : (
              <div className="space-y-3">
                {otherRequests.map((request) => renderRequestCard(request))}
              </div>
            )}
          </div>
        )}

      </div>
    </Layout>
  )
}

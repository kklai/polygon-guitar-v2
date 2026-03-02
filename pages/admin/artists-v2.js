import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  updateDoc,
  where,
  orderBy,
  deleteDoc,
  getDoc,
  writeBatch
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import AdminGuard from '@/components/AdminGuard'
import Layout from '@/components/Layout'
import { uploadToCloudinary, validateImageFile } from '@/lib/cloudinary'

const GENDER_OPTIONS = [
  { value: '', label: '未設定' },
  { value: 'male', label: '男歌手' },
  { value: 'female', label: '女歌手' },
  { value: 'group', label: '組合' },
  { value: 'band', label: '樂隊' },
  { value: 'other', label: '其他' }
]

export default function ArtistsV2Page() {
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedArtist, setSelectedArtist] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [message, setMessage] = useState(null)
  const [selectedArtists, setSelectedArtists] = useState(new Set()) // 多選功能
  const [batchMode, setBatchMode] = useState(false) // 批量模式
  const [sortOrder, setSortOrder] = useState('name') // 排序方式: name, tabsDesc, tabsAsc
  const [stats, setStats] = useState({
    total: 0,
    withGender: 0,
    withoutGender: 0,
    withPhoto: 0,
    withoutPhoto: 0,
    withHero: 0
  })

  // 獲取所有歌手
  const fetchArtists = async () => {
    setLoading(true)
    try {
      const q = query(collection(db, 'artists'), orderBy('name'))
      const snapshot = await getDocs(q)
      const artistsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      // 統計
      const withGender = artistsData.filter(a => a.artistType || a.gender).length
      const withPhoto = artistsData.filter(a => a.photoURL || a.photo || a.wikiPhotoURL).length
      const withHero = artistsData.filter(a => a.heroPhoto).length

      setStats({
        total: artistsData.length,
        withGender,
        withoutGender: artistsData.length - withGender,
        withPhoto,
        withoutPhoto: artistsData.length - withPhoto,
        withHero
      })

      setArtists(artistsData)
    } catch (error) {
      console.error('獲取歌手失敗:', error)
      showMessage('獲取歌手失敗: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchArtists()
  }, [])

  // 處理 URL 查詢參數（從歌手頁面跳轉過嚟）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const editId = urlParams.get('edit')
      if (editId && artists.length > 0) {
        const artist = artists.find(a => a.id === editId)
        if (artist) {
          handleEdit(artist)
          // 清除 URL 參數
          window.history.replaceState({}, '', window.location.pathname)
        }
      }
    }
  }, [artists])

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  // 過濾並排序歌手
  const filteredAndSortedArtists = (() => {
    // 先過濾
    const filtered = artists.filter(artist => {
      // 搜索過濾
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchName = artist.name?.toLowerCase().includes(query)
        const matchId = artist.id?.toLowerCase().includes(query)
        if (!matchName && !matchId) return false
      }

      // 類型過濾
      switch (filter) {
        case 'noGender':
          return !artist.artistType && !artist.gender
        case 'noPhoto':
          return !artist.photoURL && !artist.photo && !artist.wikiPhotoURL
        case 'noHero':
          return !artist.heroPhoto
        case 'male':
          return (artist.artistType === 'male' || artist.gender === 'male')
        case 'female':
          return (artist.artistType === 'female' || artist.gender === 'female')
        case 'group':
          return (artist.artistType === 'group' || artist.gender === 'group' || 
                  artist.artistType === 'band' || artist.gender === 'band')
        default:
          return true
      }
    })

    // 再排序
    const sorted = [...filtered]
    switch (sortOrder) {
      case 'tabsDesc':
        sorted.sort((a, b) => (b.tabCount || 0) - (a.tabCount || 0))
        break
      case 'tabsAsc':
        sorted.sort((a, b) => (a.tabCount || 0) - (b.tabCount || 0))
        break
      case 'name':
      default:
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        break
    }
    return sorted
  })()

  // 開始編輯
  const handleEdit = (artist) => {
    setSelectedArtist(artist)
    setEditForm({
      name: artist.name || '',
      artistType: artist.artistType || artist.gender || '',
      bio: artist.bio || '',
      photoURL: artist.photoURL || artist.photo || '',
      wikiPhotoURL: artist.wikiPhotoURL || '',
      heroPhoto: artist.heroPhoto || '',
      birthYear: artist.birthYear || '',
      debutYear: artist.debutYear || ''
    })
  }

  // 處理照片上傳
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateImageFile(file)
    if (!validation.valid) {
      showMessage(validation.error, 'error')
      return
    }

    try {
      showMessage('上傳中...')
      const url = await uploadToCloudinary(file, editForm.name || 'artist', 'artists')
      setEditForm(prev => ({ ...prev, photoURL: url }))
      showMessage('上傳成功')
    } catch (error) {
      console.error('Upload error:', error)
      showMessage('上傳失敗: ' + error.message, 'error')
    }
  }

  // 處理 Hero 照片上傳
  const handleHeroUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateImageFile(file)
    if (!validation.valid) {
      showMessage(validation.error, 'error')
      return
    }

    try {
      showMessage('上傳 Hero 照片中...')
      const url = await uploadToCloudinary(file, `${editForm.name || 'artist'}_hero`, 'artists/hero')
      setEditForm(prev => ({ ...prev, heroPhoto: url }))
      showMessage('Hero 照片上傳成功')
    } catch (error) {
      console.error('Hero upload error:', error)
      showMessage('Hero 上傳失敗: ' + error.message, 'error')
    }
  }

  // 保存編輯
  const handleSave = async () => {
    try {
      // 檢查資料完整性
      if (!selectedArtist?.id || !editForm?.name) {
        showMessage('資料不完整，無法保存', 'error')
        return
      }

      console.log('Saving artist:', selectedArtist.id, editForm.name)
      const artistRef = doc(db, 'artists', selectedArtist.id)
      
      // 檢查歌手名是否有改變
      const nameChanged = editForm.name !== selectedArtist.name
      let updatedTabCount = 0
      
      // 如果歌手名改變，同步更新所有歌譜的歌手名
      if (nameChanged) {
        console.log('Name changed, updating songs...')
        try {
          // 查詢所有該歌手的歌譜（用多個條件查詢，兼容唔同欄位名）
          const possibleIds = [
            selectedArtist.id,
            selectedArtist.normalizedName,
            selectedArtist.name?.toLowerCase().replace(/\s+/g, '-'),
            editForm.name?.toLowerCase().replace(/\s+/g, '-')
          ].filter(Boolean)
          
          // 收集所有匹配的歌譜（避免重複）
          const songMap = new Map()
          
          // 方法1：用 artistId 查詢
          for (const id of possibleIds) {
            try {
              const songsQuery = query(
                collection(db, 'tabs'),
                where('artistId', '==', id)
              )
              const snapshot = await getDocs(songsQuery)
              snapshot.docs.forEach(doc => songMap.set(doc.id, doc))
            } catch (e) { /* ignore */ }
          }
          
          // 方法2：用 artistSlug 查詢
          for (const id of possibleIds) {
            try {
              const songsQuery = query(
                collection(db, 'tabs'),
                where('artistSlug', '==', id)
              )
              const snapshot = await getDocs(songsQuery)
              snapshot.docs.forEach(doc => songMap.set(doc.id, doc))
            } catch (e) { /* ignore */ }
          }
          
          // 方法3：用 artistName 查詢
          try {
            const songsQuery = query(
              collection(db, 'tabs'),
              where('artistName', '==', selectedArtist.name)
            )
            const snapshot = await getDocs(songsQuery)
            snapshot.docs.forEach(doc => songMap.set(doc.id, doc))
          } catch (e) { /* ignore */ }
          
          // 轉為陣列
          const songsSnapshot = { docs: Array.from(songMap.values()) }
          console.log('Found songs:', songsSnapshot.docs.length)
          
          // 批量更新歌譜（每批最多 500 個）
          let batch = writeBatch(db)
          let batchCount = 0
          
          for (const songDoc of songsSnapshot.docs) {
            const songRef = doc(db, 'songs', songDoc.id)
            batch.update(songRef, {
              artist: editForm.name,
              artistName: editForm.name,
              // 保留 artistId 和 artistSlug 不變，確保舊連結繼續有效
              updatedAt: new Date().toISOString()
            })
            batchCount++
            
            // Firebase 每批最多 500 個操作
            if (batchCount >= 450) {
              await batch.commit()
              batch = writeBatch(db)
              batchCount = 0
            }
          }
          
          if (batchCount > 0) {
            await batch.commit()
          }
          
          updatedTabCount = songsSnapshot.docs.length
          console.log('Updated songs:', updatedTabCount)
        } catch (songError) {
          console.error('Error updating songs:', songError)
          // 唔阻礙歌手資料保存，只記錄錯誤
          showMessage('警告：更新歌譜時出錯，但歌手資料仍會保存', 'error')
        }
      }
      
      // 更新歌手資料（保留原有 normalizedName，確保舊連結繼續有效）
      console.log('Updating artist...')
      const updateData = {
        name: editForm.name,
        // 保留原有 normalizedName 不變，確保舊連結繼續有效
        artistType: editForm.artistType || '',
        gender: editForm.artistType || '',
        bio: editForm.bio || '',
        photoURL: editForm.photoURL || '',
        wikiPhotoURL: editForm.wikiPhotoURL || '',
        heroPhoto: editForm.heroPhoto || '',
        birthYear: editForm.birthYear || '',
        debutYear: editForm.debutYear || '',
        updatedAt: new Date().toISOString()
      }
      
      await updateDoc(artistRef, updateData)
      console.log('Artist updated successfully')

      const message = nameChanged 
        ? `保存成功，已同步更新 ${updatedTabCount} 份歌譜的歌手名`
        : '保存成功'
      showMessage(message)
      setSelectedArtist(null)
      setEditForm(null)
      fetchArtists()
    } catch (error) {
      console.error('保存失敗:', error)
      showMessage('保存失敗: ' + error.message, 'error')
    }
  }

  // 多選功能：切換選中狀態
  const toggleSelection = (artistId) => {
    const newSelected = new Set(selectedArtists)
    if (newSelected.has(artistId)) {
      newSelected.delete(artistId)
    } else {
      newSelected.add(artistId)
    }
    setSelectedArtists(newSelected)
  }

  // 多選功能：全選當前過濾結果
  const selectAll = () => {
    if (selectedArtists.size === filteredAndSortedArtists.length) {
      // 如果已全部選中，則取消全選
      setSelectedArtists(new Set())
    } else {
      // 否則全選
      const newSelected = new Set(filteredAndSortedArtists.map(a => a.id))
      setSelectedArtists(newSelected)
    }
  }

  // 批量設置性別（使用選中的歌手）
  const handleBatchSetGender = async (gender) => {
    // 優先使用選中的歌手，如果沒有選中則使用所有未分類歌手
    let targets
    if (selectedArtists.size > 0) {
      targets = artists.filter(a => selectedArtists.has(a.id))
    } else {
      targets = artists.filter(a => !a.artistType && !a.gender)
    }
    
    if (targets.length === 0) {
      showMessage('沒有需要設置的歌手')
      return
    }

    const selectionMode = selectedArtists.size > 0 ? '選中的' : '所有未分類的'
    if (!confirm(`確定要將 ${selectionMode} ${targets.length} 個歌手設置為「${GENDER_OPTIONS.find(g => g.value === gender)?.label}」嗎？`)) {
      return
    }

    let success = 0
    let failed = 0

    for (const artist of targets) {
      try {
        await updateDoc(doc(db, 'artists', artist.id), {
          artistType: gender,
          gender: gender,
          updatedAt: new Date().toISOString()
        })
        success++
      } catch (error) {
        console.error(`更新 ${artist.name} 失敗:`, error)
        failed++
      }
    }

    showMessage(`批量設置完成: ${success} 成功, ${failed} 失敗`)
    setSelectedArtists(new Set()) // 清空選中
    fetchArtists()
  }

  // 刪除歌手
  const handleDelete = async (artist) => {
    if (!confirm(`確定要刪除「${artist.name}」嗎？此操作會同時刪除該歌手的所有樂譜關聯，但樂譜本身會保留。`)) {
      return
    }

    try {
      await deleteDoc(doc(db, 'artists', artist.id))
      showMessage('刪除成功')
      fetchArtists()
    } catch (error) {
      console.error('刪除失敗:', error)
      showMessage('刪除失敗: ' + error.message, 'error')
    }
  }

  // 獲取歌手當前照片
  const getArtistPhoto = (artist) => {
    return artist.photoURL || artist.wikiPhotoURL || artist.photo || null
  }

  return (
    <AdminGuard>
      <Layout>
        <Head>
          <title>歌手管理 V2 | Polygon Guitar</title>
        </Head>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* 標題 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">歌手管理 V2</h1>
              <p className="text-[#B3B3B3] text-sm mt-1">
                統一管理所有歌手資料，包括性別分類和照片
              </p>
            </div>
            <Link
              href="/admin"
              className="text-[#B3B3B3] hover:text-white transition-colors"
            >
              ← 返回管理員中心
            </Link>
          </div>

          {/* 提示訊息 */}
          {message && (
            <div className={`mb-4 p-4 rounded-lg ${
              message.type === 'error' 
                ? 'bg-red-900/50 text-red-200 border border-red-700' 
                : 'bg-green-900/50 text-green-200 border border-green-700'
            }`}>
              {message.text}
            </div>
          )}

          {/* 統計面板 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-[#121212] rounded-lg p-4 border border-gray-800">
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-[#B3B3B3] text-sm">總歌手數</div>
            </div>
            <div className="bg-[#121212] rounded-lg p-4 border border-green-800/50">
              <div className="text-2xl font-bold text-green-400">{stats.withGender}</div>
              <div className="text-[#B3B3B3] text-sm">有分類</div>
            </div>
            <div className="bg-[#121212] rounded-lg p-4 border border-red-800/50">
              <div className="text-2xl font-bold text-red-400">{stats.withoutGender}</div>
              <div className="text-[#B3B3B3] text-sm">未分類</div>
            </div>
            <div className="bg-[#121212] rounded-lg p-4 border border-blue-800/50">
              <div className="text-2xl font-bold text-blue-400">{stats.withPhoto}</div>
              <div className="text-[#B3B3B3] text-sm">有照片</div>
            </div>
            <div className="bg-[#121212] rounded-lg p-4 border border-purple-800/50">
              <div className="text-2xl font-bold text-purple-400">{stats.withHero}</div>
              <div className="text-[#B3B3B3] text-sm">有Hero</div>
            </div>
          </div>

          {/* 工具欄 */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder="搜索歌手..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#121212] text-white border border-gray-700 rounded-lg px-4 py-2 text-sm w-48"
              />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-[#121212] text-white border border-gray-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">全部 ({stats.total})</option>
                <option value="noGender">未分類 ({stats.withoutGender})</option>
                <option value="noPhoto">缺照片 ({stats.withoutPhoto})</option>
                <option value="noHero">缺Hero ({stats.total - stats.withHero})</option>
                <option value="male">男歌手</option>
                <option value="female">女歌手</option>
                <option value="group">組合/樂隊</option>
              </select>
              
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="bg-[#121212] text-white border border-gray-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="name">按名稱</option>
                <option value="tabsDesc">按譜數 (多到少)</option>
                <option value="tabsAsc">按譜數 (少到多)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              {/* 批量模式切換 */}
              <button
                onClick={() => {
                  setBatchMode(!batchMode)
                  if (batchMode) setSelectedArtists(new Set())
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  batchMode 
                    ? 'bg-[#FFD700] text-black' 
                    : 'bg-[#282828] hover:bg-[#3E3E3E] text-white'
                }`}
              >
                {batchMode ? '✓ 完成選擇' : '☐ 批量選擇'}
              </button>
              
              {batchMode && (
                <button
                  onClick={selectAll}
                  className="bg-[#282828] hover:bg-[#3E3E3E] text-white px-3 py-2 rounded-lg text-sm transition-colors"
                >
                  {selectedArtists.size === filteredAndSortedArtists.length ? '取消全選' : '全選'} ({selectedArtists.size})
                </button>
              )}
              
              {(stats.withoutGender > 0 || selectedArtists.size > 0) && (
                <>
                  <span className="text-[#B3B3B3] text-sm">批量設為:</span>
                  <button
                    onClick={() => handleBatchSetGender('male')}
                    className="bg-blue-900/50 hover:bg-blue-800/50 text-blue-300 border border-blue-700 px-3 py-2 rounded-lg text-sm transition-colors"
                  >
                    男
                  </button>
                  <button
                    onClick={() => handleBatchSetGender('female')}
                    className="bg-pink-900/50 hover:bg-pink-800/50 text-pink-300 border border-pink-700 px-3 py-2 rounded-lg text-sm transition-colors"
                  >
                    女
                  </button>
                  <button
                    onClick={() => handleBatchSetGender('group')}
                    className="bg-purple-900/50 hover:bg-purple-800/50 text-purple-300 border border-purple-700 px-3 py-2 rounded-lg text-sm transition-colors"
                  >
                    組合
                  </button>
                </>
              )}
              <button
                onClick={fetchArtists}
                className="bg-[#282828] hover:bg-[#3E3E3E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                🔄 刷新
              </button>
            </div>
          </div>

          {/* 歌手列表 */}
          {loading ? (
            <div className="text-center py-12 text-[#B3B3B3]">載入中...</div>
          ) : filteredAndSortedArtists.length === 0 ? (
            <div className="text-center py-12 text-[#B3B3B3]">
              沒有符合條件的歌手
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-[#B3B3B3] text-sm mb-2 flex items-center justify-between">
                <span>顯示 {filteredAndSortedArtists.length} / {stats.total} 個歌手</span>
                {selectedArtists.size > 0 && (
                  <span className="text-[#FFD700]">
                    已選擇 {selectedArtists.size} 個歌手
                  </span>
                )}
              </div>
              {filteredAndSortedArtists.map((artist) => (
                <div
                  key={artist.id}
                  className={`bg-[#121212] rounded-lg border ${
                    !artist.artistType && !artist.gender ? 'border-red-800/50' : 'border-gray-800'
                  } ${selectedArtists.has(artist.id) ? 'ring-2 ring-[#FFD700]' : ''} p-4`}
                >
                  <div className="flex items-center gap-4">
                    {/* 多選複選框 */}
                    {batchMode && (
                      <input
                        type="checkbox"
                        checked={selectedArtists.has(artist.id)}
                        onChange={() => toggleSelection(artist.id)}
                        className="w-5 h-5 rounded border-gray-600 text-[#FFD700] focus:ring-[#FFD700] focus:ring-offset-0 bg-[#1a1a1a]"
                      />
                    )}
                    {/* 照片 */}
                    <div className="w-16 h-16 rounded-lg bg-[#1a1a1a] flex items-center justify-center overflow-hidden flex-shrink-0">
                      {getArtistPhoto(artist) ? (
                        <img 
                          src={getArtistPhoto(artist)} 
                          alt={artist.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">🎤</span>
                      )}
                    </div>

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-medium">{artist.name}</h3>
                        {(!artist.artistType && !artist.gender) && (
                          <span className="bg-red-900/50 text-red-400 text-xs px-2 py-0.5 rounded-full">
                            未分類
                          </span>
                        )}
                        {(artist.artistType || artist.gender) && (
                          <span className="bg-green-900/30 text-green-400 text-xs px-2 py-0.5 rounded-full">
                            {GENDER_OPTIONS.find(g => g.value === (artist.artistType || artist.gender))?.label || artist.artistType}
                          </span>
                        )}
                        {artist.birthYear && (
                          <span className="bg-blue-900/30 text-blue-400 text-xs px-2 py-0.5 rounded-full">
                            出生: {artist.birthYear}
                          </span>
                        )}
                        {artist.debutYear && (
                          <span className="bg-purple-900/30 text-purple-400 text-xs px-2 py-0.5 rounded-full">
                            出道: {artist.debutYear}
                          </span>
                        )}
                      </div>
                      <div className="text-gray-500 text-xs space-y-0.5">
                        <p>ID: {artist.id}</p>
                        <p>譜數: {artist.tabCount || 0} | 瀏覽: {artist.viewCount || 0}</p>
                        <div className="flex gap-2 mt-1">
                          {getArtistPhoto(artist) && (
                            <span className="text-blue-400">● 照片</span>
                          )}
                          {artist.heroPhoto && (
                            <span className="text-purple-400">● Hero</span>
                          )}
                          {artist.wikiPhotoURL && (
                            <span className="text-yellow-400">● Wiki</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 操作 */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/artists/${artist.id}`}
                        target="_blank"
                        className="text-[#B3B3B3] hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-[#282828] transition-colors"
                      >
                        查看
                      </Link>
                      <button
                        onClick={() => handleEdit(artist)}
                        className="text-[#FFD700] hover:text-yellow-400 text-sm px-3 py-1.5 rounded-lg hover:bg-[#FFD700]/10 transition-colors"
                      >
                        編輯
                      </button>
                      <button
                        onClick={() => handleDelete(artist)}
                        className="text-red-400 hover:text-red-300 text-sm px-3 py-1.5 rounded-lg hover:bg-red-900/30 transition-colors"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 編輯 Modal */}
          {selectedArtist && editForm && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
              <div className="bg-[#121212] rounded-xl border border-gray-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">編輯歌手</h2>
                    <button
                      onClick={() => {
                        setSelectedArtist(null)
                        setEditForm(null)
                      }}
                      className="text-[#B3B3B3] hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[#B3B3B3] text-sm mb-2">歌手名</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                        className="w-full bg-[#0A0A0A] text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-[#FFD700] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[#B3B3B3] text-sm mb-2">分類</label>
                      <select
                        value={editForm.artistType}
                        onChange={(e) => setEditForm({...editForm, artistType: e.target.value})}
                        className="w-full bg-[#0A0A0A] text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-[#FFD700] focus:outline-none"
                      >
                        {GENDER_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[#B3B3B3] text-sm mb-2">簡介</label>
                      <textarea
                        value={editForm.bio}
                        onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                        rows={3}
                        className="w-full bg-[#0A0A0A] text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-[#FFD700] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[#B3B3B3] text-sm mb-2">
                        照片 URL (Cloudinary)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editForm.photoURL}
                          onChange={(e) => setEditForm({...editForm, photoURL: e.target.value})}
                          className="flex-1 bg-[#0A0A0A] text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-[#FFD700] focus:outline-none"
                        />
                        <label className="flex-shrink-0 px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition cursor-pointer">
                          上傳
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                      {editForm.photoURL && (
                        <img 
                          src={editForm.photoURL} 
                          alt="Preview" 
                          className="mt-2 w-20 h-20 object-cover rounded-lg"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-[#B3B3B3] text-sm mb-2">
                        Wiki 照片 URL
                      </label>
                      <input
                        type="text"
                        value={editForm.wikiPhotoURL}
                        onChange={(e) => setEditForm({...editForm, wikiPhotoURL: e.target.value})}
                        className="w-full bg-[#0A0A0A] text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-[#FFD700] focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[#B3B3B3] text-sm mb-2">
                          出生年份
                        </label>
                        <input
                          type="number"
                          value={editForm.birthYear}
                          onChange={(e) => setEditForm({...editForm, birthYear: e.target.value})}
                          placeholder="例如: 1990"
                          className="w-full bg-[#0A0A0A] text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-[#FFD700] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[#B3B3B3] text-sm mb-2">
                          出道年份
                        </label>
                        <input
                          type="number"
                          value={editForm.debutYear}
                          onChange={(e) => setEditForm({...editForm, debutYear: e.target.value})}
                          placeholder="例如: 2010"
                          className="w-full bg-[#0A0A0A] text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-[#FFD700] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[#B3B3B3] text-sm mb-2">
                        Hero 照片 URL (Base64 或連結)
                      </label>
                      <div className="flex gap-2">
                        <textarea
                          value={editForm.heroPhoto}
                          onChange={(e) => setEditForm({...editForm, heroPhoto: e.target.value})}
                          rows={3}
                          className="flex-1 bg-[#0A0A0A] text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-[#FFD700] focus:outline-none text-xs font-mono"
                        />
                        <label className="flex-shrink-0 px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition cursor-pointer self-start">
                          上傳
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleHeroUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                      {editForm.heroPhoto && editForm.heroPhoto.startsWith('http') && (
                        <img 
                          src={editForm.heroPhoto} 
                          alt="Hero Preview" 
                          className="mt-2 w-full h-32 object-cover rounded-lg"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-800">
                    <button
                      onClick={() => {
                        setSelectedArtist(null)
                        setEditForm(null)
                      }}
                      className="px-4 py-2 text-[#B3B3B3] hover:text-white transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSave}
                      className="bg-[#FFD700] hover:bg-yellow-400 text-black px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      保存
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </AdminGuard>
  )
}

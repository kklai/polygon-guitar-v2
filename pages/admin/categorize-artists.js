import { useState, useEffect } from 'react'
import { collection, getDocs, writeBatch, doc, updateDoc, deleteDoc, query, where, getDocs as getDocsQuery } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { Trash2, Users, User, Users2, AlertCircle, Check, X, Search } from 'lucide-react'

const CATEGORIES = [
  { id: 'male', label: '男歌手', icon: User, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { id: 'female', label: '女歌手', icon: User, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  { id: 'group', label: '組合', icon: Users2, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
]

export default function CategorizeArtists() {
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedArtists, setSelectedArtists] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [message, setMessage] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [artistsToDelete, setArtistsToDelete] = useState([])
  const [relatedSongsMap, setRelatedSongsMap] = useState({})

  // 載入「其他」類別的歌手
  useEffect(() => {
    loadOtherArtists()
  }, [])

  const loadOtherArtists = async () => {
    try {
      const snap = await getDocs(collection(db, 'artists'))
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(artist => {
          const type = artist.artistType || artist.gender || 'other'
          // 只顯示未分類或其他類別的歌手
          return !['male', 'female', 'group', 'band', '男', '女', '組合', '樂隊'].includes(type)
        })
      
      // 按名稱排序
      data.sort((a, b) => a.name.localeCompare(b.name, 'zh-HK'))
      setArtists(data)
      
      // 檢查每個歌手的相關歌曲數量
      const songsMap = {}
      for (const artist of data) {
        const count = await checkRelatedSongs(artist)
        songsMap[artist.id] = count
      }
      setRelatedSongsMap(songsMap)
    } catch (error) {
      console.error('Error loading artists:', error)
      showMessage('載入失敗', 'error')
    } finally {
      setLoading(false)
    }
  }

  // 檢查相關歌曲數量
  const checkRelatedSongs = async (artist) => {
    try {
      const possibleIds = [
        artist.id,
        artist.name?.toLowerCase().replace(/\s+/g, '-'),
        artist.name
      ].filter(Boolean)
      
      let count = 0
      for (const artistId of possibleIds) {
        const q = query(
          collection(db, 'tabs'),
          where('artistId', '==', artistId)
        )
        const snapshot = await getDocsQuery(q)
        count += snapshot.size
      }
      
      // 同時檢查 artist 欄位
      if (artist.name) {
        const q2 = query(
          collection(db, 'tabs'),
          where('artist', '==', artist.name)
        )
        const snapshot2 = await getDocsQuery(q2)
        count += snapshot2.size
      }
      
      return count
    } catch (e) {
      console.error('Error checking songs:', e)
      return 0
    }
  }

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  // 全選/取消全選
  const toggleSelectAll = () => {
    const filtered = getFilteredArtists()
    if (selectedArtists.size === filtered.length) {
      setSelectedArtists(new Set())
    } else {
      setSelectedArtists(new Set(filtered.map(a => a.id)))
    }
  }

  // 選擇單個歌手
  const toggleSelect = (id) => {
    const newSet = new Set(selectedArtists)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedArtists(newSet)
  }

  // 過濾歌手
  const getFilteredArtists = () => {
    if (!searchQuery.trim()) return artists
    return artists.filter(a => 
      a.name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }

  // 批量設定類別
  const batchSetCategory = async (category) => {
    if (selectedArtists.size === 0) {
      showMessage('請先選擇歌手', 'error')
      return
    }

    setSaving(true)
    try {
      const batch = writeBatch(db)
      
      selectedArtists.forEach(id => {
        const ref = doc(db, 'artists', id)
        batch.update(ref, {
          artistType: category,
          gender: category,
          updatedAt: new Date().toISOString()
        })
      })
      
      await batch.commit()
      
      // 更新本地狀態
      setArtists(artists.filter(a => !selectedArtists.has(a.id)))
      setSelectedArtists(new Set())
      
      showMessage(`已將 ${selectedArtists.size} 位歌手設為${CATEGORIES.find(c => c.id === category)?.label}`)
    } catch (error) {
      console.error('Error updating:', error)
      showMessage('更新失敗', 'error')
    } finally {
      setSaving(false)
    }
  }

  // 批量刪除
  const batchDelete = async () => {
    if (selectedArtists.size === 0) {
      showMessage('請先選擇歌手', 'error')
      return
    }

    // 檢查是否有歌曲的歌手
    const artistsWithSongs = []
    selectedArtists.forEach(id => {
      if (relatedSongsMap[id] > 0) {
        const artist = artists.find(a => a.id === id)
        if (artist) artistsWithSongs.push(artist)
      }
    })

    if (artistsWithSongs.length > 0) {
      setArtistsToDelete(artistsWithSongs)
      setShowDeleteConfirm(true)
      return
    }

    await performDelete()
  }

  // 執行刪除
  const performDelete = async () => {
    setShowDeleteConfirm(false)
    setSaving(true)
    
    try {
      const batch = writeBatch(db)
      
      selectedArtists.forEach(id => {
        const ref = doc(db, 'artists', id)
        batch.delete(ref)
      })
      
      await batch.commit()
      
      // 更新本地狀態
      setArtists(artists.filter(a => !selectedArtists.has(a.id)))
      setSelectedArtists(new Set())
      
      showMessage(`已刪除 ${selectedArtists.size} 位歌手`)
    } catch (error) {
      console.error('Error deleting:', error)
      showMessage('刪除失敗', 'error')
    } finally {
      setSaving(false)
    }
  }

  // 單個設定類別
  const setSingleCategory = async (artistId, category) => {
    try {
      const ref = doc(db, 'artists', artistId)
      await updateDoc(ref, {
        artistType: category,
        gender: category,
        updatedAt: new Date().toISOString()
      })
      
      // 從列表移除
      setArtists(artists.filter(a => a.id !== artistId))
      setSelectedArtists(prev => {
        const newSet = new Set(prev)
        newSet.delete(artistId)
        return newSet
      })
      
      showMessage(`已設為${CATEGORIES.find(c => c.id === category)?.label}`)
    } catch (error) {
      console.error('Error updating:', error)
      showMessage('更新失敗', 'error')
    }
  }

  // 單個刪除
  const deleteSingle = async (artist) => {
    const songCount = relatedSongsMap[artist.id] || 0
    
    if (songCount > 0) {
      if (!confirm(`⚠️ 警告：${artist.name} 有 ${songCount} 首相關歌曲！\n\n確定要刪除嗎？`)) {
        return
      }
    } else {
      if (!confirm(`確定要刪除「${artist.name}」嗎？`)) {
        return
      }
    }
    
    try {
      await deleteDoc(doc(db, 'artists', artist.id))
      setArtists(artists.filter(a => a.id !== artist.id))
      showMessage('已刪除')
    } catch (error) {
      console.error('Error deleting:', error)
      showMessage('刪除失敗', 'error')
    }
  }

  const filteredArtists = getFilteredArtists()

  return (
    <AdminGuard>
      <Layout>
        <div className="max-w-5xl mx-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">歌手分類整理</h1>
            <p className="text-gray-400">
              快速將「其他」類別的歌手分類到男歌手、女歌手或組合
              <span className="text-[#FFD700] ml-2">({artists.length} 位待分類)</span>
            </p>
          </div>

          {/* Message */}
          {message && (
            <div className={`mb-4 p-3 rounded-lg ${
              message.type === 'error' 
                ? 'bg-red-900/50 text-red-200 border border-red-700' 
                : 'bg-green-900/50 text-green-200 border border-green-700'
            }`}>
              {message.text}
            </div>
          )}

          {/* 搜尋同批次操作 */}
          <div className="mb-6 p-4 bg-[#121212] rounded-xl border border-gray-800 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* 全選 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filteredArtists.length > 0 && selectedArtists.size === filteredArtists.length}
                  onChange={toggleSelectAll}
                  className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-[#FFD700] focus:ring-[#FFD700]"
                />
                <span className="text-white text-sm">
                  全選 ({selectedArtists.size}/{filteredArtists.length})
                </span>
              </label>

              <div className="w-px h-6 bg-gray-700"></div>

              {/* 搜尋 */}
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="搜尋歌手名..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                />
              </div>
            </div>

            {/* 批次操作按 */}
            {selectedArtists.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-800">
                <span className="text-gray-400 text-sm mr-2">批次操作:</span>
                
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon
                  return (
                    <button
                      key={cat.id}
                      onClick={() => batchSetCategory(cat.id)}
                      disabled={saving}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${cat.color} border hover:opacity-80`}
                    >
                      <Icon className="w-4 h-4" />
                      設為{cat.label}
                    </button>
                  )
                })}
                
                <div className="w-px h-6 bg-gray-700 mx-1"></div>
                
                <button
                  onClick={batchDelete}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition"
                >
                  <Trash2 className="w-4 h-4" />
                  刪除 ({selectedArtists.size})
                </button>
              </div>
            )}
          </div>

          {/* 歌手列表 */}
          <div className="bg-[#121212] rounded-xl border border-gray-800 overflow-hidden">
            {loading ? (
              <div className="p-8 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-800 rounded animate-pulse" />
                ))}
              </div>
            ) : filteredArtists.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>沒有待分類的歌手</p>
                <p className="text-sm mt-2">所有歌手已分類完成！</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {filteredArtists.map((artist) => {
                  const songCount = relatedSongsMap[artist.id] || 0
                  const isSelected = selectedArtists.has(artist.id)
                  
                  return (
                    <div 
                      key={artist.id}
                      className={`flex items-center gap-4 p-4 hover:bg-[#1a1a1a] transition ${
                        isSelected ? 'bg-[#1a1a1a]' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(artist.id)}
                        className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-[#FFD700] focus:ring-[#FFD700]"
                      />

                      {/* 歌手圖片 */}
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-800 flex-shrink-0">
                        {artist.photoURL || artist.wikiPhotoURL ? (
                          <img
                            src={artist.photoURL || artist.wikiPhotoURL}
                            alt={artist.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg">
                            🎤
                          </div>
                        )}
                      </div>

                      {/* 歌手名 */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">{artist.name}</h3>
                        <div className="flex items-center gap-2 text-sm">
                          {songCount > 0 ? (
                            <span className="text-amber-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {songCount} 首歌
                            </span>
                          ) : (
                            <span className="text-gray-500">無歌曲</span>
                          )}
                        </div>
                      </div>

                      {/* 單個操作按 */}
                      <div className="flex items-center gap-2">
                        {CATEGORIES.map(cat => {
                          const Icon = cat.icon
                          return (
                            <button
                              key={cat.id}
                              onClick={() => setSingleCategory(artist.id, cat.id)}
                              title={`設為${cat.label}`}
                              className={`p-2 rounded-lg transition ${cat.color} border hover:opacity-80`}
                            >
                              <Icon className="w-4 h-4" />
                            </button>
                          )
                        })}
                        
                        <div className="w-px h-6 bg-gray-700 mx-1"></div>
                        
                        <button
                          onClick={() => deleteSingle(artist)}
                          title="刪除"
                          className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 統計 */}
          <div className="mt-4 text-sm text-gray-400">
            待分類歌手: <span className="text-[#FFD700]">{artists.length}</span> |
            有歌曲的歌手: <span className="text-amber-400">{Object.values(relatedSongsMap).filter(c => c > 0).length}</span> |
            已選擇: <span className="text-white">{selectedArtists.size}</span>
          </div>

          {/* 刪除確認 Modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-[#121212] rounded-xl border border-red-500/30 p-6 max-w-md w-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white">警告</h3>
                </div>
                
                <p className="text-gray-300 mb-4">
                  以下歌手有相關歌曲，刪除後可能導致歌曲頁面顯示異常：
                </p>
                
                <div className="max-h-40 overflow-y-auto bg-black rounded-lg p-3 mb-4 space-y-2">
                  {artistsToDelete.map(artist => (
                    <div key={artist.id} className="flex items-center justify-between text-sm">
                      <span className="text-white">{artist.name}</span>
                      <span className="text-amber-400">{relatedSongsMap[artist.id]} 首歌</span>
                    </div>
                  ))}
                </div>
                
                <p className="text-gray-400 text-sm mb-6">
                  確定要刪除這 {selectedArtists.size} 位歌手嗎？
                </p>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
                  >
                    取消
                  </button>
                  <button
                    onClick={performDelete}
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {saving ? '刪除中...' : '確認刪除'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 說明 */}
          <div className="mt-6 p-4 bg-gray-800/50 rounded-lg text-sm text-gray-400">
            <h4 className="text-white font-medium mb-2">💡 使用說明</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>此頁面顯示所有未分類（「其他」類別）的歌手</li>
              <li>點擊右邊的圖標可快速將歌手分類</li>
              <li>多選後可使用批次操作快速分類多個歌手</li>
              <li><span className="text-amber-400">⚠️ 有歌曲的歌手刪除時會有額外警告</span></li>
            </ul>
          </div>
        </div>
      </Layout>
    </AdminGuard>
  )
}

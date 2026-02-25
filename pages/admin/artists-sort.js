import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { useAuth } from '@/contexts/AuthContext'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Link from 'next/link'

// 簡單拖放 Hook（唔使裝外掛）
function useDragAndDrop(items, onReorder) {
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)

  const handleDragStart = (id) => {
    setDraggingId(id)
  }

  const handleDragOver = (e, id) => {
    e.preventDefault()
    if (id !== draggingId) {
      setDragOverId(id)
    }
  }

  const handleDrop = (e, targetId) => {
    e.preventDefault()
    if (draggingId && draggingId !== targetId) {
      const newItems = [...items]
      const dragIndex = newItems.findIndex(item => item.id === draggingId)
      const dropIndex = newItems.findIndex(item => item.id === targetId)
      
      if (dragIndex !== -1 && dropIndex !== -1) {
        const [removed] = newItems.splice(dragIndex, 1)
        newItems.splice(dropIndex, 0, removed)
        onReorder(newItems)
      }
    }
    setDraggingId(null)
    setDragOverId(null)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverId(null)
  }

  return {
    draggingId,
    dragOverId,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd
  }
}

export default function ArtistsSort() {
  const router = useRouter()
  const { isAdmin } = useAuth()
  
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('male')
  const [searchQuery, setSearchQuery] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // 載入歌手
  useEffect(() => {
    if (isAdmin) {
      loadArtists()
    }
  }, [isAdmin])

  const loadArtists = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'artists'))
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      // 預設按評分排序（高到低）
      data.sort((a, b) => (b.adminScore || 0) - (a.adminScore || 0))
      
      setArtists(data)
    } catch (error) {
      console.error('載入歌手失敗:', error)
      alert('載入失敗')
    } finally {
      setLoading(false)
    }
  }

  // 過濾同分類
  const filteredArtists = artists.filter(artist => {
    // 先過濾類型
    const type = artist.artistType || artist.gender || 'other'
    const matchesTab = 
      (activeTab === 'male' && (type === 'male' || type === '男')) ||
      (activeTab === 'female' && (type === 'female' || type === '女')) ||
      (activeTab === 'group' && (type === 'group' || type === 'band' || type === '組合' || type === '樂隊')) ||
      (activeTab === 'other' && !['male', 'female', 'group', 'band', '男', '女', '組合', '樂隊'].includes(type))

    // 再過濾搜尋
    const matchesSearch = searchQuery === '' || 
      artist.name?.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesTab && matchesSearch
  })

  // 拖放處理
  const handleReorder = (newOrder) => {
    // 更新評分：根據位置（第 1 名 100 分，第 2 名 99 分...）
    const updated = newOrder.map((artist, index) => ({
      ...artist,
      adminScore: Math.max(0, 100 - index) // 第 1 名 100 分，逐個減 1
    }))

    // 更新主列表
    const otherArtists = artists.filter(a => !updated.find(u => u.id === a.id))
    setArtists([...otherArtists, ...updated])
    setHasChanges(true)
  }

  const { 
    draggingId, 
    dragOverId, 
    handleDragStart, 
    handleDragOver, 
    handleDrop, 
    handleDragEnd 
  } = useDragAndDrop(filteredArtists, handleReorder)

  // 儲存更改
  const saveChanges = async () => {
    setSaving(true)
    try {
      // 只更新有改變嘅歌手
      const updates = artists.filter(artist => 
        artist.adminScore !== undefined
      )

      await Promise.all(
        updates.map(artist => 
          updateDoc(doc(db, 'artists', artist.id), {
            adminScore: artist.adminScore,
            updatedAt: new Date()
          })
        )
      )

      setHasChanges(false)
      alert('✅ 排序同評分已儲存！')
    } catch (error) {
      console.error('儲存失敗:', error)
      alert('儲存失敗: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  // 重設為預設評分
  const resetScores = () => {
    if (!confirm('確定要重設所有評分為預設值嗎？')) return
    
    const reset = artists.map(artist => ({
      ...artist,
      adminScore: 50 // 預設 50 分
    }))
    setArtists(reset)
    setHasChanges(true)
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold text-white mb-4">無權訪問</h1>
          <p className="text-gray-500">只有管理員可以使用此功能</p>
        </div>
      </Layout>
    )
  }

  const tabs = [
    { id: 'male', label: '男歌手', color: 'bg-blue-500' },
    { id: 'female', label: '女歌手', color: 'bg-pink-500' },
    { id: 'group', label: '組合', color: 'bg-purple-500' },
    { id: 'other', label: '其他', color: 'bg-gray-500' }
  ]

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">歌手排序</h1>
            <p className="text-gray-500">拖放調整歌手顯示次序，自動更新評分</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/artists-v2"
              className="text-gray-400 hover:text-white transition"
            >
              返回歌手管理
            </Link>
            {hasChanges && (
              <button
                onClick={saveChanges}
                disabled={saving}
                className="px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {saving ? '儲存中...' : '儲存更改'}
              </button>
            )}
          </div>
        </div>

        {/* 搜尋同 Tab */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-4 space-y-4">
          {/* 搜尋 */}
          <div className="relative">
            <input
              type="text"
              placeholder="搜尋歌手名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-black border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
            />
            <svg 
              className="absolute left-3 top-3.5 w-5 h-5 text-gray-500"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* 分類 Tab */}
          <div className="flex gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                  activeTab === tab.id 
                    ? 'bg-[#FFD700] text-black' 
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
                <span className="ml-2 text-sm opacity-60">
                  ({artists.filter(a => {
                    const type = a.artistType || a.gender || 'other'
                    if (tab.id === 'male') return type === 'male' || type === '男'
                    if (tab.id === 'female') return type === 'female' || type === '女'
                    if (tab.id === 'group') return ['group', 'band', '組合', '樂隊'].includes(type)
                    return !['male', 'female', 'group', 'band', '男', '女', '組合', '樂隊'].includes(type)
                  }).length})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 操作提示 */}
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500">
            💡 拖放歌手調整順序，評分會自動更新（第 1 名 100 分，逐個減 1）
          </p>
          <button
            onClick={resetScores}
            className="text-red-400 hover:text-red-300 transition"
          >
            重設所有評分
          </button>
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
              <p>找不到符合的歌手</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filteredArtists.map((artist, index) => (
                <div
                  key={artist.id}
                  draggable
                  onDragStart={() => handleDragStart(artist.id)}
                  onDragOver={(e) => handleDragOver(e, artist.id)}
                  onDrop={(e) => handleDrop(e, artist.id)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-4 p-4 transition cursor-move ${
                    draggingId === artist.id 
                      ? 'opacity-50 bg-gray-800' 
                      : dragOverId === artist.id 
                        ? 'bg-gray-800/50 border-t-2 border-[#FFD700]' 
                        : 'hover:bg-gray-800/30'
                  }`}
                >
                  {/* 排名 */}
                  <span className={`w-8 text-center font-bold ${
                    index < 3 ? 'text-[#FFD700]' : 'text-gray-500'
                  }`}>
                    {index + 1}
                  </span>

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
                    <p className="text-sm text-gray-500">
                      {artist.songCount || 0} 首歌曲
                    </p>
                  </div>

                  {/* 評分 */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">評分:</span>
                    <span className={`font-bold ${
                      (artist.adminScore || 0) >= 80 ? 'text-green-400' :
                      (artist.adminScore || 0) >= 50 ? 'text-[#FFD700]' : 'text-gray-400'
                    }`}>
                      {artist.adminScore || 0}
                    </span>
                  </div>

                  {/* 拖放圖標 */}
                  <svg 
                    className="w-5 h-5 text-gray-600" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 儲存按（底部） */}
        {hasChanges && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
            <button
              onClick={saveChanges}
              disabled={saving}
              className="px-6 py-3 bg-[#FFD700] text-black rounded-full font-medium shadow-lg hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  儲存中...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  儲存更改
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}

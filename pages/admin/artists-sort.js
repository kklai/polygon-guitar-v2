import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { useAuth } from '@/contexts/AuthContext'
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Link from 'next/link'
import { Save, AlertCircle } from 'lucide-react'

export default function ArtistsSortPage() {
  const { isAdmin } = useAuth()
  
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('male')
  const [searchQuery, setSearchQuery] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [changedIds, setChangedIds] = useState(new Set())

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
      
      // 按評分排序（高分在前）
      data.sort((a, b) => (b.adminScore || 0) - (a.adminScore || 0))
      
      setArtists(data)
      setChangedIds(new Set())
      setHasChanges(false)
    } catch (error) {
      console.error('載入歌手失敗:', error)
      alert('載入失敗')
    } finally {
      setLoading(false)
    }
  }

  // 過濾同分類
  const filteredArtists = artists.filter(artist => {
    const type = artist.artistType || artist.gender || 'other'
    const matchesTab = 
      (activeTab === 'male' && (type === 'male' || type === '男')) ||
      (activeTab === 'female' && (type === 'female' || type === '女')) ||
      (activeTab === 'group' && (type === 'group' || type === 'band' || type === '組合' || type === '樂隊')) ||
      (activeTab === 'other' && !['male', 'female', 'group', 'band', '男', '女', '組合', '樂隊'].includes(type))

    const matchesSearch = searchQuery === '' || 
      artist.name?.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesTab && matchesSearch
  })

  // 修改評分
  const handleScoreChange = (artistId, newScore) => {
    const score = parseInt(newScore) || 0
    
    setArtists(prev => {
      const updated = prev.map(a => 
        a.id === artistId ? { ...a, adminScore: score } : a
      )
      // 重新按評分排序
      return updated.sort((a, b) => (b.adminScore || 0) - (a.adminScore || 0))
    })
    
    setChangedIds(prev => new Set(prev).add(artistId))
    setHasChanges(true)
  }

  // 儲存更改
  const saveChanges = async () => {
    if (changedIds.size === 0) {
      alert('沒有更改需要儲存')
      return
    }
    
    setSaving(true)
    try {
      const batch = writeBatch(db)
      let updateCount = 0
      
      changedIds.forEach(id => {
        const artist = artists.find(a => a.id === id)
        if (artist) {
          const ref = doc(db, 'artists', id)
          batch.update(ref, {
            adminScore: artist.adminScore || 0,
            // 清除 displayOrder，因為只用評分排序
            displayOrder: null,
            updatedAt: new Date()
          })
          updateCount++
        }
      })
      
      await batch.commit()
      setHasChanges(false)
      setChangedIds(new Set())
      alert(`✅ 已儲存 ${updateCount} 個歌手的評分！`)
    } catch (error) {
      console.error('儲存失敗:', error)
      alert('儲存失敗: ' + error.message)
    } finally {
      setSaving(false)
    }
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
      <div className="max-w-4xl mx-auto space-y-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">歌手評分排序</h1>
            <p className="text-gray-500">
              修改評分自動排序，高分顯示在前面。評分更改後會即時重新排列。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/artists-v2"
              className="text-gray-400 hover:text-white transition"
            >
              返回歌手管理
            </Link>
            <button
              onClick={saveChanges}
              disabled={saving || !hasChanges}
              className={`px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2 ${
                hasChanges 
                  ? 'bg-[#FFD700] text-black hover:opacity-90' 
                  : 'bg-gray-600 text-gray-300'
              }`}
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  儲存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {hasChanges ? `儲存 (${changedIds.size})` : '無更改'}
                </>
              )}
            </button>
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

        {/* 提示區 */}
        <div className="flex items-center gap-4 text-sm">
          <p className="text-gray-500">
            💡 輸入評分後自動排序，高分顯示在前
          </p>
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
              {filteredArtists.map((artist, index) => {
                const hasScoreChanges = changedIds.has(artist.id)
                
                return (
                  <div
                    key={artist.id}
                    className="flex items-center gap-4 p-4 hover:bg-gray-800/30"
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
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-medium truncate">{artist.name}</h3>
                        {artist.artistType && (
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            artist.artistType === 'male' ? 'bg-blue-900/30 text-blue-400' :
                            artist.artistType === 'female' ? 'bg-pink-900/30 text-pink-400' :
                            artist.artistType === 'group' ? 'bg-yellow-900/30 text-yellow-400' :
                            'bg-gray-800 text-gray-400'
                          }`}>
                            {artist.artistType === 'male' ? '男' :
                             artist.artistType === 'female' ? '女' :
                             artist.artistType === 'group' ? '組合' : '其他'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {artist.songCount || artist.tabCount || 0} 首歌曲
                      </p>
                    </div>

                    {/* 評分輸入框 */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">評分:</span>
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        value={artist.adminScore || 0}
                        onChange={(e) => handleScoreChange(artist.id, e.target.value)}
                        className={`w-20 px-2 py-1 bg-black border rounded text-center font-bold transition ${
                          hasScoreChanges 
                            ? 'border-[#FFD700] text-[#FFD700]' 
                            : (artist.adminScore || 0) >= 80 
                              ? 'border-green-500 text-green-400'
                              : (artist.adminScore || 0) >= 50 
                                ? 'border-gray-700 text-gray-300'
                                : 'border-gray-800 text-gray-500'
                        }`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 儲存按鈕（底部） */}
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <button
            onClick={saveChanges}
            disabled={saving || !hasChanges}
            className={`px-6 py-3 rounded-full font-medium shadow-lg transition disabled:opacity-50 flex items-center gap-2 ${
              hasChanges 
                ? 'bg-[#FFD700] text-black hover:opacity-90' 
                : 'bg-gray-600 text-gray-300'
            }`}
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
                <Save className="w-5 h-5" />
                {hasChanges ? `儲存更改 (${changedIds.size})` : '無更改'}
              </>
            )}
          </button>
        </div>
      </div>
    </Layout>
  )
}

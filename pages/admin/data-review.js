import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { getAllArtists, getAllTabs } from '@/lib/tabs'
import { deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// 可疑模式定義
const SUSPICIOUS_ARTIST_PATTERNS = [
  { id: 'single_upper', pattern: /^[A-Z]$/, desc: '單個大寫字母', icon: '🔤' },
  { id: 'single_lower', pattern: /^[a-z]$/, desc: '單個小寫字母', icon: '🔤' },
  { id: 'number_only', pattern: /^\d+$/, desc: '純數字', icon: '🔢' },
  { id: 'short_name', pattern: null, check: (name) => name.length <= 2, desc: '名稱過短（2字或以下）', icon: '✂️' },
  { id: 'tutorial', pattern: /課程|課堂|教學|tutorial|lesson|course/i, desc: '教學/課程', icon: '📚' },
  { id: 'chart', pattern: /排行榜|排名|chart|top.*list/i, desc: '排行榜', icon: '📊' },
  { id: 'guide', pattern: /攻略|指南|guide/i, desc: '攻略指南', icon: '🗺️' },
  { id: 'quiz', pattern: /測驗|quiz|測試|test|考試/i, desc: '測驗考試', icon: '📝' },
  { id: 'lesson_num', pattern: /^第.*課$/, desc: '第X課格式', icon: '📖' },
  { id: 'product', pattern: /product|產品|商品|樂器店|琴行/i, desc: '產品/商店', icon: '🛍️' },
  { id: 'drum', pattern: /drum|鼓譜|drum tab/i, desc: '鼓譜', icon: '🥁' },
  { id: 'ukulele', pattern: /ukulele|烏克麗麗|夏威夷小結他/i, desc: 'Ukulele', icon: '🎸' },
  { id: 'empty', pattern: null, check: (name, artist) => !(artist.songCount || artist.tabCount), desc: '沒有關聯歌曲', icon: '📭' }
]

const SUSPICIOUS_TAB_PATTERNS = [
  { id: 'tutorial', pattern: /課程|教學|攻略|指南|tutorial|lesson|course/i, desc: '教學內容', icon: '📚' },
  { id: 'quiz', pattern: /測驗|quiz|測試|test|考試|問題|答案/i, desc: '測驗內容', icon: '📝' },
  { id: 'drum', pattern: /drum|鼓譜|cajon|木箱鼓|kalimba|卡林巴|ukulele/i, desc: '非結他樂器', icon: '🥁' },
  { id: 'piano', pattern: /鋼琴|piano|小提琴|violin/i, desc: '其他樂器', icon: '🎹' },
  { id: 'directory', pattern: /目錄|directory|index|歌曲列表|song list|歌曲目錄/i, desc: '目錄索引', icon: '📂' },
  { id: 'fingerstyle', pattern: /fingerstyle|指彈/i, desc: 'Fingerstyle', icon: '👆' },
  { id: 'empty_content', pattern: null, check: (tab) => !(tab.content && tab.content.length > 20), desc: '內容過短或為空', icon: '📄' },
  { id: 'long_title', pattern: null, check: (tab) => tab.title && tab.title.length > 100, desc: '標題過長', icon: '📏' }
]

function DataReview() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('artists') // 'artists' | 'tabs'
  const [artists, setArtists] = useState([])
  const [tabs, setTabs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFilters, setSelectedFilters] = useState([])
  const [selectedItems, setSelectedItems] = useState(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteMode, setDeleteMode] = useState('single') // 'single' | 'batch'

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [artistsData, tabsData] = await Promise.all([
        getAllArtists(),
        getAllTabs()
      ])
      setArtists(artistsData)
      setTabs(tabsData)
    } catch (error) {
      console.error('Error loading data:', error)
      alert('載入數據失敗')
    } finally {
      setIsLoading(false)
    }
  }

  // 檢查歌手是否符合可疑模式
  const checkArtistSuspicious = (artist) => {
    const issues = []
    SUSPICIOUS_ARTIST_PATTERNS.forEach(rule => {
      if (rule.pattern) {
        if (rule.pattern.test(artist.name)) {
          issues.push(rule)
        }
      } else if (rule.check) {
        if (rule.check(artist.name, artist)) {
          issues.push(rule)
        }
      }
    })
    return issues
  }

  // 檢查歌曲是否符合可疑模式
  const checkTabSuspicious = (tab) => {
    const issues = []
    const textToCheck = `${tab.title || ''} ${tab.content || ''} ${tab.artist || ''}`
    
    SUSPICIOUS_TAB_PATTERNS.forEach(rule => {
      if (rule.pattern) {
        if (rule.pattern.test(textToCheck)) {
          issues.push(rule)
        }
      } else if (rule.check) {
        if (rule.check(tab)) {
          issues.push(rule)
        }
      }
    })
    return issues
  }

  // 獲取可疑歌手（排除已審查的）
  const suspiciousArtists = artists
    .filter(artist => !artist.reviewedAt && !artist.isReviewed) // 排除已審查
    .map(artist => ({
      ...artist,
      issues: checkArtistSuspicious(artist)
    })).filter(artist => artist.issues.length > 0)

  // 獲取可疑歌曲（排除已審查的）
  const suspiciousTabs = tabs
    .filter(tab => !tab.reviewedAt && !tab.isReviewed) // 排除已審查
    .map(tab => ({
      ...tab,
      issues: checkTabSuspicious(tab)
    })).filter(tab => tab.issues.length > 0)

  // 過濾後的項目
  const filteredArtists = selectedFilters.length === 0 
    ? suspiciousArtists 
    : suspiciousArtists.filter(a => a.issues.some(i => selectedFilters.includes(i.id)))

  const filteredTabs = selectedFilters.length === 0 
    ? suspiciousTabs 
    : suspiciousTabs.filter(t => t.issues.some(i => selectedFilters.includes(i.id)))

  // 獲取所有使用中的過濾器
  const getActiveFilters = () => {
    const filters = new Set()
    if (activeTab === 'artists') {
      suspiciousArtists.forEach(a => a.issues.forEach(i => filters.add(i)))
    } else {
      suspiciousTabs.forEach(t => t.issues.forEach(i => filters.add(i)))
    }
    return Array.from(filters)
  }

  // 標記為已審查（Approve）
  const approveItem = async (type, id, name) => {
    try {
      await updateDoc(doc(db, type, id), {
        reviewedAt: new Date().toISOString(),
        isReviewed: true
      })
      // 從本地 state 移除，不重新載入
      if (type === 'artists') {
        setArtists(prev => prev.filter(a => a.id !== id))
      } else {
        setTabs(prev => prev.filter(t => t.id !== id))
      }
    } catch (error) {
      console.error('Approve error:', error)
      alert('❌ 標記失敗：' + error.message)
    }
  }

  // 刪除單個項目
  const deleteItem = async (type, id, name) => {
    if (!confirm(`確定要刪除「${name}」嗎？\n\n⚠️ 此操作無法撤銷！`)) {
      return
    }

    try {
      await deleteDoc(doc(db, type, id))
      // 從本地 state 移除，不重新載入，保持捲動位置
      if (type === 'artists') {
        setArtists(prev => prev.filter(a => a.id !== id))
      } else {
        setTabs(prev => prev.filter(t => t.id !== id))
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('❌ 刪除失敗：' + error.message)
    }
  }

  // 批量刪除
  const deleteSelected = async () => {
    const items = activeTab === 'artists' ? filteredArtists : filteredTabs
    const selected = items.filter(item => selectedItems.has(item.id))
    
    if (selected.length === 0) {
      alert('請先選擇要刪除的項目')
      return
    }

    if (!confirm(`確定要刪除選中的 ${selected.length} 個項目嗎？\n\n⚠️ 此操作無法撤銷！`)) {
      return
    }

    setIsDeleting(true)
    let success = 0
    let failed = 0

    for (const item of selected) {
      try {
        await deleteDoc(doc(db, activeTab === 'artists' ? 'artists' : 'tabs', item.id))
        success++
      } catch (error) {
        console.error(`Failed to delete ${item.id}:`, error)
        failed++
      }
    }

    setIsDeleting(false)
    setSelectedItems(new Set())
    
    // 從本地 state 移除已刪除的項目，不重新載入
    if (activeTab === 'artists') {
      const deletedIds = new Set(selected.map(s => s.id))
      setArtists(prev => prev.filter(a => !deletedIds.has(a.id)))
    } else {
      const deletedIds = new Set(selected.map(s => s.id))
      setTabs(prev => prev.filter(t => !deletedIds.has(t.id)))
    }
    
    if (failed === 0) {
      // 不彈 alert，避免打斷操作流
    } else {
      alert(`刪除完成：成功 ${success} 個，失敗 ${failed} 個`)
    }
  }

  // 切換選擇
  const toggleSelection = (id) => {
    const newSet = new Set(selectedItems)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedItems(newSet)
  }

  // 全選/取消全選
  const toggleAll = () => {
    const items = activeTab === 'artists' ? filteredArtists : filteredTabs
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(items.map(i => i.id)))
    }
  }

  const activeFilters = getActiveFilters()

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 pb-8">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-gray-800 -mx-4 px-4 py-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>🔍</span> 數據審查工具
              </h1>
              <p className="text-sm text-[#B3B3B3]">找出並清理可疑的歌手和歌曲</p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="text-[#B3B3B3] hover:text-white transition"
            >
              返回後台
            </button>
          </div>
        </div>

        {/* 統計卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-sm">歌手總數</p>
            <p className="text-2xl font-bold text-white">{artists.length}</p>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-sm">可疑歌手</p>
            <p className="text-2xl font-bold text-[#FFD700]">{suspiciousArtists.length}</p>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-sm">歌曲總數</p>
            <p className="text-2xl font-bold text-white">{tabs.length}</p>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-sm">可疑歌曲</p>
            <p className="text-2xl font-bold text-[#FFD700]">{suspiciousTabs.length}</p>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-sm">已審查</p>
            <p className="text-2xl font-bold text-green-400">
              {artists.filter(a => a.reviewedAt || a.isReviewed).length + tabs.filter(t => t.reviewedAt || t.isReviewed).length}
            </p>
          </div>
        </div>

        {/* 使用說明 */}
        <div className="bg-[#1a1a2e] rounded-xl p-4 border border-blue-900/50 mb-6">
          <p className="text-sm text-blue-300">
            <span className="font-medium">💡 使用提示：</span>
            <span className="text-gray-400 ml-2">
              「✓ 正確」按鈕會標記項目為已審查，以後不再顯示在此列表。
              刪除或標記後頁面不會重新載入，保持捲動位置。
            </span>
          </p>
        </div>

        {/* 分頁標籤 */}
        <div className="flex gap-2 mb-6 border-b border-gray-800">
          {[
            { id: 'artists', label: `👤 歌手 (${suspiciousArtists.length})` },
            { id: 'tabs', label: `🎵 歌曲 (${suspiciousTabs.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setSelectedFilters([])
                setSelectedItems(new Set())
              }}
              className={`px-4 py-3 font-medium transition border-b-2 ${
                activeTab === tab.id
                  ? 'text-[#FFD700] border-[#FFD700]'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 過濾器 */}
        {activeFilters.length > 0 && (
          <div className="mb-6">
            <p className="text-gray-400 text-sm mb-3">過濾條件（點擊篩選）：</p>
            <div className="flex flex-wrap gap-2">
              {activeFilters.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => {
                    if (selectedFilters.includes(filter.id)) {
                      setSelectedFilters(prev => prev.filter(id => id !== filter.id))
                    } else {
                      setSelectedFilters(prev => [...prev, filter.id])
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition ${
                    selectedFilters.includes(filter.id) || selectedFilters.length === 0
                      ? selectedFilters.includes(filter.id)
                        ? 'bg-[#FFD700] text-black'
                        : 'bg-[#282828] text-white hover:bg-[#3E3E3E]'
                      : 'bg-[#1a1a1a] text-gray-600'
                  }`}
                >
                  <span>{filter.icon}</span>
                  <span>{filter.desc}</span>
                </button>
              ))}
              {selectedFilters.length > 0 && (
                <button
                  onClick={() => setSelectedFilters([])}
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
                >
                  清除篩選
                </button>
              )}
            </div>
          </div>
        )}

        {/* 批量操作 */}
        {(activeTab === 'artists' ? filteredArtists : filteredTabs).length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleAll}
                className="text-sm text-gray-400 hover:text-white"
              >
                {selectedItems.size === (activeTab === 'artists' ? filteredArtists : filteredTabs).length
                  ? '取消全選'
                  : '全選'}
              </button>
              <span className="text-sm text-gray-500">
                已選 {selectedItems.size} 項
              </span>
            </div>
            {selectedItems.size > 0 && (
              <button
                onClick={deleteSelected}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {isDeleting ? '刪除中...' : `刪除選中的 ${selectedItems.size} 項`}
              </button>
            )}
          </div>
        )}

        {/* 載入中 */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">載入數據中...</p>
          </div>
        )}

        {/* 歌手列表 */}
        {!isLoading && activeTab === 'artists' && (
          <div className="space-y-3">
            {filteredArtists.length === 0 ? (
              <div className="text-center py-12 bg-[#121212] rounded-xl border border-gray-800">
                <span className="text-4xl mb-4 block">✅</span>
                <h3 className="text-lg font-medium text-white mb-2">
                  {selectedFilters.length > 0 ? '沒有符合條件的歌手' : '沒有發現可疑歌手'}
                </h3>
                <p className="text-[#B3B3B3]">
                  {selectedFilters.length > 0 ? '請嘗試其他篩選條件' : '所有歌手資料看起來都正常'}
                </p>
              </div>
            ) : (
              filteredArtists.map(artist => (
                <div
                  key={artist.id}
                  className={`bg-[#121212] rounded-xl p-4 border transition ${
                    selectedItems.has(artist.id) 
                      ? 'border-[#FFD700] bg-[#FFD700]/5' 
                      : 'border-gray-800'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(artist.id)}
                      onChange={() => toggleSelection(artist.id)}
                      className="mt-1 w-4 h-4 rounded border-gray-600 text-[#FFD700] focus:ring-[#FFD700]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {artist.wikiPhotoURL || artist.photoURL ? (
                          <img
                            src={artist.wikiPhotoURL || artist.photoURL}
                            alt={artist.name}
                            className="w-12 h-12 rounded-full object-cover bg-gray-800"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                            <span className="text-xl">🎤</span>
                          </div>
                        )}
                        <div>
                          <h3 className="text-white font-medium">{artist.name}</h3>
                          <p className="text-sm text-gray-500">ID: {artist.id}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {artist.issues.map(issue => (
                          <span
                            key={issue.id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs"
                          >
                            <span>{issue.icon}</span>
                            {issue.desc}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>歌曲: {artist.songCount || artist.tabCount || 0}</span>
                        {artist.spotifyFollowers && (
                          <span>Spotify 粉絲: {artist.spotifyFollowers.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/artists/${artist.normalizedName || artist.id}`)}
                        className="px-3 py-1.5 bg-[#282828] text-white rounded text-sm hover:bg-[#3E3E3E] transition"
                      >
                        查看
                      </button>
                      <button
                        onClick={() => approveItem('artists', artist.id, artist.name)}
                        className="px-3 py-1.5 bg-green-600/20 text-green-400 rounded text-sm hover:bg-green-600 hover:text-white transition"
                        title="標記為正確，不再顯示"
                      >
                        ✓ 正確
                      </button>
                      <button
                        onClick={() => deleteItem('artists', artist.id, artist.name)}
                        className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded text-sm hover:bg-red-600 hover:text-white transition"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 歌曲列表 */}
        {!isLoading && activeTab === 'tabs' && (
          <div className="space-y-3">
            {filteredTabs.length === 0 ? (
              <div className="text-center py-12 bg-[#121212] rounded-xl border border-gray-800">
                <span className="text-4xl mb-4 block">✅</span>
                <h3 className="text-lg font-medium text-white mb-2">
                  {selectedFilters.length > 0 ? '沒有符合條件的歌曲' : '沒有發現可疑歌曲'}
                </h3>
                <p className="text-[#B3B3B3]">
                  {selectedFilters.length > 0 ? '請嘗試其他篩選條件' : '所有歌曲資料看起來都正常'}
                </p>
              </div>
            ) : (
              filteredTabs.map(tab => (
                <div
                  key={tab.id}
                  className={`bg-[#121212] rounded-xl p-4 border transition ${
                    selectedItems.has(tab.id) 
                      ? 'border-[#FFD700] bg-[#FFD700]/5' 
                      : 'border-gray-800'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(tab.id)}
                      onChange={() => toggleSelection(tab.id)}
                      className="mt-1 w-4 h-4 rounded border-gray-600 text-[#FFD700] focus:ring-[#FFD700]"
                    />
                    <div className="flex-1">
                      <div className="mb-2">
                        <h3 className="text-white font-medium">{tab.title}</h3>
                        <p className="text-sm text-gray-500">
                          {tab.artist} • ID: {tab.id}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {tab.issues.map(issue => (
                          <span
                            key={issue.id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs"
                          >
                            <span>{issue.icon}</span>
                            {issue.desc}
                          </span>
                        ))}
                      </div>
                      {tab.content && (
                        <div className="bg-black rounded p-3 text-xs text-gray-400 font-mono line-clamp-2">
                          {tab.content.substring(0, 200)}
                          {tab.content.length > 200 && '...'}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/tabs/${tab.id}`)}
                        className="px-3 py-1.5 bg-[#282828] text-white rounded text-sm hover:bg-[#3E3E3E] transition"
                      >
                        查看
                      </button>
                      <button
                        onClick={() => approveItem('tabs', tab.id, tab.title)}
                        className="px-3 py-1.5 bg-green-600/20 text-green-400 rounded text-sm hover:bg-green-600 hover:text-white transition"
                        title="標記為正確，不再顯示"
                      >
                        ✓ 正確
                      </button>
                      <button
                        onClick={() => deleteItem('tabs', tab.id, tab.title)}
                        className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded text-sm hover:bg-red-600 hover:text-white transition"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

export default function DataReviewGuard() {
  return (
    <AdminGuard>
      <DataReview />
    </AdminGuard>
  )
}

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { getAllTabs, getAllArtists } from '@/lib/tabs'
import { updateDoc, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// 常見錯誤歌手名對照表
const KNOWN_ARTIST_FIXES = [
  {
    searchTerms: ['新青年', '理髮廳', '新青年理髮'],
    correctName: '新青年理髮廳',
    artistId: 'new-youth-barber',
    type: 'group'
  },
  {
    searchTerms: ['per se'],
    correctName: 'per se',
    artistId: 'per-se',
    type: 'group'
  },
  {
    searchTerms: ['serrini', '樹妮妮'],
    correctName: 'Serrini',
    artistId: 'serrini',
    type: 'female'
  },
  {
    searchTerms: ['iii', 'ian chan', 'ianchan'],
    correctName: 'Ian 陳卓賢',
    artistId: 'ian-chan',
    type: 'male'
  }
]

function FixArtistPage() {
  const router = useRouter()
  const [tabs, setTabs] = useState([])
  const [artists, setArtists] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('unknown') // 'unknown' | 'search'
  const [selectedFix, setSelectedFix] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [isFixing, setIsFixing] = useState(false)
  const [logs, setLogs] = useState([])
  
  // UNKNOWN 歌手列表
  const [unknownTabs, setUnknownTabs] = useState([])
  const [editingTab, setEditingTab] = useState(null)
  const [editForm, setEditForm] = useState({ artist: '', title: '' })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [tabsData, artistsData] = await Promise.all([
        getAllTabs(),
        getAllArtists()
      ])
      setTabs(tabsData)
      setArtists(artistsData)
      
      // 找出所有 UNKNOWN 或無歌手的譜
      const unknown = tabsData.filter(tab => {
        const artist = (tab.artist || '').toLowerCase()
        return !artist || artist === 'unknown' || artist === 'n/a' || artist === ''
      })
      setUnknownTabs(unknown)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }])
  }

  // ========== UNKNOWN 歌手處理 ==========
  
  // 開始編輯單個譜
  const startEditTab = (tab) => {
    setEditingTab(tab)
    // 嘗試從 title 解析歌手和歌名
    const parsed = parseTitle(tab.title)
    setEditForm({
      artist: parsed.artist || '',
      title: parsed.title || tab.title || ''
    })
  }
  
  // 取消編輯
  const cancelEdit = () => {
    setEditingTab(null)
    setEditForm({ artist: '', title: '' })
  }
  
  // 解析標題（嘗試各種常見格式）
  const parseTitle = (title) => {
    if (!title) return { artist: '', title: '' }
    
    // 格式 1: "歌手 - 歌名"
    let match = title.match(/^(.+?)\s*[-–—]\s*(.+)$/)
    if (match) return { artist: match[1].trim(), title: match[2].trim() }
    
    // 格式 2: "歌手 | 歌名"
    match = title.match(/^(.+?)\s*\|\s*(.+)$/)
    if (match) return { artist: match[1].trim(), title: match[2].trim() }
    
    // 格式 3: "歌名 by 歌手"
    match = title.match(/^(.+?)\s+by\s+(.+)$/i)
    if (match) return { artist: match[2].trim(), title: match[1].trim() }
    
    // 格式 4: "歌名 - 歌手"
    match = title.match(/^(.+?)\s*[-–—]\s*(.+)$/)
    if (match) return { artist: match[2].trim(), title: match[1].trim() }
    
    return { artist: '', title: title }
  }
  
  // 智能解析標題
  const autoParse = () => {
    if (!editingTab) return
    const parsed = parseTitle(editingTab.title)
    setEditForm({
      artist: parsed.artist || '',
      title: parsed.title || editingTab.title || ''
    })
    addLog(`嘗試解析：「${editingTab.title}」`, 'info')
  }
  
  // 保存修復
  const saveFix = async () => {
    if (!editingTab || !editForm.artist.trim() || !editForm.title.trim()) {
      alert('請輸入歌手名和歌名')
      return
    }
    
    setIsFixing(true)
    try {
      const artistId = editForm.artist.toLowerCase().replace(/\s+/g, '-')
      
      // 1. 檢查並創建歌手
      const artistRef = doc(db, 'artists', artistId)
      const artistSnap = await getDoc(artistRef)
      
      if (!artistSnap.exists()) {
        await setDoc(artistRef, {
          name: editForm.artist,
          normalizedName: artistId,
          slug: artistId,
          artistType: 'other',
          gender: 'other',
          songCount: 1,
          tabCount: 1,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        addLog(`✅ 創建歌手：${editForm.artist}`, 'success')
      } else {
        // 更新歌手歌曲數
        const currentCount = artistSnap.data().songCount || 0
        await updateDoc(artistRef, {
          songCount: currentCount + 1,
          tabCount: currentCount + 1,
          updatedAt: new Date().toISOString()
        })
      }
      
      // 2. 更新歌曲
      await updateDoc(doc(db, 'tabs', editingTab.id), {
        artist: editForm.artist,
        artistId: artistId,
        artistSlug: artistId,
        artistName: editForm.artist,
        title: editForm.title,
        updatedAt: new Date().toISOString()
      })
      
      addLog(`✅ 已修復：${editForm.artist} - ${editForm.title}`, 'success')
      
      // 3. 從列表移除
      setUnknownTabs(prev => prev.filter(t => t.id !== editingTab.id))
      setEditingTab(null)
      setEditForm({ artist: '', title: '' })
      
    } catch (error) {
      console.error('Fix error:', error)
      addLog(`❌ 錯誤：${error.message}`, 'error')
    } finally {
      setIsFixing(false)
    }
  }
  
  // 刪除歌曲（如果是垃圾數據）
  const deleteTab = async (tab) => {
    if (!confirm(`確定要刪除「${tab.title}」嗎？此操作不可撤銷。`)) return
    
    try {
      await deleteDoc(doc(db, 'tabs', tab.id))
      addLog(`🗑️ 已刪除：${tab.title}`, 'warning')
      setUnknownTabs(prev => prev.filter(t => t.id !== tab.id))
    } catch (error) {
      addLog(`❌ 刪除失敗：${error.message}`, 'error')
    }
  }

  // ========== 原有搜尋修復功能 ==========

  // 搜尋需要修復的歌曲
  const searchForFix = (fixConfig) => {
    setSelectedFix(fixConfig)
    
    const results = tabs.filter(tab => {
      const title = (tab.title || '').toLowerCase()
      const artist = (tab.artist || '').toLowerCase()
      const searchText = `${title} ${artist}`
      
      return fixConfig.searchTerms.some(term => searchText.includes(term.toLowerCase()))
    })
    
    setSearchResults(results)
    addLog(`搜尋「${fixConfig.correctName}」：找到 ${results.length} 首歌曲`, 'info')
  }

  // 手動搜尋
  const manualSearch = (searchTerm) => {
    const results = tabs.filter(tab => {
      const title = (tab.title || '').toLowerCase()
      const artist = (tab.artist || '').toLowerCase()
      const searchText = `${title} ${artist}`
      return searchText.includes(searchTerm.toLowerCase())
    })
    
    setSearchResults(results)
    setSelectedFix({
      searchTerms: [searchTerm],
      correctName: searchTerm,
      artistId: searchTerm.toLowerCase().replace(/\s+/g, '-'),
      type: 'other'
    })
    addLog(`手動搜尋「${searchTerm}」：找到 ${results.length} 首歌曲`, 'info')
  }

  // 執行修復
  const executeFix = async () => {
    if (!selectedFix || searchResults.length === 0) return
    
    setIsFixing(true)
    addLog(`開始修復「${selectedFix.correctName}」...`, 'info')
    
    try {
      // 1. 檢查並創建歌手
      const artistRef = doc(db, 'artists', selectedFix.artistId)
      const artistSnap = await getDoc(artistRef)
      
      if (!artistSnap.exists()) {
        addLog(`創建歌手「${selectedFix.correctName}」...`, 'info')
        await setDoc(artistRef, {
          name: selectedFix.correctName,
          normalizedName: selectedFix.artistId,
          slug: selectedFix.artistId,
          artistType: selectedFix.type,
          gender: selectedFix.type,
          songCount: searchResults.length,
          tabCount: searchResults.length,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        addLog(`✅ 歌手「${selectedFix.correctName}」已創建`, 'success')
      } else {
        addLog(`✅ 歌手「${selectedFix.correctName}」已存在`, 'success')
      }
      
      // 2. 修復所有歌曲
      let fixedCount = 0
      for (const tab of searchResults) {
        const needsFix = tab.artist !== selectedFix.correctName || 
                        tab.artistId !== selectedFix.artistId
        
        if (needsFix) {
          await updateDoc(doc(db, 'tabs', tab.id), {
            artist: selectedFix.correctName,
            artistId: selectedFix.artistId,
            artistSlug: selectedFix.artistId,
            artistName: selectedFix.correctName,
            updatedAt: new Date().toISOString()
          })
          fixedCount++
          addLog(`✅ 修復：${tab.title}`, 'success')
        } else {
          addLog(`✓ 已正確：${tab.title}`, 'info')
        }
      }
      
      // 3. 更新歌手歌曲數
      await updateDoc(artistRef, {
        songCount: searchResults.length,
        tabCount: searchResults.length,
        updatedAt: new Date().toISOString()
      })
      
      addLog(`\n完成！共修復 ${fixedCount} 首歌曲`, 'success')
      
      // 刷新數據
      loadData()
      
    } catch (error) {
      console.error('Fix error:', error)
      addLog(`❌ 錯誤：${error.message}`, 'error')
    } finally {
      setIsFixing(false)
    }
  }

  // 快速修復單個歌曲
  const quickFixTab = async (tab, newArtistName) => {
    try {
      const artistId = newArtistName.toLowerCase().replace(/\s+/g, '-')
      
      // 檢查歌手是否存在
      const artistRef = doc(db, 'artists', artistId)
      const artistSnap = await getDoc(artistRef)
      
      if (!artistSnap.exists()) {
        // 創建歌手
        await setDoc(artistRef, {
          name: newArtistName,
          normalizedName: artistId,
          slug: artistId,
          artistType: 'other',
          isActive: true,
          createdAt: new Date().toISOString()
        })
      }
      
      // 更新歌曲
      await updateDoc(doc(db, 'tabs', tab.id), {
        artist: newArtistName,
        artistId: artistId,
        artistSlug: artistId,
        artistName: newArtistName,
        updatedAt: new Date().toISOString()
      })
      
      addLog(`✅ 已修復：${tab.title} → ${newArtistName}`, 'success')
      
      // 從列表移除
      setSearchResults(prev => prev.filter(t => t.id !== tab.id))
      
    } catch (error) {
      addLog(`❌ 修復失敗：${error.message}`, 'error')
    }
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 pb-8">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-gray-800 -mx-4 px-4 py-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>🔧</span> 歌手名修復工具
              </h1>
              <p className="text-sm text-[#B3B3B3]">修復 UNKNOWN 或錯誤歌手名的歌曲</p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="text-[#B3B3B3] hover:text-white transition"
            >
              返回後台
            </button>
          </div>
        </div>

        {/* Tab 切換 */}
        <div className="flex border-b border-gray-800 mb-6">
          <button
            onClick={() => setActiveTab('unknown')}
            className={`px-6 py-3 text-sm font-medium transition ${
              activeTab === 'unknown'
                ? 'text-[#FFD700] border-b-2 border-[#FFD700]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🚨 UNKNOWN 歌手 ({unknownTabs.length})
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-6 py-3 text-sm font-medium transition ${
              activeTab === 'search'
                ? 'text-[#FFD700] border-b-2 border-[#FFD700]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🔍 搜尋修復
          </button>
        </div>

        {/* ========== UNKNOWN 歌手列表 ========== */}
        {activeTab === 'unknown' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">
                待修復譜（{unknownTabs.length} 首）
              </h2>
              <button
                onClick={loadData}
                className="text-sm text-gray-400 hover:text-white transition"
              >
                🔄 刷新
              </button>
            </div>
            
            {unknownTabs.length === 0 ? (
              <div className="text-center py-12 bg-[#121212] rounded-xl border border-gray-800">
                <div className="text-4xl mb-4">✅</div>
                <h3 className="text-white font-medium mb-2">沒有待修復的譜</h3>
                <p className="text-gray-400 text-sm">所有歌曲都已正確分配歌手</p>
              </div>
            ) : (
              <div className="space-y-3">
                {unknownTabs.map(tab => (
                  <div
                    key={tab.id}
                    className={`bg-[#121212] rounded-lg border ${
                      editingTab?.id === tab.id 
                        ? 'border-[#FFD700]' 
                        : 'border-gray-800'
                    } overflow-hidden`}
                  >
                    {/* 顯示模式 */}
                    {editingTab?.id !== tab.id ? (
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium truncate mb-1">
                            {tab.title || '(無標題)'}
                          </h3>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-red-400 bg-red-400/10 px-2 py-0.5 rounded text-xs">
                              UNKNOWN
                            </span>
                            <span className="text-gray-500">ID: {tab.id}</span>
                          </div>
                          {tab.content && (
                            <p className="text-gray-600 text-xs mt-2 line-clamp-2">
                              {tab.content.substring(0, 100)}...
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => startEditTab(tab)}
                            className="px-3 py-1.5 bg-[#FFD700] text-black rounded text-sm font-medium hover:bg-yellow-400 transition"
                          >
                            編輯
                          </button>
                          <button
                            onClick={() => router.push(`/tabs/${tab.id}`)}
                            className="px-3 py-1.5 bg-[#282828] text-white rounded text-sm hover:bg-[#3E3E3E] transition"
                          >
                            查看
                          </button>
                          <button
                            onClick={() => deleteTab(tab)}
                            className="px-3 py-1.5 bg-red-900/50 text-red-400 rounded text-sm hover:bg-red-900 transition"
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* 編輯模式 */
                      <div className="p-4">
                        <div className="mb-4 p-3 bg-black rounded-lg">
                          <p className="text-gray-500 text-xs mb-1">原始標題：</p>
                          <p className="text-white font-medium">{tab.title}</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              歌手名 <span className="text-[#FFD700]">*</span>
                            </label>
                            <input
                              type="text"
                              value={editForm.artist}
                              onChange={(e) => setEditForm(prev => ({ ...prev, artist: e.target.value }))}
                              placeholder="例如：陳奕迅"
                              className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFD700] focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              歌名 <span className="text-[#FFD700]">*</span>
                            </label>
                            <input
                              type="text"
                              value={editForm.title}
                              onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                              placeholder="例如：十年"
                              className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFD700] focus:outline-none"
                            />
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={autoParse}
                            className="px-3 py-1.5 bg-blue-900/50 text-blue-400 rounded text-sm hover:bg-blue-900 transition"
                          >
                            🔄 自動解析
                          </button>
                          <button
                            onClick={saveFix}
                            disabled={isFixing || !editForm.artist.trim() || !editForm.title.trim()}
                            className="px-4 py-1.5 bg-[#FFD700] text-black rounded text-sm font-medium hover:bg-yellow-400 transition disabled:opacity-50"
                          >
                            {isFixing ? '保存中...' : '✅ 確認修復'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========== 搜尋修復 ========== */}
        {activeTab === 'search' && (
          <div>
            {/* 預設修復選項 */}
            <div className="mb-6">
              <h2 className="text-lg font-medium text-white mb-3">快速修復（預設歌手）</h2>
              <div className="flex flex-wrap gap-2">
                {KNOWN_ARTIST_FIXES.map(fix => (
                  <button
                    key={fix.artistId}
                    onClick={() => searchForFix(fix)}
                    disabled={isFixing}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      selectedFix?.artistId === fix.artistId
                        ? 'bg-[#FFD700] text-black'
                        : 'bg-[#282828] text-white hover:bg-[#3E3E3E]'
                    }`}
                  >
                    {fix.correctName}
                  </button>
                ))}
              </div>
            </div>

            {/* 手動搜尋 */}
            <div className="mb-6">
              <h2 className="text-lg font-medium text-white mb-3">手動搜尋</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="manualSearch"
                  placeholder="輸入歌手名或關鍵字..."
                  className="flex-1 px-4 py-2 bg-[#121212] border border-gray-800 rounded-lg text-white"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      manualSearch(e.target.value)
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.getElementById('manualSearch')
                    if (input.value) manualSearch(input.value)
                  }}
                  className="px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium"
                >
                  搜尋
                </button>
              </div>
            </div>

            {/* 搜尋結果 */}
            {searchResults.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-medium text-white">
                    搜尋結果（{searchResults.length} 首）
                  </h2>
                  <button
                    onClick={executeFix}
                    disabled={isFixing}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {isFixing ? '修復中...' : `一鍵修復為「${selectedFix?.correctName}」`}
                  </button>
                </div>
                
                <div className="space-y-2">
                  {searchResults.map(tab => (
                    <div
                      key={tab.id}
                      className="bg-[#121212] rounded-lg p-4 border border-gray-800 flex items-center justify-between"
                    >
                      <div>
                        <h3 className="text-white font-medium">{tab.title}</h3>
                        <p className="text-sm text-gray-500">
                          現時歌手：{tab.artist || 'UNKNOWN'} | ID: {tab.id}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => quickFixTab(tab, selectedFix.correctName)}
                          disabled={isFixing}
                          className="px-3 py-1.5 bg-[#FFD700] text-black rounded text-sm font-medium hover:bg-yellow-400 transition"
                        >
                          修復
                        </button>
                        <button
                          onClick={() => router.push(`/tabs/${tab.id}`)}
                          className="px-3 py-1.5 bg-[#282828] text-white rounded text-sm hover:bg-[#3E3E3E] transition"
                        >
                          查看
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 日誌 */}
        {logs.length > 0 && (
          <div className="bg-[#121212] rounded-xl border border-gray-800 mt-6">
            <div className="p-3 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-medium text-white">處理日誌</h3>
              <button
                onClick={() => setLogs([])}
                className="text-xs text-gray-500 hover:text-white"
              >
                清除
              </button>
            </div>
            <div className="p-3 max-h-64 overflow-y-auto font-mono text-sm space-y-1">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={`${
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-green-400' :
                    log.type === 'warning' ? 'text-yellow-400' :
                    'text-gray-300'
                  }`}
                >
                  <span className="text-gray-600">[{log.time}]</span> {log.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 說明 */}
        <div className="mt-6 bg-[#1a1a2e] rounded-xl p-4 border border-blue-900/50">
          <h3 className="text-blue-300 font-medium mb-2">💡 使用說明</h3>
          <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
            <li><b>UNKNOWN 歌手</b>：顯示所有未分配歌手的譜，點擊「編輯」手動輸入</li>
            <li>點擊「🔄 自動解析」會嘗試從標題自動分出歌手和歌名</li>
            <li>常見格式：「歌手 - 歌名」、「歌名 by 歌手」都可以自動識別</li>
            <li>修復後會自動創建歌手（如果不存在）</li>
            <li>垃圾數據可以點擊「刪除」直接移除</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

export default function FixArtistGuard() {
  return (
    <AdminGuard>
      <FixArtistPage />
    </AdminGuard>
  )
}

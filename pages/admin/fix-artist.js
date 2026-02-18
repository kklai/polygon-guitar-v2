import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { getAllTabs, getAllArtists } from '@/lib/tabs'
import { updateDoc, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// 常見錯誤歌手名對照表
const KNOWN_ARTIST_FIXES = [
  { searchTerms: ['新青年', '理髮廳', '新青年理髮'], correctName: '新青年理髮廳', artistId: 'new-youth-barber', type: 'group' },
  { searchTerms: ['per se'], correctName: 'per se', artistId: 'per-se', type: 'group' },
  { searchTerms: ['serrini', '樹妮妮'], correctName: 'Serrini', artistId: 'serrini', type: 'female' },
  { searchTerms: ['iii', 'ian chan', 'ianchan'], correctName: 'Ian 陳卓賢', artistId: 'ian-chan', type: 'male' }
]

function FixArtistPage() {
  const router = useRouter()
  const [tabs, setTabs] = useState([])
  const [artists, setArtists] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('unknown')
  const [selectedFix, setSelectedFix] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [isFixing, setIsFixing] = useState(false)
  const [logs, setLogs] = useState([])
  
  // UNKNOWN 歌手列表
  const [unknownTabs, setUnknownTabs] = useState([])
  const [editingTab, setEditingTab] = useState(null)
  const [editForm, setEditForm] = useState({ artist: '', title: '' })
  
  // 批量解析相關
  const [batchResults, setBatchResults] = useState([])
  const [showBatchPreview, setShowBatchPreview] = useState(false)
  const [isBatchProcessing, setIsBatchProcessing] = useState(false)
  const [batchStats, setBatchStats] = useState({ total: 0, success: 0, failed: 0, skipped: 0 })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [tabsData, artistsData] = await Promise.all([getAllTabs(), getAllArtists()])
      setTabs(tabsData)
      setArtists(artistsData)
      
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

  // ========== 解析標題功能 ==========
  
  const parseTitle = (title) => {
    if (!title) return { artist: '', title: '', confidence: 0 }
    
    // 格式 1: "歌手 - 歌名" （最常見）
    let match = title.match(/^(.+?)\s*[-–—]\s*(.+)$/)
    if (match) {
      const artist = match[1].trim()
      const songTitle = match[2].trim()
      // 如果歌手部分太短，可能是格式反了
      if (artist.length >= 2) {
        return { artist, title: songTitle, confidence: 90 }
      }
    }
    
    // 格式 2: "歌手 | 歌名"
    match = title.match(/^(.+?)\s*\|\s*(.+)$/)
    if (match) {
      return { artist: match[1].trim(), title: match[2].trim(), confidence: 85 }
    }
    
    // 格式 3: "歌名 by 歌手"
    match = title.match(/^(.+?)\s+by\s+(.+)$/i)
    if (match) {
      return { artist: match[2].trim(), title: match[1].trim(), confidence: 80 }
    }
    
    // 格式 4: 包含 "cover" 或 "結他譜" 等關鍵詞
    const cleanTitle = title.replace(/\s*(cover|結他譜|guitar|tab|chord).*$/i, '').trim()
    if (cleanTitle !== title && cleanTitle.length > 0) {
      // 嘗試重新解析清理後的標題
      const retry = parseTitle(cleanTitle)
      if (retry.confidence > 0) return retry
    }
    
    // 格式 5: "歌名 - 歌手" （反過來的格式）
    // 如果只有一個 -，且後面部分看起來像歌手（較短）
    const parts = title.split(/\s*[-–—]\s/)
    if (parts.length === 2) {
      const [part1, part2] = parts
      // 如果第二部分比第一部分短，可能是歌手
      if (part2.length < part1.length && part2.length >= 2 && part2.length <= 20) {
        return { artist: part2.trim(), title: part1.trim(), confidence: 60 }
      }
    }
    
    return { artist: '', title: title, confidence: 0 }
  }

  // ========== 批量自動解析 ==========
  
  const runBatchParse = () => {
    const results = unknownTabs.map(tab => {
      const parsed = parseTitle(tab.title)
      return {
        tabId: tab.id,
        originalTitle: tab.title,
        parsedArtist: parsed.artist,
        parsedTitle: parsed.title,
        confidence: parsed.confidence,
        willFix: parsed.confidence >= 60 && parsed.artist.length >= 2
      }
    })
    
    setBatchResults(results)
    setShowBatchPreview(true)
    
    const willFixCount = results.filter(r => r.willFix).length
    addLog(`批量解析完成：${willFixCount}/${results.length} 首可以自動修復`, 'info')
  }
  
  const executeBatchFix = async () => {
    const toFix = batchResults.filter(r => r.willFix)
    if (toFix.length === 0) return
    
    setIsBatchProcessing(true)
    setBatchStats({ total: toFix.length, success: 0, failed: 0, skipped: 0 })
    
    let success = 0, failed = 0
    const fixedIds = new Set()
    
    for (const item of toFix) {
      try {
        const artistId = item.parsedArtist.toLowerCase().replace(/\s+/g, '-')
        
        // 創建/更新歌手
        const artistRef = doc(db, 'artists', artistId)
        const artistSnap = await getDoc(artistRef)
        
        if (!artistSnap.exists()) {
          await setDoc(artistRef, {
            name: item.parsedArtist,
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
        } else {
          const currentCount = artistSnap.data().songCount || 0
          await updateDoc(artistRef, {
            songCount: currentCount + 1,
            tabCount: currentCount + 1,
            updatedAt: new Date().toISOString()
          })
        }
        
        // 更新歌曲
        await updateDoc(doc(db, 'tabs', item.tabId), {
          artist: item.parsedArtist,
          artistId: artistId,
          artistSlug: artistId,
          artistName: item.parsedArtist,
          title: item.parsedTitle,
          updatedAt: new Date().toISOString()
        })
        
        success++
        fixedIds.add(item.tabId)
        addLog(`✅ 已修復：${item.parsedArtist} - ${item.parsedTitle}`, 'success')
        
      } catch (error) {
        failed++
        addLog(`❌ 失敗：${item.originalTitle} - ${error.message}`, 'error')
      }
      
      setBatchStats(prev => ({ ...prev, success, failed }))
    }
    
    // 從列表移除已修復的
    setUnknownTabs(prev => prev.filter(t => !fixedIds.has(t.id)))
    setBatchStats({ total: toFix.length, success, failed, skipped: 0 })
    setIsBatchProcessing(false)
    
    addLog(`\n批量修復完成！成功：${success}，失敗：${failed}`, 'success')
    
    // 關閉預覽
    setTimeout(() => {
      setShowBatchPreview(false)
      setBatchResults([])
    }, 2000)
  }

  // ========== 單個編輯功能 ==========
  
  const startEditTab = (tab) => {
    setEditingTab(tab)
    const parsed = parseTitle(tab.title)
    setEditForm({
      artist: parsed.artist || '',
      title: parsed.title || tab.title || ''
    })
  }
  
  const cancelEdit = () => {
    setEditingTab(null)
    setEditForm({ artist: '', title: '' })
  }
  
  const autoParse = () => {
    if (!editingTab) return
    const parsed = parseTitle(editingTab.title)
    setEditForm({
      artist: parsed.artist || '',
      title: parsed.title || editingTab.title || ''
    })
    addLog(`嘗試解析：「${editingTab.title}」→ 信心度 ${parsed.confidence}%`, 'info')
  }
  
  const saveFix = async () => {
    if (!editingTab || !editForm.artist.trim() || !editForm.title.trim()) {
      alert('請輸入歌手名和歌名')
      return
    }
    
    setIsFixing(true)
    try {
      const artistId = editForm.artist.toLowerCase().replace(/\s+/g, '-')
      
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
        const currentCount = artistSnap.data().songCount || 0
        await updateDoc(artistRef, {
          songCount: currentCount + 1,
          tabCount: currentCount + 1,
          updatedAt: new Date().toISOString()
        })
      }
      
      await updateDoc(doc(db, 'tabs', editingTab.id), {
        artist: editForm.artist,
        artistId: artistId,
        artistSlug: artistId,
        artistName: editForm.artist,
        title: editForm.title,
        updatedAt: new Date().toISOString()
      })
      
      addLog(`✅ 已修復：${editForm.artist} - ${editForm.title}`, 'success')
      setUnknownTabs(prev => prev.filter(t => t.id !== editingTab.id))
      setEditingTab(null)
      setEditForm({ artist: '', title: '' })
      
    } catch (error) {
      addLog(`❌ 錯誤：${error.message}`, 'error')
    } finally {
      setIsFixing(false)
    }
  }
  
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

  // ========== 搜尋修復功能 ==========

  const searchForFix = (fixConfig) => {
    setSelectedFix(fixConfig)
    const results = tabs.filter(tab => {
      const title = (tab.title || '').toLowerCase()
      const artist = (tab.artist || '').toLowerCase()
      return fixConfig.searchTerms.some(term => `${title} ${artist}`.includes(term.toLowerCase()))
    })
    setSearchResults(results)
    addLog(`搜尋「${fixConfig.correctName}」：找到 ${results.length} 首歌曲`, 'info')
  }

  const manualSearch = (searchTerm) => {
    const results = tabs.filter(tab => {
      const searchText = `${(tab.title || '').toLowerCase()} ${(tab.artist || '').toLowerCase()}`
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
            <button onClick={() => router.push('/admin')} className="text-[#B3B3B3] hover:text-white transition">
              返回後台
            </button>
          </div>
        </div>

        {/* Tab 切換 */}
        <div className="flex border-b border-gray-800 mb-6">
          <button
            onClick={() => setActiveTab('unknown')}
            className={`px-6 py-3 text-sm font-medium transition ${
              activeTab === 'unknown' ? 'text-[#FFD700] border-b-2 border-[#FFD700]' : 'text-gray-400 hover:text-white'
            }`}
          >
            🚨 UNKNOWN 歌手 ({unknownTabs.length})
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-6 py-3 text-sm font-medium transition ${
              activeTab === 'search' ? 'text-[#FFD700] border-b-2 border-[#FFD700]' : 'text-gray-400 hover:text-white'
            }`}
          >
            🔍 搜尋修復
          </button>
        </div>

        {/* ========== UNKNOWN 歌手列表 ========== */}
        {activeTab === 'unknown' && (
          <div>
            {/* 批量操作區 */}
            {unknownTabs.length > 0 && !showBatchPreview && (
              <div className="mb-6 p-4 bg-[#1a1a2e] rounded-xl border border-blue-900/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-blue-300 font-medium mb-1">⚡ 批量自動解析</h3>
                    <p className="text-sm text-gray-400">
                      系統會嘗試從標題自動分出歌手和歌名（支援「歌手 - 歌名」、「歌名 by 歌手」等格式）
                    </p>
                  </div>
                  <button
                    onClick={runBatchParse}
                    className="px-6 py-3 bg-[#FFD700] text-black rounded-lg font-medium hover:bg-yellow-400 transition flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    批量自動解析 ({unknownTabs.length} 首)
                  </button>
                </div>
              </div>
            )}
            
            {/* 批量預覽 */}
            {showBatchPreview && (
              <div className="mb-6 bg-[#121212] rounded-xl border border-[#FFD700] overflow-hidden">
                <div className="p-4 border-b border-gray-800 bg-[#FFD700]/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[#FFD700] font-medium mb-1">批量解析預覽</h3>
                      <p className="text-sm text-gray-400">
                        將修復 {batchResults.filter(r => r.willFix).length} / {batchResults.length} 首歌曲
                        （信心度 ≥60% 才會自動修復）
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowBatchPreview(false)}
                        className="px-4 py-2 text-gray-400 hover:text-white transition"
                      >
                        取消
                      </button>
                      <button
                        onClick={executeBatchFix}
                        disabled={isBatchProcessing || batchResults.filter(r => r.willFix).length === 0}
                        className="px-6 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:bg-yellow-400 transition disabled:opacity-50"
                      >
                        {isBatchProcessing ? `處理中... ${batchStats.success}/${batchStats.total}` : '確認批量修復'}
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-black sticky top-0">
                      <tr>
                        <th className="text-left p-3 text-gray-400 font-medium">原始標題</th>
                        <th className="text-left p-3 text-gray-400 font-medium">解析結果</th>
                        <th className="text-center p-3 text-gray-400 font-medium">信心度</th>
                        <th className="text-center p-3 text-gray-400 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {batchResults.map((item, index) => (
                        <tr key={item.tabId} className={item.willFix ? 'bg-green-900/10' : 'bg-red-900/5'}>
                          <td className="p-3 text-white max-w-xs truncate">{item.originalTitle}</td>
                          <td className="p-3">
                            {item.willFix ? (
                              <div>
                                <div className="text-green-400 font-medium">{item.parsedArtist}</div>
                                <div className="text-gray-400 text-xs">{item.parsedTitle}</div>
                              </div>
                            ) : (
                              <span className="text-red-400 text-xs">無法自動解析</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded text-xs ${
                              item.confidence >= 80 ? 'bg-green-900/50 text-green-400' :
                              item.confidence >= 60 ? 'bg-yellow-900/50 text-yellow-400' :
                              'bg-red-900/50 text-red-400'
                            }`}>
                              {item.confidence}%
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {item.willFix ? (
                              <span className="text-green-400 text-xs">✓ 將修復</span>
                            ) : (
                              <button
                                onClick={() => {
                                  const tab = unknownTabs.find(t => t.id === item.tabId)
                                  if (tab) startEditTab(tab)
                                }}
                                className="text-[#FFD700] text-xs hover:underline"
                              >
                                手動編輯
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* 列表標題 */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">
                待修復譜（{unknownTabs.length} 首）
              </h2>
              <button onClick={loadData} className="text-sm text-gray-400 hover:text-white transition">
                🔄 刷新
              </button>
            </div>
            
            {unknownTabs.length === 0 ? (
              <div className="text-center py-12 bg-[#121212] rounded-xl border border-gray-800">
                <div className="text-4xl mb-4">✅</div>
                <h3 className="text-white font-medium mb-2">沒有待修復的譜</h3>
                <p className="text-gray-400 text-sm">所有歌曲都已正確分配歌手</p>
              </div>
            ) : !showBatchPreview && (
              <div className="space-y-3">
                {unknownTabs.map(tab => (
                  <div
                    key={tab.id}
                    className={`bg-[#121212] rounded-lg border ${
                      editingTab?.id === tab.id ? 'border-[#FFD700]' : 'border-gray-800'
                    } overflow-hidden`}
                  >
                    {editingTab?.id !== tab.id ? (
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium truncate mb-1">{tab.title || '(無標題)'}</h3>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-red-400 bg-red-400/10 px-2 py-0.5 rounded text-xs">UNKNOWN</span>
                            <span className="text-gray-500">ID: {tab.id}</span>
                          </div>
                          {tab.content && (
                            <p className="text-gray-600 text-xs mt-2 line-clamp-2">{tab.content.substring(0, 100)}...</p>
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
                      <div className="p-4">
                        <div className="mb-4 p-3 bg-black rounded-lg">
                          <p className="text-gray-500 text-xs mb-1">原始標題：</p>
                          <p className="text-white font-medium">{tab.title}</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">歌手名 <span className="text-[#FFD700]">*</span></label>
                            <input
                              type="text"
                              value={editForm.artist}
                              onChange={(e) => setEditForm(prev => ({ ...prev, artist: e.target.value }))}
                              placeholder="例如：陳奕迅"
                              className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFD700] focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">歌名 <span className="text-[#FFD700]">*</span></label>
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
                          <button onClick={autoParse} className="px-3 py-1.5 bg-blue-900/50 text-blue-400 rounded text-sm hover:bg-blue-900 transition">
                            🔄 自動解析
                          </button>
                          <button
                            onClick={saveFix}
                            disabled={isFixing || !editForm.artist.trim() || !editForm.title.trim()}
                            className="px-4 py-1.5 bg-[#FFD700] text-black rounded text-sm font-medium hover:bg-yellow-400 transition disabled:opacity-50"
                          >
                            {isFixing ? '保存中...' : '✅ 確認修復'}
                          </button>
                          <button onClick={cancelEdit} className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition">
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
            <div className="mb-6">
              <h2 className="text-lg font-medium text-white mb-3">快速修復（預設歌手）</h2>
              <div className="flex flex-wrap gap-2">
                {KNOWN_ARTIST_FIXES.map(fix => (
                  <button
                    key={fix.artistId}
                    onClick={() => searchForFix(fix)}
                    disabled={isFixing}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      selectedFix?.artistId === fix.artistId ? 'bg-[#FFD700] text-black' : 'bg-[#282828] text-white hover:bg-[#3E3E3E]'
                    }`}
                  >
                    {fix.correctName}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-medium text-white mb-3">手動搜尋</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="manualSearch"
                  placeholder="輸入歌手名或關鍵字..."
                  className="flex-1 px-4 py-2 bg-[#121212] border border-gray-800 rounded-lg text-white"
                  onKeyPress={(e) => e.key === 'Enter' && manualSearch(e.target.value)}
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

            {searchResults.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-medium text-white">搜尋結果（{searchResults.length} 首）</h2>
                </div>
                <div className="space-y-2">
                  {searchResults.map(tab => (
                    <div key={tab.id} className="bg-[#121212] rounded-lg p-4 border border-gray-800 flex items-center justify-between">
                      <div>
                        <h3 className="text-white font-medium">{tab.title}</h3>
                        <p className="text-sm text-gray-500">現時歌手：{tab.artist || 'UNKNOWN'} | ID: {tab.id}</p>
                      </div>
                      <div className="flex gap-2">
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
              <button onClick={() => setLogs([])} className="text-xs text-gray-500 hover:text-white">清除</button>
            </div>
            <div className="p-3 max-h-64 overflow-y-auto font-mono text-sm space-y-1">
              {logs.map((log, i) => (
                <div key={i} className={`${
                  log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'warning' ? 'text-yellow-400' : 'text-gray-300'
                }`}>
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
            <li><b>批量自動解析</b>：點擊按鈕，系統會嘗試從所有標題自動分出歌手和歌名</li>
            <li>信心度 ≥60% 的譜會標記為「將修復」，其餘的需要手動處理</li>
            <li>支援格式：「歌手 - 歌名」、「歌手 | 歌名」、「歌名 by 歌手」</li>
            <li>預覽後點擊「確認批量修復」才會真正更新數據庫</li>
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

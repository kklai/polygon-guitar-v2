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
  const [batchStats, setBatchStats] = useState({ total: 0, success: 0, failed: 0 })
  const [editingBatchItem, setEditingBatchItem] = useState(null) // 正在編輯的批量項目

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
  
  const parseTitle = (title, knownArtists = []) => {
    if (!title) return { artist: '', title: '', confidence: 0 }
    
    const cleanTitle = title.replace(/\s*(cover|結他譜|guitar|tab|chord|ukulele|視譜|audio).*$/i, '').trim()
    const workingTitle = cleanTitle || title
    
    // 格式 1: "歌手 - 歌名"
    let match = workingTitle.match(/^(.+?)\s*[-–—]\s*(.+)$/)
    if (match) {
      const artist = match[1].trim()
      const songTitle = match[2].trim()
      if (artist.length >= 2) return { artist, title: songTitle, confidence: 90 }
    }
    
    // 格式 2: "歌手 | 歌名"
    match = workingTitle.match(/^(.+?)\s*\|\s*(.+)$/)
    if (match) return { artist: match[1].trim(), title: match[2].trim(), confidence: 85 }
    
    // 格式 3: "歌名 by 歌手"
    match = workingTitle.match(/^(.+?)\s+by\s+(.+)$/i)
    if (match) return { artist: match[2].trim(), title: match[1].trim(), confidence: 80 }
    
    // 格式 4: 空格分隔（無其他符號）
    if (!workingTitle.match(/[-–—|]/)) {
      const spaceParts = workingTitle.split(/\s+/)
      
      if (spaceParts.length >= 2) {
        const firstPart = spaceParts[0]
        const secondPart = spaceParts[1]
        const restParts = spaceParts.slice(2)
        
        // 嘗試 1: 檢查已知歌手列表
        const matchedArtist = knownArtists.find(a => 
          a.name === firstPart || a.name.includes(firstPart) || firstPart.includes(a.name)
        )
        if (matchedArtist) {
          return { artist: matchedArtist.name, title: [secondPart, ...restParts].join(' '), confidence: 85 }
        }
        
        // 嘗試 2: 第二部分匹配已知歌手
        const matchedArtist2 = knownArtists.find(a => 
          a.name === secondPart || a.name.includes(secondPart) || secondPart.includes(a.name)
        )
        if (matchedArtist2) {
          return { artist: matchedArtist2.name, title: firstPart, confidence: 75 }
        }
        
        // 嘗試 3: 智能推斷
        const firstCharCount = (firstPart.match(/[\u4e00-\u9fa5]/g) || []).length
        const secondCharCount = (secondPart.match(/[\u4e00-\u9fa5]/g) || []).length
        
        if (firstCharCount >= 2 && firstCharCount <= 4 && secondCharCount >= 1) {
          return { artist: firstPart, title: [secondPart, ...restParts].join(' '), confidence: 70 }
        }
        
        if (secondCharCount >= 2 && secondCharCount <= 4) {
          return { artist: [secondPart, ...restParts].join(' '), title: firstPart, confidence: 65 }
        }
        
        if (firstPart.length >= 2) {
          return { artist: firstPart, title: [secondPart, ...restParts].join(' '), confidence: 50 }
        }
      }
    }
    
    // 格式 5: "歌名 - 歌手"
    const parts = workingTitle.split(/\s*[-–—]\s/)
    if (parts.length === 2) {
      const [part1, part2] = parts
      if (part2.length < part1.length && part2.length >= 2 && part2.length <= 20) {
        return { artist: part2.trim(), title: part1.trim(), confidence: 60 }
      }
    }
    
    return { artist: '', title: workingTitle, confidence: 0 }
  }

  // ========== 批量自動解析 ==========
  
  const runBatchParse = () => {
    const results = unknownTabs.map(tab => {
      const parsed = parseTitle(tab.title, artists)
      return {
        tabId: tab.id,
        originalTitle: tab.title,
        parsedArtist: parsed.artist,
        parsedTitle: parsed.title,
        confidence: parsed.confidence,
        selected: parsed.confidence >= 50 && parsed.artist.length >= 2, // 默認選中
        content: tab.content || '' // 加入內容預覽
      }
    })
    
    setBatchResults(results)
    setShowBatchPreview(true)
    addLog(`批量解析完成：${results.filter(r => r.selected).length}/${results.length} 首默認選中`, 'info')
  }
  
  // 切換選中狀態
  const toggleSelection = (index) => {
    setBatchResults(prev => prev.map((item, i) => 
      i === index ? { ...item, selected: !item.selected } : item
    ))
  }
  
  // 全選
  const selectAll = () => {
    setBatchResults(prev => prev.map(item => ({ ...item, selected: true })))
  }
  
  // 全不選
  const deselectAll = () => {
    setBatchResults(prev => prev.map(item => ({ ...item, selected: false })))
  }
  
  // 反選
  const invertSelection = () => {
    setBatchResults(prev => prev.map(item => ({ ...item, selected: !item.selected })))
  }
  
  // 開始編輯批量項目
  const startEditBatchItem = (index) => {
    setEditingBatchItem(index)
  }
  
  // 更新批量項目的歌手/歌名
  const updateBatchItem = (index, field, value) => {
    setBatchResults(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ))
  }
  
  // 保存批量項目編輯
  const saveBatchItemEdit = () => {
    setEditingBatchItem(null)
  }
  
  // 取消批量項目編輯
  const cancelBatchItemEdit = () => {
    setEditingBatchItem(null)
  }
  
  const executeBatchFix = async () => {
    const toFix = batchResults.filter(r => r.selected)
    if (toFix.length === 0) {
      alert('請至少選擇一項進行修復')
      return
    }
    
    if (!confirm(`確定要修復 ${toFix.length} 首歌曲嗎？`)) return
    
    setIsBatchProcessing(true)
    setBatchStats({ total: toFix.length, success: 0, failed: 0 })
    
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
      
      setBatchStats({ total: toFix.length, success, failed })
    }
    
    // 從列表移除已修復的
    setUnknownTabs(prev => prev.filter(t => !fixedIds.has(t.id)))
    setIsBatchProcessing(false)
    
    addLog(`\n批量修復完成！成功：${success}，失敗：${failed}`, 'success')
    
    // 關閉預覽
    setTimeout(() => {
      setShowBatchPreview(false)
      setBatchResults([])
    }, 2000)
  }
  
  // 批量刪除選中的項目
  const executeBatchDelete = async () => {
    const toDelete = batchResults.filter(r => r.selected)
    if (toDelete.length === 0) {
      alert('請至少選擇一項進行刪除')
      return
    }
    
    if (!confirm(`⚠️ 警告：確定要刪除 ${toDelete.length} 首歌曲嗎？\n此操作不可撤銷！`)) return
    
    setIsBatchProcessing(true)
    setBatchStats({ total: toDelete.length, success: 0, failed: 0 })
    
    let success = 0, failed = 0
    const deletedIds = new Set()
    
    for (const item of toDelete) {
      try {
        await deleteDoc(doc(db, 'tabs', item.tabId))
        success++
        deletedIds.add(item.tabId)
        addLog(`🗑️ 已刪除：${item.originalTitle}`, 'warning')
      } catch (error) {
        failed++
        addLog(`❌ 刪除失敗：${item.originalTitle} - ${error.message}`, 'error')
      }
      
      setBatchStats({ total: toDelete.length, success, failed })
    }
    
    // 從列表移除已刪除的
    setUnknownTabs(prev => prev.filter(t => !deletedIds.has(t.id)))
    setIsBatchProcessing(false)
    
    addLog(`\n批量刪除完成！成功：${success}，失敗：${failed}`, 'success')
    
    // 更新 batchResults
    setBatchResults(prev => prev.filter(r => !deletedIds.has(r.tabId)))
    
    if (success === toDelete.length) {
      setTimeout(() => {
        setShowBatchPreview(false)
        setBatchResults([])
      }, 1500)
    }
  }
  
  // 單個刪除（在預覽中）
  const deleteSingleFromBatch = async (index) => {
    const item = batchResults[index]
    if (!confirm(`確定要刪除「${item.originalTitle}」嗎？`)) return
    
    try {
      await deleteDoc(doc(db, 'tabs', item.tabId))
      addLog(`🗑️ 已刪除：${item.originalTitle}`, 'warning')
      
      // 從列表移除
      setBatchResults(prev => prev.filter((_, i) => i !== index))
      setUnknownTabs(prev => prev.filter(t => t.id !== item.tabId))
    } catch (error) {
      addLog(`❌ 刪除失敗：${error.message}`, 'error')
    }
  }

  // ========== 單個編輯功能 ==========
  
  const startEditTab = (tab) => {
    setEditingTab(tab)
    const parsed = parseTitle(tab.title, artists)
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
    const parsed = parseTitle(editingTab.title, artists)
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
                      系統會嘗試從標題自動分出歌手和歌名，你可以在預覽中勾選要修復的項目
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
            
            {/* 批量預覽 - 全新設計 */}
            {showBatchPreview && (
              <div className="mb-6 bg-[#121212] rounded-xl border border-[#FFD700] overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-800 bg-[#FFD700]/5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-[#FFD700] font-medium mb-1">批量解析預覽</h3>
                      <p className="text-sm text-gray-400">
                        已選中 {batchResults.filter(r => r.selected).length} / {batchResults.length} 首歌曲
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={selectAll} className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition">
                        全選
                      </button>
                      <button onClick={deselectAll} className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition">
                        全不選
                      </button>
                      <button onClick={invertSelection} className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition">
                        反選
                      </button>
                      <button
                        onClick={() => setShowBatchPreview(false)}
                        className="px-4 py-1.5 text-gray-400 hover:text-white transition"
                      >
                        取消
                      </button>
                      <button
                        onClick={executeBatchDelete}
                        disabled={isBatchProcessing || batchResults.filter(r => r.selected).length === 0}
                        className="px-4 py-1.5 bg-red-900/70 text-red-400 rounded-lg font-medium hover:bg-red-900 transition disabled:opacity-50"
                      >
                        🗑️ 刪除 ({batchResults.filter(r => r.selected).length})
                      </button>
                      <button
                        onClick={executeBatchFix}
                        disabled={isBatchProcessing || batchResults.filter(r => r.selected).length === 0}
                        className="px-6 py-1.5 bg-[#FFD700] text-black rounded-lg font-medium hover:bg-yellow-400 transition disabled:opacity-50"
                      >
                        {isBatchProcessing ? `處理中... ${batchStats.success}/${batchStats.total}` : `確認修復 (${batchResults.filter(r => r.selected).length})`}
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* 表格 */}
                <div className="max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-black sticky top-0 z-10">
                      <tr>
                        <th className="text-center p-3 text-gray-400 font-medium w-12">選</th>
                        <th className="text-left p-3 text-gray-400 font-medium">原始標題</th>
                        <th className="text-left p-3 text-gray-400 font-medium max-w-xs">內容預覽</th>
                        <th className="text-left p-3 text-gray-400 font-medium">歌手</th>
                        <th className="text-left p-3 text-gray-400 font-medium">歌名</th>
                        <th className="text-center p-3 text-gray-400 font-medium w-20">信心度</th>
                        <th className="text-center p-3 text-gray-400 font-medium w-24">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {batchResults.map((item, index) => (
                        <tr key={item.tabId} className={`${item.selected ? 'bg-green-900/10' : 'bg-gray-900/30'} hover:bg-gray-800/50 transition`}>
                          {/* 勾選框 */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => toggleSelection(index)}
                              className="w-4 h-4 accent-[#FFD700] cursor-pointer"
                            />
                          </td>
                          
                          {/* 原始標題 */}
                          <td className="p-3 text-white max-w-xs truncate" title={item.originalTitle}>
                            {item.originalTitle}
                          </td>
                          
                          {/* 內容預覽 */}
                          <td className="p-3 max-w-xs">
                            <div 
                              className="text-gray-500 text-xs line-clamp-2" 
                              title={item.content?.substring(0, 200)}
                            >
                              {item.content ? item.content.substring(0, 80).replace(/\n/g, ' ') : '(無內容)'}
                            </div>
                          </td>
                          
                          {/* 歌手 - 可編輯 */}
                          <td className="p-3">
                            {editingBatchItem === index ? (
                              <input
                                type="text"
                                value={item.parsedArtist}
                                onChange={(e) => updateBatchItem(index, 'parsedArtist', e.target.value)}
                                className="w-full px-2 py-1 bg-black border border-[#FFD700] rounded text-white text-sm"
                                autoFocus
                              />
                            ) : (
                              <div className={`${item.parsedArtist ? 'text-green-400' : 'text-red-400'} font-medium`}>
                                {item.parsedArtist || '(未識別)'}
                              </div>
                            )}
                          </td>
                          
                          {/* 歌名 - 可編輯 */}
                          <td className="p-3">
                            {editingBatchItem === index ? (
                              <input
                                type="text"
                                value={item.parsedTitle}
                                onChange={(e) => updateBatchItem(index, 'parsedTitle', e.target.value)}
                                className="w-full px-2 py-1 bg-black border border-[#FFD700] rounded text-white text-sm"
                              />
                            ) : (
                              <div className="text-gray-400 text-xs">
                                {item.parsedTitle}
                              </div>
                            )}
                          </td>
                          
                          {/* 信心度 */}
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded text-xs ${
                              item.confidence >= 80 ? 'bg-green-900/50 text-green-400' :
                              item.confidence >= 60 ? 'bg-yellow-900/50 text-yellow-400' :
                              item.confidence > 0 ? 'bg-orange-900/50 text-orange-400' :
                              'bg-red-900/50 text-red-400'
                            }`}>
                              {item.confidence}%
                            </span>
                          </td>
                          
                          {/* 操作 */}
                          <td className="p-3 text-center">
                            {editingBatchItem === index ? (
                              <div className="flex gap-1 justify-center">
                                <button
                                  onClick={saveBatchItemEdit}
                                  className="text-green-400 hover:text-green-300 text-xs px-1"
                                  title="保存"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={cancelBatchItemEdit}
                                  className="text-red-400 hover:text-red-300 text-xs px-1"
                                  title="取消"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={() => startEditBatchItem(index)}
                                  className="text-[#FFD700] hover:text-yellow-300 text-xs"
                                  disabled={!item.parsedArtist}
                                >
                                  編輯
                                </button>
                                <button
                                  onClick={() => router.push(`/tabs/${item.tabId}/edit`)}
                                  className="text-blue-400 hover:text-blue-300 text-xs"
                                  title="編輯整份譜"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => deleteSingleFromBatch(index)}
                                  className="text-red-400 hover:text-red-300 text-xs"
                                  title="刪除此項目"
                                >
                                  🗑️
                                </button>
                              </div>
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
                            onClick={() => router.push(`/tabs/${tab.id}/edit`)}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-500 transition"
                            title="編輯整份譜"
                          >
                            ✏️ 編譜
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
                              className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">歌名 <span className="text-[#FFD700]">*</span></label>
                            <input
                              type="text"
                              value={editForm.title}
                              onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                              placeholder="例如：十年"
                              className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm outline-none"
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
                          onClick={() => router.push(`/tabs/${tab.id}/edit`)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-500 transition"
                          title="編輯整份譜"
                        >
                          ✏️ 編譜
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
            <li><b>批量自動解析</b>：點擊按鈕後，在預覽中勾選要修復的項目</li>
            <li><b>內容預覽</b>：表格顯示每份譜的頭 80 個字，方便判斷係咪垃圾數據</li>
            <li><b>勾選/取消</b>：使用 checkbox 選擇要修復的譜，點「全選」「全不選」「反選」快速操作</li>
            <li><b>即時編輯</b>：點擊「編輯」可以直接修改解析出來的歌手名和歌名</li>
            <li><b>確認修復</b>：確認無誤後點擊「確認修復(n)」批量更新</li>
            <li><b>批量刪除</b>：選中垃圾數據後，點「刪除(n)」批量刪除，或點 🗑️ 單個刪除</li>
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

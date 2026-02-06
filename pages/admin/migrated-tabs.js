import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  getDoc,
  setDoc,
  increment,
  limit,
  orderBy
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import AdminGuard from '@/components/AdminGuard'
import Layout from '@/components/Layout'
import { searchArtistFromWikipedia } from '@/lib/wikipedia'

// 解析雙語歌手名
function parseBilingualName(artistName) {
  if (!artistName) return { preferred: '' };
  
  // 移除常見前綴
  const prefixes = ['MK三部曲', 'EP', 'Album', 'Single', '新歌', '新碟', '大碟', '專輯'];
  let cleanName = artistName;
  for (const prefix of prefixes) {
    const regex = new RegExp(`^${prefix}\\s*`, 'i');
    cleanName = cleanName.replace(regex, '');
  }
  
  cleanName = cleanName.trim();
  
  // 情況: "英文名 中文名" 或 "中文名 英文名"
  const mixedMatch = cleanName.match(/^([a-zA-Z\s]+)\s+([\u4e00-\u9fa5]{2,})$/);
  if (mixedMatch) {
    return {
      english: mixedMatch[1].trim(),
      chinese: mixedMatch[2].trim(),
      preferred: mixedMatch[2].trim()
    };
  }
  
  const mixedMatch2 = cleanName.match(/^([\u4e00-\u9fa5]{2,})\s+([a-zA-Z\s]+)$/);
  if (mixedMatch2) {
    return {
      chinese: mixedMatch2[1].trim(),
      english: mixedMatch2[2].trim(),
      preferred: mixedMatch2[1].trim()
    };
  }
  
  return { preferred: cleanName };
}

export default function MigratedTabsPage() {
  const { user } = useAuth()
  const [tabs, setTabs] = useState([])
  const [allTabs, setAllTabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selectedTab, setSelectedTab] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [message, setMessage] = useState(null)
  const [debugInfo, setDebugInfo] = useState(null)
  const [wikiData, setWikiData] = useState(null)
  const [searchingWiki, setSearchingWiki] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    blogger: 0,
    manual: 0,
    withIssues: 0,
    noArtistId: 0,
    noContent: 0,
    noArtistName: 0
  })

  // 獲取所有樂譜（用於統計和debug）
  const fetchAllTabs = async () => {
    try {
      // 獲取所有樂譜（不分source）
      const allSnapshot = await getDocs(collection(db, 'tabs'))
      const allData = allSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setAllTabs(allData)

      // 統計source分佈
      const bloggerCount = allData.filter(t => t.source === 'blogger').length
      const manualCount = allData.filter(t => t.source === 'manual' || !t.source).length
      const otherCount = allData.filter(t => t.source && t.source !== 'blogger' && t.source !== 'manual').length

      return { 
        total: allData.length, 
        blogger: bloggerCount, 
        manual: manualCount,
        other: otherCount,
        all: allData 
      }
    } catch (error) {
      console.error('獲取所有樂譜失敗:', error)
      return { total: 0, blogger: 0, manual: 0, other: 0, all: [] }
    }
  }

  // 獲取遷移的樂譜
  const fetchMigratedTabs = async () => {
    setLoading(true)
    try {
      // 先獲取所有樂譜統計
      const allStats = await fetchAllTabs()
      
      // 獲取blogger來源的樂譜
      const q = query(
        collection(db, 'tabs'),
        where('source', '==', 'blogger')
      )
      const snapshot = await getDocs(q)
      const tabsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        issues: []
      }))

      // 檢查問題
      let withIssues = 0
      let noArtistId = 0
      let noContent = 0
      let noArtistName = 0

      tabsData.forEach(tab => {
        const issues = []
        
        if (!tab.artistId) {
          issues.push('缺少 artistId')
          noArtistId++
        }
        if (!tab.artist) {
          issues.push('缺少歌手名')
          noArtistName++
        }
        if (!tab.content || tab.content.length < 10) {
          issues.push('內容過短或缺失')
          noContent++
        }
        if (!tab.title) {
          issues.push('缺少歌名')
        }

        tab.issues = issues
        if (issues.length > 0) withIssues++
      })

      // 按創建時間排序
      tabsData.sort((a, b) => {
        const dateA = a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(a.createdAt || 0)
        const dateB = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.createdAt || 0)
        return dateB - dateA
      })

      setTabs(tabsData)
      setStats({
        total: allStats.total,
        blogger: allStats.blogger,
        manual: allStats.manual,
        other: allStats.other,
        withIssues,
        noArtistId,
        noContent,
        noArtistName
      })

      // Debug 信息
      setDebugInfo({
        totalInDB: allStats.total,
        bloggerCount: tabsData.length,
        sampleSources: allStats.all.slice(0, 10).map(t => ({ 
          title: t.title?.substring(0, 20), 
          source: t.source,
          artistId: t.artistId 
        }))
      })

    } catch (error) {
      console.error('獲取樂譜失敗:', error)
      showMessage('獲取樂譜失敗: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMigratedTabs()
  }, [])

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  // 過濾樂譜
  const filteredTabs = tabs.filter(tab => {
    switch (filter) {
      case 'issues':
        return tab.issues.length > 0
      case 'noArtist':
        return !tab.artistId || !tab.artist
      case 'noContent':
        return !tab.content || tab.content.length < 10
      default:
        return true
    }
  })

  // 開始編輯
  const handleEdit = (tab) => {
    setSelectedTab(tab)
    setEditForm({
      title: tab.title || '',
      artist: tab.artist || '',
      content: tab.content || '',
      originalKey: tab.originalKey || 'C',
      capo: tab.capo || ''
    })
    setWikiData(null)
  }

  // 搜尋維基百科
  const handleWikiSearch = async () => {
    if (!editForm.artist) return
    
    setSearchingWiki(true)
    setWikiData(null)
    
    try {
      // 嘗試使用中文名搜尋
      const parsed = parseBilingualName(editForm.artist)
      const searchName = parsed.preferred || editForm.artist
      
      const data = await searchArtistFromWikipedia(searchName)
      
      if (data) {
        setWikiData(data)
        showMessage(`找到維基資料: ${data.name}`)
      } else {
        showMessage('未找到維基資料', 'error')
      }
    } catch (error) {
      console.error('搜尋失敗:', error)
      showMessage('搜尋失敗: ' + error.message, 'error')
    } finally {
      setSearchingWiki(false)
    }
  }

  // 應用維基資料
  const applyWikiData = () => {
    if (!wikiData) return
    
    setEditForm({
      ...editForm,
      artist: wikiData.name || editForm.artist
    })
    showMessage('已應用維基歌手名')
  }

  // 保存編輯
  const handleSave = async () => {
    if (!editForm.title || !editForm.artist) {
      showMessage('歌名和歌手名不能為空', 'error')
      return
    }

    try {
      const newArtistId = editForm.artist.toLowerCase().replace(/\s+/g, '-')
      const oldArtistId = selectedTab.artistId

      // 更新樂譜
      const tabRef = doc(db, 'tabs', selectedTab.id)
      await updateDoc(tabRef, {
        ...editForm,
        artistId: newArtistId,
        updatedAt: new Date().toISOString()
      })

      // 如果歌手變了，更新歌手計數
      if (oldArtistId !== newArtistId) {
        if (oldArtistId) {
          const oldArtistRef = doc(db, 'artists', oldArtistId)
          const oldArtistSnap = await getDoc(oldArtistRef)
          if (oldArtistSnap.exists()) {
            await updateDoc(oldArtistRef, {
              tabCount: increment(-1)
            })
          }
        }

        const newArtistRef = doc(db, 'artists', newArtistId)
        const newArtistSnap = await getDoc(newArtistRef)
        if (!newArtistSnap.exists()) {
          await setDoc(newArtistRef, {
            name: editForm.artist,
            normalizedName: newArtistId,
            tabCount: 1,
            createdAt: new Date().toISOString()
          })
        } else {
          await updateDoc(newArtistRef, {
            tabCount: increment(1)
          })
        }
      }

      showMessage('保存成功')
      setSelectedTab(null)
      setEditForm(null)
      fetchMigratedTabs()
    } catch (error) {
      console.error('保存失敗:', error)
      showMessage('保存失敗: ' + error.message, 'error')
    }
  }

  // 刪除樂譜
  const handleDelete = async (tab) => {
    if (!confirm(`確定要刪除「${tab.title} - ${tab.artist}」嗎？此操作不可恢復。`)) {
      return
    }

    try {
      if (tab.artistId) {
        const artistRef = doc(db, 'artists', tab.artistId)
        const artistSnap = await getDoc(artistRef)
        if (artistSnap.exists()) {
          await updateDoc(artistRef, {
            tabCount: increment(-1)
          })
        }
      }

      await deleteDoc(doc(db, 'tabs', tab.id))
      showMessage('刪除成功')
      fetchMigratedTabs()
    } catch (error) {
      console.error('刪除失敗:', error)
      showMessage('刪除失敗: ' + error.message, 'error')
    }
  }

  // 自動修復問題
  const handleAutoFix = async (tab) => {
    try {
      const updates = {}
      let fixed = []

      if (!tab.artistId && tab.artist) {
        const newArtistId = tab.artist.toLowerCase().replace(/\s+/g, '-')
        updates.artistId = newArtistId
        fixed.push('artistId')

        const artistRef = doc(db, 'artists', newArtistId)
        const artistSnap = await getDoc(artistRef)
        if (!artistSnap.exists()) {
          await setDoc(artistRef, {
            name: tab.artist,
            normalizedName: newArtistId,
            tabCount: 1,
            createdAt: new Date().toISOString()
          })
        }
      }

      if (!tab.artist && tab.artistId) {
        const artistRef = doc(db, 'artists', tab.artistId)
        const artistSnap = await getDoc(artistRef)
        if (artistSnap.exists()) {
          updates.artist = artistSnap.data().name
          fixed.push('artist')
        }
      }

      if (fixed.length > 0) {
        updates.updatedAt = new Date().toISOString()
        await updateDoc(doc(db, 'tabs', tab.id), updates)
        showMessage(`已修復: ${fixed.join(', ')}`)
        fetchMigratedTabs()
      } else {
        showMessage('無法自動修復，請手動編輯', 'error')
      }
    } catch (error) {
      console.error('修復失敗:', error)
      showMessage('修復失敗: ' + error.message, 'error')
    }
  }

  // 批量修復所有問題
  const handleFixAll = async () => {
    if (!confirm('確定要自動修復所有可修復的問題嗎？')) return

    let fixed = 0
    let failed = 0

    for (const tab of tabs.filter(t => t.issues.length > 0)) {
      try {
        const updates = {}
        let hasUpdate = false

        if (!tab.artistId && tab.artist) {
          const newArtistId = tab.artist.toLowerCase().replace(/\s+/g, '-')
          updates.artistId = newArtistId
          hasUpdate = true

          const artistRef = doc(db, 'artists', newArtistId)
          const artistSnap = await getDoc(artistRef)
          if (!artistSnap.exists()) {
            await setDoc(artistRef, {
              name: tab.artist,
              normalizedName: newArtistId,
              tabCount: 1,
              createdAt: new Date().toISOString()
            })
          }
        }

        if (hasUpdate) {
          updates.updatedAt = new Date().toISOString()
          await updateDoc(doc(db, 'tabs', tab.id), updates)
          fixed++
        }
      } catch (error) {
        console.error(`修復 ${tab.id} 失敗:`, error)
        failed++
      }
    }

    showMessage(`批量修復完成: ${fixed} 成功, ${failed} 失敗`)
    fetchMigratedTabs()
  }

  // 顯示所有樂譜（不分source）
  const showAllTabs = () => {
    setTabs(allTabs.map(tab => ({
      ...tab,
      issues: checkTabIssues(tab)
    })))
  }

  const checkTabIssues = (tab) => {
    const issues = []
    if (!tab.artistId) issues.push('缺少 artistId')
    if (!tab.artist) issues.push('缺少歌手名')
    if (!tab.content || tab.content.length < 10) issues.push('內容過短或缺失')
    if (!tab.title) issues.push('缺少歌名')
    return issues
  }

  return (
    <AdminGuard>
      <Layout>
        <Head>
          <title>遷移樂譜管理 | Polygon Guitar</title>
        </Head>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* 標題 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">遷移樂譜管理</h1>
              <p className="text-[#B3B3B3] text-sm mt-1">
                管理從 Blogger 遷移的樂譜，修復顯示問題
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
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <div className="bg-[#121212] rounded-lg p-4 border border-gray-800">
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-[#B3B3B3] text-sm">DB總數</div>
            </div>
            <div className="bg-[#121212] rounded-lg p-4 border border-yellow-800/50">
              <div className="text-2xl font-bold text-yellow-400">{stats.blogger}</div>
              <div className="text-[#B3B3B3] text-sm">Blogger</div>
            </div>
            <div className="bg-[#121212] rounded-lg p-4 border border-blue-800/50">
              <div className="text-2xl font-bold text-blue-400">{stats.manual}</div>
              <div className="text-[#B3B3B3] text-sm">手動上傳</div>
            </div>
            <div className="bg-[#121212] rounded-lg p-4 border border-red-800/50">
              <div className="text-2xl font-bold text-red-400">{stats.withIssues}</div>
              <div className="text-[#B3B3B3] text-sm">有問題</div>
            </div>
            <div className="bg-[#121212] rounded-lg p-4 border border-gray-800">
              <div className="text-2xl font-bold text-orange-400">{stats.noArtistId}</div>
              <div className="text-[#B3B3B3] text-sm">缺artistId</div>
            </div>
            <div className="bg-[#121212] rounded-lg p-4 border border-gray-800">
              <div className="text-2xl font-bold text-purple-400">{stats.noContent}</div>
              <div className="text-[#B3B3B3] text-sm">缺內容</div>
            </div>
          </div>

          {/* 工具欄 */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[#B3B3B3] text-sm">過濾:</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-[#121212] text-white border border-gray-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">全部 Blogger ({stats.blogger})</option>
                <option value="issues">有問題 ({stats.withIssues})</option>
                <option value="noArtist">缺歌手 ({stats.noArtistId + stats.noArtistName})</option>
                <option value="noContent">缺內容 ({stats.noContent})</option>
              </select>
              <button
                onClick={showAllTabs}
                className="bg-blue-900/50 hover:bg-blue-800/50 text-blue-300 border border-blue-700 px-3 py-2 rounded-lg text-sm transition-colors"
              >
                顯示全部 ({stats.total})
              </button>
            </div>

            <div className="flex items-center gap-2">
              {stats.withIssues > 0 && (
                <button
                  onClick={handleFixAll}
                  className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  🔧 自動修復全部
                </button>
              )}
              <button
                onClick={fetchMigratedTabs}
                className="bg-[#282828] hover:bg-[#3E3E3E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                🔄 刷新
              </button>
            </div>
          </div>

          {/* Debug 信息 */}
          {debugInfo && (
            <div className="mb-6 bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
              <h3 className="text-[#B3B3B3] text-sm font-medium mb-2">Debug 信息</h3>
              <div className="text-xs text-gray-500 font-mono space-y-1">
                <p>資料庫總數: {debugInfo.totalInDB}</p>
                <p>Blogger 來源: {debugInfo.bloggerCount}</p>
                <p>前10筆樣本:</p>
                <ul className="ml-4 space-y-0.5">
                  {debugInfo.sampleSources.map((s, i) => (
                    <li key={i}>{s.title} | source: {s.source || 'null'} | artistId: {s.artistId || 'null'}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 樂譜列表 */}
          {loading ? (
            <div className="text-center py-12 text-[#B3B3B3]">載入中...</div>
          ) : filteredTabs.length === 0 ? (
            <div className="text-center py-12 text-[#B3B3B3]">
              {filter === 'all' ? '暫無遷移的樂譜' : '沒有符合條件的樂譜'}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-[#B3B3B3] text-sm mb-2">
                顯示 {filteredTabs.length} 首樂譜
              </div>
              {filteredTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`bg-[#121212] rounded-lg border ${
                    tab.issues?.length > 0 ? 'border-red-800/50' : 'border-gray-800'
                  } p-4`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-medium truncate">
                          {tab.title || '(無歌名)'}
                        </h3>
                        {tab.issues?.length > 0 && (
                          <span className="bg-red-900/50 text-red-400 text-xs px-2 py-0.5 rounded-full">
                            {tab.issues.length} 個問題
                          </span>
                        )}
                        {tab.source && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            tab.source === 'blogger' 
                              ? 'bg-yellow-900/30 text-yellow-400' 
                              : 'bg-blue-900/30 text-blue-400'
                          }`}>
                            {tab.source}
                          </span>
                        )}
                      </div>
                      <p className="text-[#B3B3B3] text-sm mb-2">
                        {tab.artist || '(無歌手)'}
                        {tab.artistId && (
                          <span className="text-gray-500 ml-2">ID: {tab.artistId}</span>
                        )}
                      </p>
                      {tab.issues?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {tab.issues.map((issue, idx) => (
                            <span 
                              key={idx}
                              className="bg-red-900/30 text-red-400 text-xs px-2 py-0.5 rounded"
                            >
                              {issue}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>調: {tab.originalKey || 'C'}</span>
                        {tab.capo && <span>Capo: {tab.capo}</span>}
                        <span>
                          {tab.createdAt?.seconds 
                            ? new Date(tab.createdAt.seconds * 1000).toLocaleDateString('zh-HK')
                            : tab.createdAt 
                              ? new Date(tab.createdAt).toLocaleDateString('zh-HK')
                              : '未知日期'
                          }
                        </span>
                        <span className="text-gray-600">ID: {tab.id.slice(0, 8)}...</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/tabs/${tab.id}`}
                        target="_blank"
                        className="text-[#B3B3B3] hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-[#282828] transition-colors"
                      >
                        查看
                      </Link>
                      {tab.issues?.length > 0 && (
                        <button
                          onClick={() => handleAutoFix(tab)}
                          className="text-yellow-400 hover:text-yellow-300 text-sm px-3 py-1.5 rounded-lg hover:bg-yellow-900/30 transition-colors"
                        >
                          自動修復
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(tab)}
                        className="text-[#FFD700] hover:text-yellow-400 text-sm px-3 py-1.5 rounded-lg hover:bg-[#FFD700]/10 transition-colors"
                      >
                        編輯
                      </button>
                      <button
                        onClick={() => handleDelete(tab)}
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
          {selectedTab && editForm && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
              <div className="bg-[#121212] rounded-xl border border-gray-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">編輯樂譜</h2>
                    <button
                      onClick={() => {
                        setSelectedTab(null)
                        setEditForm(null)
                      }}
                      className="text-[#B3B3B3] hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[#B3B3B3] text-sm mb-2">歌名 *</label>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                        className="w-full bg-[#0A0A0A] text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-[#FFD700] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[#B3B3B3] text-sm mb-2">歌手 *</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editForm.artist}
                          onChange={(e) => setEditForm({...editForm, artist: e.target.value})}
                          className="flex-1 bg-[#0A0A0A] text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-[#FFD700] focus:outline-none"
                        />
                        <button
                          onClick={handleWikiSearch}
                          disabled={searchingWiki || !editForm.artist}
                          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          {searchingWiki ? '搜尋中...' : '🔍 維基'}
                        </button>
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        會自動生成 artistId: {editForm.artist.toLowerCase().replace(/\s+/g, '-')}
                      </p>
                      
                      {/* 維基搜尋結果 */}
                      {wikiData && (
                        <div className="mt-3 bg-[#1a1a1a] rounded-lg p-3 border border-blue-800/50">
                          <div className="flex items-start gap-3">
                            {wikiData.photo && (
                              <img 
                                src={wikiData.photo} 
                                alt={wikiData.name}
                                className="w-16 h-16 object-cover rounded-lg"
                              />
                            )}
                            <div className="flex-1">
                              <h4 className="text-white font-medium">{wikiData.name}</h4>
                              <p className="text-[#B3B3B3] text-xs mt-1 line-clamp-2">{wikiData.bio}</p>
                              <div className="flex items-center gap-2 mt-2">
                                {wikiData.artistType && (
                                  <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded">
                                    {wikiData.artistType}
                                  </span>
                                )}
                                {wikiData.year && (
                                  <span className="text-xs text-gray-500">{wikiData.year}年</span>
                                )}
                              </div>
                              <button
                                onClick={applyWikiData}
                                className="mt-2 text-xs bg-[#FFD700] text-black px-3 py-1 rounded hover:bg-yellow-400 transition-colors"
                              >
                                應用此歌手名
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[#B3B3B3] text-sm mb-2">原調</label>
                        <select
                          value={editForm.originalKey}
                          onChange={(e) => setEditForm({...editForm, originalKey: e.target.value})}
                          className="w-full bg-[#0A0A0A] text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-[#FFD700] focus:outline-none"
                        >
                          {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(k => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[#B3B3B3] text-sm mb-2">Capo</label>
                        <input
                          type="number"
                          min="0"
                          max="12"
                          value={editForm.capo}
                          onChange={(e) => setEditForm({...editForm, capo: e.target.value})}
                          className="w-full bg-[#0A0A0A] text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-[#FFD700] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[#B3B3B3] text-sm mb-2">
                        樂譜內容 * 
                        <span className="text-gray-500">
                          ({editForm.content.length} 字符)
                        </span>
                      </label>
                      <textarea
                        value={editForm.content}
                        onChange={(e) => setEditForm({...editForm, content: e.target.value})}
                        rows={15}
                        className="w-full bg-[#0A0A0A] text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-[#FFD700] focus:outline-none font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-800">
                    <button
                      onClick={() => {
                        setSelectedTab(null)
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

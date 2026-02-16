import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { getAllTabs, getAllArtists } from '@/lib/tabs'
import { updateDoc, doc, setDoc, getDoc } from 'firebase/firestore'
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
  const [selectedFix, setSelectedFix] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [isFixing, setIsFixing] = useState(false)
  const [logs, setLogs] = useState([])

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
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }])
  }

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
                const input = document.querySelector('input[type="text"]')
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

        {/* 日誌 */}
        {logs.length > 0 && (
          <div className="bg-[#121212] rounded-xl border border-gray-800">
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
            <li>點擊「新青年理髮廳」等預設按鈕，自動搜尋相關歌曲</li>
            <li>或輸入歌手名手動搜尋</li>
            <li>點擊「一鍵修復」批量修復所有搜尋結果</li>
            <li>或點擊單個歌曲的「修復」按鈕逐個處理</li>
            <li>修復後會自動創建歌手（如果不存在）</li>
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

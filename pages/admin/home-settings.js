import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { db } from '@/lib/firebase'
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from 'firebase/firestore'
import { getAllArtists, getRecentTabs, searchTabs } from '@/lib/tabs'

const SORT_OPTIONS = [
  { value: 'viewCount', label: '總瀏覽量', desc: '按歌手所有歌曲瀏覽總和排序' },
  { value: 'tabCount', label: '譜數目', desc: '按歌手歌曲數量排序' },
  { value: 'adminScore', label: 'Admin 評分', desc: '按 adminScore 分數排序' },
  { value: 'mixed', label: '混合排序', desc: '瀏覽量(50%) + 譜數(30%) + 評分(20%)' }
]

const TAB_SORT_OPTIONS = [
  { value: 'viewCount', label: '瀏覽量', desc: '按歌曲瀏覽次數排序' },
  { value: 'likes', label: '讚好數', desc: '按歌曲讚好數排序' },
  { value: 'createdAt', label: '最新上傳', desc: '按上傳時間排序' },
  { value: 'rating', label: '最高評分', desc: '按用戶評分排序' }
]

function HomeSettings() {
  const router = useRouter()
  const [artists, setArtists] = useState([])
  const [tabs, setTabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // 首頁區域選項
  const SECTION_OPTIONS = [
    { id: 'categories', label: '歌手分類', icon: '🎭' },
    { id: 'recent', label: '最近瀏覽', icon: '🕐' },
    { id: 'hotTabs', label: '熱門結他譜', icon: '🔥' },
    { id: 'hotArtists', label: '熱門歌手', icon: '⭐' },
    { id: 'autoPlaylists', label: '推薦歌單', icon: '📻' },
    { id: 'latest', label: '最新上架', icon: '🆕' },
    { id: 'manualPlaylists', label: '精選歌單', icon: '💿' }
  ]

  const [settings, setSettings] = useState({
    // 改為單一個熱門歌手揀選列表（混合男/女/組合）
    manualSelection: [],
    hotArtistSortBy: 'viewCount',
    displayCount: 20,
    hotTabs: {
      manualSelection: [],
      useManual: false,
      displayCount: 20,
      sortBy: 'viewCount'
    },
    sectionOrder: [
      { id: 'categories', enabled: true, customLabel: '' },
      { id: 'recent', enabled: true, customLabel: '' },
      { id: 'hotTabs', enabled: true, customLabel: '' },
      { id: 'hotArtists', enabled: true, customLabel: '' },
      { id: 'autoPlaylists', enabled: true, customLabel: '' },
      { id: 'latest', enabled: true, customLabel: '' },
      { id: 'manualPlaylists', enabled: true, customLabel: '' }
    ]
  })
  
  // 追踪是否有未保存的改動
  const [hasChanges, setHasChanges] = useState(false)
  
  // 熱門歌手搜索
  const [artistSearchTerm, setArtistSearchTerm] = useState('')
  const [activeArtistCategory, setActiveArtistCategory] = useState('all')
  
  // 計算各類型已選歌手數目
  const getSelectedCounts = () => {
    const selectedIds = settings.manualSelection || []
    const maleCount = selectedIds.filter(id => {
      const artist = artists.find(a => a.id === id)
      return artist && (artist.artistType === 'male' || artist.gender === 'male')
    }).length
    const femaleCount = selectedIds.filter(id => {
      const artist = artists.find(a => a.id === id)
      return artist && (artist.artistType === 'female' || artist.gender === 'female')
    }).length
    const groupCount = selectedIds.filter(id => {
      const artist = artists.find(a => a.id === id)
      return artist && (artist.artistType === 'group' || artist.gender === 'group')
    }).length
    return { male: maleCount, female: femaleCount, group: groupCount }
  }
  
  // 熱門歌曲搜索
  const [tabSearchTerm, setTabSearchTerm] = useState('')
  const [selectedTabIds, setSelectedTabIds] = useState([])
  
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('artists')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [artistsData, tabsData, settingsDoc] = await Promise.all([
        getAllArtists(),
        getRecentTabs(500), // 載入最近 500 首，足夠揀選用
        getDoc(doc(db, 'settings', 'home'))
      ])
      
      setArtists(artistsData)
      setTabs(tabsData)
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data()
        
        // 數據遷移：將舊的按分類格式轉換為新格式
        let manualSelection = data.manualSelection || []
        
        // 如果是舊格式（對象而不是數組），轉換為新格式
        if (typeof manualSelection === 'object' && !Array.isArray(manualSelection)) {
          console.log('Migrating old manual selection format...')
          // 合併三個分類的選擇，去重
          const male = manualSelection.male || []
          const female = manualSelection.female || []
          const group = manualSelection.group || []
          manualSelection = [...new Set([...male, ...female, ...group])]
        }
        
        // 清理：確保 manualSelection 只包含 ID 字符串（如果入面有對象，提取 id）
        if (Array.isArray(manualSelection)) {
          manualSelection = manualSelection.map(item => {
            if (typeof item === 'object' && item !== null && item.id) {
              return item.id
            }
            return item
          }).filter(id => typeof id === 'string')
        }
        
        setSettings(prev => ({
          ...prev,
          ...data,
          manualSelection,
          hotTabs: {
            ...prev.hotTabs,
            ...(data.hotTabs || {})
          },
          sectionOrder: data.sectionOrder || prev.sectionOrder
        }))
        
        // 初始化已選歌曲 - 確保只包含 ID 字符串
        if (data.hotTabs?.manualSelection) {
          let tabSelection = data.hotTabs.manualSelection
          if (Array.isArray(tabSelection)) {
            tabSelection = tabSelection.map(item => {
              if (typeof item === 'object' && item !== null && item.id) {
                return item.id
              }
              return item
            }).filter(id => typeof id === 'string')
          }
          setSelectedTabIds(tabSelection)
          console.log('Loaded selected tabs:', tabSelection)
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      // 確保只保存 ID 字符串，並去重
      const cleanManualSelection = (settings.manualSelection || [])
        .map(item => typeof item === 'object' && item !== null && item.id ? item.id : item)
        .filter(item => typeof item === 'string')
      
      const dedupedSettings = {
        ...settings,
        manualSelection: [...new Set(cleanManualSelection)],
        hotTabs: {
          ...settings.hotTabs,
          manualSelection: [...new Set(settings.hotTabs.manualSelection)]
        },
        updatedAt: new Date().toISOString()
      }
      
      await setDoc(doc(db, 'settings', 'home'), dedupedSettings)
      setHasChanges(false)  // 保存成功後重置改動狀態
      setMessage('✅ 設置已保存')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Error saving:', error)
      setMessage('❌ 保存失敗')
    } finally {
      setSaving(false)
    }
  }

  const getArtistsByCategory = (category) => {
    return artists.filter(a => (a.artistType || a.gender) === category)
  }

  // 熱門歌手相關函數
  const toggleArtistSelection = (artistId) => {
    setSettings(prev => {
      // 確保入面只係 ID 字符串
      const currentSelection = (prev.manualSelection || [])
        .map(item => typeof item === 'object' && item !== null && item.id ? item.id : item)
        .filter(item => typeof item === 'string')
      
      const isSelected = currentSelection.includes(artistId)
      
      return {
        ...prev,
        manualSelection: isSelected
          ? currentSelection.filter(id => id !== artistId)
          : [...currentSelection, artistId]
      }
    })
    setHasChanges(true)
  }

  const moveArtistOrder = (index, direction) => {
    console.log('moveArtistOrder called:', index, direction)
    setSettings(prev => {
      // 確保只取 ID 字符串，並複製到新數組
      const currentSelection = (prev.manualSelection || [])
        .map(item => typeof item === 'object' && item !== null && item.id ? item.id : item)
        .filter(item => typeof item === 'string')
      
      console.log('Before:', currentSelection)
      
      const newSelection = [...currentSelection]
      
      if (direction === 'up' && index > 0) {
        const temp = newSelection[index]
        newSelection[index] = newSelection[index - 1]
        newSelection[index - 1] = temp
      } else if (direction === 'down' && index < newSelection.length - 1) {
        const temp = newSelection[index]
        newSelection[index] = newSelection[index + 1]
        newSelection[index + 1] = temp
      }
      
      console.log('After:', newSelection)
      
      return {
        ...prev,
        manualSelection: newSelection
      }
    })
    setHasChanges(true)
  }

  const removeArtistFromSelection = (artistId) => {
    setSettings(prev => {
      // 確保入面只係 ID 字符串
      const currentSelection = (prev.manualSelection || [])
        .map(item => typeof item === 'object' && item !== null && item.id ? item.id : item)
        .filter(item => typeof item === 'string')
      
      return {
        ...prev,
        manualSelection: currentSelection.filter(id => id !== artistId)
      }
    })
    setHasChanges(true)
  }

  // 熱門歌曲相關函數
  const toggleTabSelection = (tabId) => {
    setSelectedTabIds(prev => {
      const isSelected = prev.includes(tabId)
      const newSelection = isSelected
        ? prev.filter(id => id !== tabId)
        : [...prev, tabId]
      
      // 同時更新 settings
      setSettings(s => ({
        ...s,
        hotTabs: {
          ...s.hotTabs,
          manualSelection: newSelection
        }
      }))
      
      return newSelection
    })
    setHasChanges(true)
  }

  const moveTabOrder = (index, direction) => {
    const newSelection = [...selectedTabIds]
    if (direction === 'up' && index > 0) {
      [newSelection[index], newSelection[index - 1]] = 
      [newSelection[index - 1], newSelection[index]]
    } else if (direction === 'down' && index < newSelection.length - 1) {
      [newSelection[index], newSelection[index + 1]] = 
      [newSelection[index + 1], newSelection[index]]
    }
    
    setSelectedTabIds(newSelection)
    setSettings(prev => ({
      ...prev,
      hotTabs: {
        ...prev.hotTabs,
        manualSelection: newSelection
      }
    }))
    setHasChanges(true)
  }

  const removeTabFromSelection = (tabId) => {
    const newSelection = selectedTabIds.filter(id => id !== tabId)
    setSelectedTabIds(newSelection)
    setSettings(prev => ({
      ...prev,
      hotTabs: {
        ...prev.hotTabs,
        manualSelection: newSelection
      }
    }))
    setHasChanges(true)
  }

  const moveSection = (index, direction) => {
    const newOrder = [...settings.sectionOrder]
    if (direction === 'up' && index > 0) {
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]]
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    }
    setSettings(prev => ({ ...prev, sectionOrder: newOrder }))
    setHasChanges(true)
  }

  const toggleSection = (index) => {
    const newOrder = [...settings.sectionOrder]
    newOrder[index] = { ...newOrder[index], enabled: !newOrder[index].enabled }
    setSettings(prev => ({ ...prev, sectionOrder: newOrder }))
    setHasChanges(true)
  }

  // 過濾搜索結果
  const filteredArtists = (category) => {
    // category 為 null 時返回所有歌手
    const categoryArtists = category ? getArtistsByCategory(category) : artists
    if (!artistSearchTerm) return categoryArtists
    
    return categoryArtists.filter(a => 
      a.name?.toLowerCase().includes(artistSearchTerm.toLowerCase())
    )
  }

  const filteredTabs = () => {
    if (!tabSearchTerm) return tabs.slice(0, 50) // 限制顯示數量
    
    return tabs.filter(t => 
      t.title?.toLowerCase().includes(tabSearchTerm.toLowerCase()) ||
      t.artistName?.toLowerCase().includes(tabSearchTerm.toLowerCase())
    ).slice(0, 50)
  }

  const getSelectedArtists = () => {
    const ids = (settings.manualSelection || [])
      .map(item => typeof item === 'object' && item !== null && item.id ? item.id : item)
      .filter(item => typeof item === 'string')
    // 去重，防止重複 ID 導致重複顯示
    const uniqueIds = [...new Set(ids)]
    // 過濾掉找不到的歌手，防止顯示 null
    return uniqueIds
      .map(id => artists.find(a => a.id === id))
      .filter(a => a && a.id) // 確保有有效 ID
  }
  
  // 按分類獲取已選歌手
  const getSelectedArtistsByCategory = (category) => {
    const allSelected = getSelectedArtists()
    return allSelected.filter(artist => (artist.artistType || artist.gender) === category)
  }

  const getSelectedTabs = () => {
    return selectedTabIds.map(id => {
      const tab = tabs.find(t => t.id === id)
      if (tab) return tab
      // 如果喺 tabs 數組入邊搵唔到，顯示一個佔位符
      return { id, title: '載入中...', artistName: '', notFound: true }
    })
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-800 rounded w-1/3"></div>
            <div className="h-64 bg-gray-800 rounded"></div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">首頁設置</h1>
          <p className="text-gray-500">自定義首頁顯示內容同排序</p>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.startsWith('✅') 
              ? 'bg-green-900/50 text-green-400 border border-green-700' 
              : 'bg-red-900/50 text-red-400 border border-red-700'
          }`}>
            {message}
          </div>
        )}

        <div className="flex border-b border-gray-800 mb-6">
          <button
            onClick={() => setActiveTab('artists')}
            className={`flex-1 py-3 text-center font-medium transition border-b-2 ${
              activeTab === 'artists'
                ? 'text-[#FFD700] border-[#FFD700]'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            👤 熱門歌手
          </button>
          <button
            onClick={() => setActiveTab('tabs')}
            className={`flex-1 py-3 text-center font-medium transition border-b-2 ${
              activeTab === 'tabs'
                ? 'text-[#FFD700] border-[#FFD700]'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            🎵 熱門歌曲
          </button>
          <button
            onClick={() => setActiveTab('layout')}
            className={`flex-1 py-3 text-center font-medium transition border-b-2 ${
              activeTab === 'layout'
                ? 'text-[#FFD700] border-[#FFD700]'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            📐 頁面布局
          </button>
        </div>

        {/* 熱門歌手設置 */}
        {activeTab === 'artists' && (
          <div className="space-y-6">
            {/* 設置選項 */}
            <div className="bg-[#121212] rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-medium text-white mb-4">顯示設置</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">排序方式</label>
                  <select
                    value={settings.hotArtistSortBy}
                    onChange={(e) => {
                      setSettings(prev => ({ ...prev, hotArtistSortBy: e.target.value }))
                      setHasChanges(true)
                    }}
                    className="w-full bg-[#282828] border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    {SORT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {SORT_OPTIONS.find(o => o.value === settings.hotArtistSortBy)?.desc}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">顯示數量</label>
                  <input
                    type="number"
                    value={settings.displayCount}
                    onChange={(e) => {
                      setSettings(prev => ({ ...prev, displayCount: parseInt(e.target.value) || 20 }))
                      setHasChanges(true)
                    }}
                    className="w-full bg-[#282828] border border-gray-700 rounded-lg px-4 py-2 text-white"
                    min="1"
                    max="50"
                  />
                </div>
              </div>
            </div>

            {/* 手動選擇 */}
            <div className="bg-[#121212] rounded-xl border border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-white">手動揀選歌手</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      揀選歌手組成「熱門歌手」列表，有揀選就優先顯示，冇就自動排序
                    </p>
                  </div>
                </div>
              </div>
              
              {/* 分類 Tab */}
              {/* 分類篩選（只影響搜索結果，唔影響已選列表） */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 overflow-x-auto">
                <span className="text-sm text-gray-500 whitespace-nowrap">搜索篩選:</span>
                {[
                  { id: 'all', label: '全部' },
                  { id: 'male', label: '男歌手' },
                  { id: 'female', label: '女歌手' },
                  { id: 'group', label: '組合' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setActiveArtistCategory(cat.id)
                      setArtistSearchTerm('')
                    }}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full transition whitespace-nowrap ${
                      activeArtistCategory === cat.id
                        ? 'bg-[#FFD700] text-black'
                        : 'bg-[#282828] text-gray-400 hover:text-white'
                    }`}
                  >
                    {cat.label}
                    {cat.id !== 'all' && (() => {
                      const counts = getSelectedCounts()
                      const count = counts[cat.id] || 0
                      return count > 0 ? (
                        <span className="ml-1.5 text-xs">({count})</span>
                      ) : null
                    })()}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {/* 已選歌手列表（統一顯示所有已選，不分分類） */}
                {(() => {
                  const allSelected = getSelectedArtists()
                  return allSelected.length > 0 ? (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">
                      已揀選 ({allSelected.length})
                      <span className="ml-2 text-xs text-gray-500">
                        男: {getSelectedCounts().male} / 女: {getSelectedCounts().female} / 組合: {getSelectedCounts().group}
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {allSelected.map((artist, index) => {
                        const artistType = artist.artistType || artist.gender
                        const typeLabel = artistType === 'male' ? '男' : artistType === 'female' ? '女' : '組'
                        const typeColor = artistType === 'male' ? 'bg-[#1fc3df]' : artistType === 'female' ? 'bg-[#ff9b98]' : 'bg-[#fed702]'
                        
                        return (
                          <div 
                            key={artist.id}
                            className="flex items-center gap-3 p-3 bg-[#1a1a1a] rounded-lg border border-gray-800"
                          >
                            <span className="text-gray-500 w-6">{index + 1}</span>
                            {artist.photoURL || artist.wikiPhotoURL ? (
                              <img 
                                src={artist.photoURL || artist.wikiPhotoURL} 
                                alt="" 
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-[#282828] flex items-center justify-center">
                                <span className="text-lg">🎤</span>
                              </div>
                            )}
                            <span className="flex-1 text-white font-medium">{artist.name}</span>
                            
                            {/* 分類標籤 */}
                            <span className={`px-2 py-0.5 text-xs font-medium text-black rounded ${typeColor}`}>
                              {typeLabel}
                            </span>
                            
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  console.log('Up button clicked for index:', index, 'artist:', artist.name)
                                  moveArtistOrder(index, 'up')
                                }}
                                disabled={index === 0}
                                className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 rounded cursor-pointer"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  console.log('Down button clicked for index:', index, 'artist:', artist.name)
                                  moveArtistOrder(index, 'down')
                                }}
                                disabled={index === allSelected.length - 1}
                                className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 rounded cursor-pointer"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                onClick={() => removeArtistFromSelection(artist.id)}
                                className="p-1.5 text-red-400 hover:text-red-300 rounded cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  ) : (
                    <div className="mb-6 p-8 bg-[#1a1a1a] rounded-lg border border-gray-800 text-center">
                      <p className="text-gray-500">尚未揀選任何歌手</p>
                      <p className="text-sm text-gray-600 mt-1">喺下面搜索添加歌手</p>
                    </div>
                  )
                })()}

                {/* 搜索添加 */}
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">
                    添加歌手 
                    <span className="text-xs text-gray-500 ml-1">
                      ({activeArtistCategory === 'all' ? '顯示全部' : `只顯示${activeArtistCategory === 'male' ? '男歌手' : activeArtistCategory === 'female' ? '女歌手' : '組合'}`})
                    </span>
                  </h3>
                  <div className="relative mb-3">
                    <input
                      type="text"
                      value={artistSearchTerm}
                      onChange={(e) => setArtistSearchTerm(e.target.value)}
                      placeholder="搜索歌手名..."
                      className="w-full bg-[#282828] border border-gray-700 rounded-lg px-4 py-2 pr-10 text-white placeholder-gray-500"
                    />
                    {artistSearchTerm && (
                      <button
                        onClick={() => setArtistSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {filteredArtists(activeArtistCategory === 'all' ? null : activeArtistCategory).slice(0, 20).map(artist => {
                      const isSelected = settings.manualSelection?.includes(artist.id)
                      const artistType = artist.artistType || artist.gender
                      const typeLabel = artistType === 'male' ? '男' : artistType === 'female' ? '女' : '組'
                      const typeColor = artistType === 'male' ? 'bg-[#1fc3df]' : artistType === 'female' ? 'bg-[#ff9b98]' : 'bg-[#fed702]'
                      
                      return (
                        <button
                          key={artist.id}
                          onClick={() => toggleArtistSelection(artist.id)}
                          className={`w-full flex items-center gap-3 p-2 rounded-lg transition text-left ${
                            isSelected 
                              ? 'bg-[#FFD700]/20 border border-[#FFD700]/50' 
                              : 'hover:bg-[#282828]'
                          }`}
                        >
                          {artist.photoURL || artist.wikiPhotoURL ? (
                            <img 
                              src={artist.photoURL || artist.wikiPhotoURL} 
                              alt="" 
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#282828] flex items-center justify-center">
                              <span>🎤</span>
                            </div>
                          )}
                          <span className={`flex-1 ${isSelected ? 'text-[#FFD700]' : 'text-white'}`}>
                            {artist.name}
                          </span>
                          {/* 分類標籤 */}
                          <span className={`px-1.5 py-0.5 text-xs font-medium text-black rounded ${typeColor}`}>
                            {typeLabel}
                          </span>
                          {isSelected && <span className="text-[#FFD700]">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 熱門歌曲設置 */}
        {activeTab === 'tabs' && (
          <div className="space-y-6">
            {/* 設置選項 */}
            <div className="bg-[#121212] rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-medium text-white mb-4">顯示設置</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">排序方式</label>
                  <select
                    value={settings.hotTabs?.sortBy || 'viewCount'}
                    onChange={(e) => {
                      setSettings(prev => ({
                        ...prev,
                        hotTabs: { ...prev.hotTabs, sortBy: e.target.value }
                      }))
                      setHasChanges(true)
                    }}
                    className="w-full bg-[#282828] border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    {TAB_SORT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">顯示數量</label>
                  <input
                    type="number"
                    value={settings.hotTabs?.displayCount || 20}
                    onChange={(e) => {
                      setSettings(prev => ({
                        ...prev,
                        hotTabs: { ...prev.hotTabs, displayCount: parseInt(e.target.value) || 20 }
                      }))
                      setHasChanges(true)
                    }}
                    className="w-full bg-[#282828] border border-gray-700 rounded-lg px-4 py-2 text-white"
                    min="1"
                    max="50"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.hotTabs?.useManual || false}
                      onChange={(e) => {
                        setSettings(prev => ({
                          ...prev,
                          hotTabs: { ...prev.hotTabs, useManual: e.target.checked }
                        }))
                        setHasChanges(true)
                      }}
                      className="w-5 h-5 rounded border-gray-600 text-[#FFD700] focus:ring-[#FFD700] bg-[#282828]"
                    />
                    <span className="text-sm text-gray-300">只顯示手動揀選</span>
                  </label>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {TAB_SORT_OPTIONS.find(o => o.value === (settings.hotTabs?.sortBy || 'viewCount'))?.desc}
              </p>
            </div>

            {/* 手動選擇歌曲 */}
            <div className="bg-[#121212] rounded-xl border border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h2 className="text-lg font-medium text-white">手動揀選歌曲</h2>
                <p className="text-sm text-gray-500 mt-1">揀選特定歌曲顯示喺熱門結他譜區</p>
              </div>

              <div className="p-4">
                {/* 已選歌曲列表 */}
                {selectedTabIds.length > 0 && (
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-medium text-gray-400">
                        已揀選 ({selectedTabIds.length})
                      </h3>
                      <button
                        onClick={() => {
                          setSelectedTabIds([])
                          setSettings(prev => ({
                            ...prev,
                            hotTabs: {
                              ...prev.hotTabs,
                              manualSelection: []
                            }
                          }))
                          setHasChanges(true)
                        }}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        清空全部
                      </button>
                    </div>
                    <div className="space-y-2">
                      {getSelectedTabs().map((tab, index) => (
                        <div 
                          key={tab.id}
                          className="flex items-center gap-3 p-3 bg-[#1a1a1a] rounded-lg border border-gray-800"
                        >
                          <span className="text-gray-500 w-6">{index + 1}</span>
                          {tab.thumbnail || tab.youtubeVideoId ? (
                            <img 
                              src={tab.thumbnail || `https://img.youtube.com/vi/${tab.youtubeVideoId}/default.jpg`} 
                              alt="" 
                              className="w-12 h-9 rounded object-cover"
                            />
                          ) : (
                            <div className="w-12 h-9 rounded bg-[#282828] flex items-center justify-center">
                              <span className="text-xs">🎵</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{tab.title}</p>
                            <p className="text-sm text-gray-500">{tab.artistName}</p>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => moveTabOrder(index, 'up')}
                              disabled={index === 0}
                              className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 rounded"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveTabOrder(index, 'down')}
                              disabled={index === selectedTabIds.length - 1}
                              className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 rounded"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => removeTabFromSelection(tab.id)}
                              className="p-1.5 text-red-400 hover:text-red-300 rounded"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 搜索添加 */}
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">添加歌曲</h3>
                  <div className="relative mb-3">
                    <input
                      type="text"
                      value={tabSearchTerm}
                      onChange={(e) => setTabSearchTerm(e.target.value)}
                      placeholder="搜索歌曲名或歌手名..."
                      className="w-full bg-[#282828] border border-gray-700 rounded-lg px-4 py-2 pr-10 text-white placeholder-gray-500"
                    />
                    {tabSearchTerm && (
                      <button
                        onClick={() => setTabSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {filteredTabs().map(tab => {
                      const isSelected = selectedTabIds.includes(tab.id)
                      return (
                        <button
                          key={tab.id}
                          onClick={() => toggleTabSelection(tab.id)}
                          className={`w-full flex items-center gap-3 p-2 rounded-lg transition text-left ${
                            isSelected 
                              ? 'bg-[#FFD700]/20 border border-[#FFD700]/50' 
                              : 'hover:bg-[#282828]'
                          }`}
                        >
                          {tab.thumbnail || tab.youtubeVideoId ? (
                            <img 
                              src={tab.thumbnail || `https://img.youtube.com/vi/${tab.youtubeVideoId}/default.jpg`} 
                              alt="" 
                              className="w-10 h-8 rounded object-cover"
                            />
                          ) : (
                            <div className="w-10 h-8 rounded bg-[#282828] flex items-center justify-center">
                              <span className="text-xs">🎵</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${isSelected ? 'text-[#FFD700]' : 'text-white'}`}>
                              {tab.title}
                            </p>
                            <p className="text-xs text-gray-500">{tab.artistName}</p>
                          </div>
                          {isSelected && <span className="text-[#FFD700]">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 頁面布局設置 */}
        {activeTab === 'layout' && (
          <div className="bg-[#121212] rounded-xl border border-gray-800">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-medium text-white">📐 首頁區域排序</h2>
                <p className="text-sm text-gray-500 mt-1">調整區域顯示順序，或隱藏不需要的區域</p>
              </div>
              <button
                onClick={() => {
                  if (confirm('確定要重置為預設布局嗎？這會恢復所有區域的顯示。')) {
                    setSettings(prev => ({
                      ...prev,
                      sectionOrder: [
                        { id: 'categories', enabled: true },
                        { id: 'recent', enabled: true },
                        { id: 'hotTabs', enabled: true },
                        { id: 'hotArtists', enabled: true },
                        { id: 'autoPlaylists', enabled: true },
                        { id: 'latest', enabled: true },
                        { id: 'manualPlaylists', enabled: true }
                      ]
                    }))
                    setHasChanges(true)
                  }
                }}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition text-sm"
              >
                🔄 重置為預設
              </button>
            </div>
            
            <div className="p-4">
              <div className="space-y-2">
                {settings.sectionOrder?.map((section, index) => {
                  const option = SECTION_OPTIONS.find(o => o.id === section.id)
                  if (!option) return null
                  const displayLabel = section.customLabel || option.label
                  return (
                    <div 
                      key={section.id}
                      className={`flex flex-col gap-3 p-3 rounded-lg border ${
                        section.enabled 
                          ? 'bg-gray-900/50 border-gray-800' 
                          : 'bg-gray-900/30 border-gray-800/50 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-xl">{option.icon}</span>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={displayLabel}
                            onChange={(e) => {
                              const newOrder = [...settings.sectionOrder]
                              newOrder[index] = { ...section, customLabel: e.target.value }
                              setSettings(prev => ({ ...prev, sectionOrder: newOrder }))
                              setHasChanges(true)
                            }}
                            placeholder={option.label}
                            className="w-full bg-transparent text-white font-medium border-b border-transparent hover:border-gray-600 focus:border-[#FFD700] focus:outline-none transition px-1 -ml-1"
                          />
                          {section.customLabel && (
                            <span className="text-xs text-gray-500 ml-1">原名：{option.label}</span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => moveSection(index, 'up')}
                            disabled={index === 0}
                            className="p-2 text-gray-400 hover:text-white disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveSection(index, 'down')}
                            disabled={index === settings.sectionOrder.length - 1}
                            className="p-2 text-gray-400 hover:text-white disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => toggleSection(index)}
                            className={`px-3 py-1 rounded text-sm font-medium transition ${
                              section.enabled
                                ? 'bg-green-900/50 text-green-400 hover:bg-green-900'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                          >
                            {section.enabled ? '顯示' : '隱藏'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-4 mt-8">
          <button
            onClick={saveSettings}
            disabled={saving}
            className={`flex-1 py-3 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 ${
              hasChanges 
                ? 'bg-[#FFD700] text-black'  // 有改動 = 黃色
                : 'bg-green-600 text-white'   // 已保存 = 綠色
            }`}
          >
            {saving ? '保存中...' : hasChanges ? '💾 保存設置' : '✅ 已保存'}
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
          >
            查看首頁
          </button>
        </div>
      </div>
    </Layout>
  )
}

export default function HomeSettingsGuard() {
  return (
    <AdminGuard>
      <HomeSettings />
    </AdminGuard>
  )
}

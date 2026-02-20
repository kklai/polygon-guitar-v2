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
import { getAllArtists, getAllTabs } from '@/lib/tabs'

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
    manualSelection: {
      male: [],
      female: [],
      group: []
    },
    useManualSelection: {
      male: false,
      female: false,
      group: false
    },
    hotArtistSortBy: 'viewCount',
    displayCount: 20,
    hotTabs: {
      manualSelection: [],
      useManual: false,
      displayCount: 20,
      sortBy: 'viewCount'
    },
    sectionOrder: [
      { id: 'categories', enabled: true },
      { id: 'recent', enabled: true },
      { id: 'hotTabs', enabled: true },
      { id: 'hotArtists', enabled: true },
      { id: 'autoPlaylists', enabled: true },
      { id: 'latest', enabled: true },
      { id: 'manualPlaylists', enabled: true }
    ]
  })
  
  // 熱門歌手搜索
  const [artistSearchTerm, setArtistSearchTerm] = useState('')
  const [activeArtistCategory, setActiveArtistCategory] = useState('male')
  
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
        getAllTabs(),
        getDoc(doc(db, 'settings', 'home'))
      ])
      
      setArtists(artistsData)
      setTabs(tabsData)
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data()
        setSettings(prev => ({
          ...prev,
          ...data,
          hotTabs: {
            ...prev.hotTabs,
            ...(data.hotTabs || {})
          },
          sectionOrder: data.sectionOrder || prev.sectionOrder
        }))
        
        // 初始化已選歌曲
        if (data.hotTabs?.manualSelection) {
          setSelectedTabIds(data.hotTabs.manualSelection)
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
      await setDoc(doc(db, 'settings', 'home'), {
        ...settings,
        updatedAt: new Date().toISOString()
      })
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
  const toggleArtistSelection = (artistId, category) => {
    setSettings(prev => {
      const currentSelection = prev.manualSelection[category] || []
      const isSelected = currentSelection.includes(artistId)
      
      return {
        ...prev,
        manualSelection: {
          ...prev.manualSelection,
          [category]: isSelected
            ? currentSelection.filter(id => id !== artistId)
            : [...currentSelection, artistId]
        }
      }
    })
  }

  const moveArtistOrder = (category, index, direction) => {
    setSettings(prev => {
      const currentSelection = [...(prev.manualSelection[category] || [])]
      if (direction === 'up' && index > 0) {
        [currentSelection[index], currentSelection[index - 1]] = 
        [currentSelection[index - 1], currentSelection[index]]
      } else if (direction === 'down' && index < currentSelection.length - 1) {
        [currentSelection[index], currentSelection[index + 1]] = 
        [currentSelection[index + 1], currentSelection[index]]
      }
      
      return {
        ...prev,
        manualSelection: {
          ...prev.manualSelection,
          [category]: currentSelection
        }
      }
    })
  }

  const removeArtistFromSelection = (artistId, category) => {
    setSettings(prev => ({
      ...prev,
      manualSelection: {
        ...prev.manualSelection,
        [category]: prev.manualSelection[category].filter(id => id !== artistId)
      }
    }))
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
  }

  const moveSection = (index, direction) => {
    const newOrder = [...settings.sectionOrder]
    if (direction === 'up' && index > 0) {
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]]
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    }
    setSettings(prev => ({ ...prev, sectionOrder: newOrder }))
  }

  const toggleSection = (index) => {
    const newOrder = [...settings.sectionOrder]
    newOrder[index] = { ...newOrder[index], enabled: !newOrder[index].enabled }
    setSettings(prev => ({ ...prev, sectionOrder: newOrder }))
  }

  // 過濾搜索結果
  const filteredArtists = (category) => {
    const categoryArtists = getArtistsByCategory(category)
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

  const getSelectedArtists = (category) => {
    const ids = settings.manualSelection[category] || []
    return ids.map(id => artists.find(a => a.id === id)).filter(Boolean)
  }

  const getSelectedTabs = () => {
    return selectedTabIds.map(id => tabs.find(t => t.id === id)).filter(Boolean)
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
                    onChange={(e) => setSettings(prev => ({ ...prev, hotArtistSortBy: e.target.value }))}
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
                    onChange={(e) => setSettings(prev => ({ ...prev, displayCount: parseInt(e.target.value) || 20 }))}
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
                    <p className="text-sm text-gray-500 mt-1">揀選特定歌手優先顯示喺熱門歌手區</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.useManualSelection[activeArtistCategory]}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        useManualSelection: {
                          ...prev.useManualSelection,
                          [activeArtistCategory]: e.target.checked
                        }
                      }))}
                      className="w-5 h-5 rounded border-gray-600 text-[#FFD700] focus:ring-[#FFD700] bg-[#282828]"
                    />
                    <span className="text-sm text-gray-300">啟用手動揀選</span>
                  </label>
                </div>
              </div>
              
              {/* 分類 Tab */}
              <div className="flex border-b border-gray-800">
                {['male', 'female', 'group'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveArtistCategory(cat)
                      setArtistSearchTerm('')
                    }}
                    className={`flex-1 py-3 text-sm font-medium transition ${
                      activeArtistCategory === cat
                        ? 'text-[#FFD700] border-b-2 border-[#FFD700]'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {cat === 'male' ? '男歌手' : cat === 'female' ? '女歌手' : '組合'}
                    {settings.manualSelection[cat]?.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-[#FFD700] text-black text-xs rounded-full">
                        {settings.manualSelection[cat].length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {/* 已選歌手列表 */}
                {settings.manualSelection[activeArtistCategory]?.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">
                      已揀選 ({settings.manualSelection[activeArtistCategory].length})
                    </h3>
                    <div className="space-y-2">
                      {getSelectedArtists(activeArtistCategory).map((artist, index) => (
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
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => moveArtistOrder(activeArtistCategory, index, 'up')}
                              disabled={index === 0}
                              className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 rounded"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveArtistOrder(activeArtistCategory, index, 'down')}
                              disabled={index === settings.manualSelection[activeArtistCategory].length - 1}
                              className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 rounded"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => removeArtistFromSelection(artist.id, activeArtistCategory)}
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
                  <h3 className="text-sm font-medium text-gray-400 mb-3">添加歌手</h3>
                  <input
                    type="text"
                    value={artistSearchTerm}
                    onChange={(e) => setArtistSearchTerm(e.target.value)}
                    placeholder={`搜索${activeArtistCategory === 'male' ? '男歌手' : activeArtistCategory === 'female' ? '女歌手' : '組合'}...`}
                    className="w-full bg-[#282828] border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 mb-3"
                  />
                  
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {filteredArtists(activeArtistCategory).slice(0, 20).map(artist => {
                      const isSelected = settings.manualSelection[activeArtistCategory]?.includes(artist.id)
                      return (
                        <button
                          key={artist.id}
                          onClick={() => toggleArtistSelection(artist.id, activeArtistCategory)}
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
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      hotTabs: { ...prev.hotTabs, sortBy: e.target.value }
                    }))}
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
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      hotTabs: { ...prev.hotTabs, displayCount: parseInt(e.target.value) || 20 }
                    }))}
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
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        hotTabs: { ...prev.hotTabs, useManual: e.target.checked }
                      }))}
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
                    <h3 className="text-sm font-medium text-gray-400 mb-3">
                      已揀選 ({selectedTabIds.length})
                    </h3>
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
                  <input
                    type="text"
                    value={tabSearchTerm}
                    onChange={(e) => setTabSearchTerm(e.target.value)}
                    placeholder="搜索歌曲名或歌手名..."
                    className="w-full bg-[#282828] border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 mb-3"
                  />
                  
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
            <div className="p-4 border-b border-gray-800">
              <h2 className="text-lg font-medium text-white">📐 首頁區域排序</h2>
              <p className="text-sm text-gray-500 mt-1">調整區域顯示順序，或隱藏不需要的區域</p>
            </div>
            
            <div className="p-4">
              <div className="space-y-2">
                {settings.sectionOrder?.map((section, index) => {
                  const option = SECTION_OPTIONS.find(o => o.id === section.id)
                  if (!option) return null
                  return (
                    <div 
                      key={section.id}
                      className={`flex items-center gap-4 p-3 rounded-lg border ${
                        section.enabled 
                          ? 'bg-gray-900/50 border-gray-800' 
                          : 'bg-gray-900/30 border-gray-800/50 opacity-50'
                      }`}
                    >
                      <span className="text-xl">{option.icon}</span>
                      <span className="flex-1 text-white font-medium">{option.label}</span>
                      
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
            className="flex-1 py-3 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? '保存中...' : '💾 保存設置'}
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

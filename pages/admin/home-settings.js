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
  getDocs 
} from 'firebase/firestore'
import { getAllArtists, getAllTabs } from '@/lib/tabs'

const SORT_OPTIONS = [
  { value: 'viewCount', label: '總瀏覽量', desc: '按歌手所有歌曲瀏覽總和排序' },
  { value: 'tabCount', label: '譜數目', desc: '按歌手歌曲數量排序' },
  { value: 'adminScore', label: 'Admin 評分', desc: '按 adminScore 分數排序' },
  { value: 'mixed', label: '混合排序', desc: '瀏覽量(50%) + 譜數(30%) + 評分(20%)' }
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
      displayCount: 20
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
  
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState('male')
  const [selectedArtists, setSelectedArtists] = useState([])
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
      <div className="max-w-4xl mx-auto px-4 py-8">
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

        {activeTab === 'artists' ? (
          <div className="bg-[#121212] rounded-xl border border-gray-800 mb-6 p-6">
            <h2 className="text-lg font-medium text-white mb-4">熱門歌手設置</h2>
            <p className="text-gray-500">功能開發中...</p>
          </div>
        ) : activeTab === 'tabs' ? (
          <div className="bg-[#121212] rounded-xl border border-gray-800 mb-6 p-6">
            <h2 className="text-lg font-medium text-white mb-4">熱門歌曲設置</h2>
            <p className="text-gray-500">功能開發中...</p>
          </div>
        ) : (
          <div className="bg-[#121212] rounded-xl border border-gray-800 mb-6">
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

        <div className="flex gap-4">
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

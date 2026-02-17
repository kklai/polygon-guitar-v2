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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // 設置狀態
  const [settings, setSettings] = useState({
    // 手動揀選歌手
    manualSelection: {
      male: [],
      female: [],
      group: []
    },
    // 是否啟用手動揀選
    useManualSelection: {
      male: false,
      female: false,
      group: false
    },
    // 熱門歌手排序方式
    hotArtistSortBy: 'viewCount',
    // 每類顯示數量
    displayCount: 20
  })
  
  // 搜尋同揀選狀態
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState('male')
  const [selectedArtists, setSelectedArtists] = useState([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [artistsData, settingsDoc] = await Promise.all([
        getAllArtists(),
        getDoc(doc(db, 'settings', 'home'))
      ])
      
      setArtists(artistsData)
      
      if (settingsDoc.exists()) {
        setSettings(prev => ({
          ...prev,
          ...settingsDoc.data()
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

  // 獲取某類別嘅歌手
  const getArtistsByCategory = (category) => {
    return artists.filter(a => (a.artistType || a.gender) === category)
  }

  // 搜尋結果
  const getSearchResults = () => {
    if (!searchTerm.trim()) return []
    const term = searchTerm.toLowerCase()
    return artists.filter(a => 
      a.name.toLowerCase().includes(term) &&
      (a.artistType || a.gender) === activeCategory
    ).slice(0, 10)
  }

  // 添加手動揀選
  const addManualArtist = (artist) => {
    const current = settings.manualSelection[activeCategory] || []
    if (current.find(a => a.id === artist.id)) return
    
    setSettings(prev => ({
      ...prev,
      manualSelection: {
        ...prev.manualSelection,
        [activeCategory]: [...current, artist]
      }
    }))
    setSearchTerm('')
  }

  // 移除手動揀選
  const removeManualArtist = (artistId) => {
    setSettings(prev => ({
      ...prev,
      manualSelection: {
        ...prev.manualSelection,
        [activeCategory]: prev.manualSelection[activeCategory].filter(a => a.id !== artistId)
      }
    }))
  }

  // 調整順序
  const moveArtist = (index, direction) => {
    const current = [...settings.manualSelection[activeCategory]]
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= current.length) return
    
    ;[current[index], current[newIndex]] = [current[newIndex], current[index]]
    
    setSettings(prev => ({
      ...prev,
      manualSelection: {
        ...prev.manualSelection,
        [activeCategory]: current
      }
    }))
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full mx-auto"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 pb-8">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-gray-800 -mx-4 px-4 py-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>🏠</span> 首頁設置
              </h1>
              <p className="text-sm text-[#B3B3B3]">管理熱門歌手顯示同排序</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/admin')}
                className="text-[#B3B3B3] hover:text-white transition"
              >
                返回後台
              </button>
            </div>
          </div>
        </div>

        {message && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-400">
            {message}
          </div>
        )}

        {/* 熱門歌手排序設置 */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 mb-6">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-lg font-medium text-white">🔥 熱門歌手排序方式</h2>
            <p className="text-sm text-gray-500 mt-1">選擇自動排序嘅方法（唔啟用手動揀選時使用）</p>
          </div>
          <div className="p-4 space-y-3">
            {SORT_OPTIONS.map(option => (
              <label 
                key={option.value}
                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition ${
                  settings.hotArtistSortBy === option.value 
                    ? 'bg-[#FFD700]/10 border border-[#FFD700]/50' 
                    : 'bg-gray-900/50 hover:bg-gray-900'
                }`}
              >
                <input
                  type="radio"
                  name="sortBy"
                  value={option.value}
                  checked={settings.hotArtistSortBy === option.value}
                  onChange={(e) => setSettings(prev => ({ ...prev, hotArtistSortBy: e.target.value }))}
                  className="mt-1 w-4 h-4 text-[#FFD700]"
                />
                <div>
                  <p className="text-white font-medium">{option.label}</p>
                  <p className="text-sm text-gray-500">{option.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 顯示數量 */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 mb-6">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-lg font-medium text-white">📊 顯示數量</h2>
          </div>
          <div className="p-4">
            <label className="block text-sm text-gray-400 mb-2">
              每類顯示歌手數量（{settings.displayCount}）
            </label>
            <input
              type="range"
              min="5"
              max="50"
              value={settings.displayCount}
              onChange={(e) => setSettings(prev => ({ ...prev, displayCount: parseInt(e.target.value) }))}
              className="w-full accent-[#FFD700]"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>5</span>
              <span>50</span>
            </div>
          </div>
        </div>

        {/* 手動揀選歌手 */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 mb-6">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-lg font-medium text-white">✋ 手動揀選歌手</h2>
            <p className="text-sm text-gray-500 mt-1">啟用手動揀選後，會優先顯示你揀嘅歌手</p>
          </div>
          
          {/* 類別 Tab */}
          <div className="flex border-b border-gray-800">
            {[
              { id: 'male', label: '男歌手' },
              { id: 'female', label: '女歌手' },
              { id: 'group', label: '組合' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-1 py-3 text-center font-medium transition ${
                  activeCategory === cat.id
                    ? 'text-[#FFD700] border-b-2 border-[#FFD700]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {cat.label}
                {settings.manualSelection[cat.id]?.length > 0 && (
                  <span className="ml-2 text-xs bg-[#FFD700] text-black px-2 py-0.5 rounded-full">
                    {settings.manualSelection[cat.id].length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* 啟用開關 */}
            <label className="flex items-center gap-3 mb-4 p-3 bg-gray-900/50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={settings.useManualSelection[activeCategory]}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  useManualSelection: {
                    ...prev.useManualSelection,
                    [activeCategory]: e.target.checked
                  }
                }))}
                className="w-5 h-5 text-[#FFD700] rounded"
              />
              <span className="text-white">
                啟用{activeCategory === 'male' ? '男歌手' : activeCategory === 'female' ? '女歌手' : '組合'}手動揀選
              </span>
            </label>

            {settings.useManualSelection[activeCategory] && (
              <>
                {/* 搜尋 */}
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder={`搜尋${activeCategory === 'male' ? '男歌手' : activeCategory === 'female' ? '女歌手' : '組合'}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#FFD700] focus:outline-none"
                  />
                  
                  {/* 搜尋結果 */}
                  {searchTerm && (
                    <div className="mt-2 bg-gray-900 rounded-lg border border-gray-700 max-h-48 overflow-y-auto">
                      {getSearchResults().length === 0 ? (
                        <p className="p-3 text-gray-500 text-center">找不到相關歌手</p>
                      ) : (
                        getSearchResults().map(artist => (
                          <button
                            key={artist.id}
                            onClick={() => addManualArtist(artist)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-gray-800 transition text-left"
                          >
                            {artist.photoURL || artist.wikiPhotoURL ? (
                              <img 
                                src={artist.photoURL || artist.wikiPhotoURL} 
                                alt={artist.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                                🎤
                              </div>
                            )}
                            <span className="text-white">{artist.name}</span>
                            <span className="ml-auto text-xs text-gray-500">
                              {artist.songCount || artist.tabCount || 0} 首
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* 已揀選列表 */}
                <div>
                  <p className="text-sm text-gray-400 mb-2">
                    已揀選（{settings.manualSelection[activeCategory]?.length || 0}）
                    <span className="text-xs ml-2">拖曳調整顯示順序</span>
                  </p>
                  
                  {settings.manualSelection[activeCategory]?.length === 0 ? (
                    <p className="p-4 bg-gray-900/50 rounded-lg text-gray-500 text-center">
                      尚未揀選任何歌手
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {settings.manualSelection[activeCategory].map((artist, index) => (
                        <div 
                          key={artist.id}
                          className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg"
                        >
                          <span className="text-gray-500 w-6">{index + 1}</span>
                          {artist.photoURL || artist.wikiPhotoURL ? (
                            <img 
                              src={artist.photoURL || artist.wikiPhotoURL} 
                              alt={artist.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                              🎤
                            </div>
                          )}
                          <span className="text-white flex-1">{artist.name}</span>
                          
                          {/* 排序按 */}
                          <div className="flex gap-1">
                            <button
                              onClick={() => moveArtist(index, -1)}
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveArtist(index, 1)}
                              disabled={index === settings.manualSelection[activeCategory].length - 1}
                              className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                            >
                              ↓
                            </button>
                          </div>
                          
                          <button
                            onClick={() => removeManualArtist(artist.id)}
                            className="p-2 text-red-400 hover:text-red-300"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 保存按 */}
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

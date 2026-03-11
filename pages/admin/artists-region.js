import { useState, useEffect } from 'react'
import { collection, getDocs, writeBatch, doc, updateDoc } from '@/lib/firestore-tracked'
import { db, auth } from '@/lib/firebase'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { X, Plus, MapPin } from 'lucide-react'

const REGIONS = [
  { value: 'hongkong', label: '香港', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { value: 'taiwan', label: '台灣', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'china', label: '中國', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { value: 'asia', label: '亞洲', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  { value: 'foreign', label: '外國', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
]

export default function ArtistsRegion() {
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedArtists, setSelectedArtists] = useState(new Set())
  const [batchRegions, setBatchRegions] = useState([])
  const [individualRegions, setIndividualRegions] = useState({})
  const [message, setMessage] = useState(null)

  // 載入歌手
  useEffect(() => {
    loadArtists()
  }, [])

  const loadArtists = async () => {
    try {
      const snap = await getDocs(collection(db, 'artists'))
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // 按名稱排序
      data.sort((a, b) => a.name.localeCompare(b.name, 'zh-HK'))
      setArtists(data)
      
      // 初始化個別地區設定（支援舊版單一地區轉陣列）
      const regions = {}
      data.forEach(a => {
        if (a.regions && Array.isArray(a.regions)) {
          regions[a.id] = a.regions
        } else if (a.region) {
          regions[a.id] = [a.region]
        } else {
          regions[a.id] = []
        }
      })
      setIndividualRegions(regions)
    } catch (error) {
      console.error('Error loading artists:', error)
      showMessage('載入失敗', 'error')
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  // 全選/取消全選
  const toggleSelectAll = () => {
    if (selectedArtists.size === artists.length) {
      setSelectedArtists(new Set())
    } else {
      setSelectedArtists(new Set(artists.map(a => a.id)))
    }
  }

  // 選擇單個歌手
  const toggleSelect = (id) => {
    const newSet = new Set(selectedArtists)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedArtists(newSet)
  }

  // 批次套用第一地區
  const applyBatchRegion = () => {
    if (batchRegions.length === 0 || selectedArtists.size === 0) return
    
    const newRegions = { ...individualRegions }
    selectedArtists.forEach(id => {
      // 批次設定為新的地區陣列
      newRegions[id] = [...batchRegions]
    })
    setIndividualRegions(newRegions)
    showMessage(`已設定 ${selectedArtists.size} 位歌手`)
  }

  // 添加批次地區
  const addBatchRegion = (region) => {
    if (!batchRegions.includes(region)) {
      setBatchRegions([...batchRegions, region])
    }
  }

  // 移除批次地區
  const removeBatchRegion = (region) => {
    setBatchRegions(batchRegions.filter(r => r !== region))
  }

  // 儲存到 Firestore
  const saveToFirestore = async () => {
    setSaving(true)
    try {
      let updateCount = 0
      const batch = writeBatch(db)
      
      artists.forEach(artist => {
        const newRegions = individualRegions[artist.id] || []
        const oldRegions = artist.regions || (artist.region ? [artist.region] : [])
        
        // 比較陣列內容是否相同
        const hasChanged = JSON.stringify(newRegions.sort()) !== JSON.stringify(oldRegions.sort())
        
        if (hasChanged) {
          const ref = doc(db, 'artists', artist.id)
          batch.update(ref, { 
            regions: newRegions,
            region: newRegions[0] || null, // 保留第一地區向後兼容
            updatedAt: new Date().toISOString()
          })
          updateCount++
        }
      })
      
      if (updateCount > 0) {
        await batch.commit()
        try {
          const token = await auth.currentUser?.getIdToken?.()
          if (token) await fetch('/api/admin/rebuild-search-cache', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
        } catch (_) {}
        showMessage(`已儲存 ${updateCount} 位歌手的更改，歌手頁地區篩選已更新`)
      } else {
        showMessage('沒有變更需要儲存')
      }
    } catch (error) {
      console.error('Error saving:', error)
      showMessage('儲存失敗', 'error')
    } finally {
      setSaving(false)
    }
  }

  // 儲存單個歌手
  const saveIndividual = async (id) => {
    try {
      const newRegions = individualRegions[id] || []
      const artist = artists.find(a => a.id === id)
      const oldRegions = artist.regions || (artist.region ? [artist.region] : [])
      
      const ref = doc(db, 'artists', id)
      await updateDoc(ref, {
        regions: newRegions,
        region: newRegions[0] || null,
        updatedAt: new Date().toISOString()
      })
      
      // 更新本地狀態
      setArtists(artists.map(a => a.id === id ? { 
        ...a, 
        regions: newRegions,
        region: newRegions[0] || null
      } : a))
      try {
        const token = await auth.currentUser?.getIdToken?.()
        if (token) await fetch('/api/admin/rebuild-search-cache', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      } catch (_) {}
      showMessage('儲存成功，歌手頁地區篩選已更新')
    } catch (error) {
      console.error('Error saving individual:', error)
      showMessage('儲存失敗', 'error')
    }
  }

  // 為個別歌手添加地區
  const addIndividualRegion = (artistId, region) => {
    const current = individualRegions[artistId] || []
    if (!current.includes(region) && current.length < 3) {
      setIndividualRegions(prev => ({
        ...prev,
        [artistId]: [...current, region]
      }))
    }
  }

  // 為個別歌手移除地區
  const removeIndividualRegion = (artistId, region) => {
    const current = individualRegions[artistId] || []
    setIndividualRegions(prev => ({
      ...prev,
      [artistId]: current.filter(r => r !== region)
    }))
  }

  // 獲取歌手當前地區陣列
  const getArtistRegions = (artistId) => {
    return individualRegions[artistId] || []
  }

  // 獲取地區標籤樣式
  const getRegionStyle = (region) => {
    return REGIONS.find(r => r.value === region)?.color || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  // 獲取地區名稱
  const getRegionLabel = (region) => {
    return REGIONS.find(r => r.value === region)?.label || region
  }

  if (loading) {
    return (
      <AdminGuard>
        <Layout>
          <div className="max-w-5xl mx-auto p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-800 rounded w-1/3"></div>
              <div className="h-64 bg-gray-800 rounded"></div>
            </div>
          </div>
        </Layout>
      </AdminGuard>
    )
  }

  return (
    <AdminGuard>
      <Layout>
        <div className="max-w-5xl mx-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">歌手地區管理</h1>
            <p className="text-gray-400">設定歌手所屬地區，可設定最多 3 個地區</p>
          </div>

          {/* Message */}
          {message && (
            <div className={`mb-4 p-3 rounded-lg ${
              message.type === 'error' 
                ? 'bg-red-900/50 text-red-200 border border-red-700' 
                : 'bg-green-900/50 text-green-200 border border-green-700'
            }`}>
              {message.text}
            </div>
          )}

          {/* 批次操作列 */}
          <div className="mb-6 p-4 bg-[#121212] rounded-xl border border-gray-800 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* 全選 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedArtists.size === artists.length && artists.length > 0}
                  onChange={toggleSelectAll}
                  className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-[#FFD700]"
                />
                <span className="text-white text-sm">
                  全選 ({selectedArtists.size}/{artists.length})
                </span>
              </label>

              <div className="w-px h-6 bg-gray-700"></div>

              {/* 批次地區選擇 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-400 text-sm">批次設定地區:</span>
                {batchRegions.map((region, idx) => (
                  <span 
                    key={region} 
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${getRegionStyle(region)}`}
                  >
                    {idx + 1}. {getRegionLabel(region)}
                    <button 
                      onClick={() => removeBatchRegion(region)}
                      className="hover:opacity-70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {batchRegions.length < 3 && (
                  <select
                    value=""
                    onChange={(e) => e.target.value && addBatchRegion(e.target.value)}
                    className="bg-[#1a1a1a] text-white text-sm px-3 py-1.5 rounded-lg border border-gray-700 outline-none"
                  >
                    <option value="">+ 添加地區 ({batchRegions.length + 1}/3)</option>
                    {REGIONS.filter(r => !batchRegions.includes(r.value)).map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* 套用按鈕 */}
              <button
                onClick={applyBatchRegion}
                disabled={batchRegions.length === 0 || selectedArtists.size === 0}
                className="px-4 py-2 bg-[#FFD700] text-black text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                套用
              </button>

              <div className="flex-1"></div>

              {/* 儲存全部 */}
              <button
                onClick={saveToFirestore}
                disabled={saving}
                className="px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
              >
                {saving ? '儲存中...' : '💾 儲存全部變更'}
              </button>
            </div>
          </div>

          {/* 歌手列表 */}
          <div className="bg-[#121212] rounded-xl border border-gray-800 overflow-hidden">
            {/* 表頭 */}
            <div className="grid grid-cols-12 gap-4 p-4 bg-[#1a1a1a] border-b border-gray-800 text-sm text-gray-400">
              <div className="col-span-1">選擇</div>
              <div className="col-span-3">歌手名稱</div>
              <div className="col-span-4">目前地區</div>
              <div className="col-span-3">新地區</div>
              <div className="col-span-1"></div>
            </div>

            {/* 列表內容 */}
            <div className="max-h-[60vh] overflow-y-auto">
              {artists.map((artist) => {
                const currentRegions = artist.regions || (artist.region ? [artist.region] : [])
                const newRegions = getArtistRegions(artist.id)
                const hasChanges = JSON.stringify(currentRegions.sort()) !== JSON.stringify(newRegions.sort())

                return (
                  <div 
                    key={artist.id}
                    className={`grid grid-cols-12 gap-4 p-4 border-b border-gray-800 items-center hover:bg-[#1a1a1a] transition ${
                      selectedArtists.has(artist.id) ? 'bg-[#1a1a1a]' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="col-span-1">
                      <input
                        type="checkbox"
                        checked={selectedArtists.has(artist.id)}
                        onChange={() => toggleSelect(artist.id)}
                        className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-[#FFD700]"
                      />
                    </div>

                    {/* 歌手名 */}
                    <div className="col-span-3">
                      <div className="flex items-center gap-3">
                        {artist.photoURL || artist.wikiPhotoURL ? (
                          <img 
                            src={artist.photoURL || artist.wikiPhotoURL}
                            alt={artist.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-lg">
                            🎤
                          </div>
                        )}
                        <span className="text-white font-medium truncate">{artist.name}</span>
                      </div>
                    </div>

                    {/* 目前地區 */}
                    <div className="col-span-4">
                      <div className="flex flex-wrap gap-1">
                        {currentRegions.length > 0 ? (
                          currentRegions.map((region, idx) => (
                            <span 
                              key={region}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${getRegionStyle(region)}`}
                            >
                              <MapPin className="w-3 h-3" />
                              {idx + 1}. {getRegionLabel(region)}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </div>
                    </div>

                    {/* 新地區選擇 */}
                    <div className="col-span-3">
                      <div className={`p-2 rounded-lg border ${hasChanges ? 'border-[#FFD700] bg-[#FFD700]/5' : 'border-gray-700 bg-[#1a1a1a]'}`}>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {newRegions.map((region, idx) => (
                            <span 
                              key={region}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${getRegionStyle(region)}`}
                            >
                              {idx + 1}. {getRegionLabel(region)}
                              <button 
                                onClick={() => removeIndividualRegion(artist.id, region)}
                                className="hover:opacity-70"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                        {newRegions.length < 3 && (
                          <select
                            value=""
                            onChange={(e) => e.target.value && addIndividualRegion(artist.id, e.target.value)}
                            className="w-full bg-black text-white text-xs px-2 py-1.5 rounded border border-gray-700 outline-none"
                          >
                            <option value="">+ 添加地區</option>
                            {REGIONS.filter(r => !newRegions.includes(r.value)).map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>

                    {/* 儲存按鈕 */}
                    <div className="col-span-1">
                      <button
                        onClick={() => saveIndividual(artist.id)}
                        disabled={!hasChanges}
                        className="px-3 py-1.5 bg-gray-700 text-white text-xs rounded-lg hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        儲存
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 統計 */}
          <div className="mt-4 text-sm text-gray-400 flex flex-wrap gap-4">
            <span>統計:</span>
            {REGIONS.map(r => {
              const count = artists.filter(a => {
                const regions = a.regions || (a.region ? [a.region] : [])
                return regions.includes(r.value)
              }).length
              return (
                <span key={r.value} className="flex items-center gap-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${r.color.split(' ')[0].replace('/20', '')}`}></span>
                  {r.label}: <span className="text-[#FFD700]">{count}</span>
                </span>
              )
            })}
            <span className="ml-4">
              未設定: <span className="text-gray-500">{artists.filter(a => !a.region && (!a.regions || a.regions.length === 0)).length}</span>
            </span>
          </div>

          {/* 說明 */}
          <div className="mt-6 p-4 bg-gray-800/50 rounded-lg text-sm text-gray-400">
            <h4 className="text-white font-medium mb-2">💡 使用說明</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>每位歌手可設定最多 3 個地區（例如：香港 + 台灣）</li>
              <li>第一地區會作為主要顯示地區</li>
              <li>批次操作：選擇歌手 → 設定地區 → 點擊套用</li>
              <li>已設定的地區會顯示序號（1.香港 2.台灣）</li>
            </ul>
          </div>
        </div>
      </Layout>
    </AdminGuard>
  )
}

import { useState, useEffect } from 'react'
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'

const REGIONS = [
  { value: 'hongkong', label: '香港' },
  { value: 'taiwan', label: '台灣' },
  { value: 'china', label: '中國' },
  { value: 'foreign', label: '外國' }
]

export default function ArtistsRegion() {
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedArtists, setSelectedArtists] = useState(new Set())
  const [batchRegion, setBatchRegion] = useState('')
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
      
      // 初始化個別地區設定
      const regions = {}
      data.forEach(a => {
        regions[a.id] = a.region || ''
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

  // 批次套用地區
  const applyBatchRegion = () => {
    if (!batchRegion || selectedArtists.size === 0) return
    
    const newRegions = { ...individualRegions }
    selectedArtists.forEach(id => {
      newRegions[id] = batchRegion
    })
    setIndividualRegions(newRegions)
    showMessage(`已設定 ${selectedArtists.size} 位歌手`)
  }

  // 儲存到 Firestore
  const saveToFirestore = async () => {
    setSaving(true)
    try {
      const batch = writeBatch(db)
      
      artists.forEach(artist => {
        const region = individualRegions[artist.id]
        if (region !== artist.region) {
          const ref = doc(db, 'artists', artist.id)
          batch.update(ref, { 
            region: region || null,
            updatedAt: new Date().toISOString()
          })
        }
      })
      
      await batch.commit()
      showMessage('儲存成功！')
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
      const ref = doc(db, 'artists', id)
      await batch.update(ref, {
        region: individualRegions[id] || null,
        updatedAt: new Date().toISOString()
      })
      showMessage('儲存成功')
    } catch (error) {
      showMessage('儲存失敗', 'error')
    }
  }

  if (loading) {
    return (
      <AdminGuard>
        <Layout>
          <div className="max-w-4xl mx-auto p-6">
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
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">歌手地區管理</h1>
            <p className="text-gray-400">批次設定歌手所屬地區</p>
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
          <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-[#121212] rounded-xl border border-gray-800">
            {/* 全選 */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedArtists.size === artists.length && artists.length > 0}
                onChange={toggleSelectAll}
                className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-[#FFD700] focus:ring-[#FFD700]"
              />
              <span className="text-white text-sm">
                全選 ({selectedArtists.size}/{artists.length})
              </span>
            </label>

            <div className="w-px h-6 bg-gray-700"></div>

            {/* 批次地區選擇 */}
            <select
              value={batchRegion}
              onChange={(e) => setBatchRegion(e.target.value)}
              className="bg-[#1a1a1a] text-white text-sm px-3 py-2 rounded-lg border border-gray-700 focus:border-[#FFD700] focus:outline-none"
            >
              <option value="">批次設定 ▼</option>
              {REGIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            {/* 套用按鈕 */}
            <button
              onClick={applyBatchRegion}
              disabled={!batchRegion || selectedArtists.size === 0}
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

          {/* 歌手列表 */}
          <div className="bg-[#121212] rounded-xl border border-gray-800 overflow-hidden">
            {/* 表頭 */}
            <div className="grid grid-cols-12 gap-4 p-4 bg-[#1a1a1a] border-b border-gray-800 text-sm text-gray-400">
              <div className="col-span-1">選擇</div>
              <div className="col-span-4">歌手名稱</div>
              <div className="col-span-3">目前地區</div>
              <div className="col-span-3">新地區</div>
              <div className="col-span-1"></div>
            </div>

            {/* 列表內容 */}
            <div className="max-h-[60vh] overflow-y-auto">
              {artists.map((artist) => (
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
                      className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-[#FFD700] focus:ring-[#FFD700]"
                    />
                  </div>

                  {/* 歌手名 */}
                  <div className="col-span-4">
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
                      <span className="text-white font-medium">{artist.name}</span>
                    </div>
                  </div>

                  {/* 目前地區 */}
                  <div className="col-span-3">
                    <span className={`text-sm ${
                      artist.region 
                        ? 'text-[#FFD700]' 
                        : 'text-gray-500'
                    }`}>
                      {artist.region 
                        ? REGIONS.find(r => r.value === artist.region)?.label || artist.region
                        : '-'
                      }
                    </span>
                  </div>

                  {/* 新地區選擇 */}
                  <div className="col-span-3">
                    <select
                      value={individualRegions[artist.id] || ''}
                      onChange={(e) => {
                        setIndividualRegions(prev => ({
                          ...prev,
                          [artist.id]: e.target.value
                        }))
                      }}
                      className={`w-full bg-[#1a1a1a] text-white text-sm px-3 py-2 rounded-lg border focus:outline-none ${
                        individualRegions[artist.id] !== artist.region
                          ? 'border-[#FFD700] text-[#FFD700]'
                          : 'border-gray-700'
                      }`}
                    >
                      <option value="">-</option>
                      {REGIONS.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* 儲存按鈕 */}
                  <div className="col-span-1">
                    <button
                      onClick={() => saveIndividual(artist.id)}
                      disabled={individualRegions[artist.id] === artist.region}
                      className="px-3 py-1.5 bg-gray-700 text-white text-xs rounded-lg hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      儲存
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 統計 */}
          <div className="mt-4 text-sm text-gray-400">
            統計：
            {REGIONS.map(r => {
              const count = artists.filter(a => a.region === r.value).length
              return (
                <span key={r.value} className="ml-4">
                  {r.label}: <span className="text-[#FFD700]">{count}</span>
                </span>
              )
            })}
            <span className="ml-4">
              未設定: <span className="text-gray-500">{artists.filter(a => !a.region).length}</span>
            </span>
          </div>
        </div>
      </Layout>
    </AdminGuard>
  )
}

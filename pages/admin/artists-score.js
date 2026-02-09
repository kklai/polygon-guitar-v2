import { useState, useEffect } from 'react'
import { collection, getDocs, writeBatch, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'

export default function ArtistsScore() {
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedArtists, setSelectedArtists] = useState(new Set())
  const [batchScore, setBatchScore] = useState('')
  const [individualScores, setIndividualScores] = useState({})
  const [message, setMessage] = useState(null)

  // 載入歌手
  useEffect(() => {
    loadArtists()
  }, [])

  const loadArtists = async () => {
    try {
      const snap = await getDocs(collection(db, 'artists'))
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // 按現有分數排序（高分在前），再按名稱
      data.sort((a, b) => {
        const scoreA = a.adminScore || 0
        const scoreB = b.adminScore || 0
        if (scoreB !== scoreA) return scoreB - scoreA
        return a.name.localeCompare(b.name, 'zh-HK')
      })
      setArtists(data)
      
      // 初始化個別分數
      const scores = {}
      data.forEach(a => {
        scores[a.id] = a.adminScore || ''
      })
      setIndividualScores(scores)
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

  // 批次套用分數
  const applyBatchScore = () => {
    const score = parseInt(batchScore)
    if (isNaN(score) || score < 0 || score > 1000) {
      showMessage('請輸入 0-1000 的有效分數', 'error')
      return
    }
    if (selectedArtists.size === 0) {
      showMessage('請先選擇歌手', 'error')
      return
    }
    
    const newScores = { ...individualScores }
    selectedArtists.forEach(id => {
      newScores[id] = score
    })
    setIndividualScores(newScores)
    showMessage(`已設定 ${selectedArtists.size} 位歌手為 ${score} 分`)
  }

  // 批次儲存到 Firestore
  const saveBatchToFirestore = async () => {
    if (selectedArtists.size === 0) {
      showMessage('請先選擇歌手', 'error')
      return
    }
    
    setSaving(true)
    try {
      const batch = writeBatch(db)
      
      selectedArtists.forEach(id => {
        const score = parseInt(individualScores[id]) || 0
        const ref = doc(db, 'artists', id)
        batch.update(ref, { 
          adminScore: score,
          updatedAt: new Date().toISOString()
        })
      })
      
      await batch.commit()
      showMessage(`成功儲存 ${selectedArtists.size} 位歌手！`)
      
      // 重新排序列表
      const updatedArtists = [...artists].sort((a, b) => {
        const scoreA = parseInt(individualScores[a.id]) || 0
        const scoreB = parseInt(individualScores[b.id]) || 0
        if (scoreB !== scoreA) return scoreB - scoreA
        return a.name.localeCompare(b.name, 'zh-HK')
      })
      setArtists(updatedArtists)
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
      const score = parseInt(individualScores[id]) || 0
      const ref = doc(db, 'artists', id)
      await updateDoc(ref, {
        adminScore: score,
        updatedAt: new Date().toISOString()
      })
      
      // 更新本地數據
      setArtists(prev => prev.map(a => 
        a.id === id ? { ...a, adminScore: score } : a
      ))
      
      showMessage('儲存成功')
    } catch (error) {
      console.error('Error saving individual:', error)
      showMessage('儲存失敗', 'error')
    }
  }

  // 儲存所有變更
  const saveAllChanges = async () => {
    setSaving(true)
    try {
      const batch = writeBatch(db)
      let changeCount = 0
      
      artists.forEach(artist => {
        const newScore = parseInt(individualScores[artist.id]) || 0
        const oldScore = artist.adminScore || 0
        
        if (newScore !== oldScore) {
          const ref = doc(db, 'artists', artist.id)
          batch.update(ref, { 
            adminScore: newScore,
            updatedAt: new Date().toISOString()
          })
          changeCount++
        }
      })
      
      if (changeCount > 0) {
        await batch.commit()
        showMessage(`成功儲存 ${changeCount} 位歌手！`)
      } else {
        showMessage('沒有變更需要儲存')
      }
    } catch (error) {
      console.error('Error saving all:', error)
      showMessage('儲存失敗', 'error')
    } finally {
      setSaving(false)
    }
  }

  // 快速分數按鈕
  const quickScores = [1000, 900, 800, 700, 600, 500, 400, 300, 200, 100, 0]

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
            <h1 className="text-2xl font-bold text-white mb-2">歌手評分管理</h1>
            <p className="text-gray-400">設定歌手推薦分數（0-1000），分數愈高排序愈前</p>
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
          <div className="flex flex-wrap items-center gap-3 mb-4 p-4 bg-[#121212] rounded-xl border border-gray-800">
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

            {/* 批次分數輸入 */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">批次設定分數：</span>
              <input
                type="number"
                min="0"
                max="1000"
                value={batchScore}
                onChange={(e) => setBatchScore(e.target.value)}
                placeholder="0-1000"
                className="w-24 bg-[#1a1a1a] text-white text-sm px-3 py-2 rounded-lg border border-gray-700 focus:border-[#FFD700] focus:outline-none"
              />
              <button
                onClick={applyBatchScore}
                disabled={!batchScore || selectedArtists.size === 0}
                className="px-4 py-2 bg-[#FFD700] text-black text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                套用
              </button>
            </div>

            <div className="flex-1"></div>

            {/* 儲存全部 */}
            <button
              onClick={saveAllChanges}
              disabled={saving}
              className="px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
            >
              {saving ? '儲存中...' : '💾 儲存全部變更'}
            </button>
          </div>

          {/* 快速分數按鈕 */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="text-gray-400 text-sm py-1">快速設定：</span>
            {quickScores.map(score => (
              <button
                key={score}
                onClick={() => setBatchScore(score.toString())}
                className="px-3 py-1 bg-[#1a1a1a] text-gray-300 text-xs rounded-lg border border-gray-700 hover:border-[#FFD700] hover:text-[#FFD700] transition"
              >
                {score}
              </button>
            ))}
          </div>

          {/* 歌手列表 */}
          <div className="bg-[#121212] rounded-xl border border-gray-800 overflow-hidden">
            {/* 表頭 */}
            <div className="grid grid-cols-12 gap-4 p-4 bg-[#1a1a1a] border-b border-gray-800 text-sm text-gray-400">
              <div className="col-span-1">選擇</div>
              <div className="col-span-4">歌手名稱</div>
              <div className="col-span-2">目前分數</div>
              <div className="col-span-3">新分數</div>
              <div className="col-span-2"></div>
            </div>

            {/* 列表內容 */}
            <div className="max-h-[60vh] overflow-y-auto">
              {artists.map((artist, index) => (
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
                      <span className="text-gray-500 text-xs w-6">{index + 1}</span>
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
                      <div>
                        <span className="text-white font-medium block">{artist.name}</span>
                        <span className="text-gray-500 text-xs">
                          {artist.songCount || 0} 首
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 目前分數 */}
                  <div className="col-span-2">
                    <span className={`text-lg font-bold ${
                      artist.adminScore 
                        ? artist.adminScore >= 800 ? 'text-[#FFD700]' 
                          : artist.adminScore >= 500 ? 'text-yellow-500'
                          : 'text-gray-400'
                        : 'text-gray-600'
                    }`}>
                      {artist.adminScore || 0}
                    </span>
                  </div>

                  {/* 新分數輸入 */}
                  <div className="col-span-3">
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={individualScores[artist.id] || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 1000)) {
                          setIndividualScores(prev => ({
                            ...prev,
                            [artist.id]: value
                          }))
                        }
                      }}
                      className={`w-full bg-[#1a1a1a] text-white text-sm px-3 py-2 rounded-lg border focus:outline-none ${
                        parseInt(individualScores[artist.id]) !== (artist.adminScore || 0)
                          ? 'border-[#FFD700] text-[#FFD700]'
                          : 'border-gray-700'
                      }`}
                      placeholder="0-1000"
                    />
                  </div>

                  {/* 儲存按鈕 */}
                  <div className="col-span-2 flex gap-2">
                    <button
                      onClick={() => saveIndividual(artist.id)}
                      disabled={parseInt(individualScores[artist.id]) === (artist.adminScore || 0)}
                      className="px-3 py-1.5 bg-gray-700 text-white text-xs rounded-lg hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      儲存
                    </button>
                    {parseInt(individualScores[artist.id]) !== (artist.adminScore || 0) && (
                      <span className="text-[#FFD700] text-xs flex items-center">●</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 統計 */}
          <div className="mt-4 flex flex-wrap gap-6 text-sm text-gray-400">
            <span>總歌手: <span className="text-white">{artists.length}</span></span>
            <span>已評分: <span className="text-[#FFD700]">{artists.filter(a => a.adminScore > 0).length}</span></span>
            <span>1000分: <span className="text-[#FFD700]">{artists.filter(a => a.adminScore === 1000).length}</span></span>
            <span>800-999分: <span className="text-yellow-500">{artists.filter(a => a.adminScore >= 800 && a.adminScore < 1000).length}</span></span>
            <span>500-799分: <span className="text-gray-300">{artists.filter(a => a.adminScore >= 500 && a.adminScore < 800).length}</span></span>
            <span>未評分: <span className="text-gray-600">{artists.filter(a => !a.adminScore).length}</span></span>
          </div>
        </div>
      </Layout>
    </AdminGuard>
  )
}

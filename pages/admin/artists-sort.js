import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { useAuth } from '@/contexts/AuthContext'
import { collection, getDocs, doc, writeBatch } from '@/lib/firestore-tracked'
import { db, auth } from '@/lib/firebase'
import Link from '@/components/Link'
import { Save, GripVertical, Mic } from 'lucide-react'

const DEFAULT_TIER = 5
const DISPLAY_ORDER_LAST = 999999

// 後台列表：Tier 優先，揀新 Tier 會即時重新排列；同 Tier 內再按 displayOrder、譜數
function sortByTierThenDisplayOrderTabCount(list) {
  return [...list].sort((a, b) => {
    const ta = a.tier ?? DEFAULT_TIER
    const tb = b.tier ?? DEFAULT_TIER
    if (ta !== tb) return ta - tb
    const oa = a.displayOrder ?? DISPLAY_ORDER_LAST
    const ob = b.displayOrder ?? DISPLAY_ORDER_LAST
    if (oa !== ob) return oa - ob
    const ca = a.songCount ?? a.tabCount ?? 0
    const cb = b.songCount ?? b.tabCount ?? 0
    if (cb !== ca) return cb - ca
    return (a.name || '').localeCompare(b.name || '')
  })
}
// 相容舊名（避免 cache 報錯）
const sortByDisplayOrderTierTabCount = sortByTierThenDisplayOrderTabCount

export default function ArtistsSortPage() {
  const { isAdmin } = useAuth()

  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('male')
  const [searchQuery, setSearchQuery] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [changedIds, setChangedIds] = useState(new Set())
  const [orderChanged, setOrderChanged] = useState(false)
  const [dragId, setDragId] = useState(null)

  useEffect(() => {
    if (isAdmin) loadArtists()
  }, [isAdmin])

  const loadArtists = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'artists'))
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      setArtists(sortByTierThenDisplayOrderTabCount(data))
      setHasChanges(false)
      setChangedIds(new Set())
      setOrderChanged(false)
    } catch (e) {
      console.error('載入歌手失敗:', e)
      alert('載入失敗')
    } finally {
      setLoading(false)
    }
  }

  const filteredArtists = artists.filter(artist => {
    const type = artist.artistType || artist.gender || 'other'
    const matchesTab =
      (activeTab === 'male' && (type === 'male' || type === '男')) ||
      (activeTab === 'female' && (type === 'female' || type === '女')) ||
      (activeTab === 'group' && (type === 'group' || type === 'band' || type === '組合' || type === '樂隊')) ||
      (activeTab === 'other' && !['male', 'female', 'group', 'band', '男', '女', '組合', '樂隊'].includes(type))
    const matchesSearch = !searchQuery.trim() || artist.name?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesTab && matchesSearch
  })

  const setTier = (artistId, tier) => {
    setArtists(prev => prev.map(a => (a.id === artistId ? { ...a, tier } : a)))
    setChangedIds(prev => new Set(prev).add(artistId))
    setHasChanges(true)
  }

  const handleDragStart = (e, artistId) => {
    setDragId(artistId)
    e.dataTransfer.setData('text/plain', artistId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnd = () => {
    setDragId(null)
  }

  const handleDrop = (e, dropTargetId) => {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('text/plain')
    if (!draggedId || draggedId === dropTargetId) {
      setDragId(null)
      return
    }
    const fromIdx = artists.findIndex(a => a.id === draggedId)
    const toIdx = artists.findIndex(a => a.id === dropTargetId)
    if (fromIdx === -1 || toIdx === -1) {
      setDragId(null)
      return
    }
    const next = [...artists]
    const [removed] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, removed)
    setArtists(next)
    setOrderChanged(true)
    setHasChanges(true)
    setDragId(null)
  }

  const saveChanges = async () => {
    if (!hasChanges) {
      alert('沒有更改需要儲存')
      return
    }
    setSaving(true)
    try {
      const batch = writeBatch(db)
      if (orderChanged) {
        artists.forEach((artist, i) => {
          batch.update(doc(db, 'artists', artist.id), {
            displayOrder: i + 1,
            tier: artist.tier ?? DEFAULT_TIER,
            updatedAt: new Date()
          })
        })
      } else {
        changedIds.forEach(id => {
          const artist = artists.find(a => a.id === id)
          if (artist) {
            batch.update(doc(db, 'artists', id), {
              tier: artist.tier ?? DEFAULT_TIER,
              updatedAt: new Date()
            })
          }
        })
      }
      await batch.commit()
      setHasChanges(false)
      setChangedIds(new Set())
      setOrderChanged(false)
      const msg = orderChanged ? `已儲存次序（共 ${artists.length} 位）` : `已儲存 ${changedIds.size} 位歌手的 Tier`
      // 重建歌手頁用的 search cache，等 /artists 即時跟到新次序
      try {
        const token = await auth.currentUser?.getIdToken?.()
        if (token) {
          await fetch('/api/admin/rebuild-search-cache', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
        }
      } catch (_) { /* 不阻擋成功訊息 */ }
      alert(`✅ ${msg}\n歌手頁 /artists 已更新次序。`)
    } catch (e) {
      console.error('儲存失敗:', e)
      alert('儲存失敗: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold text-white mb-4">無權訪問</h1>
          <p className="text-neutral-500">只有管理員可以使用此功能</p>
        </div>
      </Layout>
    )
  }

  const tabs = [
    { id: 'male', label: '男歌手', color: 'bg-blue-500' },
    { id: 'female', label: '女歌手', color: 'bg-pink-500' },
    { id: 'group', label: '組合', color: 'bg-purple-500' },
    { id: 'other', label: '其他', color: 'bg-neutral-500' }
  ]

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6 pb-24 px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">歌手排序</h1>
            <p className="text-neutral-500">
              次序：<strong className="text-[#FFD700]">Tier 1→2→3→4→5</strong>，同 Tier 以譜數多→少。
            </p>
          </div>
          <Link href="/admin/artists-v2" className="text-neutral-400 hover:text-white transition">
            返回歌手管理
          </Link>
        </div>

        <div className="bg-[#121212] rounded-xl border border-neutral-800 p-4 space-y-4">
          <div className="relative">
            <input
              type="text"
              placeholder="搜尋歌手名..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[#282828] border-0 rounded-full text-white placeholder-[#666] outline-none"
            />
            <svg className="absolute left-3 top-3.5 w-5 h-5 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                  activeTab === tab.id ? 'bg-[#FFD700] text-black' : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                {tab.label}
                <span className="ml-2 text-sm opacity-60">
                  ({artists.filter(a => {
                    const t = a.artistType || a.gender || 'other'
                    if (tab.id === 'male') return t === 'male' || t === '男'
                    if (tab.id === 'female') return t === 'female' || t === '女'
                    if (tab.id === 'group') return ['group', 'band', '組合', '樂隊'].includes(t)
                    return !['male', 'female', 'group', 'band', '男', '女', '組合', '樂隊'].includes(t)
                  }).length})
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={saveChanges}
            disabled={saving || !hasChanges}
            className={`px-5 py-2.5 rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2 ${
              hasChanges ? 'bg-[#FFD700] text-black hover:opacity-90' : 'bg-neutral-600 text-neutral-300'
            }`}
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                儲存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {hasChanges ? (orderChanged ? '儲存 (次序)' : `儲存 (${changedIds.size})`) : '無更改'}
              </>
            )}
          </button>
        </div>

        <div className="bg-[#121212] rounded-xl border border-neutral-800 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-0">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-11 bg-neutral-800 rounded animate-pulse" />
              ))}
            </div>
          ) : filteredArtists.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">找不到符合的歌手</div>
          ) : (
            <div className="divide-y divide-neutral-800">
              {filteredArtists.map((artist, index) => {
                const type = artist.artistType || artist.gender || 'other'
                const count = artist.songCount || artist.tabCount || 0
                const badgeColor =
                  type === 'male' ? 'bg-blue-600/80 text-white' :
                  type === 'female' ? 'bg-pink-600/80 text-white' :
                  type === 'group' ? 'bg-amber-600/80 text-white' : 'bg-neutral-600 text-neutral-200'
                const currentTier = artist.tier ?? DEFAULT_TIER
                return (
                  <div
                    key={artist.id}
                    className={`flex items-center gap-3 py-2.5 px-4 hover:bg-neutral-800/30 ${dragId === artist.id ? 'opacity-60' : ''}`}
                    onDragOver={handleDragOver}
                    onDrop={e => handleDrop(e, artist.id)}
                  >
                    <div
                      draggable
                      onDragStart={e => handleDragStart(e, artist.id)}
                      onDragEnd={handleDragEnd}
                      className="shrink-0 p-1 rounded cursor-grab active:cursor-grabbing text-neutral-500 hover:text-neutral-300 touch-none"
                      title="拖曳改變次序"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <span className={`w-6 text-center text-sm font-bold shrink-0 ${index < 3 ? 'text-[#FFD700]' : 'text-neutral-500'}`}>
                      {index + 1}
                    </span>

                    <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0">
                      {artist.photoURL || artist.wikiPhotoURL ? (
                        <img src={artist.photoURL || artist.wikiPhotoURL} alt={artist.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-500"><Mic className="w-5 h-5" strokeWidth={1.5} /></div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <Link href={`/artists/${artist.id}/edit`} className="text-white font-medium truncate text-sm hover:text-[#FFD700] transition">
                        {artist.name}
                      </Link>
                      <span className={`min-w-[1.25rem] px-1.5 py-0.5 rounded text-xs font-medium text-center shrink-0 ${badgeColor}`}>
                        {count}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {[1, 2, 3, 4, 5].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTier(artist.id, t)}
                          className={`w-8 h-7 rounded text-xs font-bold transition ${
                            currentTier === t
                              ? 'bg-[#FFD700] text-black'
                              : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600 hover:text-white'
                          }`}
                          title={`Tier ${t}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { getAllTabs } from '@/lib/tabs'
import { db, auth } from '@/lib/firebase'
import { doc, writeBatch } from '@/lib/firestore-tracked'
import { useArtistMap } from '@/lib/useArtistMap'
import { ArrowLeft, PenLine, Loader2, Undo2 } from 'lucide-react'

const BATCH_SIZE = 500

export default function BatchUploaderPenName() {
  const { isAdmin } = useAuth()
  const { getArtistName } = useArtistMap()
  const [tabs, setTabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [newPenName, setNewPenName] = useState('')
  const [message, setMessage] = useState(null)
  const [filterPenName, setFilterPenName] = useState('')
  const [searchText, setSearchText] = useState('')
  /** 上一次批量更新嘅復原資料：{ id, previousPenName }[]，用於「復原」掣 */
  const [lastUndoData, setLastUndoData] = useState(null)

  useEffect(() => {
    if (isAdmin) loadTabs()
  }, [isAdmin])

  const loadTabs = async () => {
    setLoading(true)
    setLastUndoData(null)
    try {
      const data = await getAllTabs()
      setTabs(Array.isArray(data) ? data : [])
      setSelectedIds(new Set())
    } catch (e) {
      console.error(e)
      setMessage({ type: 'error', text: '載入樂譜失敗：' + (e?.message || e) })
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }

  const uniquePenNames = [...new Set(tabs.map(t => (t.uploaderPenName || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-HK'))

  const filteredTabs = tabs.filter(t => {
    const matchFilter = !filterPenName || (t.uploaderPenName || '').trim() === filterPenName
    const q = (searchText || '').trim().toLowerCase()
    const matchSearch = !q ||
      (t.title || '').toLowerCase().includes(q) ||
      (getArtistName(t) || '').toLowerCase().includes(q) ||
      (t.uploaderPenName || '').toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  const toggleSelect = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const toggleSelectAllFiltered = () => {
    if (selectedIds.size === filteredTabs.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredTabs.map(t => t.id)))
    }
  }

  const applyBatch = async () => {
    const name = (newPenName || '').trim()
    if (!name) {
      showMessage('請輸入新的出譜者名稱', 'error')
      return
    }
    const toUpdate = filteredTabs.filter(t => selectedIds.has(t.id))
    const ids = toUpdate.map(t => t.id)
    if (ids.length === 0) {
      showMessage('請至少勾選一張樂譜', 'error')
      return
    }
    const undoData = toUpdate.map(t => ({ id: t.id, previousPenName: t.uploaderPenName || '' }))
    setSaving(true)
    try {
      let updated = 0
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = writeBatch(db)
        const chunk = ids.slice(i, i + BATCH_SIZE)
        for (const id of chunk) {
          batch.update(doc(db, 'tabs', id), {
            uploaderPenName: name,
            updatedAt: new Date().toISOString()
          })
          updated++
        }
        await batch.commit()
      }
      setTabs(prev => prev.map(t => selectedIds.has(t.id) ? { ...t, uploaderPenName: name } : t))
      setSelectedIds(new Set())
      setLastUndoData(undoData)
      showMessage(`已更新 ${updated} 張樂譜的出譜者名稱為「${name}」。可撳「復原」還原。`)
      try {
        const token = await auth.currentUser?.getIdToken?.()
        if (token) {
          await fetch('/api/admin/rebuild-all-tabs-cache', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
        }
      } catch (_) {}
    } catch (e) {
      console.error(e)
      showMessage('更新失敗：' + (e?.message || e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const undoLastBatch = async () => {
    if (!lastUndoData || lastUndoData.length === 0 || saving) return
    setSaving(true)
    try {
      for (let i = 0; i < lastUndoData.length; i += BATCH_SIZE) {
        const batch = writeBatch(db)
        const chunk = lastUndoData.slice(i, i + BATCH_SIZE)
        for (const { id, previousPenName } of chunk) {
          batch.update(doc(db, 'tabs', id), {
            uploaderPenName: previousPenName,
            updatedAt: new Date().toISOString()
          })
        }
        await batch.commit()
      }
      setTabs(prev => prev.map(t => {
        const entry = lastUndoData.find(u => u.id === t.id)
        return entry ? { ...t, uploaderPenName: entry.previousPenName } : t
      }))
      setLastUndoData(null)
      showMessage(`已復原 ${lastUndoData.length} 張樂譜的出譜者名稱`)
      try {
        const token = await auth.currentUser?.getIdToken?.()
        if (token) {
          await fetch('/api/admin/rebuild-all-tabs-cache', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
        }
      } catch (_) {}
    } catch (e) {
      console.error(e)
      showMessage('復原失敗：' + (e?.message || e), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-[#121212] rounded-xl p-8 text-center">
            <p className="text-neutral-400">請以管理員身份登入</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <Head>
        <title>批量改出譜者名稱 | 後台 | Polygon Guitar</title>
      </Head>
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <Link href="/admin" className="inline-flex items-center gap-1 text-[#B3B3B3] hover:text-[#FFD700] text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> 返回後台
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
          <PenLine className="w-6 h-6 text-[#FFD700]" />
          批量改出譜者名稱
        </h1>
        <p className="text-[#B3B3B3] text-sm mt-1 mb-4">勾選樂譜後，將佢哋嘅出譜者名稱一併改為同一名稱。</p>

        {message && (
          <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${message.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-[#FFD700]/20 text-[#FFD700]'}`}>
            {message.text}
          </div>
        )}

        <div className="bg-[#121212] rounded-xl border border-neutral-800 p-4 mb-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-[#B3B3B3] mb-1">篩選目前出譜者名稱</label>
              <select
                value={filterPenName}
                onChange={e => setFilterPenName(e.target.value)}
                className="bg-black border border-neutral-600 rounded-lg px-3 py-2 text-white text-sm min-w-[140px]"
              >
                <option value="">全部</option>
                {uniquePenNames.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#B3B3B3] mb-1">搜尋歌名 / 歌手 / 出譜者</label>
              <input
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="關鍵字"
                className="bg-black border border-neutral-600 rounded-lg px-3 py-2 text-white text-sm w-48"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-[#B3B3B3] mb-1">新出譜者名稱（套用至勾選項目）</label>
              <input
                type="text"
                value={newPenName}
                onChange={e => setNewPenName(e.target.value)}
                placeholder="例如：結他友"
                className="w-full bg-black border border-neutral-600 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <button
              type="button"
              onClick={applyBatch}
              disabled={saving || selectedIds.size === 0 || !newPenName.trim()}
              className="px-4 py-2 rounded-lg bg-[#FFD700] text-black font-medium text-sm hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              批量更新（已選 {selectedIds.size} 張）
            </button>
            {lastUndoData && lastUndoData.length > 0 && (
              <button
                type="button"
                onClick={undoLastBatch}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-neutral-500 text-[#B3B3B3] font-medium text-sm hover:text-white hover:border-neutral-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title="將剛才批量更新嘅樂譜還原為原本的出譜者名稱"
              >
                <Undo2 className="w-4 h-4" />
                復原上一步（{lastUndoData.length} 張）
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-[#B3B3B3]">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="bg-[#121212] rounded-xl border border-neutral-800 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-800 bg-black/40">
              <input
                type="checkbox"
                checked={filteredTabs.length > 0 && selectedIds.size === filteredTabs.length}
                onChange={toggleSelectAllFiltered}
                className="rounded border-neutral-600 text-[#FFD700] focus:ring-[#FFD700]"
              />
              <span className="text-[#B3B3B3] text-sm">全選目前篩選（{filteredTabs.length} 張）</span>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[#121212] border-b border-neutral-800">
                  <tr>
                    <th className="w-10 px-4 py-2 text-[#B3B3B3] font-normal">選</th>
                    <th className="px-4 py-2 text-[#B3B3B3] font-normal">歌名</th>
                    <th className="px-4 py-2 text-[#B3B3B3] font-normal">歌手</th>
                    <th className="px-4 py-2 text-[#B3B3B3] font-normal">目前出譜者</th>
                    <th className="w-16 px-4 py-2 text-[#B3B3B3] font-normal">連結</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTabs.map(tab => (
                    <tr key={tab.id} className="border-b border-neutral-800/80 hover:bg-[#181818]">
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(tab.id)}
                          onChange={() => toggleSelect(tab.id)}
                          className="rounded border-neutral-600 text-[#FFD700] focus:ring-[#FFD700]"
                        />
                      </td>
                      <td className="px-4 py-2 truncate max-w-[180px]" title={tab.title}>
                        <Link href={`/tabs/${tab.id}`} target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#FFD700] hover:underline">
                          {tab.title || '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-[#B3B3B3] truncate max-w-[140px]">{getArtistName(tab) || '—'}</td>
                      <td className="px-4 py-2 text-[#B3B3B3]">{tab.uploaderPenName || '—'}</td>
                      <td className="px-4 py-2">
                        <Link href={`/tabs/${tab.id}`} target="_blank" rel="noopener noreferrer" className="text-[#FFD700] hover:underline">
                          開
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredTabs.length === 0 && (
              <div className="px-4 py-8 text-center text-[#B3B3B3]">無符合篩選的樂譜</div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

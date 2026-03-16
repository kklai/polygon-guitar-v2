import Head from 'next/head'
import { useState, useEffect, useMemo } from 'react'
import Layout from '@/components/Layout'
import Link from '@/components/Link'
import { useAuth } from '@/contexts/AuthContext'
import { auth } from '@/lib/firebase'
import { useArtistMap } from '@/lib/useArtistMap'
import { ArrowLeft, UserPlus, Search } from 'lucide-react'

export default function AssignTabsToUser() {
  const { user, isAdmin } = useAuth()
  const { getArtistName } = useArtistMap()
  const [users, setUsers] = useState([])
  const [tabs, setTabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [penNameFilter, setPenNameFilter] = useState('')
  const [onlyUnassigned, setOnlyUnassigned] = useState(false)
  const [tabIdInput, setTabIdInput] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedTabIds, setSelectedTabIds] = useState(new Set())
  const [updatePenName, setUpdatePenName] = useState(true)
  const [skipCacheRebuild, setSkipCacheRebuild] = useState(false)
  const [userSearch, setUserSearch] = useState('')

  useEffect(() => {
    if (isAdmin && user) {
      loadData()
    }
  }, [isAdmin, user])

  const loadData = async () => {
    setLoading(true)
    try {
      const token = await auth.currentUser?.getIdToken?.()
      if (!token) {
        setMessage('請先登入')
        return
      }
      const res = await fetch('/api/admin/assign-tabs-data', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(data.error || '載入資料失敗')
        return
      }
      setUsers(data.users || [])
      setTabs(data.tabs || [])
    } catch (e) {
      console.error(e)
      setMessage('載入失敗: ' + (e?.message || ''))
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = useMemo(() => {
    const q = (userSearch || '').toLowerCase().trim()
    if (!q) return users.slice(0, 50)
    return users.filter(
      (u) =>
        (u.penName || '').toLowerCase().includes(q) ||
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    ).slice(0, 50)
  }, [users, userSearch])

  const filteredTabs = useMemo(() => {
    let list = tabs
    const pen = (penNameFilter || '').trim().toLowerCase()
    if (pen) {
      list = list.filter((tab) => {
        const name = (tab.uploaderPenName || tab.arrangedBy || '').toLowerCase()
        return name.includes(pen)
      })
    }
    if (onlyUnassigned) {
      list = list.filter((tab) => !tab.createdBy)
    }
    const ids = tabIdInput
      .split(/[\s,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (ids.length > 0) {
      const idSet = new Set(ids)
      list = list.filter((tab) => idSet.has(tab.id))
    }
    return list
  }, [tabs, penNameFilter, onlyUnassigned, tabIdInput])

  const toggleTab = (id) => {
    setSelectedTabIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllTabs = () => {
    if (selectedTabIds.size >= filteredTabs.length) {
      setSelectedTabIds(new Set())
    } else {
      setSelectedTabIds(new Set(filteredTabs.map((t) => t.id)))
    }
  }

  const handleSubmit = async () => {
    const targetUserId = selectedUser?.id ?? null
    const ids = Array.from(selectedTabIds)
    if (ids.length === 0) {
      setMessage('請至少選擇一張樂譜')
      return
    }
    setSubmitting(true)
    setMessage(null)
    try {
      const token = await auth.currentUser?.getIdToken?.()
      if (!token) {
        setMessage('請先登入')
        return
      }
      const res = await fetch('/api/admin/assign-tabs-to-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tabIds: ids,
          targetUserId: targetUserId || null,
          updatePenName: !!targetUserId && updatePenName,
          skipCacheRebuild
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(data.error || res.statusText || '移植失敗')
        return
      }
      const failDetail = data.failed?.length
        ? `；${data.failed.length} 份失敗${data.failed[0]?.error ? `（${data.failed[0].error}）` : ''}`
        : ''
      setMessage(
        `已移植 ${data.successCount} 份${data.cacheRebuilt ? '，已重建樂譜快取' : ''}${failDetail}${data.cacheError ? `；快取重建失敗：${data.cacheError}` : ''}`
      )
      if (data.successCount > 0) {
        setSelectedTabIds(new Set())
        loadData()
      }
    } catch (e) {
      console.error(e)
      setMessage('移植失敗: ' + (e?.message || ''))
    } finally {
      setSubmitting(false)
    }
  }

  const getUserDisplay = (uid) => {
    if (!uid) return '未移植'
    const u = users.find((x) => x.id === uid)
    return u ? (u.penName || u.displayName || u.email || uid) : uid
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto p-8">
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
        <title>樂譜移植 | 後台 | Polygon Guitar</title>
      </Head>
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/admin"
            className="text-[#B3B3B3] hover:text-white transition-colors"
            aria-label="返回後台"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl md:text-2xl font-bold text-white">樂譜移植</h1>
        </div>
        <p className="text-[#B3B3B3] text-sm mb-6">
          將樂譜的「出譜者」歸到指定用戶主頁，該譜會顯示在該用戶的個人主頁，且出譜者連結會指向該用戶。
        </p>

        {message && (
          <div
            className={`mb-4 px-4 py-2 rounded-lg text-sm ${message.includes('失敗') || message.includes('請') ? 'bg-red-500/20 text-red-300' : 'bg-[#FFD700]/20 text-[#FFD700]'}`}
          >
            {message}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* 選擇目標用戶 */}
            <section className="bg-[#121212] rounded-xl border border-neutral-800 p-4 mb-6">
              <h2 className="text-white font-semibold flex items-center gap-2 mb-3">
                <UserPlus className="w-4 h-4" />
                目標用戶（移植後樂譜會顯示在此用戶主頁）
              </h2>
              <div className="flex flex-col sm:flex-row gap-3 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="搜尋筆名、顯示名稱或 email"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#1a1a1a] border border-neutral-700 rounded-lg text-white placeholder-neutral-500 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUser(selectedUser?.id === u.id ? null : u)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                      selectedUser?.id === u.id
                        ? 'bg-[#FFD700] text-black border-[#FFD700]'
                        : 'bg-[#282828] text-white border-neutral-600 hover:border-neutral-500'
                    }`}
                  >
                    {u.penName || u.displayName || u.email || u.id}
                  </button>
                ))}
              </div>
              {selectedUser && (
                <p className="text-[#B3B3B3] text-xs mt-2">
                  已選：{selectedUser.penName || selectedUser.displayName}（{selectedUser.email || selectedUser.id}）
                </p>
              )}
              <p className="text-neutral-500 text-xs mt-2">
                留空並勾選樂譜後執行 = 清除移植（出譜者不連結到任何主頁）
              </p>
            </section>

            {/* 篩選樂譜 */}
            <section className="bg-[#121212] rounded-xl border border-neutral-800 p-4 mb-6">
              <h2 className="text-white font-semibold mb-3">選擇樂譜</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  placeholder="按筆名篩選（uploaderPenName）"
                  value={penNameFilter}
                  onChange={(e) => setPenNameFilter(e.target.value)}
                  className="px-3 py-2 bg-[#1a1a1a] border border-neutral-700 rounded-lg text-white placeholder-neutral-500 text-sm"
                />
                <label className="flex items-center gap-2 text-neutral-300 text-sm">
                  <input
                    type="checkbox"
                    checked={onlyUnassigned}
                    onChange={(e) => setOnlyUnassigned(e.target.checked)}
                    className="rounded border-neutral-600 bg-[#1a1a1a] text-[#FFD700] focus:ring-[#FFD700]"
                  />
                  只顯示未移植
                </label>
              </div>
              <textarea
                placeholder="或輸入 Tab ID（多個以逗號/換行分隔）"
                value={tabIdInput}
                onChange={(e) => setTabIdInput(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-neutral-700 rounded-lg text-white placeholder-neutral-500 text-sm resize-none"
              />
              <p className="text-neutral-500 text-xs mt-1">符合筆名或 ID 的樂譜共 {filteredTabs.length} 份</p>
            </section>

            {/* 樂譜列表 */}
            <section className="bg-[#121212] rounded-xl border border-neutral-800 overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between flex-wrap gap-2">
                <span className="text-white font-medium">樂譜列表</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={selectAllTabs}
                    className="text-sm text-[#FFD700] hover:underline"
                  >
                    {selectedTabIds.size >= filteredTabs.length && filteredTabs.length > 0 ? '取消全選' : '全選'}
                  </button>
                  <span className="text-neutral-400 text-sm">已選 {selectedTabIds.size} 份</span>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#1a1a1a] sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left w-8" />
                      <th className="px-3 py-2 text-left text-neutral-400 font-medium">歌名</th>
                      <th className="px-3 py-2 text-left text-neutral-400 font-medium">歌手</th>
                      <th className="px-3 py-2 text-left text-neutral-400 font-medium">筆名</th>
                      <th className="px-3 py-2 text-left text-neutral-400 font-medium">目前移植</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {filteredTabs.slice(0, 200).map((tab) => (
                      <tr key={tab.id} className="hover:bg-white/5">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedTabIds.has(tab.id)}
                            onChange={() => toggleTab(tab.id)}
                            className="rounded border-neutral-600 bg-[#1a1a1a] text-[#FFD700] focus:ring-[#FFD700]"
                          />
                        </td>
                        <td className="px-3 py-2 text-white truncate max-w-[140px]">
                          <a href={`/tabs/${tab.id}`} target="_blank" rel="noopener noreferrer" className="hover:text-[#FFD700]">
                            {tab.title || tab.id}
                          </a>
                        </td>
                        <td className="px-3 py-2 text-neutral-400 truncate max-w-[100px]">
                          {getArtistName(tab)}
                        </td>
                        <td className="px-3 py-2 text-[#FFD700] truncate max-w-[100px]">
                          {tab.uploaderPenName || tab.arrangedBy || '—'}
                        </td>
                        <td className="px-3 py-2 text-neutral-500 text-xs">
                          {getUserDisplay(tab.createdBy)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredTabs.length > 200 && (
                <p className="px-4 py-2 text-neutral-500 text-xs border-t border-neutral-800">僅顯示前 200 筆，請用筆名或 ID 縮小範圍</p>
              )}
            </section>

            {/* 選項與執行 */}
            <section className="bg-[#121212] rounded-xl border border-neutral-800 p-4 mb-6">
              <label className="flex items-center gap-2 text-neutral-300 text-sm mb-2">
                <input
                  type="checkbox"
                  checked={updatePenName}
                  onChange={(e) => setUpdatePenName(e.target.checked)}
                  className="rounded border-neutral-600 bg-[#1a1a1a] text-[#FFD700] focus:ring-[#FFD700]"
                />
                同時將筆名更新為該用戶的筆名（已選目標用戶時有效）
              </label>
              <label className="flex items-center gap-2 text-neutral-300 text-sm mb-4">
                <input
                  type="checkbox"
                  checked={skipCacheRebuild}
                  onChange={(e) => setSkipCacheRebuild(e.target.checked)}
                  className="rounded border-neutral-600 bg-[#1a1a1a] text-[#FFD700] focus:ring-[#FFD700]"
                />
                略過重建樂譜快取（配額緊張時可勾選，稍後可到 首頁設置 手動重建）
              </label>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || selectedTabIds.size === 0}
                className="px-4 py-2 bg-[#FFD700] text-black font-medium rounded-lg hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '處理中...' : `執行移植（${selectedTabIds.size} 份）`}
              </button>
              <p className="text-neutral-500 text-xs mt-2">
                {skipCacheRebuild ? '已勾選略過快取重建，請稍後到 首頁設置 手動重建樂譜快取' : '成功後會自動重建樂譜列表快取（約 3000+ 次讀取）'}
              </p>
            </section>
          </>
        )}
      </div>
    </Layout>
  )
}

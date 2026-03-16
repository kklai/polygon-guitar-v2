import { useState } from 'react'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { auth } from '@/lib/firebase'

export default function DebugTabArtistPage() {
  const { user, isAdmin } = useAuth()
  const [tabId, setTabId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleCheck = async () => {
    const id = (tabId || '').trim()
    if (!id) {
      setError('Enter a tab ID')
      return
    }
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const token = await auth.currentUser?.getIdToken?.()
      if (!token) {
        setError('Not logged in')
        return
      }
      const res = await fetch(`/api/debug/tab-artist?tabId=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || res.statusText || 'Request failed')
        return
      }
      setResult(data)
    } catch (e) {
      setError(e?.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto p-6 text-center text-[#B3B3B3]">
          <p className="mb-4">請先登入。</p>
          <a href="/login" className="text-[#FFD700] underline">前往登入</a>
        </div>
      </Layout>
    )
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto p-6 text-center text-[#B3B3B3]">
          <p>此頁面僅供管理員使用。</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-xl font-bold text-white mb-2">Check tab → artist</h1>
        <p className="text-[#B3B3B3] text-sm mb-4">
          See why a song might not show on the artist page (artistId, artist doc, match).
        </p>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={tabId}
            onChange={(e) => setTabId(e.target.value)}
            placeholder="Tab ID (e.g. G5IIyUTQTq3Qu2OZavLE)"
            className="flex-1 px-4 py-2 bg-[#121212] border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3]"
          />
          <button
            type="button"
            onClick={handleCheck}
            disabled={loading}
            className="px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:bg-yellow-400 disabled:opacity-50"
          >
            {loading ? 'Checking…' : 'Check'}
          </button>
        </div>
        {error && (
          <div className="p-3 rounded-lg bg-red-900/30 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}
        {result && (
          <div className="p-4 bg-[#121212] border border-gray-800 rounded-lg">
            <p className="text-[#FFD700] font-medium mb-2">{result.reason}</p>
            <pre className="text-[#B3B3B3] text-xs overflow-x-auto whitespace-pre-wrap break-words">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Layout>
  )
}

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getArtistRequests, addTabRequest } from '@/lib/comments'

export default function ArtistTabRequests({ artistId, artistName }) {
  const { user, userProfile } = useAuth()
  const [requests, setRequests] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [songTitle, setSongTitle] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadRequests()
  }, [artistId])

  const loadRequests = async () => {
    try {
      const data = await getArtistRequests(artistId)
      setRequests(data)
    } catch (error) {
      console.error('Error loading requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user || !songTitle.trim()) return

    setSubmitting(true)
    try {
      await addTabRequest(
        artistId,
        user.uid,
        userProfile?.penName || user.displayName || '匿名用戶',
        songTitle,
        message
      )
      setSongTitle('')
      setMessage('')
      setShowForm(false)
      loadRequests()
    } catch (error) {
      console.error('Error adding request:', error)
      alert('求譜失敗：' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('zh-HK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="mt-8 pt-6 border-t border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">
          🙏 求譜 ({pendingCount} 待處理)
        </h3>
        {user && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 bg-[#FFD700] text-black text-xs font-medium rounded-lg hover:opacity-90 transition"
          >
            {showForm ? '取消' : '求新譜'}
          </button>
        )}
      </div>

      {/* 求譜表單 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#121212] rounded-lg p-4 mb-4 space-y-3">
          <div>
            <label className="block text-gray-400 text-xs mb-1">歌曲名稱 *</label>
            <input
              type="text"
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              placeholder={`想求 ${artistName} 嘅邊首歌？`}
              className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white text-sm placeholder-gray-500 focus:border-[#FFD700] focus:outline-none"
              maxLength={100}
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">補充說明（可選）</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="例如：想要簡單版、原調版本等..."
              className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white text-sm placeholder-gray-500 focus:border-[#FFD700] focus:outline-none resize-none"
              rows={2}
              maxLength={200}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-gray-400 text-sm hover:text-white transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!songTitle.trim() || submitting}
              className="px-4 py-2 bg-[#FFD700] text-black text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? '提交中...' : '提交求譜'}
            </button>
          </div>
        </form>
      )}

      {/* 求譜列表 */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-gray-500 text-center py-4">載入中...</div>
        ) : requests.length === 0 ? (
          <div className="text-gray-500 text-center py-6 bg-[#121212] rounded-lg">
            <p className="text-sm">暫時冇求譜</p>
            <p className="text-xs mt-1">有想聽嘅歌？快啲提出求譜！</p>
          </div>
        ) : (
          requests.map(request => (
            <div 
              key={request.id} 
              className={`bg-[#121212] rounded-lg p-3 ${
                request.status === 'completed' ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-sm font-medium">
                      {request.songTitle}
                    </span>
                    {request.status === 'completed' ? (
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-900 text-green-400 rounded">
                        已完成
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 bg-yellow-900 text-yellow-400 rounded">
                        等待中
                      </span>
                    )}
                  </div>
                  {request.message && (
                    <p className="text-gray-400 text-xs mb-1">
                      {request.message}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{request.userName}</span>
                    <span>•</span>
                    <span>{formatTime(request.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {!user && (
        <div className="text-center py-4 bg-[#121212] rounded-lg mt-4">
          <p className="text-gray-400 text-sm mb-2">登入後即可求譜</p>
          <a
            href="/login"
            className="text-[#FFD700] text-sm hover:underline"
          >
            前往登入 →
          </a>
        </div>
      )}
    </div>
  )
}

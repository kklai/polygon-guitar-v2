import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getTabComments, addTabComment } from '@/lib/comments'

export default function TabComments({ tabId }) {
  const { user, userProfile } = useAuth()
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadComments()
  }, [tabId])

  const loadComments = async () => {
    try {
      const data = await getTabComments(tabId)
      setComments(data)
    } catch (error) {
      console.error('Error loading comments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user || !newComment.trim()) return

    setSubmitting(true)
    try {
      await addTabComment(
        tabId,
        user.uid,
        userProfile?.penName || user.displayName || '匿名用戶',
        newComment
      )
      setNewComment('')
      loadComments()
    } catch (error) {
      console.error('Error adding comment:', error)
      alert('留言失敗：' + error.message)
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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="mt-8 pt-6 border-t border-gray-800">
      <h3 className="text-lg font-bold text-white mb-4">
        💬 留言 ({comments.length})
      </h3>

      {/* 留言列表 */}
      <div className="space-y-4 mb-6">
        {loading ? (
          <div className="text-gray-500 text-center py-4">載入中...</div>
        ) : comments.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            暫時冇留言，成為第一個留言的人！
          </div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="bg-[#121212] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[#FFD700] text-sm font-medium">
                  {comment.userName}
                </span>
                <span className="text-gray-600 text-xs">
                  {formatTime(comment.createdAt)}
                </span>
              </div>
              <p className="text-gray-300 text-sm whitespace-pre-wrap">
                {comment.content}
              </p>
            </div>
          ))
        )}
      </div>

      {/* 留言輸入 */}
      {user ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="分享你對呢份譜嘅感想..."
            className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-white text-sm placeholder-gray-500 focus:border-[#FFD700] focus:outline-none resize-none"
            rows={3}
            maxLength={500}
          />
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-xs">
              {newComment.length}/500
            </span>
            <button
              type="submit"
              disabled={!newComment.trim() || submitting}
              className="px-4 py-2 bg-[#FFD700] text-black text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? '發表中...' : '發表留言'}
            </button>
          </div>
        </form>
      ) : (
        <div className="text-center py-4 bg-[#121212] rounded-lg">
          <p className="text-gray-400 text-sm mb-2">登入後即可留言</p>
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

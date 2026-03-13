import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getTabComments, addTabComment, deleteTabComment } from '@/lib/comments'
import { Trash2 } from 'lucide-react'

export default function TabComments({ tabId }) {
  const { user, userProfile, userRole } = useAuth()
  const isSuperAdmin = userRole === 'super_admin'
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

  const handleDelete = async (commentId) => {
    if (!confirm('確定刪除此留言？')) return
    try {
      await deleteTabComment(commentId)
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch (error) {
      alert('刪除失敗：' + error.message)
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
    <div className="mt-4">

      {/* 留言列表 */}
      <div className="space-y-4 mb-6">
        {loading ? (
          <div className="text-neutral-500 text-center py-4">載入中...</div>
        ) : comments.length === 0 ? null : (
          comments.map(comment => (
            <div key={comment.id} className="bg-[#121212] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[#FFD700] text-sm font-medium">
                  {comment.userName}
                </span>
                <span className="text-neutral-600 text-xs">
                  {formatTime(comment.createdAt)}
                </span>
                {isSuperAdmin && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="ml-auto p-1 text-neutral-600 hover:text-red-500 transition"
                    title="刪除留言"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-neutral-300 text-sm whitespace-pre-wrap">
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
            className="w-full bg-[#121212] border border-neutral-700 rounded-lg p-3 text-white text-sm placeholder-neutral-500 outline-none resize-none"
            rows={3}
            maxLength={500}
          />
          <div className="flex justify-between items-center">
            <span className="text-neutral-500 text-xs">
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
          <p className="text-neutral-400 text-sm mb-2">登入後即可留言</p>
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

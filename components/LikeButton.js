import { useState, useEffect } from 'react'
import { checkIsLiked, toggleLikeSong } from '@/lib/playlistApi'
import { useAuth } from '@/contexts/AuthContext'

const LOGIN_MESSAGE = '請先登入後即可收藏喜愛的結他譜'

export default function LikeButton({ tab, onLikeToggle, compact = false }) {
  const { user, isAuthenticated } = useAuth()
  const [liked, setLiked] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const likeCount = tab?.likes ?? 0

  // 登入後從 userLikedSongs 讀取是否已喜愛（會顯示在收藏頁「喜愛結他譜」）
  useEffect(() => {
    if (!tab?.id || !user?.uid) {
      setLiked(false)
      return
    }
    let cancelled = false
    checkIsLiked(user.uid, tab.id).then((isLiked) => {
      if (!cancelled) setLiked(isLiked)
    })
    return () => { cancelled = true }
  }, [tab?.id, user?.uid])

  const handleClick = async () => {
    if (!isAuthenticated || !user) {
      alert(LOGIN_MESSAGE)
      return
    }

    if (isLoading) return

    setIsLoading(true)
    try {
      const result = await toggleLikeSong(user.uid, tab.id)
      setLiked(result.isLiked)
      if (onLikeToggle) {
        onLikeToggle(result)
      }
    } catch (error) {
      console.error('Like error:', error)
      alert('收藏失敗，請重試')
    } finally {
      setIsLoading(false)
    }
  }

  if (compact) {
    return (
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg transition ${
          liked
            ? 'bg-[#FFD700] text-black'
            : 'bg-gray-800 text-[#B3B3B3]'
        } ${isLoading ? 'opacity-50' : ''}`}
        title={liked ? '已收藏至喜愛結他譜' : '收藏至喜愛結他譜'}
      >
        <svg
          className={`w-4 h-4 ${liked ? 'fill-current' : 'stroke-current fill-none'}`}
          viewBox="0 0 24 24"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
        <span className="text-xs">{likeCount}</span>
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition ${
        liked
          ? 'bg-[#FFD700] text-black hover:opacity-90'
          : 'bg-[#121212] text-[#B3B3B3] hover:text-white border border-gray-800'
      } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={liked ? '已收藏至喜愛結他譜' : '收藏至喜愛結他譜'}
    >
      <svg
        className={`w-5 h-5 ${liked ? 'fill-current' : 'stroke-current fill-none'}`}
        viewBox="0 0 24 24"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
      <span>{likeCount} {liked ? '已收藏' : '收藏'}</span>
    </button>
  )
}

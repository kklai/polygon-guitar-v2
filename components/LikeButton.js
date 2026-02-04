import { useState } from 'react'
import { toggleLike, hasUserLiked } from '@/lib/tabs'
import { useAuth } from '@/contexts/AuthContext'

export default function LikeButton({ tab, onLikeToggle, compact = false }) {
  const { user, isAuthenticated } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [liked, setLiked] = useState(hasUserLiked(tab, user?.uid))
  const [likeCount, setLikeCount] = useState(tab.likes || 0)

  const handleClick = async () => {
    if (!isAuthenticated) {
      alert('請先登入才能讚好')
      return
    }

    if (isLoading) return

    setIsLoading(true)
    try {
      const result = await toggleLike(tab.id, user.uid)
      setLiked(result.liked)
      setLikeCount(result.likes)
      if (onLikeToggle) {
        onLikeToggle(result)
      }
    } catch (error) {
      console.error('Like error:', error)
      alert('讚好失敗，請重試')
    } finally {
      setIsLoading(false)
    }
  }

  if (compact) {
    // 手機版精簡模式
    return (
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg transition ${
          liked
            ? 'bg-[#FFD700] text-black'
            : 'bg-gray-800 text-[#B3B3B3]'
        } ${isLoading ? 'opacity-50' : ''}`}
        title={liked ? '已讚好' : '讚好'}
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
      <span>{likeCount} {liked ? '已讚' : '讚好'}</span>
    </button>
  )
}

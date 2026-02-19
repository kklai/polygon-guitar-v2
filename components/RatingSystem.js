import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { submitRating, getUserRating, getTabStats } from '@/lib/ratingApi'

/**
 * 星星評分組件
 * @param {string} tabId - 樂譜 ID
 * @param {boolean} showStats - 是否顯示統計
 * @param {string} size - 尺寸 'sm' | 'md' | 'lg'
 * @param {boolean} readonly - 是否只讀
 */
export default function RatingSystem({ 
  tabId, 
  showStats = true, 
  size = 'md',
  readonly = false 
}) {
  const { user } = useAuth()
  const [userRating, setUserRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [stats, setStats] = useState({
    averageRating: 0,
    ratingCount: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showDetails, setShowDetails] = useState(false)

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  // 載入評分數據
  useEffect(() => {
    if (!tabId) return
    loadRatingData()
  }, [tabId, user])

  const loadRatingData = async () => {
    // 獲取樂譜統計
    const tabStats = await getTabStats(tabId)
    setStats(tabStats)

    // 獲取用戶評分
    if (user) {
      const rating = await getUserRating(user.uid, tabId)
      if (rating) {
        setUserRating(rating)
      }
    }
  }

  const handleStarClick = async (rating) => {
    if (readonly || !user) return

    setLoading(true)
    setMessage('')

    try {
      const result = await submitRating(user.uid, tabId, rating)
      
      if (result.success) {
        setUserRating(result.userRating)
        // 重新載入統計
        const tabStats = await getTabStats(tabId)
        setStats(tabStats)
        setMessage(result.action === 'removed' ? '評分已取消' : '評分已提交')
        setTimeout(() => setMessage(''), 2000)
      }
    } catch (error) {
      setMessage('提交失敗: ' + error.message)
    }

    setLoading(false)
  }

  // 渲染星星
  const renderStars = (count, isInteractive = false) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = isInteractive 
            ? (hoverRating || userRating) >= star
            : count >= star
          
          return (
            <button
              key={star}
              type="button"
              disabled={readonly || loading || !user}
              onClick={() => handleStarClick(star)}
              onMouseEnter={() => isInteractive && setHoverRating(star)}
              onMouseLeave={() => isInteractive && setHoverRating(0)}
              className={`
                ${sizeClasses[size]}
                ${isInteractive && !readonly && user ? 'cursor-pointer' : 'cursor-default'}
                transition-colors duration-150
                ${isFilled ? 'text-[#FFD700]' : 'text-gray-600'}
                ${isInteractive && !readonly && user && 'hover:scale-110'}
              `}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="inline-flex flex-col">
      {/* 主要評分區 */}
      <div className="flex items-center gap-3">
        {/* 星星 */}
        {renderStars(userRating, true)}
        
        {/* 統計數字 */}
        {showStats && stats.ratingCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#FFD700] font-medium">
              {stats.averageRating.toFixed(1)}
            </span>
            <span className="text-gray-500">
              ({stats.ratingCount})
            </span>
          </div>
        )}
        
        {/* 詳情展開按鈕 */}
        {showStats && stats.ratingCount > 0 && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-gray-500 hover:text-white text-xs transition"
          >
            {showDetails ? '收起' : '詳情'}
          </button>
        )}
      </div>

      {/* 提示訊息 */}
      {message && (
        <span className={`text-xs mt-1 ${message.includes('失敗') ? 'text-red-400' : 'text-green-400'}`}>
          {message}
        </span>
      )}

      {/* 未登入提示 */}
      {!user && !readonly && (
        <span className="text-xs text-gray-500 mt-1">
          登入後可評分
        </span>
      )}

      {/* 詳細統計 */}
      {showDetails && stats.ratingCount > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.distribution?.[star] || 0
              const percentage = stats.ratingCount > 0 
                ? (count / stats.ratingCount) * 100 
                : 0
              
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 w-3">{star}</span>
                  <svg className="w-3 h-3 text-[#FFD700]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                  <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#FFD700] rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-gray-500 w-6 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 簡化版評分顯示（只讀）
 */
export function RatingDisplay({ rating, count, size = 'sm' }) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`${sizeClasses[size]} ${rating >= star ? 'text-[#FFD700]' : 'text-gray-700'}`}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        ))}
      </div>
      {count !== undefined && (
        <span className="text-xs text-gray-500">({count})</span>
      )}
    </div>
  )
}

// components/RatingSystem.js
import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { submitRating, getUserRating } from '../lib/ratingApi';
import { auth } from '../lib/firebase';

export default function RatingSystem({ tabId, averageRating = 0, ratingCount = 0, size = 'md', showCount = true, onRatingUpdate }) {
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [localAvg, setLocalAvg] = useState(averageRating);
  const [localCount, setLocalCount] = useState(ratingCount);
  const user = auth.currentUser;

  const starSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  useEffect(() => {
    setLocalAvg(averageRating);
    setLocalCount(ratingCount);
  }, [averageRating, ratingCount]);

  useEffect(() => {
    if (user && tabId) {
      loadUserRating();
    }
  }, [user, tabId]);

  const loadUserRating = async () => {
    const rating = await getUserRating(user.uid, tabId);
    if (rating) setUserRating(rating);
  };

  const handleRate = async (rating) => {
    if (!user) {
      alert('請先登入');
      return;
    }

    setIsLoading(true);
    try {
      const result = await submitRating(user.uid, tabId, rating);
      setUserRating(result.userRating);
      setLocalAvg(result.newAverage);
      setLocalCount(result.newCount);
      onRatingUpdate?.(result.newAverage, result.newCount, result.userRating);
    } catch (error) {
      console.error('評分失敗:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const displayRating = hoverRating || userRating;
  const displayAvg = localAvg || 0;

  return (
    <div className="flex items-center space-x-1">
      <div className="flex items-center space-x-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => !isLoading && handleRate(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            disabled={isLoading}
            className="focus:outline-none transition-transform hover:scale-110 disabled:opacity-50"
          >
            <Star
              className={`${starSizes[size]} ${
                star <= displayRating
                  ? 'text-[#FFD700] fill-[#FFD700]'
                  : star <= displayAvg
                    ? 'text-[#FFD700] fill-[#FFD700] opacity-40'
                    : 'text-[#3E3E3E]'
              }`}
            />
          </button>
        ))}
      </div>
      
      {showCount && (
        <span className="text-[#B3B3B3] text-xs ml-1">
          {localCount > 0 ? `${displayAvg.toFixed(1)} (${localCount})` : '暫無評分'}
        </span>
      )}
      
      {userRating > 0 && !hoverRating && (
        <span className="text-[#FFD700] text-xs ml-1 hidden sm:inline">你已評 {userRating} 星</span>
      )}
    </div>
  );
}

/**
 * 簡化版評分顯示（只讀）
 */
export function RatingDisplay({ rating, count, size = 'sm' }) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`${sizeClasses[size]} ${rating >= star ? 'text-[#FFD700] fill-[#FFD700]' : 'text-[#3E3E3E]'}`}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        ))}
      </div>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-[#B3B3B3]">({count})</span>
      )}
    </div>
  );
}

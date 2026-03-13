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
    <div className="px-4 py-4 flex flex-col items-center gap-3 bg-[#1a1a1a]">
      <div className="flex items-center gap-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => !isLoading && handleRate(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            disabled={isLoading}
            className="outline-none transition-transform hover:scale-110 disabled:opacity-50"
          >
            <Star
              className={`w-6 h-6 ${
                star <= displayRating
                  ? 'text-[#FFD700] fill-[#FFD700]'
                  : star <= displayAvg
                    ? 'text-[#FFD700] fill-[#FFD700] opacity-40'
                    : 'text-neutral-500'
              }`}
              strokeWidth={1.2}
            />
          </button>
        ))}
      </div>

    </div>
  );
}

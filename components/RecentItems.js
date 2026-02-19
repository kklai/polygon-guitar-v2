import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export default function RecentItems() {
  const router = useRouter();
  const { user } = useAuth();
  const [recentItems, setRecentItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchRecentViews = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          // 取最近10個，按時間排序
          const sorted = (data.recentViews || [])
            .sort((a, b) => {
              const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
              const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
              return timeB - timeA;
            })
            .slice(0, 10);
          setRecentItems(sorted);
        }
      } catch (error) {
        console.error('Error fetching recent views:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentViews();
  }, [user]);

  const handleClick = (item) => {
    if (item.type === 'song' || item.type === 'tab') {
      router.push(`/tabs/${item.itemId}`);
    } else if (item.type === 'artist') {
      router.push(`/artists/${item.itemId}`);
    } else if (item.type === 'playlist') {
      router.push(`/playlist/${item.itemId}`);
    }
  };

  // 獲取項目圖標
  const getIcon = (type) => {
    switch (type) {
      case 'artist':
        return (
          <svg className="w-8 h-8 text-[#FFD700]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'playlist':
        return (
          <svg className="w-8 h-8 text-[#FFD700]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-8 h-8 text-[#FFD700]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
          </svg>
        );
    }
  };

  // 獲取類型標籤
  const getTypeLabel = (type) => {
    switch (type) {
      case 'artist': return '歌手';
      case 'playlist': return '收藏';
      case 'song':
      case 'tab':
      default: return '歌曲';
    }
  };

  if (loading) {
    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3 px-4">
          <h2 className="text-white text-lg font-bold">最近瀏覽</h2>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex space-x-4 px-4 pb-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex-shrink-0 animate-pulse" style={{ width: '100px' }}>
                <div className="aspect-square rounded-[4px] bg-gray-800 mb-2" />
                <div className="h-4 bg-gray-800 rounded w-3/4 mx-auto" />
                <div className="h-3 bg-gray-800 rounded w-1/2 mx-auto mt-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 未登入或冇數據時顯示提示
  if (recentItems.length === 0) {
    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3 px-4">
          <h2 className="text-white text-lg font-bold">最近瀏覽</h2>
        </div>
        <div className="px-4">
          <div className="bg-[#121212] rounded-lg p-4 text-center">
            <p className="text-gray-500 text-sm">
              {user ? '開始瀏覽歌曲同歌手，呢度會顯示你最近睇過嘅內容' : '登入後可以睇到最近瀏覽記錄'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-3 px-4">
        <h2 className="text-white text-lg font-bold">最近瀏覽</h2>
        <button 
          onClick={() => router.push('/library')}
          className="text-[#B3B3B3] text-sm hover:text-white"
        >
          瀏覽全部
        </button>
      </div>
      
      {/* 橫向滾動容器 */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex space-x-4 px-4 pb-2">
          {recentItems.map((item, index) => (
            <div 
              key={index}
              onClick={() => handleClick(item)}
              className="flex-shrink-0 cursor-pointer group"
              style={{ width: '100px' }}
            >
              {/* 圖片區域 */}
              <div className={`
                relative overflow-hidden mb-2 bg-[#121212]
                ${item.type === 'artist' ? 'rounded-full aspect-square' : 'rounded-[4px] aspect-square'}
              `}>
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {getIcon(item.type)}
                  </div>
                )}
                
                {/* 收藏標記（歌單/喜愛歌曲） */}
                {item.type === 'playlist' && item.isLikedSongs && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              
              {/* 文字資訊 */}
              <div className="text-center">
                <p className="text-white text-sm font-medium truncate">
                  {item.title}
                </p>
                <p className="text-[#B3B3B3] text-xs truncate mt-0.5">
                  {item.type === 'artist' ? '歌手' : item.subtitle || getTypeLabel(item.type)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

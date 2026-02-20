// components/RecentItems.js
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { User, Music, BookmarkPlus, Heart } from 'lucide-react';

export default function RecentItems({ items = [] }) {
  const router = useRouter();
  const { user } = useAuth();

  const handleClick = (item) => {
    if (item.type === 'tab') {
      router.push(`/tabs/${item.id}`);
    } else if (item.type === 'artist') {
      router.push(`/artists/${item.slug || item.id}`);
    } else if (item.type === 'playlist') {
      router.push(`/playlist/${item.id}`);
    } else if (item.type === 'liked-songs') {
      router.push('/library/liked');
    }
  };

  // 過濾：如果用戶未登入，過濾掉 liked-songs
  const displayItems = user 
    ? items 
    : items.filter(item => item.type !== 'liked-songs');

  if (displayItems.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2 px-6">
        <h2 className="text-white text-xl font-bold">最近瀏覽</h2>
        <button 
          onClick={() => router.push('/history')}
          className="text-[#B3B3B3] text-sm hover:text-white"
        >
          瀏覽全部
        </button>
      </div>
      
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex space-x-4 px-6">
          {displayItems.map((item, index) => (
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
                {item.image ? (
                  <img 
                    src={item.image} 
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                ) : item.type === 'liked-songs' ? (
                  // 我的喜愛特殊樣式
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#FFD700] to-[#FFA500]">
                    <Heart className="w-10 h-10 text-white fill-white" />
                  </div>
                ) : item.type === 'artist' ? (
                  <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
                    <User className="w-8 h-8 text-[#3E3E3E]" />
                  </div>
                ) : item.type === 'playlist' ? (
                  <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
                    <BookmarkPlus className="w-8 h-8 text-[#3E3E3E]" />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
                    <Music className="w-8 h-8 text-[#3E3E3E]" />
                  </div>
                )}
                
                {/* 歌單2x2預覽（如果有 covers） */}
                {item.type === 'playlist' && item.covers && item.covers.length > 0 && (
                  <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-0.5 bg-[#121212]">
                    {item.covers.map((cover, i) => (
                      <img key={i} src={cover} className="w-full h-full object-cover" alt="" />
                    ))}
                    {Array(4 - item.covers.length).fill(0).map((_, i) => (
                      <div key={`empty-${i}`} className="bg-[#282828] w-full h-full" />
                    ))}
                  </div>
                )}
              </div>
              
              {/* 文字資訊 */}
              <div className="text-center">
                <p className="text-white text-sm font-medium truncate leading-tight">
                  {item.title}
                </p>
                <p className="text-[#B3B3B3] text-xs truncate mt-0.5">
                  {item.subtitle || item.artistName || ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

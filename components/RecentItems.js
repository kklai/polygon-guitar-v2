// components/RecentItems.js
import { useRouter } from 'next/router';

// SVG 圖標
const UserIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const MusicIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
  </svg>
);

const BookmarkIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);

export default function RecentItems({ items = [] }) {
  const router = useRouter();

  const handleClick = (item) => {
    if (item.type === 'tab') {
      router.push(`/tabs/${item.id}`);
    } else if (item.type === 'artist') {
      router.push(`/artists/${item.slug || item.id}`);
    } else if (item.type === 'playlist') {
      router.push(`/playlist/${item.id}`);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-3 px-4">
        <h2 className="text-white text-lg font-bold">最近瀏覽</h2>
        <button 
          onClick={() => router.push('/history')}
          className="text-[#B3B3B3] text-sm hover:text-white"
        >
          瀏覽全部
        </button>
      </div>
      
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex space-x-4 px-4 pb-2">
          {items.map((item, index) => (
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
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a] text-[#3E3E3E]">
                    {item.type === 'artist' ? <UserIcon /> : item.type === 'playlist' ? <BookmarkIcon /> : <MusicIcon />}
                  </div>
                )}
                
                {/* 喜愛結他譜特殊標記 */}
                {item.type === 'playlist' && item.isLiked && (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center">
                    <svg className="w-10 h-10 text-white fill-white" viewBox="0 0 24 24">
                      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" fill="currentColor"/>
                    </svg>
                  </div>
                )}
              </div>
              
              {/* 文字資訊 */}
              <div className="text-center">
                <p className="text-white text-sm font-medium truncate leading-tight">
                  {item.title}
                </p>
                <p className="text-[#B3B3B3] text-xs truncate mt-0.5">
                  {item.type === 'artist' ? '歌手' : item.subtitle || item.artist || '收藏'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

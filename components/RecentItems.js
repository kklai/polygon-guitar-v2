// components/RecentItems.js
import { useRouter } from 'next/router';
import { User, Music, BookmarkPlus } from 'lucide-react';

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
                  <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
                    {item.type === 'artist' ? (
                      <User className="w-8 h-8 text-[#3E3E3E]" />
                    ) : item.type === 'playlist' ? (
                      <BookmarkPlus className="w-8 h-8 text-[#3E3E3E]" />
                    ) : (
                      <Music className="w-8 h-8 text-[#3E3E3E]" />
                    )}
                  </div>
                )}
                
                {/* 喜愛結他譜特殊標記 */}
                {item.type === 'playlist' && item.isLikedSongs && (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center">
                    <BookmarkPlus className="w-10 h-10 text-white fill-white" />
                  </div>
                )}
                
                {/* 歌單2x2預覽 */}
                {item.type === 'playlist' && item.covers && item.covers.length > 0 && !item.isLikedSongs && (
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
                  {item.type === 'artist' ? '歌手' : item.subtitle || item.artistName || '收藏'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

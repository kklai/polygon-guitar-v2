// pages/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import Image from 'next/image';
import { 
  Home, 
  Search, 
  User, 
  BookmarkPlus, 
  Plus, 
  Menu,
  ChevronRight 
} from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [recentItems, setRecentItems] = useState([]);
  const [hotTabs, setHotTabs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      loadRecentItems();
      loadHotTabs();
    });
    return () => unsubscribe();
  }, []);

  // 載入最近瀏覽（從 localStorage 或 API）
  const loadRecentItems = () => {
    // 模擬數據，實際應從 localStorage 或用戶記錄讀取
    const saved = localStorage.getItem('recentViews');
    if (saved) {
      setRecentItems(JSON.parse(saved).slice(0, 10));
    } else {
      // 預設顯示
      setRecentItems([
        { type: 'tab', id: '1', title: '梨子', artist: '陳健安 On Chan', image: '/covers/default.jpg' },
        { type: 'tab', id: '2', title: '記憶棉', artist: 'MC 張天賦', image: '/covers/default.jpg' },
        { type: 'artist', id: 'hungkaho', title: '洪嘉豪', subtitle: '歌手', image: '/artists/hungkaho.jpg' },
      ]);
    }
  };

  // 載入熱門結他譜
  const loadHotTabs = async () => {
    try {
      const q = query(
        collection(db, 'tabs'),
        orderBy('viewCount', 'desc'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      const tabs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHotTabs(tabs);
    } catch (error) {
      console.error('載入熱門譜失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  // 處理最近瀏覽項目點擊
  const handleRecentClick = (item) => {
    if (item.type === 'tab') {
      router.push(`/tabs/${item.id}`);
    } else if (item.type === 'artist') {
      router.push(`/artists/${item.id}`);
    } else if (item.type === 'playlist') {
      router.push(`/playlist/${item.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* 頂部 Header - 黃色背景 */}
      <header className="bg-[#FFD700] px-4 pt-6 pb-4">
        <div className="flex justify-between items-start">
          <div>
            {/* Logo */}
            <div className="flex items-center mb-1">
              <div className="w-8 h-8 mr-2">
                {/* 你的 Logo SVG */}
                <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-black">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h1 className="text-2xl font-black text-black tracking-tight">POLYGON</h1>
            </div>
            {/* 副標題 - 香港廣東歌結他譜網 */}
            <p className="text-black text-sm font-medium tracking-widest opacity-80">
              香港廣東歌結他譜網
            </p>
          </div>
          
          {/* 漢堡菜單（可選） */}
          <button className="p-2 text-black">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* 主要內容 */}
      <div className="px-4 mt-4">
        
        {/* ==================== 分類區域（男/女/組合）==================== */}
        <section className="mb-8">
          <div className="grid grid-cols-3 gap-3">
            {/* 男歌手 - 藍色標籤 */}
            <div 
              onClick={() => router.push('/artists?gender=male')}
              className="aspect-square rounded-[4px] overflow-hidden relative cursor-pointer group"
            >
              <img 
                src="/categories/male.jpg" 
                alt="男歌手"
                className="w-full h-full object-cover"
              />
              {/* 藍色半透明遮罩 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              {/* 藍色標籤 */}
              <div className="absolute bottom-3 left-3 bg-[#3B82F6] bg-opacity-90 px-3 py-1.5 rounded">
                <span className="text-white font-bold text-base">男歌手</span>
              </div>
            </div>

            {/* 女歌手 - 粉紅/橙色標籤 */}
            <div 
              onClick={() => router.push('/artists?gender=female')}
              className="aspect-square rounded-[4px] overflow-hidden relative cursor-pointer group"
            >
              <img 
                src="/categories/female.jpg" 
                alt="女歌手"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              {/* 粉紅/橙色標籤 */}
              <div className="absolute bottom-3 left-3 bg-[#F97316] bg-opacity-90 px-3 py-1.5 rounded">
                <span className="text-white font-bold text-base">女歌手</span>
              </div>
            </div>

            {/* 組合 - 紫色/灰色標籤 */}
            <div 
              onClick={() => router.push('/artists?gender=group')}
              className="aspect-square rounded-[4px] overflow-hidden relative cursor-pointer group"
            >
              <img 
                src="/categories/group.jpg" 
                alt="組合"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              {/* 紫色/灰色標籤 */}
              <div className="absolute bottom-3 left-3 bg-[#6B7280] bg-opacity-90 px-3 py-1.5 rounded">
                <span className="text-white font-bold text-base">組合</span>
              </div>
            </div>
          </div>
          
          {/* 熱門歌手名單（分類下方） */}
          <div className="mt-3 text-[#B3B3B3] text-sm line-clamp-1">
            <span className="mr-2">MC 張天賦</span>
            <span className="mr-2">·</span>
            <span className="mr-2">陳奕迅</span>
            <span className="mr-2">·</span>
            <span className="mr-2">林家謙</span>
            <span className="mr-2">·</span>
            <span>GARETH.T...</span>
          </div>
        </section>

        {/* ==================== 最近瀏覽（分類下面）==================== */}
        <section className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white text-xl font-bold">最近瀏覽</h2>
            <button 
              onClick={() => router.push('/history')}
              className="text-[#B3B3B3] text-sm hover:text-white flex items-center"
            >
              瀏覽全部 <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
          
          {/* 橫向滾動 */}
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
            <div className="flex space-x-4 pb-2">
              {recentItems.map((item, index) => (
                <div 
                  key={index}
                  onClick={() => handleRecentClick(item)}
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
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {item.type === 'artist' ? (
                          <User className="w-8 h-8 text-[#3E3E3E]" />
                        ) : (
                          <div className="text-[#FFD700] text-3xl">♪</div>
                        )}
                      </div>
                    )}
                    
                    {/* 喜愛結他譜特殊標記 */}
                    {item.type === 'playlist' && item.isLiked && (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center">
                        <BookmarkPlus className="w-8 h-8 text-white" />
                      </div>
                    )}
                  </div>
                  
                  {/* 文字資訊 */}
                  <div className="text-center">
                    <p className="text-white text-sm font-medium truncate leading-tight">
                      {item.title}
                    </p>
                    <p className="text-[#B3B3B3] text-xs truncate mt-1">
                      {item.type === 'artist' ? '歌手' : item.artist || '收藏'}
                    </p>
                  </div>
                </div>
              ))}
              
              {/* 如果冇最近瀏覽，顯示提示 */}
              {recentItems.length === 0 && (
                <div className="text-[#B3B3B3] text-sm py-4">
                  暫無瀏覽記錄
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ==================== 熱門結他譜 ==================== */}
        <section className="mb-8">
          <div className="flex justify-between items-end mb-4">
            <div>
              {/* 標題：更大更粗 */}
              <h2 className="text-white text-2xl font-black mb-1">熱門結他譜</h2>
              <p className="text-[#B3B3B3] text-sm">編輯精選</p>
            </div>
          </div>
          
          {/* 橫向滾動卡片 */}
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
            <div className="flex space-x-4 pb-2">
              {hotTabs.map((tab) => (
                <div 
                  key={tab.id}
                  onClick={() => router.push(`/tabs/${tab.id}`)}
                  className="flex-shrink-0 cursor-pointer group"
                  style={{ width: '140px' }}
                >
                  <div className="aspect-square rounded-[4px] overflow-hidden mb-2 bg-[#121212] relative">
                    {tab.thumbnail ? (
                      <img 
                        src={tab.thumbnail} 
                        alt={tab.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
                        <span className="text-[#3E3E3E] text-4xl">♪</span>
                      </div>
                    )}
                  </div>
                  <h3 className="text-white font-bold text-base mb-1 line-clamp-1 group-hover:text-[#FFD700] transition-colors">
                    {tab.title}
                  </h3>
                  <p className="text-[#B3B3B3] text-sm line-clamp-1">
                    {tab.artistName}
                  </p>
                </div>
              ))}
              
              {hotTabs.length === 0 && !loading && (
                <div className="text-[#B3B3B3] text-sm">暫無數據</div>
              )}
            </div>
          </div>
        </section>

        {/* 其他區域（可選） */}
        {/* 可以加入 Playlist 區域 */}

      </div>

      {/* 底部導航欄 - 5個按鈕 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#FFD700] z-50">
        <div className="flex justify-around items-center h-16">
          <button 
            onClick={() => router.push('/')}
            className="flex flex-col items-center justify-center w-full h-full space-y-1"
          >
            <Home className="w-6 h-6 text-black" />
            <span className="text-xs text-black font-medium">首頁</span>
          </button>
          
          <button 
            onClick={() => router.push('/search')}
            className="flex flex-col items-center justify-center w-full h-full space-y-1"
          >
            <Search className="w-6 h-6 text-black/60" />
            <span className="text-xs text-black/60 font-medium">搜尋</span>
          </button>
          
          <button 
            onClick={() => router.push('/artists')}
            className="flex flex-col items-center justify-center w-full h-full space-y-1"
          >
            <User className="w-6 h-6 text-black/60" />
            <span className="text-xs text-black/60 font-medium">歌手</span>
          </button>
          
          <button 
            onClick={() => router.push('/library')}
            className="flex flex-col items-center justify-center w-full h-full space-y-1"
          >
            <BookmarkPlus className="w-6 h-6 text-black/60" />
            <span className="text-xs text-black/60 font-medium">收藏</span>
          </button>
          
          <button 
            onClick={() => router.push('/tabs/new')}
            className="flex flex-col items-center justify-center w-full h-full space-y-1"
          >
            <Plus className="w-6 h-6 text-black/60" />
            <span className="text-xs text-black/60 font-medium">上傳</span>
          </button>
        </div>
        
        {/* 安全區域 */}
        <div className="h-safe-area-inset-bottom bg-[#FFD700]" />
      </nav>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

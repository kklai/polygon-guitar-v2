// pages/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import Layout from '@/components/Layout';

// SVG 圖標組件
const HomeIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const BookmarkIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export default function IndexPage() {
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
    const saved = typeof window !== 'undefined' ? localStorage.getItem('recentViews') : null;
    if (saved) {
      setRecentItems(JSON.parse(saved).slice(0, 10));
    } else {
      // 預設顯示
      setRecentItems([
        { type: 'tab', id: '1', title: '記憶棉', artist: 'MC 張天賦', image: null },
        { type: 'tab', id: '2', title: '孤勇者', artist: '陳奕迅', image: null },
        { type: 'artist', id: 'beyond', title: 'Beyond', subtitle: '歌手', image: null },
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
          
          {/* 漢堡菜單 */}
          <button className="p-2 text-black">
            <MenuIcon />
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
              className="aspect-square rounded-lg overflow-hidden relative cursor-pointer group bg-gradient-to-br from-blue-600 to-blue-800"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-3 bg-[#3B82F6] bg-opacity-90 px-3 py-1.5 rounded">
                <span className="text-white font-bold text-base">男歌手</span>
              </div>
            </div>

            {/* 女歌手 - 粉紅/橙色標籤 */}
            <div 
              onClick={() => router.push('/artists?gender=female')}
              className="aspect-square rounded-lg overflow-hidden relative cursor-pointer group bg-gradient-to-br from-orange-500 to-pink-600"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-3 bg-[#F97316] bg-opacity-90 px-3 py-1.5 rounded">
                <span className="text-white font-bold text-base">女歌手</span>
              </div>
            </div>

            {/* 組合 - 紫色/灰色標籤 */}
            <div 
              onClick={() => router.push('/artists?gender=group')}
              className="aspect-square rounded-lg overflow-hidden relative cursor-pointer group bg-gradient-to-br from-gray-600 to-gray-800"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
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
              瀏覽全部 <ChevronRightIcon />
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
                    ${item.type === 'artist' ? 'rounded-full aspect-square' : 'rounded-lg aspect-square'}
                  `}>
                    {item.image ? (
                      <img 
                        src={item.image} 
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
                        {item.type === 'artist' ? (
                          <UserIcon />
                        ) : (
                          <span className="text-[#FFD700] text-2xl">♪</span>
                        )}
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
                  <div className="aspect-square rounded-lg overflow-hidden mb-2 bg-[#121212] relative">
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
                    {tab.artist}
                  </p>
                </div>
              ))}
              
              {hotTabs.length === 0 && !loading && (
                <div className="text-[#B3B3B3] text-sm">暫無數據</div>
              )}
            </div>
          </div>
        </section>

      </div>

      {/* 底部導航欄 - 5個按鈕 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#FFD700] z-50">
        <div className="flex justify-around items-center h-16">
          <button 
            onClick={() => router.push('/')}
            className="flex flex-col items-center justify-center w-full h-full space-y-1"
          >
            <HomeIcon />
            <span className="text-xs text-black font-medium">首頁</span>
          </button>
          
          <button 
            onClick={() => router.push('/search')}
            className="flex flex-col items-center justify-center w-full h-full space-y-1"
          >
            <span className="text-black/60"><SearchIcon /></span>
            <span className="text-xs text-black/60 font-medium">搜尋</span>
          </button>
          
          <button 
            onClick={() => router.push('/artists')}
            className="flex flex-col items-center justify-center w-full h-full space-y-1"
          >
            <span className="text-black/60"><UserIcon /></span>
            <span className="text-xs text-black/60 font-medium">歌手</span>
          </button>
          
          <button 
            onClick={() => router.push('/library')}
            className="flex flex-col items-center justify-center w-full h-full space-y-1"
          >
            <span className="text-black/60"><BookmarkIcon /></span>
            <span className="text-xs text-black/60 font-medium">收藏</span>
          </button>
          
          <button 
            onClick={() => router.push('/tabs/new')}
            className="flex flex-col items-center justify-center w-full h-full space-y-1"
          >
            <span className="text-black/60"><PlusIcon /></span>
            <span className="text-xs text-black/60 font-medium">上傳</span>
          </button>
        </div>
      </nav>

      <style jsx global>{`
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

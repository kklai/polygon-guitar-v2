// pages/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import Layout from '@/components/Layout';
import { getPopularArtists, getHotTabs, getRecentTabs } from '@/lib/tabs';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Head from 'next/head';
import { siteConfig, generateBreadcrumbSchema } from '@/lib/seo';

// SVG 圖標組件
const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

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

// 六芒星 Logo
const LogoIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" />
    <path d="M12 22V12" />
    <path d="M12 12L4 7" />
    <path d="M12 12l8-5" />
  </svg>
);

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [recentItems, setRecentItems] = useState([]);
  const [hotTabs, setHotTabs] = useState([]);
  const [popularArtists, setPopularArtists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 載入最近瀏覽
      const saved = typeof window !== 'undefined' ? localStorage.getItem('recentViews') : null;
      if (saved) {
        setRecentItems(JSON.parse(saved).slice(0, 10));
      } else {
        // 預設顯示熱門歌曲
        const recent = await getRecentTabs(10);
        setRecentItems(recent.map(tab => ({
          type: 'tab',
          id: tab.id,
          title: tab.title,
          artist: tab.artist,
          image: tab.thumbnail
        })));
      }

      // 載入熱門結他譜
      const hot = await getHotTabs(10);
      setHotTabs(hot);

      // 載入熱門歌手
      const artists = await getPopularArtists('male', 3);
      setPopularArtists(artists);
    } catch (error) {
      console.error('載入數據失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecentClick = (item) => {
    if (item.type === 'tab') {
      router.push(`/tabs/${item.id}`);
    } else if (item.type === 'artist') {
      router.push(`/artists/${item.id}`);
    } else if (item.type === 'playlist') {
      router.push(`/playlist/${item.id}`);
    }
  };

  // SEO 配置
  const seoTitle = 'Polygon - 香港廣東歌結他譜網';
  const seoDescription = 'Polygon 是香港廣東歌結他譜平台，提供最新最熱門的廣東歌結他譜，包含男歌手、女歌手、組合等各類音樂。';
  
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: '首頁', url: siteConfig.url }
  ]);

  return (
    <>
      <Head>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={siteConfig.url} />
        <meta property="og:url" content={siteConfig.url} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      </Head>

      <Layout>
        <div className="min-h-screen bg-black pb-24">
          {/* ==================== 頂部 Header（黃色背景）==================== */}
          <header className="bg-[#FFD700] px-4 pt-6 pb-4">
            <div className="flex justify-between items-start">
              <div>
                {/* Logo */}
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-black">
                    <LogoIcon />
                  </div>
                  <h1 className="text-2xl font-black text-black tracking-tight">POLYGON</h1>
                </div>
                {/* 副標題 */}
                <p className="text-black text-xs font-medium tracking-[0.3em] opacity-80">
                  香港廣東歌結他譜網
                </p>
              </div>
              
              {/* 漢堡菜單 */}
              <button className="p-2 text-black hover:bg-black/10 rounded-full transition">
                <MenuIcon />
              </button>
            </div>
          </header>

          {/* ==================== 主要內容 ==================== */}
          <div className="px-4 mt-6">
            
            {/* ==================== 分類區域 ==================== */}
            <section className="mb-8">
              <div className="grid grid-cols-3 gap-3">
                {/* 男歌手 - 藍色 */}
                <div 
                  onClick={() => router.push('/artists?gender=male')}
                  className="aspect-square rounded-xl overflow-hidden relative cursor-pointer group bg-gradient-to-br from-blue-600 to-blue-400"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                    <span className="bg-blue-500 text-white font-bold text-sm px-4 py-1.5 rounded-lg">
                      男歌手
                    </span>
                  </div>
                </div>

                {/* 女歌手 - 橙/粉紅 */}
                <div 
                  onClick={() => router.push('/artists?gender=female')}
                  className="aspect-square rounded-xl overflow-hidden relative cursor-pointer group bg-gradient-to-br from-orange-500 to-pink-500"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                    <span className="bg-orange-500 text-white font-bold text-sm px-4 py-1.5 rounded-lg">
                      女歌手
                    </span>
                  </div>
                </div>

                {/* 組合 - 灰色 */}
                <div 
                  onClick={() => router.push('/artists?gender=group')}
                  className="aspect-square rounded-xl overflow-hidden relative cursor-pointer group bg-gradient-to-br from-gray-700 to-gray-500"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                    <span className="bg-gray-600 text-white font-bold text-sm px-4 py-1.5 rounded-lg">
                      組合
                    </span>
                  </div>
                </div>
              </div>
              
              {/* 熱門歌手名單 */}
              <div className="mt-3 text-[#9CA3AF] text-sm text-center">
                <span>MC 張天賦</span>
                <span className="mx-2">·</span>
                <span>陳奕迅</span>
                <span className="mx-2">·</span>
                <span>林家謙</span>
                <span className="mx-2">·</span>
                <span>Gareth.T</span>
                <span className="mx-2">·</span>
                <span>張天賦</span>
                <span className="mx-2">·</span>
                <span>洪嘉豪</span>
              </div>
            </section>

            {/* ==================== 最近瀏覽 ==================== */}
            <section className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-white text-lg font-bold">最近瀏覽</h2>
                <button 
                  onClick={() => router.push('/history')}
                  className="text-[#9CA3AF] text-sm hover:text-white flex items-center gap-1 transition"
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
                        ${item.type === 'artist' ? 'rounded-full aspect-square' : 'rounded-xl aspect-square'}
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
                              <div className="text-[#3E3E3E]"><UserIcon /></div>
                            ) : item.type === 'playlist' ? (
                              <div className="text-[#3E3E3E]"><BookmarkIcon /></div>
                            ) : (
                              <div className="text-[#3E3E3E]"><MusicIcon /></div>
                            )}
                          </div>
                        )}
                        
                        {/* 喜愛歌曲標記 */}
                        {item.type === 'playlist' && item.isLiked && (
                          <div className="absolute inset-0 bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center">
                            <BookmarkIcon />
                          </div>
                        )}
                      </div>
                      
                      {/* 文字資訊 */}
                      <div className="text-center">
                        <p className="text-white text-sm font-medium truncate leading-tight">
                          {item.title}
                        </p>
                        <p className="text-[#9CA3AF] text-xs truncate mt-0.5">
                          {item.type === 'artist' ? '歌手' : item.artist || '收藏'}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {recentItems.length === 0 && !loading && (
                    <div className="text-[#9CA3AF] text-sm py-4">
                      暫無瀏覽記錄
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ==================== 熱門結他譜 ==================== */}
            <section className="mb-8">
              <div className="mb-4">
                <h2 className="text-white text-2xl font-black mb-1">熱門結他譜</h2>
                <p className="text-[#9CA3AF] text-sm">編輯精選</p>
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
                      <div className="aspect-square rounded-xl overflow-hidden mb-2 bg-[#121212] relative">
                        {tab.thumbnail ? (
                          <img 
                            src={tab.thumbnail} 
                            alt={tab.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
                            <span className="text-[#3E3E3E] text-4xl">♪</span>
                          </div>
                        )}
                      </div>
                      <h3 className="text-white font-bold text-base mb-0.5 line-clamp-1 group-hover:text-[#FFD700] transition-colors">
                        {tab.title}
                      </h3>
                      <p className="text-[#9CA3AF] text-sm line-clamp-1">
                        {tab.artist}
                      </p>
                    </div>
                  ))}
                  
                  {hotTabs.length === 0 && !loading && (
                    <div className="text-[#9CA3AF] text-sm">暫無數據</div>
                  )}
                </div>
              </div>
            </section>

          </div>

          <style jsx global>{`
            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }
            .scrollbar-hide {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
            .line-clamp-1 {
              display: -webkit-box;
              -webkit-line-clamp: 1;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
          `}</style>
        </div>
      </Layout>
    </>
  );
}

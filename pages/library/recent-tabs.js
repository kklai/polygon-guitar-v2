// pages/library/recent-tabs.js - 最近瀏覽的結他譜（最多 20 份，localStorage）
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getRecentTabIds } from '../../lib/libraryRecentViews';
import { getSongThumbnail } from '../../lib/getSongThumbnail';
import Layout from '../../components/Layout';
import Head from 'next/head';
import { Clock } from 'lucide-react';

export default function RecentTabs() {
  const router = useRouter();
  const [tabs, setTabs] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        loadTabs();
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (document.visibilityState === 'visible' && user) {
      loadTabs();
    }
  }, [user?.uid]);

  const loadTabs = async () => {
    setLoading(true);
    try {
      const recent = getRecentTabIds();
      if (recent.length === 0) {
        setTabs([]);
        setLoading(false);
        return;
      }
      const list = await Promise.all(
        recent.map(async ({ id: tabId }) => {
          const snap = await getDoc(doc(db, 'tabs', tabId));
          return snap.exists() ? { id: snap.id, ...snap.data() } : null;
        })
      );
      setTabs(list.filter(Boolean));
    } catch (error) {
      console.error('載入最近瀏覽失敗:', error);
      setTabs([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout fullWidth hideHeader>
      <Head>
        <title>最近瀏覽 | Polygon Guitar</title>
        <meta name="theme-color" content="#000000" />
      </Head>
      <div className="relative z-10 min-h-screen pb-24 bg-black" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="relative pt-4 pb-1" style={{ paddingLeft: '1rem', paddingRight: '1rem' }}>
          <Link
            href="/library"
            className="inline-flex items-center text-white hover:text-white/90 transition p-1.5 -ml-1.5"
            aria-label="返回"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
        </div>

        <div className="pb-1" style={{ paddingLeft: '1rem', paddingRight: '1rem' }}>
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="font-bold text-white truncate" style={{ fontSize: '1.5rem' }}>
              最近瀏覽
            </h1>
            <span className="text-[12px] md:text-[14px] text-gray-500 whitespace-nowrap flex-shrink-0">
              共 {tabs.length} 份
            </span>
          </div>
        </div>

        {tabs.length > 0 ? (
          <div style={{ paddingLeft: '1rem', paddingRight: '1rem' }}>
            {tabs.map((tab) => (
              <Link key={tab.id} href={`/tabs/${tab.id}`} className="group block">
                <div className="w-full flex items-center gap-3 py-2 pl-0 pr-0 rounded-[7px] md:hover:bg-white/5 md:transition">
                  <div className="w-[49px] h-[49px] rounded-[5px] bg-gray-800 flex-shrink-0 overflow-hidden">
                    {getSongThumbnail(tab) ? (
                      <img
                        src={getSongThumbnail(tab)}
                        alt={tab.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-2xl">🎸</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <h3 className="text-[1rem] font-medium text-[#e6e6e6] truncate md:group-hover:text-[#FFD700] md:transition">
                      {tab.title}
                    </h3>
                    <p className="text-[0.85rem] text-[#999] truncate">{tab.artist || tab.artistName}</p>
                  </div>
                  <svg className="w-4 h-4 text-[#666] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16" style={{ paddingLeft: '1rem', paddingRight: '1rem' }}>
            <Clock className="w-16 h-16 text-[#3E3E3E] mx-auto mb-4" />
            <h3 className="text-xl text-white mb-2">未有最近瀏覽</h3>
            <p className="text-gray-500 mb-6">打開過嘅結他譜會顯示喺呢度（最多 20 份）</p>
            <Link
              href="/library"
              className="inline-flex items-center px-6 py-3 bg-[#FFD700] text-black rounded-full font-medium hover:opacity-90 transition"
            >
              返回收藏
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}

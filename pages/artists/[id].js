// pages/artists/[id].js
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { db } from '../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, increment } from 'firebase/firestore';
import { ArrowLeft, MoreVertical, Share2, Heart, BookmarkPlus, ChevronDown, Music, Info, Edit, Star, Eye } from 'lucide-react';
import RatingSystem from '../../components/RatingSystem';
import { getTabStats } from '../../lib/ratingApi';
import { getTabsByArtist, getArtistBySlug } from '../../lib/tabs';
import { toggleLikeSong, checkIsLiked, getUserPlaylists, addSongToPlaylist, getUserLikedSongs, createPlaylist, saveArtistToLibrary, removeSavedArtist, checkIsArtistSaved } from '../../lib/playlistApi';
import { recordArtistView } from '../../lib/recentViews';
import { recordPageView } from '../../lib/analytics';
import { recordView } from '../../lib/libraryRecentViews';
import { ArtistHeroImage } from '../../components/ArtistImage';
import Layout from '../../components/Layout';
import Head from 'next/head';
import { generateArtistTitle, generateArtistDescription, generateArtistSchema, generateBreadcrumbSchema, siteConfig, getAbsoluteOgImage } from '../../lib/seo';
import { useAuth } from '../../contexts/AuthContext';

// Prefetch: start loading artist data at module parse time
let _prefetchId = null
let _prefetchPromise = null

if (typeof window !== 'undefined') {
  const match = window.location.pathname.match(/^\/artists\/(.+)$/)
  if (match) {
    _prefetchId = decodeURIComponent(match[1])
    _prefetchPromise = getDoc(doc(db, 'artists', _prefetchId))
  }
}

const ARTIST_CACHE_TTL = 10 * 60 * 1000; // 10 min max age
const ARTIST_CACHE_FRESH = 2 * 60 * 1000; // 2 min = skip fetch entirely

function saveArtistCache(artistId, data) {
  try {
    const payload = JSON.stringify({ _ts: Date.now(), ...data }, (key, value) => {
      if (value && typeof value === 'object' && typeof value.toDate === 'function') return value.toDate().getTime();
      return value;
    });
    localStorage.setItem(`pg_artist_${artistId}`, payload);
  } catch (e) { /* quota exceeded - ignore */ }
}

function loadArtistCache(artistId) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`pg_artist_${artistId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data._ts > ARTIST_CACHE_TTL) return null;
    data._fresh = (Date.now() - data._ts) < ARTIST_CACHE_FRESH;
    return data;
  } catch (e) { return null; }
}

function serializeForProps(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v)))
}

export default function ArtistPage({ initialArtist, initialHotTabs = [], initialAllTabs = [] }) {
  const router = useRouter();
  const { id } = router.query;
  const [artist, setArtist] = useState(initialArtist || null);
  const [hotTabs, setHotTabs] = useState(initialHotTabs);
  const [allTabs, setAllTabs] = useState(initialAllTabs);
  const [sortBy, setSortBy] = useState('year'); // year, strokes, views
  const [loading, setLoading] = useState(!initialArtist);
  // user 來自 AuthContext
  const [selectedTab, setSelectedTab] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [showCreatePlaylistInput, setShowCreatePlaylistInput] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false); // 控制歌手資訊顯示
  const [expandedTitles, setExpandedTitles] = useState({});
  const [isArtistSaved, setIsArtistSaved] = useState(false);
  const [isSavingArtist, setIsSavingArtist] = useState(false);
  
  // 使用 AuthContext
  const { user, isAdmin } = useAuth();

  // user 已由 AuthContext 提供

  useEffect(() => {
    if (!id) return;
    if (initialArtist && initialArtist.id === id) {
      setArtist(initialArtist);
      setHotTabs(initialHotTabs || []);
      setAllTabs(initialAllTabs || []);
      setLoading(false);
      recordArtistView(user?.uid || null, initialArtist);
      recordPageView('artist', id, initialArtist.name, {
        pageName: initialArtist.name,
        photoURL: initialArtist.photoURL || initialArtist.wikiPhotoURL
      }, user?.uid || null);
      return;
    }
    loadArtistData();
  }, [id, initialArtist, initialHotTabs, initialAllTabs]);

  // 載入「是否已收藏歌手」
  useEffect(() => {
    if (!id || !user?.uid) {
      setIsArtistSaved(false);
      return;
    }
    let cancelled = false;
    checkIsArtistSaved(user.uid, id).then((saved) => {
      if (!cancelled) setIsArtistSaved(saved);
    });
    return () => { cancelled = true };
  }, [id, user?.uid]);

  const loadArtistData = async () => {
    const bust = typeof window !== 'undefined' && localStorage.getItem('pg_artists_bust')
    const cached = bust ? null : loadArtistCache(id);
    if (cached) {
      setArtist(cached.artist);
      setHotTabs(cached.hotTabs || []);
      setAllTabs(cached.allTabs || []);
      setLoading(false);

      // Analytics (fire-and-forget, doesn't block)
      recordArtistView(user?.uid || null, cached.artist);
      recordView('artist', cached.artist.id); // 收藏頁「最近瀏覽」用 document id
      recordPageView('artist', id, cached.artist.name, {
        pageName: cached.artist.name,
        photoURL: cached.artist.photoURL || cached.artist.wikiPhotoURL
      }, user?.uid || null);

      // 唔再因為 cache 新鮮就跳過 refetch，確保編輯完年份等改動後會即時反映
    } else {
      setLoading(true);
    }

    try {
      let artistDoc = (_prefetchId === id && _prefetchPromise)
        ? await _prefetchPromise
        : await getDoc(doc(db, 'artists', id));
      _prefetchPromise = null;
      _prefetchId = null;
      // 若用 doc id 搵唔到（例如改名後用新 slug 入嚟），改用 normalizedName 查
      if (!artistDoc.exists()) {
        const bySlug = await getArtistBySlug(id);
        if (!bySlug) {
          router.push('/artists');
          return;
        }
        artistDoc = { exists: () => true, id: bySlug.id, data: () => ({ ...bySlug }) };
      }
      const artistData = { id: artistDoc.id, ...artistDoc.data() };
      setArtist(artistData);
      setLoading(false);

      if (!cached) {
        recordArtistView(user?.uid || null, artistData);
        recordView('artist', artistDoc.id); // 收藏頁「最近瀏覽」用 document id
        recordPageView('artist', artistDoc.id, artistData.name, {
          pageName: artistData.name,
          photoURL: artistData.photoURL || artistData.wikiPhotoURL
        }, user?.uid || null);
      }

      const tabs = await getTabsByArtist(artistData.name, artistData.normalizedName || artistData.id);
      tabs.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
      setHotTabs(tabs.slice(0, 5));
      setAllTabs(tabs);

      saveArtistCache(id, {
        artist: artistData,
        hotTabs: tabs.slice(0, 5),
        allTabs: tabs
      });
    } catch (error) {
      console.error('載入歌手資料失敗:', error);
      setLoading(false);
    }
  };

  // 從歌曲數據提取年份（只使用手動設定的年份，唔用 createdAt）
  const getYearFromCreatedAt = (tab) => {
    // 輔助函數：解析年份（支持字符串和數字）
    const parseYear = (value) => {
      if (!value) return null;
      const year = parseInt(value, 10);
      if (!isNaN(year) && year >= 1900 && year <= 2030) {
        return year;
      }
      return null;
    };
    
    // 只使用手動設定的 songYear 或 uploadYear
    // 唔再用 createdAt 作為後備，確保冇年份嘅歌會顯示喺「未知年份」組
    const songYear = parseYear(tab.songYear);
    if (songYear) return songYear;
    
    const uploadYear = parseYear(tab.uploadYear);
    if (uploadYear) return uploadYear;
    
    // 冇手動設定年份，返回 null（會被分到「未知年份」組）
    return null;
  };

  // 分組顯示（按年份）- 沒有年份的排在最後
  const groupByYear = (tabs) => {
    const groups = {};
    const noYearTabs = [];
    
    tabs.forEach(tab => {
      const year = getYearFromCreatedAt(tab);
      if (!year) {
        noYearTabs.push(tab);
        return;
      }
      const range = getYearRange(year);
      if (!groups[range]) groups[range] = [];
      groups[range].push({ ...tab, year });
    });
    
    // 把沒有年份的放在 '未知年份' 組，並按瀏覽數排序
    if (noYearTabs.length > 0) {
      noYearTabs.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
      groups['未知年份'] = noYearTabs;
    }
    
    // 返回排序後的結果，確保「未知年份」在最後
    const sortedGroups = {};
    const yearRanges = Object.keys(groups).filter(k => k !== '未知年份');
    // 按年份範圍排序（新到舊）
    yearRanges.sort((a, b) => {
      // 提取年份範圍的第一個年份進行比較
      const getFirstYear = (range) => {
        if (range.includes('-')) {
          return parseInt(range.split('-')[0]);
        }
        if (range.includes('或更早')) {
          return 0; // 最舊的排最後
        }
        return 0;
      };
      return getFirstYear(b) - getFirstYear(a);
    });
    
    // 先加入所有有年份的組別
    yearRanges.forEach(range => {
      sortedGroups[range] = groups[range];
    });
    
    // 最後加入「未知年份」
    if (groups['未知年份']) {
      sortedGroups['未知年份'] = groups['未知年份'];
    }
    
    return sortedGroups;
  };

  const getYearRange = (year) => {
    if (year >= 2021) return '2021-2026';
    if (year >= 2016) return '2016-2020';
    if (year >= 2011) return '2011-2015';
    if (year >= 2006) return '2006-2010';
    if (year >= 2000) return '2000-2005';
    if (year >= 1995) return '1995-1999';
    if (year >= 1990) return '1990-1994';
    if (year >= 1980) return '1980-1989';
    return '1979 或更早';
  };

  const handleMoreClick = async (e, tab) => {
    e.stopPropagation();
    setSelectedTab(tab);
    if (user) {
      const playlists = await getUserPlaylists(user.uid);
      setUserPlaylists(playlists);
    }
    setShowActionModal(true);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/tabs/${selectedTab.id}`;
    if (navigator.share) {
      await navigator.share({
        title: `${selectedTab.title} - ${artist.name}`,
        url
      });
    } else {
      navigator.clipboard.writeText(url);
    }
    setShowActionModal(false);
  };

  const handleAddToPlaylistClick = () => {
    setShowActionModal(false);
    setShowAddToPlaylist(true);
  };

  const handleAddToLiked = async () => {
    if (!selectedTab || !user) {
      alert('請先登入後即可收藏喜愛的結他譜');
      return;
    }
    try {
      await toggleLikeSong(user.uid, selectedTab.id);
      setShowActionModal(false);
    } catch (error) {
      alert('操作失敗：' + error.message);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim() || !user) return;
    try {
      const result = await createPlaylist(user.uid, newPlaylistName.trim());
      // 創建後直接加入歌曲
      await addSongToPlaylist(result.playlistId, selectedTab.id);
      setShowCreatePlaylistInput(false);
      setShowAddToPlaylist(false);
      setNewPlaylistName('');
      alert(`已創建歌單「${newPlaylistName.trim()}」並加入歌曲`);
    } catch (error) {
      alert('創建歌單失敗：' + error.message);
    }
  };

  const addToPlaylist = async (playlistId) => {
    if (!selectedTab) return;
    try {
      await addSongToPlaylist(playlistId, selectedTab.id);
      setShowAddToPlaylist(false);
      alert('已加入歌單');
    } catch (error) {
      alert('加入失敗：' + error.message);
    }
  };

  const sortedTabs = () => {
    let tabs = [...allTabs];
    if (sortBy === 'year') {
      // 有年份的排前面（新到舊），沒有年份的排最後
      tabs.sort((a, b) => {
        const yearA = getYearFromCreatedAt(a) || 0;
        const yearB = getYearFromCreatedAt(b) || 0;
        if (yearA === 0 && yearB === 0) {
          // 都沒有年份，按瀏覽數排序
          return (b.viewCount || 0) - (a.viewCount || 0);
        }
        if (yearA === 0) return 1;  // A 沒年份，排後
        if (yearB === 0) return -1; // B 沒年份，排後
        // 先按年份新到舊，同年份按瀏覽數
        if (yearB !== yearA) {
          return yearB - yearA;
        }
        return (b.viewCount || 0) - (a.viewCount || 0);
      });
    } else if (sortBy === 'views') {
      tabs.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    } else if (sortBy === 'strokes') {
      // 簡單筆畫排序（按標題）
      tabs.sort((a, b) => a.title.localeCompare(b.title, 'zh-HK'));
    }
    return tabs;
  };

  const groupByTitle = (tabs) => {
    const map = new Map();
    tabs.forEach(tab => {
      const key = tab.title?.trim() || tab.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(tab);
    });
    const result = [];
    map.forEach((group, title) => {
      if (group.length === 1) {
        result.push({ type: 'single', tab: group[0] });
      } else {
        const sorted = [...group].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        result.push({ type: 'group', title, representative: sorted[0], versions: sorted });
      }
    });
    return result;
  };

  // 按年份時分組，其他排序不分組
  const displayData = sortBy === 'year' 
    ? { grouped: true, data: groupByYear(sortedTabs()) }
    : { grouped: false, data: sortedTabs() };

  const toggleTitle = (key) => {
    setExpandedTitles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 提取 YouTube Video ID
  const extractYouTubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  // 取得歌曲縮圖 - 順序：自訂封面 > Spotify 專輯相 > YouTube > thumbnail > 歌手相片
  const getSongThumbnail = (tab) => {
    // 1. 優先使用用戶自訂封面
    if (tab.coverImage) return tab.coverImage;
    // 2. 其次使用 Spotify 專輯相
    if (tab.albumImage) return tab.albumImage;
    // 3. 使用 YouTube 縮圖
    if (tab.youtubeUrl) {
      const videoId = extractYouTubeId(tab.youtubeUrl);
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      }
    }
    // 4. 使用歌曲自己的縮圖
    if (tab.thumbnail) return tab.thumbnail;
    // 5. 使用歌手圖片
    return artist?.photoURL || artist?.wikiPhotoURL || null;
  };

  if (loading || !artist) return (
    <Layout fullWidth>
      <Head>
        <title>{id ? `${decodeURIComponent(id)} | Polygon Guitar` : 'Polygon Guitar'}</title>
        <meta name="description" content={siteConfig.description} />
        <meta property="og:title" content={`${id ? decodeURIComponent(id) : 'Polygon Guitar'} | Polygon Guitar`} />
        <meta property="og:description" content={siteConfig.description} />
        <meta property="og:image" content={siteConfig.defaultOgImage || `${siteConfig.url}/og-image.jpg`} />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <div className="min-h-screen bg-black" />
    </Layout>
  );

  const songCount = allTabs.length;
  const seoTitle = generateArtistTitle(artist.name);
  const seoDescription = generateArtistDescription(artist.name, songCount);
  const artistSlug = artist.normalizedName || artist.id;
  const seoUrl = `${siteConfig.url}/artists/${encodeURIComponent(artistSlug)}`;
  const artistSchema = generateArtistSchema(artist, allTabs);
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: '首頁', url: siteConfig.url },
    { name: '歌手', url: `${siteConfig.url}/artists` },
    { name: artist.name, url: seoUrl }
  ]);

  return (
    <Layout fullWidth>
    <Head>
      <title>{seoTitle}</title>
      <meta name="description" content={seoDescription} />
      <link rel="canonical" href={seoUrl} />
      {/* Open Graph — unique per artist for social share preview */}
      <meta property="og:url" content={seoUrl} />
      <meta property="og:type" content="profile" />
      <meta property="og:site_name" content={siteConfig.name} />
      <meta property="og:title" content={seoTitle} />
      <meta property="og:description" content={seoDescription} />
      <meta property="og:image" content={getAbsoluteOgImage(artist.photoURL || artist.wikiPhotoURL)} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${artist.name} 結他譜 - Polygon Guitar`} />
      {/* Twitter Card — unique per artist */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={siteConfig.twitter} />
      <meta name="twitter:title" content={seoTitle} />
      <meta name="twitter:description" content={seoDescription} />
      <meta name="twitter:image" content={getAbsoluteOgImage(artist.photoURL || artist.wikiPhotoURL)} />
      <meta name="twitter:image:alt" content={`${artist.name} 結他譜 - Polygon Guitar`} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([artistSchema, breadcrumbSchema])
        }}
      />
    </Head>
    <div className="min-h-screen bg-black pb-20">
      <div className="max-w-7xl mx-auto">
      {/* Hero */}
      <div className="relative w-full aspect-[3/2] md:h-[55vh] md:aspect-auto">
        <ArtistHeroImage artist={artist} />
        {/* 底部由下而上漸變層（黑 → 透明） */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black to-transparent opacity-40 pointer-events-none z-[1]" aria-hidden />
        
        {/* 返回按鈕 */}
        <button 
          onClick={() => router.back()}
          className="absolute top-6 left-4 p-2 bg-black/30 backdrop-blur-sm rounded-full text-white hover:bg-black/50 z-10"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <div className="absolute bottom-0 left-0 right-0 pt-10 pb-1 px-4 z-10">
          <div className="flex items-center gap-2 mb-1">
            {/* 歌手名 + 資訊、編輯 icon 一組，icon 貼住名右邊 */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h1 className="text-4xl font-bold text-white leading-tight truncate min-w-0">{artist.name}</h1>
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="p-1.5 bg-white/10 backdrop-blur-sm rounded-full text-white hover:bg-white/20 transition flex-shrink-0"
                title="歌手資訊"
              >
                <Info className="w-5 h-5" />
              </button>
              {isAdmin && (
                <Link
                  href={`/artists/${encodeURIComponent(artistSlug)}/edit`}
                  className="p-1.5 bg-white/80 backdrop-blur-sm rounded-full text-black hover:bg-white transition flex-shrink-0"
                  title="編輯歌手"
                >
                  <Edit className="w-5 h-5" />
                </Link>
              )}
            </div>
            {/* 收藏歌手（右邊，可再撳取消收藏） */}
            <button
              type="button"
              onClick={async () => {
                if (!user) {
                  alert('請先登入後即可收藏歌手');
                  return;
                }
                if (isSavingArtist) return;
                setIsSavingArtist(true);
                try {
                  if (isArtistSaved) {
                    await removeSavedArtist(user.uid, artist.id);
                    setIsArtistSaved(false);
                  } else {
                    await saveArtistToLibrary(user.uid, artist.id);
                    setIsArtistSaved(true);
                  }
                } catch (err) {
                  console.error('收藏歌手失敗:', err);
                  alert('收藏失敗，請重試');
                } finally {
                  setIsSavingArtist(false);
                }
              }}
              disabled={isSavingArtist}
              title={isArtistSaved ? '已收藏（撳一下取消）' : '收藏歌手'}
              className={`ml-auto p-2 rounded-full flex-shrink-0 transition ${
                isArtistSaved
                  ? 'bg-[#FFD700] text-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              } ${isSavingArtist ? 'opacity-50' : ''}`}
            >
              <Heart className={`w-6 h-6 ${isArtistSaved ? 'fill-black' : 'fill-none'}`} strokeWidth={2} />
            </button>
          </div>
          
          {/* 設計圖冇顯示歌手資訊 */}
        </div>
      </div>

      {/* 歌手詳細資訊 Floating Panel */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowInfo(false)}>
          <div className="bg-[#121212] rounded-2xl p-6 max-w-sm w-full border border-gray-800 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-lg font-bold">{artist.name}</h3>
              <button onClick={() => setShowInfo(false)} className="text-[#B3B3B3] hover:text-white">
                ✕
              </button>
            </div>
            
            {/* 資訊列表 */}
            <div className="space-y-3 text-sm">
              {artist.birthYear && (
                <div className="flex justify-between">
                  <span className="text-[#B3B3B3]">出生日期</span>
                  <span className="text-white">
                    {artist.birthYear.includes('-') 
                      ? new Date(artist.birthYear).toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' })
                      : `${artist.birthYear}年`}
                  </span>
                </div>
              )}
              
              {artist.debutYear && (
                <div className="flex justify-between">
                  <span className="text-[#B3B3B3]">出道日期</span>
                  <span className="text-white">
                    {artist.debutYear.includes('-') 
                      ? new Date(artist.debutYear).toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' })
                      : `${artist.debutYear}年`}
                  </span>
                </div>
              )}
              
              {artist.spotifyFollowers && (
                <div className="flex justify-between">
                  <span className="text-[#B3B3B3]">Spotify 粉絲</span>
                  <span className="text-[#1DB954]">{(artist.spotifyFollowers / 10000).toFixed(1)}萬</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-[#B3B3B3]">歌曲數量</span>
                <span className="text-white">{allTabs.length} 首</span>
              </div>
            </div>
            
            {/* 地區 */}
            {(artist.regions?.length > 0 || artist.region) && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <div className="flex flex-wrap gap-2">
                  {(artist.regions || [artist.region]).map((region, idx) => (
                    <span key={idx} className="px-2 py-1 bg-[#282828] text-[#B3B3B3] text-xs rounded">
                      {region === 'hongkong' ? '香港' : 
                       region === 'taiwan' ? '台灣' : 
                       region === 'china' ? '中國' : 
                       region === 'asia' ? '亞洲' : 
                       region === 'foreign' ? '外國' : region}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* 簡介 */}
            {artist.bio && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-[#B3B3B3] text-sm leading-relaxed">
                  {artist.bio}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 熱門歌曲（前5首 - 有相片） */}
      <section className="px-4 mt-2">
        <h2 className="text-white font-bold mb-2" style={{ fontSize: '1.375rem' }}>熱門</h2>
        <div className="space-y-1">
          {hotTabs.map((tab, index) => (
            <Link 
              key={tab.id}
              href={`/tabs/${tab.id}`}
              className="flex items-center py-1 rounded-lg cursor-pointer group -mx-2 px-2"
            >
              <span className="text-[#B3B3B3] w-5 text-center text-sm font-medium mr-2">
                {index + 1}
              </span>
              
              {/* 歌曲封面 */}
              <div className="w-12 h-12 rounded-[4px] overflow-hidden mr-3 bg-[#282828] flex-shrink-0">
                {getSongThumbnail(tab) ? (
                  <img src={getSongThumbnail(tab)} alt={tab.title} className="w-full h-full object-cover pointer-events-none select-none" draggable="false" loading="lazy" decoding="async" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#3E3E3E] text-xl">♪</div>
                )}
              </div>
              
              {/* 歌曲資訊 */}
              <div className="flex-1 min-w-0">
                <h3 className="text-white text-base font-medium truncate">{tab.title}</h3>
                <p className="text-[#B3B3B3] text-xs mt-0.5">{tab.viewCount?.toLocaleString() || 0} 瀏覽</p>
              </div>
              
              {/* 三點按鈕 - 一直顯示 */}
              <button 
                onClick={(e) => { e.preventDefault(); handleMoreClick(e, tab); }}
                className="p-2 text-[#B3B3B3] hover:text-white"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </Link>
          ))}
        </div>
      </section>

      {/* 所有歌曲（第6首起 - 無相片，有評分） */}
      {allTabs.length > 0 && (
      <section className="px-4 mt-8">
        {/* 標題 + 排序 */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-bold" style={{ fontSize: '1.375rem' }}>所有歌曲</h2>
          
          <div className="relative">
            <button 
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center space-x-1 text-[#B3B3B3] text-sm hover:text-white bg-[#1a1a1a] px-3 py-1.5 rounded-full"
            >
              <span>{sortBy === 'year' ? '按年份' : sortBy === 'strokes' ? '按筆畫' : '按瀏覽'}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
            </button>
            
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-2 bg-[#282828] rounded-lg shadow-xl py-1 min-w-[120px] z-30">
                  {['year', 'strokes', 'views'].map((type) => (
                    <button 
                      key={type}
                      onClick={() => {
                        setSortBy(type);
                        setShowSortMenu(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm ${sortBy === type ? 'text-[#FFD700]' : 'text-white hover:bg-[#3E3E3E]'}`}
                    >
                      {type === 'year' ? '按年份' : type === 'strokes' ? '按筆畫' : '按瀏覽'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 歌曲列表 - 按年份分組或平鋪顯示 */}
        {displayData.grouped ? (
          // 按年份分組顯示
          Object.entries(displayData.data).map(([yearRange, tabs]) => (
            <div key={yearRange} style={{ marginBottom: '0.5rem' }}>
              <h3 className={`text-sm font-mediumremo sticky top-0 bg-black/95 py-2 z-10 ${
                yearRange === '未知年份' 
                  ? 'text-gray-500 italic' 
                  : 'text-[#FFD700]'
              }`}>
                {yearRange}
                {yearRange === '未知年份' && tabs.length > 0 && (
                  <span className="ml-2 text-xs">({tabs.length} 首)</span>
                )}
              </h3>
              <div>
                {groupByTitle(tabs).map((item, idx, arr) => {
                  if (item.type === 'single') {
                    const tab = item.tab;
                    return (
                      <Link 
                        key={tab.id}
                        href={`/tabs/${tab.id}`}
                        className="flex items-center cursor-pointer group py-3 px-2 -mx-2"
                        style={idx < arr.length - 1 ? { borderBottom: '0.5px solid #333' } : {}}
                      >
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2">
                            <h4 className="text-white font-medium truncate" style={{ fontSize: '1.1rem' }}>{tab.title}</h4>
                          </div>
                        </div>
                        <div className="flex items-center justify-end flex-shrink-0" style={{ width: '3.5rem', marginRight: '0.4rem' }}>
                          <span className="text-gray-500 text-xs">{tab.viewCount?.toLocaleString() || 0}</span>
                          <Eye className="w-3 h-3 text-gray-500 flex-shrink-0 ml-1" style={{ marginTop: -1 }} />
                        </div>
                        <div className="text-right flex-shrink-0" style={{ width: '5.3rem' }}>
                          <span className="text-[#B3B3B3] text-sm truncate block">
                            {tab.uploaderPenName || tab.arrangedBy || '匿名'}
                          </span>
                        </div>
                      </Link>
                    );
                  }
                  const groupKey = `${yearRange}-${item.title}`;
                  const isExpanded = expandedTitles[groupKey];
                  const rep = item.representative;
                  return (
                    <div key={groupKey}>
                      <div
                        onClick={() => toggleTitle(groupKey)}
                        className="flex items-center cursor-pointer py-3 px-2 -mx-2"
                        style={(!isExpanded && idx < arr.length - 1) ? { borderBottom: '0.5px solid #333' } : {}}
                      >
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2">
                            <h4 className="text-white font-medium truncate" style={{ fontSize: '1.1rem' }}>{item.title}</h4>
                            <span className="text-sm px-1.5 py-0.5 rounded flex-shrink-0 bg-yellow-500/20 text-[#FFD700]">{item.versions.length}份譜</span>
                            <ChevronDown className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </div>
                      {isExpanded && item.versions.map((tab, vIdx) => (
                        <Link
                          key={tab.id}
                          href={`/tabs/${tab.id}`}
                          className="flex items-center cursor-pointer py-3 px-2 -mx-2 pl-6 bg-[#0a0a0a]"
                          style={(vIdx < item.versions.length - 1 || idx < arr.length - 1) ? { borderBottom: '0.5px solid #333' } : {}}
                        >
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2">
                              <h4 className="text-white font-normal truncate" style={{ fontSize: '1.1rem' }}>{tab.title}</h4>
                            </div>
                          </div>
                          <div className="flex items-center justify-end flex-shrink-0" style={{ width: '3.5rem', marginRight: '0.4rem' }}>
                            <span className="text-gray-500 text-xs">{tab.viewCount?.toLocaleString() || 0}</span>
                            <Eye className="w-3 h-3 text-gray-500 flex-shrink-0 ml-1" style={{ marginTop: -1 }} />
                          </div>
                          <div className="text-right flex-shrink-0" style={{ width: '5.3rem' }}>
                            <span className="text-[#B3B3B3] text-sm truncate block">
                              {tab.uploaderPenName || tab.arrangedBy || '匿名'}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          // 平鋪顯示（按筆畫/瀏覽）
          <div>
            {groupByTitle(displayData.data).map((item, idx, arr) => {
              if (item.type === 'single') {
                const tab = item.tab;
                return (
                  <Link 
                    key={tab.id}
                    href={`/tabs/${tab.id}`}
                    className="flex items-center py-3 cursor-pointer group px-2 -mx-2"
                    style={idx < arr.length - 1 ? { borderBottom: '0.5px solid #333' } : {}}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-medium truncate" style={{ fontSize: '1.1rem' }}>{tab.title}</h4>
                      </div>
                    </div>
                    <div className="flex items-center justify-end flex-shrink-0" style={{ width: '3.5rem', marginRight: '0.4rem' }}>
                      <span className="text-gray-500 text-xs">{tab.viewCount?.toLocaleString() || 0}</span>
                      <Eye className="w-3 h-3 text-gray-500 flex-shrink-0 ml-1" style={{ marginTop: -1 }} />
                    </div>
                    <div className="text-right flex-shrink-0" style={{ width: '5.3rem' }}>
                      <span className="text-[#B3B3B3] text-sm truncate block">
                        {tab.uploaderPenName || tab.arrangedBy || '匿名'}
                      </span>
                    </div>
                  </Link>
                );
              }
              const groupKey = `flat-${item.title}`;
              const isExpanded = expandedTitles[groupKey];
              const rep = item.representative;
              return (
                <div key={groupKey}>
                  <div
                    onClick={() => toggleTitle(groupKey)}
                    className="flex items-center cursor-pointer py-3 px-2 -mx-2"
                    style={(!isExpanded && idx < arr.length - 1) ? { borderBottom: '0.5px solid #333' } : {}}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-medium truncate" style={{ fontSize: '1.1rem' }}>{item.title}</h4>
                        <span className="text-sm px-1.5 py-0.5 rounded flex-shrink-0 bg-yellow-500/20 text-[#FFD700]">{item.versions.length}份譜</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </div>
                  {isExpanded && item.versions.map((tab, vIdx) => (
                    <Link
                      key={tab.id}
                      href={`/tabs/${tab.id}`}
                      className="flex items-center cursor-pointer py-3 px-2 -mx-2 pl-6 bg-[#0a0a0a]"
                      style={(vIdx < item.versions.length - 1 || idx < arr.length - 1) ? { borderBottom: '0.5px solid #333' } : {}}
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-normal truncate" style={{ fontSize: '1.1rem' }}>{tab.title}</h4>
                        </div>
                      </div>
                      <div className="flex items-center justify-end flex-shrink-0" style={{ width: '3.5rem', marginRight: '0.4rem' }}>
                        <span className="text-gray-500 text-xs">{tab.viewCount?.toLocaleString() || 0}</span>
                        <Eye className="w-3 h-3 text-gray-500 flex-shrink-0 ml-1" style={{ marginTop: -1 }} />
                      </div>
                      <div className="text-right flex-shrink-0" style={{ width: '5.3rem' }}>
                        <span className="text-[#B3B3B3] text-sm truncate block">
                          {tab.uploaderPenName || tab.arrangedBy || '匿名'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}
      </div>

      {/* Action Modal（分享/收藏） */}
      {showActionModal && selectedTab && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowActionModal(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-[#121212] rounded-t-2xl z-[60] p-4 pb-24 animate-slide-up">
            <div className="w-12 h-1 bg-[#3E3E3E] rounded-full mx-auto mb-4" />
            
            <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-[#282828]">
              <div className="w-12 h-12 rounded-[4px] overflow-hidden bg-[#282828]">
                {selectedTab && getSongThumbnail(selectedTab) ? (
                  <img src={getSongThumbnail(selectedTab)} alt={selectedTab.title} className="w-full h-full object-cover pointer-events-none select-none" draggable="false" loading="lazy" decoding="async" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#3E3E3E]">♪</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-medium truncate">{selectedTab.title}</h4>
                <p className="text-[#B3B3B3] text-sm">{artist.name}</p>
              </div>
            </div>
            
            <div className="space-y-1">
              <button onClick={handleShare} className="w-full flex items-center space-x-4 p-3 rounded-lg">
                <Share2 className="w-5 h-5 text-[#B3B3B3]" />
                <span className="text-white">分享</span>
              </button>
              
              <button onClick={handleAddToLiked} className="w-full flex items-center space-x-4 p-3 rounded-lg">
                <Heart className="w-5 h-5 text-red-500" />
                <span className="text-white">加到我最喜愛</span>
              </button>
              
              <button onClick={handleAddToPlaylistClick} className="w-full flex items-center space-x-4 p-3 rounded-lg">
                <BookmarkPlus className="w-5 h-5 text-[#B3B3B3]" />
                <span className="text-white">加入歌單</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* 加入歌單 Modal */}
      {showAddToPlaylist && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => {
              setShowAddToPlaylist(false);
              setShowCreatePlaylistInput(false);
              setNewPlaylistName('');
            }} />
          <div className="fixed bottom-0 left-0 right-0 bg-[#121212] rounded-t-2xl z-[60] p-4 pb-24 max-h-[70vh] overflow-y-auto">
            <div className="w-12 h-1 bg-[#3E3E3E] rounded-full mx-auto mb-4" />
            <h3 className="text-white text-lg font-bold mb-4">加入歌單</h3>
            
            <div className="space-y-2">
              {userPlaylists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => addToPlaylist(pl.id)}
                  className="w-full flex items-center space-x-3 p-3 hover:bg-[#1a1a1a] rounded-lg text-left"
                >
                  <div className="w-12 h-12 rounded-[4px] bg-[#282828] flex items-center justify-center">
                    <Music className="w-6 h-6 text-[#3E3E3E]" />
                  </div>
                  <span className="text-white font-medium">{pl.title}</span>
                </button>
              ))}
              
              {/* 創建新歌單按鈕 */}
              <button
                onClick={() => setShowCreatePlaylistInput(true)}
                className="w-full flex items-center space-x-3 p-3 hover:bg-[#1a1a1a] rounded-lg text-left border-t border-gray-800 mt-2"
              >
                <div className="w-12 h-12 rounded-[4px] bg-[#FFD700] flex items-center justify-center">
                  <span className="text-black text-2xl font-light">+</span>
                </div>
                <span className="text-[#FFD700] font-medium">創建新歌單</span>
              </button>

              {/* 創建輸入框 */}
              {showCreatePlaylistInput && (
                <div className="mt-3 p-3 bg-[#1a1a1a] rounded-lg">
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder="輸入歌單名稱"
                    className="w-full bg-[#282828] text-white px-3 py-2 rounded-lg mb-2 outline-none focus:ring-2 focus:ring-[#FFD700]"
                    autoFocus
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleCreatePlaylist}
                      disabled={!newPlaylistName.trim()}
                      className="flex-1 bg-[#FFD700] text-black py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      創建並加入
                    </button>
                    <button
                      onClick={() => {
                        setShowCreatePlaylistInput(false);
                        setNewPlaylistName('');
                      }}
                      className="flex-1 bg-[#282828] text-white py-2 rounded-lg"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.2s ease-out;
        }
      `}</style>
    </div>
    </Layout>
  );
}

export async function getStaticPaths() {
  return { paths: [], fallback: 'blocking' };
}

export async function getStaticProps({ params }) {
  const id = params?.id;
  if (!id) return { notFound: true };
  try {
    const artistDoc = await getDoc(doc(db, 'artists', id));
    if (!artistDoc.exists()) return { notFound: true };
    const artistData = { id: artistDoc.id, ...artistDoc.data() };
    const tabs = await getTabsByArtist(artistData.name, artistData.normalizedName || artistData.id);
    tabs.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    const initialHotTabs = tabs.slice(0, 5);
    return {
      props: {
        initialArtist: serializeForProps(artistData),
        initialHotTabs: serializeForProps(initialHotTabs),
        initialAllTabs: serializeForProps(tabs)
      },
      revalidate: 300
    };
  } catch (e) {
    console.error('[artists/[id]] getStaticProps:', e?.message);
    return { notFound: true };
  }
}

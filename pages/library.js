// pages/library.js
import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Plus, Heart, Music, X, User, ArrowUpDown, Clock } from 'lucide-react';
import { getUserPlaylists, getUserLikedSongs, getSavedPlaylistsWithMeta, getSavedArtistsWithMeta } from '../lib/playlistApi';
import { getLastViewedAt, getRecentTabIds } from '../lib/libraryRecentViews';
import { getSongThumbnail } from '../lib/getSongThumbnail';
import Layout from '../components/Layout';

/** 一次過攞收藏頁所需數據，供 SWR 做 cache */
async function fetchLibraryData(userId) {
  const [userPlaylists, savedList, artistsList, likedSongs] = await Promise.all([
    getUserPlaylists(userId),
    getSavedPlaylistsWithMeta(userId),
    getSavedArtistsWithMeta(userId),
    getUserLikedSongs(userId)
  ]);
  const tabIdsToFetch = [];
  const playlistTabIds = userPlaylists.map((pl) => (pl.songIds || []).slice(0, 4));
  const seen = new Set();
  for (const ids of playlistTabIds) {
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        tabIdsToFetch.push(id);
      }
    }
  }
  const tabSnaps = tabIdsToFetch.length
    ? await Promise.all(tabIdsToFetch.map((tabId) => getDoc(doc(db, 'tabs', tabId))))
    : [];
  const tabMap = new Map();
  tabSnaps.forEach((snap, i) => {
    if (snap.exists()) tabMap.set(tabIdsToFetch[i], { id: snap.id, ...snap.data() });
  });
  const playlists = userPlaylists.map((pl) => {
    const ids = (pl.songIds || []).slice(0, 4);
    const coverSongs = ids.map((id) => tabMap.get(id)).filter(Boolean);
    return { ...pl, coverSongs };
  });
  return { playlists, savedPlaylists: savedList, savedArtists: artistsList, likedCount: likedSongs.length };
}

export default function Library() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const LIBRARY_SORT_KEY = 'pg_library_sort_mode';
  const [sortMode, setSortMode] = useState('recent'); // 'recent' | 'added'
  const [sortRefreshKey, setSortRefreshKey] = useState(0) // 返回頁面時強制重讀「最近瀏覽」
  const [recentTabsCount, setRecentTabsCount] = useState(0) // 最近瀏覽結他譜數量（localStorage）
  const [recentCoverTab, setRecentCoverTab] = useState(null) // 第一份用於封面

  const libraryKey = user ? `library-${user.uid}` : null;
  const { data, error, isLoading: swrLoading, isValidating, mutate } = useSWR(
    libraryKey,
    (key) => fetchLibraryData(key.replace('library-', '')),
    {
      revalidateOnFocus: true,   // 切返嚟 tab 時背景更新
      dedupingInterval: 20000,  // 20 秒內唔重複 request，第二次入頁即出 cache
      keepPreviousData: true    // 重新驗證時保留上一次 data，唔會閃 loading
    }
  );
  const playlists = data?.playlists ?? [];
  const savedPlaylists = data?.savedPlaylists ?? [];
  const savedArtists = data?.savedArtists ?? [];
  const likedCount = data?.likedCount ?? 0;
  const loading = !user ? true : !data && swrLoading;

  // 還原用戶上次揀選嘅排序方法（localStorage）
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' && localStorage.getItem(LIBRARY_SORT_KEY);
      if (saved === 'recent' || saved === 'added') setSortMode(saved);
    } catch (_) {}
  }, []);

  // 每次掛載後短暫延遲重算排序，確保撳上一頁返嚟會讀到最新「最近瀏覽」
  useEffect(() => {
    const t = setTimeout(() => setSortRefreshKey((k) => k + 1), 150);
    return () => clearTimeout(t);
  }, []);

  // 最近瀏覽結他譜數量 + 第一份做封面（client 讀 localStorage 再 fetch）
  useEffect(() => {
    const ids = getRecentTabIds();
    setRecentTabsCount(ids.length);
    if (ids.length === 0) {
      setRecentCoverTab(null);
      return;
    }
    const loadRecentCover = async () => {
      const firstId = ids[0]?.id;
      if (!firstId) return;
      const snap = await getDoc(doc(db, 'tabs', firstId));
      setRecentCoverTab(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    };
    loadRecentCover();
  }, [sortRefreshKey]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, []);

  // 頁面重新顯示時重算「最近瀏覽」排序（localStorage），SWR 會自己 revalidateOnFocus
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && user?.uid) setSortRefreshKey((k) => k + 1);
    };
    const onPageShow = (e) => {
      if (e.persisted && user?.uid) setSortRefreshKey((k) => k + 1);
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [user?.uid]);

  const createPlaylist = async () => {
    if (!newPlaylistName.trim() || !user) return;
    
    try {
      await addDoc(collection(db, 'userPlaylists'), {
        userId: user.uid,
        title: newPlaylistName.trim(),
        description: '',
        songIds: [],
        coverImage: null,
        isPublic: false,
        likes: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      setNewPlaylistName('');
      setShowCreateModal(false);
      mutate(); // 令 SWR 重新攞數據，新歌單即時出現
    } catch (error) {
      console.error('創建歌單失敗:', error);
      alert('創建失敗，請重試');
    }
  };

  const handlePlaylistClick = (playlistId) => {
    router.push(`/playlist/${playlistId}`);
  };

  const handleLikedSongsClick = () => {
    router.push('/library/liked');
  };

  // 合併為可排序的 tile 列表（最近瀏覽用 lastViewedAt，最近加入用 addedAt）
  const sortedTiles = useMemo(() => {
    const tiles = [];
    savedArtists.forEach((ar) => {
      tiles.push({
        type: 'artist',
        id: ar.id,
        data: ar,
        lastViewedAt: typeof window !== 'undefined' ? getLastViewedAt('artist', ar.id) : 0,
        addedAt: ar.savedAtMs ?? 0
      });
    });
    savedPlaylists.forEach((pl) => {
      tiles.push({
        type: 'savedPlaylist',
        id: pl.id,
        data: pl,
        lastViewedAt: typeof window !== 'undefined' ? getLastViewedAt('playlist', pl.id) : 0,
        addedAt: pl.savedAtMs ?? 0
      });
    });
    playlists.forEach((pl) => {
      tiles.push({
        type: 'userPlaylist',
        id: pl.id,
        data: pl,
        lastViewedAt: typeof window !== 'undefined' ? getLastViewedAt('userPlaylist', pl.id) : 0,
        addedAt: pl.createdAt?.toMillis?.() ?? 0
      });
    });
    const key = sortMode === 'recent' ? 'lastViewedAt' : 'addedAt';
    tiles.sort((a, b) => (b[key] || 0) - (a[key] || 0));
    return tiles;
  }, [savedArtists, savedPlaylists, playlists, sortMode, sortRefreshKey]);

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full"></div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-4">
          <p className="text-[#B3B3B3]">載入失敗，請重試</p>
          <button onClick={() => mutate()} className="py-2 px-4 bg-[#FFD700] text-black rounded-lg font-medium">
            重試
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout fullWidth>
      <div className="min-h-screen bg-black pb-24" style={{ paddingLeft: '1rem', paddingRight: '1rem' }}>
        {/* Header：左邊頭像+標題，右上角排序 icon */}
        <div className="pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#282828] overflow-hidden flex items-center justify-center">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" loading="lazy" decoding="async" />
              ) : (
                <span className="text-white font-bold">{user?.displayName?.[0] || 'U'}</span>
              )}
            </div>
            <h1 className="text-white text-2xl font-bold">收藏</h1>
          </div>
          <button
            onClick={() => {
              setSortMode((m) => {
                const next = m === 'recent' ? 'added' : 'recent';
                try { localStorage.setItem(LIBRARY_SORT_KEY, next); } catch (_) {}
                return next;
              });
            }}
            className="flex items-center gap-1.5 py-2 text-[#B3B3B3]"
            title={sortMode === 'recent' ? '撳切換為最近加入' : '撳切換為最近瀏覽'}
            aria-label={sortMode === 'recent' ? '排序：最近瀏覽' : '排序：最近加入'}
          >
            <span className="text-sm">{sortMode === 'recent' ? '最近瀏覽' : '最近加入'}</span>
            <ArrowUpDown className="w-5 h-5 shrink-0" />
          </button>
        </div>

        {/* 歌單網格：固定 3 欄，按排序顯示 */}
        <div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-[14px]">
            {/* 喜愛結他譜（固定第一格） */}
            <div 
              onClick={handleLikedSongsClick}
              className="cursor-pointer group"
            >
              <div className="aspect-square rounded-[4px] bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center mb-2 relative overflow-hidden shadow-lg">
                <Heart className="w-12 h-12 sm:w-14 sm:h-14 text-white fill-white" />
              </div>
              <div className="text-white font-medium truncate" style={{ fontSize: 15, lineHeight: '20px' }}>喜愛結他譜</div>
              <div className="text-gray-500 truncate" style={{ fontSize: 13, lineHeight: '16px' }}>歌單 • {likedCount}份譜</div>
            </div>

            {/* 最近瀏覽（結他譜，第一首歌做封面） */}
            <div 
              onClick={() => router.push('/library/recent-tabs')}
              className="cursor-pointer group"
            >
              <div className="aspect-square rounded-[4px] overflow-hidden mb-2 bg-[#121212] relative">
                {!recentCoverTab ? (
                  <div className="w-full h-full flex items-center justify-center bg-[#282828]">
                    <Clock className="w-12 h-12 sm:w-14 sm:h-14 text-[#B3B3B3]" />
                  </div>
                ) : getSongThumbnail(recentCoverTab) ? (
                  <img src={getSongThumbnail(recentCoverTab)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#282828] text-[#3E3E3E] text-lg">🎸</div>
                )}
              </div>
              <div className="text-white font-medium truncate" style={{ fontSize: 15, lineHeight: '20px' }}>最近瀏覽</div>
              <div className="text-gray-500 truncate" style={{ fontSize: 13, lineHeight: '16px' }}>結他譜 • {recentTabsCount}份</div>
            </div>

            {/* 已排序：歌手 / 已收藏歌單 / 用戶歌單 */}
            {sortedTiles.map((tile) => {
              if (tile.type === 'artist') {
                const ar = tile.data;
                return (
                  <div
                    key={`artist-${ar.id}`}
                    onClick={() => router.push(`/artists/${ar.id}`)}
                    className="cursor-pointer group"
                  >
                    <div className="aspect-square rounded-full overflow-hidden mb-2 bg-[#282828] shadow-lg relative max-w-full">
                      {ar.photoURL || ar.wikiPhotoURL ? (
                        <img
                          src={ar.photoURL || ar.wikiPhotoURL}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#282828]">
                          <User className="w-12 h-12 text-[#3E3E3E]" />
                        </div>
                      )}
                    </div>
                    <div className="text-white font-medium truncate" style={{ fontSize: 15, lineHeight: '20px' }}>{ar.name}</div>
                    <div className="text-gray-500 truncate" style={{ fontSize: 13, lineHeight: '16px' }}>歌手</div>
                  </div>
                );
              }
              if (tile.type === 'savedPlaylist') {
                const pl = tile.data;
                return (
                  <div
                    key={`saved-${pl.id}`}
                    onClick={() => router.push(`/playlist/${pl.id}`)}
                    className="cursor-pointer group"
                  >
                    <div className="aspect-square rounded-[4px] overflow-hidden mb-2 bg-[#121212] relative">
                      {pl.coverImage ? (
                        <img
                          src={pl.coverImage}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#282828]">
                          <Music className="w-12 h-12 text-[#3E3E3E]" />
                        </div>
                      )}
                    </div>
                    <div className="text-white font-medium truncate" style={{ fontSize: 15, lineHeight: '20px' }}>{pl.title}</div>
                    <div className="text-gray-500 truncate" style={{ fontSize: 13, lineHeight: '16px' }}>歌單 • {pl.curatedBy || 'Polygon'}</div>
                  </div>
                );
              }
              // userPlaylist（2x2 封面：頭四首歌）
              const playlist = tile.data;
              const coverSongs = playlist.coverSongs || [];
              return (
                <div key={`user-${playlist.id}`} className="relative group">
                  <div 
                    onClick={() => router.push(`/library/playlist/${playlist.id}`)}
                    className="cursor-pointer"
                  >
                    <div className="aspect-square rounded-[4px] overflow-hidden mb-2 bg-[#121212] relative grid grid-cols-2 grid-rows-2">
                      {coverSongs.length === 0 ? (
                        <div className="col-span-2 row-span-2 w-full h-full flex items-center justify-center bg-[#282828]">
                          <Music className="w-12 h-12 text-[#3E3E3E]" />
                        </div>
                      ) : (
                        Array.from({ length: 4 }, (_, i) => {
                          const song = coverSongs[i];
                          if (!song) return <div key={`empty-${playlist.id}-${i}`} className="w-full h-full min-h-0 bg-[#282828]" aria-hidden />;
                          const thumb = getSongThumbnail(song);
                          return (
                            <div key={`${playlist.id}-${song.id}`} className="relative w-full h-full min-h-0 bg-[#282828]">
                              {thumb ? (
                                <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-[#282828] text-[#3E3E3E] text-lg">🎸</div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="text-white font-medium truncate" style={{ fontSize: 15, lineHeight: '20px' }}>{playlist.title}</div>
                    <div className="text-gray-500 truncate" style={{ fontSize: 13, lineHeight: '16px' }}>歌單 • {user?.displayName || '你'}</div>
                  </div>
                </div>
              );
            })}

            {/* 創建新歌單（固定最後一格） */}
            <div 
              onClick={() => setShowCreateModal(true)}
              className="aspect-square rounded-[4px] bg-[#121212] border-2 border-dashed border-[#3E3E3E] flex flex-col items-center justify-center cursor-pointer hover:border-[#FFD700] hover:bg-[#1a1a1a] transition-colors"
            >
              <Plus className="w-10 h-10 text-[#3E3E3E] mb-2" />
              <span className="text-[#B3B3B3] text-sm">創新歌單</span>
            </div>
          </div>
        </div>

        {/* 創建歌單 Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-[#121212] rounded-2xl p-6 w-full max-w-sm border border-[#282828]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-white text-xl font-bold">創新歌單</h2>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="text-[#B3B3B3] hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="歌單名稱"
                className="w-full bg-[#282828] text-white px-4 py-3 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-[#FFD700] placeholder-[#6B7280]"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && createPlaylist()}
              />
              
              <div className="flex space-x-3">
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 text-white font-medium hover:bg-[#282828] rounded-lg transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={createPlaylist}
                  disabled={!newPlaylistName.trim()}
                  className="flex-1 py-3 bg-[#FFD700] text-black font-bold rounded-lg hover:bg-[#FFA500] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  創建
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

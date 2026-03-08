// pages/library/liked.js - 設計跟歌單頁 playlist/[id] 一致
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { auth, db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { Heart, Share2, BookmarkPlus, Music } from 'lucide-react';
import { getSongThumbnail } from '../../lib/getSongThumbnail';
import { getUserPlaylists, addSongToPlaylist, createPlaylist } from '../../lib/playlistApi';
import Layout from '../../components/Layout';

function computeShuffleOrder(length) {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

export default function LikedSongs() {
  const router = useRouter();
  const [songs, setSongs] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState('default');
  const [shuffleOrder, setShuffleOrder] = useState([]);

  const [selectedSong, setSelectedSong] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [showCreatePlaylistInput, setShowCreatePlaylistInput] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        loadLikedSongs(currentUser.uid);
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && user?.uid) {
        loadLikedSongs(user.uid);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [user?.uid]);

  useEffect(() => {
    if (sortMode !== 'shuffle' || !songs.length) return;
    if (shuffleOrder.length !== songs.length) {
      setShuffleOrder(computeShuffleOrder(songs.length));
    }
  }, [sortMode, songs.length]);

  const loadLikedSongs = async (userId) => {
    setLoading(true);
    try {
      const likedQuery = query(
        collection(db, 'userLikedSongs'),
        where('userId', '==', userId)
      );
      const likedSnap = await getDocs(likedQuery);
      const songsData = await Promise.all(
        likedSnap.docs.map(async (likedDoc) => {
          const songDoc = await getDoc(doc(db, 'tabs', likedDoc.data().songId));
          if (songDoc.exists()) {
            return { id: songDoc.id, ...songDoc.data() };
          }
          return null;
        })
      );
      setSongs(songsData.filter(Boolean));
    } catch (error) {
      console.error('載入喜愛歌曲失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSortedSongs = () => {
    const sorted = [...songs];
    const artist = (s) => (s.artist || s.artistName || '').toLowerCase();
    switch (sortMode) {
      case 'artist':
        return sorted.sort((a, b) => artist(a).localeCompare(artist(b), 'zh-HK'));
      case 'year':
        return sorted.sort((a, b) => {
          const yearA = a.songYear || a.uploadYear || 0;
          const yearB = b.songYear || b.uploadYear || 0;
          if (yearA && yearB) return yearB - yearA;
          if (yearA) return -1;
          if (yearB) return 1;
          return 0;
        });
      case 'shuffle':
        if (shuffleOrder.length === sorted.length) {
          return shuffleOrder.map((i) => sorted[i]);
        }
        return sorted;
      default:
        return sorted;
    }
  };

  const sortedSongs = getSortedSongs();

  const unlikeSong = async (songId) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'userLikedSongs', `${user.uid}_${songId}`));
      setSongs(songs.filter((s) => s.id !== songId));
    } catch (error) {
      console.error('移除喜愛失敗:', error);
    }
  };

  const handleSongClick = (songId) => {
    router.push(`/tabs/${songId}`);
  };

  const handleMoreClick = async (e, song) => {
    e.stopPropagation();
    setSelectedSong(song);
    if (user) {
      const list = await getUserPlaylists(user.uid);
      setUserPlaylists(list);
    }
    setShowActionModal(true);
  };

  const handleShare = async () => {
    if (!selectedSong) return;
    const url = `${window.location.origin}/tabs/${selectedSong.id}`;
    if (navigator.share) {
      await navigator.share({
        title: `${selectedSong.title} - ${selectedSong.artist || selectedSong.artistName}`,
        url
      });
    } else {
      await navigator.clipboard.writeText(url);
      alert('已複製連結到剪貼簿');
    }
    setShowActionModal(false);
  };

  const handleRemoveFromLiked = async () => {
    if (!selectedSong) return;
    await unlikeSong(selectedSong.id);
    setShowActionModal(false);
  };

  const handleAddToPlaylistClick = () => {
    if (!user) {
      alert('請先登入');
      return;
    }
    setShowActionModal(false);
    setShowAddToPlaylist(true);
  };

  const addToPlaylist = async (playlistId) => {
    if (!selectedSong) return;
    try {
      await addSongToPlaylist(playlistId, selectedSong.id);
      setShowAddToPlaylist(false);
    } catch (error) {
      alert('加入失敗：' + (error.message || '請重試'));
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim() || !user) return;
    try {
      const result = await createPlaylist(user.uid, newPlaylistName.trim());
      await addSongToPlaylist(result.playlistId, selectedSong.id);
      setShowCreatePlaylistInput(false);
      setNewPlaylistName('');
      setShowAddToPlaylist(false);
    } catch (error) {
      alert('創建失敗：' + (error.message || '請重試'));
    }
  };

  if (loading) {
    return (
      <Layout fullWidth hideHeader>
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout fullWidth hideHeader>
      <Head>
        <meta name="theme-color" content="transparent" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>
      <div className="relative z-10 min-h-screen pb-24 bg-black" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        {/* 返回 + 封面區（同歌單頁） */}
        <div className="relative px-4 sm:px-6 pt-4 pb-4">
          <Link
            href="/library"
            className="absolute left-4 top-4 z-10 inline-flex items-center text-white hover:text-white/90 transition p-1.5 -ml-1.5"
            aria-label="返回"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div className="flex justify-center">
            <div className="w-[60vw] max-w-[300px] max-h-[300px] aspect-square overflow-hidden rounded bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center shadow-xl">
              <Heart className="w-24 h-24 text-white fill-white" />
            </div>
          </div>
        </div>

        {/* 標題行：喜愛結他譜 + 共 X 首 */}
        <div className="px-4 sm:px-6 pb-1">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="font-bold text-white truncate" style={{ fontSize: '1.5rem' }}>
              喜愛結他譜
            </h1>
            <span className="text-[12px] md:text-[14px] text-gray-500 whitespace-nowrap flex-shrink-0">
              共 {songs.length} 首
            </span>
          </div>
        </div>

        {/* Action Bar：排序 icon（同歌單頁，無收藏掣） */}
        {songs.length > 0 && (
          <div className="px-4 sm:px-6 mb-1 pt-0 pb-1 flex items-center gap-3">
            <div className="flex flex-1 min-w-0 overflow-x-auto scrollbar-hide items-center gap-0">
              <button
                type="button"
                onClick={() => setSortMode('default')}
                className={`pl-0 pr-2.5 py-2.5 rounded transition shrink-0 outline-none ${sortMode === 'default' ? 'text-[#FFD700]' : 'text-gray-400 hover:text-white'}`}
                title="預設次序"
              >
                <svg className="w-7 h-7 block shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 36.42 41.51" preserveAspectRatio="xMidYMid meet">
                  <line x1="24.56" y1="7.91" x2="24.56" y2="33.33" />
                  <polyline points="19.87 29.9 24.56 34.59 29.25 29.9" />
                  <line x1="11.86" y1="33.59" x2="11.86" y2="8.17" />
                  <polyline points="16.55 11.6 11.86 6.91 7.17 11.6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setSortMode('artist')}
                className={`-ml-2 p-2.5 rounded transition shrink-0 outline-none ${sortMode === 'artist' ? 'text-[#FFD700]' : 'text-gray-400 hover:text-white'}`}
                title="按歌手排序"
              >
                <svg className="w-7 h-7 block shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 36.42 41.51" preserveAspectRatio="xMidYMid meet">
                  <circle cx="18.21" cy="13.13" r="6.22" />
                  <path d="M29.54,34.59c0-6.26-5.07-11.33-11.33-11.33s-11.33,5.07-11.33,11.33h22.66Z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setSortMode('year')}
                className={`p-2.5 rounded transition shrink-0 outline-none ${sortMode === 'year' ? 'text-[#FFD700]' : 'text-gray-400 hover:text-white'}`}
                title="按年份排序"
              >
                <svg className="w-6 h-6 block shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 34.26 32.9" preserveAspectRatio="xMidYMid meet">
                  <line x1="23.31" y1="4.82" x2="10.94" y2="4.82" />
                  <path d="M27.01,4.82h2.84c1.32,0,2.39,1.07,2.39,2.4v21.2c0,1.33-1.07,2.4-2.39,2.4H4.4c-1.32,0-2.39-1.07-2.39-2.4V7.22c0-1.33,1.07-2.4,2.39-2.4h2.84" />
                  <path d="M9.09,2.07h0c1.02,0,1.85.83,1.85,1.85v1.82c0,1.02-.83,1.85-1.85,1.85h0c-1.02,0-1.85-.83-1.85-1.85v-1.82c0-1.02.83-1.85,1.85-1.85Z" />
                  <path d="M25.15,2.07h0c1.02,0,1.85.83,1.85,1.85v1.82c0,1.02-.83,1.85-1.85,1.85h0c-1.02,0-1.85-.83-1.85-1.85v-1.82c0-1.02.83-1.85,1.85-1.85Z" />
                  <line x1="2.55" y1="11.11" x2="31.83" y2="11.11" />
                  <line x1="6.98" y1="16.58" x2="27.27" y2="16.58" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (songs.length) {
                    setShuffleOrder(computeShuffleOrder(songs.length));
                    setSortMode('shuffle');
                  }
                }}
                className={`p-2.5 rounded transition shrink-0 outline-none ${sortMode === 'shuffle' ? 'text-[#FFD700]' : 'text-gray-400 hover:text-white'}`}
                title="隨機排序"
              >
                <svg className="w-6 h-6 block shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" viewBox="35 5 34 34" preserveAspectRatio="xMidYMid meet">
                  <polyline points="62.42 28.27 65.96 31.81 62.42 35.35" />
                  <path d="M37.68,10.76h3.03c2.29,0,4.45,1.27,5.8,3.41l8.95,14.22c1.35,2.15,3.51,3.41,5.8,3.41h4.27" />
                  <path d="M37.68,31.81h3.03c2.29,0,4.45-1.27,5.8-3.41l8.95-14.22c1.35-2.15,3.51-3.41,5.8-3.41h4.27" />
                  <polyline points="62.42 14.3 65.96 10.76 62.42 7.22" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Songs List（同歌單頁） */}
        {songs.length > 0 ? (
          <div className="px-4 sm:px-6">
            {sortedSongs.map((song) => (
              <div key={song.id} className="group">
                <button
                  onClick={() => handleSongClick(song.id)}
                  className="w-full flex items-center gap-3 py-2 pl-2 pr-2 rounded-[7px] md:hover:bg-white/5 md:transition"
                >
                  <div className="w-[49px] h-[49px] rounded-[5px] bg-gray-800 flex-shrink-0 overflow-hidden">
                    {getSongThumbnail(song) ? (
                      <img
                        src={getSongThumbnail(song)}
                        alt={song.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-2xl">🎸</span>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <h3 className="text-[1rem] font-medium text-[#e6e6e6] truncate md:group-hover:text-[#FFD700] md:transition">
                      {song.title}
                    </h3>
                    <p className="text-[0.85rem] text-[#999] truncate">{song.artist || song.artistName}</p>
                  </div>
                  <button
                    onClick={(e) => handleMoreClick(e, song)}
                    className="pl-1 pr-0 py-1 flex items-center justify-end flex-shrink-0 text-[#999] hover:text-white transition"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 14.96 2.54" fill="currentColor" aria-hidden>
                      <circle cx="1.27" cy="1.27" r="1.27" />
                      <circle cx="7.48" cy="1.27" r="1.27" />
                      <circle cx="13.69" cy="1.27" r="1.27" />
                    </svg>
                  </button>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Heart className="w-16 h-16 text-[#3E3E3E] mx-auto mb-4" />
            <h3 className="text-xl text-white mb-2">還沒有喜愛的歌曲</h3>
            <p className="text-gray-500 mb-6">將結他譜加入「喜愛」後會顯示在這裡</p>
            <Link
              href="/search"
              className="inline-flex items-center px-6 py-3 bg-[#FFD700] text-black rounded-full font-medium hover:opacity-90 transition"
            >
              去發掘音樂
            </Link>
          </div>
        )}

        {/* Action Modal（分享 / 取消喜愛 / 加入歌單） */}
        {showActionModal && (
          <>
            <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowActionModal(false)} />
            <div className="fixed bottom-0 left-0 right-0 bg-[#121212] rounded-t-2xl z-[60] p-4 pb-24">
              <div className="w-12 h-1 bg-[#3E3E3E] rounded-full mx-auto mb-4" />
              {selectedSong && (
                <div className="mb-4 pb-4 border-b border-gray-800">
                  <p className="text-white font-medium truncate">{selectedSong.title}</p>
                  <p className="text-gray-400 text-sm truncate">{selectedSong.artist || selectedSong.artistName}</p>
                </div>
              )}
              <div className="space-y-1">
                <button onClick={handleShare} className="w-full flex items-center space-x-4 p-3 hover:bg-[#1a1a1a] rounded-lg">
                  <Share2 className="w-5 h-5 text-[#B3B3B3]" />
                  <span className="text-white">分享</span>
                </button>
                <button onClick={handleRemoveFromLiked} className="w-full flex items-center space-x-4 p-3 hover:bg-[#1a1a1a] rounded-lg">
                  <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                  <span className="text-white">取消喜愛</span>
                </button>
                <button onClick={handleAddToPlaylistClick} className="w-full flex items-center space-x-4 p-3 hover:bg-[#1a1a1a] rounded-lg">
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
            <div
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => {
                setShowAddToPlaylist(false);
                setShowCreatePlaylistInput(false);
                setNewPlaylistName('');
              }}
            />
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
                <button
                  onClick={() => setShowCreatePlaylistInput(true)}
                  className="w-full flex items-center space-x-3 p-3 hover:bg-[#1a1a1a] rounded-lg text-left border-t border-gray-800 mt-2"
                >
                  <div className="w-12 h-12 rounded-[4px] bg-[#FFD700] flex items-center justify-center">
                    <span className="text-black text-2xl font-light">+</span>
                  </div>
                  <span className="text-[#FFD700] font-medium">創建新歌單</span>
                </button>
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

        <style jsx global>{`
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
    </Layout>
  );
}

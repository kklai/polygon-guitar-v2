// pages/library/liked.js - 設計跟歌單頁 playlist/[id] 一致
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from '@/components/Link';
import { auth, db } from '../../lib/firebase';
import { collection, query, where, getDocs, deleteDoc } from '@/lib/firestore-tracked';
import { getTabsByIds } from '../../lib/tabs';
import { Heart, Share, Music, Plus, Copy, ArrowLeft } from 'lucide-react';
import { getSongThumbnail } from '../../lib/getSongThumbnail';
import { getUserPlaylists, addSongToPlaylist, createPlaylist, removeSongFromPlaylist } from '../../lib/playlistApi';
import SongActionSheet from '../../components/SongActionSheet';
import Layout from '../../components/Layout';
import { useArtistMap } from '@/lib/useArtistMap';

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
  const { getArtistName } = useArtistMap();
  const [songs, setSongs] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState('default');
  const [shuffleOrder, setShuffleOrder] = useState([]);

  const [selectedSong, setSelectedSong] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [addToPlaylistSelectedIds, setAddToPlaylistSelectedIds] = useState([]);
  const [addToPlaylistInitialIds, setAddToPlaylistInitialIds] = useState([]);
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
      const songIds = likedSnap.docs.map((d) => d.data().songId).filter(Boolean);
      const songsData = songIds.length ? await getTabsByIds(songIds) : [];
      setSongs(songsData);
    } catch (error) {
      console.error('載入喜愛歌曲失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSortedSongs = () => {
    const sorted = [...songs];
    switch (sortMode) {
      case 'artist':
        return sorted.sort((a, b) => (getArtistName(a) || '').toLowerCase().localeCompare((getArtistName(b) || '').toLowerCase(), 'zh-HK'));
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

  const handleCopyShareLink = async () => {
    if (!selectedSong) return;
    const url = `${window.location.origin}/tabs/${selectedSong.id}`;
    try {
      await navigator.clipboard.writeText(url);
      alert('已複製連結');
    } catch (err) {
      alert('複製失敗');
    }
  };

  const handleSelectLyricsShare = () => {
    if (!selectedSong?.id) return;
    setShowActionModal(false);
    router.push(`/tools/tab-share?tabId=${selectedSong.id}`);
  };

  const handleShare = async () => {
    if (!selectedSong) return;
    const url = `${window.location.origin}/tabs/${selectedSong.id}`;
    if (navigator.share) {
      await navigator.share({
        title: `${selectedSong.title} - ${getArtistName(selectedSong)}`,
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
    // 預設剔選已包含此歌嘅歌單
    const alreadyIn = (userPlaylists || [])
      .filter((pl) => pl.songIds && pl.songIds.includes(selectedSong?.id))
      .map((pl) => pl.id);
    setAddToPlaylistSelectedIds(alreadyIn);
    setAddToPlaylistInitialIds(alreadyIn);
    setShowAddToPlaylist(true);
  };

  const toggleAddToPlaylistSelection = (playlistId) => {
    setAddToPlaylistSelectedIds((prev) =>
      prev.includes(playlistId) ? prev.filter((pid) => pid !== playlistId) : [...prev, playlistId]
    );
  };

  const confirmAddToPlaylist = async () => {
    if (!selectedSong) return;
    const idsToAdd = addToPlaylistSelectedIds.filter((id) => !addToPlaylistInitialIds.includes(id));
    const idsToRemove = addToPlaylistInitialIds.filter((id) => !addToPlaylistSelectedIds.includes(id));
    if (idsToAdd.length === 0 && idsToRemove.length === 0) {
      setShowAddToPlaylist(false);
      setAddToPlaylistSelectedIds([]);
      setAddToPlaylistInitialIds([]);
      return;
    }
    try {
      for (const playlistId of idsToAdd) {
        await addSongToPlaylist(playlistId, selectedSong.id);
      }
      for (const playlistId of idsToRemove) {
        await removeSongFromPlaylist(playlistId, selectedSong.id);
      }
      setShowAddToPlaylist(false);
      setAddToPlaylistSelectedIds([]);
      setAddToPlaylistInitialIds([]);
      if (idsToAdd.length && idsToRemove.length) {
        alert(`已加入 ${idsToAdd.length} 個歌單，已從 ${idsToRemove.length} 個歌單移除`);
      } else if (idsToRemove.length) {
        alert(idsToRemove.length > 1 ? `已從 ${idsToRemove.length} 個歌單移除` : '已從歌單移除');
      } else {
        alert(idsToAdd.length > 1 ? `已加入 ${idsToAdd.length} 個歌單` : '已加入歌單');
      }
    } catch (error) {
      alert('操作失敗：' + (error.message || '請重試'));
    }
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
        {/* 返回 + 標題區（無封面） */}
        <div className="relative pt-4 pb-1" style={{ paddingLeft: '1rem', paddingRight: '1rem' }}>
          <Link
            href="/library"
            className="inline-flex items-center text-white hover:text-white/90 transition p-1.5 -ml-1.5"
            aria-label="返回"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>

        {/* 標題行：喜愛結他譜 + 共 X 份 */}
        <div className="pb-1" style={{ paddingLeft: '1rem', paddingRight: '1rem' }}>
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="font-bold text-white truncate" style={{ fontSize: '1.5rem' }}>
              喜愛結他譜
            </h1>
            <span className="text-[12px] md:text-[14px] text-neutral-500 whitespace-nowrap flex-shrink-0">
              共 {songs.length} 份
            </span>
          </div>
        </div>

        {/* Action Bar：排序 icon（同歌單頁，無收藏掣） */}
        {songs.length > 0 && (
          <div className="mb-1 pt-0 pb-1 flex items-center gap-3" style={{ paddingLeft: '1rem', paddingRight: '1rem' }}>
            <div className="flex flex-1 min-w-0 overflow-x-auto scrollbar-hide items-center gap-0">
              <button
                type="button"
                onClick={() => setSortMode('default')}
                className={`pl-0 pr-2.5 py-2.5 rounded transition shrink-0 outline-none ${sortMode === 'default' ? 'text-[#FFD700]' : 'text-neutral-400 hover:text-white'}`}
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
                className={`-ml-2 p-2.5 rounded transition shrink-0 outline-none ${sortMode === 'artist' ? 'text-[#FFD700]' : 'text-neutral-400 hover:text-white'}`}
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
                className={`p-2.5 rounded transition shrink-0 outline-none ${sortMode === 'year' ? 'text-[#FFD700]' : 'text-neutral-400 hover:text-white'}`}
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
                className={`p-2.5 rounded transition shrink-0 outline-none ${sortMode === 'shuffle' ? 'text-[#FFD700]' : 'text-neutral-400 hover:text-white'}`}
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
          <div style={{ paddingLeft: '1rem', paddingRight: '1rem' }}>
            {sortedSongs.map((song) => (
              <div key={song.id} className="group">
                <button
                  onClick={() => handleSongClick(song.id)}
                  className="w-full flex items-center gap-3 py-2 pl-0 pr-0 rounded-[7px] md:hover:bg-white/5 md:transition"
                >
                  <div className="w-[49px] h-[49px] rounded-[5px] bg-neutral-800 flex-shrink-0 overflow-hidden">
                    {getSongThumbnail(song) ? (
                      <img
                        src={getSongThumbnail(song)}
                        alt={song.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-neutral-500"><Music className="w-6 h-6" strokeWidth={1.5} /></span>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <h3 className="text-[1rem] font-medium text-[#e6e6e6] truncate md:group-hover:text-[#FFD700] md:transition">
                      {song.title}
                    </h3>
                    <p className="text-[0.85rem] text-[#999] truncate">{getArtistName(song)}</p>
                  </div>
                  <button
                    onClick={(e) => handleMoreClick(e, song)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0 text-[#999] hover:text-white transition -my-1"
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
          <div className="text-center py-16" style={{ paddingLeft: '1rem', paddingRight: '1rem' }}>
            <Heart className="w-16 h-16 text-[#3E3E3E] mx-auto mb-4" />
            <h3 className="text-xl text-white mb-2">還沒有喜愛的歌曲</h3>
            <p className="text-neutral-500 mb-6">將結他譜加入「喜愛」後會顯示在這裡</p>
            <Link
              href="/search"
              className="inline-flex items-center px-6 py-3 bg-[#FFD700] text-black rounded-full font-medium hover:opacity-90 transition"
            >
              去發掘音樂
            </Link>
          </div>
        )}

        {/* Action Modal（統一用 SongActionSheet：1rem 對齊 / 拖曳關閉 / 封面） */}
        <SongActionSheet
          open={showActionModal}
          onClose={() => setShowActionModal(false)}
          title={selectedSong?.title ?? ''}
          artist={selectedSong ? getArtistName(selectedSong) : ''}
          thumbnailUrl={selectedSong ? getSongThumbnail(selectedSong) : null}
          liked
          likeLabel="取消喜愛"
          onCopyShareLink={handleCopyShareLink}
          onSelectLyricsShare={handleSelectLyricsShare}
          onAddToLiked={handleRemoveFromLiked}
          onAddToPlaylist={handleAddToPlaylistClick}
          artistHref={selectedSong && (selectedSong.artistId || selectedSong.artist_id || selectedSong.artistSlug) ? `/artists/${selectedSong.artistId || selectedSong.artist_id || selectedSong.artistSlug}` : undefined}
          paddingBottom="calc(6rem + env(safe-area-inset-bottom, 0))"
        />

        {/* 加入歌單 Modal */}
        {showAddToPlaylist && (
          <>
            <div
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => {
                setShowAddToPlaylist(false);
                setShowCreatePlaylistInput(false);
                setNewPlaylistName('');
                setAddToPlaylistSelectedIds([]);
                setAddToPlaylistInitialIds([]);
              }}
            />
            <div className="fixed bottom-0 left-0 right-0 bg-[#121212] rounded-t-2xl z-[60] pb-24 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-col items-center justify-center py-2 min-h-[36px]">
                <div className="w-10 h-1 rounded-full bg-[#525252] shrink-0" />
              </div>
              <div className="text-left" style={{ paddingLeft: '1rem', paddingRight: '1rem' }}>
              <h3 className="text-white text-lg font-bold mb-4">加入歌單</h3>
              <div className="space-y-2">
                {userPlaylists.map((pl) => {
                  const isSelected = addToPlaylistSelectedIds.includes(pl.id);
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => toggleAddToPlaylistSelection(pl.id)}
                      className="w-full flex items-center gap-3 pl-0 pr-3 py-1.5 hover:bg-[#1a1a1a] rounded-2xl text-left"
                    >
                      <div className="w-12 h-12 rounded-[4px] bg-[#282828] flex items-center justify-center flex-shrink-0">
                        <Music className="w-6 h-6 text-[#3E3E3E]" />
                      </div>
                      <span className="text-white font-medium flex-1 min-w-0 truncate">{pl.title}</span>
                      <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 ${isSelected ? 'bg-[#FFD700] border-[#FFD700]' : 'border-[#525252]'}`}>
                        {isSelected && (
                          <svg className="w-3.5 h-3.5 text-black" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}

                {/* 分隔線（space-y-2 統一 0.5rem） */}
                <div className="h-px bg-[#3E3E3E] w-full shrink-0" />
                <button
                  type="button"
                  onClick={() => setShowCreatePlaylistInput(true)}
                  className="w-full flex items-center space-x-3 pl-0 pr-3 py-1.5 hover:bg-[#1a1a1a] rounded-2xl text-left"
                >
                  <div className="w-12 h-12 rounded-[4px] bg-[#121212] border-2 border-dashed border-[#FFD700] flex items-center justify-center flex-shrink-0">
                    <Plus className="w-6 h-6 text-[#FFD700]" />
                  </div>
                  <span className="text-[#FFD700] font-medium">創建新歌單</span>
                </button>

                <button
                  type="button"
                  onClick={confirmAddToPlaylist}
                  disabled={!addToPlaylistSelectedIds.some((id) => !addToPlaylistInitialIds.includes(id)) && !addToPlaylistInitialIds.some((id) => !addToPlaylistSelectedIds.includes(id))}
                  className={`w-full py-3 rounded-full font-medium transition ${addToPlaylistSelectedIds.some((id) => !addToPlaylistInitialIds.includes(id)) || addToPlaylistInitialIds.some((id) => !addToPlaylistSelectedIds.includes(id)) ? 'bg-[#FFD700] text-black hover:bg-yellow-400' : 'bg-[#3E3E3E] text-[#737373] cursor-not-allowed'}`}
                >
                  確認
                </button>

                {showCreatePlaylistInput && (
                  <div className="mt-3 p-3 bg-[#1a1a1a] rounded-lg text-left">
                    <input
                      type="text"
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      placeholder="輸入歌單名稱"
                      className="w-full bg-[#282828] text-white px-3 py-2 rounded-lg mb-2 outline-none"
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

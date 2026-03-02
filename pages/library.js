// pages/library.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Plus, Heart, Share2, Music, MoreVertical, X } from 'lucide-react';
import { getUserPlaylists, getPlaylistCovers, toggleLikeSong, getUserLikedSongs } from '../lib/playlistApi';

export default function Library() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [likedCount, setLikedCount] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        loadData(currentUser.uid);
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, []);

  const loadData = async (userId) => {
    setLoading(true);
    try {
      // 獲取用戶歌單
      const userPlaylists = await getUserPlaylists(userId);
      
      // 獲取每個歌單的封面
      const playlistsWithCovers = await Promise.all(
        userPlaylists.map(async (pl) => {
          const covers = await getPlaylistCovers(pl.songIds || []);
          return { ...pl, covers };
        })
      );
      
      setPlaylists(playlistsWithCovers);
      
      // 獲取喜愛歌曲數量
      const likedSongs = await getUserLikedSongs(userId);
      setLikedCount(likedSongs.length);
    } catch (error) {
      console.error('載入收藏失敗:', error);
    } finally {
      setLoading(false);
    }
  };

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
      loadData(user.uid);
    } catch (error) {
      console.error('創建歌單失敗:', error);
      alert('創建失敗，請重試');
    }
  };

  const handleShare = async (e, playlist) => {
    e.stopPropagation();
    const url = `${window.location.origin}/playlist/${playlist.id}`;
    
    if (navigator.share) {
      await navigator.share({
        title: playlist.title,
        text: `查看我的歌單：${playlist.title}`,
        url: url
      });
    } else {
      navigator.clipboard.writeText(url);
      alert('連結已複製到剪貼簿');
    }
  };

  const handlePlaylistClick = (playlistId) => {
    router.push(`/playlist/${playlistId}`);
  };

  const handleLikedSongsClick = () => {
    router.push('/library/liked');
  };

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-[#282828] overflow-hidden flex items-center justify-center">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <span className="text-white font-bold">{user?.displayName?.[0] || 'U'}</span>
          )}
        </div>
        <h1 className="text-white text-2xl font-bold">收藏</h1>
      </div>

      {/* 歌單網格 */}
      <div className="px-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-w-3xl mx-auto">
          {/* 喜愛結他譜（系統預設） */}
          <div 
            onClick={handleLikedSongsClick}
            className="cursor-pointer group max-w-[144px]"
          >
            <div className="aspect-square rounded-[4px] bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center mb-2 relative overflow-hidden shadow-lg max-w-[144px] max-h-[144px]">
              <Heart className="w-12 h-12 sm:w-14 sm:h-14 text-white fill-white" />
              {likedCount > 0 && (
                <div className="absolute bottom-2 right-2 bg-black/20 px-2 py-1 rounded-full">
                  <span className="text-white text-xs font-bold">{likedCount}</span>
                </div>
              )}
            </div>
            <h3 className="text-white font-bold mb-1">喜愛結他譜</h3>
            <p className="text-[#B3B3B3] text-sm">歌單 • {likedCount}份譜</p>
          </div>

          {/* 用戶自建歌單 */}
          {playlists.map((playlist) => (
            <div key={playlist.id} className="relative group max-w-[144px]">
              <div 
                onClick={() => router.push(`/library/playlist/${playlist.id}`)}
                className="cursor-pointer"
              >
                {/* 封面 */}
                <div className="aspect-square rounded-[4px] overflow-hidden mb-2 bg-[#121212] relative max-w-[144px] max-h-[144px]">
                  {playlist.covers && playlist.covers.length > 0 ? (
                    <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-0.5">
                      {playlist.covers.map((cover, i) => (
                        <img key={i} src={cover} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async" />
                      ))}
                      {Array(4 - playlist.covers.length).fill(0).map((_, i) => (
                        <div key={`empty-${i}`} className="bg-[#282828] w-full h-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#282828]">
                      <Music className="w-12 h-12 text-[#3E3E3E]" />
                    </div>
                  )}
                </div>
                
                <h3 className="text-white font-bold mb-1 truncate">{playlist.title}</h3>
                <p className="text-[#B3B3B3] text-sm truncate">
                  歌單 • {user?.displayName || '你'}
                </p>
              </div>
              
              {/* 分享按鈕 */}
              <button 
                onClick={(e) => handleShare(e, playlist)}
                className="absolute top-2 right-2 p-2 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
              >
                <Share2 className="w-4 h-4 text-white" />
              </button>
            </div>
          ))}

          {/* 創建新歌單 */}
          <div 
            onClick={() => setShowCreateModal(true)}
            className="aspect-square rounded-[4px] bg-[#121212] border-2 border-dashed border-[#3E3E3E] flex flex-col items-center justify-center cursor-pointer hover:border-[#FFD700] hover:bg-[#1a1a1a] transition-colors max-w-[144px] max-h-[144px]"
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

      {/* 底部導航 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#FFD700] z-50">
        <div className="flex justify-around items-center h-16">
          <button onClick={() => router.push('/')} className="flex flex-col items-center text-black/60 hover:text-black w-full">
            <span className="text-xs font-medium">首頁</span>
          </button>
          <button onClick={() => router.push('/search')} className="flex flex-col items-center text-black/60 hover:text-black w-full">
            <span className="text-xs font-medium">搜尋</span>
          </button>
          <button onClick={() => router.push('/artists')} className="flex flex-col items-center text-black/60 hover:text-black w-full">
            <span className="text-xs font-medium">歌手</span>
          </button>
          <button onClick={() => router.push('/library')} className="flex flex-col items-center text-black font-bold w-full">
            <span className="text-xs font-medium">收藏</span>
          </button>
          <button onClick={() => router.push('/tabs/new')} className="flex flex-col items-center text-black/60 hover:text-black w-full">
            <span className="text-xs font-medium">上傳</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

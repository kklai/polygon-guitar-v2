// pages/library.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Plus, Heart, Share2, Music, X } from 'lucide-react';
import { getUserPlaylists, getUserLikedSongs } from '../lib/playlistApi';
import Layout from '../components/Layout';

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

  // 頁面重新顯示時重新載入喜愛數量（例如從譜頁撳完喜愛返嚟）
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && user?.uid) {
        loadData(user.uid);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [user?.uid]);

  const loadData = async (userId) => {
    setLoading(true);
    try {
      // 獲取用戶歌單
      const userPlaylists = await getUserPlaylists(userId);
      
      // 獲取每個歌單的第一首歌封面
      const playlistsWithCovers = await Promise.all(
        userPlaylists.map(async (pl) => {
          const firstSongId = pl.songIds?.[0];
          let coverUrl = null;
          if (firstSongId) {
            const songDoc = await getDoc(doc(db, 'tabs', firstSongId));
            if (songDoc.exists()) {
              const songData = songDoc.data();
              // 優先使用專輯封面，其次是 YouTube 縮圖
              coverUrl = songData.albumImage || songData.thumbnail || null;
            }
          }
          return { ...pl, coverUrl };
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

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-black pb-24">
        {/* Header */}
        <div className="pt-6 pb-4 flex items-center space-x-3">
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
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
                  {/* 封面 - 第一首歌 */}
                  <div className="aspect-square rounded-[4px] overflow-hidden mb-2 bg-[#121212] relative max-w-[144px] max-h-[144px]">
                    {playlist.coverUrl ? (
                      <img 
                        src={playlist.coverUrl} 
                        className="w-full h-full object-cover" 
                        alt="" 
                        loading="lazy" 
                        decoding="async" 
                      />
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
      </div>
    </Layout>
  );
}

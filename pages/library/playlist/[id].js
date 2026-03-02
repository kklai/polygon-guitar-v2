import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Music, MoreVertical, Share2, Heart, BookmarkPlus } from 'lucide-react';
import Link from 'next/link';
import Layout from '../../../components/Layout';
import { toggleLikeSong, getUserPlaylists, addSongToPlaylist, createPlaylist } from '../../../lib/playlistApi';
import { useAuth } from '../../../contexts/AuthContext';

export default function UserPlaylistDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [playlist, setPlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 操作選單狀態
  const [selectedSong, setSelectedSong] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [showCreatePlaylistInput, setShowCreatePlaylistInput] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  useEffect(() => {
    if (id && user) {
      loadPlaylist(user.uid);
    }
  }, [id, user]);

  const loadPlaylist = async (userId) => {
    setLoading(true);
    try {
      const playlistDoc = await getDoc(doc(db, 'userPlaylists', id));
      
      if (!playlistDoc.exists()) {
        setLoading(false);
        return;
      }

      const playlistData = { id: playlistDoc.id, ...playlistDoc.data() };
      
      if (playlistData.userId !== userId) {
        setLoading(false);
        return;
      }

      setPlaylist(playlistData);

      if (playlistData.songIds && playlistData.songIds.length > 0) {
        const songDetails = [];
        for (const songId of playlistData.songIds) {
          const songDoc = await getDoc(doc(db, 'tabs', songId));
          if (songDoc.exists()) {
            songDetails.push({ id: songDoc.id, ...songDoc.data() });
          }
        }
        setSongs(songDetails);
      }
    } catch (error) {
      console.error('載入歌單失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMoreClick = async (e, song) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedSong(song);
    if (user) {
      const playlists = await getUserPlaylists(user.uid);
      setUserPlaylists(playlists);
    }
    setShowActionModal(true);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/tabs/${selectedSong.id}`;
    if (navigator.share) {
      await navigator.share({
        title: `${selectedSong.title} - ${selectedSong.artist}`,
        url
      });
    } else {
      await navigator.clipboard.writeText(url);
      alert('已複製連結到剪貼簿');
    }
    setShowActionModal(false);
  };

  const handleAddToLiked = async () => {
    if (!selectedSong || !user) return;
    try {
      const result = await toggleLikeSong(user.uid, selectedSong.id);
      alert(result.isLiked ? '已加到最喜愛 ❤️' : '已取消最喜愛');
      setShowActionModal(false);
    } catch (error) {
      alert('操作失敗：' + error.message);
    }
  };

  const handleAddToPlaylistClick = () => {
    setShowActionModal(false);
    setShowAddToPlaylist(true);
  };

  const addToPlaylist = async (playlistId) => {
    if (!selectedSong) return;
    try {
      await addSongToPlaylist(playlistId, selectedSong.id);
      setShowAddToPlaylist(false);
      alert('已加入歌單');
    } catch (error) {
      alert('加入失敗：' + error.message);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim() || !user || !selectedSong) return;
    try {
      const result = await createPlaylist(user.uid, newPlaylistName.trim());
      await addSongToPlaylist(result.playlistId, selectedSong.id);
      setShowCreatePlaylistInput(false);
      setShowAddToPlaylist(false);
      setNewPlaylistName('');
      alert(`已創建歌單「${newPlaylistName.trim()}」並加入歌曲`);
    } catch (error) {
      alert('創建歌單失敗：' + error.message);
    }
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

  if (!playlist) {
    return (
      <Layout>
        <div className="min-h-screen bg-black px-4 py-8">
          <p className="text-gray-400">歌單不存在或你無權限查看</p>
          <button 
            onClick={() => router.push('/library')}
            className="mt-4 text-[#FFD700] hover:underline"
          >
            返回收藏
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-black pb-24">
        {/* Header */}
        <div className="px-4 py-4 flex items-center space-x-3">
          <button 
            onClick={() => router.push('/library')}
            className="text-white hover:text-[#FFD700]"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-white text-xl font-bold truncate">{playlist.title}</h1>
        </div>

        {/* Playlist Info */}
        <div className="px-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-24 h-24 rounded-[4px] bg-[#121212] overflow-hidden flex-shrink-0">
              {songs.length > 0 && songs[0].thumbnail ? (
                <img 
                  src={songs[0].thumbnail} 
                  alt="cover" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="w-10 h-10 text-[#3E3E3E]" />
                </div>
              )}
            </div>
            <div>
              <p className="text-gray-400 text-sm">{songs.length} 首歌</p>
              <p className="text-gray-500 text-xs mt-1">由 {user?.displayName || '你'} 創建</p>
            </div>
          </div>
        </div>

        {/* Songs List */}
        <div className="px-4 space-y-2">
          {songs.length === 0 ? (
            <div className="text-center py-12">
              <Music className="w-16 h-16 text-[#3E3E3E] mx-auto mb-4" />
              <p className="text-gray-400">呢個歌單暫時冇歌曲</p>
              <p className="text-gray-500 text-sm mt-2">去樂譜庫加啲歌入嚟啦</p>
            </div>
          ) : (
            songs.map((song, index) => (
              <div key={song.id} className="group">
                <Link href={`/tabs/${song.id}`}>
                  <div className="flex items-center space-x-3 p-3 hover:bg-[#121212] rounded-lg transition-colors cursor-pointer">
                    <span className="text-gray-500 w-6 text-center">{index + 1}</span>
                    {song.thumbnail ? (
                      <img 
                        src={song.thumbnail} 
                        alt={song.title}
                        className="w-12 h-12 rounded object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-[#282828] flex items-center justify-center">
                        <Music className="w-6 h-6 text-[#3E3E3E]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">{song.title}</h3>
                      <p className="text-gray-400 text-sm truncate">{song.artist}</p>
                    </div>
                    {/* 三點按鈕 - 點擊時阻止跳轉 */}
                    <button
                      onClick={(e) => handleMoreClick(e, song)}
                      className="p-2 text-[#B3B3B3] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </Link>
              </div>
            ))
          )}
        </div>

        {/* Action Modal */}
        {showActionModal && (
          <>
            <div 
              className="fixed inset-0 bg-black/60 z-50" 
              onClick={() => setShowActionModal(false)} 
            />
            <div className="fixed bottom-0 left-0 right-0 bg-[#121212] rounded-t-2xl z-[60] p-4 pb-24">
              <div className="w-12 h-1 bg-[#3E3E3E] rounded-full mx-auto mb-4" />
              
              {selectedSong && (
                <div className="mb-4 pb-4 border-b border-gray-800">
                  <p className="text-white font-medium truncate">{selectedSong.title}</p>
                  <p className="text-gray-400 text-sm truncate">{selectedSong.artist}</p>
                </div>
              )}
              
              <div className="space-y-1">
                <button 
                  onClick={handleShare}
                  className="w-full flex items-center space-x-4 p-3 hover:bg-[#1a1a1a] rounded-lg"
                >
                  <Share2 className="w-5 h-5 text-[#B3B3B3]" />
                  <span className="text-white">分享</span>
                </button>
                
                <button 
                  onClick={handleAddToLiked}
                  className="w-full flex items-center space-x-4 p-3 hover:bg-[#1a1a1a] rounded-lg"
                >
                  <Heart className="w-5 h-5 text-red-500" />
                  <span className="text-white">加到我最喜愛</span>
                </button>
                
                <button 
                  onClick={handleAddToPlaylistClick}
                  className="w-full flex items-center space-x-4 p-3 hover:bg-[#1a1a1a] rounded-lg"
                >
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
      </div>
    </Layout>
  );
}

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Music } from 'lucide-react';
import Link from 'next/link';

export default function UserPlaylistDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [playlist, setPlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        if (id) loadPlaylist(currentUser.uid);
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [id, router]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <p className="text-gray-400">歌單不存在或你無權限查看</p>
        <button 
          onClick={() => router.push('/library')}
          className="mt-4 text-[#FFD700] hover:underline"
        >
          返回收藏
        </button>
      </div>
    );
  }

  return (
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
            <Link key={song.id} href={`/tabs/${song.id}`}>
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
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Bottom Nav */}
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

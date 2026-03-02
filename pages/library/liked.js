// pages/library/liked.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { ArrowLeft, Heart, MoreVertical } from 'lucide-react';
import Layout from '../../components/Layout';

export default function LikedSongs() {
  const router = useRouter();
  const [songs, setSongs] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const unlikeSong = async (songId) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'userLikedSongs', `${user.uid}_${songId}`));
      setSongs(songs.filter(s => s.id !== songId));
    } catch (error) {
      console.error('移除喜愛失敗:', error);
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

  return (
    <Layout>
      <div className="min-h-screen bg-black pb-24">
        {/* Header */}
        <div className="px-4 py-4 flex items-center space-x-3 sticky top-0 bg-black/95 backdrop-blur-sm z-10">
          <button onClick={() => router.back()} className="text-white p-2 -ml-2 hover:bg-[#1a1a1a] rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-white text-xl font-bold">喜愛結他譜</h1>
        </div>

        {/* 歌曲列表 */}
        <div className="px-4">
          {songs.length === 0 ? (
            <div className="text-center py-20">
              <Heart className="w-16 h-16 text-[#3E3E3E] mx-auto mb-4" />
              <p className="text-[#B3B3B3] mb-4">還沒有喜愛的歌曲</p>
              <button 
                onClick={() => router.push('/search')}
                className="text-[#FFD700] font-medium hover:underline"
              >
                去發掘音樂
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {songs.map((song, index) => (
                <div 
                  key={song.id}
                  className="flex items-center py-3 border-b border-[#282828] group hover:bg-[#1a1a1a] px-2 -mx-2 rounded-lg transition-colors"
                >
                  <span className="text-[#B3B3B3] w-8 text-center text-sm">{index + 1}</span>
                  
                  {/* 歌曲封面 */}
                  <div className="w-12 h-12 rounded-[4px] overflow-hidden mr-3 bg-[#282828] flex-shrink-0">
                    {song.thumbnail || song.youtubeThumbnail ? (
                      <img 
                        src={song.thumbnail || song.youtubeThumbnail} 
                        alt={song.title} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#3E3E3E]">♪</div>
                    )}
                  </div>
                  
                  {/* 歌曲資訊 */}
                  <div 
                    onClick={() => router.push(`/tabs/${song.id}`)}
                    className="flex-1 min-w-0 cursor-pointer"
                  >
                    <h4 className="text-white font-medium truncate mb-0.5">{song.title}</h4>
                    <p className="text-[#B3B3B3] text-sm truncate">{song.artistName || song.artist}</p>
                  </div>
                  
                  {/* 取消喜愛 */}
                  <button 
                    onClick={() => unlikeSong(song.id)}
                    className="p-2 text-[#FFD700] hover:bg-[#282828] rounded-full transition-colors"
                  >
                    <Heart className="w-5 h-5 fill-[#FFD700]" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

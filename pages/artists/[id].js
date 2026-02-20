// pages/artists/[id].js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, increment } from 'firebase/firestore';
import { ArrowLeft, MoreVertical, Share2, Heart, BookmarkPlus, ChevronDown, Music } from 'lucide-react';
import RatingSystem from '../../components/RatingSystem';
import { getTabStats } from '../../lib/ratingApi';
import { getTabsByArtist } from '../../lib/tabs';
import { toggleLikeSong, checkIsLiked, getUserPlaylists, addSongToPlaylist } from '../../lib/playlistApi';

export default function ArtistPage() {
  const router = useRouter();
  const { id } = router.query;
  const [artist, setArtist] = useState(null);
  const [hotTabs, setHotTabs] = useState([]);
  const [allTabs, setAllTabs] = useState([]);
  const [sortBy, setSortBy] = useState('year'); // year, strokes, views
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [selectedTab, setSelectedTab] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (id) loadArtistData();
  }, [id]);

  const loadArtistData = async () => {
    setLoading(true);
    try {
      // 獲取歌手資料
      const artistDoc = await getDoc(doc(db, 'artists', id));
      if (!artistDoc.exists()) {
        router.push('/artists');
        return;
      }
      const artistData = { id: artistDoc.id, ...artistDoc.data() };
      setArtist(artistData);

      // 使用 getTabsByArtist 獲取歌曲（支援多種 artistId 格式兼容）
      const tabs = await getTabsByArtist(artistData.name, artistData.normalizedName || artistData.id);
      
      // 按瀏覽數排序
      tabs.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
      
      // 前5首為熱門
      setHotTabs(tabs.slice(0, 5));
      setAllTabs(tabs.slice(5));
    } catch (error) {
      console.error('載入歌手資料失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  // 分組顯示（按年份）
  const groupByYear = (tabs) => {
    const groups = {};
    tabs.forEach(tab => {
      const year = tab.uploadYear || new Date(tab.createdAt?.toDate?.() || Date.now()).getFullYear();
      const range = getYearRange(year);
      if (!groups[range]) groups[range] = [];
      groups[range].push({ ...tab, year });
    });
    return groups;
  };

  const getYearRange = (year) => {
    if (year >= 2021) return '2021-2026';
    if (year >= 2016) return '2016-2020';
    if (year >= 2011) return '2011-2015';
    if (year >= 2006) return '2006-2010';
    return '2000-2005';
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
      tabs.sort((a, b) => (b.uploadYear || 0) - (a.uploadYear || 0));
    } else if (sortBy === 'views') {
      tabs.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    } else if (sortBy === 'strokes') {
      // 簡單筆畫排序（按標題）
      tabs.sort((a, b) => a.title.localeCompare(b.title, 'zh-HK'));
    }
    return tabs;
  };

  const groupedTabs = groupByYear(sortedTabs());

  // 提取 YouTube Video ID
  const extractYouTubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  // 取得歌曲縮圖 - 順序：YouTube > thumbnail > 歌手相片
  const getSongThumbnail = (tab) => {
    // 1. 優先使用 YouTube 縮圖
    if (tab.youtubeUrl) {
      const videoId = extractYouTubeId(tab.youtubeUrl);
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      }
    }
    // 2. 其次使用歌曲自己的縮圖
    if (tab.thumbnail) return tab.thumbnail;
    // 3. 使用歌手圖片
    return artist?.photoURL || artist?.wikiPhotoURL || null;
  };

  if (loading || !artist) return <div className="min-h-screen bg-black" />;

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Hero */}
      <div className="relative h-[45vh] w-full">
        <img 
          src={artist.photoURL || artist.wikiPhotoURL || '/default-artist.jpg'} 
          alt={artist.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        
        {/* 返回按鈕 */}
        <button 
          onClick={() => router.back()}
          className="absolute top-6 left-4 p-2 bg-black/30 backdrop-blur-sm rounded-full text-white hover:bg-black/50"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h1 className="text-4xl font-bold text-white mb-2">{artist.name}</h1>
          <p className="text-[#B3B3B3] text-sm">
            {artist.songCount || hotTabs.length + allTabs.length} 首歌曲
          </p>
        </div>
      </div>

      {/* 熱門歌曲（前5首 - 有相片） */}
      <section className="px-4 mt-6">
        <h2 className="text-white text-xl font-bold mb-4">熱門</h2>
        <div className="space-y-2">
          {hotTabs.map((tab, index) => (
            <div 
              key={tab.id}
              onClick={() => router.push(`/tabs/${tab.id}`)}
              className="flex items-center p-2 hover:bg-[#1a1a1a] rounded-lg cursor-pointer group"
            >
              <span className="text-[#B3B3B3] w-6 text-center text-sm font-medium mr-2">
                {index + 1}
              </span>
              
              {/* 歌曲封面 */}
              <div className="w-14 h-14 rounded-[4px] overflow-hidden mr-3 bg-[#282828] flex-shrink-0">
                {getSongThumbnail(tab) ? (
                  <img src={getSongThumbnail(tab)} alt={tab.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#3E3E3E] text-xl">♪</div>
                )}
              </div>
              
              {/* 歌曲資訊 */}
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium truncate mb-1">{tab.title}</h3>
                <p className="text-[#B3B3B3] text-xs">{tab.viewCount?.toLocaleString() || 0} 瀏覽</p>
              </div>
              
              {/* 三點按鈕（無Key波波） */}
              <button 
                onClick={(e) => handleMoreClick(e, tab)}
                className="p-2 text-[#B3B3B3] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 所有歌曲（第6首起 - 無相片，有評分） */}
      <section className="px-4 mt-8">
        {/* 標題 + 排序 */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white text-xl font-bold">所有歌曲</h2>
          
          <div className="relative group">
            <button className="flex items-center space-x-1 text-[#B3B3B3] text-sm hover:text-white bg-[#1a1a1a] px-3 py-1.5 rounded-full">
              <span>{sortBy === 'year' ? '按年份' : sortBy === 'strokes' ? '按筆畫' : '按瀏覽'}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            
            <div className="absolute right-0 top-full mt-2 bg-[#282828] rounded-lg shadow-xl py-1 min-w-[120px] hidden group-hover:block z-20">
              {['year', 'strokes', 'views'].map((type) => (
                <button 
                  key={type}
                  onClick={() => setSortBy(type)}
                  className={`block w-full text-left px-4 py-2 text-sm ${sortBy === type ? 'text-[#FFD700]' : 'text-white hover:bg-[#3E3E3E]'}`}
                >
                  {type === 'year' ? '按年份' : type === 'strokes' ? '按筆畫' : '按瀏覽'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 年份分組 */}
        {Object.entries(groupedTabs).map(([yearRange, tabs]) => (
          <div key={yearRange} className="mb-6">
            <h3 className="text-[#FFD700] text-sm font-medium mb-3 sticky top-0 bg-black/95 py-2 z-10">{yearRange}</h3>
            <div className="space-y-1">
              {tabs.map((tab) => (
                <div 
                  key={tab.id}
                  onClick={() => router.push(`/tabs/${tab.id}`)}
                  className="flex items-center py-3 border-b border-[#282828] hover:bg-[#1a1a1a] cursor-pointer group px-2 -mx-2 rounded-lg transition-colors"
                >
                  {/* 歌曲名稱 */}
                  <div className="flex-1 min-w-0 pr-4">
                    <h4 className="text-white font-medium truncate">{tab.title}</h4>
                  </div>
                  
                  {/* 評分（中間） */}
                  <div className="flex items-center px-4 flex-shrink-0">
                    <RatingSystem 
                      tabId={tab.id} 
                      averageRating={tab.averageRating} 
                      ratingCount={tab.ratingCount}
                      size="sm"
                      showCount={false}
                    />
                    <span className="text-[#B3B3B3] text-xs ml-2">({tab.ratingCount || 0})</span>
                  </div>
                  
                  {/* 出譜者（靠右） */}
                  <div className="w-24 text-right flex-shrink-0">
                    <span className="text-[#B3B3B3] text-sm truncate block">
                      {tab.uploaderPenName || tab.arrangedBy || '匿名'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Action Modal（分享/收藏） */}
      {showActionModal && selectedTab && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowActionModal(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-[#121212] rounded-t-2xl z-50 p-4 pb-8 animate-slide-up">
            <div className="w-12 h-1 bg-[#3E3E3E] rounded-full mx-auto mb-4" />
            
            <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-[#282828]">
              <div className="w-12 h-12 rounded-[4px] overflow-hidden bg-[#282828]">
                {selectedTab && getSongThumbnail(selectedTab) ? (
                  <img src={getSongThumbnail(selectedTab)} alt={selectedTab.title} className="w-full h-full object-cover" />
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
              <button onClick={handleShare} className="w-full flex items-center space-x-4 p-3 hover:bg-[#1a1a1a] rounded-lg">
                <Share2 className="w-5 h-5 text-[#B3B3B3]" />
                <span className="text-white">分享</span>
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
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowAddToPlaylist(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-[#121212] rounded-t-2xl z-50 p-4 pb-8 max-h-[70vh] overflow-y-auto">
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
              
              {userPlaylists.length === 0 && (
                <p className="text-[#B3B3B3] text-center py-4">還沒有歌單，先去創建一個吧</p>
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
  );
}

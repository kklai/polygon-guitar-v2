import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { getTab, deleteTab, incrementViewCount } from '@/lib/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Layout from '@/components/Layout'
import LikeButton from '@/components/LikeButton'
import TabContent from '@/components/TabContent'
import TabComments from '@/components/TabComments'
import RatingSystem from '@/components/RatingSystem'
import GpSegmentPlayer from '@/components/GpSegmentPlayer'
import { recordSongView } from '@/lib/recentViews'
import { MoreVertical, Share2, Heart, BookmarkPlus, Music } from 'lucide-react'
import { toggleLikeSong, getUserPlaylists, addSongToPlaylist, createPlaylist } from '@/lib/playlistApi'
import Head from 'next/head'
import { generateTabTitle, generateTabDescription, generateTabSchema, generateBreadcrumbSchema } from '@/lib/seo'
import { siteConfig } from '@/lib/seo'

// 主題顏色配置
const themeColors = {
  night: {
    bg: '#121212',
    text: '#FFFFFF',
    lyricNormal: '#A0A0A0',
    lyricInside: '#FFFFFF',
    chord: '#FFD700',
    sectionMarker: '#FFFFFF',
    numericNotation: '#A0A0A0',
    prefixSuffix: '#808080'
  },
  day: {
    bg: '#FFFFFF',
    text: '#000000',
    lyricNormal: '#333333',
    lyricInside: '#000000',
    chord: '#8B5CF6',
    sectionMarker: '#000000',
    numericNotation: '#555555',
    prefixSuffix: '#666666'
  }
};

// Barre 和弦定義
const BARRE_CHORDS = ['B', 'Bm', 'Bb', 'Bbm', 'B7', 'Bm7', 'Bb7', 'C#', 'C#m', 'C#7', 'C#m7', 'Db', 'Dbm', 'F', 'Fm', 'F7', 'Fm7', 'F#', 'F#m', 'F#7', 'F#m7', 'Gb', 'Gbm', 'G#', 'G#m', 'G#7', 'G#m7', 'Ab', 'Abm'];

export default function TabDetail() {
  const router = useRouter()
  const { id, key: queryKey } = router.query
  const { user, isAuthenticated, isAdmin } = useAuth()
  const [tab, setTab] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [uploaderName, setUploaderName] = useState('')
  const [uploaderId, setUploaderId] = useState('')
  const [currentKey, setCurrentKey] = useState(null)
  // showInfo 提升去父組件，確保轉調嗰陣 YouTube 唔會閂
  const [showInfo, setShowInfo] = useState(() => {
    // 預設展開如果有 YouTube
    return !!tab?.youtubeVideoId
  })
  const [chordStats, setChordStats] = useState(null)
  const [theme, setTheme] = useState('night'); // 'night' | 'day'
  const [ratingData, setRatingData] = useState({ averageRating: 0, ratingCount: 0 })
  const [playingSegmentId, setPlayingSegmentId] = useState(null)
  const colors = themeColors[theme];
  
  // 更多操作選單
  const [showActionMenu, setShowActionMenu] = useState(false)
  const [userPlaylists, setUserPlaylists] = useState([])
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false)
  const [showCreatePlaylistInput, setShowCreatePlaylistInput] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')

  useEffect(() => {
    if (id) {
      loadTab()
    }
  }, [id])

  // 計算和弦統計
  useEffect(() => {
    if (tab?.content) {
      const stats = analyzeChords(tab.content, tab.originalKey || 'C')
      setChordStats(stats)
    }
  }, [tab])

  const analyzeChords = (content, originalKey) => {
    const chordPattern = /\b[A-G][#b]?(m|maj|min|dim|aug|sus|add|m7|maj7|7|9|11|13)?[0-9]*(\/[A-G][#b]?)?\b/g
    const matches = content.match(chordPattern) || []
    const validChordPattern = /^[A-G][#b]?(m|maj|min|dim|aug|sus|add|m7|maj7|7|9|11|13)*$/
    const chords = matches.filter(c => validChordPattern.test(c))
    const uniqueChords = [...new Set(chords)]
    
    // 計算原調 Barre 和弦
    const barreCount = uniqueChords.filter(c => BARRE_CHORDS.includes(c)).length
    
    return {
      total: uniqueChords.length,
      barreCount: barreCount,
      chords: uniqueChords
    }
  }

  const extractYouTubeId = (url) => {
    if (!url) return null
    const match = url.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)
    return match ? match[1] : null
  }

  const loadTab = async () => {
    try {
      const data = await getTab(id)
      if (data) {
        // 如果冇 youtubeVideoId 但有 youtubeUrl，提取 videoId
        if (!data.youtubeVideoId && data.youtubeUrl) {
          data.youtubeVideoId = extractYouTubeId(data.youtubeUrl)
        }
        setTab(data)
        // 初始化 currentKey：URL參數 > PlayKey > OriginalKey
        const initialKey = queryKey || data.playKey || data.originalKey || 'C'
        setCurrentKey(initialKey)
        // 記錄瀏覽數（每次頁面載入都計，包括刷新）
        if (id) incrementViewCount(id)
        // 記錄到最近瀏覽
        if (user) {
          recordSongView(user.uid, data)
        }
        if (data.createdBy) {
          const userDoc = await getDoc(doc(db, 'users', data.createdBy))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            setUploaderName(userData.displayName || userData.name || '未知用戶')
            setUploaderId(tabData.createdBy || '')
          }
        }
        
        // 載入評分數據
        setRatingData({
          averageRating: data.averageRating || 0,
          ratingCount: data.ratingCount || 0
        })
      } else {
        router.push('/')
      }
    } catch (error) {
      console.error('Error loading tab:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('確定要刪除這個譜嗎？')) return
    setIsDeleting(true)
    try {
      await deleteTab(id, user.uid, isAdmin)
      router.push('/')
    } catch (error) {
      alert('刪除失敗：' + error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  // 處理更多選單
  const handleMoreClick = async () => {
    if (user) {
      const playlists = await getUserPlaylists(user.uid);
      setUserPlaylists(playlists);
    }
    setShowActionMenu(true);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/tabs/${tab.id}`;
    if (navigator.share) {
      await navigator.share({
        title: `${tab.title} - ${tab.artist}`,
        url
      });
    } else {
      navigator.clipboard.writeText(url);
      alert('連結已複製到剪貼簿');
    }
    setShowActionMenu(false);
  };

  const handleAddToLiked = async () => {
    if (!user) {
      alert('請先登入');
      return;
    }
    try {
      const result = await toggleLikeSong(user.uid, tab.id);
      alert(result.isLiked ? '已加到最喜愛 ❤️' : '已取消最喜愛');
      setShowActionMenu(false);
    } catch (error) {
      alert('操作失敗：' + error.message);
    }
  };

  const handleAddToPlaylistClick = () => {
    setShowActionMenu(false);
    setShowAddToPlaylist(true);
  };

  const addToPlaylist = async (playlistId) => {
    try {
      await addSongToPlaylist(playlistId, tab.id);
      setShowAddToPlaylist(false);
      alert('已加入歌單');
    } catch (error) {
      alert('加入失敗：' + error.message);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim() || !user) return;
    try {
      const result = await createPlaylist(user.uid, newPlaylistName.trim());
      // 創建後直接加入歌曲
      await addSongToPlaylist(result.playlistId, tab.id);
      setShowCreatePlaylistInput(false);
      setShowAddToPlaylist(false);
      setNewPlaylistName('');
      alert(`已創建歌單「${newPlaylistName.trim()}」並加入歌曲`);
    } catch (error) {
      alert('創建歌單失敗：' + error.message);
    }
  };

  const isOwner = tab && user && tab.createdBy === user.uid
  const canEdit = isOwner || isAdmin

  if (isLoading) {
    return (
      <Layout>
        <div className="w-full">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-800 rounded w-1/2"></div>
            <div className="h-6 bg-gray-800 rounded w-1/4"></div>
            <div className="h-96 bg-gray-800 rounded"></div>
          </div>
        </div>
      </Layout>
    )
  }

  if (!tab) return null

  const hasSongInfo = tab.songYear || tab.composer || tab.lyricist || tab.arranger || tab.producer || tab.album || tab.uploaderPenName || tab.arrangedBy

  // SEO 配置
  const seoTitle = generateTabTitle(tab.title, tab.artist)
  const seoDescription = generateTabDescription(tab.title, tab.artist, tab.originalKey || 'C')
  const seoUrl = `${siteConfig.url}/tabs/${tab.id}`
  
  // 結構化數據
  const tabSchema = generateTabSchema(tab, { name: tab.artist, photoURL: tab.thumbnail })
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: '首頁', url: siteConfig.url },
    { name: tab.artist, url: `${siteConfig.url}/artists/${tab.artistId || tab.artist?.toLowerCase().replace(/\s+/g, '-')}` },
    { name: tab.title, url: seoUrl }
  ])

  return (
    <>
      <Head>
        {/* 基本 Meta */}
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={seoUrl} />
        
        {/* Open Graph */}
        <meta property="og:url" content={seoUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:image" content={tab.coverImage || tab.albumImage || tab.thumbnail || `${siteConfig.url}/og-image.jpg`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={`${tab.title} - ${tab.artist} 結他譜`} />
        <meta property="article:published_time" content={tab.createdAt} />
        <meta property="article:modified_time" content={tab.updatedAt} />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content={tab.coverImage || tab.albumImage || tab.thumbnail || `${siteConfig.url}/og-image.jpg`} />
        
        {/* 結構化數據 JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([tabSchema, breadcrumbSchema])
          }}
        />
      </Head>
      
      <Layout>
        <div className="w-full">
        {/* Header - 全寬 */}
        <div className="bg-[#121212] px-4 sm:px-5 md:px-8 pt-4 sm:pt-5 md:pt-6 pb-0">
          {/* 頂部：封面 + 歌名 + 歌手 + 操作 */}
          <div className="flex items-center gap-4 md:gap-6">
            {/* 封面圖片 */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
              {/* 優先顯示用戶自訂封面，其次 Spotify 專輯相，再其次 thumbnail/YouTube */}
              {tab.coverImage || tab.albumImage || tab.thumbnail || tab.youtubeVideoId ? (
                <img 
                  src={tab.coverImage || tab.albumImage || tab.thumbnail || `https://img.youtube.com/vi/${tab.youtubeVideoId}/mqdefault.jpg`} 
                  alt={tab.title}
                  className="w-full h-full object-cover"
                  loading="eager"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
              )}
            </div>
            
            {/* 歌名 + 歌手 + 操作 */}
            <div className="flex-1 min-w-0">
              {/* 歌名 - 參考圖：短歌名更大 */}
              <h1 className={`font-bold text-white leading-tight truncate ${
                tab.title.length > 20 ? 'text-lg sm:text-xl' : 
                tab.title.length > 12 ? 'text-xl sm:text-2xl' : 
                tab.title.length > 6 ? 'text-2xl sm:text-3xl' :
                'text-3xl sm:text-4xl'
              }`}>
                {tab.title}
              </h1>
              
              {/* 歌手行 + 操作掣 */}
              <div className="flex items-center justify-between mt-1 md:mt-2">
                {/* 歌手 + 合唱標籤 */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Link 
                    href={`/artists/${tab.artistId || tab.artist?.toLowerCase().replace(/\s+/g, '-')}`}
                    className="text-gray-400 text-sm sm:text-base md:text-lg hover:text-white transition truncate"
                  >
                    {tab.artist}
                  </Link>
                  {/* 合唱/feat 標籤 */}
                  {tab.isCollaboration && (
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                      tab.collaborationType === 'feat' 
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}>
                      {tab.collaborationType === 'feat' ? 'Feat.' : '合唱'}
                    </span>
                  )}
                </div>
                
                {/* 右邊操作掣 - 歌手嗰一行 */}
                <div className="flex items-center gap-1 md:gap-2 ml-2">
                  {/* 主題切換 */}
                  <button
                    onClick={() => setTheme(theme === 'night' ? 'day' : 'night')}
                    className="p-1.5 md:p-2 text-gray-400 hover:text-white transition"
                    title={theme === 'night' ? '切換日間模式' : '切換夜間模式'}
                  >
                    {theme === 'night' ? (
                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                    )}
                  </button>
                  
                  {/* Admin 編輯 */}
                  {(isOwner || isAdmin) && (
                    <Link
                      href={`/tabs/${tab.id}/edit`}
                      className="p-1.5 md:p-2 text-gray-400 hover:text-white transition"
                      title="編輯"
                    >
                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </Link>
                  )}
                  
                  {/* 心心 */}
                  <LikeButton tab={tab} onLikeToggle={loadTab} compact />
                  
                  {/* 更多選項 */}
                  <button
                    onClick={handleMoreClick}
                    className="p-1.5 md:p-2 text-gray-400 hover:text-white transition"
                    title="更多"
                  >
                    <MoreVertical className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </div>
              </div>
              
              {/* 評分系統 */}
              {tab && (
                <div className="mt-2">
                  <RatingSystem 
                    tabId={tab.id} 
                    averageRating={ratingData.averageRating}
                    ratingCount={ratingData.ratingCount}
                    size="md"
                    onRatingUpdate={(avg, count) => setRatingData({ averageRating: avg, ratingCount: count })}
                  />
                </div>
              )}
            </div>
          </div>

        </div>

        {/* 主要內容：譜 - 全寬無邊距 */}
        <TabContent 
          content={tab.content} 
          originalKey={tab.originalKey || 'C'}
          playKey={tab.playKey}
          initialKey={queryKey || tab.playKey || tab.originalKey}
          onKeyChange={setCurrentKey}
          fullWidth
          theme={theme}
          setTheme={setTheme}
          youtubeVideoId={tab.youtubeVideoId}
          arrangedBy={tab.uploaderPenName || tab.arrangedBy || '結他友'}
          uploaderId={uploaderId}
          displayFont={tab.displayFont || 'mono'}
          songInfo={{
            songYear: tab.songYear,
            composer: tab.composer,
            lyricist: tab.lyricist,
            arranger: tab.arranger,
            producer: tab.producer,
            album: tab.album,
            strummingPattern: tab.strummingPattern,
            fingeringTips: tab.fingeringTips
          }}
          gpSegments={tab.gpSegments || []}
          gpTheme={tab.gpTheme || 'dark'}
          // 傳 showInfo 去 TabContent
          showInfo={showInfo}
          setShowInfo={setShowInfo}
        />

        {/* 留言區 */}
        <div className="max-w-4xl mx-auto px-4 mt-8">
          <TabComments tabId={id} />
        </div>

        {/* 更多操作 Modal */}
        {showActionMenu && (
          <>
            <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowActionMenu(false)} />
            <div className="fixed bottom-0 left-0 right-0 bg-[#121212] rounded-t-2xl z-[60] p-4 pb-24 animate-slide-up">
              <div className="w-12 h-1 bg-[#3E3E3E] rounded-full mx-auto mb-4" />
              
              <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-[#282828]">
                <div className="w-12 h-12 rounded-[4px] overflow-hidden bg-[#282828]">
                  {tab.thumbnail || tab.albumImage ? (
                    <img src={tab.thumbnail || tab.albumImage} alt={tab.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#3E3E3E]">♪</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium truncate">{tab.title}</h4>
                  <p className="text-[#B3B3B3] text-sm">{tab.artist}</p>
                </div>
              </div>
              
              <div className="space-y-1">
                <button onClick={handleShare} className="w-full flex items-center space-x-4 p-3 hover:bg-[#1a1a1a] rounded-lg">
                  <Share2 className="w-5 h-5 text-[#B3B3B3]" />
                  <span className="text-white">分享</span>
                </button>
                
                <button onClick={handleAddToLiked} className="w-full flex items-center space-x-4 p-3 hover:bg-[#1a1a1a] rounded-lg">
                  <Heart className="w-5 h-5 text-red-500" />
                  <span className="text-white">加到我最喜愛</span>
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
      </div>
    </Layout>
    </>
  )
}

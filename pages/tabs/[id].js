import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from '@/components/Link'
import { getTab, getTabCached, setTabCache, clearTabCache, deleteTab, incrementViewCount } from '@/lib/tabs'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import LikeButton from '@/components/LikeButton'
import TabContent from '@/components/TabContent'
import TabComments from '@/components/TabComments'
import RatingSystem from '@/components/RatingSystem'
import GpSegmentPlayer from '@/components/GpSegmentPlayer'
import { recordSongView } from '@/lib/recentViews'
import { recordPageView } from '@/lib/analytics'
import { recordTabView } from '@/lib/libraryRecentViews'
import { MoreVertical, Share, Heart, Music, Plus, Copy } from 'lucide-react'

const InstagramIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" />
  </svg>
)
import { toggleLikeSong, checkIsLiked, getUserPlaylists, addSongToPlaylist, createPlaylist, removeSongFromPlaylist } from '@/lib/playlistApi'
import Head from 'next/head'
import { generateTabTitle, generateTabDescription, generateTabSchema, generateBreadcrumbSchema, getAbsoluteOgImage } from '@/lib/seo'
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

function serializeTab(tab) {
  if (!tab) return null
  return JSON.parse(JSON.stringify(tab, (_, v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v)))
}

export default function TabDetail({ initialTab }) {
  const router = useRouter()
  const { id, key: queryKey, updated: queryUpdated } = router.query
  // router.query 可能未就緒（localhost/ client nav），用 asPath + sessionStorage 確保捉到「剛保存」
  const fromSaveRedirect = queryUpdated != null ||
    (typeof window !== 'undefined' && id && (router.asPath.includes('updated=1') || sessionStorage.getItem('pg_tab_just_updated') === id))
  const { user, isAuthenticated, isAdmin } = useAuth()
  const [tab, setTab] = useState(initialTab || null)
  const [isLoading, setIsLoading] = useState(!initialTab)
  const [isDeleting, setIsDeleting] = useState(false)
  const [uploaderId, setUploaderId] = useState('')
  const [currentKey, setCurrentKey] = useState(null)
  const [showInfo, setShowInfo] = useState(false)
  const [chordStats, setChordStats] = useState(null)
  const [theme, setTheme] = useState('night');
  const [ratingData, setRatingData] = useState({ averageRating: 0, ratingCount: 0 })
  const [playingSegmentId, setPlayingSegmentId] = useState(null)
  const colors = themeColors[theme];
  
  const [showActionMenu, setShowActionMenu] = useState(false)
  const [menuTabLiked, setMenuTabLiked] = useState(false) // menu 內喜愛狀態，開 menu 時更新
  const [userPlaylists, setUserPlaylists] = useState([])
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false)
  const [addToPlaylistSelectedIds, setAddToPlaylistSelectedIds] = useState([])
  const [addToPlaylistInitialIds, setAddToPlaylistInitialIds] = useState([])
  const [showCreatePlaylistInput, setShowCreatePlaylistInput] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [toastMessage, setToastMessage] = useState(null)

  const [prevId, setPrevId] = useState(null)
  const justRefetchedIdRef = useRef(null)
  // Fallback: when tab has no artistPhoto, get from search-data API (cache, no extra Firestore reads). Remove after backfill.
  const [fallbackArtistPhoto, setFallbackArtistPhoto] = useState(null)

  // Render-phase cache check — runs before paint so no skeleton flash on cache hit
  // 若有 ?updated=1 唔用 initialTab/cache，強制之後 useEffect 從 Firestore 重載
  if (id && id !== prevId) {
    setPrevId(id)
    const fromUpdated = fromSaveRedirect
    const cached = getTabCached(id)
    const fromInitial = !fromUpdated && initialTab && initialTab.id === id
    if (fromUpdated) {
      setTab(null)
      setIsLoading(true)
    } else if (fromInitial) {
      setTab(initialTab)
      setCurrentKey(queryKey || initialTab.playKey || initialTab.originalKey || 'C')
      setRatingData({ averageRating: initialTab.averageRating || 0, ratingCount: initialTab.ratingCount || 0 })
      setShowInfo(false)
      setIsLoading(false)
    } else if (cached) {
      setTab(cached)
      setCurrentKey(queryKey || cached.playKey || cached.originalKey || 'C')
      setRatingData({ averageRating: cached.averageRating || 0, ratingCount: cached.ratingCount || 0 })
      setShowInfo(false)
      setIsLoading(false)
    } else {
      setTab(null)
      setIsLoading(true)
    }
  }

  useEffect(() => {
    if (!id) return
    // 剛從編輯頁保存過來：強制重載，唔用 initialTab / cache，然後清走 URL 的 ?updated=1
    const fromSave = queryUpdated != null ||
      (typeof window !== 'undefined' && id && (router.asPath.includes('updated=1') || sessionStorage.getItem('pg_tab_just_updated') === id))
    if (fromSave) {
      justRefetchedIdRef.current = id
      try { sessionStorage.removeItem('pg_tab_just_updated') } catch (e) {}
      clearTabCache(id)
      loadTab().then(() => {
        router.replace(`/tabs/${id}${queryKey ? `?key=${queryKey}` : ''}`, undefined, { shallow: true })
      })
      return
    }
    if (initialTab && initialTab.id === id) {
      if (justRefetchedIdRef.current === id) {
        justRefetchedIdRef.current = null
        return
      }
      setTabCache(id, initialTab)
      setTab(initialTab)
      setCurrentKey(queryKey || initialTab.playKey || initialTab.originalKey || 'C')
      setRatingData({ averageRating: initialTab.averageRating || 0, ratingCount: initialTab.ratingCount || 0 })
      setShowInfo(false)
      setIsLoading(false)
      fireSideEffects(initialTab)
      return
    }
    const cached = getTabCached(id)
    if (cached) {
      fireSideEffects(cached)
    } else {
      loadTab()
    }
  }, [id, initialTab, queryUpdated, router.asPath])

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

  const fireSideEffects = (data) => {
    setFallbackArtistPhoto(null)
    const effects = []
    effects.push(incrementViewCount(id))
    recordTabView(id) // 收藏頁「最近瀏覽」結他譜（localStorage，最多 20 份）
    if (user) effects.push(recordSongView(user.uid, data))
    effects.push(
      recordPageView('tab', id, data.title, {
        pageName: data.title,
        artistName: data.artist,
        originalKey: data.originalKey,
        thumbnail: data.thumbnail || data.albumImage || data.artistPhoto
      }, user?.uid || null)
    )
    if (data.createdBy) setUploaderId(data.createdBy)
    // Cover fallback: search-data API (1 cache read). Remove after backfill has run.
    const needsArtistPhoto = !data.artistPhoto && !data.coverImage && !data.albumImage && !data.thumbnail && (data.artistId || data.artist)
    if (needsArtistPhoto) {
      fetch('/api/search-data?only=artists')
        .then(r => r.ok ? r.json() : null)
        .then(payload => {
          const artists = payload?.artists || []
          const artistId = data.artistId || (data.artist || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9.\-\u4e00-\u9fa5]/g, '')
          const artist = artists.find(a => a.id === artistId) || artists.find(a => (a.name || '').toLowerCase() === (data.artist || '').toLowerCase())
          if (artist?.photo) setFallbackArtistPhoto(artist.photo)
        })
        .catch(() => {})
    }
    Promise.all(effects).catch(err => console.error('Side-effect error:', err))
  }

  const loadTab = async () => {
    try {
      const data = await getTab(id)
      if (data) {
        if (!data.youtubeVideoId && data.youtubeUrl) {
          data.youtubeVideoId = extractYouTubeId(data.youtubeUrl)
        }

        // Cover: use only denormalized tab.artistPhoto (no artists read). New/edit saves artistPhoto.
        setTabCache(id, data)

        setTab(data)
        setCurrentKey(queryKey || data.playKey || data.originalKey || 'C')
        setShowInfo(false)
        setRatingData({
          averageRating: data.averageRating || 0,
          ratingCount: data.ratingCount || 0
        })
        fireSideEffects(data)
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
    if (user && tab) {
      const [liked, playlists] = await Promise.all([
        checkIsLiked(user.uid, tab.id),
        getUserPlaylists(user.uid)
      ]);
      setMenuTabLiked(liked);
      setUserPlaylists(playlists);
    } else {
      setMenuTabLiked(false);
    }
    setShowActionMenu(true);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const copyToClipboard = (text) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.select();
      try {
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (ok) resolve();
        else reject(new Error('execCommand copy failed'));
      } catch (e) {
        document.body.removeChild(textarea);
        reject(e);
      }
    });
  };

  const handleCopyShareLink = async () => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/tabs/${tab.id}`;
    try {
      await copyToClipboard(url);
      showToast('已複製連結');
    } catch (err) {
      showToast('複製失敗');
    }
  };

  const handleSelectLyricsShare = () => {
    if (!tab?.id) return;
    setShowActionMenu(false);
    router.push(`/tools/tab-share?tabId=${tab.id}`);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/tabs/${tab.id}`;
    const shareArtistName = tab.collaborators?.length > 1
      ? (tab.collaborationType === 'feat' ? tab.collaborators.join(' feat. ') : tab.collaborators.join(' / '))
      : (tab.artist || '');
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${tab.title} - ${shareArtistName}`,
          url
        });
      } catch (err) {
        if (err.name !== 'AbortError') showToast('分享失敗');
      }
    } else {
      try {
        await copyToClipboard(url);
        showToast('連結已複製到剪貼簿');
      } catch {
        showToast('複製失敗');
      }
    }
    setShowActionMenu(false);
  };

  const handleAddToLiked = async () => {
    if (!user) {
      alert('請先登入後即可收藏喜愛的結他譜');
      return;
    }
    try {
      const result = await toggleLikeSong(user.uid, tab.id);
      setMenuTabLiked(result.isLiked);
    } catch (error) {
      alert('操作失敗：' + error.message);
    }
  };

  const handleAddToPlaylistClick = () => {
    setShowActionMenu(false);
    // 預設剔選已包含此歌嘅歌單
    const alreadyIn = (userPlaylists || [])
      .filter((pl) => pl.songIds && pl.songIds.includes(tab?.id))
      .map((pl) => pl.id);
    setAddToPlaylistSelectedIds(alreadyIn);
    setAddToPlaylistInitialIds(alreadyIn);
    setShowAddToPlaylist(true);
  };

  const toggleAddToPlaylistSelection = (playlistId) => {
    setAddToPlaylistSelectedIds((prev) =>
      prev.includes(playlistId) ? prev.filter((pid) => pid !== playlistId) : [...prev, playlistId]
    )
  }

  const confirmAddToPlaylist = async () => {
    if (!tab) return
    const idsToAdd = addToPlaylistSelectedIds.filter((id) => !addToPlaylistInitialIds.includes(id))
    const idsToRemove = addToPlaylistInitialIds.filter((id) => !addToPlaylistSelectedIds.includes(id))
    if (idsToAdd.length === 0 && idsToRemove.length === 0) {
      setShowAddToPlaylist(false)
      setAddToPlaylistSelectedIds([])
      setAddToPlaylistInitialIds([])
      return
    }
    try {
      for (const playlistId of idsToAdd) {
        await addSongToPlaylist(playlistId, tab.id)
      }
      for (const playlistId of idsToRemove) {
        await removeSongFromPlaylist(playlistId, tab.id)
      }
      setShowAddToPlaylist(false)
      setAddToPlaylistSelectedIds([])
      setAddToPlaylistInitialIds([])
      if (idsToAdd.length && idsToRemove.length) {
        alert(`已加入 ${idsToAdd.length} 個歌單，已從 ${idsToRemove.length} 個歌單移除`)
      } else if (idsToRemove.length) {
        alert(idsToRemove.length > 1 ? `已從 ${idsToRemove.length} 個歌單移除` : '已從歌單移除')
      } else {
        alert(idsToAdd.length > 1 ? `已加入 ${idsToAdd.length} 個歌單` : '已加入歌單')
      }
    } catch (error) {
      alert('操作失敗：' + error.message)
    }
  }

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

  const effectiveArtistPhoto = tab.artistPhoto || fallbackArtistPhoto

  // Show all collaborators when present; otherwise use tab.artist
  const artistDisplayName = tab.collaborators?.length > 1
    ? (tab.collaborationType === 'feat' ? tab.collaborators.join(' feat. ') : tab.collaborators.join(' / '))
    : (tab.artist || '')

  const hasSongInfo = tab.songYear || tab.composer || tab.lyricist || tab.arranger || tab.producer || tab.album || tab.uploaderPenName || tab.arrangedBy

  // SEO 配置
  const seoTitle = generateTabTitle(tab.title, artistDisplayName)
  const seoDescription = generateTabDescription(tab.title, artistDisplayName, tab.originalKey || 'C')
  const seoUrl = `${siteConfig.url}/tabs/${tab.id}`
  
  // 結構化數據
  const tabSchema = generateTabSchema(tab, { name: artistDisplayName, photoURL: tab.thumbnail || effectiveArtistPhoto })
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: '首頁', url: siteConfig.url },
    { name: artistDisplayName, url: `${siteConfig.url}/artists/${tab.artistId || tab.artist?.toLowerCase().replace(/\s+/g, '-')}` },
    { name: tab.title, url: seoUrl }
  ])

  return (
    <>
      <Head>
        {/* 基本 Meta */}
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={seoUrl} />
        
        {/* Open Graph — unique per tab for social share preview */}
        <meta property="og:url" content={seoUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content={siteConfig.name} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:image" content={getAbsoluteOgImage(tab.coverImage || tab.albumImage || tab.thumbnail || effectiveArtistPhoto)} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={`${tab.title} - ${artistDisplayName} 結他譜`} />
        <meta property="article:published_time" content={tab.createdAt} />
        <meta property="article:modified_time" content={tab.updatedAt} />
        
        {/* Twitter Card — unique per tab */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content={siteConfig.twitter} />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content={getAbsoluteOgImage(tab.coverImage || tab.albumImage || tab.thumbnail || effectiveArtistPhoto)} />
        <meta name="twitter:image:alt" content={`${tab.title} - ${artistDisplayName} 結他譜`} />
        
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
        <div className="pt-4 sm:pt-5 md:pt-6 pb-0">
          {/* 頂部：封面 + 歌名 + 歌手 + 操作 */}
          <div className="flex items-center gap-4 md:gap-6">
            {/* 封面圖片 */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
              {/* 統一封面優先順序：coverImage > albumImage > youtubeVideoId > thumbnail > artistPhoto (incl. search-data fallback) */}
              {(() => {
                const videoId = tab.youtubeVideoId || tab.youtubeUrl?.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1]
                return tab.coverImage || tab.albumImage || videoId || tab.thumbnail || effectiveArtistPhoto
              })() ? (
                <img 
                  src={(() => {
                    if (tab.coverImage) return tab.coverImage
                    if (tab.albumImage) return tab.albumImage
                    const videoId = tab.youtubeVideoId || tab.youtubeUrl?.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1]
                    if (videoId) return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
                    if (tab.thumbnail) return tab.thumbnail
                    return effectiveArtistPhoto
                  })()}
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
                    {artistDisplayName}
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

                  {/* 生成分享圖片 */}
                  <button
                    onClick={() => router.push(`/tools/tab-share?tabId=${tab.id}`)}
                    className="p-1.5 md:p-2 text-gray-400 hover:text-white transition"
                    title="生成分享圖片"
                  >
                    <Share className="w-4 h-4 md:w-5 md:h-5" />
                  </button>

                  {/* 更多選項 */}
                  <button
                    onClick={handleMoreClick}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-gray-400 hover:text-white transition"
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
        <div className="mt-8">
          <TabComments tabId={id} />
        </div>

        {/* 更多操作 Modal */}
        {showActionMenu && (
          <>
            <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowActionMenu(false)} />
            <div className="fixed bottom-0 left-0 right-0 bg-[#121212] rounded-t-2xl z-[60] pb-24 animate-slide-up">
              <div className="w-12 h-1 bg-[#3E3E3E] rounded-full mx-auto mb-4" />
              <div className="px-4 text-left">
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
                  <p className="text-[#B3B3B3] text-sm">{artistDisplayName}</p>
                </div>
              </div>
              
              <div className="space-y-1">
                <button onClick={handleCopyShareLink} className="w-full flex items-center space-x-4 p-3 hover:bg-[#1a1a1a] rounded-lg">
                  <Copy className="w-5 h-5 text-[#B3B3B3]" />
                  <span className="text-white">複製分享連結</span>
                </button>
                <button onClick={handleSelectLyricsShare} className="w-full flex items-center space-x-4 p-3 hover:bg-[#1a1a1a] rounded-lg">
                  <InstagramIcon className="w-5 h-5 text-[#B3B3B3] shrink-0" />
                  <span className="text-white">選取歌詞分享</span>
                </button>

                
                <button onClick={handleAddToLiked} className="w-full flex items-center space-x-4 p-3 hover:bg-[#1a1a1a] rounded-lg">
                  <Heart className={`w-5 h-5 text-[#FFD700] ${menuTabLiked ? 'fill-[#FFD700]' : 'fill-none'}`} strokeWidth={1.5} />
                  <span className="text-white">{menuTabLiked ? '取消喜愛' : '加到我最喜愛'}</span>
                </button>
                
                <button onClick={handleAddToPlaylistClick} className="w-full flex items-center space-x-4 p-3 hover:bg-[#1a1a1a] rounded-lg">
                  <svg className="w-5 h-5 text-[#B3B3B3] shrink-0" viewBox="0 0 8.7 8.7" fill="none" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" strokeMiterlimit={10} aria-hidden>
                    <circle cx="4.4" cy="4.4" r="4" />
                    <line x1="2.2" y1="4.4" x2="6.5" y2="4.4" />
                    <line x1="4.4" y1="2.2" x2="4.4" y2="6.5" />
                  </svg>
                  <span className="text-white">加入歌單</span>
                </button>
              </div>
              </div>
            </div>
          </>
        )}

        {/* 自動消失 Toast（複製連結等） */}
        {toastMessage && (
          <div
            className="fixed bottom-24 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-[100] px-4 py-3 rounded-xl bg-[#282828] text-white text-center shadow-lg animate-fade-in"
            role="status"
            aria-live="polite"
          >
            {toastMessage}
          </div>
        )}

        {/* 加入歌單 Modal */}
        {showAddToPlaylist && (
          <>
            <div className="fixed inset-0 bg-black/60 z-50" onClick={() => {
                setShowAddToPlaylist(false);
                setShowCreatePlaylistInput(false);
                setNewPlaylistName('');
                setAddToPlaylistSelectedIds([]);
                setAddToPlaylistInitialIds([]);
              }} />
            <div className="fixed bottom-0 left-0 right-0 bg-[#121212] rounded-t-2xl z-[60] pb-24 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-col items-center justify-center py-2 min-h-[36px]">
                <div className="w-10 h-1 rounded-full bg-[#525252] shrink-0" />
              </div>
              <div className="text-left" style={{ paddingLeft: '1rem', paddingRight: '1rem' }}>
              <h3 className="text-white text-lg font-bold mb-4">加入歌單</h3>
              
              <div className="space-y-2">
                {userPlaylists.map((pl) => {
                  const isSelected = addToPlaylistSelectedIds.includes(pl.id)
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
                  )
                })}

                {/* 分隔線（space-y-2 統一 0.5rem） */}
                <div className="h-px bg-[#3E3E3E] w-full shrink-0" />

                {/* 創建新歌單按鈕（黃線框 + 黃 Plus，無 hover） */}
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

                {/* 創建輸入框 */}
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
      </div>
    </Layout>
    </>
  )
}

export async function getStaticPaths() {
  return { paths: [], fallback: 'blocking' }
}

export async function getStaticProps({ params }) {
  const id = params?.id
  if (!id) return { notFound: true }
  try {
    const { getTab } = await import('@/lib/tabs')
    const data = await getTab(id)
    if (!data) return { notFound: true }
    if (!data.youtubeVideoId && data.youtubeUrl) {
      const m = data.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)
      if (m) data.youtubeVideoId = m[1]
    }
    // Cover fallback from search-data cache (1 read). Remove after backfill.
    if (!data.artistPhoto && !data.coverImage && !data.albumImage && !data.thumbnail && (data.artistId || data.artist)) {
      try {
        const { getSearchData } = await import('@/lib/searchData')
        const payload = await getSearchData()
        const artists = payload?.artists || []
        const artistId = data.artistId || (data.artist || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9.\-\u4e00-\u9fa5]/g, '')
        const artist = artists.find(a => a.id === artistId) || artists.find(a => (a.name || '').toLowerCase() === (data.artist || '').toLowerCase())
        if (artist?.photo) data.artistPhoto = artist.photo
      } catch (_) {}
    }
    return { props: { initialTab: serializeTab(data) }, revalidate: 300 }
  } catch (e) {
    console.error('[tabs/[id]] getStaticProps:', e?.message)
    return { notFound: true }
  }
}

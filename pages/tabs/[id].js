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
import { recordSongView } from '@/lib/recentViews'
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
  const [currentKey, setCurrentKey] = useState(null)
  const [showInfo, setShowInfo] = useState(false)
  const [chordStats, setChordStats] = useState(null)
  const [theme, setTheme] = useState('night'); // 'night' | 'day'
  const colors = themeColors[theme];

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
          }
        }
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
        <meta property="og:image" content={tab.thumbnail || `${siteConfig.url}/og-image.jpg`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={`${tab.title} - ${tab.artist} 結他譜`} />
        <meta property="article:published_time" content={tab.createdAt} />
        <meta property="article:modified_time" content={tab.updatedAt} />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content={tab.thumbnail || `${siteConfig.url}/og-image.jpg`} />
        
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
        <div className="bg-[#121212] p-4 sm:p-5">
          {/* 頂部：封面 + 歌名 + 歌手 + 操作 */}
          <div className="flex items-center gap-4">
            {/* 封面圖片 */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
              {tab.thumbnail || tab.youtubeVideoId ? (
                <img 
                  src={tab.thumbnail || `https://img.youtube.com/vi/${tab.youtubeVideoId}/mqdefault.jpg`} 
                  alt={tab.title}
                  className="w-full h-full object-cover"
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
              <div className="flex items-center justify-between mt-1">
                {/* 歌手 - 灰色文字 */}
                <Link 
                  href={`/artists/${tab.artistId || tab.artist?.toLowerCase().replace(/\s+/g, '-')}`}
                  className="text-gray-400 text-sm sm:text-base hover:text-white transition truncate"
                >
                  {tab.artist}
                </Link>
                
                {/* 右邊操作掣 - 歌手嗰一行 */}
                <div className="flex items-center gap-1 ml-2">
                  {/* 主題切換 */}
                  <button
                    onClick={() => setTheme(theme === 'night' ? 'day' : 'night')}
                    className="p-1.5 text-gray-400 hover:text-white transition"
                    title={theme === 'night' ? '切換日間模式' : '切換夜間模式'}
                  >
                    {theme === 'night' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                    )}
                  </button>
                  
                  {/* Admin 編輯 */}
                  {(isOwner || isAdmin) && (
                    <Link
                      href={`/tabs/${tab.id}/edit`}
                      className="p-1.5 text-gray-400 hover:text-white transition"
                      title="編輯"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </Link>
                  )}
                  
                  {/* 心心 */}
                  <LikeButton tab={tab} onLikeToggle={loadTab} compact />
                </div>
              </div>
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
          songInfo={{
            songYear: tab.songYear,
            composer: tab.composer,
            lyricist: tab.lyricist,
            arranger: tab.arranger,
            producer: tab.producer,
            strummingPattern: tab.strummingPattern,
            fingeringTips: tab.fingeringTips
          }}
        />

        {/* 留言區 */}
        <div className="max-w-4xl mx-auto px-4">
          <TabComments tabId={id} />
        </div>
      </div>
    </Layout>
    </>
  )
}

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

  const loadTab = async () => {
    try {
      const data = await getTab(id)
      if (data) {
        setTab(data)
        // 初始化 currentKey：URL參數 > PlayKey > OriginalKey
        const initialKey = queryKey || data.playKey || data.originalKey || 'C'
        setCurrentKey(initialKey)
        // 記錄瀏覽數（現在所有人都可更新 viewCount）
        // 使用 sessionStorage 防止同一 session 內重複計數
        if (id && typeof window !== 'undefined') {
          const viewedKey = `viewed_${id}`
          if (!sessionStorage.getItem(viewedKey)) {
            incrementViewCount(id)
            sessionStorage.setItem(viewedKey, '1')
          }
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
        {/* Header - 全寬 - v21 */}
        <div className="bg-[#121212] p-3 sm:p-4 border-b border-gray-800">
          {/* 頂部：標題 + 歌手 */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-bold text-white truncate">
                  {tab.title}
                </h1>
                {/* 主題切換按鈕 */}
                <button
                  onClick={() => setTheme(theme === 'night' ? 'day' : 'night')}
                  className={`flex items-center gap-1 px-2 py-1 rounded transition text-xs ${
                    theme === 'day'
                      ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                      : 'bg-gray-800 text-yellow-400 hover:bg-gray-700'
                  }`}
                  title={theme === 'night' ? '切換日間模式' : '切換夜間模式'}
                >
                  {theme === 'night' ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <span className="hidden sm:inline">日間</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                      <span className="hidden sm:inline">夜間</span>
                    </>
                  )}
                </button>
              </div>
              <Link 
                href={`/artists/${tab.artistId || tab.artist?.toLowerCase().replace(/\s+/g, '-')}`}
                className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs sm:text-sm font-medium bg-[#FFD700] text-black hover:opacity-90 transition"
              >
                {tab.artist}
              </Link>
            </div>
            
            {/* 收藏按鈕 */}
            <LikeButton tab={tab} onLikeToggle={loadTab} compact />
          </div>

          {/* 第二行：Key + 和弦統計 + 操作 */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
            <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
              {/* Key + Capo */}
              <span className="flex items-center gap-1 text-[#B3B3B3]">
                <span className="text-[#FFD700]">♪</span>
                <span>
                  {/* 顯示當前選中嘅 Key */}
                  {currentKey || tab.playKey || tab.originalKey || 'C'}
                  {/* 顯示原調（如果不同）*/}
                  {currentKey && currentKey !== tab.originalKey && (
                    <span className="text-gray-500 ml-1">(原調 {tab.originalKey})</span>
                  )}
                  {/* 顯示 Capo */}
                  {tab.capo > 0 && (
                    <span className="text-[#FFD700] ml-1">Capo {tab.capo}</span>
                  )}
                </span>
              </span>
              
              {/* 編譜者 - 顯示在 Header 更明顯 */}
              {(tab.uploaderPenName || tab.arrangedBy) && (
                <>
                  <span className="text-gray-600 hidden sm:inline">|</span>
                  <span className="text-[#FFD700] font-medium">
                    編譜：{tab.uploaderPenName || tab.arrangedBy}
                  </span>
                </>
              )}
              
              {/* 和弦統計 */}
              {chordStats && (
                <>
                  <span className="text-gray-600">|</span>
                  <span className="text-[#B3B3B3]" title={`${chordStats.total}個獨特和弦`}>
                    {chordStats.total}和弦
                  </span>
                  {chordStats.barreCount > 0 && (
                    <span className="text-orange-400" title={`原調有${chordStats.barreCount}個Barre和弦，可轉Key避開`}>
                      ({chordStats.barreCount}Barre)
                    </span>
                  )}
                </>
              )}
            </div>

            {/* 更多資訊按鈕 (手機版) */}
            <div className="flex items-center gap-1">
              {(hasSongInfo || tab.youtubeVideoId) && (
                <button
                  onClick={() => setShowInfo(!showInfo)}
                  className="sm:hidden px-2 py-1 text-xs bg-gray-800 text-white rounded-lg"
                >
                  {showInfo ? '收起' : '更多'}
                </button>
              )}
              {canEdit && (
                <Link
                  href={`/tabs/${tab.id}/edit`}
                  className="p-1.5 sm:px-3 sm:py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className="hidden sm:inline text-sm">編輯</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* 可折疊資訊區 (手機版) */}
        <div className={`${showInfo ? '' : 'hidden sm:block'}`}>
          {/* YouTube - 手機版縮小 */}
          {tab.youtubeVideoId && (
            <div className="bg-[#121212] border-b border-gray-800">
              <div className="aspect-video max-w-2xl mx-auto">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${tab.youtubeVideoId}`}
                  title={`${tab.artist} - ${tab.title}`}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            </div>
          )}

          {/* 歌曲資訊 - 簡化 */}
          {hasSongInfo && (
            <div className="bg-[#121212] p-3 sm:p-4 border-b border-gray-800">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-[#B3B3B3]">
                {tab.songYear && <span>年份：{tab.songYear}</span>}
                {tab.composer && <span>作曲：{tab.composer}</span>}
                {tab.lyricist && <span>填詞：{tab.lyricist}</span>}
                {tab.arranger && <span>編曲：{tab.arranger}</span>}
                {tab.producer && <span>監製：{tab.producer}</span>}
              </div>
            </div>
          )}

          {/* 演奏技巧 */}
          {(tab.strummingPattern || tab.fingeringTips) && (
            <div className="bg-[#121212] p-3 sm:p-4 border-b border-gray-800">
              {tab.strummingPattern && (
                <div className="mb-2">
                  <span className="text-xs text-[#FFD700]">掃弦：</span>
                  <span className="text-sm text-white font-mono">{tab.strummingPattern}</span>
                </div>
              )}
              {tab.fingeringTips && (
                <div>
                  <span className="text-xs text-[#FFD700]">指法：</span>
                  <span className="text-sm text-gray-300">{tab.fingeringTips}</span>
                </div>
              )}
            </div>
          )}
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

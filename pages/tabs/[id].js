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

// Barre 和弦定義
const BARRE_CHORDS = ['B', 'Bm', 'Bb', 'Bbm', 'B7', 'Bm7', 'Bb7', 'C#', 'C#m', 'C#7', 'C#m7', 'Db', 'Dbm', 'F', 'Fm', 'F7', 'Fm7', 'F#', 'F#m', 'F#7', 'F#m7', 'Gb', 'Gbm', 'G#', 'G#m', 'G#7', 'G#m7', 'Ab', 'Abm'];

export default function TabDetail() {
  const router = useRouter()
  const { id, key: queryKey } = router.query
  const { user, isAuthenticated } = useAuth()
  const [tab, setTab] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [uploaderName, setUploaderName] = useState('')
  const [currentKey, setCurrentKey] = useState(null)
  const [showInfo, setShowInfo] = useState(false)
  const [chordStats, setChordStats] = useState(null)

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
        if (id) incrementViewCount(id)
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
      await deleteTab(id, user.uid)
      router.push('/')
    } catch (error) {
      alert('刪除失敗：' + error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const isOwner = tab && user && tab.createdBy === user.uid

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

  const hasSongInfo = tab.songYear || tab.composer || tab.lyricist || tab.arranger || tab.producer || tab.album

  return (
    <Layout fullWidth>
      <div className="w-full pb-20 overflow-x-hidden">
        {/* Header - 全寬 */}
        <div className="bg-[#121212] p-3 sm:p-4 border-b border-gray-800">
          {/* 頂部：標題 + 歌手 */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-white truncate">
                {tab.title}
              </h1>
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
              {/* Key */}
              <span className="flex items-center gap-1 text-[#B3B3B3]">
                <span className="text-[#FFD700]">♪</span>
                {currentKey && currentKey !== tab.originalKey 
                  ? `${tab.originalKey || 'C'}→${currentKey}`
                  : tab.originalKey || 'C'}
              </span>
              
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
              {isOwner && (
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
          initialKey={queryKey}
          onKeyChange={setCurrentKey}
          fullWidth
        />
      </div>
    </Layout>
  )
}

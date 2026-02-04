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

export default function TabDetail() {
  const router = useRouter()
  const { id, key: queryKey } = router.query
  const { user, isAuthenticated } = useAuth()
  const [tab, setTab] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [uploaderName, setUploaderName] = useState('')
  const [currentKey, setCurrentKey] = useState(null)

  useEffect(() => {
    if (id) {
      loadTab()
    }
  }, [id])

  const loadTab = async () => {
    try {
      const data = await getTab(id)
      if (data) {
        setTab(data)
        // Increment view count after loading
        if (id) {
          incrementViewCount(id)
        }
        // Fetch uploader info
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
      console.error('Delete error:', error)
      alert('刪除失敗：' + error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const isOwner = tab && user && tab.createdBy === user.uid

  // 歌手類型顯示
  const getArtistTypeLabel = (type) => {
    switch (type) {
      case 'male': return '男歌手'
      case 'female': return '女歌手'
      case 'group': return '組合'
      default: return ''
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
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

  // 檢查是否有歌曲資訊
  const hasSongInfo = tab.songYear || tab.composer || tab.lyricist || tab.arranger || tab.producer || tab.album

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Link 
          href="/"
          className="inline-flex items-center text-[#B3B3B3] hover:text-white mb-6 transition"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回列表
        </Link>

        {/* Header */}
        <div className="bg-[#121212] rounded-xl shadow-md p-6 mb-6 border border-gray-800">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                {tab.title}
              </h1>
              
              {/* Metadata Row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#B3B3B3] mb-3">
                {/* View Count */}
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {(tab.viewCount || 0).toLocaleString()} 次瀏覽
                </span>
                
                <span className="text-gray-600">|</span>
                
                {/* Uploader */}
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  出譜：{uploaderName || '載入中...'}
                </span>
                
                <span className="text-gray-600">|</span>
                
                {/* Key Info */}
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                  </svg>
                  {currentKey && currentKey !== tab.originalKey 
                    ? `Key: ${tab.originalKey || 'C'} → ${currentKey}`
                    : `Key: ${tab.originalKey || 'C'}`}
                </span>
                
                <span className="text-gray-600">|</span>
                
                {/* Date */}
                <span>
                  {new Date(tab.createdAt).toLocaleDateString('zh-HK')}
                </span>
              </div>
              
              <div className="flex items-center flex-wrap gap-2">
                <Link 
                  href={`/artists/${tab.artistId || tab.artist?.toLowerCase().replace(/\s+/g, '-')}`}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#FFD700] text-black hover:opacity-90 transition"
                >
                  {tab.artist}
                </Link>
                {tab.artistType && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-700 text-gray-300">
                    {getArtistTypeLabel(tab.artistType)}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              <LikeButton tab={tab} onLikeToggle={loadTab} />
              
              {isOwner && (
                <div className="flex space-x-2">
                  <Link
                    href={`/tabs/${tab.id}/edit`}
                    className="flex items-center space-x-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>編輯</span>
                  </Link>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex items-center space-x-1 px-4 py-2 bg-red-900/50 text-red-400 rounded-lg hover:bg-red-900 transition disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>刪除</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* YouTube Video */}
        {tab.youtubeVideoId && (
          <div className="bg-[#121212] rounded-xl shadow-md p-6 mb-6 border border-gray-800">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
              </svg>
              歌曲影片
            </h2>
            <div className="aspect-video max-w-2xl mx-auto">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${tab.youtubeVideoId}`}
                title={`${tab.artist} - ${tab.title}`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="rounded-lg"
              ></iframe>
            </div>
          </div>
        )}

        {/* Song Info */}
        {hasSongInfo && (
          <div className="bg-[#121212] rounded-xl shadow-md p-6 mb-6 border border-gray-800">
            <h2 className="text-lg font-semibold text-white mb-4">歌曲資訊</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tab.songYear && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm w-16">年份：</span>
                  <span className="text-white">{tab.songYear}</span>
                </div>
              )}
              {tab.album && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm w-16">專輯：</span>
                  <span className="text-white">{tab.album}</span>
                </div>
              )}
              {tab.composer && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm w-16">作曲：</span>
                  <span className="text-white">{tab.composer}</span>
                </div>
              )}
              {tab.lyricist && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm w-16">填詞：</span>
                  <span className="text-white">{tab.lyricist}</span>
                </div>
              )}
              {tab.arranger && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm w-16">編曲：</span>
                  <span className="text-white">{tab.arranger}</span>
                </div>
              )}
              {tab.producer && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm w-16">監製：</span>
                  <span className="text-white">{tab.producer}</span>
                </div>
              )}
              {tab.bpm && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm w-16">BPM：</span>
                  <span className="text-white">{tab.bpm}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Playing Techniques */}
        {(tab.strummingPattern || tab.fingeringTips) && (
          <div className="bg-[#121212] rounded-xl shadow-md p-6 mb-6 border border-gray-800">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#FFD700]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
              演奏技巧
            </h2>
            <div className="space-y-4">
              {tab.strummingPattern && (
                <div>
                  <h3 className="text-sm font-medium text-[#FFD700] mb-2">掃弦節奏</h3>
                  <div className="bg-black p-4 rounded-lg font-mono text-lg text-white whitespace-pre-wrap">
                    {tab.strummingPattern}
                  </div>
                </div>
              )}
              {tab.fingeringTips && (
                <div>
                  <h3 className="text-sm font-medium text-[#FFD700] mb-2">指法提示</h3>
                  <div className="bg-black p-4 rounded-lg text-gray-300 whitespace-pre-wrap">
                    {tab.fingeringTips}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content */}
        <TabContent 
          content={tab.content} 
          originalKey={tab.originalKey || 'C'}
          initialKey={queryKey}
          onKeyChange={setCurrentKey}
        />

        {/* Info Footer */}
        <div className="mt-6 text-center text-sm text-[#B3B3B3]">
          <p>如果個譜顯示唔啱，請確保你用等寬字型 (monospace font)</p>
        </div>
      </div>
    </Layout>
  )
}

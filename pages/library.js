import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { getAllTabs } from '@/lib/tabs'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'

export default function Library() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [recentSongs, setRecentSongs] = useState([])
  const [popularSongs, setPopularSongs] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadLibraryData()
  }, [])

  const loadLibraryData = async () => {
    try {
      const allTabs = await getAllTabs()
      
      // 最近瀏覽（按創建時間）
      const recent = [...allTabs]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10)
      setRecentSongs(recent)
      
      // 熱門歌曲（按 viewCount）
      const popular = [...allTabs]
        .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
        .slice(0, 10)
      setPopularSongs(popular)
    } catch (error) {
      console.error('Error loading library:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSongClick = (songId) => {
    router.push(`/tabs/${songId}`)
  }

  const getThumbnail = (song) => {
    if (song.youtubeVideoId) {
      return `https://img.youtube.com/vi/${song.youtubeVideoId}/mqdefault.jpg`
    }
    if (song.youtubeUrl) {
      const match = song.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)
      if (match) {
        return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`
      }
    }
    return null
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-black pb-24 px-6 py-6">
          <h1 className="text-2xl font-bold text-white mb-6">音樂庫</h1>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="min-h-screen bg-black pb-24">
        {/* Header */}
        <div className="px-6 py-6">
          <h1 className="text-2xl font-bold text-white mb-2">音樂庫</h1>
          <p className="text-gray-500">你的結他譜收藏</p>
        </div>

        {/* Quick Actions */}
        <div className="px-6 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <a
              href="/tabs/new"
              className="flex items-center gap-3 p-4 bg-[#FFD700] rounded-lg text-black"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-medium">上傳譜</span>
            </a>
            <a
              href="/artists"
              className="flex items-center gap-3 p-4 bg-white/10 rounded-lg text-white hover:bg-white/20 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-medium">瀏覽歌手</span>
            </a>
          </div>
        </div>

        {/* Recent Songs */}
        {recentSongs.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-white px-6 mb-4">最近新增</h2>
            <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
              {recentSongs.map((song) => (
                <button
                  key={song.id}
                  onClick={() => handleSongClick(song.id)}
                  className="flex-shrink-0 flex flex-col group text-left w-32"
                >
                  <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-800 mb-3">
                    {getThumbnail(song) ? (
                      <img
                        src={getThumbnail(song)}
                        alt={song.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        🎸
                      </div>
                    )}
                  </div>
                  <h3 className="text-sm text-white font-medium truncate group-hover:text-[#FFD700] transition">
                    {song.title}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">{song.artist}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Popular Songs */}
        {popularSongs.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-white px-6 mb-4">熱門歌曲</h2>
            <div className="px-6 space-y-2">
              {popularSongs.slice(0, 5).map((song, index) => (
                <button
                  key={song.id}
                  onClick={() => handleSongClick(song.id)}
                  className="w-full flex items-center gap-4 p-3 hover:bg-white/10 rounded-lg transition group"
                >
                  <span className="text-gray-500 w-6 text-center">{index + 1}</span>
                  <div className="w-12 h-12 rounded bg-gray-800 flex items-center justify-center overflow-hidden">
                    {getThumbnail(song) ? (
                      <img
                        src={getThumbnail(song)}
                        alt={song.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      '🎸'
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-white font-medium group-hover:text-[#FFD700] transition">
                      {song.title}
                    </h3>
                    <p className="text-sm text-gray-500">{song.artist}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600">{song.viewCount || 0} 瀏覽</p>
                    <p className="text-xs text-[#FFD700]">{song.originalKey || 'C'}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Stats */}
        <section className="px-6">
          <h2 className="text-lg font-bold text-white mb-4">統計</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 rounded-lg">
              <p className="text-3xl font-bold text-[#FFD700]">{recentSongs.length}</p>
              <p className="text-sm text-gray-500">最近新增</p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <p className="text-3xl font-bold text-white">
                {popularSongs.reduce((sum, s) => sum + (s.viewCount || 0), 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">總瀏覽次數</p>
            </div>
          </div>
        </section>
      </div>

      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </Layout>
  )
}

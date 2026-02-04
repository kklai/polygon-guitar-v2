import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { getAllTabs } from '@/lib/tabs'
import { getPlaylist, updatePlaylist } from '@/lib/playlists'
import { uploadToCloudinary } from '@/lib/cloudinary'

function EditPlaylist() {
  const router = useRouter()
  const { id } = router.query
  const { isAdmin } = useAuth()
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    manualType: 'theme',
    curatedBy: '',
    coverImage: ''
  })
  const [selectedSongs, setSelectedSongs] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [allSongs, setAllSongs] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [originalPlaylist, setOriginalPlaylist] = useState(null)

  useEffect(() => {
    if (id && isAdmin) {
      loadData()
    }
  }, [id, isAdmin])

  const loadData = async () => {
    try {
      setIsLoading(true)
      
      // 載入歌單資料
      const playlist = await getPlaylist(id)
      if (!playlist) {
        alert('歌單不存在')
        router.push('/admin/playlists')
        return
      }
      
      if (playlist.source === 'auto') {
        alert('自動歌單不能在這裡編輯')
        router.push('/admin/playlists')
        return
      }
      
      setOriginalPlaylist(playlist)
      setFormData({
        title: playlist.title || '',
        description: playlist.description || '',
        manualType: playlist.manualType || 'theme',
        curatedBy: playlist.curatedBy || user?.displayName || '',
        coverImage: playlist.coverImage || ''
      })
      
      // 載入所有歌曲
      const songs = await getAllTabs()
      setAllSongs(songs)
      setSearchResults(songs.slice(0, 10))
      
      // 載入已選歌曲的完整資料
      if (playlist.songIds && playlist.songIds.length > 0) {
        const selected = playlist.songIds
          .map(songId => songs.find(s => s.id === songId))
          .filter(Boolean)
        setSelectedSongs(selected)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      alert('載入失敗：' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 搜尋歌曲
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults(allSongs.slice(0, 10))
      return
    }
    
    const query = searchQuery.toLowerCase()
    const filtered = allSongs.filter(song =>
      song.title.toLowerCase().includes(query) ||
      song.artist.toLowerCase().includes(query)
    ).slice(0, 20)
    
    setSearchResults(filtered)
  }, [searchQuery, allSongs])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // 封面上傳
  const handleCoverUpload = async (file) => {
    if (!file) return
    
    setIsUploading(true)
    try {
      const result = await uploadToCloudinary(file, formData.title || 'playlist-cover')
      setFormData(prev => ({ ...prev, coverImage: result.url }))
    } catch (error) {
      alert('封面上傳失敗：' + error.message)
    } finally {
      setIsUploading(false)
    }
  }

  // 添加歌曲到列表
  const addSong = (song) => {
    if (selectedSongs.find(s => s.id === song.id)) return
    setSelectedSongs(prev => [...prev, song])
  }

  // 從列表移除歌曲
  const removeSong = (songId) => {
    setSelectedSongs(prev => prev.filter(s => s.id !== songId))
  }

  // 上移歌曲
  const moveSongUp = (index) => {
    if (index === 0) return
    const newList = [...selectedSongs]
    const temp = newList[index]
    newList[index] = newList[index - 1]
    newList[index - 1] = temp
    setSelectedSongs(newList)
  }

  // 下移歌曲
  const moveSongDown = (index) => {
    if (index === selectedSongs.length - 1) return
    const newList = [...selectedSongs]
    const temp = newList[index]
    newList[index] = newList[index + 1]
    newList[index + 1] = temp
    setSelectedSongs(newList)
  }

  // 提交表單
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      alert('請輸入歌單名稱')
      return
    }
    
    if (selectedSongs.length === 0) {
      alert('請至少選擇一首歌曲')
      return
    }
    
    setIsSubmitting(true)
    try {
      const playlistData = {
        ...formData,
        songIds: selectedSongs.map(s => s.id),
        updatedAt: new Date().toISOString()
      }
      
      await updatePlaylist(id, playlistData)
      
      alert('✅ 歌單更新成功！')
      router.push('/admin/playlists')
    } catch (error) {
      console.error('Update playlist error:', error)
      alert('更新失敗：' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 獲取歌曲縮圖
  const getThumbnail = (song) => {
    if (song.youtubeVideoId) {
      return `https://img.youtube.com/vi/${song.youtubeVideoId}/default.jpg`
    }
    if (song.youtubeUrl) {
      const match = song.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)
      if (match) {
        return `https://img.youtube.com/vi/${match[1]}/default.jpg`
      }
    }
    return null
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold text-white mb-4">無權訪問</h1>
          <p className="text-gray-500">只有管理員可以編輯歌單</p>
        </div>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto py-16">
          <div className="h-8 bg-gray-800 rounded w-48 mb-6 animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="h-64 bg-gray-800 rounded-xl animate-pulse" />
              <div className="h-48 bg-gray-800 rounded-xl animate-pulse" />
            </div>
            <div className="lg:col-span-2 space-y-4">
              <div className="h-48 bg-gray-800 rounded-xl animate-pulse" />
              <div className="h-80 bg-gray-800 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">編輯精選歌單</h1>
            <p className="text-gray-500">修改歌單內容同歌曲列表</p>
          </div>
          <Link
            href="/admin/playlists"
            className="inline-flex items-center text-gray-400 hover:text-white transition"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            取消
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Basic Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Cover Upload */}
            <div className="p-6 bg-[#121212] rounded-xl border border-gray-800">
              <label className="block text-sm font-medium text-white mb-3">
                歌單封面
              </label>
              <div className="aspect-square bg-gray-800 rounded-lg overflow-hidden mb-3">
                {formData.coverImage ? (
                  <img
                    src={formData.coverImage}
                    alt="Cover"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">
                    🎵
                  </div>
                )}
              </div>
              <label className="block w-full">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleCoverUpload(e.target.files[0])}
                />
                <span className={`block w-full py-2 px-4 text-center rounded-lg cursor-pointer transition ${
                  isUploading 
                    ? 'bg-gray-700 text-gray-400' 
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}>
                  {isUploading ? '上傳中...' : '更換封面'}
                </span>
              </label>
            </div>

            {/* Basic Info Form */}
            <div className="p-6 bg-[#121212] rounded-xl border border-gray-800 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  歌單名稱 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="例如：陳奕迅結他精選"
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  描述
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="簡短描述這個歌單..."
                  rows={3}
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  類型
                </label>
                <select
                  name="manualType"
                  value={formData.manualType}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                >
                  <option value="artist">🎤 歌手精選</option>
                  <option value="theme">🎵 主題歌單</option>
                  <option value="series">📀 系列專輯</option>
                  <option value="mood">💫 場景心情</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  策劃人
                </label>
                <input
                  type="text"
                  name="curatedBy"
                  value={formData.curatedBy}
                  onChange={handleChange}
                  placeholder="你的名字"
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  更新中...
                </span>
              ) : (
                `儲存更改 (${selectedSongs.length} 首)`
              )}
            </button>
          </div>

          {/* Right: Song Selector */}
          <div className="lg:col-span-2 space-y-6">
            {/* Selected Songs */}
            <div className="p-6 bg-[#121212] rounded-xl border border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">
                  已選歌曲
                  <span className="ml-2 text-sm text-gray-500">({selectedSongs.length})</span>
                </h3>
                {selectedSongs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSongs([])}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    清空全部
                  </button>
                )}
              </div>

              {selectedSongs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <span className="text-4xl block mb-2">🎸</span>
                  <p>從左側選擇歌曲加入歌單</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedSongs.map((song, index) => (
                    <div
                      key={song.id}
                      className="flex items-center gap-3 p-3 bg-black rounded-lg group"
                    >
                      <span className="text-gray-600 w-6 text-center">{index + 1}</span>
                      <div className="w-10 h-10 rounded bg-gray-800 overflow-hidden flex-shrink-0">
                        {getThumbnail(song) ? (
                          <img
                            src={getThumbnail(song)}
                            alt={song.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg">🎵</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{song.title}</p>
                        <p className="text-gray-500 text-xs truncate">{song.artist}</p>
                      </div>
                      <span className="text-xs text-[#FFD700]">{song.originalKey || 'C'}</span>
                      
                      {/* Reorder & Remove Buttons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={() => moveSongUp(index)}
                          disabled={index === 0}
                          className="p-1 text-gray-500 hover:text-white disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSongDown(index)}
                          disabled={index === selectedSongs.length - 1}
                          className="p-1 text-gray-500 hover:text-white disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSong(song.id)}
                          className="p-1 text-red-500 hover:text-red-400"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Search Songs */}
            <div className="p-6 bg-[#121212] rounded-xl border border-gray-800">
              <h3 className="text-lg font-medium text-white mb-4">添加歌曲</h3>
              
              {/* Search Input */}
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="搜尋歌名或歌手..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-black border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                />
                <svg 
                  className="absolute left-3 top-3.5 w-5 h-5 text-gray-500"
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Search Results */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.map((song) => {
                    const isSelected = selectedSongs.find(s => s.id === song.id)
                    return (
                      <button
                        key={song.id}
                        type="button"
                        onClick={() => !isSelected && addSong(song)}
                        disabled={isSelected}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition text-left ${
                          isSelected 
                            ? 'bg-green-900/20 opacity-50 cursor-not-allowed' 
                            : 'bg-black hover:bg-gray-800'
                        }`}
                      >
                        <div className="w-10 h-10 rounded bg-gray-800 overflow-hidden flex-shrink-0">
                          {getThumbnail(song) ? (
                            <img
                              src={getThumbnail(song)}
                              alt={song.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg">🎵</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{song.title}</p>
                          <p className="text-gray-500 text-xs truncate">{song.artist}</p>
                        </div>
                        {isSelected ? (
                          <span className="text-green-500 text-xs">✓ 已添加</span>
                        ) : (
                          <span className="text-[#FFD700] text-xs">+ 添加</span>
                        )}
                      </button>
                    )
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>找不到符合的歌曲</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  )
}

export default function EditPlaylistPage() {
  return (
    <AdminGuard>
      <EditPlaylist />
    </AdminGuard>
  )
}

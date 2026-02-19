import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { createTab } from '@/lib/tabs'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import ArtistAutoFill from '@/components/ArtistAutoFill'
import YouTubeSearchModal from '@/components/YouTubeSearchModal'
import SpotifyTrackSearch from '@/components/SpotifyTrackSearch'
import { extractYouTubeVideoId } from '@/lib/wikipedia'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export default function NewTab() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    artistType: '', // male, female, group
    originalKey: 'C',
    capo: '', // Capo 位置
    playKey: '', // 實際彈奏調性
    content: '',
    // 歌手資料
    artistPhoto: '',
    artistBio: '',
    artistYear: '',
    artistBirthYear: '',
    artistDebutYear: '',
    // 歌曲資訊
    songYear: '',
    composer: '',
    lyricist: '',
    arranger: '',
    producer: '',
    album: '',
    bpm: '',
    // 上傳者資料
    uploaderPenName: '', // 上傳者筆名
    // YouTube
    youtubeUrl: '',
    youtubeVideoId: '',
    // 演奏技巧
    strummingPattern: '',
    fingeringTips: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  
  // Spotify 歌曲搜尋狀態
  const [isSpotifyModalOpen, setIsSpotifyModalOpen] = useState(false)
  
  // YouTube Modal 狀態
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false)
  const [youTubeAutoSelect, setYouTubeAutoSelect] = useState(false) // 自動選擇第一個結果
  
  // 相似歌手檢查
  const [similarArtists, setSimilarArtists] = useState([])
  
  // 是否從現有歌手列表中選擇（停用維基自動搜尋）
  const [useExistingArtistSelected, setUseExistingArtistSelected] = useState(false)

  // Redirect if not logged in
  if (!isAuthenticated && !user) {
    if (typeof window !== 'undefined') {
      router.push('/login')
    }
    return null
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.title.trim()) {
      newErrors.title = '請輸入歌名'
    }
    if (!formData.artist.trim()) {
      newErrors.artist = '請輸入歌手名'
    }
    if (!formData.content.trim()) {
      newErrors.content = '請輸入譜內容'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const newTab = await createTab(formData, user.uid)
      router.push(`/tabs/${newTab.id}`)
    } catch (error) {
      console.error('Create tab error:', error)
      alert('上傳失敗，請重試')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
    
    // 如果用戶手動修改歌手名，重置「已選擇現有歌手」狀態
    if (name === 'artist') {
      setUseExistingArtistSelected(false)
    }
    
    // YouTube URL 處理
    if (name === 'youtubeUrl') {
      const videoId = extractYouTubeVideoId(value);
      setFormData(prev => ({
        ...prev,
        youtubeUrl: value,
        youtubeVideoId: videoId
      }));
    }
  }

  // 檢查相似歌手
  useEffect(() => {
    const checkSimilarArtists = async () => {
      if (!formData.artist?.trim() || formData.artist.length < 2) {
        setSimilarArtists([])
        return
      }
      
      try {
        const snapshot = await getDocs(collection(db, 'artists'))
        const inputName = formData.artist.toLowerCase().replace(/\s+/g, '')
        const inputCore = inputName.match(/[\u4e00-\u9fa5]{2,}/)?.[0] || inputName
        
        const similar = []
        snapshot.forEach(doc => {
          const artist = doc.data()
          const artistName = artist.name.toLowerCase().replace(/\s+/g, '')
          const artistCore = artistName.match(/[\u4e00-\u9fa5]{2,}/)?.[0] || artistName
          
          // 檢查是否相似
          if (artistCore === inputCore || 
              artistName.includes(inputName) || 
              inputName.includes(artistName) ||
              (inputCore && artistCore && (artistCore.includes(inputCore) || inputCore.includes(artistCore)))) {
            similar.push({ id: doc.id, ...artist })
          }
        })
        
        setSimilarArtists(similar.slice(0, 3)) // 最多顯示 3 個
      } catch (err) {
        console.error('檢查相似歌手失敗:', err)
      }
    }
    
    const timer = setTimeout(checkSimilarArtists, 500)
    return () => clearTimeout(timer)
  }, [formData.artist])
  
  // 使用現有歌手
  const useExistingArtist = (artist) => {
    setFormData(prev => ({
      ...prev,
      artist: artist.name,
      artistType: artist.artistType || '',
      artistPhoto: artist.photoURL || artist.wikiPhotoURL || '',
      artistBio: artist.bio || '',
      artistYear: artist.year || ''
    }))
    setSimilarArtists([])
    setUseExistingArtistSelected(true) // 標記已選擇現有歌手，停用維基搜尋
  }
  
  // 處理 Wikipedia 自動填入的歌手資料
  const handleArtistFill = (data) => {
    setFormData(prev => ({
      ...prev,
      artist: data.name || prev.artist,
      artistPhoto: data.photo || '',
      artistBio: data.bio || '',
      artistYear: data.year || '',
      artistBirthYear: data.birthYear || '',
      artistDebutYear: data.debutYear || '',
      artistType: data.artistType !== 'unknown' ? data.artistType : prev.artistType
    }))
  }

  // 開啟 Spotify 搜尋
  const handleSearchSpotify = () => {
    if (!formData.artist?.trim() && !formData.title?.trim()) {
      alert('請先輸入歌手名或歌名')
      return
    }
    setIsSpotifyModalOpen(true)
  }

  // 使用 Spotify 歌曲資料
  const handleUseSpotifyTrack = (trackData) => {
    setFormData(prev => ({
      ...prev,
      // 更新歌手和歌名（如果用戶選擇了不同的）
      artist: trackData.artist || prev.artist,
      title: trackData.title || prev.title,
      // 歌曲資訊
      songYear: trackData.songYear || prev.songYear,
      album: trackData.album || prev.album,
      // Spotify 資訊
      spotifyTrackId: trackData.spotifyTrackId || null,
      spotifyAlbumId: trackData.spotifyAlbumId || null,
      spotifyArtistId: trackData.spotifyArtistId || null,
      spotifyUrl: trackData.spotifyUrl || null,
      albumImage: trackData.albumImage || null
    }))
  }

  // Template for guitar tab
  const insertTemplate = () => {
    const template = `e|----------------------------------------------------------------|
B|----------------------------------------------------------------|
G|----------------------------------------------------------------|
D|----------------------------------------------------------------|
A|----------------------------------------------------------------|
E|----------------------------------------------------------------|

在這裡輸入你的結他譜...`
    setFormData(prev => ({
      ...prev,
      content: template
    }))
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Link 
            href="/"
            className="inline-flex items-center text-[#B3B3B3] hover:text-white mr-4 transition"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回
          </Link>
          <h1 className="text-2xl font-bold text-white">上傳新譜</h1>
        </div>

        {/* Form */}
        <div className="bg-[#121212] rounded-xl shadow-md p-6 border border-gray-800">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-white mb-1">
                歌名 <span className="text-[#FFD700]">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="例如：海闊天空"
                className={`w-full px-4 py-2 bg-black border rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent ${
                  errors.title ? 'border-red-500' : 'border-gray-800'
                }`}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-400">{errors.title}</p>
              )}
            </div>

            {/* Artist */}
            <div>
              <label htmlFor="artist" className="block text-sm font-medium text-white mb-1">
                歌手 <span className="text-[#FFD700]">*</span>
              </label>
              <input
                type="text"
                id="artist"
                name="artist"
                value={formData.artist}
                onChange={handleChange}
                placeholder="例如：Beyond"
                className={`w-full px-4 py-2 bg-black border rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent ${
                  errors.artist ? 'border-red-500' : 'border-gray-800'
                }`}
              />
              {errors.artist && (
                <p className="mt-1 text-sm text-red-400">{errors.artist}</p>
              )}
              <p className="mt-1 text-sm text-[#B3B3B3]">
                新歌手會自動建立分類
              </p>
              
              {/* 相似歌手提示 */}
              {similarArtists.length > 0 && (
                <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                  <p className="text-yellow-400 text-sm mb-2">
                    ⚠️ 發現相似歌手，是否使用現有資料？
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {similarArtists.map(artist => (
                      <button
                        key={artist.id}
                        type="button"
                        onClick={() => useExistingArtist(artist)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-white transition"
                      >
                        {artist.photoURL && (
                          <img 
                            src={artist.photoURL} 
                            alt={artist.name}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        )}
                        <span>{artist.name}</span>
                        {artist.artistType && (
                          <span className="text-gray-400 text-xs">
                            ({artist.artistType === 'male' ? '男' : artist.artistType === 'female' ? '女' : '組合'})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 自動搜尋歌手資料 */}
              <div className="mt-3">
                <ArtistAutoFill 
                  artistName={formData.artist}
                  onFill={handleArtistFill}
                  autoApply={true} // 自動應用搜尋結果（無需確認）
                  disabled={useExistingArtistSelected} // 如果用戶已選擇現有歌手，停用自動搜尋
                />
              </div>
            </div>

            {/* Artist Type */}
            <div>
              <label htmlFor="artistType" className="block text-sm font-medium text-white mb-1">
                歌手類型 <span className="text-[#FFD700]">*</span>
              </label>
              <select
                id="artistType"
                name="artistType"
                value={formData.artistType}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
              >
                <option value="">請選擇...</option>
                <option value="male">男歌手</option>
                <option value="female">女歌手</option>
                <option value="group">組合</option>
              </select>
              
              {/* 已填入的歌手資料預覽 */}
              {(formData.artistPhoto || formData.artistYear || formData.artistBirthYear || formData.artistDebutYear || formData.artistType) && (
                <div className="mt-4 p-4 bg-black rounded-lg border border-gray-700">
                  <h4 className="text-sm font-medium text-[#FFD700] mb-3">已填入歌手資料：</h4>
                  <div className="flex gap-4">
                    {formData.artistPhoto && (
                      <img 
                        src={formData.artistPhoto} 
                        alt={formData.artist}
                        className="w-16 h-16 rounded-full object-cover border-2 border-[#FFD700]"
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{formData.artist}</p>
                      {formData.artistType && (
                        <p className="text-gray-400 text-sm">
                          {formData.artistType === 'male' ? '男歌手' : 
                           formData.artistType === 'female' ? '女歌手' : '組合'}
                        </p>
                      )}
                      <div className="flex gap-2 mt-1">
                        {formData.artistBirthYear && (
                          <span className="text-blue-400 text-xs">出生：{formData.artistBirthYear}</span>
                        )}
                        {formData.artistDebutYear && (
                          <span className="text-purple-400 text-xs">出道：{formData.artistDebutYear}</span>
                        )}
                      </div>
                      {formData.artistBio && (
                        <p className="text-gray-600 text-xs mt-1 line-clamp-2">{formData.artistBio}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Song Info Search - Spotify */}
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <h3 className="text-sm font-medium text-[#FFD700] mb-3">歌曲資訊（Spotify 搜尋）</h3>
              <p className="text-xs text-gray-500 mb-3">
                自動從 Spotify 獲取歌曲資訊，包括專輯封面、發行年份等
              </p>
              <button
                type="button"
                onClick={handleSearchSpotify}
                disabled={!formData.artist && !formData.title}
                className="flex items-center gap-2 px-4 py-2 bg-[#1DB954] text-white rounded-lg hover:bg-[#1ed760] transition disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                <span>從 Spotify 搜尋</span>
              </button>
              
              {/* 顯示已選擇的歌曲資訊 */}
              {formData.spotifyTrackId && (
                <div className="mt-4 p-4 bg-[#1a1a1a] border border-[#1DB954] rounded-lg">
                  <h4 className="text-[#1DB954] font-medium mb-3">✓ 已從 Spotify 獲取：</h4>
                  {formData.albumImage && (
                    <img 
                      src={formData.albumImage} 
                      alt={formData.album}
                      className="w-24 h-24 rounded object-cover mb-3"
                    />
                  )}
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-500">歌手：</span><span className="text-white">{formData.artist}</span></p>
                    <p><span className="text-gray-500">歌名：</span><span className="text-white">{formData.title}</span></p>
                    {formData.album && (
                      <p><span className="text-gray-500">專輯：</span><span className="text-white">{formData.album}</span></p>
                    )}
                    {formData.songYear && (
                      <p><span className="text-gray-500">年份：</span><span className="text-white">{formData.songYear}</span></p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Song Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="songYear" className="block text-sm font-medium text-white mb-1">
                  歌曲年份
                </label>
                <input
                  type="text"
                  id="songYear"
                  name="songYear"
                  value={formData.songYear}
                  onChange={handleChange}
                  placeholder="例如：1993"
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                />
              </div>
              
              <div>
                <label htmlFor="album" className="block text-sm font-medium text-white mb-1">
                  所屬專輯/CD
                </label>
                <input
                  type="text"
                  id="album"
                  name="album"
                  value={formData.album}
                  onChange={handleChange}
                  placeholder="例如：樂與怒"
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                />
              </div>
              
              <div>
                <label htmlFor="composer" className="block text-sm font-medium text-white mb-1">
                  作曲
                </label>
                <input
                  type="text"
                  id="composer"
                  name="composer"
                  value={formData.composer}
                  onChange={handleChange}
                  placeholder="例如：黃家駒"
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                />
              </div>
              
              <div>
                <label htmlFor="lyricist" className="block text-sm font-medium text-white mb-1">
                  填詞
                </label>
                <input
                  type="text"
                  id="lyricist"
                  name="lyricist"
                  value={formData.lyricist}
                  onChange={handleChange}
                  placeholder="例如：黃家駒"
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                />
              </div>
              
              <div>
                <label htmlFor="arranger" className="block text-sm font-medium text-white mb-1">
                  編曲
                </label>
                <input
                  type="text"
                  id="arranger"
                  name="arranger"
                  value={formData.arranger}
                  onChange={handleChange}
                  placeholder="例如：Beyond"
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                />
              </div>
              
              <div>
                <label htmlFor="producer" className="block text-sm font-medium text-white mb-1">
                  監製
                </label>
                <input
                  type="text"
                  id="producer"
                  name="producer"
                  value={formData.producer}
                  onChange={handleChange}
                  placeholder="例如：Beyond"
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                />
              </div>
              
              {/* 上傳者筆名 */}
              <div className="sm:col-span-2">
                <label htmlFor="uploaderPenName" className="block text-sm font-medium text-white mb-1">
                  上傳者筆名
                </label>
                <input
                  type="text"
                  id="uploaderPenName"
                  name="uploaderPenName"
                  value={formData.uploaderPenName}
                  onChange={handleChange}
                  placeholder="例如：Kermit、結他小王子（顯示為『編譜：xxx』）"
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                />
                <p className="mt-1 text-sm text-[#B3B3B3]">
                  這份譜是由誰編寫的，會顯示在樂譜頁面
                </p>
              </div>
            </div>

            {/* YouTube */}
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <h3 className="text-sm font-medium text-[#FFD700] mb-3">YouTube 連結</h3>
              
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => { setYouTubeAutoSelect(false); setIsYouTubeModalOpen(true); }}
                  disabled={!formData.artist || !formData.title}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 text-sm"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                  </svg>
                  喺站內搜尋 YouTube
                </button>
                <button
                  type="button"
                  onClick={() => { setYouTubeAutoSelect(true); setIsYouTubeModalOpen(true); }}
                  disabled={!formData.artist || !formData.title}
                  className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] text-black rounded-lg hover:bg-yellow-400 transition disabled:opacity-50 text-sm font-medium"
                >
                  <span>⚡</span>
                  快速添加（自動選第一個）
                </button>
              </div>
              
              <input
                type="url"
                id="youtubeUrl"
                name="youtubeUrl"
                value={formData.youtubeUrl}
                onChange={handleChange}
                placeholder="貼上 YouTube 連結..."
                className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
              />
              
              {formData.youtubeVideoId && (
                <div className="mt-3">
                  <p className="text-xs text-green-400 mb-2">✓ 已識別 Video ID: {formData.youtubeVideoId}</p>
                  <div className="aspect-video max-w-sm">
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${formData.youtubeVideoId}`}
                      title="YouTube preview"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="rounded-lg"
                    ></iframe>
                  </div>
                </div>
              )}
            </div>

            {/* Original Key */}
            <div>
              <label htmlFor="originalKey" className="block text-sm font-medium text-white mb-1">
                原調 <span className="text-[#FFD700]">*</span>
              </label>
              <select
                id="originalKey"
                name="originalKey"
                value={formData.originalKey}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
              >
                <optgroup label="Major (大調)">
                  {['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map((key) => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </optgroup>
                <optgroup label="Minor (小調)">
                  {['Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'].map((key) => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </optgroup>
              </select>
              <p className="mt-1 text-sm text-[#B3B3B3]">
                小調（m）係相對小調，例如 Am 係 C 嘅相對小調
              </p>
            </div>

            {/* Capo */}
            <div>
              <label htmlFor="capo" className="block text-sm font-medium text-white mb-1">
                Capo 位置
              </label>
              <select
                id="capo"
                name="capo"
                value={formData.capo}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
              >
                <option value="">唔用 Capo</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((num) => (
                  <option key={num} value={num}>Capo {num}</option>
                ))}
              </select>
              <p className="mt-1 text-sm text-[#B3B3B3]">
                夾邊格，例如 Capo 1 係夾第一格
              </p>
            </div>

            {/* Play Key */}
            <div>
              <label htmlFor="playKey" className="block text-sm font-medium text-white mb-1">
                彈奏調性
              </label>
              <select
                id="playKey"
                name="playKey"
                value={formData.playKey}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
              >
                <option value="">同原調</option>
                <optgroup label="Major (大調)">
                  {['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map((key) => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </optgroup>
                <optgroup label="Minor (小調)">
                  {['Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'].map((key) => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </optgroup>
              </select>
              <p className="mt-1 text-sm text-[#B3B3B3]">
                實際彈奏嘅調，例如「Capo 1 Play G」
              </p>
            </div>

            {/* 演奏技巧 */}
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <h3 className="text-sm font-medium text-[#FFD700] mb-3">演奏技巧（可選）</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="strummingPattern" className="block text-sm font-medium text-white mb-1">
                    掃弦節奏 (Strumming Pattern)
                  </label>
                  <textarea
                    id="strummingPattern"
                    name="strummingPattern"
                    value={formData.strummingPattern}
                    onChange={handleChange}
                    placeholder="例如：↓ ↓↑ ↓↑ ↓↑&#10;或：D DU DU DU"
                    rows={3}
                    className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent font-mono text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">可以用箭頭 ↓↑ 或 D/U 表示</p>
                </div>
                
                <div>
                  <label htmlFor="fingeringTips" className="block text-sm font-medium text-white mb-1">
                    指法提示 (Fingering Tips)
                  </label>
                  <textarea
                    id="fingeringTips"
                    name="fingeringTips"
                    value={formData.fingeringTips}
                    onChange={handleChange}
                    placeholder="例如：副歌可以用Power Chord加強節奏感&#10;間奏Solo建議用食指橫按..."
                    rows={3}
                    className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Content */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="content" className="block text-sm font-medium text-white">
                  譜內容 <span className="text-[#FFD700]">*</span>
                </label>
                <button
                  type="button"
                  onClick={insertTemplate}
                  className="text-sm text-[#FFD700] hover:opacity-80 transition"
                >
                  插入空白譜模板
                </button>
              </div>
              <textarea
                id="content"
                name="content"
                value={formData.content}
                onChange={handleChange}
                placeholder="在這裡貼上你的結他譜..."
                rows={20}
                className={`w-full px-4 py-2 bg-black border rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent font-mono text-sm ${
                  errors.content ? 'border-red-500' : 'border-gray-800'
                }`}
              />
              {errors.content && (
                <p className="mt-1 text-sm text-red-400">{errors.content}</p>
              )}
              <p className="mt-1 text-sm text-[#B3B3B3]">
                支援純文字格式，換行會被保留
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center space-x-4 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-[#FFD700] text-black py-3 px-6 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '上傳中...' : '上傳譜'}
              </button>
              <Link
                href="/"
                className="px-6 py-3 border border-gray-800 rounded-lg font-medium text-[#B3B3B3] hover:text-white hover:border-[#FFD700] transition"
              >
                取消
              </Link>
            </div>
          </form>
        </div>
      </div>
      
      {/* YouTube 搜尋 Modal */}
      <YouTubeSearchModal
        isOpen={isYouTubeModalOpen}
        onClose={() => setIsYouTubeModalOpen(false)}
        artistName={formData.artist}
        songTitle={formData.title}
        autoSelectFirst={youTubeAutoSelect}
        onSelect={(url) => {
          const videoId = extractYouTubeVideoId(url);
          setFormData(prev => ({
            ...prev,
            youtubeUrl: url,
            youtubeVideoId: videoId
          }));
        }}
      />
      
      {/* Spotify 歌曲搜尋 Modal */}
      <SpotifyTrackSearch
        isOpen={isSpotifyModalOpen}
        onClose={() => setIsSpotifyModalOpen(false)}
        artistName={formData.artist}
        songTitle={formData.title}
        onSelect={handleUseSpotifyTrack}
      />
    </Layout>
  )
}

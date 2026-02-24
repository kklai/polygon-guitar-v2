import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { getTab, updateTab } from '@/lib/tabs'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import ArtistAutoFill from '@/components/ArtistAutoFill'
import YouTubeSearchModal from '@/components/YouTubeSearchModal'
import SpotifyTrackSearch from '@/components/SpotifyTrackSearch'
import { extractYouTubeVideoId } from '@/lib/wikipedia'
import { processTabContent, autoFixTabFormatWithFactor, cleanPastedText } from '@/lib/tabFormatter'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export default function EditTab() {
  const router = useRouter()
  const { id } = router.query
  const { user, isAuthenticated, isAdmin } = useAuth()
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    artistType: '',
    originalKey: 'C',
    capo: '',
    playKey: '',
    content: '',
    // 歌手資料
    artistPhoto: '',
    artistBio: '',
    artistYear: '',
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
    fingeringTips: '',
    // 封面圖片
    albumImage: '',
    coverImage: '',
    // 顯示字體
    displayFont: 'arial'
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [isAuthorized, setIsAuthorized] = useState(false)
  
  // Spotify 歌曲搜尋狀態
  const [isSpotifyModalOpen, setIsSpotifyModalOpen] = useState(false)
  
  // YouTube Modal 狀態
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false)
  const [youTubeAutoSelect, setYouTubeAutoSelect] = useState(false) // 自動選擇第一個結果
  
  // 相似歌手狀態
  const [similarArtists, setSimilarArtists] = useState([])
  const [useExistingArtistSelected, setUseExistingArtistSelected] = useState(false)
  
  // 對齊參數（從 localStorage 讀取或預設 1.1）
  const [alignFactor, setAlignFactor] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tabAlignFactor');
      return saved ? parseFloat(saved) : 1.1;
    }
    return 1.1;
  })
  
  // 字體模式：等寬（mono）或 Arial（比例字體）
  const [fontMode, setFontMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tabFontMode') || 'mono';
    }
    return 'mono';
  })

  // 檢查相似歌手並自動獲取相片
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
          
          if (artistCore === inputCore || 
              artistName.includes(inputName) || 
              inputName.includes(artistName) ||
              (inputCore && artistCore && (artistCore.includes(inputCore) || inputCore.includes(artistCore)))) {
            similar.push({ id: doc.id, ...artist })
          }
        })
        
        setSimilarArtists(similar.slice(0, 3))
        
        // 如果找到相似歌手且當前沒有歌手相片，自動使用第一個匹配歌手的相片
        if (similar.length > 0 && !formData.artistPhoto && !useExistingArtistSelected) {
          const firstMatch = similar[0]
          if (firstMatch.photoURL || firstMatch.wikiPhotoURL) {
            setFormData(prev => ({
              ...prev,
              artistPhoto: firstMatch.photoURL || firstMatch.wikiPhotoURL || ''
            }))
          }
        }
      } catch (err) {
        console.error('檢查相似歌手失敗:', err)
      }
    }
    
    const timer = setTimeout(checkSimilarArtists, 500)
    return () => clearTimeout(timer)
  }, [formData.artist])

  useEffect(() => {
    if (id && isAuthenticated) {
      loadTab()
    }
  }, [id, isAuthenticated])

  const loadTab = async () => {
    try {
      const data = await getTab(id)
      if (!data) {
        router.push('/')
        return
      }

      // Check ownership (owner or admin can edit)
      const isOwner = data.createdBy === user?.uid
      if (!isOwner && !isAdmin) {
        alert('你無權編輯這個譜')
        router.push(`/tabs/${id}`)
        return
      }

      setIsAuthorized(true)
      setFormData({
        title: data.title,
        artist: data.artist,
        artistType: data.artistType || '',
        originalKey: data.originalKey || 'C',
        capo: data.capo || '',
        playKey: data.playKey || '',
        content: data.content,
        artistPhoto: data.artistPhoto || '',
        artistBio: data.artistBio || '',
        artistYear: data.artistYear || '',
        songYear: data.songYear || '',
        composer: data.composer || '',
        lyricist: data.lyricist || '',
        arranger: data.arranger || '',
        producer: data.producer || '',
        album: data.album || '',
        bpm: data.bpm || '',
        youtubeUrl: data.youtubeUrl || '',
        youtubeVideoId: data.youtubeVideoId || '',
        strummingPattern: data.strummingPattern || '',
        fingeringTips: data.fingeringTips || '',
        uploaderPenName: data.uploaderPenName || data.arrangedBy || '', // 兼容舊資料的 arrangedBy
        viewCount: data.viewCount || 0,
        createdAt: data.createdAt,
        albumImage: data.albumImage || '',
        coverImage: data.coverImage || '',
        displayFont: data.displayFont || 'arial'
      })
    } catch (error) {
      console.error('Error loading tab:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Redirect if not logged in
  if (!isAuthenticated && !isLoading) {
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
      // 如果沒有輸入筆名，使用用戶的 displayName
      const submitData = {
        ...formData,
        uploaderPenName: formData.uploaderPenName.trim() || '結他友'
      }
      await updateTab(id, submitData, user.uid, isAdmin)
      router.push(`/tabs/${id}`)
    } catch (error) {
      console.error('Update tab error:', error)
      alert('更新失敗：' + error.message)
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
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
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

  // 處理 Wikipedia 自動填入的歌手資料
  const handleArtistFill = (data) => {
    setFormData(prev => ({
      ...prev,
      // 不更新歌手名（保留用戶原始輸入）
      artistPhoto: data.photo || '',
      artistBio: data.bio || '',
      artistYear: data.year || '',
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
      // 不更新歌手和歌名（保留用戶原始輸入）
      // 只更新歌曲資訊和 Spotify 資訊
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

  // 獲取可用的封面圖片選項
  const getCoverImageOptions = () => {
    const options = []
    
    // 1. Spotify 專輯圖
    if (formData.albumImage) {
      options.push({
        url: formData.albumImage,
        type: 'spotify',
        label: 'Spotify 專輯封面'
      })
    }
    
    // 2. YouTube 縮圖
    if (formData.youtubeVideoId) {
      options.push({
        url: `https://img.youtube.com/vi/${formData.youtubeVideoId}/hqdefault.jpg`,
        type: 'youtube',
        label: 'YouTube 影片縮圖'
      })
      // 高品質版本
      options.push({
        url: `https://img.youtube.com/vi/${formData.youtubeVideoId}/maxresdefault.jpg`,
        type: 'youtube',
        label: 'YouTube 高清縮圖'
      })
    }
    
    // 3. 歌手相片
    if (formData.artistPhoto) {
      options.push({
        url: formData.artistPhoto,
        type: 'artist',
        label: '歌手相片'
      })
    }
    
    return options
  }

  // 選擇封面圖
  const handleSelectCover = (url) => {
    setFormData(prev => ({ ...prev, coverImage: url }))
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-800 rounded w-1/3"></div>
            <div className="h-12 bg-gray-800 rounded"></div>
            <div className="h-12 bg-gray-800 rounded"></div>
            <div className="h-64 bg-gray-800 rounded"></div>
          </div>
        </div>
      </Layout>
    )
  }

  if (!isAuthorized) return null

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 pb-8">
        {/* Header - Sticky */}
        <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-gray-800 -mx-4 px-4 py-4 mb-2 flex items-center justify-between">
          <div className="flex items-center">
            <Link 
              href={`/tabs/${id}`}
              className="inline-flex items-center text-[#B3B3B3] hover:text-white mr-4 transition"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              返回
            </Link>
            <h1 className="text-2xl font-bold text-white">編輯譜</h1>
          </div>
          
          {/* 頂部保存按鈕 */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>保存中...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>保存更改</span>
              </>
            )}
          </button>
        </div>

        {/* Metadata Info */}
        <div className="mb-4 px-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#B3B3B3]">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {(formData.viewCount || 0).toLocaleString()} 次瀏覽
            </span>
            <span className="text-gray-600">|</span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
              Key: {formData.originalKey || 'C'}
            </span>
            <span className="text-gray-600">|</span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date(formData.createdAt || Date.now()).toLocaleDateString('zh-HK')}
            </span>
          </div>
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
                className={`w-full px-4 py-2 bg-black border rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent ${
                  errors.artist ? 'border-red-500' : 'border-gray-800'
                }`}
              />
              {errors.artist && (
                <p className="mt-1 text-sm text-red-400">{errors.artist}</p>
              )}
              
              {/* 自動搜尋歌手資料 */}
              <div className="mt-3">
                <ArtistAutoFill 
                  artistName={formData.artist}
                  onFill={handleArtistFill}
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
              {(formData.artistPhoto || formData.artistYear || formData.artistType) && (
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
                      {formData.artistYear && (
                        <p className="text-gray-500 text-xs">出道/出生年份：{formData.artistYear}</p>
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

            {/* Cover Image Selection */}
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <h3 className="text-sm font-medium text-[#FFD700] mb-3">封面圖片設定</h3>
              
              {(() => {
                const options = getCoverImageOptions()
                
                if (options.length === 0) {
                  return (
                    <div className="text-center py-6 bg-[#1a1a1a] rounded-lg border border-gray-800">
                      <p className="text-gray-500 text-sm">請先添加 YouTube 影片或從 Spotify 搜尋歌曲</p>
                      <p className="text-gray-600 text-xs mt-1">系統會自動獲取封面圖片選項</p>
                    </div>
                  )
                }
                
                return (
                  <div className="space-y-4">
                    {/* 圖片選擇 - 100x100 小圖 */}
                    <div className="flex flex-wrap gap-3">
                      {options.map((option, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleSelectCover(option.url)}
                          className={`relative w-[100px] h-[100px] rounded-lg overflow-hidden border-2 transition flex-shrink-0 ${
                            formData.coverImage === option.url 
                              ? 'border-[#FFD700] ring-2 ring-[#FFD700]/30' 
                              : 'border-gray-700 hover:border-gray-500'
                          }`}
                        >
                          <img 
                            src={option.url} 
                            alt={option.label}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none'
                              e.target.nextSibling.style.display = 'flex'
                            }}
                          />
                          <div className="hidden w-full h-full items-center justify-center bg-gray-800 text-gray-500 text-xs">
                            載入失敗
                          </div>
                          
                          {/* 類型標籤 - 更小字體 */}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm py-0.5 px-1">
                            <p className="text-white text-[10px] truncate">{option.label}</p>
                          </div>
                          
                          {/* 選中標記 - 更小 */}
                          {formData.coverImage === option.url && (
                            <div className="absolute top-1 right-1 w-5 h-5 bg-[#FFD700] rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    
                    {/* 當前選擇預覽 */}
                    {formData.coverImage && (
                      <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#FFD700]/30">
                        <p className="text-xs text-[#FFD700] mb-2">已選擇的封面：</p>
                        <div className="flex items-center gap-3">
                          <img 
                            src={formData.coverImage} 
                            alt="Selected cover"
                            className="w-16 h-16 rounded object-cover"
                          />
                          <div className="flex-1">
                            <p className="text-white text-sm truncate">
                              {options.find(o => o.url === formData.coverImage)?.label || '自訂圖片'}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleSelectCover('')}
                              className="text-xs text-red-400 hover:text-red-300 mt-1"
                            >
                              清除選擇
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Song Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="songYear" className="block text-sm font-medium text-white mb-1">歌曲年份</label>
                <input type="text" id="songYear" name="songYear" value={formData.songYear} onChange={handleChange} placeholder="例如：1993" className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent" />
              </div>
              <div>
                <label htmlFor="album" className="block text-sm font-medium text-white mb-1">所屬專輯/CD</label>
                <input type="text" id="album" name="album" value={formData.album} onChange={handleChange} placeholder="例如：樂與怒" className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent" />
              </div>
              <div>
                <label htmlFor="bpm" className="block text-sm font-medium text-white mb-1">BPM</label>
                <input type="number" id="bpm" name="bpm" value={formData.bpm} onChange={handleChange} placeholder="例如：120" min="1" max="300" className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent" />
              </div>
              <div>
                <label htmlFor="composer" className="block text-sm font-medium text-white mb-1">作曲</label>
                <input type="text" id="composer" name="composer" value={formData.composer} onChange={handleChange} placeholder="例如：黃家駒" className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent" />
              </div>
              <div>
                <label htmlFor="lyricist" className="block text-sm font-medium text-white mb-1">填詞</label>
                <input type="text" id="lyricist" name="lyricist" value={formData.lyricist} onChange={handleChange} placeholder="例如：黃家駒" className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent" />
              </div>
              <div>
                <label htmlFor="arranger" className="block text-sm font-medium text-white mb-1">編曲</label>
                <input type="text" id="arranger" name="arranger" value={formData.arranger} onChange={handleChange} placeholder="例如：Beyond" className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent" />
              </div>
              <div>
                <label htmlFor="producer" className="block text-sm font-medium text-white mb-1">監製</label>
                <input type="text" id="producer" name="producer" value={formData.producer} onChange={handleChange} placeholder="例如：Beyond" className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent" />
              </div>
              
              {/* 上傳者筆名 */}
              <div className="sm:col-span-2">
                <label htmlFor="uploaderPenName" className="block text-sm font-medium text-white mb-1">上傳者筆名</label>
                <input type="text" id="uploaderPenName" name="uploaderPenName" value={formData.uploaderPenName} onChange={handleChange} placeholder="例如：Kermit、結他小王子（顯示為『編譜：xxx』）" className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent" />
                <p className="mt-1 text-sm text-[#B3B3B3]">這份譜是由誰編寫的，會顯示在樂譜頁面</p>
              </div>
            </div>

            {/* YouTube */}
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <h3 className="text-sm font-medium text-[#FFD700] mb-3">YouTube 連結</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                <button type="button" onClick={() => { setYouTubeAutoSelect(false); setIsYouTubeModalOpen(true); }} disabled={!formData.artist || !formData.title} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 text-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                  喺站內搜尋 YouTube
                </button>
                <button type="button" onClick={() => { setYouTubeAutoSelect(true); setIsYouTubeModalOpen(true); }} disabled={!formData.artist || !formData.title} className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] text-black rounded-lg hover:bg-yellow-400 transition disabled:opacity-50 text-sm font-medium">
                  <span>⚡</span>
                  快速添加（自動選第一個）
                </button>
              </div>
              <input type="url" id="youtubeUrl" name="youtubeUrl" value={formData.youtubeUrl} onChange={handleChange} placeholder="貼上 YouTube 連結..." className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent" />
              {formData.youtubeVideoId && (
                <div className="mt-3">
                  <p className="text-xs text-green-400 mb-2">✓ 已識別 Video ID: {formData.youtubeVideoId}</p>
                  <div className="aspect-video max-w-sm">
                    <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${formData.youtubeVideoId}`} title="YouTube preview" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="rounded-lg"></iframe>
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
              {/* 譜顯示字體設定 */}
              <div className="bg-[#1a1a1a] rounded-lg p-3 border border-[#FFD700]/30 mb-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-[#FFD700] font-medium">此譜顯示字體（用戶睇到嘅效果）</label>
                  <div className="flex items-center gap-2 bg-black rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, displayFont: 'mono' }));
                      }}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                        formData.displayFont === 'mono' 
                          ? 'bg-[#FFD700] text-black' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      等寬字體
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, displayFont: 'arial' }));
                      }}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                        formData.displayFont === 'arial' 
                          ? 'bg-[#FFD700] text-black' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Arial
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {formData.displayFont === 'arial' 
                    ? 'Arial：適合從其他網站複製過來嘅譜，用戶睇到嘅效果同你編輯時一樣（舊譜預設）' 
                    : '等寬字體：傳統結他譜顯示方式'}
                </p>
              </div>

              <div className="flex items-center justify-between mb-1">
                <label htmlFor="content" className="block text-sm font-medium text-white">
                  譜內容 <span className="text-[#FFD700]">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      // Arial 模式下唔壓縮空格
                      const fixed = autoFixTabFormatWithFactor(formData.content, alignFactor, formData.displayFont !== 'arial');
                      setFormData(prev => ({ ...prev, content: fixed }));
                    }}
                    className="text-sm text-[#FFD700] hover:text-yellow-300 transition-colors flex items-center gap-1"
                    disabled={!formData.content}
                    title="修正對齊問題"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                    </svg>
                    自動修正對齊
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cleaned = formData.content
                        .split('\n')
                        .filter(line => line.trim())
                        .join('\n');
                      setFormData(prev => ({ ...prev, content: cleaned }));
                    }}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                    disabled={!formData.content}
                  >
                    移除所有空行
                  </button>
                </div>
              </div>
              <textarea
                id="content"
                name="content"
                value={formData.content}
                onChange={handleChange}
                onPaste={(e) => {
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  // 清理空格（只清行尾）
                  const cleaned = cleanPastedText(pastedText);
                  // Arial 模式下唔壓縮空格，等寬模式先壓縮
                  const processed = autoFixTabFormatWithFactor(cleaned, alignFactor, formData.displayFont !== 'arial');
                  
                  // 獲取當前光標位置
                  const textarea = e.target;
                  const start = textarea.selectionStart;
                  const end = textarea.selectionEnd;
                  const currentValue = formData.content;
                  
                  // 插入處理後嘅文字
                  const newValue = currentValue.substring(0, start) + processed + currentValue.substring(end);
                  
                  // 更新表單數據
                  setFormData(prev => ({ ...prev, content: newValue }));
                }}
                rows={20}
                placeholder="在這裡貼上你的結他譜...&#10;提示：Paste 時會自動修正對齊，或者貼上後按「自動修正對齊」按鈕"
                className={`w-full px-4 py-2 bg-black border rounded-lg text-white placeholder-[#B3B3B3] focus:ring-2 focus:ring-[#FFD700] focus:border-transparent text-sm ${
                  errors.content ? 'border-red-500' : 'border-gray-800'
                } ${formData.displayFont === 'arial' ? 'font-sans' : 'font-mono'}`}
                style={formData.displayFont === 'arial' ? { fontFamily: 'Arial, Helvetica, sans-serif' } : {}}
              />
              {errors.content && (
                <p className="mt-1 text-sm text-red-400">{errors.content}</p>
              )}
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                <svg className="w-4 h-4 text-[#FFD700]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>貼上時會自動修正對齊。有 | 會保留，冇 | 會保持原樣，淨係調整空格對齊和弦同歌詞。</span>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center space-x-4 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-[#FFD700] text-black py-3 px-6 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '保存中...' : '保存更改'}
              </button>
              <Link
                href={`/tabs/${id}`}
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

import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { createTab } from '@/lib/tabs'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import ArtistAutoFill from '@/components/ArtistAutoFill'
import YouTubeSearchModal from '@/components/YouTubeSearchModal'
import { searchSongInfo } from '@/lib/musicapi'
import { extractYouTubeVideoId } from '@/lib/wikipedia'

export default function NewTab() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    artistType: '', // male, female, group
    originalKey: 'C',
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
    // YouTube
    youtubeUrl: '',
    youtubeVideoId: '',
    // 演奏技巧
    strummingPattern: '',
    fingeringTips: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  
  // 歌曲搜尋狀態
  const [isSearchingSong, setIsSearchingSong] = useState(false)
  const [songPreview, setSongPreview] = useState(null)
  
  // YouTube Modal 狀態
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false)

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
      artist: data.name || prev.artist,
      artistPhoto: data.photo || '',
      artistBio: data.bio || '',
      artistYear: data.year || '',
      artistType: data.artistType !== 'unknown' ? data.artistType : prev.artistType
    }))
  }

  // 搜尋歌曲資訊
  const handleSearchSongInfo = async () => {
    if (!formData.artist?.trim() || !formData.title?.trim()) {
      alert('請先輸入歌手名同歌名')
      return
    }
    
    setIsSearchingSong(true)
    setSongPreview(null)
    
    const data = await searchSongInfo(formData.artist, formData.title)
    
    if (data) {
      setSongPreview(data)
    } else {
      alert('搵唔到歌曲資料（可能維基百科未有呢首歌）')
    }
    
    setIsSearchingSong(false)
  }

  // 使用歌曲資料
  const handleUseSongInfo = () => {
    if (songPreview) {
      setFormData(prev => ({
        ...prev,
        songYear: songPreview.year || prev.songYear,
        composer: songPreview.composer || prev.composer,
        lyricist: songPreview.lyricist || prev.lyricist,
        arranger: songPreview.arranger || prev.arranger,
        producer: songPreview.producer || prev.producer,
        album: songPreview.album || prev.album
      }))
      setSongPreview(null)
    }
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
              
              {/* 自動搜尋歌手資料 */}
              <div className="mt-3">
                <ArtistAutoFill 
                  artistName={formData.artist}
                  onFill={handleArtistFill}
                  autoApply={true} // 自動應用搜尋結果（無需確認）
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
                      {formData.artistBio && (
                        <p className="text-gray-600 text-xs mt-1 line-clamp-2">{formData.artistBio}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Song Info Search */}
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <h3 className="text-sm font-medium text-[#FFD700] mb-3">歌曲資訊（自動搜尋 Wikipedia）</h3>
              <button
                type="button"
                onClick={handleSearchSongInfo}
                disabled={isSearchingSong || !formData.artist || !formData.title}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
              >
                {isSearchingSong ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>搜尋緊...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>搵歌曲資料</span>
                  </>
                )}
              </button>

              {/* 歌曲資料預覽 */}
              {songPreview && (
                <div className="mt-4 p-4 bg-[#1a1a1a] border border-[#FFD700] rounded-lg">
                  <h4 className="text-[#FFD700] font-medium mb-3">搵到歌曲資料：</h4>
                  <div className="space-y-2 text-sm">
                    {songPreview.year && (
                      <p><span className="text-gray-500">年份：</span><span className="text-white">{songPreview.year}</span></p>
                    )}
                    {songPreview.composer && (
                      <p><span className="text-gray-500">作曲：</span><span className="text-white">{songPreview.composer}</span></p>
                    )}
                    {songPreview.lyricist && (
                      <p><span className="text-gray-500">填詞：</span><span className="text-white">{songPreview.lyricist}</span></p>
                    )}
                    {songPreview.arranger && (
                      <p><span className="text-gray-500">編曲：</span><span className="text-white">{songPreview.arranger}</span></p>
                    )}
                    {songPreview.producer && (
                      <p><span className="text-gray-500">監製：</span><span className="text-white">{songPreview.producer}</span></p>
                    )}
                    {songPreview.album && (
                      <p><span className="text-gray-500">專輯：</span><span className="text-white">{songPreview.album}</span></p>
                    )}
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      type="button"
                      onClick={handleUseSongInfo}
                      className="px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition"
                    >
                      使用呢個資料
                    </button>
                    <button
                      type="button"
                      onClick={() => setSongPreview(null)}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                    >
                      取消
                    </button>
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
            </div>

            {/* YouTube */}
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <h3 className="text-sm font-medium text-[#FFD700] mb-3">YouTube 連結</h3>
              
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setIsYouTubeModalOpen(true)}
                  disabled={!formData.artist || !formData.title}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 text-sm"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                  </svg>
                  喺站內搜尋 YouTube
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
        onSelect={(url) => {
          const videoId = extractYouTubeVideoId(url);
          setFormData(prev => ({
            ...prev,
            youtubeUrl: url,
            youtubeVideoId: videoId
          }));
        }}
      />
    </Layout>
  )
}

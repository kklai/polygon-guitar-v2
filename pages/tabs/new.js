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
import { processTabContent, autoFixTabFormatWithFactor, cleanPastedText } from '@/lib/tabFormatter'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// Key 對應的 semitone 位置 (C = 0)
const KEY_TO_SEMITONE = {
  'C': 0, 'Db': 1, 'C#': 1, 'D': 2, 'Eb': 3, 'D#': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'Ab': 8, 'G#': 8,
  'A': 9, 'Bb': 10, 'A#': 10, 'B': 11,
  'Cm': 0, 'C#m': 1, 'Dm': 2, 'D#m': 3, 'Ebm': 3, 'Em': 4,
  'Fm': 5, 'F#m': 6, 'Gm': 7, 'G#m': 8, 'Am': 9, 'Bbm': 10, 'Bm': 11
}

// Semitone 對應的 Key (優先使用 flat 給 Major，sharp 給 Minor)
const SEMITONE_TO_KEY_MAJOR = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const SEMITONE_TO_KEY_MINOR = ['Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm']

// 計算 Capo 或 PlayKey
// - 如果輸入 capo，計算 playKey = originalKey 向上移動 capo 個 semitone
// - 如果輸入 playKey，計算 capo = originalKey 到 playKey 的距離
function calculateKeyAndCapo(originalKey, capo, playKey) {
  if (!originalKey) return { capo: '', playKey: '' }
  
  const originalIndex = KEY_TO_SEMITONE[originalKey]
  if (originalIndex === undefined) return { capo, playKey }
  
  const isMinor = originalKey.endsWith('m')
  const semitoneToKey = isMinor ? SEMITONE_TO_KEY_MINOR : SEMITONE_TO_KEY_MAJOR
  
  // 情況 1：有 capo，沒有 playKey -> 計算 playKey
  if (capo && !playKey) {
    const capoNum = parseInt(capo)
    if (!isNaN(capoNum) && capoNum >= 0 && capoNum <= 11) {
      // Capo 夾在第 N 格 = 升高 N 個 semitone
      // PlayKey 是實際彈奏的指法，所以是 OriginalKey 向上移動 capo
      // 例如：原調 C，Capo 4，彈奏 G 指法，實際音高是 E
      // 但 PlayKey 應該是 G（用戶實際按的和弦）
      const playIndex = (originalIndex + capoNum) % 12
      return { capo: capoNum.toString(), playKey: semitoneToKey[playIndex] }
    }
  }
  
  // 情況 2：有 playKey，沒有 capo -> 計算 capo
  if (playKey && !capo) {
    const playIndex = KEY_TO_SEMITONE[playKey]
    if (playIndex !== undefined) {
      // Capo = playIndex - originalIndex (如果 playKey 高於 originalKey)
      // 或者 capo = 12 + playIndex - originalIndex
      let capoNum = (playIndex - originalIndex + 12) % 12
      return { capo: capoNum === 0 ? '' : capoNum.toString(), playKey }
    }
  }
  
  return { capo, playKey }
}

// 可拖放的區塊組件
function DraggableSection({ id, title, children, isExpanded, onToggle, dragHandleProps, isDark }) {
  return (
    <div className={`rounded-xl border transition-all ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'}`}>
      {/* 區塊標題欄 - 可拖放 */}
      <div 
        className={`flex items-center justify-between px-4 py-3 cursor-pointer rounded-t-xl transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
        onClick={onToggle}
        {...dragHandleProps}
      >
        <div className="flex items-center gap-3">
          {/* 拖放圖標 */}
          <svg className={`w-5 h-5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
          <h3 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* 展開/收合圖標 */}
          <svg 
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {/* 區塊內容 */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-800/50">
          {children}
        </div>
      )}
    </div>
  )
}

export default function NewTab() {
  const router = useRouter()
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    artistType: '',
    originalKey: 'C',
    capo: '',
    playKey: '',
    content: '',
    artistPhoto: '',
    artistBio: '',
    artistYear: '',
    artistBirthYear: '',
    artistDebutYear: '',
    songYear: '',
    composer: '',
    lyricist: '',
    arranger: '',
    producer: '',
    album: '',
    bpm: '',
    uploaderPenName: '',
    youtubeUrl: '',
    youtubeVideoId: '',
    strummingPattern: '',
    fingeringTips: '',
    albumImage: '',
    coverImage: '',
    displayFont: 'mono' // 預設等寬字體，傳統結他譜格式
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [isSpotifyModalOpen, setIsSpotifyModalOpen] = useState(false)
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false)
  const [youTubeAutoSelect, setYouTubeAutoSelect] = useState(false)
  const [similarArtists, setSimilarArtists] = useState([])
  const [useExistingArtistSelected, setUseExistingArtistSelected] = useState(false)
  
  // 區塊展開/收合狀態
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    spotify: false,
    key: true,
    youtube: true,
    content: true,
    uploader: true,
    cover: false
  })
  
  // 區塊排序
  const [sectionOrder, setSectionOrder] = useState([
    'basic',
    'spotify',
    'key',
    'youtube', 
    'content',
    'uploader',
    'cover'
  ])
  
  // 拖放狀態
  const [draggedItem, setDraggedItem] = useState(null)
  
  // 對齊參數（從 localStorage 讀取或預設 1.1）
  const [alignFactor, setAlignFactor] = useState(1.1)
  
  // 字體模式：等寬（mono）或 Arial（比例字體）
  const [fontMode, setFontMode] = useState('mono')
  
  // 在客戶端載入後讀取 localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedFactor = localStorage.getItem('tabAlignFactor');
      if (savedFactor) setAlignFactor(parseFloat(savedFactor));
      
      const savedFontMode = localStorage.getItem('tabFontMode');
      if (savedFontMode) setFontMode(savedFontMode);
    }
  }, [])

  // 所有 hooks 必須在任何 return 之前定義 - authChecked 用於等待初始化
  const [authChecked, setAuthChecked] = useState(false)
  
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
  }, [formData.artist, useExistingArtistSelected])
  
  useEffect(() => {
    if (!authLoading && !authChecked) {
      setAuthChecked(true)
    }
  }, [authLoading, authChecked])

  // 等待 auth 載入完成 - 在所有 hooks 之後
  if (authLoading || !authChecked) {
    return null
  }

  // 未登入時顯示登入提示
  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-20 text-center">
          <div className="bg-[#121212] rounded-xl border border-gray-800 p-8">
            <svg className="w-16 h-16 mx-auto mb-4 text-[#FFD700]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h1 className="text-xl font-bold text-white mb-2">請先登入</h1>
            <p className="text-gray-400 mb-6">上傳樂譜需要先登入帳戶</p>
            <Link 
              href="/login?redirect=/tabs/new" 
              className="inline-block bg-[#FFD700] text-black px-6 py-3 rounded-lg font-medium hover:bg-yellow-400 transition"
            >
              前往登入
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.title.trim()) newErrors.title = '請輸入歌名'
    if (!formData.artist.trim()) newErrors.artist = '請輸入歌手名'
    if (!formData.content.trim()) newErrors.content = '請輸入譜內容'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const submitData = {
        ...formData,
        uploaderPenName: formData.uploaderPenName.trim() || '結他友'
      }
      const newTab = await createTab(submitData, user.uid)
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
    
    // 處理 Key/Capo/PlayKey 的自動計算
    if (name === 'originalKey' || name === 'capo' || name === 'playKey') {
      setFormData(prev => {
        const newData = { ...prev, [name]: value }
        const { capo, playKey } = calculateKeyAndCapo(
          name === 'originalKey' ? value : newData.originalKey,
          name === 'capo' ? value : newData.capo,
          name === 'playKey' ? value : newData.playKey
        )
        return { ...newData, capo, playKey }
      })
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
    
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
    
    if (name === 'artist') setUseExistingArtistSelected(false)
    
    if (name === 'youtubeUrl') {
      const videoId = extractYouTubeVideoId(value);
      setFormData(prev => ({ ...prev, youtubeUrl: value, youtubeVideoId: videoId }));
    }
  }

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
    setUseExistingArtistSelected(true)
  }
  
  const handleArtistFill = (data) => {
    setFormData(prev => ({
      ...prev,
      artistPhoto: data.photo || '',
      artistBio: data.bio || '',
      artistYear: data.year || '',
      artistBirthYear: data.birthYear || '',
      artistDebutYear: data.debutYear || '',
      artistType: data.artistType !== 'unknown' ? data.artistType : prev.artistType
    }))
  }

  const handleSearchSpotify = () => {
    if (!formData.artist?.trim() && !formData.title?.trim()) {
      alert('請先輸入歌手名或歌名')
      return
    }
    setIsSpotifyModalOpen(true)
  }

  const handleUseSpotifyTrack = (trackData) => {
    setFormData(prev => ({
      ...prev,
      songYear: trackData.songYear || prev.songYear,
      album: trackData.album || prev.album,
      spotifyTrackId: trackData.spotifyTrackId || null,
      spotifyAlbumId: trackData.spotifyAlbumId || null,
      spotifyArtistId: trackData.spotifyArtistId || null,
      spotifyUrl: trackData.spotifyUrl || null,
      albumImage: trackData.albumImage || null
    }))
  }

  const insertTemplate = () => {
    const template = `e|----------------------------------------------------------------|
B|----------------------------------------------------------------|
G|----------------------------------------------------------------|
D|----------------------------------------------------------------|
A|----------------------------------------------------------------|
E|----------------------------------------------------------------|

在這裡輸入你的結他譜...`
    setFormData(prev => ({ ...prev, content: template }))
  }

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))
  }

  // 拖放處理
  const handleDragStart = (e, index) => {
    setDraggedItem(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    if (draggedItem === null || draggedItem === index) return
    
    const newOrder = [...sectionOrder]
    const item = newOrder[draggedItem]
    newOrder.splice(draggedItem, 1)
    newOrder.splice(index, 0, item)
    setSectionOrder(newOrder)
    setDraggedItem(index)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  // 獲取可用的封面圖片選項（必須在 sectionContents 之前定義）
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

  // 各區塊內容
  const sectionContents = {
    basic: (
      <div className="space-y-4 pt-4">
        {/* 歌名 */}
        <div>
          <label className="block text-sm font-medium text-white mb-1">歌名 <span className="text-[#FFD700]">*</span></label>
          <input type="text" name="title" value={formData.title} onChange={handleChange}
            placeholder="例如：海闊天空"
            className={`w-full px-4 py-2 bg-black border rounded-lg text-white placeholder-gray-500 ${errors.title ? 'border-red-500' : 'border-gray-700'}`} />
          {errors.title && <p className="mt-1 text-sm text-red-400">{errors.title}</p>}
        </div>
        
        {/* 歌手 */}
        <div>
          <label className="block text-sm font-medium text-white mb-1">歌手 <span className="text-[#FFD700]">*</span></label>
          <input type="text" name="artist" value={formData.artist} onChange={handleChange}
            placeholder="例如：Beyond"
            className={`w-full px-4 py-2 bg-black border rounded-lg text-white placeholder-gray-500 ${errors.artist ? 'border-red-500' : 'border-gray-700'}`} />
          {errors.artist && <p className="mt-1 text-sm text-red-400">{errors.artist}</p>}
          
          {/* 相似歌手提示 */}
          {similarArtists.length > 0 && (
            <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
              <p className="text-yellow-400 text-sm mb-2">發現相似歌手，是否使用現有資料？</p>
              <div className="flex flex-wrap gap-2">
                {similarArtists.map(artist => (
                  <button key={artist.id} type="button" onClick={() => useExistingArtist(artist)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-white">
                    {artist.photoURL && <img src={artist.photoURL} alt={artist.name} className="w-6 h-6 rounded-full object-cover" />}
                    <span>{artist.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="mt-3">
            <ArtistAutoFill artistName={formData.artist} onFill={handleArtistFill} 
              autoApply={true} disabled={useExistingArtistSelected} />
          </div>
        </div>
        
        {/* 歌手類型 */}
        <div>
          <label className="block text-sm font-medium text-white mb-1">歌手類型 <span className="text-[#FFD700]">*</span></label>
          <select name="artistType" value={formData.artistType} onChange={handleChange}
            className="w-full px-4 py-2 bg-black border border-gray-700 rounded-lg text-white">
            <option value="">請選擇...</option>
            <option value="male">男歌手</option>
            <option value="female">女歌手</option>
            <option value="group">組合</option>
          </select>
        </div>
        
        {/* 歌曲資訊網格 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">歌曲年份</label>
            <input type="text" name="songYear" value={formData.songYear} onChange={handleChange}
              placeholder="1993" className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">所屬專輯</label>
            <input type="text" name="album" value={formData.album} onChange={handleChange}
              placeholder="樂與怒" className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">作曲</label>
            <input type="text" name="composer" value={formData.composer} onChange={handleChange}
              placeholder="黃家駒" className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">填詞</label>
            <input type="text" name="lyricist" value={formData.lyricist} onChange={handleChange}
              placeholder="黃家駒" className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">編曲</label>
            <input type="text" name="arranger" value={formData.arranger} onChange={handleChange}
              placeholder="Beyond" className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">監製</label>
            <input type="text" name="producer" value={formData.producer} onChange={handleChange}
              placeholder="Beyond" className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">BPM</label>
            <input type="number" name="bpm" value={formData.bpm} onChange={handleChange}
              placeholder="120" min="1" max="300" className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm" />
          </div>
        </div>
      </div>
    ),
    
    key: (
      <div className="space-y-4 pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-white mb-1">原調 <span className="text-[#FFD700]">*</span></label>
            <select name="originalKey" value={formData.originalKey} onChange={handleChange}
              className="w-full px-4 py-2 bg-black border border-gray-700 rounded-lg text-white">
              <optgroup label="Major">
                {['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map(k => <option key={k} value={k}>{k}</option>)}
              </optgroup>
              <optgroup label="Minor">
                {['Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'].map(k => <option key={k} value={k}>{k}</option>)}
              </optgroup>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-white mb-1">Capo</label>
            <select name="capo" value={formData.capo} onChange={handleChange}
              className="w-full px-4 py-2 bg-black border border-gray-700 rounded-lg text-white">
              <option value="">唔用</option>
              {[1,2,3,4,5,6,7,8,9,10,11].map(n => <option key={n} value={n}>Capo {n}</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-white mb-1">彈奏調性</label>
            <select name="playKey" value={formData.playKey} onChange={handleChange}
              className="w-full px-4 py-2 bg-black border border-gray-700 rounded-lg text-white">
              <option value="">同原調</option>
              <optgroup label="Major">
                {['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map(k => <option key={k} value={k}>{k}</option>)}
              </optgroup>
              <optgroup label="Minor">
                {['Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'].map(k => <option key={k} value={k}>{k}</option>)}
              </optgroup>
            </select>
          </div>
        </div>
        
        {/* 演奏技巧 */}
        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">掃弦節奏</label>
            <textarea name="strummingPattern" value={formData.strummingPattern} onChange={handleChange}
              placeholder="例如：↓ ↓↑ ↓↑ ↓↑" rows={2}
              className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">指法提示</label>
            <textarea name="fingeringTips" value={formData.fingeringTips} onChange={handleChange}
              placeholder="例如：副歌可以用Power Chord..." rows={2}
              className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm" />
          </div>
        </div>
      </div>
    ),
    
    youtube: (
      <div className="space-y-4 pt-4">
        {/* YouTube 搜尋按鈕 */}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setYouTubeAutoSelect(false); setIsYouTubeModalOpen(true); }}
            disabled={!formData.artist || !formData.title}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 text-sm">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
            </svg>
            站內搜尋
          </button>
          <button type="button" onClick={() => { setYouTubeAutoSelect(true); setIsYouTubeModalOpen(true); }}
            disabled={!formData.artist || !formData.title}
            className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] text-black rounded-lg hover:bg-yellow-400 transition disabled:opacity-50 text-sm font-medium">
            快速添加
          </button>
        </div>
        
        {/* YouTube URL 輸入 */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">YouTube 連結</label>
          <input type="url" name="youtubeUrl" value={formData.youtubeUrl} onChange={handleChange}
            placeholder="貼上 YouTube 連結..."
            className="w-full px-4 py-2 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500" />
        </div>
        
        {/* 預覽 */}
        {formData.youtubeVideoId && (
          <div>
            <p className="text-xs text-green-400 mb-2">✓ Video ID: {formData.youtubeVideoId}</p>
            <div className="aspect-video max-w-sm">
              <iframe width="100%" height="100%" 
                src={`https://www.youtube.com/embed/${formData.youtubeVideoId}`}
                title="YouTube preview" frameBorder="0" allowFullScreen className="rounded-lg" />
            </div>
          </div>
        )}
      </div>
    ),
    
    content: (
      <div className="space-y-3 pt-4">
        {/* 譜顯示字體設定 */}
        <div className="bg-[#1a1a1a] rounded-lg p-3 border border-[#FFD700]/30">
          <div className="flex items-center justify-between">
            <label className="text-sm text-[#FFD700] font-medium">此譜顯示字體</label>
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
              ? 'Arial：適合從其他網站複製過來嘅譜（推薦）' 
              : '等寬字體：傳統結他譜顯示方式'}
          </p>
        </div>

        {/* 編輯字體模式（只影響編輯時） */}
        <div className="bg-[#1a1a1a] rounded-lg p-3 border border-gray-800">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">編輯字體模式</label>
            <div className="flex items-center gap-2 bg-black rounded-lg p-1">
              <button
                type="button"
                onClick={() => {
                  setFontMode('mono');
                  localStorage.setItem('tabFontMode', 'mono');
                }}
                className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                  fontMode === 'mono' 
                    ? 'bg-gray-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                等寬
              </button>
              <button
                type="button"
                onClick={() => {
                  setFontMode('arial');
                  localStorage.setItem('tabFontMode', 'arial');
                }}
                className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                  fontMode === 'arial' 
                    ? 'bg-gray-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Arial
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-white">譜內容 <span className="text-[#FFD700]">*</span></label>
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
            <button type="button" onClick={insertTemplate} className="text-sm text-[#FFD700] hover:opacity-80">
              插入空白模板
            </button>
          </div>
        </div>
        <textarea name="content" value={formData.content} onChange={handleChange}
          onPaste={(e) => {
            e.preventDefault();
            const pastedText = e.clipboardData.getData('text');
            // 清理空格（只清行尾）
            const cleaned = cleanPastedText(pastedText);
            // Arial 模式下唔壓縮空格，等寬模式先壓縮
            const processed = autoFixTabFormatWithFactor(cleaned, alignFactor, formData.displayFont !== 'arial');
            const textarea = e.target;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const currentValue = formData.content;
            const newValue = currentValue.substring(0, start) + processed + currentValue.substring(end);
            setFormData(prev => ({ ...prev, content: newValue }));
          }}
          placeholder="在這裡貼上你的結他譜...&#10;提示：Paste 時會自動修正對齊，或者貼上後按「自動修正對齊」按鈕" rows={15}
          className={`w-full px-4 py-2 bg-black border rounded-lg text-white text-sm ${errors.content ? 'border-red-500' : 'border-gray-700'} ${formData.displayFont === 'arial' ? 'font-sans' : 'font-mono'}`} 
          style={formData.displayFont === 'arial' ? { fontFamily: 'Arial, Helvetica, sans-serif' } : {}} />
        {errors.content && <p className="text-sm text-red-400">{errors.content}</p>}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <svg className="w-4 h-4 text-[#FFD700]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>貼上時會自動修正對齊。有 | 會保留，冇 | 會保持原樣，淨係調整空格對齊和弦同歌詞。</span>
        </div>
      </div>
    ),
    
    uploader: (
      <div className="space-y-3 pt-4">
        <div>
          <label className="block text-sm font-medium text-white mb-1">上傳者筆名</label>
          <input type="text" name="uploaderPenName" value={formData.uploaderPenName} onChange={handleChange}
            placeholder="例如：Kermit、結他小王子"
            className="w-full px-4 py-2 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500" />
          <p className="mt-1 text-xs text-gray-500">這份譜是由誰編寫的，會顯示為「編譜：xxx」</p>
        </div>
      </div>
    ),
    
    cover: (
      <div className="space-y-4 pt-4">
        {/* 封面圖片選擇 */}
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
    ),
    
    spotify: (
      <div className="space-y-4 pt-4">
        <button type="button" onClick={handleSearchSpotify}
          disabled={!formData.artist && !formData.title}
          className="flex items-center gap-2 px-4 py-2 bg-[#1DB954] text-white rounded-lg hover:bg-[#1ed760] transition disabled:opacity-50">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02z"/>
          </svg>
          從 Spotify 搜尋
        </button>
        
        {formData.spotifyTrackId && (
          <div className="p-4 bg-[#1a1a1a] border border-[#1DB954] rounded-lg">
            <h4 className="text-[#1DB954] font-medium mb-3">✓ 已從 Spotify 獲取：</h4>
            {formData.albumImage && <img src={formData.albumImage} alt={formData.album} className="w-24 h-24 rounded object-cover mb-3" />}
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-500">歌手：</span><span className="text-white">{formData.artist}</span></p>
              <p><span className="text-gray-500">歌名：</span><span className="text-white">{formData.title}</span></p>
              {formData.album && <p><span className="text-gray-500">專輯：</span><span className="text-white">{formData.album}</span></p>}
              {formData.songYear && <p><span className="text-gray-500">年份：</span><span className="text-white">{formData.songYear}</span></p>}
            </div>
          </div>
        )}
      </div>
    )
  }

  const sectionTitles = {
    basic: '基本資訊（歌名、歌手、歌曲資料）',
    spotify: 'Spotify 歌曲資訊',
    key: '調性與彈法（Key、Capo、技巧）',
    youtube: 'YouTube 影片',
    content: '譜內容',
    uploader: '上傳者筆名',
    cover: '封面圖片設定'
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Link href="/" className="inline-flex items-center text-gray-400 hover:text-white mr-4 transition">
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回
          </Link>
          <h1 className="text-2xl font-bold text-white">上傳新譜</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 可拖放的區塊 */}
          <div className="space-y-3">
            {sectionOrder.map((sectionId, index) => (
              <div
                key={sectionId}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`transition-opacity ${draggedItem === index ? 'opacity-50' : 'opacity-100'}`}
              >
                <DraggableSection
                  id={sectionId}
                  title={sectionTitles[sectionId]}
                  isExpanded={expandedSections[sectionId]}
                  onToggle={() => toggleSection(sectionId)}
                  isDark={true}
                >
                  {sectionContents[sectionId]}
                </DraggableSection>
              </div>
            ))}
          </div>

          {/* 提示文字 */}
          <div className="flex items-center gap-2 text-sm text-gray-500 px-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>拖動左邊的圖示可以調整區塊順序，點擊標題可以展開/收合</span>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center space-x-4 pt-4">
            <button type="submit" disabled={isSubmitting}
              className="flex-1 bg-[#FFD700] text-black py-3 px-6 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50">
              {isSubmitting ? '上傳中...' : '上傳譜'}
            </button>
            <Link href="/" className="px-6 py-3 border border-gray-700 rounded-lg font-medium text-gray-400 hover:text-white hover:border-[#FFD700] transition">
              取消
            </Link>
          </div>
        </form>
      </div>
      
      {/* Modals */}
      <YouTubeSearchModal
        isOpen={isYouTubeModalOpen}
        onClose={() => setIsYouTubeModalOpen(false)}
        artistName={formData.artist}
        songTitle={formData.title}
        autoSelectFirst={youTubeAutoSelect}
        onSelect={(url) => {
          const videoId = extractYouTubeVideoId(url);
          setFormData(prev => ({ ...prev, youtubeUrl: url, youtubeVideoId: videoId }));
        }}
      />
      
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

import { useState, useEffect, useRef } from 'react'
import Layout from '@/components/Layout'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore'
import { Search, Download, RefreshCw, Image as ImageIcon } from 'lucide-react'

const loadHtml2Canvas = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Not in browser'))
      return
    }
    if (window.html2canvas) {
      resolve(window.html2canvas)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    script.onload = () => resolve(window.html2canvas)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

// 主題配置
const THEMES = {
  gray: {
    name: '灰色',
    bg: 'linear-gradient(135deg, #c5c5c5 0%, #e8e8e8 50%, #d0d0d0 100%)',
    textColor: '#333',
    lyricBg: '#ffffff',
    chordColor: '#666'
  },
  warm: {
    name: '暖色',
    bg: 'linear-gradient(135deg, #d4a574 0%, #f5e6d3 50%, #e8c4a0 100%)',
    textColor: '#4a3728',
    lyricBg: '#fffaf5',
    chordColor: '#8b6914'
  },
  cool: {
    name: '冷色',
    bg: 'linear-gradient(135deg, #7a9eb8 0%, #c5d8e8 50%, #a8c4d9 100%)',
    textColor: '#2c4a5e',
    lyricBg: '#f0f7ff',
    chordColor: '#4a6b7c'
  },
  dark: {
    name: '深色',
    bg: 'linear-gradient(135deg, #2a2a2a 0%, #4a4a4a 50%, #333333 100%)',
    textColor: '#fff',
    lyricBg: '#1a1a1a',
    chordColor: '#ccc'
  }
}

export default function TabShareTool() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedTab, setSelectedTab] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedTheme, setSelectedTheme] = useState('gray')
  
  const [selectedChords, setSelectedChords] = useState([])
  const [selectedLyrics, setSelectedLyrics] = useState([])
  
  const previewRef = useRef(null)
  const [html2canvasLoaded, setHtml2canvasLoaded] = useState(false)

  useEffect(() => {
    loadHtml2Canvas().then(() => setHtml2canvasLoaded(true)).catch(console.error)
  }, [])

  const searchTabs = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const tabsQuery = query(
        collection(db, 'tabs'),
        where('title', '>=', searchQuery),
        where('title', '<=', searchQuery + '\uf8ff'),
        limit(10)
      )
      const snapshot = await getDocs(tabsQuery)
      setSearchResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const selectTab = async (tab) => {
    try {
      const tabDoc = await getDoc(doc(db, 'tabs', tab.id))
      if (tabDoc.exists()) {
        const data = tabDoc.data()
        const parsed = parseTabContent(data.content)
        setSelectedTab({ ...data, id: tab.id, parsedContent: parsed })
        
        // 默認選前2行和弦 + 前4-5行歌詞
        setSelectedChords(parsed.chords.slice(0, 2))
        setSelectedLyrics(parsed.lyrics.slice(0, 5))
      }
    } catch (error) {
      console.error('Error loading tab:', error)
    }
  }

  const parseTabContent = (content) => {
    if (!content) return { chords: [], lyrics: [] }
    const lines = content.split('\n')
    const chords = []
    const lyrics = []
    
    lines.forEach(line => {
      const trimmed = line.trim()
      if (!trimmed) return
      if (trimmed.match(/[A-G][#b]?(m|maj|min|sus|add|dim|aug)?[0-9]?/) && 
          (trimmed.includes('|') || trimmed.match(/^[\sA-G#bmsusadddimaug0-9\/|\-]+$/))) {
        chords.push(trimmed)
      } else if (!trimmed.match(/^(Intro|Verse|Chorus|Bridge|Outro|Pre-Chorus|Solo|\[|\()/i)) {
        lyrics.push(trimmed)
      }
    })
    return { chords, lyrics }
  }

  const generateImage = async () => {
    if (!previewRef.current || !html2canvasLoaded) return
    setIsGenerating(true)
    try {
      const html2canvas = window.html2canvas
      const canvas = await html2canvas(previewRef.current, {
        scale: 2.16,
        useCORS: true,
        allowTaint: true
      })
      const link = document.createElement('a')
      link.download = `${selectedTab.title}-${selectedTab.artist}-polygon.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (error) {
      console.error('Generate error:', error)
      alert('生成圖片失敗')
    } finally {
      setIsGenerating(false)
    }
  }

  const getArtistImage = () => {
    if (!selectedTab) return null
    return selectedTab.thumbnail || selectedTab.albumImage || 
           (selectedTab.youtubeUrl ? `https://img.youtube.com/vi/${extractYouTubeId(selectedTab.youtubeUrl)}/hqdefault.jpg` : null)
  }

  const extractYouTubeId = (url) => {
    if (!url) return null
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
    const match = url.match(regExp)
    return (match && match[2].length === 11) ? match[2] : null
  }

  const theme = THEMES[selectedTheme]

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8 pb-24">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">📱 樂譜分享圖片生成器</h1>
          <p className="text-gray-400">製作 Instagram 分享圖片</p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* 左側設定 */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedTab ? (
              <div className="bg-[#121212] rounded-xl border border-gray-800 p-6">
                <h2 className="text-xl font-bold text-white mb-6">搜索樂譜</h2>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchTabs()}
                    placeholder="輸入歌名或歌手..."
                    className="flex-1 px-4 py-3 bg-black border border-gray-700 rounded-lg text-white"
                  />
                  <button
                    onClick={searchTabs}
                    disabled={isSearching}
                    className="px-6 py-3 bg-[#FFD700] text-black rounded-lg font-bold"
                  >
                    {isSearching ? '...' : '搜索'}
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-6 space-y-2">
                    {searchResults.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => selectTab(tab)}
                        className="w-full text-left p-4 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center gap-4"
                      >
                        <img src={tab.thumbnail || `https://img.youtube.com/vi/${extractYouTubeId(tab.youtubeUrl)}/default.jpg`} className="w-16 h-16 rounded object-cover" />
                        <div>
                          <p className="text-white font-bold">{tab.title}</p>
                          <p className="text-gray-400">{tab.artist}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* 主題選擇 */}
                <div className="bg-[#121212] rounded-xl border border-gray-800 p-4">
                  <h3 className="text-white font-bold mb-3">選擇主題顏色</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(THEMES).map(([key, t]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedTheme(key)}
                        className={`p-3 rounded-lg text-sm font-medium transition ${
                          selectedTheme === key 
                            ? 'bg-[#FFD700] text-black' 
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 和弦選擇 - 2行 */}
                <div className="bg-[#121212] rounded-xl border border-gray-800 p-4">
                  <h3 className="text-white font-bold mb-3">選擇和弦（2行）</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedTab.parsedContent?.chords?.map((chord, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          if (selectedChords.includes(chord)) {
                            setSelectedChords(selectedChords.filter(c => c !== chord))
                          } else if (selectedChords.length < 2) {
                            setSelectedChords([...selectedChords, chord])
                          }
                        }}
                        className={`w-full text-left p-2 rounded text-sm font-mono transition ${
                          selectedChords.includes(chord)
                            ? 'bg-[#FFD700]/20 text-[#FFD700]'
                            : selectedChords.length >= 2 
                              ? 'text-gray-600 cursor-not-allowed'
                              : 'text-gray-400 hover:bg-gray-800'
                        }`}
                      >
                        {chord}
                      </button>
                    ))}
                  </div>
                  <p className="text-gray-500 text-xs mt-2">已選 {selectedChords.length}/2 行</p>
                </div>

                {/* 歌詞選擇 - 多行，自動縮小字 */}
                <div className="bg-[#121212] rounded-xl border border-gray-800 p-4">
                  <h3 className="text-white font-bold mb-3">選擇歌詞（多行，不換行）</h3>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {selectedTab.parsedContent?.lyrics?.map((lyric, idx) => {
                      const isSelected = selectedLyrics.includes(lyric)
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedLyrics(selectedLyrics.filter(l => l !== lyric))
                            } else {
                              setSelectedLyrics([...selectedLyrics, lyric])
                            }
                          }}
                          className={`w-full text-left p-2 rounded text-sm transition ${
                            isSelected ? 'bg-[#FFD700]/20 text-[#FFD700]' : 'text-gray-400 hover:bg-gray-800'
                          }`}
                        >
                          {isSelected ? '☑ ' : '☐ '}{lyric.length > 20 ? lyric.substring(0, 20) + '...' : lyric}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-gray-500 text-xs mt-2">已選 {selectedLyrics.length} 行（字會自動縮小以適應一行）</p>
                </div>

                <button
                  onClick={generateImage}
                  disabled={isGenerating}
                  className="w-full py-4 bg-[#FFD700] text-black rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  {isGenerating ? <><RefreshCw className="animate-spin" /> 生成中...</> : <><Download /> 下載</>}
                </button>
              </>
            )}
          </div>

          {/* 右側預覽 */}
          <div className="lg:col-span-3">
            <h2 className="text-lg font-bold text-white mb-4">預覽</h2>
            
            {selectedTab ? (
              <div className="flex justify-center">
                {/* 正方形 1:1 */}
                <div 
                  ref={previewRef}
                  className="relative w-[500px] h-[500px] overflow-hidden"
                  style={{ 
                    fontFamily: "'Noto Sans TC', 'Microsoft JhengHei', sans-serif",
                    background: theme.bg
                  }}
                >
                  {/* 頂部：兩行和弦（正中間，無框） */}
                  {selectedChords.length > 0 && (
                    <div className="absolute top-[6%] left-0 right-0 text-center">
                      {selectedChords.slice(0, 2).map((chord, idx) => (
                        <p 
                          key={idx}
                          className="font-mono tracking-widest mb-1"
                          style={{ 
                            fontSize: '15px', 
                            letterSpacing: '0.12em',
                            color: theme.chordColor
                          }}
                        >
                          {chord}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* 中間：正方形照片 + 白色歌詞（無間隙） */}
                  <div 
                    className="absolute left-[8%] right-[8%] flex"
                    style={{ top: '20%', height: '52%' }}
                  >
                    {/* 左：正方形照片 */}
                    <div 
                      className="h-full aspect-square bg-cover bg-center"
                      style={{ 
                        backgroundImage: getArtistImage() ? `url(${getArtistImage()})` : 'none',
                        backgroundColor: '#333'
                      }}
                    />
                    
                    {/* 右：白色背景歌詞（同高度，緊貼照片） */}
                    <div 
                      className="flex-1 h-full flex items-center justify-center px-4"
                      style={{ backgroundColor: theme.lyricBg }}
                    >
                      {selectedLyrics.length > 0 ? (
                        <div className="space-y-1 w-full">
                          {selectedLyrics.map((lyric, idx) => (
                            <p 
                              key={idx} 
                              className="text-center whitespace-nowrap overflow-hidden"
                              style={{ 
                                fontSize: lyric.length > 15 ? Math.max(10, 16 - (lyric.length - 15) * 0.3) + 'px' : '16px',
                                lineHeight: '1.3',
                                color: '#333'
                              }}
                            >
                              {lyric}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: '#999' }}>選擇歌詞</p>
                      )}
                    </div>
                  </div>

                  {/* 底部：歌名 + 歌手 */}
                  <div 
                    className="absolute left-0 right-0 text-center"
                    style={{ bottom: '10%' }}
                  >
                    <h3 
                      className="font-bold mb-1"
                      style={{ fontSize: '26px', color: theme.textColor }}
                    >
                      {selectedTab.title}
                    </h3>
                    <p 
                      style={{ fontSize: '14px', color: theme.textColor, opacity: 0.8 }}
                    >
                      {selectedTab.artist}
                    </p>
                  </div>

                  {/* 最底部：Logo + IG */}
                  <div 
                    className="absolute left-0 right-0 flex items-center justify-between px-8"
                    style={{ bottom: '3%' }}
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" 
                              stroke={theme.textColor} strokeWidth="2" fill="none"/>
                      </svg>
                      <span 
                        className="text-xs font-bold tracking-wide"
                        style={{ color: theme.textColor }}
                      >
                        POLYGON
                      </span>
                    </div>
                    <span 
                      className="text-xs"
                      style={{ color: theme.textColor, opacity: 0.7 }}
                    >
                      @polygonguitar
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-[500px] h-[500px] bg-[#121212] rounded-xl border border-gray-800 flex items-center justify-center mx-auto">
                <p className="text-gray-500">選擇樂譜後預覽</p>
              </div>
            )}
            
            <p className="text-gray-500 text-sm text-center mt-4">1080 x 1080px</p>
          </div>
        </div>
      </div>
    </Layout>
  )
}

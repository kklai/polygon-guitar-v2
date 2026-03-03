import { useState, useEffect, useRef } from 'react'
import Layout from '@/components/Layout'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore'
import { Search, Download, RefreshCw, Image as ImageIcon, Type, ChevronLeft, ChevronRight } from 'lucide-react'

// 加載 html2canvas
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

export default function TabShareTool() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedTab, setSelectedTab] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  
  // 內容選擇
  const [selectedChords, setSelectedChords] = useState([])
  const [selectedLyrics, setSelectedLyrics] = useState([])
  const [chordsPage, setChordsPage] = useState(0)
  const [lyricsPage, setLyricsPage] = useState(0)
  const [linesPerPage, setLinesPerPage] = useState(6)
  
  const previewRef = useRef(null)
  const [html2canvasLoaded, setHtml2canvasLoaded] = useState(false)

  useEffect(() => {
    loadHtml2Canvas().then(() => {
      setHtml2canvasLoaded(true)
    }).catch(console.error)
  }, [])

  // 搜索樂譜
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
      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      setSearchResults(results)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  // 選擇樂譜
  const selectTab = async (tab) => {
    try {
      const tabDoc = await getDoc(doc(db, 'tabs', tab.id))
      if (tabDoc.exists()) {
        const data = tabDoc.data()
        const parsed = parseTabContent(data.content)
        
        setSelectedTab({
          ...data,
          id: tab.id,
          parsedContent: parsed
        })
        
        // 默認選擇第一組和弦和前幾行歌詞
        if (parsed.chords.length > 0) {
          setSelectedChords([parsed.chords[0]])
        }
        if (parsed.lyrics.length > 0) {
          setSelectedLyrics(parsed.lyrics.slice(0, linesPerPage))
        }
        setChordsPage(0)
        setLyricsPage(0)
      }
    } catch (error) {
      console.error('Error loading tab:', error)
    }
  }

  // 解析樂譜內容
  const parseTabContent = (content) => {
    if (!content) return { chords: [], lyrics: [] }
    
    const lines = content.split('\n')
    const chords = []
    const lyrics = []
    
    let currentSection = []
    let isChordSection = false
    
    lines.forEach(line => {
      const trimmed = line.trim()
      if (!trimmed) return
      
      // 檢測是否為和弦行
      if (trimmed.match(/[A-G][#b]?(m|maj|min|sus|add|dim|aug)?[0-9]?/) && 
          (trimmed.includes('|') || trimmed.match(/^[\sA-G#bmsusadddimaug0-9\/|\-]+$/))) {
        if (!isChordSection && currentSection.length > 0) {
          // 保存之前的歌詞
          lyrics.push(...currentSection)
          currentSection = []
        }
        isChordSection = true
        chords.push(trimmed)
      } else if (!trimmed.match(/^(Intro|Verse|Chorus|Bridge|Outro|Pre-Chorus|Solo|\[|\()/i)) {
        // 非標記行的視為歌詞
        if (isChordSection) {
          isChordSection = false
        }
        lyrics.push(trimmed)
      }
    })
    
    return { chords, lyrics }
  }

  // 切換和弦選擇
  const toggleChord = (chord) => {
    if (selectedChords.includes(chord)) {
      setSelectedChords(selectedChords.filter(c => c !== chord))
    } else {
      setSelectedChords([...selectedChords, chord])
    }
  }

  // 切換歌詞選擇
  const toggleLyric = (lyric) => {
    if (selectedLyrics.includes(lyric)) {
      setSelectedLyrics(selectedLyrics.filter(l => l !== lyric))
    } else {
      setSelectedLyrics([...selectedLyrics, lyric])
    }
  }

  // 獲取當前頁的歌詞
  const getCurrentPageLyrics = () => {
    if (!selectedTab?.parsedContent?.lyrics) return []
    const start = lyricsPage * linesPerPage
    return selectedTab.parsedContent.lyrics.slice(start, start + linesPerPage)
  }

  // 獲取背景圖
  const getArtistImage = () => {
    if (!selectedTab) return null
    return selectedTab.thumbnail || selectedTab.albumImage || 
           (selectedTab.youtubeUrl ? `https://img.youtube.com/vi/${extractYouTubeId(selectedTab.youtubeUrl)}/mqdefault.jpg` : null)
  }

  const extractYouTubeId = (url) => {
    if (!url) return null
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
    const match = url.match(regExp)
    return (match && match[2].length === 11) ? match[2] : null
  }

  // 生成圖片
  const generateImage = async () => {
    if (!previewRef.current || !html2canvasLoaded) return
    
    setIsGenerating(true)
    try {
      const html2canvas = window.html2canvas
      const canvas = await html2canvas(previewRef.current, {
        scale: 2.7,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      })
      
      const link = document.createElement('a')
      link.download = `${selectedTab.title}-${selectedTab.artist}-polygon.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (error) {
      console.error('Generate error:', error)
      alert('生成圖片失敗，請重試')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8 pb-24">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">📱 樂譜分享圖片生成器</h1>
          <p className="text-gray-400">選擇和弦與歌詞，製作精美的 Instagram 分享圖片</p>
        </div>

        {!selectedTab ? (
          /* 搜索界面 */
          <div className="max-w-xl mx-auto">
            <div className="bg-[#121212] rounded-xl border border-gray-800 p-8">
              <h2 className="text-xl font-bold text-white mb-6 text-center">搜索樂譜</h2>
              
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchTabs()}
                  placeholder="輸入歌名或歌手..."
                  className="flex-1 px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#FFD700] focus:outline-none"
                />
                <button
                  onClick={searchTabs}
                  disabled={isSearching}
                  className="px-6 py-3 bg-[#FFD700] text-black rounded-lg font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {isSearching ? '...' : '搜索'}
                </button>
              </div>
              
              {/* 搜索結果 */}
              {searchResults.length > 0 && (
                <div className="mt-6 space-y-2">
                  <p className="text-gray-400 text-sm mb-3">選擇一首歌曲：</p>
                  {searchResults.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => selectTab(tab)}
                      className="w-full text-left p-4 rounded-lg bg-gray-800 hover:bg-gray-700 transition flex items-center gap-4"
                    >
                      <img 
                        src={tab.thumbnail || `https://img.youtube.com/vi/${extractYouTubeId(tab.youtubeUrl)}/default.jpg`} 
                        alt=""
                        className="w-16 h-16 rounded object-cover bg-gray-700"
                      />
                      <div>
                        <p className="text-white font-bold">{tab.title}</p>
                        <p className="text-gray-400">{tab.artist}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 編輯界面 */
          <div className="grid lg:grid-cols-5 gap-6">
            {/* 左側：內容選擇 */}
            <div className="lg:col-span-2 space-y-6">
              {/* 歌曲信息 */}
              <div className="bg-[#121212] rounded-xl border border-gray-800 p-4">
                <div className="flex items-center gap-4">
                  <img 
                    src={getArtistImage()} 
                    alt=""
                    className="w-16 h-16 rounded object-cover"
                  />
                  <div className="flex-1">
                    <h3 className="text-white font-bold">{selectedTab.title}</h3>
                    <p className="text-gray-400 text-sm">{selectedTab.artist}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedTab(null)
                      setSelectedChords([])
                      setSelectedLyrics([])
                    }}
                    className="text-gray-400 hover:text-white text-sm"
                  >
                    重新選擇
                  </button>
                </div>
              </div>

              {/* 選擇和弦 */}
              {selectedTab.parsedContent?.chords?.length > 0 && (
                <div className="bg-[#121212] rounded-xl border border-gray-800 p-4">
                  <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                    <Type size={18} />
                    選擇和弦進行
                    <span className="text-gray-500 text-xs font-normal">({selectedChords.length} 已選)</span>
                  </h3>
                  
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedTab.parsedContent.chords.map((chord, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleChord(chord)}
                        className={`w-full text-left p-3 rounded-lg text-sm font-mono transition ${
                          selectedChords.includes(chord)
                            ? 'bg-[#FFD700]/20 border border-[#FFD700] text-[#FFD700]'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {chord}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 選擇歌詞 */}
              {selectedTab.parsedContent?.lyrics?.length > 0 && (
                <div className="bg-[#121212] rounded-xl border border-gray-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-bold flex items-center gap-2">
                      <Type size={18} />
                      選擇歌詞
                      <span className="text-gray-500 text-xs font-normal">({selectedLyrics.length} 行)</span>
                    </h3>
                    <select
                      value={linesPerPage}
                      onChange={(e) => setLinesPerPage(parseInt(e.target.value))}
                      className="bg-gray-800 text-white text-sm rounded px-2 py-1"
                    >
                      <option value={4}>4行</option>
                      <option value={6}>6行</option>
                      <option value={8}>8行</option>
                    </select>
                  </div>
                  
                  {/* 分頁 */}
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => setLyricsPage(Math.max(0, lyricsPage - 1))}
                      disabled={lyricsPage === 0}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-gray-400 text-xs">
                      第 {lyricsPage + 1} / {Math.ceil(selectedTab.parsedContent.lyrics.length / linesPerPage)} 頁
                    </span>
                    <button
                      onClick={() => setLyricsPage(Math.min(Math.ceil(selectedTab.parsedContent.lyrics.length / linesPerPage) - 1, lyricsPage + 1))}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                  
                  <div className="space-y-1">
                    {getCurrentPageLyrics().map((lyric, idx) => {
                      const isSelected = selectedLyrics.includes(lyric)
                      return (
                        <button
                          key={idx}
                          onClick={() => toggleLyric(lyric)}
                          className={`w-full text-left p-2 rounded text-sm transition ${
                            isSelected
                              ? 'bg-[#FFD700]/20 text-[#FFD700]'
                              : 'text-gray-400 hover:bg-gray-800'
                          }`}
                        >
                          <span className="mr-2">{isSelected ? '☑' : '☐'}</span>
                          {lyric.length > 30 ? lyric.substring(0, 30) + '...' : lyric}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 生成按鈕 */}
              <button
                onClick={generateImage}
                disabled={isGenerating || !html2canvasLoaded}
                className="w-full py-4 bg-[#FFD700] text-black rounded-xl font-bold text-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <><RefreshCw className="animate-spin" size={20} /> 生成中...</>
                ) : (
                  <><Download size={20} /> 下載分享圖片</>
                )}
              </button>
            </div>

            {/* 右側：預覽 */}
            <div className="lg:col-span-3">
              <h2 className="text-lg font-bold text-white mb-4">預覽</h2>
              
              <div className="flex justify-center">
                {/* Instagram 正方形 - 參考設計風格 */}
                <div 
                  ref={previewRef}
                  className="relative w-[400px] h-[400px] bg-white overflow-hidden"
                  style={{ fontFamily: "'Noto Sans TC', 'Microsoft JhengHei', sans-serif" }}
                >
                  {/* 主容器 - 左右分欄 */}
                  <div className="absolute inset-0 flex">
                    {/* 左側：照片區域 */}
                    <div className="w-[45%] relative">
                      {/* 歌手照片 */}
                      <div 
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ 
                          backgroundImage: getArtistImage() ? `url(${getArtistImage()})` : 'none',
                          backgroundColor: '#2a2a2a'
                        }}
                      />
                      
                      {/* 左側遮罩（讓文字更清晰） */}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/40" />
                      
                      {/* 和弦進行 - 放在左側上方 */}
                      {selectedChords.length > 0 && (
                        <div className="absolute top-4 left-4 right-4">
                          <div className="bg-white/95 rounded-lg p-3 shadow-lg">
                            <p className="text-gray-400 text-[10px] mb-1">和弦進行</p>
                            {selectedChords.slice(0, 2).map((chord, idx) => (
                              <p key={idx} className="text-gray-800 font-mono text-sm leading-tight">
                                {chord}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* 底部：歌曲名稱 */}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p className="text-white text-lg font-bold leading-tight drop-shadow-lg">
                          {selectedTab.title}
                        </p>
                        <p className="text-white/80 text-sm mt-1 drop-shadow">
                          {selectedTab.artist}
                        </p>
                      </div>
                    </div>
                    
                    {/* 右側：歌詞區域（白色背景） */}
                    <div className="w-[55%] bg-white p-5 flex flex-col">
                      {/* 歌詞內容 */}
                      <div className="flex-1 overflow-hidden">
                        {selectedLyrics.length > 0 ? (
                          <div className="space-y-3">
                            {selectedLyrics.slice(0, linesPerPage).map((lyric, idx) => (
                              <p key={idx} className="text-gray-800 text-base leading-relaxed">
                                {lyric}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-400 text-sm italic">選擇歌詞顯示於此</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* 底部欄 - Logo 和 IG */}
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-white/95 border-t border-gray-100 flex items-center justify-between px-4">
                    {/* Logo */}
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" 
                              stroke="#1a1a1a" strokeWidth="2" fill="none"/>
                      </svg>
                      <span className="text-gray-900 text-sm font-bold tracking-wide">POLYGON</span>
                    </div>
                    
                    {/* Instagram */}
                    <div className="text-gray-500 text-xs">
                      @polygonguitar
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="text-gray-500 text-sm text-center mt-4">
                尺寸：1080 x 1080px（Instagram 正方形）
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

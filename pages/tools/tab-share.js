import { useState, useEffect, useRef } from 'react'
import Layout from '@/components/Layout'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore'
import { Search, Download, RefreshCw, Image as ImageIcon } from 'lucide-react'

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
  
  // 內容選擇 - 最多2行和弦 + 2行歌詞
  const [selectedChords, setSelectedChords] = useState('')
  const [selectedLyrics, setSelectedLyrics] = useState([])
  
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
        
        // 默認選擇第一個和弦行（最多2行）
        if (parsed.chords.length > 0) {
          const chordText = parsed.chords.slice(0, 2).join(' | ')
          setSelectedChords(chordText)
        }
        
        // 默認選擇前2行歌詞
        if (parsed.lyrics.length > 0) {
          setSelectedLyrics(parsed.lyrics.slice(0, 2))
        }
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
    
    lines.forEach(line => {
      const trimmed = line.trim()
      if (!trimmed) return
      
      // 檢測是否為和弦行
      if (trimmed.match(/[A-G][#b]?(m|maj|min|sus|add|dim|aug)?[0-9]?/) && 
          (trimmed.includes('|') || trimmed.match(/^[\sA-G#bmsusadddimaug0-9\/|\-]+$/))) {
        chords.push(trimmed)
      } else if (!trimmed.match(/^(Intro|Verse|Chorus|Bridge|Outro|Pre-Chorus|Solo|\[|\()/i)) {
        lyrics.push(trimmed)
      }
    })
    
    return { chords, lyrics }
  }

  // 生成圖片
  const generateImage = async () => {
    if (!previewRef.current || !html2canvasLoaded) return
    
    setIsGenerating(true)
    try {
      const html2canvas = window.html2canvas
      const canvas = await html2canvas(previewRef.current, {
        scale: 2.16, // 1080 / 500
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#000000'
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

  // 獲取背景圖
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

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8 pb-24">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">📱 樂譜分享圖片生成器</h1>
          <p className="text-gray-400">製作 Instagram 分享圖片（2行和弦 + 2行歌詞）</p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* 左側：內容選擇 */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedTab ? (
              /* 搜索界面 */
              <div className="bg-[#121212] rounded-xl border border-gray-800 p-6">
                <h2 className="text-xl font-bold text-white mb-6">搜索樂譜</h2>
                
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
            ) : (
              <>
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
                        setSelectedChords('')
                        setSelectedLyrics([])
                      }}
                      className="text-gray-400 hover:text-white text-sm"
                    >
                      重新選擇
                    </button>
                  </div>
                </div>

                {/* 選擇和弦 - 最多2行 */}
                {selectedTab.parsedContent?.chords?.length > 0 && (
                  <div className="bg-[#121212] rounded-xl border border-gray-800 p-4">
                    <h3 className="text-white font-bold mb-3">選擇和弦（最多2行）</h3>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {selectedTab.parsedContent.chords.slice(0, 4).map((chord, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            if (selectedChords === chord) {
                              setSelectedChords('')
                            } else {
                              setSelectedChords(chord)
                            }
                          }}
                          className={`w-full text-left p-3 rounded-lg text-sm font-mono transition ${
                            selectedChords === chord
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

                {/* 選擇歌詞 - 最多2行 */}
                {selectedTab.parsedContent?.lyrics?.length > 0 && (
                  <div className="bg-[#121212] rounded-xl border border-gray-800 p-4">
                    <h3 className="text-white font-bold mb-3">選擇歌詞（最多2行）</h3>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {selectedTab.parsedContent.lyrics.map((lyric, idx) => {
                        const isSelected = selectedLyrics.includes(lyric)
                        const canSelect = isSelected || selectedLyrics.length < 2
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedLyrics(selectedLyrics.filter(l => l !== lyric))
                              } else if (canSelect) {
                                setSelectedLyrics([...selectedLyrics, lyric])
                              }
                            }}
                            disabled={!canSelect && !isSelected}
                            className={`w-full text-left p-2 rounded text-sm transition ${
                              isSelected
                                ? 'bg-[#FFD700]/20 text-[#FFD700]'
                                : canSelect
                                  ? 'text-gray-400 hover:bg-gray-800'
                                  : 'text-gray-600 cursor-not-allowed'
                            }`}
                          >
                            <span className="mr-2">{isSelected ? '☑' : selectedLyrics.length >= 2 ? '☐' : '☐'}</span>
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
              </>
            )}
          </div>

          {/* 右側：預覽 */}
          <div className="lg:col-span-3">
            <h2 className="text-lg font-bold text-white mb-4">預覽</h2>
            
            {selectedTab ? (
              <div className="flex justify-center">
                {/* Instagram 正方形 1:1 */}
                <div 
                  ref={previewRef}
                  className="relative w-[500px] h-[500px] overflow-hidden bg-black"
                  style={{ fontFamily: "'Noto Sans TC', 'Microsoft JhengHei', sans-serif" }}
                >
                  {/* 上方：和弦行（置中，白底） */}
                  {selectedChords && (
                    <div className="absolute top-[8%] left-1/2 transform -translate-x-1/2 z-30">
                      <div className="bg-white/95 rounded-lg px-6 py-2 shadow-lg">
                        <p className="text-gray-500 text-[10px] mb-0.5 text-center">和弦進行</p>
                        <p className="text-gray-900 font-mono text-base tracking-wider text-center whitespace-nowrap">
                          {selectedChords}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 中間區域：照片 + 歌詞 */}
                  <div className="absolute top-[22%] left-[5%] right-[5%] h-[56%] flex gap-4">
                    {/* 左側：正方形歌手相 */}
                    <div 
                      className="w-1/2 h-full bg-cover bg-center rounded-sm"
                      style={{ 
                        backgroundImage: getArtistImage() ? `url(${getArtistImage()})` : 'none',
                        backgroundColor: '#1a1a1a'
                      }}
                    />
                    
                    {/* 右側：白色背景歌詞（同高度） */}
                    <div className="w-1/2 h-full bg-white flex items-center justify-center p-4">
                      {selectedLyrics.length > 0 ? (
                        <div className="space-y-3 w-full">
                          {selectedLyrics.slice(0, 2).map((lyric, idx) => (
                            <p 
                              key={idx} 
                              className="text-gray-900 text-center leading-relaxed"
                              style={{ 
                                fontSize: lyric.length > 20 ? '14px' : '16px',
                                lineHeight: '1.5'
                              }}
                            >
                              {lyric}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">選擇歌詞</p>
                      )}
                    </div>
                  </div>

                  {/* 下方：歌名 + 歌手 */}
                  <div className="absolute bottom-[12%] left-0 right-0 text-center z-20">
                    <h3 
                      className="text-white font-bold mb-1"
                      style={{ fontSize: '22px', textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}
                    >
                      {selectedTab.title}
                    </h3>
                    <p 
                      className="text-white/80"
                      style={{ fontSize: '13px', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
                    >
                      {selectedTab.artist}
                    </p>
                  </div>

                  {/* 底部：Logo + IG */}
                  <div className="absolute bottom-0 left-0 right-0 h-[10%] flex items-center justify-between px-6 z-20">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" 
                              stroke="#FFFFFF" strokeWidth="2" fill="none"/>
                      </svg>
                      <span className="text-white text-xs font-bold tracking-wide">POLYGON</span>
                    </div>
                    <div className="text-white/70 text-xs">@polygonguitar</div>
                  </div>

                  {/* 上下漸變遮罩 */}
                  <div className="absolute top-0 left-0 right-0 h-[22%] bg-gradient-to-b from-black/80 via-black/40 to-transparent z-10" />
                  <div className="absolute bottom-0 left-0 right-0 h-[22%] bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />
                </div>
              </div>
            ) : (
              <div className="w-[500px] h-[500px] bg-[#121212] rounded-xl border border-gray-800 flex items-center justify-center mx-auto">
                <div className="text-center text-gray-500">
                  <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
                  <p>選擇樂譜後預覽</p>
                </div>
              </div>
            )}
            
            <p className="text-gray-500 text-sm text-center mt-4">
              尺寸：1080 x 1080px（Instagram 正方形）
            </p>
          </div>
        </div>
      </div>
    </Layout>
  )
}

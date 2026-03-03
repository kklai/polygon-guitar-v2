import { useState, useEffect, useRef } from 'react'
import Layout from '@/components/Layout'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore'
import { Search, Download, RefreshCw, Upload, Settings2 } from 'lucide-react'

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

const THEMES = {
  gray: { name: '灰色', bg: '#e8e8e8', textColor: '#333', lyricBg: '#ffffff', chordColor: '#666', bottomBar: '#2a2a2a' },
  warm: { name: '暖色', bg: '#d4c4b0', textColor: '#4a3728', lyricBg: '#fffaf5', chordColor: '#8b6914', bottomBar: '#3d3020' },
  cool: { name: '冷色', bg: '#a8c4d9', textColor: '#2c4a5e', lyricBg: '#f0f7ff', chordColor: '#4a6b7c', bottomBar: '#1e3a4f' },
  dark: { name: '深色', bg: '#3a3a3a', textColor: '#fff', lyricBg: '#2a2a2a', chordColor: '#ccc', bottomBar: '#1a1a1a' }
}

export default function TabShareTool() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedTab, setSelectedTab] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedTheme, setSelectedTheme] = useState('gray')
  
  // 段落選擇（和弦+歌詞配對）
  const [selectedSection, setSelectedSection] = useState(null)
  
  // Logo上傳
  const [logoImage, setLogoImage] = useState(null)
  const [igHandle, setIgHandle] = useState('@polygonguitar')
  
  // 標記符號選擇
  const [markerType, setMarkerType] = useState('star') // 'star' | 'dot'
  
  // 布局自訂
  const [layoutConfig, setLayoutConfig] = useState({
    photoWidth: 200,      // 照片寬度 (px)
    photoLeft: 0,         // 照片左邊距 (%)
    sectionTop: 18,       // 照片+歌詞區域頂部位置 (%)
    sectionHeight: 55,    // 照片+歌詞區域高度 (%)
    lyricPadding: 20,     // 歌詞左右內邊距 (px)
    maxLyricLines: 4,     // 最大歌詞行數
    lyricFontSize: 16,    // 歌詞字體大小 (px)
    lyricLineHeight: 1.8, // 歌詞行距
    lyricSpacing: 16,     // 歌詞行之間的間距 (px)
    useUnifiedFont: true, // 是否統一字體大小
  })
  
  const [showLayoutSettings, setShowLayoutSettings] = useState(false)
  
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
        
        // 創建段落（和弦+歌詞配對）
        const sections = createSections(parsed.chords, parsed.lyrics)
        
        setSelectedTab({ 
          ...data, 
          id: tab.id, 
          parsedContent: parsed,
          sections
        })
        
        // 默認選第一個段落
        if (sections.length > 0) {
          setSelectedSection(sections[0])
        }
      }
    } catch (error) {
      console.error('Error loading tab:', error)
    }
  }

  // 解析樂譜
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

  // 創建段落（和弦+歌詞配對）
  const createSections = (chords, lyrics) => {
    const sections = []
    
    // 檢查是否為簡譜交錯格式（簡譜行包含數字和括號）
    const isNumericNotation = (line) => {
      if (!line) return false
      const digitCount = (line.match(/\d/g) || []).length
      const bracketCount = (line.match(/[()]/g) || []).length
      return digitCount >= 3 && bracketCount >= 2
    }
    
    // 如果 lyrics 都是簡譜格式，且數量與 chords 相近，使用交錯配對
    const allLyricsAreNotation = lyrics.every(isNumericNotation)
    const useInterleavedFormat = allLyricsAreNotation && Math.abs(chords.length - lyrics.length) <= 1
    
    if (useInterleavedFormat && chords.length > 0 && lyrics.length > 0) {
      // 交錯格式：每行和弦配對對應的簡譜行
      const count = Math.min(chords.length, lyrics.length)
      for (let i = 0; i < count; i++) {
        sections.push({
          id: i,
          chords: [chords[i]],
          lyrics: [lyrics[i]]
        })
      }
    } else {
      // 傳統格式：2行和弦 + 2行歌詞
      const maxPairs = Math.min(Math.floor(chords.length / 2), Math.floor(lyrics.length / 2))
      for (let i = 0; i < maxPairs; i++) {
        sections.push({
          id: i,
          chords: [chords[i * 2], chords[i * 2 + 1]].filter(Boolean),
          lyrics: [lyrics[i * 2], lyrics[i * 2 + 1]].filter(Boolean)
        })
      }
    }
    
    return sections
  }

  // 處理歌詞：提取字符並標記和弦位置
  const processLyricsWithMarkers = (lyric, chordLine) => {
    if (!lyric) return lyric
    
    // 提取和弦
    const chords = chordLine ? chordLine.match(/[A-G][#b]?(?:m|maj|min|sus|dim|aug|add|m7|7|9|11|13)?(?:\/[A-G][#b]?)?/g) || [] : []
    
    // 檢查是否為簡譜格式（包含括號內的數字）
    const hasBrackets = /\(\d/.test(lyric)
    
    if (hasBrackets && chords.length > 0) {
      // 簡譜格式：將括號替換為標記符號
      let chordIdx = 0
      return lyric.replace(/\((\d[^)]*)\)/g, (match, content) => {
        const marker = markerType === 'star' ? '✦' : '●'
        chordIdx++
        return marker + content
      })
    }
    
    if (chords.length === 0) return lyric
    
    // 普通歌詞：按字符數平均分配標記位置
    const chars = lyric.replace(/\s/g, '').split('')
    const charsPerChord = Math.max(1, Math.floor(chars.length / chords.length))
    
    let result = ''
    let charIdx = 0
    let chordIdx = 0
    
    for (let i = 0; i < lyric.length; i++) {
      const char = lyric[i]
      
      if (charIdx === chordIdx * charsPerChord && chordIdx < chords.length && char !== ' ') {
        const marker = markerType === 'star' ? '✦' : '●'
        result += marker
        chordIdx++
      }
      
      if (char !== ' ') charIdx++
      result += char
    }
    
    return result
  }

  // 上傳Logo
  const handleLogoUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setLogoImage(reader.result)
      reader.readAsDataURL(file)
    }
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

  // 計算統一字體大小
  const calculateUnifiedFontSize = (lyrics) => {
    if (!lyrics || lyrics.length === 0) return layoutConfig.lyricFontSize
    const maxLength = Math.max(...lyrics.map(l => l.length))
    return maxLength > 14 ? Math.max(11, layoutConfig.lyricFontSize - (maxLength - 14) * 0.4) : layoutConfig.lyricFontSize
  }

  // 獲取要顯示的歌詞行（限制行數）
  const getDisplayLyrics = () => {
    if (!selectedSection) return []
    return selectedSection.lyrics.slice(0, layoutConfig.maxLyricLines)
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8 pb-24">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">📱 樂譜分享圖片生成器</h1>
          <p className="text-gray-400">選擇段落（和弦+歌詞）生成分享圖</p>
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
                  <div className="mt-6 space-y-2 max-h-64 overflow-y-auto">
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
                  <h3 className="text-white font-bold mb-3">主題顏色</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(THEMES).map(([key, t]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedTheme(key)}
                        className={`p-3 rounded-lg text-sm font-medium ${selectedTheme === key ? 'bg-[#FFD700] text-black' : 'bg-gray-800 text-gray-300'}`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 標記符號選擇 */}
                <div className="bg-[#121212] rounded-xl border border-gray-800 p-4">
                  <h3 className="text-white font-bold mb-3">和弦標記</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setMarkerType('star')}
                      className={`p-3 rounded-lg text-sm font-medium ${markerType === 'star' ? 'bg-[#FFD700] text-black' : 'bg-gray-800 text-gray-300'}`}
                    >
                      ✦ 六角星
                    </button>
                    <button
                      onClick={() => setMarkerType('dot')}
                      className={`p-3 rounded-lg text-sm font-medium ${markerType === 'dot' ? 'bg-[#FFD700] text-black' : 'bg-gray-800 text-gray-300'}`}
                    >
                      ● 圓點
                    </button>
                  </div>
                </div>

                {/* 布局設定 */}
                <div className="bg-[#121212] rounded-xl border border-gray-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-bold">布局設定</h3>
                    <button 
                      onClick={() => setShowLayoutSettings(!showLayoutSettings)}
                      className="text-gray-400 hover:text-white"
                    >
                      <Settings2 size={18} />
                    </button>
                  </div>
                  
                  {showLayoutSettings && (
                    <div className="space-y-4 pt-3 border-t border-gray-700">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-gray-400 text-xs">照片寬度 (px)</label>
                          <input
                            type="number"
                            value={layoutConfig.photoWidth}
                            onChange={(e) => setLayoutConfig({...layoutConfig, photoWidth: parseInt(e.target.value) || 200})}
                            className="w-full mt-1 px-2 py-1 bg-gray-800 rounded text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs">最大行數</label>
                          <input
                            type="number"
                            min={1}
                            max={6}
                            value={layoutConfig.maxLyricLines}
                            onChange={(e) => setLayoutConfig({...layoutConfig, maxLyricLines: parseInt(e.target.value) || 4})}
                            className="w-full mt-1 px-2 py-1 bg-gray-800 rounded text-white text-sm"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-gray-400 text-xs">字體大小 (px)</label>
                          <input
                            type="number"
                            value={layoutConfig.lyricFontSize}
                            onChange={(e) => setLayoutConfig({...layoutConfig, lyricFontSize: parseInt(e.target.value) || 16})}
                            className="w-full mt-1 px-2 py-1 bg-gray-800 rounded text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs">行距</label>
                          <input
                            type="number"
                            step={0.1}
                            value={layoutConfig.lyricLineHeight}
                            onChange={(e) => setLayoutConfig({...layoutConfig, lyricLineHeight: parseFloat(e.target.value) || 1.8})}
                            className="w-full mt-1 px-2 py-1 bg-gray-800 rounded text-white text-sm"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-gray-400 text-xs">行間距 (px)</label>
                        <input
                          type="number"
                          value={layoutConfig.lyricSpacing}
                          onChange={(e) => setLayoutConfig({...layoutConfig, lyricSpacing: parseInt(e.target.value) || 16})}
                          className="w-full mt-1 px-2 py-1 bg-gray-800 rounded text-white text-sm"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="unifiedFont"
                          checked={layoutConfig.useUnifiedFont}
                          onChange={(e) => setLayoutConfig({...layoutConfig, useUnifiedFont: e.target.checked})}
                          className="rounded bg-gray-800 border-gray-600"
                        />
                        <label htmlFor="unifiedFont" className="text-gray-300 text-sm">統一字體大小</label>
                      </div>
                    </div>
                  )}
                </div>

                {/* 段落選擇（和弦+歌詞配對） */}
                <div className="bg-[#121212] rounded-xl border border-gray-800 p-4">
                  <h3 className="text-white font-bold mb-3">選擇段落（和弦+歌詞）</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedTab.sections?.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => setSelectedSection(section)}
                        className={`w-full p-3 rounded-lg text-left transition ${
                          selectedSection?.id === section.id 
                            ? 'bg-[#FFD700]/20 border border-[#FFD700]' 
                            : 'bg-gray-800 hover:bg-gray-700'
                        }`}
                      >
                        <div className="text-[#FFD700] font-mono text-xs mb-1 truncate">
                          {section.chords.join(' | ')}
                        </div>
                        <div className="text-gray-300 text-sm truncate">
                          {section.lyrics.join(' / ')}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logo上傳 */}
                <div className="bg-[#121212] rounded-xl border border-gray-800 p-4">
                  <h3 className="text-white font-bold mb-3">底部Logo</h3>
                  <div className="flex items-center gap-3 mb-3">
                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700">
                      <Upload size={18} />
                      <span className="text-sm">{logoImage ? '更換Logo' : '上傳Logo'}</span>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                    {logoImage && (
                      <button 
                        onClick={() => setLogoImage(null)}
                        className="px-3 py-3 text-red-400 hover:bg-red-900/20 rounded-lg"
                      >
                        移除
                      </button>
                    )}
                  </div>
                  {logoImage && <img src={logoImage} alt="Logo預覽" className="h-12 object-contain bg-gray-800 rounded p-2" />}
                  
                  <div className="mt-3">
                    <label className="text-gray-400 text-sm">Instagram帳號</label>
                    <input
                      type="text"
                      value={igHandle}
                      onChange={(e) => setIgHandle(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-gray-800 rounded text-white text-sm"
                      placeholder="@yourhandle"
                    />
                  </div>
                </div>

                <button
                  onClick={generateImage}
                  disabled={isGenerating || !selectedSection}
                  className="w-full py-4 bg-[#FFD700] text-black rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGenerating ? <><RefreshCw className="animate-spin" /> 生成中...</> : <><Download /> 下載圖片</>}
                </button>
              </>
            )}
          </div>

          {/* 右側預覽 */}
          <div className="lg:col-span-3">
            <h2 className="text-lg font-bold text-white mb-4">預覽 (500x500px)</h2>
            
            {selectedTab && selectedSection ? (
              <div className="flex justify-center">
                <div 
                  ref={previewRef}
                  className="relative overflow-hidden"
                  style={{ 
                    width: '500px',
                    height: '500px',
                    fontFamily: "'Noto Sans TC', 'Microsoft JhengHei', sans-serif",
                    backgroundColor: theme.bg
                  }}
                >
                  {/* 頂部：兩行和弦（正中間） */}
                  <div style={{ position: 'absolute', top: '5%', left: 0, right: 0, textAlign: 'center' }}>
                    {selectedSection.chords.slice(0, 2).map((chord, idx) => (
                      <p 
                        key={idx}
                        style={{ 
                          fontFamily: "'Source Code Pro', monospace",
                          fontSize: '16px', 
                          letterSpacing: '0.15em', 
                          color: theme.chordColor,
                          marginBottom: '4px'
                        }}
                      >
                        {chord}
                      </p>
                    ))}
                  </div>

                  {/* 中間：正方形照片 + 歌詞 */}
                  <div 
                    style={{ 
                      position: 'absolute',
                      top: `${layoutConfig.sectionTop}%`,
                      left: 0,
                      height: `${layoutConfig.sectionHeight}%`,
                      width: '100%',
                      display: 'flex'
                    }}
                  >
                    {/* 左：正方形照片 - 真正貼左 */}
                    <div 
                      style={{ 
                        width: `${layoutConfig.photoWidth}px`,
                        height: '100%',
                        position: 'relative',
                        flexShrink: 0
                      }}
                    >
                      {/* 照片背景 */}
                      <div 
                        style={{ 
                          position: 'absolute',
                          inset: 0,
                          backgroundImage: getArtistImage() ? `url(${getArtistImage()})` : 'none',
                          backgroundColor: '#333',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      />
                      {/* 頂部漸變 */}
                      <div 
                        style={{
                          position: 'absolute',
                          top: 0, left: 0, right: 0,
                          height: '30%',
                          background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)'
                        }}
                      />
                      {/* 底部漸變 */}
                      <div 
                        style={{
                          position: 'absolute',
                          bottom: 0, left: 0, right: 0,
                          height: '40%',
                          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)'
                        }}
                      />
                    </div>
                    
                    {/* 右：歌詞區域 - 剩餘寬度 */}
                    <div 
                      style={{ 
                        flex: 1,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        paddingLeft: `${layoutConfig.lyricPadding}px`,
                        paddingRight: `${layoutConfig.lyricPadding}px`,
                        backgroundColor: theme.lyricBg,
                        overflow: 'hidden'
                      }}
                    >
                      {(() => {
                        const displayLyrics = getDisplayLyrics()
                        const lyricCount = displayLyrics.length
                        const fontSize = layoutConfig.useUnifiedFont 
                          ? calculateUnifiedFontSize(displayLyrics)
                          : layoutConfig.lyricFontSize
                        
                        return displayLyrics.map((lyric, idx) => {
                          const correspondingChord = selectedSection.chords[Math.min(idx, selectedSection.chords.length - 1)]
                          const processedLyric = processLyricsWithMarkers(lyric, correspondingChord)
                          
                          return (
                            <p 
                              key={idx} 
                              style={{ 
                                fontSize: `${fontSize}px`,
                                color: '#333',
                                lineHeight: layoutConfig.lyricLineHeight,
                                marginBottom: idx < lyricCount - 1 ? `${layoutConfig.lyricSpacing}px` : '0',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                textAlign: 'center'
                              }}
                            >
                              {processedLyric}
                            </p>
                          )
                        })
                      })()}
                    </div>
                  </div>

                  {/* 底部：歌名 + 歌手 */}
                  <div 
                    style={{ 
                      position: 'absolute',
                      bottom: '12%',
                      left: 0, right: 0,
                      textAlign: 'center'
                    }}
                  >
                    <h3 style={{ fontSize: '28px', fontWeight: 'bold', color: theme.textColor, marginBottom: '4px' }}>
                      {selectedTab.title}
                    </h3>
                    <p style={{ fontSize: '14px', color: theme.textColor, opacity: 0.8 }}>
                      {selectedTab.artist}
                    </p>
                  </div>

                  {/* 最底部：深色BAR */}
                  <div 
                    style={{
                      position: 'absolute',
                      bottom: 0, left: 0, right: 0,
                      height: '8%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingLeft: '24px',
                      paddingRight: '24px',
                      backgroundColor: theme.bottomBar
                    }}
                  >
                    {/* Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {logoImage ? (
                        <img src={logoImage} alt="Logo" style={{ height: '24px', objectFit: 'contain' }} />
                      ) : (
                        <>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" 
                                  stroke="#fff" strokeWidth="2" fill="none"/>
                          </svg>
                          <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.05em' }}>POLYGON</span>
                        </>
                      )}
                    </div>
                    
                    {/* IG */}
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>{igHandle}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-[500px] h-[500px] bg-[#121212] rounded-xl border border-gray-800 flex items-center justify-center mx-auto">
                <p className="text-gray-500">{selectedTab ? '選擇段落' : '選擇樂譜'}</p>
              </div>
            )}
            
            <p className="text-gray-500 text-sm text-center mt-4">實際輸出: 1080 x 1080px</p>
          </div>
        </div>
      </div>
    </Layout>
  )
}

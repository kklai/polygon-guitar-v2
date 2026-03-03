import { useState, useEffect, useRef } from 'react'
import Layout from '@/components/Layout'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore'
import { Search, Download, RefreshCw, Image as ImageIcon, Type } from 'lucide-react'

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
  
  // 顯示設定
  const [showSettings, setShowSettings] = useState({
    showChords: true,
    showLyrics: true,
    showArtistImage: true,
    showLogo: true,
    showInstagramHandle: true,
    theme: 'dark'
  })
  
  // 樣式設定
  const [styleSettings, setStyleSettings] = useState({
    overlayOpacity: 70
  })
  
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
      // 搜索標題
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

  // 選擇樂譜並加載詳情
  const selectTab = async (tab) => {
    try {
      // 加載完整樂譜內容
      const tabDoc = await getDoc(doc(db, 'tabs', tab.id))
      if (tabDoc.exists()) {
        const data = tabDoc.data()
        
        // 解析內容，提取和弦行和歌詞
        const parsed = parseTabContent(data.content)
        
        setSelectedTab({
          ...data,
          id: tab.id,
          parsedContent: parsed
        })
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
      // 檢測是否為和弦行（包含 | 或常見和弦符號）
      if (line.match(/[A-G][#b]?(m|maj|min|sus|add|dim|aug)?[0-9]?/) && 
          (line.includes('|') || line.match(/^[\sA-G#bmsusadddimaug0-9\/]+$/))) {
        chords.push(line.trim())
      } else if (line.trim() && !line.startsWith('[') && !line.startsWith('(')) {
        // 視為歌詞行
        lyrics.push(line.trim())
      }
    })
    
    return {
      chords: chords.slice(0, 3),
      lyrics: lyrics.slice(0, 8)
    }
  }

  // 生成圖片
  const generateImage = async () => {
    if (!previewRef.current || !html2canvasLoaded) return
    
    setIsGenerating(true)
    try {
      const html2canvas = window.html2canvas
      const canvas = await html2canvas(previewRef.current, {
        scale: 2.7, // 1080px / 400px = 2.7
        useCORS: true,
        allowTaint: true,
        backgroundColor: null
      })
      
      // 下載
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
  const getBackgroundImage = () => {
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
      <div className="max-w-6xl mx-auto px-4 py-8 pb-24">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">📱 樂譜分享圖片生成器</h1>
          <p className="text-gray-400">將喜愛的樂譜製作成精美的 Instagram 分享圖片</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* 左側：設定區 */}
          <div className="space-y-6">
            {/* 搜索樂譜 */}
            <div className="bg-[#121212] rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Search size={20} />
                選擇樂譜
              </h2>
              
              <div className="flex gap-2">
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
                  className="px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {isSearching ? '...' : '搜索'}
                </button>
              </div>
              
              {/* 搜索結果 */}
              {searchResults.length > 0 && (
                <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                  {searchResults.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => selectTab(tab)}
                      className={`w-full text-left p-3 rounded-lg transition ${
                        selectedTab?.id === tab.id 
                          ? 'bg-[#FFD700]/20 border border-[#FFD700]' 
                          : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      <p className="text-white font-medium">{tab.title}</p>
                      <p className="text-gray-400 text-sm">{tab.artist}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 顯示設定 */}
            {selectedTab && (
              <>
                <div className="bg-[#121212] rounded-xl border border-gray-800 p-6">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Type size={20} />
                    顯示內容
                  </h2>
                  
                  <div className="space-y-3">
                    {[
                      { key: 'showChords', label: '顯示和弦進行' },
                      { key: 'showLyrics', label: '顯示歌詞' },
                      { key: 'showArtistImage', label: '顯示歌手圖片' },
                      { key: 'showLogo', label: '顯示 Polygon Logo' },
                      { key: 'showInstagramHandle', label: '顯示 Instagram 帳號' }
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showSettings[key]}
                          onChange={(e) => setShowSettings({ ...showSettings, [key]: e.target.checked })}
                          className="w-5 h-5 rounded text-[#FFD700]"
                        />
                        <span className="text-gray-300">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-[#121212] rounded-xl border border-gray-800 p-6">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <ImageIcon size={20} />
                    樣式設定
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-gray-400 text-sm block mb-2">主題風格</label>
                      <div className="flex gap-2">
                        {[
                          { value: 'dark', label: '深色' },
                          { value: 'light', label: '淺色' },
                          { value: 'color', label: '彩色' }
                        ].map(({ value, label }) => (
                          <button
                            key={value}
                            onClick={() => setShowSettings({ ...showSettings, theme: value })}
                            className={`flex-1 py-2 rounded-lg text-sm transition ${
                              showSettings.theme === value
                                ? 'bg-[#FFD700] text-black'
                                : 'bg-gray-800 text-gray-300'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-gray-400 text-sm block mb-2">
                        背景遮罩透明度 ({styleSettings.overlayOpacity}%)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="90"
                        value={styleSettings.overlayOpacity}
                        onChange={(e) => setStyleSettings({ ...styleSettings, overlayOpacity: parseInt(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

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
                
                {!html2canvasLoaded && (
                  <p className="text-yellow-500 text-sm text-center">正在載入圖片生成工具...</p>
                )}
              </>
            )}
          </div>

          {/* 右側：預覽區 */}
          <div className="lg:sticky lg:top-24 h-fit">
            <h2 className="text-lg font-bold text-white mb-4">預覽</h2>
            
            {selectedTab ? (
              <div className="flex justify-center">
                {/* Instagram 正方形預覽 */}
                <div 
                  ref={previewRef}
                  className="relative w-[400px] h-[400px] overflow-hidden"
                  style={{
                    background: showSettings.theme === 'dark' ? '#1a1a1a' : 
                               showSettings.theme === 'light' ? '#ffffff' : 
                               `linear-gradient(135deg, #1a1a1a 0%, #2d1810 100%)`
                  }}
                >
                  {/* 背景圖片 */}
                  {showSettings.showArtistImage && getBackgroundImage() && (
                    <div 
                      className="absolute inset-0 bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${getBackgroundImage()})`,
                        opacity: (100 - styleSettings.overlayOpacity) / 100
                      }}
                    />
                  )}
                  
                  {/* 遮罩層 */}
                  <div 
                    className="absolute inset-0"
                    style={{
                      background: showSettings.theme === 'dark' ? `rgba(0,0,0,${styleSettings.overlayOpacity/100})` : 
                                 showSettings.theme === 'light' ? `rgba(255,255,255,${styleSettings.overlayOpacity/100})` : 
                                 `rgba(20,10,5,${styleSettings.overlayOpacity/100})`
                    }}
                  />
                  
                  {/* 內容 */}
                  <div className="relative z-10 h-full flex flex-col p-6">
                    {/* 頂部：和弦進行 */}
                    {showSettings.showChords && selectedTab.parsedContent?.chords?.length > 0 && (
                      <div className="mb-4">
                        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                          <p className="text-gray-400 text-xs mb-2">和弦進行</p>
                          {selectedTab.parsedContent.chords.map((chordLine, idx) => (
                            <p 
                              key={idx} 
                              className={`font-mono text-lg tracking-wider ${
                                showSettings.theme === 'light' ? 'text-gray-800' : 'text-[#FFD700]'
                              }`}
                            >
                              {chordLine}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* 中間：歌詞 */}
                    {showSettings.showLyrics && selectedTab.parsedContent?.lyrics?.length > 0 && (
                      <div className="flex-1 overflow-hidden">
                        <div className={`text-sm leading-relaxed ${
                          showSettings.theme === 'light' ? 'text-gray-700' : 'text-gray-200'
                        }`}>
                          {selectedTab.parsedContent.lyrics.map((line, idx) => (
                            <p key={idx} className="mb-1">{line}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* 底部：歌曲信息 */}
                    <div className="mt-auto pt-4">
                      <div className="text-center mb-3">
                        <h3 className={`text-xl font-bold ${
                          showSettings.theme === 'light' ? 'text-gray-900' : 'text-white'
                        }`}>
                          {selectedTab.title}
                        </h3>
                        <p className={`text-sm ${
                          showSettings.theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          {selectedTab.artist}
                        </p>
                      </div>
                      
                      {/* Logo 和 IG Handle */}
                      <div className="flex items-center justify-between">
                        {showSettings.showLogo && (
                          <div className="flex items-center gap-2">
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" 
                                    stroke={showSettings.theme === 'light' ? '#000' : '#FFD700'} 
                                    strokeWidth="2" fill="none"/>
                            </svg>
                            <span className={`text-sm font-bold ${
                              showSettings.theme === 'light' ? 'text-gray-900' : 'text-[#FFD700]'
                            }`}>
                              POLYGON
                            </span>
                          </div>
                        )}
                        
                        {showSettings.showInstagramHandle && (
                          <div className={`text-xs ${
                            showSettings.theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                          }`}>
                            @polygonguitar
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-[400px] h-[400px] bg-[#121212] rounded-xl border border-gray-800 flex items-center justify-center mx-auto">
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

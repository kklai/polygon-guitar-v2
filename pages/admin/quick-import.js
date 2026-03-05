import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { Search, Loader2, Music, Youtube, ExternalLink, Copy, Check } from 'lucide-react'

export default function QuickImport() {
  const router = useRouter()
  const { user, isAdmin } = useAuth()
  const [rawText, setRawText] = useState('')
  const [parsedData, setParsedData] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [youtubeResults, setYoutubeResults] = useState([])
  const [spotifyResult, setSpotifyResult] = useState(null)
  const [selectedYoutube, setSelectedYoutube] = useState(null)
  const [error, setError] = useState('')

  // 解析原始文字
  const parseRawText = (text) => {
    if (!text.trim()) return null

    const lines = text.split('\n').map(l => l.trim()).filter(l => l)
    
    // 提取標題和歌手（通常在第一行或前幾行）
    let title = ''
    let artists = []
    let composer = ''
    let lyricist = ''
    let originalKey = 'C'
    let capo = '0'
    let bpm = ''
    let contentLines = []
    let foundContentStart = false

    // 先掃描整個文本提取元數據
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lowerLine = line.toLowerCase()

      // 提取作曲
      if (lowerLine.includes('曲：') || lowerLine.includes('作曲：')) {
        composer = line.replace(/.*曲[：:]/, '').trim()
        continue
      }

      // 提取填詞
      if (lowerLine.includes('詞：') || lowerLine.includes('填詞：') || lowerLine.includes('作詞：')) {
        lyricist = line.replace(/.*詞[：:]/, '').trim()
        continue
      }

      // 提取 BPM（格式：Bpm 59 或 59 Bpm）
      const bpmMatch = line.match(/Bpm\s*(\d+)/i) || line.match(/(\d+)\s*Bpm/i)
      if (bpmMatch && !bpm) {
        bpm = bpmMatch[1]
        continue
      }
    }

    // 從 Key 行提取預設調性
    for (const line of lines) {
      if (line.includes('Key') && line.includes('預設')) {
        // 格式：Key CDb(預設)DEbEFF#GAbABbB
        const keyMatch = line.match(/Key\s+([A-G][#b]?)/i)
        if (keyMatch) {
          originalKey = keyMatch[1]
        }
        // 也可能有 (預設) 標記
        const defaultKeyMatch = line.match(/([A-G][#b]?)\(預設\)/)
        if (defaultKeyMatch) {
          originalKey = defaultKeyMatch[1]
        }
      }
    }

    // 從 CAPO 行提取 Capo
    for (const line of lines) {
      if (line.includes('CAPO') && line.includes('(')) {
        // 格式：CAPO 0 (Db)1 (C)2 (B)...
        // 找到第一個數字
        const capoMatch = line.match(/CAPO\s*(\d+)/i)
        if (capoMatch) {
          capo = capoMatch[1]
        }
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // 跳過 CHORD LOG 等標題行
      if (line.includes('CHORD LOG')) continue
      if (line.includes('跟隨')) continue
      if (line.includes('收藏列印')) continue
      if (line.includes('Key') && line.includes('CAPO')) continue
      if (line.includes('Key') && line.includes('預設')) continue
      if (line.includes('CAPO') && line.includes('(')) continue
      if (line.includes('Apple Music')) continue
      if (line.includes('在 Apple Music')) continue
      if (line.match(/^\d{4,}$/)) continue // 4位以上純數字（通常是瀏覽數）
      
      // 已經處理過的字段跳過
      if (line.includes('曲：') || line.includes('詞：')) continue
      if (line.match(/Bpm\s*\d+/i)) continue

      // 譜內容開始（包含 | 或純和弦行）
      if (line.includes('|') || line.match(/^[A-G][#b]?(m|maj7|7|add9|sus4|6|9)?$/)) {
        foundContentStart = true
      }

      // 收集譜內容
      if (foundContentStart || line.includes('|') || 
          (line.length < 50 && (line.includes('Verse') || line.includes('Chorus') || line.includes('Intro') || line.includes('Bridge')))) {
        contentLines.push(line)
      } else if (!title && !foundContentStart && line.length < 50 && !line.includes('標籤')) {
        // 可能是標題行，檢查是否包含歌手名
        // 嘗試解析第一行（可能沒有分隔符）
        // 格式如：租購薛之謙曲：董嘉鸿詞：张鹏鹏、董嘉鸿
        
        // 移除曲詞信息後嘗試解析
        const cleanLine = line.replace(/[曲詞][:：].*$/, '').trim()
        
        if (cleanLine.includes(' - ') || cleanLine.includes('–') || cleanLine.includes('—')) {
          const titleMatch = cleanLine.match(/^(.+?)\s*[-–—]\s*(.+)$/)
          if (titleMatch) {
            const part1 = titleMatch[1].trim()
            const part2 = titleMatch[2].trim()
            // 檢查哪個是歌手（較長或包含常見歌手詞）
            if (part1.length > part2.length || /薛之謙|陳奕迅|周杰倫|五月天/.test(part1)) {
              title = part2
              artists = [part1]
            } else {
              title = part1
              artists = [part2]
            }
          }
        } else {
          // 沒有分隔符，嘗試從內容推斷
          // 通常歌名較短，歌手名在後
          // 查找可能的歌手名位置
          const possibleArtists = ['薛之謙', '陳奕迅', '周杰倫', '五月天', '林俊傑', '鄧紫棋', '張學友', 'Gareth.T', 'MC 張天賦']
          
          for (const artistName of possibleArtists) {
            if (cleanLine.includes(artistName)) {
              const idx = cleanLine.indexOf(artistName)
              if (idx === 0) {
                // 歌手在前
                title = cleanLine.replace(artistName, '').trim()
                artists = [artistName]
              } else {
                // 歌名在前
                title = cleanLine.substring(0, idx).trim()
                artists = [artistName]
              }
              break
            }
          }
          
          // 如果還沒找到，嘗試簡單分割（歌名通常2-4個字）
          if (!title && cleanLine.length >= 2) {
            // 假設歌名在前，歌手在後
            // 常見模式：2-4字歌名 + 歌手名
            if (cleanLine.length <= 6) {
              // 可能是單獨歌名，歌手在別處
              title = cleanLine
            } else {
              // 嘗試提取2-4字作為歌名
              const shortTitle = cleanLine.substring(0, Math.min(4, cleanLine.length))
              const possibleArtist = cleanLine.substring(Math.min(4, cleanLine.length)).trim()
              if (possibleArtist.length >= 2) {
                title = shortTitle
                artists = [possibleArtist]
              } else {
                title = cleanLine
              }
            }
          }
        }
      }
    }

    // 從 "聆聽" 行提取歌手
    for (const line of lines) {
      if (line.includes('聆聽') && line.includes('-')) {
        // 格式：聆聽 "租購" 或 薛之謙 - 租購
        const listenMatch = line.match(/(.+?)\s*-\s*(.+)/)
        if (listenMatch) {
          const possibleArtist = listenMatch[1].replace(/聆聽.*"/, '').replace(/"/g, '').trim()
          const possibleTitle = listenMatch[2].replace(/"/g, '').trim()
          
          if (possibleTitle === title || possibleTitle.includes(title)) {
            if (!artists.length || artists[0] === '未知歌手') {
              artists = [possibleArtist]
            }
          }
        }
      }
    }

    // 清理內容
    let content = contentLines.join('\n')

    return {
      title: title || '未知歌名',
      artists: artists.length > 0 ? artists : ['未知歌手'],
      composer,
      lyricist,
      originalKey,
      capo,
      bpm,
      content,
      uploaderPenName: 'CHORD LOG'
    }
  }

  // 當文字改變時自動解析
  useEffect(() => {
    const data = parseRawText(rawText)
    setParsedData(data)
  }, [rawText])

  // 搜尋 YouTube
  const searchYouTube = async () => {
    if (!parsedData?.title) return
    setIsSearching(true)
    setError('')
    
    try {
      const query = `${parsedData.artists.join(' ')} ${parsedData.title}`
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      
      if (data.videos && data.videos.length > 0) {
        setYoutubeResults(data.videos.slice(0, 5))
      } else {
        setYoutubeResults([])
      }
    } catch (err) {
      setError('YouTube 搜尋失敗')
      console.error(err)
    } finally {
      setIsSearching(false)
    }
  }

  // 搜尋 Spotify
  const searchSpotify = async () => {
    if (!parsedData?.title) return
    setIsSearching(true)
    setError('')
    
    try {
      const query = `${parsedData.artists.join(' ')} ${parsedData.title}`
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}&type=track&limit=5`)
      const data = await res.json()
      
      if (data.tracks?.items && data.tracks.items.length > 0) {
        // 找最匹配的歌曲
        const track = data.tracks.items[0]
        setSpotifyResult({
          id: track.id,
          name: track.name,
          artist: track.artists.map(a => a.name).join(', '),
          album: track.album.name,
          albumImage: track.album.images[0]?.url || '',
          previewUrl: track.preview_url
        })
      } else {
        setSpotifyResult(null)
      }
    } catch (err) {
      setError('Spotify 搜尋失敗')
      console.error(err)
    } finally {
      setIsSearching(false)
    }
  }

  // 一鍵搜尋
  const searchAll = async () => {
    await searchYouTube()
    await searchSpotify()
  }

  // 跳轉到上傳頁面
  const goToUpload = () => {
    if (!parsedData) return
    
    const artistString = parsedData.artists.join(' & ')
    const params = new URLSearchParams({
      title: parsedData.title,
      artist: artistString,
      originalKey: parsedData.originalKey,
      capo: parsedData.capo,
      content: encodeURIComponent(parsedData.content),
      composer: parsedData.composer,
      lyricist: parsedData.lyricist,
      bpm: parsedData.bpm,
      uploaderPenName: parsedData.uploaderPenName,
      ...(selectedYoutube && { youtube: `https://youtube.com/watch?v=${selectedYoutube.id}` }),
      ...(spotifyResult && { albumImage: spotifyResult.albumImage })
    })
    
    router.push(`/tabs/new?${params.toString()}`)
  }

  // 複製跳轉連結
  const copyLink = () => {
    if (!parsedData) return
    
    const artistString = parsedData.artists.join(' & ')
    const params = new URLSearchParams({
      title: parsedData.title,
      artist: artistString,
      originalKey: parsedData.originalKey,
      capo: parsedData.capo,
      content: encodeURIComponent(parsedData.content),
      composer: parsedData.composer,
      lyricist: parsedData.lyricist,
      bpm: parsedData.bpm,
      uploaderPenName: parsedData.uploaderPenName,
      ...(selectedYoutube && { youtube: `https://youtube.com/watch?v=${selectedYoutube.id}` }),
      ...(spotifyResult && { albumImage: spotifyResult.albumImage })
    })
    
    const url = `${window.location.origin}/tabs/new?${params.toString()}`
    navigator.clipboard.writeText(url)
    alert('連結已複製！')
  }

  if (!user || !isAdmin) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-8">
          <div className="bg-[#121212] rounded-xl p-8 text-center">
            <p className="text-gray-400">請以管理員身份登入</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Music className="w-6 h-6 text-[#FFD700]" />
          快速導入工具
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左側：輸入區 */}
          <div className="space-y-4">
            <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                貼上原始譜文字
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="貼上從網站複製的譜文字..."
                className="w-full h-96 bg-[#1a1a1a] text-white rounded-lg p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
              />
            </div>

            {/* 搜尋按鈕 */}
            <button
              onClick={searchAll}
              disabled={isSearching || !parsedData?.title}
              className="w-full flex items-center justify-center gap-2 bg-[#FFD700] text-black py-3 rounded-lg font-medium hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              {isSearching ? '搜尋中...' : '自動搜尋 YouTube + Spotify'}
            </button>

            {error && (
              <div className="bg-red-900/30 text-red-400 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>

          {/* 右側：解析結果 */}
          <div className="space-y-4">
            {parsedData && (
              <>
                {/* 解析的資料 */}
                <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
                  <h2 className="text-lg font-medium text-white mb-4">解析結果</h2>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">歌名</span>
                      <span className="text-white font-medium">{parsedData.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">歌手</span>
                      <span className="text-white">{parsedData.artists.join(' & ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">作曲</span>
                      <span className="text-white">{parsedData.composer || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">填詞</span>
                      <span className="text-white">{parsedData.lyricist || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">原調</span>
                      <span className="text-[#FFD700]">{parsedData.originalKey}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Capo</span>
                      <span className="text-white">{parsedData.capo}</span>
                    </div>
                    {parsedData.bpm && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">BPM</span>
                        <span className="text-white">{parsedData.bpm}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">上傳者</span>
                      <span className="text-white">{parsedData.uploaderPenName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">譜內容行數</span>
                      <span className="text-white">{parsedData.content.split('\n').length} 行</span>
                    </div>
                  </div>
                </div>

                {/* YouTube 結果 */}
                {youtubeResults.length > 0 && (
                  <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
                    <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                      <Youtube className="w-4 h-4 text-red-500" />
                      YouTube 搜尋結果
                    </h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {youtubeResults.map((video) => (
                        <button
                          key={video.id}
                          onClick={() => setSelectedYoutube(selectedYoutube?.id === video.id ? null : video)}
                          className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition ${
                            selectedYoutube?.id === video.id 
                              ? 'bg-red-500/20 border border-red-500/50' 
                              : 'bg-[#1a1a1a] hover:bg-[#252525]'
                          }`}
                        >
                          <img 
                            src={video.thumbnail} 
                            alt={video.title}
                            className="w-20 h-14 object-cover rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm truncate">{video.title}</p>
                            <p className="text-gray-500 text-xs">{video.channelTitle}</p>
                          </div>
                          {selectedYoutube?.id === video.id && (
                            <Check className="w-5 h-5 text-red-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Spotify 結果 */}
                {spotifyResult && (
                  <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
                    <h3 className="text-sm font-medium text-[#1DB954] mb-3">Spotify 搜尋結果</h3>
                    <div className="flex items-center gap-3">
                      {spotifyResult.albumImage && (
                        <img 
                          src={spotifyResult.albumImage} 
                          alt={spotifyResult.album}
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{spotifyResult.name}</p>
                        <p className="text-gray-400 text-sm truncate">{spotifyResult.artist}</p>
                        <p className="text-gray-500 text-xs truncate">{spotifyResult.album}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 操作按鈕 */}
                <div className="flex gap-3">
                  <button
                    onClick={goToUpload}
                    disabled={!parsedData.title}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#FFD700] text-black py-3 rounded-lg font-medium hover:bg-yellow-400 disabled:opacity-50"
                  >
                    <ExternalLink className="w-5 h-5" />
                    前往上傳頁面
                  </button>
                  <button
                    onClick={copyLink}
                    disabled={!parsedData.title}
                    className="px-4 flex items-center justify-center gap-2 bg-[#282828] text-white py-3 rounded-lg hover:bg-[#3E3E3E] disabled:opacity-50"
                    title="複製連結"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>

                {/* 譜內容預覽 */}
                <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">譜內容預覽</h3>
                  <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto bg-[#1a1a1a] p-3 rounded">
                    {parsedData.content.slice(0, 1000)}
                    {parsedData.content.length > 1000 && '...'}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

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

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lowerLine = line.toLowerCase()

      // 跳過 CHORD LOG 等標題行
      if (line.includes('CHORD LOG') || line.includes('跟隨') || line.includes('收藏列印')) continue
      if (line.includes('Key') && line.includes('CAPO')) continue
      if (line.includes('Apple Music')) continue
      if (line.includes('Bpm') && line.match(/^\d+$/)) continue
      if (line.includes('在 Apple Music')) continue
      if (line.match(/^\d+$/)) continue // 純數字行（通常是數據）

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

      // 提取 BPM
      const bpmMatch = line.match(/Bpm\s*(\d+)/i) || line.match(/(\d+)\s*Bpm/i)
      if (bpmMatch && !bpm) {
        bpm = bpmMatch[1]
        continue
      }

      // 譜內容開始（包含 | 或和弦）
      if (line.includes('|') || line.match(/^[A-G][#b]?(m|maj7|7|add9|sus4)?$/)) {
        foundContentStart = true
      }

      // 收集譜內容
      if (foundContentStart || line.includes('|') || line.includes('：') || line.includes('Woo') || line.includes('遺憾')) {
        contentLines.push(line)
      } else if (!title && !line.includes('：') && line.length < 50) {
        // 可能是標題行
        const titleMatch = line.match(/^(.+?)\s*[-–—]\s*(.+)$/) || 
                          line.match(/^(.+?)\s*by\s*(.+)$/i) ||
                          line.match(/^(.+?)\s*[|｜]\s*(.+)$/)
        if (titleMatch) {
          title = titleMatch[1].trim()
          artists = titleMatch[2].split(/[&+,，、]/).map(a => a.trim()).filter(a => a)
        } else if (line.length > 0 && line.length < 30) {
          title = line
        }
      }
    }

    // 如果還沒找到標題，嘗試從第一行解析
    if (!title && lines[0]) {
      const firstLine = lines[0]
      // 嘗試 "歌手 - 歌名" 格式
      const match = firstLine.match(/^(.+?)\s*[-–—]\s*(.+)$/) ||
                   firstLine.match(/^(.+?)\s*by\s*(.+)$/i) ||
                   firstLine.match(/^(.+?)\s*[|｜]\s*(.+)$/)
      if (match) {
        // 判斷哪邊是歌手哪邊是歌名
        const part1 = match[1].trim()
        const part2 = match[2].trim()
        
        // 如果第二部分包含"曲："或"詞："，可能第一部分是歌名
        if (part2.includes('曲') || part2.includes('詞')) {
          title = part1
        } else {
          // 否則假設 "歌手 - 歌名" 或 "歌名 - 歌手"
          // 檢查哪個更像歌名（較短、沒有 &）
          if (part1.includes('&') || part1.includes('、') || part1.length > part2.length) {
            artists = part1.split(/[&+,，、]/).map(a => a.trim()).filter(a => a)
            title = part2
          } else {
            artists = part2.split(/[&+,，、]/).map(a => a.trim()).filter(a => a)
            title = part1
          }
        }
      }
    }

    // 清理內容
    let content = contentLines.join('\n')
    
    // 嘗試從內容中提取 Key
    const keyMatch = content.match(/Key:\s*([A-G][#b]?m?)/i) || 
                    text.match(/Key[：:]\s*([A-G][#b]?m?)/i)
    if (keyMatch) {
      originalKey = keyMatch[1]
    }

    // 嘗試從內容中提取 Capo
    const capoMatch = content.match(/Capo[:\s]*(\d+)/i) || 
                     text.match(/Capo[\s:：]*(\d+)/i) ||
                     text.match(/夾(\d+)/)
    if (capoMatch) {
      capo = capoMatch[1]
    }

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

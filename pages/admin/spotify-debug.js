import { useState } from 'react'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'

function SpotifyDebugPage() {
  const [artist, setArtist] = useState('MC 張天賦')
  const [title, setTitle] = useState('記憶棉')
  const [spotifyResult, setSpotifyResult] = useState(null)
  const [musicbrainzResult, setMusicbrainzResult] = useState(null)
  const [loadingSpotify, setLoadingSpotify] = useState(false)
  const [loadingMB, setLoadingMB] = useState(false)
  const [error, setError] = useState(null)

  const testSpotify = async () => {
    setLoadingSpotify(true)
    setError(null)
    setSpotifyResult(null)
    
    try {
      // 1. 搜尋歌曲
      const searchRes = await fetch('/api/spotify/search-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title })
      })
      
      if (!searchRes.ok) {
        const err = await searchRes.json()
        throw new Error(err.error || '搜尋失敗')
      }
      
      const searchData = await searchRes.json()
      
      if (!searchData.results || searchData.results.length === 0) {
        throw new Error('未找到歌曲')
      }
      
      const track = searchData.results[0]
      
      // 2. 獲取詳細資訊
      const detailsRes = await fetch('/api/spotify/track-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id })
      })
      
      let detailsData = null
      if (detailsRes.ok) {
        detailsData = await detailsRes.json()
      }
      
      setSpotifyResult({
        track,
        details: detailsData
      })
      
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingSpotify(false)
    }
  }

  const testMusicBrainz = async () => {
    setLoadingMB(true)
    setError(null)
    setMusicbrainzResult(null)
    
    try {
      const res = await fetch('/api/musicbrainz/track-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'MusicBrainz 查詢失敗')
      }
      
      setMusicbrainzResult(data)
      
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingMB(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">🎧 音樂 API 測試</h1>
        
        {/* 輸入區 */}
        <div className="bg-[#121212] rounded-xl p-6 border border-neutral-800 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-neutral-400 text-sm mb-2">歌手</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-neutral-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-neutral-400 text-sm mb-2">歌名</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-neutral-700 rounded-lg text-white"
              />
            </div>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={testSpotify}
              disabled={loadingSpotify}
              className="px-6 py-2 bg-[#1DB954] text-white rounded-lg font-medium hover:bg-[#1ed760] transition disabled:opacity-50"
            >
              {loadingSpotify ? '測試中...' : '測試 Spotify'}
            </button>
            
            <button
              onClick={testMusicBrainz}
              disabled={loadingMB}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500 transition disabled:opacity-50"
            >
              {loadingMB ? '測試中...' : '🧠 測試 MusicBrainz'}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-6">
            <p className="text-red-400">❌ {error}</p>
          </div>
        )}
        
        {/* 結果對比 */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Spotify 結果 */}
          {spotifyResult && (
            <div className="bg-[#121212] rounded-xl p-6 border border-neutral-800">
              <h2 className="text-lg font-medium text-[#1DB954] mb-4">Spotify 結果</h2>
              
              {spotifyResult.details?.result?.albumImage && (
                <img 
                  src={spotifyResult.details.result.albumImage} 
                  alt="" 
                  className="w-20 h-20 rounded object-cover mb-4"
                />
              )}
              
              <div className="text-white font-medium">{spotifyResult.details?.result?.name}</div>
              <div className="text-neutral-400 text-sm">{spotifyResult.details?.result?.artist}</div>
              <div className="text-neutral-500 text-sm">{spotifyResult.details?.result?.releaseYear}</div>
              
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">BPM:</span>
                  <span className="text-red-400">❌ 不可用</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">作曲:</span>
                  <span className="text-red-400">❌ 不可用</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">填詞:</span>
                  <span className="text-red-400">❌ 不可用</span>
                </div>
              </div>
              
              <details className="mt-4">
                <summary className="text-neutral-500 text-sm cursor-pointer">查看原始數據</summary>
                <pre className="mt-2 text-xs text-neutral-400 bg-black p-3 rounded-lg overflow-auto max-h-60">
                  {JSON.stringify(spotifyResult, null, 2)}
                </pre>
              </details>
            </div>
          )}
          
          {/* MusicBrainz 結果 */}
          {musicbrainzResult && (
            <div className="bg-[#121212] rounded-xl p-6 border border-purple-800">
              <h2 className="text-lg font-medium text-purple-400 mb-4">MusicBrainz 結果</h2>
              
              <div className="text-white font-medium">{musicbrainzResult.result?.title}</div>
              <div className="text-neutral-400 text-sm">{musicbrainzResult.result?.artist}</div>
              
              {musicbrainzResult.result?.releases?.[0] && (
                <div className="text-neutral-500 text-sm">
                  {musicbrainzResult.result.releases[0].title} · {musicbrainzResult.result.releases[0].date}
                </div>
              )}
              
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">BPM:</span>
                  <span className={musicbrainzResult.result?.audioFeatures?.bpm ? 'text-green-400' : 'text-red-400'}>
                    {musicbrainzResult.result?.audioFeatures?.bpm || '❌ 無數據'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Key:</span>
                  <span className={musicbrainzResult.result?.audioFeatures?.key ? 'text-green-400' : 'text-red-400'}>
                    {musicbrainzResult.result?.audioFeatures?.key || '❌ 無數據'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">作曲:</span>
                  <span className={musicbrainzResult.result?.credits?.composers?.length ? 'text-green-400' : 'text-red-400'}>
                    {musicbrainzResult.result?.credits?.composers?.join(', ') || '❌ 無數據'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">填詞:</span>
                  <span className={musicbrainzResult.result?.credits?.lyricists?.length ? 'text-green-400' : 'text-red-400'}>
                    {musicbrainzResult.result?.credits?.lyricists?.join(', ') || '❌ 無數據'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">編曲:</span>
                  <span className={musicbrainzResult.result?.credits?.arrangers?.length ? 'text-green-400' : 'text-neutral-500'}>
                    {musicbrainzResult.result?.credits?.arrangers?.join(', ') || '無數據'}
                  </span>
                </div>
              </div>
              
              <details className="mt-4">
                <summary className="text-neutral-500 text-sm cursor-pointer">查看原始數據</summary>
                <pre className="mt-2 text-xs text-neutral-400 bg-black p-3 rounded-lg overflow-auto max-h-60">
                  {JSON.stringify(musicbrainzResult, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
        
        {/* 說明 */}
        <div className="mt-8 bg-yellow-900/20 border border-yellow-800 rounded-xl p-4">
          <h3 className="text-yellow-400 font-medium mb-2">⚠️ API 限制說明</h3>
          <div className="text-yellow-200/70 text-sm space-y-1">
            <p><strong>Spotify:</strong> 已於 2024年11月棄用 Audio Features API，無法獲取 BPM、作曲填詞。</p>
            <p><strong>MusicBrainz:</strong> 免費開源資料庫，可能有 BPM、作曲填詞等數據，但覆蓋率視歌曲而定。</p>
            <p><strong>AcousticBrainz:</strong> 基於 MusicBrainz 的音訊分析數據，提供 BPM、Key 等資訊。</p>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default function SpotifyDebugGuard() {
  return (
    <AdminGuard>
      <SpotifyDebugPage />
    </AdminGuard>
  )
}

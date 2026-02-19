import { useState } from 'react'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'

function SpotifyDebugPage() {
  const [artist, setArtist] = useState('MC 張天賦')
  const [title, setTitle] = useState('記憶棉')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const testSearch = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    
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
      
      setResult({
        track,
        details: detailsData
      })
      
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">🎧 Spotify API 測試</h1>
        
        <div className="bg-[#121212] rounded-xl p-6 border border-gray-800 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">歌手</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">歌名</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white"
              />
            </div>
          </div>
          
          <button
            onClick={testSearch}
            disabled={loading}
            className="px-6 py-2 bg-[#1DB954] text-white rounded-lg font-medium hover:bg-[#1ed760] transition disabled:opacity-50"
          >
            {loading ? '測試中...' : '測試 API'}
          </button>
        </div>
        
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-6">
            <p className="text-red-400">❌ {error}</p>
          </div>
        )}
        
        {result && (
          <div className="space-y-6">
            {/* 基本資訊 */}
            <div className="bg-[#121212] rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-medium text-white mb-4">基本資訊</h2>
              <div className="flex items-center gap-4">
                {result.track.albumImage && (
                  <img src={result.track.albumImage} alt="" className="w-20 h-20 rounded object-cover" />
                )}
                <div>
                  <div className="text-[#1DB954] font-medium text-lg">{result.track.name}</div>
                  <div className="text-gray-400">{result.track.artist}</div>
                  <div className="text-gray-500 text-sm">{result.track.album} · {result.track.releaseYear}</div>
                </div>
              </div>
            </div>
            
            {/* Audio Features */}
            {result.details && (
              <div className="bg-[#121212] rounded-xl p-6 border border-gray-800">
                <h2 className="text-lg font-medium text-white mb-4">
                  Audio Features 
                  {result.details.hasAudioFeatures && <span className="text-green-500 text-sm ml-2">✓ 可用</span>}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-black rounded-lg p-3">
                    <div className="text-gray-500 text-xs">BPM</div>
                    <div className="text-[#FFD700] text-xl font-bold">{result.details.bpm || '-'}</div>
                  </div>
                  <div className="bg-black rounded-lg p-3">
                    <div className="text-gray-500 text-xs">調性 (Key)</div>
                    <div className="text-white text-xl font-bold">{result.details.key !== undefined ? result.details.key : '-'}</div>
                  </div>
                  <div className="bg-black rounded-lg p-3">
                    <div className="text-gray-500 text-xs">拍號</div>
                    <div className="text-white text-xl font-bold">{result.details.timeSignature || '-'}</div>
                  </div>
                  <div className="bg-black rounded-lg p-3">
                    <div className="text-gray-500 text-xs">能量</div>
                    <div className="text-white text-xl font-bold">{result.details.energy !== undefined ? Math.round(result.details.energy * 100) : '-'}%</div>
                  </div>
                </div>
                
                {/* 顯示原始數據 */}
                <details className="mt-4">
                  <summary className="text-gray-500 text-sm cursor-pointer">查看原始 Audio Features 數據</summary>
                  <pre className="mt-2 text-xs text-gray-400 bg-black p-3 rounded-lg overflow-auto max-h-60">
                    {JSON.stringify({
                      bpm: result.details.bpm,
                      key: result.details.key,
                      mode: result.details.mode,
                      timeSignature: result.details.timeSignature,
                      danceability: result.details.danceability,
                      energy: result.details.energy,
                      valence: result.details.valence
                    }, null, 2)}
                  </pre>
                </details>
              </div>
            )}
            
            {/* Credits */}
            {result.details && (
              <div className="bg-[#121212] rounded-xl p-6 border border-gray-800">
                <h2 className="text-lg font-medium text-white mb-4">
                  Credits
                  {result.details.hasCredits ? <span className="text-green-500 text-sm ml-2">✓ 可用</span> : <span className="text-red-500 text-sm ml-2">✗ 不可用</span>}
                </h2>
                
                {result.details.composers || result.details.lyricists || result.details.producers ? (
                  <div className="space-y-2">
                    {result.details.composers && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-16">作曲:</span>
                        <span className="text-white">{result.details.composers}</span>
                      </div>
                    )}
                    {result.details.lyricists && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-16">填詞:</span>
                        <span className="text-white">{result.details.lyricists}</span>
                      </div>
                    )}
                    {result.details.producers && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-16">監製:</span>
                        <span className="text-white">{result.details.producers}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">沒有 Credits 資訊</p>
                )}
                
                {/* 顯示原始數據 */}
                <details className="mt-4">
                  <summary className="text-gray-500 text-sm cursor-pointer">查看原始 Credits 數據</summary>
                  <pre className="mt-2 text-xs text-gray-400 bg-black p-3 rounded-lg overflow-auto max-h-60">
                    {JSON.stringify({
                      composers: result.details.composers,
                      lyricists: result.details.lyricists,
                      producers: result.details.producers,
                      performers: result.details.performers
                    }, null, 2)}
                  </pre>
                </details>
              </div>
            )}
            
            {/* 完整原始數據 */}
            <div className="bg-[#121212] rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-medium text-white mb-4">完整 API 回應</h2>
              <pre className="text-xs text-gray-400 bg-black p-3 rounded-lg overflow-auto max-h-96">
                {JSON.stringify(result.details, null, 2)}
              </pre>
            </div>
          </div>
        )}
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

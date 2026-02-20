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
        
        {result && result.details && (
          <div className="space-y-6">
            {/* 基本資訊 */}
            <div className="bg-[#121212] rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-medium text-white mb-4">基本資訊</h2>
              <div className="flex items-center gap-4">
                {result.details.result?.albumImage && (
                  <img src={result.details.result.albumImage} alt="" className="w-20 h-20 rounded object-cover" />
                )}
                <div>
                  <div className="text-[#1DB954] font-medium text-lg">{result.details.result?.name}</div>
                  <div className="text-gray-400">{result.details.result?.artist}</div>
                  <div className="text-gray-500 text-sm">{result.details.result?.album} · {result.details.result?.releaseYear}</div>
                </div>
              </div>
            </div>
            
            {/* Audio Features */}
            {result.details.result?.audioFeatures && (
              <div className="bg-[#121212] rounded-xl p-6 border border-gray-800">
                <h2 className="text-lg font-medium text-white mb-4">
                  Audio Features 
                  <span className="text-green-500 text-sm ml-2">✓ 可用</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-black rounded-lg p-3">
                    <div className="text-gray-500 text-xs">BPM</div>
                    <div className="text-[#FFD700] text-xl font-bold">{result.details.result.audioFeatures.bpm || '-'}</div>
                  </div>
                  <div className="bg-black rounded-lg p-3">
                    <div className="text-gray-500 text-xs">調性 (Key)</div>
                    <div className="text-white text-xl font-bold">{result.details.result.audioFeatures.key || '-'}</div>
                  </div>
                  <div className="bg-black rounded-lg p-3">
                    <div className="text-gray-500 text-xs">拍號</div>
                    <div className="text-white text-xl font-bold">{result.details.result.audioFeatures.timeSignature || '-'}</div>
                  </div>
                  <div className="bg-black rounded-lg p-3">
                    <div className="text-gray-500 text-xs">能量</div>
                    <div className="text-white text-xl font-bold">{result.details.result.audioFeatures.energy || '-'}%</div>
                  </div>
                </div>
                
                {/* 更多 Audio Features */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="bg-black rounded-lg p-3">
                    <div className="text-gray-500 text-xs">舞曲性</div>
                    <div className="text-white text-xl font-bold">{result.details.result.audioFeatures.danceability || '-'}%</div>
                  </div>
                  <div className="bg-black rounded-lg p-3">
                    <div className="text-gray-500 text-xs">情緒值</div>
                    <div className="text-white text-xl font-bold">{result.details.result.audioFeatures.valence || '-'}%</div>
                  </div>
                  <div className="bg-black rounded-lg p-3">
                    <div className="text-gray-500 text-xs">原聲度</div>
                    <div className="text-white text-xl font-bold">{result.details.result.audioFeatures.acousticness || '-'}%</div>
                  </div>
                  <div className="bg-black rounded-lg p-3">
                    <div className="text-gray-500 text-xs">模式</div>
                    <div className="text-white text-xl font-bold">{result.details.result.audioFeatures.mode || '-'}</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Credits */}
            {result.details.result?.credits && result.details.result.credits.length > 0 && (
              <div className="bg-[#121212] rounded-xl p-6 border border-gray-800">
                <h2 className="text-lg font-medium text-white mb-4">
                  Credits
                  <span className="text-green-500 text-sm ml-2">✓ 可用</span>
                </h2>
                
                <div className="space-y-2">
                  {result.details.result.credits.map((credit, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-gray-500 w-20">{credit.role}:</span>
                      <span className="text-white">{credit.artists?.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Credits 不可用提示 */}
            {(!result.details.result?.credits || result.details.result.credits.length === 0) && (
              <div className="bg-[#121212] rounded-xl p-6 border border-gray-800">
                <h2 className="text-lg font-medium text-white mb-4">
                  Credits
                  <span className="text-red-500 text-sm ml-2">✗ 不可用</span>
                </h2>
                <p className="text-gray-500 text-sm">Spotify 沒有提供這首歌的 Credits 資訊</p>
              </div>
            )}
            
            {/* 完整 API 回應 */}
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

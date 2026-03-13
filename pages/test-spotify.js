// Spotify API 測試頁面
import { useState } from 'react'
import Layout from '@/components/Layout'

export default function TestSpotify() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const testSpotify = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/spotify/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Eason Chan' })
      })

      const data = await response.json()

      if (!response.ok) {
        setError({
          status: response.status,
          message: data.error || 'Unknown error',
          details: data
        })
      } else {
        setResult({
          status: response.status,
          artist: data.name,
          imageCount: data.images?.length || 0,
          imageUrl: data.images?.[0]?.url || null
        })
      }
    } catch (err) {
      setError({
        status: 'Network Error',
        message: err.message
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">
            <span className="text-[#FFD700]">Spotify</span> API 測試
          </h1>
          <p className="text-neutral-400 mb-8">測試 Spotify Developer API 是否正常工作</p>

          <button
            onClick={testSpotify}
            disabled={loading}
            className={`w-full py-4 rounded-lg font-bold text-lg transition ${
              loading
                ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
                : 'bg-[#1DB954] text-white hover:bg-[#1ed760]'
            }`}
          >
            {loading ? '測試中...' : '測試 Spotify API'}
          </button>

          {/* 結果顯示 */}
          {result && (
            <div className="mt-8 p-6 bg-green-900/30 border border-green-800 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">✅</span>
                <h2 className="text-xl font-bold text-green-400">API 正常工作！</h2>
              </div>
              <div className="space-y-2 text-neutral-300">
                <p>狀態碼: <span className="text-green-400">{result.status}</span></p>
                <p>歌手: <span className="text-white font-medium">{result.artist}</span></p>
                <p>圖片數量: <span className="text-white">{result.imageCount}</span></p>
                {result.imageUrl && (
                  <div className="mt-4">
                    <p className="mb-2">預覽圖片:</p>
                    <img 
                      src={result.imageUrl} 
                      alt={result.artist}
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                  </div>
                )}
              </div>
              <p className="mt-4 text-sm text-green-500">
                ✅ 你嘅 Spotify API 設置正確，可以使用！
              </p>
            </div>
          )}

          {/* 錯誤顯示 */}
          {error && (
            <div className="mt-8 p-6 bg-red-900/30 border border-red-800 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">❌</span>
                <h2 className="text-xl font-bold text-red-400">API 錯誤</h2>
              </div>
              <div className="space-y-2 text-neutral-300">
                <p>狀態碼: <span className="text-red-400 font-mono">{error.status}</span></p>
                <p>錯誤訊息: <span className="text-white">{error.message}</span></p>
                {error.details && (
                  <div className="mt-4 p-3 bg-black/50 rounded overflow-auto">
                    <pre className="text-xs text-neutral-400">
                      {JSON.stringify(error.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
              
              {error.status === 500 && error.message?.includes('credentials') && (
                <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-800 rounded">
                  <p className="text-yellow-400 font-medium">💡 可能的問題:</p>
                  <ul className="mt-2 text-sm text-yellow-200/70 space-y-1">
                    <li>• 環境變數 SPOTIFY_CLIENT_ID 未設置</li>
                    <li>• 環境變數 SPOTIFY_CLIENT_SECRET 未設置</li>
                    <li>• Vercel 環境變數未正確配置</li>
                  </ul>
                </div>
              )}

              {error.status === 401 && (
                <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-800 rounded">
                  <p className="text-yellow-400 font-medium">💡 Premium 問題:</p>
                  <p className="mt-2 text-sm text-yellow-200/70">
                    Spotify Developer App 需要 Owner 有 Premium 帳號。請確認你的 DUO 主帳號已登入 Developer Dashboard。
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 說明 */}
          <div className="mt-8 p-6 bg-neutral-900 rounded-xl">
            <h3 className="text-lg font-bold text-white mb-3">如何檢查</h3>
            <ol className="space-y-2 text-neutral-400 text-sm list-decimal list-inside">
              <li>點擊上方「測試 Spotify API」按鈕</li>
              <li>如果顯示 ✅ API 正常工作，則可使用</li>
              <li>如果顯示 ❌，根據錯誤訊息修正</li>
            </ol>
          </div>
        </div>
      </div>
    </Layout>
  )
}

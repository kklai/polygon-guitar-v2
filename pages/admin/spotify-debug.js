import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'

function SpotifyDebug() {
  const [envStatus, setEnvStatus] = useState(null)
  const [testResult, setTestResult] = useState(null)
  const [loading, setLoading] = useState(false)

  // 檢查環境變數
  const checkEnv = async () => {
    const response = await fetch('/api/spotify/check-env')
    const data = await response.json()
    setEnvStatus(data)
  }

  // 測試 Spotify API
  const testSpotify = async () => {
    setLoading(true)
    const response = await fetch('/api/spotify/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Eason Chan' })
    })
    const data = await response.json()
    setTestResult({
      status: response.status,
      data
    })
    setLoading(false)
  }

  useEffect(() => {
    checkEnv()
  }, [])

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 pb-8">
        <h1 className="text-2xl font-bold text-white mb-6">Spotify 除錯</h1>

        {/* 環境變數狀態 */}
        <div className="bg-[#121212] rounded-xl p-4 border border-gray-800 mb-6">
          <h2 className="text-lg font-medium text-white mb-4">環境變數檢查</h2>
          {envStatus ? (
            <div className="space-y-2 text-sm">
              <p className={envStatus.clientIdExists ? 'text-green-400' : 'text-red-400'}>
                SPOTIFY_CLIENT_ID: {envStatus.clientIdExists ? '✅ 已設置' : '❌ 未設置'}
                {envStatus.clientIdLength && ` (長度: ${envStatus.clientIdLength})`}
              </p>
              <p className={envStatus.clientSecretExists ? 'text-green-400' : 'text-red-400'}>
                SPOTIFY_CLIENT_SECRET: {envStatus.clientSecretExists ? '✅ 已設置' : '❌ 未設置'}
                {envStatus.secretLength && ` (長度: ${envStatus.secretLength})`}
              </p>
            </div>
          ) : (
            <p className="text-gray-400">檢查中...</p>
          )}
        </div>

        {/* 測試按鈕 */}
        <div className="bg-[#121212] rounded-xl p-4 border border-gray-800 mb-6">
          <h2 className="text-lg font-medium text-white mb-4">API 測試</h2>
          <button
            onClick={testSpotify}
            disabled={loading}
            className="px-4 py-2 bg-[#1DB954] text-white rounded-lg hover:bg-[#1ed760] transition disabled:opacity-50"
          >
            {loading ? '測試中...' : '測試 Spotify API'}
          </button>

          {testResult && (
            <div className={`mt-4 p-3 rounded ${testResult.status === 200 ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
              <p className="text-sm font-mono">
                狀態: {testResult.status}
              </p>
              <pre className="mt-2 text-xs overflow-auto">
                {JSON.stringify(testResult.data, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* 手動測試 */}
        <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
          <h2 className="text-lg font-medium text-white mb-4">手動測試步驟</h2>
          <ol className="text-gray-400 text-sm space-y-2 list-decimal list-inside">
            <li>確認上方「環境變數檢查」兩個都顯示 ✅</li>
            <li>如果顯示 ❌，需要去 Vercel Dashboard 手動設置環境變數</li>
            <li>撳「測試 Spotify API」睇結果</li>
            <li>如果仍然失敗，請截圖呢個頁面</li>
          </ol>
        </div>
      </div>
    </Layout>
  )
}

export default function SpotifyDebugGuard() {
  return (
    <AdminGuard>
      <SpotifyDebug />
    </AdminGuard>
  )
}

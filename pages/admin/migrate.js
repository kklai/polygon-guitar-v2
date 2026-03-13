import { useState } from 'react'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'

function MigratePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const runMigration = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/migrate-tabs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Migration failed')
      }

      setResult(data.results)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-[#121212] rounded-xl shadow-md p-6 border border-neutral-800">
          <h1 className="text-2xl font-bold text-white mb-4">
            🔧 修復舊樂譜資料
          </h1>
          <p className="text-[#B3B3B3] mb-6">
            呢個工具會為所有冇 artistId 嘅樂譜加入 artistId，同時更新歌手文件嘅 tabCount。
          </p>

          <button
            onClick={runMigration}
            disabled={isLoading}
            className="px-6 py-3 bg-[#FFD700] text-black rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                處理中...
              </span>
            ) : (
              '開始修復'
            )}
          </button>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-6">
            <h2 className="text-red-400 font-semibold mb-2">❌ 錯誤</h2>
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-[#121212] border border-[#FFD700] rounded-xl p-6">
            <h2 className="text-[#FFD700] font-semibold mb-4">✅ 修復完成</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-black rounded-lg p-4 border border-neutral-800">
                <p className="text-sm text-[#B3B3B3]">樂譜總數</p>
                <p className="text-2xl font-bold text-white">{result.total}</p>
              </div>
              <div className="bg-black rounded-lg p-4 border border-neutral-800">
                <p className="text-sm text-[#B3B3B3]">已修復</p>
                <p className="text-2xl font-bold text-[#FFD700]">{result.fixed}</p>
              </div>
            </div>

            {Object.keys(result.artists).length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-white mb-3">已更新歌手：</h3>
                <div className="space-y-2">
                  {Object.entries(result.artists).map(([artistId, data]) => (
                    <div key={artistId} className="bg-black rounded-lg p-3 flex justify-between items-center border border-neutral-800">
                      <span className="font-medium text-white">{data.name}</span>
                      <span className="text-sm text-[#B3B3B3]">+{data.count} 個譜</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.errors.length > 0 && (
              <div>
                <h3 className="font-semibold text-red-400 mb-3">
                  ⚠️ 錯誤 ({result.errors.length})
                </h3>
                <div className="space-y-2">
                  {result.errors.map((err, index) => (
                    <div key={index} className="bg-red-900/20 rounded-lg p-3 text-sm text-red-300 border border-red-800">
                      {err.id || err.artistId}: {err.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

export default function MigratePageWrapper() {
  return (
    <AdminGuard>
      <MigratePage />
    </AdminGuard>
  )
}

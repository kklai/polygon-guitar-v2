import { useState } from 'react'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'

function AnalyzePage() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [mode, setMode] = useState('dry-run')
  const [limit, setLimit] = useState(10)

  const runAnalysis = async () => {
    setLoading(true)
    setResults(null)
    
    try {
      const res = await fetch('/api/admin/analyze-tabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit, dryRun: mode === 'dry-run' })
      })
      
      const data = await res.json()
      setResults(data)
    } catch (error) {
      setResults({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">🎸 結他譜自動分析</h1>
        
        <div className="bg-[#121212] rounded-xl p-6 border border-gray-800 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">分析設置</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 mb-2">模式</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="dry-run"
                    checked={mode === 'dry-run'}
                    onChange={(e) => setMode(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-white">🔍 測試模式（只顯示結果不寫入）</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="live"
                    checked={mode === 'live'}
                    onChange={(e) => setMode(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-white">✍️ 正式寫入</span>
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-gray-400 mb-2">分析數量</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700"
              >
                <option value={5}>5 篇</option>
                <option value={10}>10 篇</option>
                <option value={50}>50 篇</option>
                <option value={100}>100 篇</option>
                <option value={9999}>全部</option>
              </select>
            </div>
            
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="w-full py-3 bg-[#FFD700] text-black rounded-lg font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? '⏳ 分析中...' : '🚀 開始分析'}
            </button>
          </div>
        </div>
        
        {/* 結果顯示 */}
        {results && (
          <div className="bg-[#121212] rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-bold text-white mb-4">
              {results.success ? '✅ 分析完成' : '❌ 分析失敗'}
            </h2>
            
            {results.success && results.results && (
              <>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-800 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-white">{results.results.total}</div>
                    <div className="text-gray-400 text-sm">總譜數</div>
                  </div>
                  <div className="bg-green-900/30 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-400">{results.results.analyzed}</div>
                    <div className="text-gray-400 text-sm">已分析</div>
                  </div>
                  <div className="bg-blue-900/30 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-400">{results.results.updated}</div>
                    <div className="text-gray-400 text-sm">已更新</div>
                  </div>
                  <div className="bg-yellow-900/30 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-yellow-400">{results.results.skipped}</div>
                    <div className="text-gray-400 text-sm">已跳過</div>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-white mb-3">詳細結果</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {results.results.details.map((item, i) => (
                    <div key={i} className="p-3 bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">{item.title}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          item.status === 'updated' ? 'bg-green-600 text-white' :
                          item.status === 'analyzed' ? 'bg-blue-600 text-white' :
                          item.status === 'skipped' ? 'bg-gray-600 text-white' :
                          'bg-red-600 text-white'
                        }`}>
                          {item.status === 'updated' ? '已更新' :
                           item.status === 'analyzed' ? '已分析' :
                           item.status === 'skipped' ? '已跳過' : '錯誤'}
                        </span>
                      </div>
                      {item.analysis && (
                        <div className="text-sm text-gray-400 mt-1">
                          {item.analysis.levelName} · {item.analysis.chordCount}個和弦 · {item.analysis.barreCount}個橫按
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {!results.success && (
              <p className="text-red-400">{results.error}</p>
            )}
          </div>
        )}
        
        {/* 說明 */}
        <div className="mt-6 p-4 bg-gray-900 rounded-lg text-sm text-gray-400">
          <h3 className="font-bold text-white mb-2">💡 使用說明</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>測試模式：只顯示分析結果不會寫入資料庫</li>
            <li>正式寫入：會將分析結果保存到每篇譜面</li>
            <li>已分析過嘅譜會自動跳過</li>
            <li>分析包括：難度、和弦數量、橫按數量、技巧標籤等</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

export default function AnalyzePageWrapper() {
  return (
    <AdminGuard>
      <AnalyzePage />
    </AdminGuard>
  )
}

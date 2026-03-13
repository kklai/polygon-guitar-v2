import { useState } from 'react'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'

function AnalyzePage() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [mode, setMode] = useState('dry-run')
  const [limit, setLimit] = useState(5)
  const [expandedItems, setExpandedItems] = useState(new Set())
  const [forceReanalyze, setForceReanalyze] = useState(false)

  const runAnalysis = async () => {
    setLoading(true)
    setResults(null)
    setExpandedItems(new Set())
    
    try {
      const res = await fetch('/api/admin/analyze-tabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit, dryRun: mode === 'dry-run', force: forceReanalyze })
      })
      
      const data = await res.json()
      setResults(data)
    } catch (error) {
      setResults({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  const analyzeSingle = async (tabId, title) => {
    if (!confirm(`重新分析「${title}」？`)) return
    
    try {
      const res = await fetch('/api/admin/analyze-tabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabId, dryRun: false, force: true })
      })
      
      const data = await res.json()
      if (data.success) {
        alert(`分析完成！\n難度：${data.analysis.levelName}\n和弦數：${data.analysis.chordCount}\nBarre：${data.analysis.barreCount}`)
      }
    } catch (error) {
      alert('分析失敗：' + error.message)
    }
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">🎸 結他譜自動分析</h1>
        
        <div className="bg-[#121212] rounded-xl p-6 border border-neutral-800 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">分析設置</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-neutral-400 mb-2">模式</label>
              <div className="flex gap-4 flex-wrap">
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
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-neutral-400 mb-2">分析數量</label>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full bg-neutral-800 text-white px-4 py-2 rounded-lg border border-neutral-700"
                >
                  <option value={1}>1 篇</option>
                  <option value={5}>5 篇</option>
                  <option value={10}>10 篇</option>
                  <option value={50}>50 篇</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceReanalyze}
                    onChange={(e) => setForceReanalyze(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-white text-sm">強制重新分析（覆蓋現有數據）</span>
                </label>
              </div>
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
          <div className="bg-[#121212] rounded-xl p-6 border border-neutral-800">
            <h2 className="text-xl font-bold text-white mb-4">
              {results.success ? '✅ 分析完成' : '❌ 分析失敗'}
            </h2>
            
            {results.success && results.results && (
              <>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-neutral-800 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-white">{results.results.total}</div>
                    <div className="text-neutral-400 text-sm">總譜數</div>
                  </div>
                  <div className="bg-green-900/30 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-400">{results.results.analyzed}</div>
                    <div className="text-neutral-400 text-sm">已分析</div>
                  </div>
                  <div className="bg-blue-900/30 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-400">{results.results.updated}</div>
                    <div className="text-neutral-400 text-sm">已更新</div>
                  </div>
                  <div className="bg-yellow-900/30 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-yellow-400">{results.results.skipped}</div>
                    <div className="text-neutral-400 text-sm">已跳過</div>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-white mb-3">詳細結果（點擊展開查看）</h3>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {results.results.details.map((item, i) => (
                    <div key={i} className="bg-neutral-800 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleExpand(i)}
                        className="w-full p-3 flex items-center justify-between hover:bg-neutral-700 transition"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-1 rounded ${
                            item.status === 'updated' ? 'bg-green-600 text-white' :
                            item.status === 'analyzed' ? 'bg-blue-600 text-white' :
                            item.status === 'skipped' ? 'bg-neutral-600 text-white' :
                            'bg-red-600 text-white'
                          }`}>
                            {item.status === 'updated' ? '已更新' :
                             item.status === 'analyzed' ? '已分析' :
                             item.status === 'skipped' ? '已跳過' : '錯誤'}
                          </span>
                          <span className="text-white font-medium text-left">{item.title}</span>
                          {item.artist && (
                            <span className="text-neutral-400 text-sm">- {item.artist}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {item.analysis && (
                            <span className="text-sm text-neutral-400">
                              {item.analysis.levelName} · {item.analysis.chordCount}個和弦
                            </span>
                          )}
                          <svg 
                            className={`w-5 h-5 text-neutral-400 transition-transform ${expandedItems.has(i) ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinecap="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>
                      
                      {expandedItems.has(i) && item.analysis && (
                        <div className="p-4 border-t border-neutral-700 bg-neutral-900/50">
                          {/* 基本統計 */}
                          <div className="grid grid-cols-4 gap-3 mb-4">
                            <div className="bg-neutral-800 p-2 rounded text-center">
                              <div className="text-lg font-bold text-[#FFD700]">{item.analysis.chordCount}</div>
                              <div className="text-xs text-neutral-400">獨特和弦</div>
                            </div>
                            <div className="bg-neutral-800 p-2 rounded text-center">
                              <div className="text-lg font-bold text-[#FFD700]">{item.analysis.lineCount}</div>
                              <div className="text-xs text-neutral-400">行數</div>
                            </div>
                            <div className="bg-neutral-800 p-2 rounded text-center">
                              <div className="text-lg font-bold text-[#FFD700]">{item.analysis.charCount}</div>
                              <div className="text-xs text-neutral-400">字符數</div>
                            </div>
                            <div className="bg-neutral-800 p-2 rounded text-center">
                              <div className="text-lg font-bold text-[#FFD700]">{item.analysis.estimatedTime}</div>
                              <div className="text-xs text-neutral-400">預計練習</div>
                            </div>
                          </div>
                          
                          {/* Barre 和弦提示 */}
                          {item.analysis.barreChordsDetected?.length > 0 && (
                            <div className="mb-4 p-3 bg-orange-900/20 border border-orange-700/50 rounded">
                              <div className="text-sm text-orange-400 mb-1">
                                ⚠️ 檢測到可能需要 Barre 技巧的和弦（用戶可轉 Key 避開）：
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {item.analysis.barreChordsDetected.map((chord, idx) => (
                                  <span key={idx} className="text-xs px-2 py-1 bg-orange-600/30 text-orange-300 rounded">
                                    {chord}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* 和弦詳情 */}
                          <div className="space-y-3">
                            <div>
                              <div className="text-sm text-neutral-400 mb-1">所有獨特和弦 ({item.analysis.uniqueChords.length}個):</div>
                              <div className="flex flex-wrap gap-1">
                                {item.analysis.uniqueChords.map((chord, idx) => (
                                  <span 
                                    key={idx}
                                    className="text-xs px-2 py-1 rounded bg-neutral-700 text-neutral-300"
                                  >
                                    {chord}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            {/* 標籤 */}
                            {item.analysis.autoTags?.length > 0 && (
                              <div>
                                <div className="text-sm text-neutral-400 mb-1">自動標籤:</div>
                                <div className="flex flex-wrap gap-1">
                                  {item.analysis.autoTags.map((tag, idx) => (
                                    <span key={idx} className="text-xs px-2 py-1 bg-[#FFD700]/20 text-[#FFD700] rounded">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* 檢測到的技巧 */}
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className={`p-2 rounded ${item.analysis.hasFingerstyle ? 'bg-green-900/30 text-green-400' : 'bg-neutral-800 text-neutral-500'}`}>
                                {item.analysis.hasFingerstyle ? '✓' : '✗'} 指彈技巧
                              </div>
                              <div className={`p-2 rounded ${item.analysis.hasStrummingPattern ? 'bg-green-900/30 text-green-400' : 'bg-neutral-800 text-neutral-500'}`}>
                                {item.analysis.hasStrummingPattern ? '✓' : '✗'} 掃弦節奏
                              </div>
                              <div className={`p-2 rounded ${item.analysis.hasChorus ? 'bg-green-900/30 text-green-400' : 'bg-neutral-800 text-neutral-500'}`}>
                                {item.analysis.hasChorus ? '✓' : '✗'} 副歌標記
                              </div>
                              <div className={`p-2 rounded ${item.analysis.hasBridge ? 'bg-green-900/30 text-green-400' : 'bg-neutral-800 text-neutral-500'}`}>
                                {item.analysis.hasBridge ? '✓' : '✗'} 橋段標記
                              </div>
                            </div>
                            
                            {/* 內容預覽 */}
                            <div>
                              <div className="text-sm text-neutral-400 mb-1">內容預覽 (前500字符):</div>
                              <pre className="text-xs text-neutral-500 bg-black p-3 rounded overflow-x-auto max-h-40 overflow-y-auto">
                                {item.analysis.contentPreview}
                              </pre>
                            </div>
                          </div>
                          
                          {/* 單獨分析按鈕 */}
                          <div className="mt-4 flex gap-2">
                            <button
                              onClick={() => analyzeSingle(item.id, item.title)}
                              className="px-3 py-1 bg-[#FFD700] text-black text-sm rounded hover:opacity-80"
                            >
                              🔄 重新分析此譜
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {expandedItems.has(i) && item.status === 'skipped' && (
                        <div className="p-4 border-t border-neutral-700 bg-neutral-900/50 text-neutral-400">
                          {item.reason}
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
        <div className="mt-6 p-4 bg-neutral-900 rounded-lg text-sm text-neutral-400">
          <h3 className="font-bold text-white mb-2">💡 使用說明</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>點擊結果展開查看詳細分析（所有和弦、內容預覽）</li>
            <li>難度主要基於和弦數量判斷：≤5個=初階，6-9個=中級，≥10個=進階</li>
            <li>Barre 和弦僅作提示，因為用戶可以轉 Key 避開</li>
            <li>如果分析不準確，可以點「重新分析此譜」或調整和弦識別規則</li>
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

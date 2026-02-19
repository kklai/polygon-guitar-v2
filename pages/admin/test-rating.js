import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { submitRating, getUserRating, getTabStats } from '@/lib/ratingApi'
import { getAllTabs } from '@/lib/tabs'

function TestRatingPage() {
  const { user } = useAuth()
  const [tabs, setTabs] = useState([])
  const [selectedTabId, setSelectedTabId] = useState('')
  const [rating, setRating] = useState(5)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    loadTabs()
  }, [])

  const loadTabs = async () => {
    const allTabs = await getAllTabs()
    setTabs(allTabs.slice(0, 20)) // 只顯示前20個
  }

  const handleSubmit = async () => {
    if (!user || !selectedTabId) return
    
    setLoading(true)
    setResult(null)
    
    try {
      const submitResult = await submitRating(user.uid, selectedTabId, rating)
      setResult(submitResult)
      
      // 刷新統計
      const statsResult = await getTabStats(selectedTabId)
      setStats(statsResult)
      
      // 檢查用戶評分
      const myRating = await getUserRating(user.uid, selectedTabId)
      console.log('我的評分:', myRating)
      
    } catch (error) {
      setResult({ error: error.message })
    }
    
    setLoading(false)
  }

  const checkStats = async () => {
    if (!selectedTabId) return
    const statsResult = await getTabStats(selectedTabId)
    setStats(statsResult)
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-white mb-6">評分功能測試</h1>
        
        {/* 用戶資訊 */}
        <div className="bg-[#121212] rounded-lg p-4 mb-6 border border-gray-800">
          <h2 className="text-lg font-medium text-white mb-2">用戶資訊</h2>
          {user ? (
            <div className="text-gray-400 text-sm">
              <p>UID: <span className="text-[#FFD700]">{user.uid}</span></p>
              <p>Email: {user.email}</p>
            </div>
          ) : (
            <p className="text-red-400">請先登入</p>
          )}
        </div>

        {/* 選擇樂譜 */}
        <div className="bg-[#121212] rounded-lg p-4 mb-6 border border-gray-800">
          <h2 className="text-lg font-medium text-white mb-4">1. 選擇樂譜</h2>
          <select 
            value={selectedTabId}
            onChange={(e) => setSelectedTabId(e.target.value)}
            className="w-full px-4 py-3 bg-white/10 rounded-lg text-white mb-4"
          >
            <option value="">-- 選擇一首歌曲 --</option>
            {tabs.map(tab => (
              <option key={tab.id} value={tab.id}>
                {tab.artist} - {tab.title} (ID: {tab.id})
              </option>
            ))}
          </select>
          
          {selectedTabId && (
            <p className="text-sm text-gray-500">
              選中的 Tab ID: <span className="text-[#FFD700]">{selectedTabId}</span>
            </p>
          )}
        </div>

        {/* 選擇評分 */}
        <div className="bg-[#121212] rounded-lg p-4 mb-6 border border-gray-800">
          <h2 className="text-lg font-medium text-white mb-4">2. 選擇評分</h2>
          <div className="flex gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`w-12 h-12 rounded-lg text-xl font-bold transition ${
                  rating === star 
                    ? 'bg-[#FFD700] text-black' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {star}
              </button>
            ))}
          </div>
          <p className="text-gray-500 text-sm">當前選擇: {rating} 星</p>
        </div>

        {/* 操作按鈕 */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={handleSubmit}
            disabled={!user || !selectedTabId || loading}
            className="flex-1 py-3 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '提交中...' : '提交評分'}
          </button>
          
          <button
            onClick={checkStats}
            disabled={!selectedTabId}
            className="flex-1 py-3 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition disabled:opacity-50"
          >
            查看統計
          </button>
        </div>

        {/* 結果顯示 */}
        {result && (
          <div className={`rounded-lg p-4 mb-6 ${result.error ? 'bg-red-900/30 border border-red-700' : 'bg-green-900/30 border border-green-700'}`}>
            <h3 className="text-lg font-medium mb-2">{result.error ? '錯誤' : '提交結果'}</h3>
            <pre className="text-sm text-gray-300 overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        {/* 統計顯示 */}
        {stats && (
          <div className="bg-[#121212] rounded-lg p-4 border border-gray-800">
            <h3 className="text-lg font-medium text-white mb-2">樂譜統計</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 p-3 rounded">
                <p className="text-xs text-gray-500">平均分</p>
                <p className="text-xl text-[#FFD700]">{stats.averageRating?.toFixed(2) || 0}</p>
              </div>
              <div className="bg-white/5 p-3 rounded">
                <p className="text-xs text-gray-500">評分數</p>
                <p className="text-xl text-white">{stats.ratingCount || 0}</p>
              </div>
              <div className="bg-white/5 p-3 rounded">
                <p className="text-xs text-gray-500">總分</p>
                <p className="text-xl text-white">{stats.totalRating || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* 說明 */}
        <div className="mt-8 p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
          <h3 className="text-blue-400 font-medium mb-2">測試說明</h3>
          <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
            <li>選擇一首歌曲，給予 1-5 星評分</li>
            <li>點「提交評分」後，檢查 Firestore 是否有新記錄</li>
            <li>ratings 集合應該有文檔 ID: <code>{'{userId}_{tabId}'}</code></li>
            <li>tabs 集合對應歌曲應該更新 averageRating / ratingCount</li>
            <li>再次點同一星星 = 取消評分</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

export default function TestRatingPageWithGuard() {
  return (
    <AdminGuard>
      <TestRatingPage />
    </AdminGuard>
  )
}

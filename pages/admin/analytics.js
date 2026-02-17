import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { db } from '@/lib/firebase'
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  limit,
  Timestamp,
  onSnapshot
} from 'firebase/firestore'

function AnalyticsDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState({
    today: 0,
    yesterday: 0,
    last7Days: 0,
    last30Days: 0,
    total: 0
  })
  const [pageTypeStats, setPageTypeStats] = useState([])
  const [topPages, setTopPages] = useState([])
  const [recentViews, setRecentViews] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [dateRange, setDateRange] = useState('today') // today, yesterday, 7days, 30days

  useEffect(() => {
    loadStats()
    
    // 實時監聽今日數據
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'pageViews'),
        where('timestamp', '>=', Timestamp.fromDate(today)),
        orderBy('timestamp', 'desc')
      ),
      (snapshot) => {
        setStats(prev => ({ ...prev, today: snapshot.size }))
        
        // 更新最近訪問列表
        const views = []
        snapshot.docs.slice(0, 20).forEach(doc => {
          views.push({ id: doc.id, ...doc.data() })
        })
        setRecentViews(views)
      },
      (error) => {
        console.error('Realtime stats error:', error)
      }
    )
    
    return () => unsubscribe()
  }, [])

  const loadStats = async () => {
    setIsLoading(true)
    try {
      // 計算各時間段
      const now = new Date()
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      
      const last7Days = new Date(today)
      last7Days.setDate(last7Days.getDate() - 7)
      
      const last30Days = new Date(today)
      last30Days.setDate(last30Days.getDate() - 30)

      // 並行查詢各時間段
      const [
        todaySnap,
        yesterdaySnap,
        last7DaysSnap,
        last30DaysSnap,
        totalSnap
      ] = await Promise.all([
        getDocs(query(
          collection(db, 'pageViews'),
          where('timestamp', '>=', Timestamp.fromDate(today))
        )),
        getDocs(query(
          collection(db, 'pageViews'),
          where('timestamp', '>=', Timestamp.fromDate(yesterday)),
          where('timestamp', '<', Timestamp.fromDate(today))
        )),
        getDocs(query(
          collection(db, 'pageViews'),
          where('timestamp', '>=', Timestamp.fromDate(last7Days))
        )),
        getDocs(query(
          collection(db, 'pageViews'),
          where('timestamp', '>=', Timestamp.fromDate(last30Days))
        )),
        getDocs(collection(db, 'pageViews'))
      ])

      setStats({
        today: todaySnap.size,
        yesterday: yesterdaySnap.size,
        last7Days: last7DaysSnap.size,
        last30Days: last30DaysSnap.size,
        total: totalSnap.size
      })

      // 計算頁面類型分布
      const typeCount = {}
      last30DaysSnap.forEach(doc => {
        const type = doc.data().pageType || 'other'
        typeCount[type] = (typeCount[type] || 0) + 1
      })
      
      const typeStats = Object.entries(typeCount)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
      
      setPageTypeStats(typeStats)

      // 熱門頁面（最近30天）
      const pageCount = {}
      last30DaysSnap.forEach(doc => {
        const data = doc.data()
        const key = data.pageId 
          ? `${data.pageType}:${data.pageId}`
          : data.pagePath
        
        if (!pageCount[key]) {
          pageCount[key] = {
            key,
            pageType: data.pageType,
            pageId: data.pageId,
            pageTitle: data.pageTitle || key,
            path: data.pagePath,
            count: 0
          }
        }
        pageCount[key].count++
      })

      const top = Object.values(pageCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
      
      setTopPages(top)

    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getPageTypeLabel = (type) => {
    const labels = {
      'tab': '🎵 樂譜頁',
      'artist': '👤 歌手頁',
      'artists-list': '📋 歌手列表',
      'home': '🏠 首頁',
      'search': '🔍 搜尋頁',
      'library': '📚 樂譜庫',
      'playlist': '📀 歌單',
      'admin': '⚙️ 後台',
      'login': '🔐 登入',
      'other': '📄 其他'
    }
    return labels[type] || type
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleTimeString('zh-HK', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 pb-8">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-gray-800 -mx-4 px-4 py-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>📊</span> 全站瀏覽統計
              </h1>
              <p className="text-sm text-[#B3B3B3]">類似 Google Analytics 的頁面瀏覽追蹤</p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="text-[#B3B3B3] hover:text-white transition"
            >
              返回後台
            </button>
          </div>
        </div>

        {/* 主要統計卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-sm">今日瀏覽</p>
            <p className="text-2xl font-bold text-[#FFD700]">{stats.today.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">實時更新</p>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-sm">昨日瀏覽</p>
            <p className="text-2xl font-bold text-white">{stats.yesterday.toLocaleString()}</p>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-sm">近7天</p>
            <p className="text-2xl font-bold text-white">{stats.last7Days.toLocaleString()}</p>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-sm">近30天</p>
            <p className="text-2xl font-bold text-white">{stats.last30Days.toLocaleString()}</p>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-sm">總瀏覽</p>
            <p className="text-2xl font-bold text-blue-400">{stats.total.toLocaleString()}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">載入統計數據...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* 頁面類型分布 */}
            <div className="bg-[#121212] rounded-xl border border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h2 className="text-lg font-medium text-white">📈 頁面類型分布（30天）</h2>
              </div>
              <div className="p-4">
                {pageTypeStats.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">暫無數據</p>
                ) : (
                  <div className="space-y-3">
                    {pageTypeStats.map(({ type, count }) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-gray-300">{getPageTypeLabel(type)}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#FFD700]"
                              style={{ 
                                width: `${(count / stats.last30Days * 100).toFixed(1)}%` 
                              }}
                            />
                          </div>
                          <span className="text-white font-medium w-16 text-right">
                            {count.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 熱門頁面 */}
            <div className="bg-[#121212] rounded-xl border border-gray-800">
              <div className="p-4 border-b border-gray-800">
                <h2 className="text-lg font-medium text-white">🔥 熱門頁面（30天）</h2>
              </div>
              <div className="p-4 max-h-96 overflow-y-auto">
                {topPages.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">暫無數據</p>
                ) : (
                  <div className="space-y-2">
                    {topPages.map((page, index) => (
                      <div 
                        key={page.key}
                        className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg cursor-pointer"
                        onClick={() => router.push(page.path)}
                      >
                        <span className="text-gray-500 w-6">{index + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">
                            {page.pageTitle || page.key}
                          </p>
                          <p className="text-xs text-gray-500">{getPageTypeLabel(page.pageType)}</p>
                        </div>
                        <span className="text-[#FFD700] font-medium">
                          {page.count.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 最近訪問 */}
            <div className="bg-[#121212] rounded-xl border border-gray-800 md:col-span-2">
              <div className="p-4 border-b border-gray-800">
                <h2 className="text-lg font-medium text-white">🕐 最近訪問（實時）</h2>
              </div>
              <div className="p-4 max-h-80 overflow-y-auto">
                {recentViews.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">暫無數據</p>
                ) : (
                  <div className="space-y-2">
                    {recentViews.map((view) => (
                      <div 
                        key={view.id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg text-sm"
                      >
                        <span className="text-gray-500 w-16">
                          {formatTime(view.timestamp)}
                        </span>
                        <span className="text-blue-400 w-20">
                          {getPageTypeLabel(view.pageType)}
                        </span>
                        <span 
                          className="text-white flex-1 truncate cursor-pointer hover:text-[#FFD700]"
                          onClick={() => router.push(view.pagePath)}
                        >
                          {view.pageTitle || view.pagePath}
                        </span>
                        <span className="text-gray-500 text-xs hidden md:block">
                          {view.screenResolution}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 說明 */}
        <div className="mt-6 bg-[#1a1a2e] rounded-xl p-4 border border-blue-900/50">
          <h3 className="text-blue-300 font-medium mb-2">💡 統計說明</h3>
          <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
            <li>統計包含<strong>所有訪客</strong>（包括未登入用戶）</li>
            <li>每次頁面載入都會記錄（包括刷新）</li>
            <li>自動過濾機器人/爬蟲訪問</li>
            <li>本地開發環境（localhost）不會記錄</li>
            <li>數據儲存在 Firestore <code>pageViews</code> 集合</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

export default function AnalyticsGuard() {
  return (
    <AdminGuard>
      <AnalyticsDashboard />
    </AdminGuard>
  )
}

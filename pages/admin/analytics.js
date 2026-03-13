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
  onSnapshot,
  doc,
  getDoc,
  getCountFromServer
} from '@/lib/firestore-tracked'

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
  const [dailyTrend, setDailyTrend] = useState([])
  const [hourlyStats, setHourlyStats] = useState([])
  const [dailyUsers, setDailyUsers] = useState([])  // 每日獨立用戶數
  const [peakHours, setPeakHours] = useState([])    // 高峰時段
  const [isLoading, setIsLoading] = useState(true)
  const [dateRange, setDateRange] = useState('7days')

  useEffect(() => {
    loadStats()
    loadTrendData()
    loadDailyUsers()
    loadPeakHours()
    
    // 實時監聽今日數據（只取最近 100 筆，避免大量 reads）
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const todayQueryLimited = query(
      collection(db, 'pageViews'),
      where('timestamp', '>=', Timestamp.fromDate(today)),
      orderBy('timestamp', 'desc'),
      limit(100)
    )
    const todayCountQuery = query(
      collection(db, 'pageViews'),
      where('timestamp', '>=', Timestamp.fromDate(today)),
      orderBy('timestamp', 'desc')
    )
    
    const unsubscribe = onSnapshot(
      todayQueryLimited,
      async (snapshot) => {
        const filteredDocs = snapshot.docs.filter(d => {
          const data = d.data()
          return !(data.pageType === 'admin' ||
                  (data.pagePath && data.pagePath.startsWith('/admin')))
        })
        const views = filteredDocs.slice(0, 20).map(d => ({ id: d.id, ...d.data() }))
        setRecentViews(views)
        // 今日總數用 count 查詢（約 1 read），不讀取全部文檔
        try {
          const countSnap = await getCountFromServer(todayCountQuery)
          setStats(prev => ({ ...prev, today: countSnap.data().count }))
        } catch (e) {
          setStats(prev => ({ ...prev, today: filteredDocs.length }))
        }
      },
      (error) => {
        console.error('Realtime stats error:', error)
      }
    )
    
    return () => unsubscribe()
  }, [])

  // 加載趨勢數據（最近7天每天）- 用 getCountFromServer，不讀取文檔
  const loadTrendData = async () => {
    const trend = []
    const now = new Date()
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)
      
      try {
        const countSnap = await getCountFromServer(query(
          collection(db, 'pageViews'),
          where('timestamp', '>=', Timestamp.fromDate(date)),
          where('timestamp', '<', Timestamp.fromDate(nextDate))
        ))
        const count = countSnap.data().count
        trend.push({
          date: date.toLocaleDateString('zh-HK', { month: 'short', day: 'numeric' }),
          day: date.toLocaleDateString('zh-HK', { weekday: 'short' }),
          count,
          fullDate: date
        })
      } catch (e) {
        trend.push({ date: date.toLocaleDateString('zh-HK', { month: 'short', day: 'numeric' }), day: date.toLocaleDateString('zh-HK', { weekday: 'short' }), count: 0 })
      }
    }
    
    setDailyTrend(trend)
  }

  // 加載每日獨立用戶數
  const loadDailyUsers = async () => {
    const userStats = []
    const now = new Date()
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)
      
      try {
        const snap = await getDocs(query(
          collection(db, 'pageViews'),
          where('timestamp', '>=', Timestamp.fromDate(date)),
          where('timestamp', '<', Timestamp.fromDate(nextDate)),
          orderBy('timestamp', 'desc'),
          limit(5000)
        ))
        
        // 去重：按 sessionId 或用戶ID（基於取樣，最多 5000 筆/天）
        const uniqueSessions = new Set()
        let loggedInUsers = 0
        
        snap.docs.forEach(doc => {
          const data = doc.data()
          const isAdmin = data.pageType === 'admin' || 
                         (data.pagePath && data.pagePath.startsWith('/admin'))
          if (isAdmin) return
          
          // 優先使用 sessionId，其次 userId
          const id = data.sessionId || data.userId || 'anonymous'
          uniqueSessions.add(id)
          
          if (data.userId) loggedInUsers++
        })
        
        userStats.push({
          date: date.toLocaleDateString('zh-HK', { month: 'short', day: 'numeric' }),
          day: date.toLocaleDateString('zh-HK', { weekday: 'short' }),
          totalUsers: uniqueSessions.size,
          loggedInUsers,
          anonymousUsers: uniqueSessions.size - loggedInUsers,
          fullDate: date
        })
      } catch (e) {
        userStats.push({
          date: date.toLocaleDateString('zh-HK', { month: 'short', day: 'numeric' }),
          day: date.toLocaleDateString('zh-HK', { weekday: 'short' }),
          totalUsers: 0,
          loggedInUsers: 0,
          anonymousUsers: 0
        })
      }
    }
    
    setDailyUsers(userStats)
  }

  // 加載高峰時段（按小時統計）- 限制 10000 筆避免大量 reads
  const loadPeakHours = async () => {
    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    sevenDaysAgo.setHours(0, 0, 0, 0)
    
    try {
      const snap = await getDocs(query(
        collection(db, 'pageViews'),
        where('timestamp', '>=', Timestamp.fromDate(sevenDaysAgo)),
        orderBy('timestamp', 'desc'),
        limit(10000)
      ))
      
      // 按小時統計（0-23）
      const hourCount = Array(24).fill(0)
      const hourUniqueUsers = Array.from({ length: 24 }, () => new Set())
      
      snap.docs.forEach(doc => {
        const data = doc.data()
        const isAdmin = data.pageType === 'admin' || 
                       (data.pagePath && data.pagePath.startsWith('/admin'))
        if (isAdmin) return
        
        const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp)
        const hour = timestamp.getHours()
        
        hourCount[hour]++
        
        const id = data.sessionId || data.userId || 'anonymous'
        hourUniqueUsers[hour].add(id)
      })
      
      const hourlyData = hourCount.map((count, hour) => ({
        hour,
        hourLabel: `${hour.toString().padStart(2, '0')}:00`,
        count,
        uniqueUsers: hourUniqueUsers[hour].size
      }))
      
      setPeakHours(hourlyData)
    } catch (e) {
      console.error('Error loading peak hours:', e)
    }
  }

  const loadStats = async () => {
    setIsLoading(true)
    try {
      const now = new Date()
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      
      const last7Days = new Date(today)
      last7Days.setDate(last7Days.getDate() - 7)
      
      const last30Days = new Date(today)
      last30Days.setDate(last30Days.getDate() - 30)

      // 用 getCountFromServer 取數量，不讀取文檔（每查詢約 1 read，不會 588K）
      const [
        todayCountSnap,
        yesterdayCountSnap,
        last7CountSnap,
        last30CountSnap,
        totalCountSnap
      ] = await Promise.all([
        getCountFromServer(query(
          collection(db, 'pageViews'),
          where('timestamp', '>=', Timestamp.fromDate(today))
        )),
        getCountFromServer(query(
          collection(db, 'pageViews'),
          where('timestamp', '>=', Timestamp.fromDate(yesterday)),
          where('timestamp', '<', Timestamp.fromDate(today))
        )),
        getCountFromServer(query(
          collection(db, 'pageViews'),
          where('timestamp', '>=', Timestamp.fromDate(last7Days))
        )),
        getCountFromServer(query(
          collection(db, 'pageViews'),
          where('timestamp', '>=', Timestamp.fromDate(last30Days))
        )),
        getCountFromServer(collection(db, 'pageViews'))
      ])

      setStats({
        today: todayCountSnap.data().count,
        yesterday: yesterdayCountSnap.data().count,
        last7Days: last7CountSnap.data().count,
        last30Days: last30CountSnap.data().count,
        total: totalCountSnap.data().count
      })

      // 頁面類型分布與熱門頁面：只取最近 30 天內最多 5000 筆（避免全表讀取）
      const last30DocsQuery = query(
        collection(db, 'pageViews'),
        where('timestamp', '>=', Timestamp.fromDate(last30Days)),
        orderBy('timestamp', 'desc'),
        limit(5000)
      )
      const last30DaysSnap = await getDocs(last30DocsQuery)

      const typeCount = {}
      const pageCount = {}
      
      last30DaysSnap.docs.forEach(doc => {
        const data = doc.data()
        const isAdmin = data.pageType === 'admin' || 
                       (data.pagePath && data.pagePath.startsWith('/admin'))
        if (isAdmin) return
        
        const type = data.pageType || 'other'
        typeCount[type] = (typeCount[type] || 0) + 1
        
        const key = data.pageId 
          ? `${data.pageType}:${data.pageId}`
          : data.pagePath
        
        if (!pageCount[key]) {
          pageCount[key] = {
            key,
            pageType: data.pageType,
            pageId: data.pageId,
            pageTitle: data.pageTitle || key,
            pageName: data.pageName || data.pageTitle || '',
            artistName: data.artistName || '',
            path: data.pagePath,
            count: 0
          }
        }
        pageCount[key].count++
        if (data.pageName && !pageCount[key].pageName) {
          pageCount[key].pageName = data.pageName
        }
        if (data.artistName && !pageCount[key].artistName) {
          pageCount[key].artistName = data.artistName
        }
      })
      
      const typeStats = Object.entries(typeCount)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
      
      setPageTypeStats(typeStats)

      // 加載額外詳細信息（歌曲名、歌手名）
      const topPageEntries = Object.values(pageCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
      
      // 為 tab 和 artist 類型加載詳細信息
      const enrichedPages = await Promise.all(
        topPageEntries.map(async (page) => {
          if (page.pageType === 'tab' && page.pageId) {
            try {
              const tabDoc = await getDoc(doc(db, 'tabs', page.pageId))
              if (tabDoc.exists()) {
                const tabData = tabDoc.data()
                return {
                  ...page,
                  pageName: tabData.title || page.pageName,
                  artistName: tabData.artist || page.artistName,
                  thumbnail: tabData.thumbnail || tabData.albumImage
                }
              }
            } catch (e) {}
          }
          if (page.pageType === 'artist' && page.pageId) {
            try {
              const artistDoc = await getDoc(doc(db, 'artists', page.pageId))
              if (artistDoc.exists()) {
                const artistData = artistDoc.data()
                return {
                  ...page,
                  pageName: artistData.name || page.pageName,
                  photoURL: artistData.photoURL || artistData.wikiPhotoURL
                }
              }
            } catch (e) {}
          }
          return page
        })
      )
      
      setTopPages(enrichedPages)

    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getPageTypeLabel = (type) => {
    const labels = {
      'tab': '🎵 樂譜',
      'artist': '👤 歌手',
      'artists-list': '📋 歌手列表',
      'home': '🏠 首頁',
      'search': '🔍 搜尋',
      'library': '📚 樂譜庫',
      'playlist': '📀 歌單',
      'admin': '⚙️ 後台',
      'login': '🔐 登入',
      'other': '📄 其他'
    }
    return labels[type] || type
  }

  const getPageTypeColor = (type) => {
    const colors = {
      'tab': '#FFD700',
      'artist': '#1fc3df',
      'home': '#10b981',
      'search': '#f59e0b',
      'library': '#8b5cf6',
      'playlist': '#ec4899',
      'other': '#6b7280'
    }
    return colors[type] || '#6b7280'
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

  // 計算最大值的百分比（用於圖表）
  const maxTrend = Math.max(...dailyTrend.map(d => d.count), 1)
  const maxType = Math.max(...pageTypeStats.map(t => t.count), 1)

  // 清理標題，移除通用的 Polygon Guitar 標題
  const cleanTitle = (title) => {
    if (!title) return ''
    
    // 移除各種變體的通用標題
    let cleaned = title
      .replace(/Polygon Guitar - 香港最大結他譜庫 \| 3000\+ 結他譜/gi, '')
      .replace(/Polygon Guitar - .*/gi, '')
      .replace(/ - Polygon Guitar/gi, '')
      .replace(/歌手分類 - Polygon Guitar/gi, '歌手分類')
      .trim()
    
    // 如果清理後為空或只剩空白，返回空字符串
    return cleaned || ''
  }

  // 從 path 獲取可讀名稱
  const getNameFromPath = (path, pageType) => {
    if (!path) return null
    
    const parts = path.split('/').filter(Boolean)
    const lastPart = parts[parts.length - 1]
    
    if (!lastPart) return null
    
    // 將 slug 轉換為可讀名稱
    // e.g., "eason-chan" -> "Eason Chan", "mc-zhang-tian-fu" -> "Mc Zhang Tian Fu"
    return lastPart
      .replace(/-/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase())
  }

  // 獲取頁面顯示名稱
  const getPageDisplayName = (page) => {
    // 優先使用 pageName（歌曲名/歌手名）- 這是最準確的
    if (page.pageName && page.pageName.trim()) {
      return page.pageName
    }
    
    // 其次使用清理後的 pageTitle
    const cleanedTitle = cleanTitle(page.pageTitle)
    if (cleanedTitle) {
      return cleanedTitle
    }
    
    // 嘗試從 path 提取名稱
    const pathName = getNameFromPath(page.path, page.pageType)
    if (pathName) {
      return pathName
    }
    
    // 根據類型返回默認名稱
    const defaultNames = {
      'tab': '樂譜頁面',
      'artist': '歌手頁面',
      'home': '🏠 首頁',
      'search': '🔍 搜尋',
      'library': '📚 樂譜庫',
      'login': '🔐 登入',
      'artists-list': '📋 歌手列表'
    }
    
    return defaultNames[page.pageType] || page.path || '未知頁面'
  }

  // 獲取副標題（歌手名等）
  const getPageSubtitle = (page) => {
    if (page.pageType === 'tab') {
      // 樂譜顯示歌手名
      if (page.artistName) {
        return `🎤 ${page.artistName}`
      }
      return '🎵 樂譜'
    }
    if (page.pageType === 'artist') {
      // 歌手頁顯示統計
      return '👤 歌手主頁'
    }
    return getPageTypeLabel(page.pageType)
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-neutral-800 -mx-4 px-4 py-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>📊</span> 全站瀏覽統計
              </h1>
              <p className="text-sm text-[#B3B3B3]">實時追蹤所有頁面瀏覽數據</p>
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
          <div className="bg-[#121212] rounded-xl p-4 border border-neutral-800">
            <p className="text-neutral-400 text-sm">今日瀏覽</p>
            <p className="text-2xl font-bold text-[#FFD700]">{stats.today.toLocaleString()}</p>
            <p className="text-xs text-neutral-500 mt-1">實時更新</p>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-neutral-800">
            <p className="text-neutral-400 text-sm">昨日瀏覽</p>
            <p className="text-2xl font-bold text-white">{stats.yesterday.toLocaleString()}</p>
            {stats.today > stats.yesterday && (
              <p className="text-xs text-green-400 mt-1">↗ 較昨日多</p>
            )}
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-neutral-800">
            <p className="text-neutral-400 text-sm">近7天</p>
            <p className="text-2xl font-bold text-white">{stats.last7Days.toLocaleString()}</p>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-neutral-800">
            <p className="text-neutral-400 text-sm">近30天</p>
            <p className="text-2xl font-bold text-white">{stats.last30Days.toLocaleString()}</p>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-neutral-800">
            <p className="text-neutral-400 text-sm">總瀏覽</p>
            <p className="text-2xl font-bold text-blue-400">{stats.total.toLocaleString()}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-neutral-400">載入統計數據...</p>
          </div>
        ) : (
          <>
            {/* 7天趨勢圖表 */}
            <div className="bg-[#121212] rounded-xl border border-neutral-800 mb-6">
              <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                <h2 className="text-lg font-medium text-white">📈 7天瀏覽趨勢</h2>
                <span className="text-sm text-neutral-500">最近7天每日瀏覽量</span>
              </div>
              <div className="p-6">
                <div className="flex items-end gap-2 h-48">
                  {dailyTrend.map((day, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full flex flex-col items-center gap-1">
                        <span className="text-xs text-neutral-400">{day.count}</span>
                        <div 
                          className="w-full bg-[#FFD700] rounded-t transition-all duration-500"
                          style={{ 
                            height: `${(day.count / maxTrend) * 160}px`,
                            opacity: 0.6 + (day.count / maxTrend) * 0.4
                          }}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-white">{day.day}</p>
                        <p className="text-[10px] text-neutral-500">{day.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mb-6">
              {/* 頁面類型分布 - 圓環圖樣式 */}
              <div className="bg-[#121212] rounded-xl border border-neutral-800">
                <div className="p-4 border-b border-neutral-800">
                  <h2 className="text-lg font-medium text-white">🥧 頁面類型分布（30天）</h2>
                </div>
                <div className="p-4">
                  {pageTypeStats.length === 0 ? (
                    <p className="text-neutral-500 text-center py-4">暫無數據</p>
                  ) : (
                    <>
                      {/* 簡單圓環圖 */}
                      <div className="flex items-center gap-6 mb-6">
                        <div className="relative w-32 h-32">
                          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                            {pageTypeStats.reduce((acc, { type, count }, idx, arr) => {
                              const total = arr.reduce((s, i) => s + i.count, 0)
                              const prevTotal = arr.slice(0, idx).reduce((s, i) => s + i.count, 0)
                              const percentage = count / total
                              const prevPercentage = prevTotal / total
                              
                              const circumference = 2 * Math.PI * 40
                              const strokeDasharray = `${percentage * circumference} ${circumference}`
                              const strokeDashoffset = -prevPercentage * circumference
                              
                              acc.push(
                                <circle
                                  key={type}
                                  cx="50"
                                  cy="50"
                                  r="40"
                                  fill="none"
                                  stroke={getPageTypeColor(type)}
                                  strokeWidth="20"
                                  strokeDasharray={strokeDasharray}
                                  strokeDashoffset={strokeDashoffset}
                                />
                              )
                              return acc
                            }, [])}
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xl font-bold text-white">
                              {stats.last30Days.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        
                        {/* 圖例 */}
                        <div className="flex-1 space-y-2">
                          {pageTypeStats.slice(0, 5).map(({ type, count }) => {
                            const total = pageTypeStats.reduce((s, i) => s + i.count, 0)
                            const percentage = ((count / total) * 100).toFixed(1)
                            return (
                              <div key={type} className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: getPageTypeColor(type) }}
                                />
                                <span className="text-neutral-300 text-sm flex-1">{getPageTypeLabel(type)}</span>
                                <span className="text-white text-sm font-medium">{percentage}%</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      
                      {/* 詳細列表 */}
                      <div className="space-y-2">
                        {pageTypeStats.map(({ type, count }) => (
                          <div key={type} className="flex items-center justify-between p-2 hover:bg-neutral-800 rounded">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: getPageTypeColor(type) }}
                              />
                              <span className="text-neutral-300">{getPageTypeLabel(type)}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-24 h-2 bg-neutral-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full rounded-full"
                                  style={{ 
                                    width: `${(count / maxType * 100).toFixed(1)}%`,
                                    backgroundColor: getPageTypeColor(type)
                                  }}
                                />
                              </div>
                              <span className="text-white font-medium w-14 text-right">
                                {count.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 熱門頁面 - 帶詳細信息 */}
              <div className="bg-[#121212] rounded-xl border border-neutral-800">
                <div className="p-4 border-b border-neutral-800">
                  <h2 className="text-lg font-medium text-white">🔥 熱門頁面（30天）</h2>
                </div>
                <div className="p-4 max-h-[500px] overflow-y-auto">
                  {topPages.length === 0 ? (
                    <p className="text-neutral-500 text-center py-4">暫無數據</p>
                  ) : (
                    <div className="space-y-2">
                      {topPages.map((page, index) => (
                        <div 
                          key={page.key}
                          className="flex items-center gap-3 p-2 hover:bg-neutral-800 rounded-lg cursor-pointer group"
                          onClick={() => router.push(page.path)}
                        >
                          {/* 排名 */}
                          <span className={`
                            w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold
                            ${index < 3 ? 'bg-[#FFD700] text-black' : 'bg-neutral-800 text-neutral-400'}
                          `}>
                            {index + 1}
                          </span>
                          
                          {/* 縮圖（如果有） */}
                          {(page.thumbnail || page.photoURL) ? (
                            <img 
                              src={page.thumbnail || page.photoURL} 
                              alt=""
                              className="w-10 h-10 rounded object-cover bg-neutral-800"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-neutral-800 flex items-center justify-center text-lg">
                              {page.pageType === 'tab' ? '🎵' : 
                               page.pageType === 'artist' ? '👤' : 
                               page.pageType === 'home' ? '🏠' : '📄'}
                            </div>
                          )}
                          
                          {/* 標題和副標題 */}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate group-hover:text-[#FFD700] transition">
                              {getPageDisplayName(page)}
                            </p>
                            <p className="text-xs text-neutral-500 truncate">
                              {getPageSubtitle(page)}
                            </p>
                          </div>
                          
                          {/* 瀏覽數 */}
                          <div className="text-right">
                            <span className="text-[#FFD700] font-bold">
                              {page.count.toLocaleString()}
                            </span>
                            <p className="text-[10px] text-neutral-500">瀏覽</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 最近訪問 */}
            <div className="bg-[#121212] rounded-xl border border-neutral-800">
              <div className="p-4 border-b border-neutral-800">
                <h2 className="text-lg font-medium text-white">🕐 最近訪問（實時）</h2>
              </div>
              <div className="p-4 max-h-80 overflow-y-auto">
                {recentViews.length === 0 ? (
                  <p className="text-neutral-500 text-center py-4">暫無數據</p>
                ) : (
                  <div className="space-y-2">
                    {recentViews.map((view) => (
                      <div 
                        key={view.id}
                        className="flex items-center gap-3 p-2 hover:bg-neutral-800 rounded-lg text-sm"
                      >
                        <span className="text-neutral-500 w-16 text-xs">
                          {formatTime(view.timestamp)}
                        </span>
                        <span className="text-blue-400 w-20 text-xs">
                          {getPageTypeLabel(view.pageType)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span 
                            className="text-white truncate cursor-pointer hover:text-[#FFD700] block"
                            onClick={() => router.push(view.pagePath)}
                          >
                            {view.pageName || cleanTitle(view.pageTitle) || getNameFromPath(view.pagePath, view.pageType) || view.pagePath}
                          </span>
                          {view.artistName && (
                            <span className="text-neutral-500 text-xs">🎤 {view.artistName}</span>
                          )}
                        </div>
                        <span className="text-neutral-500 text-xs hidden md:block">
                          {view.screenResolution}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* 說明 */}
        <div className="mt-6 bg-[#1a1a2e] rounded-xl p-4 border border-blue-900/50">
          <h3 className="text-blue-300 font-medium mb-2">💡 統計說明</h3>
          <ul className="text-sm text-neutral-400 space-y-1 list-disc list-inside">
            <li>統計包含<strong>所有訪客</strong>（包括未登入用戶）</li>
            <li>每次頁面載入都會記錄（包括刷新）</li>
            <li>熱門頁面會實時加載歌曲名和歌手名</li>
            <li>數據儲存在 Firestore <code>pageViews</code> 集合</li>
            <li><strong>獨立用戶：</strong>按 Session ID 去重，同一用戶多次訪問只計一次</li>
            <li><strong>高峰時段：</strong>按香港時間統計，顯示 7 天平均分布</li>
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

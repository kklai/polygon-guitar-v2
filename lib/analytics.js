// 全站頁面瀏覽統計
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

/**
 * 記錄頁面瀏覽
 * @param {string} pageType - 頁面類型：'tab', 'artist', 'home', 'search', 'library', 'admin' 等
 * @param {string} pageId - 頁面 ID（如 tab ID 或 artist ID）
 * @param {string} pageTitle - 頁面標題
 * @param {Object} metadata - 額外數據
 */
export async function recordPageView(pageType, pageId = null, pageTitle = '', metadata = {}, userId = null) {
  try {
    // 檢查是否為機器人/爬蟲（簡單過濾）
    const userAgent = navigator.userAgent.toLowerCase()
    const isBot = /bot|crawler|spider|crawling|googlebot|bingbot|baiduspider/i.test(userAgent)
    if (isBot) return

    // 檢查是否本地開發（只在 localhost 或 127.0.0.1 時跳過）
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1') return

    const data = {
      pageType,
      pageId,
      pageTitle,
      pagePath: window.location.pathname,
      pageUrl: window.location.href,
      referrer: document.referrer || null,
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language,
      timestamp: serverTimestamp(),
      userId: userId || null, // 添加用戶ID
      // 可選的額外數據
      ...metadata
    }

    await addDoc(collection(db, 'pageViews'), data)
  } catch (error) {
    // 靜默失敗，不打斷用戶體驗
    console.error('Analytics error:', error)
  }
}

/**
 * 獲取頁面類型
 */
export function getPageType(pathname) {
  if (pathname.startsWith('/tabs/')) return 'tab'
  if (pathname.startsWith('/artists/') && pathname !== '/artists') return 'artist'
  if (pathname === '/artists') return 'artists-list'
  if (pathname === '/') return 'home'
  if (pathname === '/search') return 'search'
  if (pathname === '/library') return 'library'
  if (pathname.startsWith('/playlist/')) return 'playlist'
  if (pathname.startsWith('/admin/')) return 'admin'
  if (pathname === '/login') return 'login'
  return 'other'
}

/**
 * 在組件中使用（React Hook 風格）
 */
export function usePageTracking(pageType, pageId = null, pageTitle = '') {
  if (typeof window !== 'undefined') {
    // 使用 requestIdleCallback 或 setTimeout 確保不阻塞頁面渲染
    const track = () => {
      recordPageView(pageType, pageId, pageTitle)
    }
    
    if ('requestIdleCallback' in window) {
      requestIdleCallback(track, { timeout: 2000 })
    } else {
      setTimeout(track, 1000)
    }
  }
}

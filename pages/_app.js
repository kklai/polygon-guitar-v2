import '@/styles/globals.css'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import Head from 'next/head'
import { siteConfig } from '@/lib/seo'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { recordPageView, getPageType } from '@/lib/analytics'

const SCROLL_STORAGE_KEY = 'pg_scroll'

function getPath() {
  if (typeof window === 'undefined') return ''
  return window.location.pathname + window.location.search
}

// 返回上一頁時保留滾動位置 + 讓 swipe back 見到上一頁（bfcache）
function useScrollRestoration() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return

    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }

    const saveScroll = (path) => {
      const p = path != null ? path : getPath()
      if (!p) return
      try {
        const data = JSON.parse(sessionStorage.getItem(SCROLL_STORAGE_KEY) || '{}')
        data[p] = window.scrollY
        sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(data))
      } catch (_) {}
    }

    const clearRestoreOverlay = () => {
      try {
        document.documentElement.classList.remove('pg-restoring')
      } catch (_) {}
    }

    const restoreScroll = (url) => {
      const path = url != null ? url : getPath()
      let cancelled = false
      const timeouts = []
      try {
        const data = JSON.parse(sessionStorage.getItem(SCROLL_STORAGE_KEY) || '{}')
        const scrollY = data[path]
        if (typeof scrollY !== 'number' || scrollY <= 0) return

        const restore = () => {
          if (!cancelled) window.scrollTo(0, scrollY)
        }

        // 多次還原，對抗 re-render / data fetch 後被拉回頁首（尤其樂譜頁）
        requestAnimationFrame(() => requestAnimationFrame(restore))
        ;[50, 200, 500, 1000, 1500].forEach((ms) => {
          timeouts.push(setTimeout(restore, ms))
        })

        // 等內容有機會 render 先再淡出，避免突然閃一下（約 300ms 後移除 overlay）
        timeouts.push(setTimeout(clearRestoreOverlay, 300))

        // 還原期過後才清除，避免太早清除後被其他邏輯拉回頁首
        timeouts.push(setTimeout(() => {
          try {
            const d = JSON.parse(sessionStorage.getItem(SCROLL_STORAGE_KEY) || '{}')
            delete d[path]
            sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(d))
          } catch (_) {}
        }, 2000))

        return () => {
          cancelled = true
          timeouts.forEach(clearTimeout)
        }
      } catch (_) {}
    }

    const handleStart = () => saveScroll(router.asPath)
    const handleComplete = (url) => restoreScroll(url)

    router.events.on('routeChangeStart', handleStart)
    router.events.on('routeChangeComplete', handleComplete)

    const onPageHide = () => saveScroll(getPath())
    const onPageShow = (e) => {
      if (e.persisted) return // 從 bfcache 還原，唔使做嘢
      restoreScroll(getPath())
    }

    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)

    const initialPath = getPath()
    const cancel = restoreScroll(initialPath)
    // 無需還原時也移除 overlay（例如 path 唔 match）
    if (typeof cancel !== 'function') clearRestoreOverlay()

    return () => {
      router.events.off('routeChangeStart', handleStart)
      router.events.off('routeChangeComplete', handleComplete)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
      if (typeof cancel === 'function') cancel()
    }
  }, [router])
}

// 頁面追蹤組件（在 AuthProvider 內部，可以獲取用戶ID）
function PageTracker() {
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    const handleRouteChange = (url) => {
      // 延遲一點執行，等待頁面標題更新
      setTimeout(() => {
        const pageType = getPageType(url)
        const pageTitle = document.title
        
        // 從 URL 提取 ID（如適用）
        let pageId = null
        if (url.startsWith('/tabs/')) {
          pageId = url.split('/')[2]
        } else if (url.startsWith('/artists/') && url !== '/artists') {
          pageId = url.split('/')[2]
        } else if (url.startsWith('/playlist/')) {
          pageId = url.split('/')[2]
        }

        recordPageView(pageType, pageId, pageTitle, {}, user?.uid || null)
      }, 100)
    }

    // 初始頁面加載
    handleRouteChange(router.asPath)

    // 路由變化時追蹤
    router.events.on('routeChangeComplete', handleRouteChange)
    
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [router, user])

  return null
}

function ScrollRestoration() {
  useScrollRestoration()
  return null
}

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <ScrollRestoration />
      <PageTracker />
      <Head>
        {/* 預設 Meta Tags */}
        <title>Polygon Guitar - 香港最大結他譜庫 | 3000+ 結他譜</title>
        <meta name="description" content={siteConfig.description} />
        <meta name="keywords" content="結他譜, guitar tabs, chords, 廣東歌結他譜, 粵語歌chords, 國語歌結他譜, 香港結他譜, hk guitar tabs, cantopop chords, 轉調, capo, 結他教學" />
        <meta name="author" content="Polygon Guitar" />
        <meta name="theme-color" content="#000000" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* 唔用 no-store，等 iOS 可以用 bfcache：返回時見到上一頁畫面、保留滾動 */}
        <meta httpEquiv="Cache-Control" content="max-age=0, must-revalidate" />
        
        {/* Open Graph 預設 */}
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="zh_HK" />
        <meta property="og:url" content={siteConfig.url} />
        <meta property="og:site_name" content={siteConfig.name} />
        <meta property="og:image" content={`${siteConfig.url}/og-image.jpg`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Polygon Guitar - 香港最大結他譜庫" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:handle" content={siteConfig.twitter} />
        <meta name="twitter:site" content={siteConfig.twitter} />
        
        {/* Preconnect to Firestore + Google Fonts */}
        <link rel="preconnect" href="https://firestore.googleapis.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://firestore.googleapis.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;700&family=Source+Code+Pro:wght@300;400;700&display=swap" rel="stylesheet" />
        
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="manifest" href="/api/manifest.json" />
        
        {/* 全局字體設定：英文字用 Source Code Pro Light */}
        <style jsx global>{`
          html, body {
            font-family: 'Source Code Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            font-weight: 300;
          }
          /* 確保所有文字元素都繼承字體 */
          h1, h2, h3, h4, h5, h6, p, span, a, button, input, textarea, label, div {
            font-family: inherit;
          }
          /* 英文字符特別處理 */
          * {
            font-family: 'Source Code Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
          }
        `}</style>
      </Head>
      <Component {...pageProps} />
    </AuthProvider>
  )
}

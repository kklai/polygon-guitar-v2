import { useRouter } from 'next/router'
import { useState, useRef, useEffect } from 'react'
import Link from '@/components/Link'
import { useAuth } from '@/contexts/AuthContext'
import Navbar from './Navbar'
import { navIcons } from '@/lib/navIcons'

export default function Layout({ children, fullWidth = false, hideHeader = false }) {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const currentPath = router.pathname

  // 底 nav 點擊動畫：立即 100(solid) → 50ms 後 90 → 再 110ms 100(solid)
  const [tappedPath, setTappedPath] = useState(null)
  const [tapPhase, setTapPhase] = useState(0) // 0=100, 1=85, 2=100
  const tapTimeoutsRef = useRef([])
  useEffect(() => () => {
    tapTimeoutsRef.current.forEach(clearTimeout)
    tapTimeoutsRef.current = []
  }, [])

  const handleNavPointerDown = (path) => {
    tapTimeoutsRef.current.forEach(clearTimeout)
    tapTimeoutsRef.current = []
    setTappedPath(path)
    setTapPhase(0)
    tapTimeoutsRef.current.push(setTimeout(() => setTapPhase(1), 50))
    tapTimeoutsRef.current.push(setTimeout(() => setTapPhase(2), 160))
  }

  const getTapScaleClass = (phase) => (phase === 1 ? 'scale-[0.9]' : 'scale-100')

  // 檢查當前頁面是否激活
  const isActive = (path) => {
    if (path === '/' && currentPath === '/') return true
    if (path !== '/' && currentPath.startsWith(path)) return true
    return false
  }

  // 底部導航項目 - 手機版（5個項目：首頁、搜尋、歌手、收藏、求譜）
  const mobileNavItems = [
    { path: '/', label: '首頁', icon: 'home' },
    { path: '/search', label: '搜尋', icon: 'search' },
    { path: '/artists', label: '歌手', icon: 'artists' },
    { path: '/library', label: '收藏', icon: 'library' },
    { path: '/tab-requests', label: '求譜', icon: 'hand' },
  ]

  // 底部導航項目 - 桌面版（根據是否 Admin 動態生成）
  const getDesktopNavItems = () => {
    const items = [
      { path: '/', label: '首頁', icon: 'home' },
      { path: '/search', label: '搜尋', icon: 'search' },
      { path: '/artists', label: '歌手', icon: 'artists' },
      { path: '/library', label: '收藏', icon: 'library' },
      { path: '/tab-requests', label: '求譜', icon: 'hand' },
      { path: '/tabs/new', label: '出譜', icon: 'upload' },
    ]
    
    // 只有 Admin 先顯示管理項目
    if (isAdmin) {
      items.push(
        { path: '/admin', label: '管理', icon: 'admin' }
      )
    }
    
    return items
  }

  // Icon 組件 — 有自訂圖片顯示圖片；artists/upload/admin 用內聯 SVG；其他冇圖則顯示 label 首字
  const Icon = ({ name, className, iconUrl, label, active }) => {
    const opacityClass = active ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
    // 歌手：人頭+半身（32×32）；未選中線框、點擊/選中時實色
    if (name === 'artists') {
      return (
        <svg className={`${className} shrink-0 text-inherit transition-colors`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.1} viewBox="0 0 32.9 32.9">
          <circle cx="16.5" cy="10.82" r="5.02" />
          <path d="M25.2,27.1c0-4.3-3.9-7.8-8.8-7.8s-8.8,3.5-8.8,7.8h17.6Z" />
        </svg>
      )
    }
    // 搜尋：一律用自訂 SVG；未選中線框、選中時中間實心圓
    // 搜尋：選中前用自訂放大鏡（單 path 實心）；選中後用圓+柄+中間實心圓
    if (name === 'search') {
      return (
        <svg className={`${className} shrink-0 text-inherit transition-colors`} viewBox="0 0 32.9 32.9">
          {active ? (
            <>
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} fillRule="evenodd" d="M19.8,8.8c-3-3-8-3-11,0-3,3-3,8,0,11,3,3,8,3,11,0,3-3,3-8,0-11Z" />
              <line x1="19.9" y1="19.9" x2="26.4" y2="26.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} />
              <circle cx="14.3" cy="14.3" r="5.11" fill="currentColor" stroke="none" />
            </>
          ) : (
            <path fill="currentColor" stroke="none" d="M27.21,25.59l-5.85-5.85c2.64-3.47,2.39-8.61-.75-11.75-1.67-1.67-3.91-2.59-6.31-2.59s-4.65.92-6.31,2.59c-3.42,3.42-3.42,9.2,0,12.63,1.67,1.67,3.91,2.59,6.31,2.59,2.01,0,3.9-.65,5.44-1.83l5.85,5.85c.22.22.52.34.81.34s.59-.11.81-.34c.45-.45.45-1.18,0-1.63ZM9.61,18.99c-2.54-2.54-2.54-6.83,0-9.37,1.23-1.23,2.9-1.91,4.69-1.91s3.45.68,4.69,1.91c2.54,2.54,2.54,6.83,0,9.37-1.23,1.23-2.9,1.91-4.69,1.91s-3.45-.68-4.69-1.91Z" />
          )}
        </svg>
      )
    }
    // 收藏：一律用自訂 SVG；選中前線框（polygon+兩線）、選中後 polygon 實心；向上移 0.2px
    if (name === 'library') {
      const strokeProps = { stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2 }
      return (
        <svg className={`${className} shrink-0 text-inherit transition-colors -translate-y-[0.2px]`} viewBox="0 0 32.9 32.9">
          <polygon points="23.69 27.1 9.21 27.1 8.04 14.73 24.86 14.73 23.69 27.1" fill={active ? 'currentColor' : 'none'} {...strokeProps} />
          <line x1="9.1" y1="10.71" x2="23.8" y2="10.71" {...strokeProps} />
          <line x1="10.37" y1="6.9" x2="22.53" y2="6.9" {...strokeProps} />
        </svg>
      )
    }
    // 首頁：一律用自訂 SVG；選中前兩 path（屋+橫線）、選中後單 path（屋實心）
    if (name === 'home') {
      return (
        <svg className={`${className} shrink-0 text-inherit transition-colors`} viewBox="0 0 32.9 32.9">
          {active ? (
            <path fill="currentColor" stroke="none" d="M28.07,15.98l-10.85-10.62c-.05-.05-.11-.07-.17-.11-.06-.04-.12-.09-.18-.12-.07-.03-.14-.03-.21-.04-.07-.01-.14-.04-.21-.04s-.14.02-.21.04c-.07.01-.14.02-.21.04-.07.03-.12.08-.18.12-.06.04-.12.06-.17.11L4.83,15.98c-.43.42-.44,1.12-.02,1.56.22.22.5.33.79.33s.56-.1.77-.31l.75-.73v10.18c0,.61.49,1.1,1.1,1.1h16.46c.61,0,1.1-.49,1.1-1.1v-10.18l.75.73c.21.21.49.31.77.31s.57-.11.79-.33c.42-.43.42-1.13-.02-1.56ZM20.99,22.63c-1.75.93-3.43,1.12-4.54,1.12-2,0-3.57-.61-4.54-1.12-.49-.26-.67-.86-.41-1.35.26-.49.87-.67,1.35-.41.76.41,2,.89,3.6.89.88,0,2.21-.15,3.6-.89.49-.26,1.09-.07,1.35.42s.07,1.09-.42,1.35Z" />
          ) : (
            <>
              <path fill="currentColor" stroke="none" d="M28.07,15.99l-10.85-10.62c-.05-.05-.12-.08-.18-.12-.06-.04-.11-.09-.17-.11-.07-.03-.14-.03-.22-.04-.07-.01-.13-.04-.2-.04s-.13.02-.2.04c-.07.01-.15.02-.22.04-.06.03-.11.07-.17.11-.06.04-.13.07-.19.12L4.83,15.99c-.43.42-.44,1.12-.02,1.56.22.22.5.33.79.33s.56-.1.77-.31l.75-.73v10.18c0,.61.49,1.1,1.1,1.1h16.46c.61,0,1.1-.49,1.1-1.1v-10.18l.75.73c.21.21.49.31.77.31s.57-.11.79-.33c.42-.43.42-1.13-.02-1.56ZM23.58,25.91h-14.26v-11.23l7.13-6.98,7.13,6.98v11.23Z" />
              <path fill="currentColor" stroke="none" d="M12.6,21.66c-.61,0-1.1.49-1.1,1.1s.49,1.1,1.1,1.1h7.69c.61,0,1.1-.49,1.1-1.1s-.49-1.1-1.1-1.1h-7.69Z" />
            </>
          )}
        </svg>
      )
    }
    if (iconUrl) {
      return <img src={iconUrl} alt="" className={`${className} object-contain transition-opacity ${opacityClass}`} />
    }
    // 出譜：文件+向上箭嘴（27×27、幼 stroke，顏色跟父層 text-black / text-black/60 統一）
    if (name === 'upload') {
      return (
        <svg className="w-[27px] h-[27px] shrink-0 text-inherit transition-colors" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      )
    }
    // 管理：齒輪（27×27、幼 stroke，顏色跟父層統一）
    if (name === 'admin') {
      return (
        <svg className="w-[27px] h-[27px] shrink-0 text-inherit transition-colors" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
    return (
      <span className={`${className} flex items-center justify-center text-base font-bold shrink-0 ${opacityClass}`}>
        {label?.[0] || ''}
      </span>
    )
  }

  const desktopNavItems = getDesktopNavItems()

  return (
    <div className={`${hideHeader ? 'bg-transparent' : 'bg-black'} text-white min-h-screen min-h-[calc(100vh+1px)]`}>
      {!hideHeader && <Navbar />}
      <main 
        className={fullWidth 
          ? (hideHeader ? 'pb-16 md:pb-0' : 'pb-16 md:pb-0')
          : (hideHeader ? 'pb-24' : 'max-w-7xl mx-auto pb-24')
        }
        style={hideHeader ? {} : { paddingTop: fullWidth ? 'calc(4.4rem + env(safe-area-inset-top, 0px))' : 'calc(4.4rem + 10px + env(safe-area-inset-top, 0px))' }}
      >
        {children}
      </main>
      
      {/* 手機版底部導航 - 黃底黑字設計 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#FFD700] z-50 md:hidden" style={{ paddingBottom: 'min(env(safe-area-inset-bottom, 0px), 30px)' }}>
        <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
          {mobileNavItems.map((item) => {
            const isTapped = tappedPath === item.path
            const scaleClass = isTapped ? getTapScaleClass(tapPhase) : 'scale-100'
            return (
              <Link 
                key={item.path}
                href={item.path}
                onPointerDown={() => handleNavPointerDown(item.path)}
                className={`flex flex-col items-center transition group transition-transform duration-100 ${scaleClass} ${
                  isActive(item.path) || isTapped ? 'text-black font-bold' : 'text-black/60 hover:text-black'
                }`}
              >
                <Icon 
                  name={item.icon} 
                  iconUrl={navIcons[item.icon]}
                  label={item.label}
                  active={isActive(item.path) || isTapped}
                  className={item.icon === 'hand' ? 'w-[34px] h-[34px] translate-y-[1px]' : 'w-[32px] h-[32px]'}
                />
                <span className="text-xs mt-0.5 font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* 桌面版底部導航 - 黃底黑字設計；唔用 scale 動畫，避免 transition 影響桌面點擊/導航 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#FFD700] z-50 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
            {desktopNavItems.map((item) => (
                <Link 
                  key={item.path}
                  href={item.path}
                  onClick={(e) => {
                    e.preventDefault()
                    router.push(item.path)
                  }}
                  className={`flex flex-col items-center group ${
                    isActive(item.path) ? 'text-black font-bold' : 'text-black/60 hover:text-black'
                  }`}
                >
                  <div className={`flex items-center justify-center shrink-0 ${item.icon === 'hand' ? 'h-[34px] w-[34px]' : 'h-8 w-8'}`}>
                    <Icon 
                      name={item.icon} 
                      iconUrl={navIcons[item.icon]}
                      label={item.label}
                      active={isActive(item.path)}
                      className={item.icon === 'hand' ? 'w-[34px] h-[34px] translate-y-[1px]' : 'w-[32px] h-[32px]'}
                    />
                  </div>
                  <span className="text-xs mt-0.5 font-medium">{item.label}</span>
                </Link>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )
}

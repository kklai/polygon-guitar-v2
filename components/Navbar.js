import Link from '@/components/Link'
import { useAuth } from '@/contexts/AuthContext'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'

// Hardcoded so we don't hit Firebase on every page visit
const SITE_LOGO_URL = 'https://res.cloudinary.com/drld2cjpo/image/upload/v1771502138/artists/site_logo_1771502138235.png'
const SITE_NAME = 'Polygon 結他譜'

export default function Navbar() {
  const { user, logout, isAuthenticated, isAdmin, loading: authLoading } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const router = useRouter()
  const menuRef = useRef(null)
  // Desktop: 避免「點擊 Link」被誤判為點擊外部；mousedown 在 menu 內設 true，document click 時見 true 就不關閉
  const clickedInsideMenuRef = useRef(false)

  // 路由變化時關閉選單，避免點擊 Link 時先關閉導致導航被取消
  useEffect(() => {
    const handleRouteChange = () => setIsMenuOpen(false)
    router.events.on('routeChangeStart', handleRouteChange)
    return () => router.events.off('routeChangeStart', handleRouteChange)
  }, [router.events])

  // 只喺 desktop 點擊外部關閉選單（手機唔用，避免撳 icon 後選單被誤關）
  useEffect(() => {
    if (!isMenuOpen) return
    const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
    const handleClickOutside = (e) => {
      if (!isDesktop()) return
      if (clickedInsideMenuRef.current) {
        clickedInsideMenuRef.current = false
        return
      }
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsMenuOpen(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isMenuOpen])

  // iPhone Safari：選單打開時鎖 body，防止背景收到 touch/scroll
  useEffect(() => {
    if (typeof document === 'undefined') return
    const isMobile = () => window.matchMedia('(max-width: 767px)').matches
    if (isMenuOpen && isMobile()) {
      const scrollY = window.scrollY
      document.body.setAttribute('data-nav-menu-open', 'true')
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      return () => {
        document.body.removeAttribute('data-nav-menu-open')
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.left = ''
        document.body.style.right = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [isMenuOpen])

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <nav
      className={`bg-[#FFD700] fixed top-0 left-0 right-0 will-change-transform ${isMenuOpen ? 'z-[10000]' : 'z-[100]'}`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="max-w-[1050px] mx-auto pl-4">
        <div className="flex justify-between relative z-10 bg-[#FFD700]" style={{ height: '4.4rem' }}>
          {/* Logo + 副標題 */}
          <div className="flex flex-col justify-end">
            <Link href="/" className="flex flex-col">
              <img
                src={SITE_LOGO_URL}
                alt={SITE_NAME}
                loading="eager"
                decoding="async"
                style={{ height: 40, maxWidth: 160 }}
              />
              <span className="text-base text-black tracking-[0.25em] mt-0.5 w-full pb-2 navbar-tagline">
                香港廣東歌結他譜網
              </span>
            </Link>
          </div>

          {/* Desktop：頭像/icon，點擊開選單（出譜在選單內） */}
          <div className="hidden md:flex md:relative items-center gap-2" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen) }}
              className="text-black/70 p-1 rounded-full focus:outline-none"
              aria-label={isMenuOpen ? '關閉選單' : '開啟選單'}
            >
              {isAuthenticated && user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || '用戶'}
                  className="rounded-full object-cover w-[42px] h-[42px]"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="flex items-center justify-center rounded-full bg-black/10 w-[42px] h-[42px]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
              )}
            </button>
            {/* Desktop 下拉選單 */}
            {isMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 py-2 w-56 bg-[#FFD700] border border-black/10 rounded-lg shadow-lg z-[101]"
                onMouseDown={() => { clickedInsideMenuRef.current = true }}
              >
                {isAuthenticated && (
                  <>
                    <Link
                      href="/tabs/new"
                      className="flex items-center gap-2 text-black/70 px-4 py-2 font-medium"
                      onClick={(e) => { e.preventDefault(); router.push('/tabs/new') }}
                    >
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      出譜
                    </Link>
                    <Link
                      href={`/profile/${user.uid}`}
                      className="flex items-center gap-2 text-black/70 px-4 py-2 font-medium"
                      onClick={(e) => { e.preventDefault(); router.push(`/profile/${user.uid}`) }}
                    >
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" loading="lazy" decoding="async" />
                      ) : (
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                      我的主頁
                    </Link>
                  </>
                )}
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="block text-black/70 px-4 py-2 font-medium border-t border-black/10 mt-1 pt-2"
                    onClick={(e) => { e.preventDefault(); router.push('/admin') }}
                  >
                    管理後台
                  </Link>
                )}
                {isAuthenticated ? (
                  <button type="button" onClick={() => { handleLogout(); setIsMenuOpen(false) }} className="block w-full text-left text-black/70 font-medium px-4 py-2 border-t border-black/10 mt-1 pt-2">登出</button>
                ) : (
                  <Link
                    href="/login"
                    className="block text-black font-bold px-4 py-2 border-t border-black/10 mt-1 pt-2"
                    onClick={(e) => { e.preventDefault(); router.push('/login') }}
                  >
                    登入
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Mobile：頭像/選單 icon（出譜在選單內） */}
          <div className="md:hidden flex items-center gap-1">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-black/70 p-1 rounded-full focus:outline-none"
              aria-label={isMenuOpen ? '關閉選單' : '開啟選單'}
            >
              {isMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : isAuthenticated && user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || '用戶'}
                  className="rounded-full object-cover w-[42px] h-[42px]"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="flex items-center justify-center rounded-full bg-black/10 w-[42px] h-[42px]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile：點擊外部關閉 + 遮罩阻擋背景點擊（全屏、阻擋 touch/click 穿透） */}
      {isMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0"
            style={{
              top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 1,
              pointerEvents: 'auto',
              touchAction: 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
              cursor: 'pointer',
              minHeight: '100dvh',
              background: 'transparent',
            }}
            role="button"
            tabIndex={0}
            aria-label="關閉選單"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault()
                e.stopPropagation()
                setIsMenuOpen(false)
              }
            }}
            onTouchEnd={(e) => {
              // Only close when the overlay itself was tapped; otherwise allow link navigation
              if (e.target === e.currentTarget) {
                e.preventDefault()
                setIsMenuOpen(false)
              }
            }}
            onTouchStart={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Enter' && setIsMenuOpen(false)}
          />
          <div className="md:hidden relative z-[2] bg-[#FFD700] border-t border-yellow-600">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {isAuthenticated && (
              <>
                <Link 
                  href="/tabs/new" 
                  className="flex items-center gap-2 text-black/70 px-3 py-2 rounded-md font-medium"
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  出譜
                </Link>
                <Link
                  href={`/profile/${user.uid}`}
                  className="flex items-center gap-2 text-black/70 px-3 py-2 rounded-md font-medium"
                >
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" loading="lazy" decoding="async" />
                  ) : (
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                  我的主頁
                </Link>
              </>
            )}
            {/* Admin 選項 */}
            {isAdmin && (
              <Link 
                href="/admin" 
                className="block text-black/70 px-3 py-2 font-medium border-t border-yellow-600 mt-2 pt-2"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  管理後台
                </span>
              </Link>
            )}
            {isAuthenticated ? (
              <button
                onClick={() => {
                  handleLogout()
                  setIsMenuOpen(false)
                }}
                className="block w-full text-left text-black/70 font-medium px-3 py-2 border-t border-yellow-600 mt-2 pt-2 rounded-none"
              >
                登出
              </button>
            ) : (
              <Link 
                href="/login" 
                className="block text-black font-bold px-3 py-2 rounded-none border-t border-yellow-600 mt-2 pt-2"
              >
                登入
              </Link>
            )}
          </div>
          </div>
        </>
      )}
    </nav>
  )
}

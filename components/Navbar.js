import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

// Hardcoded so we don't hit Firebase on every page visit
const SITE_LOGO_URL = 'https://res.cloudinary.com/drld2cjpo/image/upload/v1771502138/artists/site_logo_1771502138235.png'
const SITE_NAME = 'Polygon 結他譜'

export default function Navbar() {
  const { user, logout, isAuthenticated, isAdmin } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const onScroll = () => {
      // 有彈出視窗打開時唔好收窄 navbar（避免 mobile Safari 手勢觸發）
      if (document.body.getAttribute('data-modal-open') === 'true') {
        setScrolled(false)
        return
      }
      setScrolled(window.scrollY > 30)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    const observer = new MutationObserver(() => {
      if (document.body.getAttribute('data-modal-open') === 'true') setScrolled(false)
    })
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-modal-open'] })
    return () => {
      window.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <nav className="bg-[#FFD700] fixed top-0 left-0 right-0 z-[100] will-change-transform" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between" style={{ height: scrolled ? '2.5rem' : '4.4rem' }}>
          {/* Logo + 副標題 */}
          <div className="flex flex-col justify-end">
            <Link href="/" className="flex flex-col">
              <img
                src={SITE_LOGO_URL}
                alt={SITE_NAME}
                loading="eager"
                decoding="async"
                style={scrolled ? { width: 140, paddingBottom: 1 } : { height: 40, maxWidth: 160 }}
              />
              {!scrolled && (
                <span className="text-base text-black tracking-[0.25em] mt-0.5 w-full pb-2 navbar-tagline">
                  香港廣東歌結他譜網
                </span>
              )}
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <Link 
              href="/" 
              className="text-black/70 hover:text-black px-3 py-2 rounded-md font-medium transition"
            >
              所有譜
            </Link>
            <Link 
              href="/artists" 
              className="text-black/70 hover:text-black px-3 py-2 rounded-md font-medium transition"
            >
              歌手分類
            </Link>
            {isAuthenticated && (
              <Link 
                href="/tabs/new" 
                className="bg-[#FFD700] text-black px-4 py-2 rounded-md font-medium hover:opacity-90 transition"
              >
                上傳譜
              </Link>
            )}
          </div>

          {/* User Section */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                <Link 
                  href={`/profile/${user.uid}`}
                  className="flex items-center space-x-2 hover:opacity-80 transition"
                >
                  {user.photoURL && (
                    <img
                      src={user.photoURL}
                      alt={user.displayName}
                      loading="lazy"
                      decoding="async"
                      className="w-8 h-8 rounded-full border-2 border-[#FFD700]"
                    />
                  )}
                  <span className="text-black font-medium">
                    {user.displayName}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-black/70 hover:text-black font-medium transition"
                >
                  登出
                </button>
              </div>
            ) : (
              <Link 
                href="/login" 
                className="bg-[#FFD700] text-black px-4 py-2 rounded-md font-medium hover:opacity-90 transition"
              >
                登入
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-black/70 hover:text-black p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-[#FFD700] border-t border-yellow-600">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link 
              href="/" 
              className="block text-black/70 hover:text-black px-3 py-2 rounded-md font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              所有譜
            </Link>
            <Link 
              href="/artists" 
              className="block text-black/70 hover:text-black px-3 py-2 rounded-md font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              歌手分類
            </Link>
            <Link 
              href="/tab-requests" 
              className="block text-black/70 hover:text-black px-3 py-2 rounded-md font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              求譜區
            </Link>
            {isAuthenticated && (
              <>
                <Link 
                  href="/tabs/new" 
                  className="block text-black/70 hover:text-black px-3 py-2 rounded-md font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  上傳譜
                </Link>
                <Link 
                  href={`/profile/${user.uid}`}
                  className="block text-black/70 hover:text-black px-3 py-2 rounded-md font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  我的主頁
                </Link>
              </>
            )}
            {/* Admin 選項 */}
            {isAdmin && (
              <Link 
                href="/admin" 
                className="block text-black/70 hover:text-black px-3 py-2 rounded-md font-medium border-t border-yellow-600 mt-2 pt-2"
                onClick={() => setIsMenuOpen(false)}
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
                className="block w-full text-left text-black/70 hover:text-black font-medium px-3 py-2 border-t border-yellow-600 mt-2 pt-2"
              >
                登出
              </button>
            ) : (
              <Link 
                href="/login" 
                className="block text-black font-bold px-3 py-2 border-t border-yellow-600 mt-2 pt-2"
                onClick={() => setIsMenuOpen(false)}
              >
                登入
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

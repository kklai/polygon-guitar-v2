import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useState, useEffect } from 'react'
import { getGlobalSettings } from '@/lib/tabs'

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [logoUrl, setLogoUrl] = useState(null)
  const [siteName, setSiteName] = useState('Polygon Guitar')

  // 載入 Logo 設定
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const settings = await getGlobalSettings()
      if (settings.logoUrl) {
        setLogoUrl(settings.logoUrl)
      }
      if (settings.siteName) {
        setSiteName(settings.siteName)
      }
    } catch (error) {
      console.error('Error loading logo settings:', error)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <nav className="bg-[#FFD700] border-b border-yellow-600 fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          {/* Logo + 副標題 */}
          <div className="flex flex-col justify-center">
            <Link href="/" className="flex flex-col">
              {logoUrl ? (
                <>
                  <img
                    src={logoUrl}
                    alt={siteName}
                    loading="eager"
                    decoding="async"
                    className="h-10 max-w-[160px] object-contain"
                  />
                  {/* 副標題 */}
                  <span className="text-base text-black tracking-[0.5em] mt-0.5 w-full pb-2">
                    香港廣東歌結他譜網
                  </span>
                </>
              ) : (
                /* 未撈到 Logo 前顯示文字 */
                <>
                  <span className="font-bold text-xl text-black">
                    Polygon Guitar
                  </span>
                  <span className="text-base text-black tracking-[0.5em] mt-0.5 w-full pb-2">
                    香港廣東歌結他譜網
                  </span>
                </>
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
            {isAuthenticated && (
              <Link 
                href="/tabs/new" 
                className="block text-[#FFD700] font-medium px-3 py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                上傳譜
              </Link>
            )}
            {isAuthenticated ? (
              <>
                <Link 
                  href={`/profile/${user.uid}`}
                  className="flex items-center space-x-2 px-3 py-2 hover:bg-yellow-400/20 rounded-md"
                  onClick={() => setIsMenuOpen(false)}
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
                    我的主頁
                  </span>
                </Link>
                <button
                  onClick={() => {
                    handleLogout()
                    setIsMenuOpen(false)
                  }}
                  className="block w-full text-left text-black/70 hover:text-black font-medium px-3 py-2"
                >
                  登出
                </button>
              </>
            ) : (
              <Link 
                href="/login" 
                className="block text-[#FFD700] font-medium px-3 py-2"
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

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <nav className="bg-[#121212] border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl">🎸</span>
              <span className="font-bold text-xl text-white hidden sm:block">
                Polygon Guitar
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <Link 
              href="/" 
              className="text-[#B3B3B3] hover:text-white px-3 py-2 rounded-md font-medium transition"
            >
              所有譜
            </Link>
            <Link 
              href="/artists" 
              className="text-[#B3B3B3] hover:text-white px-3 py-2 rounded-md font-medium transition"
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
                {user.photoURL && (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName}
                    className="w-8 h-8 rounded-full border-2 border-[#FFD700]"
                  />
                )}
                <span className="text-white font-medium">
                  {user.displayName}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-[#B3B3B3] hover:text-white font-medium transition"
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
              className="text-[#B3B3B3] hover:text-white p-2"
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
        <div className="md:hidden bg-[#121212] border-t border-gray-800">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link 
              href="/" 
              className="block text-[#B3B3B3] hover:text-white px-3 py-2 rounded-md font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              所有譜
            </Link>
            <Link 
              href="/artists" 
              className="block text-[#B3B3B3] hover:text-white px-3 py-2 rounded-md font-medium"
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
                <div className="flex items-center space-x-2 px-3 py-2">
                  {user.photoURL && (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName}
                      className="w-8 h-8 rounded-full border-2 border-[#FFD700]"
                    />
                  )}
                  <span className="text-white font-medium">
                    {user.displayName}
                  </span>
                </div>
                <button
                  onClick={() => {
                    handleLogout()
                    setIsMenuOpen(false)
                  }}
                  className="block w-full text-left text-[#B3B3B3] hover:text-white font-medium px-3 py-2"
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

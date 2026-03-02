import { useRouter } from 'next/router'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import Navbar from './Navbar'

export default function Layout({ children, fullWidth = false }) {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const currentPath = router.pathname
  
  // 自訂導航 icon
  const [navIcons, setNavIcons] = useState({})

  // 獲取自訂導航 icon
  useEffect(() => {
    const loadNavIcons = async () => {
      try {
        const docRef = doc(db, 'settings', 'navIcons')
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          setNavIcons(docSnap.data())
        }
      } catch (error) {
        console.error('Error loading nav icons:', error)
      }
    }
    loadNavIcons()
  }, [])

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
      { path: '/tabs/new', label: '上傳', icon: 'upload' },
    ]
    
    // 只有 Admin 先顯示管理項目
    if (isAdmin) {
      items.push(
        { path: '/admin', label: '管理', icon: 'admin' }
      )
    }
    
    return items
  }

  // Icon 組件（支援自訂圖片）
  const Icon = ({ name, className, iconUrl }) => {
    // 如果有自訂 icon URL，顯示圖片
    if (iconUrl) {
      return <img src={iconUrl} alt="" className={`${className} object-contain`} />
    }
    
    const icons = {
      home: (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      search: (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      artists: (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      upload: (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      library: (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      ),
      admin: (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      hand: (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
        </svg>
      ),
      hero: (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      playlist: (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
        </svg>
      ),
    }
    return icons[name] || null
  }

  const desktopNavItems = getDesktopNavItems()

  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
      <main 
        className={fullWidth ? 'pt-20 pb-16 md:pb-0' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24'}
      >
        {children}
      </main>
      
      {/* 手機版底部導航 - 黃底黑字設計 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#FFD700] z-50 md:hidden">
        <div className="flex justify-around items-center h-16">
          {mobileNavItems.map((item) => (
            <Link 
              key={item.path}
              href={item.path}
              className={`flex flex-col items-center transition ${
                isActive(item.path) 
                  ? 'text-black font-bold' 
                  : 'text-black/60 hover:text-black'
              }`}
            >
              <Icon 
                name={item.icon} 
                iconUrl={navIcons[item.icon]}
                className={`w-6 h-6 ${isActive(item.path) ? 'stroke-[2.5px]' : ''}`}
              />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* 桌面版底部導航 - 黃底黑字設計 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#FFD700] z-50 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-around items-center h-16">
            {desktopNavItems.map((item) => (
              <Link 
                key={item.path}
                href={item.path}
                className={`flex flex-col items-center transition ${
                  isActive(item.path) 
                    ? 'text-black font-bold' 
                    : 'text-black/60 hover:text-black'
                }`}
              >
                <Icon 
                  name={item.icon} 
                  iconUrl={navIcons[item.icon]}
                  className={`w-6 h-6 ${isActive(item.path) ? 'stroke-[2.5px]' : ''}`}
                />
                <span className="text-xs mt-1 font-medium">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )
}

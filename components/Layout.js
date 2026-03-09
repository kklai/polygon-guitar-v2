import { useRouter } from 'next/router'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import Navbar from './Navbar'

const NAV_ICONS_STORAGE_KEY = 'navIcons'
// No TTL — cache is valid until admin changes nav icons (cache bust in admin/nav-icons.js)

function getNavIconsCached() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(NAV_ICONS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const data = parsed?.data ?? parsed
    if (!data || typeof data !== 'object') return null
    return { data }
  } catch {
    return null
  }
}

function setNavIconsCached(data) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(NAV_ICONS_STORAGE_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

export default function Layout({ children, fullWidth = false, hideHeader = false }) {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const currentPath = router.pathname
  
  const [navIcons, setNavIcons] = useState({})

  useEffect(() => {
    const cached = getNavIconsCached()
    if (cached?.data) {
      setNavIcons(cached.data)
      return // cache valid until admin busts it — no Firestore read
    }
    const loadNavIcons = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'navIcons'))
        if (docSnap.exists()) {
          const data = docSnap.data()
          setNavIcons(data)
          setNavIconsCached(data)
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

  // Icon 組件 — 有自訂圖片顯示圖片，冇就顯示 label 第一個字
  const Icon = ({ name, className, iconUrl, label, active }) => {
    if (iconUrl) {
      return <img src={iconUrl} alt="" className={`${className} object-contain transition-opacity ${active ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`} />
    }
    return <span className="text-base font-bold">{label?.[0] || ''}</span>
  }

  const desktopNavItems = getDesktopNavItems()

  return (
    <div className={`${hideHeader ? 'bg-transparent' : 'bg-black'} text-white min-h-screen`}>
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
        <div className="flex justify-around items-center h-16">
          {mobileNavItems.map((item) => (
            <Link 
              key={item.path}
              href={item.path}
              className={`flex flex-col items-center transition group ${
                isActive(item.path) 
                  ? 'text-black font-bold' 
                  : 'text-black/60 hover:text-black'
              }`}
            >
              <Icon 
                name={item.icon} 
                iconUrl={navIcons[item.icon]}
                label={item.label}
                active={isActive(item.path)}
                className={`w-[30px] h-[30px]`}
              />
              <span className="text-xs mt-0.5 font-medium">{item.label}</span>
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
                className={`flex flex-col items-center transition group ${
                  isActive(item.path) 
                    ? 'text-black font-bold' 
                    : 'text-black/60 hover:text-black'
                }`}
              >
                <Icon 
                  name={item.icon} 
                  iconUrl={navIcons[item.icon]}
                  label={item.label}
                  active={isActive(item.path)}
                  className={`w-[30px] h-[30px]`}
                />
                <span className="text-xs mt-0.5 font-medium">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )
}

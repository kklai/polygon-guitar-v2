import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export default function MoreMenu({ isOpen, onClose }) {
  const { user, isAdmin } = useAuth()
  const menuRef = useRef(null)

  // 點擊外部關閉
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const menuItems = [
    { path: '/tab-requests', label: '求譜區', icon: 'hand', desc: '搵人幫手出譜' },
    { path: '/tabs/new', label: '上傳譜', icon: 'upload', desc: '分享你嘅結他譜' },
    ...(isAdmin ? [{ path: '/admin', label: '管理後台', icon: 'admin', desc: '網站管理' }] : []),
    ...(user ? [{ path: `/profile/${user.uid}`, label: '個人檔案', icon: 'profile', desc: '你嘅主頁' }] : []),
  ]

  return (
    <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose}>
      <div 
        ref={menuRef}
        className="absolute bottom-20 left-4 right-4 bg-[#121212] rounded-2xl border border-gray-800 overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4">
          <h3 className="text-white font-bold text-lg mb-4">更多</h3>
          <div className="space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={onClose}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-[#1a1a1a] transition group"
              >
                <div className="w-12 h-12 rounded-xl bg-[#FFD700]/10 flex items-center justify-center group-hover:bg-[#FFD700]/20 transition">
                  <MenuIcon name={item.icon} className="w-6 h-6 text-[#FFD700]" />
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium">{item.label}</div>
                  <div className="text-gray-500 text-sm">{item.desc}</div>
                </div>
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
        
        {!user && (
          <div className="p-4 border-t border-gray-800 bg-[#0a0a0a]">
            <Link 
              href="/login"
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#FFD700] text-black rounded-xl font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              登入 / 註冊
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

function MenuIcon({ name, className }) {
  const icons = {
    hand: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
      </svg>
    ),
    upload: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    admin: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    profile: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  }
  return icons[name] || null
}

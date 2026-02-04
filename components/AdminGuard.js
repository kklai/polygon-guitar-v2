import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function AdminGuard({ children }) {
  const { user, loading, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/')
    }
  }, [loading, isAdmin, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white mb-4">請先登入</p>
          <button 
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium"
          >
            前往登入
          </button>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white mb-4">您沒有權限訪問此頁面</p>
          <button 
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg font-medium"
          >
            返回首頁
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

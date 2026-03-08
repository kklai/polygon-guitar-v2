import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { hasPermission } from '@/lib/roles'

export default function AdminGuard({ children, requiredRole }) {
  const { user, loading, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      // 檢查是否有權限訪問此頁面
      const hasAccess = hasPermission(user, router.pathname)
      
      if (!hasAccess) {
        router.push('/admin')
      }
    }
  }, [loading, user, router])

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

  // 檢查權限
  const hasAccess = hasPermission(user, router.pathname)

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white mb-2">您沒有權限訪問此頁面</p>
          <p className="text-gray-500 text-sm mb-4">請聯繫超級管理員獲取權限</p>
          <button 
            onClick={() => router.push('/admin')}
            className="inline-flex items-center p-2 bg-[#FFD700] text-black rounded-lg font-medium mr-2"
            aria-label="返回管理台"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button 
            onClick={() => router.push('/')}
            className="inline-flex items-center p-2 bg-gray-800 text-white rounded-lg font-medium"
            aria-label="返回首頁"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

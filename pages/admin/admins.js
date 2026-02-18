import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { db } from '@/lib/firebase'
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  doc, 
  updateDoc,
  where
} from 'firebase/firestore'
import Link from 'next/link'

function AdminManagement() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const q = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc')
      )
      const snapshot = await getDocs(q)
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setUsers(usersData)
    } catch (error) {
      console.error('Error loading users:', error)
      showMessage('載入用戶失敗', 'error')
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  const toggleAdmin = async (userId, currentStatus) => {
    try {
      const userRef = doc(db, 'users', userId)
      await updateDoc(userRef, {
        isAdmin: !currentStatus,
        updatedAt: new Date().toISOString()
      })
      
      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, isAdmin: !currentStatus } : u
      ))
      
      showMessage(!currentStatus ? '已設為管理員' : '已取消管理員權限')
    } catch (error) {
      console.error('Error updating admin status:', error)
      showMessage('更新失敗', 'error')
    }
  }

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const adminUsers = filteredUsers.filter(u => u.isAdmin)
  const regularUsers = filteredUsers.filter(u => !u.isAdmin)

  if (loading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full mx-auto"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 pb-8">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-gray-800 -mx-4 px-4 py-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>👑</span> 管理員設置
              </h1>
              <p className="text-sm text-[#B3B3B3]">管理網站管理員權限</p>
            </div>
            <Link
              href="/admin"
              className="text-[#B3B3B3] hover:text-white transition"
            >
              返回後台
            </Link>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${
            message.type === 'error' 
              ? 'bg-red-900/30 border border-red-700 text-red-400'
              : 'bg-green-900/30 border border-green-700 text-green-400'
          }`}>
            {message.text}
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="搜尋用戶（Email 或用戶名）..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 bg-[#121212] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:border-[#FFD700] focus:outline-none"
          />
        </div>

        {/* Current Admins */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 mb-6">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-lg font-medium text-white">👑 現有管理員 ({adminUsers.length})</h2>
          </div>
          
          {adminUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              暫時沒有設置管理員
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {adminUsers.map(admin => (
                <div key={admin.id} className="p-4 flex items-center gap-4">
                  <img 
                    src={admin.photoURL || '/default-avatar.png'} 
                    alt={admin.displayName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{admin.displayName || '未知用戶'}</p>
                    <p className="text-sm text-gray-500 truncate">{admin.email}</p>
                  </div>
                  <span className="px-2 py-1 bg-[#FFD700] text-black text-xs font-bold rounded">
                    ADMIN
                  </span>
                  {admin.email !== 'kermit.tam@gmail.com' && (
                    <button
                      onClick={() => toggleAdmin(admin.id, true)}
                      className="px-3 py-1.5 text-red-400 border border-red-700 rounded hover:bg-red-900/20 transition text-sm"
                    >
                      取消權限
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Users */}
        <div className="bg-[#121212] rounded-xl border border-gray-800">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-lg font-medium text-white">👥 所有用戶 ({regularUsers.length})</h2>
          </div>
          
          {regularUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchTerm ? '找不到符合的用戶' : '暫時沒有其他用戶'}
            </div>
          ) : (
            <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
              {regularUsers.map(u => (
                <div key={u.id} className="p-4 flex items-center gap-4 hover:bg-gray-900/50 transition">
                  <img 
                    src={u.photoURL || '/default-avatar.png'} 
                    alt={u.displayName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{u.displayName || '未知用戶'}</p>
                    <p className="text-sm text-gray-500 truncate">{u.email}</p>
                    {u.createdAt && (
                      <p className="text-xs text-gray-600">
                        註冊: {new Date(u.createdAt).toLocaleDateString('zh-HK')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleAdmin(u.id, false)}
                    className="px-3 py-1.5 bg-[#FFD700] text-black rounded hover:opacity-90 transition text-sm font-medium"
                  >
                    設為管理員
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-gray-900 rounded-lg text-sm text-gray-400">
          <p className="mb-2">💡 <span className="text-white">說明：</span></p>
          <ul className="space-y-1 list-disc list-inside">
            <li>管理員可以進入後台管理所有內容</li>
            <li>設為管理員後，該用戶需要重新登入權限才會生效</li>
            <li>超級管理員（kermit.tam@gmail.com）權限無法被取消</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

export default function AdminManagementGuard() {
  return (
    <AdminGuard>
      <AdminManagement />
    </AdminGuard>
  )
}

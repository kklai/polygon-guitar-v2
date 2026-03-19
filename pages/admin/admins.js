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
  updateDoc
} from '@/lib/firestore-tracked'
import Link from '@/components/Link'
import { ROLES, ROLE_LABELS, ROLE_COLORS, getRoleLabel, getRoleColor } from '@/lib/roles'

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

  const updateUserRole = async (userId, newRole) => {
    try {
      const userRef = doc(db, 'users', userId)
      await updateDoc(userRef, {
        role: newRole,
        isAdmin: !!newRole,
        updatedAt: new Date().toISOString()
      })
      
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, role: newRole, isAdmin: !!newRole } : u
      ))
      
      showMessage(`已設置為 ${getRoleLabel(newRole)}`)
    } catch (error) {
      console.error('Error updating role:', error)
      showMessage('更新失敗', 'error')
    }
  }

  const removeRole = async (userId) => {
    try {
      const userRef = doc(db, 'users', userId)
      await updateDoc(userRef, {
        role: null,
        isAdmin: false,
        updatedAt: new Date().toISOString()
      })
      
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, role: null, isAdmin: false } : u
      ))
      
      showMessage('已移除管理員權限')
    } catch (error) {
      console.error('Error removing role:', error)
      showMessage('移除失敗', 'error')
    }
  }

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 分組（Super Admin 只按 Firestore role，無硬編碼 email）
  const superAdmins = filteredUsers.filter(u => u.role === ROLES.SUPER_ADMIN)
  const usersWithRoles = filteredUsers.filter(u => u.role && u.role !== ROLES.SUPER_ADMIN)
  const usersWithoutRoles = filteredUsers.filter(u => !u.role)

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
        <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-neutral-800 -mx-4 px-4 py-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                管理員設置
              </h1>
              <p className="text-sm text-[#B3B3B3]">設置用戶為管理員（傳統方式）</p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/admin/role-settings"
                className="px-3 py-1.5 bg-[#FFD700] text-black rounded text-sm font-medium hover:opacity-90"
              >
                角色設置
              </Link>
              <Link
                href="/admin"
                className="text-[#B3B3B3] hover:text-white transition"
              >
                返回後台
              </Link>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
          <p className="text-yellow-400 text-sm">
            <span className="font-medium">建議使用新的角色系統</span> - 
            請前往 <Link href="/admin/role-settings" className="underline hover:text-yellow-300">角色權限設置</Link> 
            設置 Art Director、Score Checker 或 Playlist Maker 角色
          </p>
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
            className="w-full px-4 py-3 bg-[#282828] border-0 rounded-full text-white placeholder-[#666] outline-none"
          />
        </div>

        {/* Super Admin */}
        <div className="bg-[#121212] rounded-xl border border-neutral-800 mb-6">
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
            <h2 className="text-lg font-medium text-white">超級管理員</h2>
          </div>
          <div className="divide-y divide-neutral-800">
            {superAdmins.map(admin => (
              <div key={admin.id} className="p-4 flex items-center gap-4">
                <img 
                  src={admin.photoURL || '/default-avatar.png'} 
                  alt={admin.displayName}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{admin.displayName || '未知用戶'}</p>
                  <p className="text-sm text-neutral-500 truncate">{admin.email}</p>
                </div>
                <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">
                  SUPER ADMIN
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Users with Admin Role */}
        <div className="bg-[#121212] rounded-xl border border-neutral-800 mb-6">
          <div className="p-4 border-b border-neutral-800">
            <h2 className="text-lg font-medium text-white">已設置角色 ({usersWithRoles.length})</h2>
          </div>
          
          {usersWithRoles.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">
              暫時沒有設置角色的用戶
            </div>
          ) : (
            <div className="divide-y divide-neutral-800">
              {usersWithRoles.map(admin => (
                <div key={admin.id} className="p-4 flex items-center gap-4">
                  <img 
                    src={admin.photoURL || '/default-avatar.png'} 
                    alt={admin.displayName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{admin.displayName || '未知用戶'}</p>
                    <p className="text-sm text-neutral-500 truncate">{admin.email}</p>
                  </div>
                  <span className={`px-2 py-1 ${getRoleColor(admin.role)} text-white text-xs font-bold rounded`}>
                    {getRoleLabel(admin.role)}
                  </span>
                  <button
                    onClick={() => removeRole(admin.id)}
                    className="px-3 py-1.5 text-red-400 border border-red-700 rounded hover:bg-red-900/20 transition text-sm"
                  >
                    取消權限
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Users */}
        <div className="bg-[#121212] rounded-xl border border-neutral-800">
          <div className="p-4 border-b border-neutral-800">
            <h2 className="text-lg font-medium text-white">普通用戶 ({usersWithoutRoles.length})</h2>
          </div>
          
          {usersWithoutRoles.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">
              {searchTerm ? '找不到符合的用戶' : '暫時沒有其他用戶'}
            </div>
          ) : (
            <div className="divide-y divide-neutral-800 max-h-96 overflow-y-auto">
              {usersWithoutRoles.map(u => (
                <div key={u.id} className="p-4 flex items-center gap-4 hover:bg-neutral-900/50 transition">
                  <img 
                    src={u.photoURL || '/default-avatar.png'} 
                    alt={u.displayName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{u.displayName || '未知用戶'}</p>
                    <p className="text-sm text-neutral-500 truncate">{u.email}</p>
                    {u.createdAt && (
                      <p className="text-xs text-neutral-600">
                        註冊: {new Date(u.createdAt).toLocaleDateString('zh-HK')}
                      </p>
                    )}
                  </div>
                  
                  <select
                    value=""
                    onChange={(e) => e.target.value && updateUserRole(u.id, e.target.value)}
                    className="px-3 py-1.5 bg-[#FFD700] text-black rounded text-sm font-medium cursor-pointer"
                  >
                    <option value="">+ 設為管理員</option>
                    <option value={ROLES.SUPER_ADMIN}>Super Admin</option>
                    <option value={ROLES.ART_DIRECTOR}>Art Director</option>
                    <option value={ROLES.SCORE_CHECKER}>Score Checker</option>
                    <option value={ROLES.PLAYLIST_MAKER}>Playlist Maker</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-neutral-900 rounded-lg text-sm text-neutral-400">
          <p className="mb-2"><span className="text-white">說明：</span></p>
          <ul className="space-y-1 list-disc list-inside">
            <li>設置為管理員後，該用戶可以進入後台並根據角色獲得不同權限</li>
            <li>用戶需要重新登入權限才會生效</li>
            <li>建議使用 <Link href="/admin/role-settings" className="text-[#FFD700] hover:underline">角色權限設置</Link> 進行更詳細的權限管理</li>
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

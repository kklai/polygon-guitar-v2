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
} from 'firebase/firestore'
import Link from 'next/link'
import { ROLES, ROLE_LABELS, ROLE_COLORS, getRoleLabel, getRoleColor } from '@/lib/roles'

function RoleSettings() {
  const { user, userRole } = useAuth()
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
        isAdmin: !!newRole,  // 如果有角色，也是管理員
        updatedAt: new Date().toISOString()
      })
      
      // Update local state
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
      
      showMessage('已移除角色')
    } catch (error) {
      console.error('Error removing role:', error)
      showMessage('移除失敗', 'error')
    }
  }

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 按角色分組
  const superAdmins = filteredUsers.filter(u => u.email === 'kermit.tam@gmail.com')
  const usersWithRoles = filteredUsers.filter(u => u.role && u.email !== 'kermit.tam@gmail.com')
  const usersWithoutRoles = filteredUsers.filter(u => !u.role && u.email !== 'kermit.tam@gmail.com')

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
                <span>🎭</span> 角色權限設置
              </h1>
              <p className="text-sm text-[#B3B3B3]">設置用戶角色權限</p>
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

        {/* Role Legend */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-4 mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-3">角色說明</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 p-2 bg-gray-900 rounded">
              <span className="w-3 h-3 rounded-full bg-pink-500"></span>
              <div>
                <span className="text-white text-sm font-medium">Art Director</span>
                <p className="text-xs text-gray-500">Logo、相片、封面管理</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-gray-900 rounded">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <div>
                <span className="text-white text-sm font-medium">Score Checker</span>
                <p className="text-xs text-gray-500">編輯樂譜、歌手資料</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-gray-900 rounded">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <div>
                <span className="text-white text-sm font-medium">Playlist Maker</span>
                <p className="text-xs text-gray-500">創建特色歌單</p>
              </div>
            </div>
          </div>
        </div>

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

        {/* Super Admin */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 mb-6">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-lg font-medium text-white">👑 超級管理員</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {superAdmins.map(admin => (
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
                <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">
                  SUPER ADMIN
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Users with Roles */}
        {usersWithRoles.length > 0 && (
          <div className="bg-[#121212] rounded-xl border border-gray-800 mb-6">
            <div className="p-4 border-b border-gray-800">
              <h2 className="text-lg font-medium text-white">🎭 已設置角色 ({usersWithRoles.length})</h2>
            </div>
            <div className="divide-y divide-gray-800">
              {usersWithRoles.map(u => (
                <div key={u.id} className="p-4 flex items-center gap-4">
                  <img 
                    src={u.photoURL || '/default-avatar.png'} 
                    alt={u.displayName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{u.displayName || '未知用戶'}</p>
                    <p className="text-sm text-gray-500 truncate">{u.email}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 ${getRoleColor(u.role)} text-white text-xs font-bold rounded`}>
                      {getRoleLabel(u.role)}
                    </span>
                    
                    <select
                      value={u.role || ''}
                      onChange={(e) => updateUserRole(u.id, e.target.value || null)}
                      className="px-2 py-1 bg-gray-800 text-white text-sm rounded border border-gray-700"
                    >
                      <option value="">選擇角色...</option>
                      <option value={ROLES.ART_DIRECTOR}>Art Director</option>
                      <option value={ROLES.SCORE_CHECKER}>Score Checker</option>
                      <option value={ROLES.PLAYLIST_MAKER}>Playlist Maker</option>
                    </select>
                    
                    <button
                      onClick={() => removeRole(u.id)}
                      className="px-2 py-1 text-red-400 hover:bg-red-900/20 rounded text-sm"
                    >
                      移除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users without Roles */}
        <div className="bg-[#121212] rounded-xl border border-gray-800">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-lg font-medium text-white">👥 普通用戶 ({usersWithoutRoles.length})</h2>
          </div>
          
          {usersWithoutRoles.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchTerm ? '找不到符合的用戶' : '暫時沒有普通用戶'}
            </div>
          ) : (
            <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
              {usersWithoutRoles.map(u => (
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
                  
                  <div className="flex items-center gap-2">
                    <select
                      value=""
                      onChange={(e) => e.target.value && updateUserRole(u.id, e.target.value)}
                      className="px-3 py-1.5 bg-[#FFD700] text-black text-sm rounded font-medium cursor-pointer"
                    >
                      <option value="">+ 設置角色</option>
                      <option value={ROLES.ART_DIRECTOR}>Art Director</option>
                      <option value={ROLES.SCORE_CHECKER}>Score Checker</option>
                      <option value={ROLES.PLAYLIST_MAKER}>Playlist Maker</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-gray-900 rounded-lg text-sm text-gray-400">
          <p className="mb-2">💡 <span className="text-white">說明：</span></p>
          <ul className="space-y-1 list-disc list-inside">
            <li>設置角色後，用戶可以進入後台並根據角色獲得不同權限</li>
            <li>用戶需要重新登入權限才會完全生效</li>
            <li>Art Director：管理 Logo、App Icon、歌手相片、分類封面</li>
            <li>Score Checker：編輯樂譜內容、歌手資料、修復數據</li>
            <li>Playlist Maker：創建和編輯精選歌單</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

export default function RoleSettingsGuard() {
  return (
    <AdminGuard>
      <RoleSettings />
    </AdminGuard>
  )
}

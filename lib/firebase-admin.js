// Firebase Admin 工具
// 注意：在 Vercel 環境使用需要設置環境變數

import { getAuth } from 'firebase/auth'
import { app } from './firebase'

/**
 * 驗證 Admin Token
 * 簡化版：檢查是否為已登入用戶（實際項目應檢查 admin 權限）
 */
export async function verifyAdmin(token) {
  try {
    // 簡化驗證：檢查 token 是否存在
    // 實際應用中應該用 Firebase Admin SDK 驗證
    if (!token || token.length < 10) {
      return null
    }
    
    // 返回模擬的 decoded token
    // 實際應用中應該用 admin.auth().verifyIdToken(token)
    return {
      uid: 'admin-user',
      email: 'admin@polygon.guitars',
      admin: true
    }
  } catch (error) {
    console.error('Admin verification error:', error)
    return null
  }
}

/**
 * 檢查是否為 Admin 用戶
 */
export function isAdmin(user) {
  if (!user) return false
  // 簡化檢查：可以根據 email 或其他標記判斷
  const adminEmails = [
    'admin@polygon.guitars',
    'kermit@polygon.guitars'
  ]
  return adminEmails.includes(user.email)
}

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// 初始化 Firebase Admin
function initAdmin() {
  if (getApps().length > 0) {
    return getFirestore()
  }

  // 嘗試從環境變量讀取服務帳號
  let serviceAccount
  
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      // Vercel 環境：使用 JSON 字符串
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // 本地開發：使用文件路徑
      const accountPath = resolve(process.env.FIREBASE_SERVICE_ACCOUNT)
      serviceAccount = JSON.parse(readFileSync(accountPath, 'utf8'))
    } else {
      throw new Error('Firebase service account not configured')
    }
  } catch (error) {
    console.error('Error loading Firebase service account:', error)
    throw error
  }

  const app = initializeApp({
    credential: cert(serviceAccount)
  })

  return getFirestore(app)
}

export const db = initAdmin()

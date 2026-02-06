import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve } from 'path'

let dbInstance = null

// 延遲初始化 Firebase Admin
export function getDb() {
  if (dbInstance) {
    return dbInstance
  }

  // 如果已經初始化，直接返回實例
  if (getApps().length > 0) {
    dbInstance = getFirestore()
    return dbInstance
  }

  let serviceAccount
  
  try {
    // 優先使用 JSON 環境變數（Vercel）
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      console.log('[Firebase Admin] Using FIREBASE_SERVICE_ACCOUNT_JSON')
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    } 
    // 其次使用文件路徑（本地開發）
    else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('[Firebase Admin] Using FIREBASE_SERVICE_ACCOUNT file')
      const accountPath = resolve(process.env.FIREBASE_SERVICE_ACCOUNT)
      serviceAccount = JSON.parse(readFileSync(accountPath, 'utf8'))
    } 
    else {
      throw new Error('Firebase service account not configured')
    }
  } catch (error) {
    console.error('[Firebase Admin] Error loading service account:', error.message)
    throw error
  }

  // 確保必要字段存在
  if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
    throw new Error('Invalid service account: missing required fields')
  }

  const app = initializeApp({
    credential: cert(serviceAccount)
  })

  console.log('[Firebase Admin] Initialized for project:', serviceAccount.project_id)
  dbInstance = getFirestore(app)
  return dbInstance
}

// 為了向後兼容，也導出 db（但不建議使用）
export const db = {
  collection: (...args) => getDb().collection(...args),
  doc: (...args) => getDb().doc(...args)
}

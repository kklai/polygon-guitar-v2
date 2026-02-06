import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// 初始化 Firebase Admin
function initAdmin() {
  // 如果已經初始化，直接返回實例
  if (getApps().length > 0) {
    return getFirestore()
  }

  let serviceAccount
  
  try {
    // 優先使用 JSON 環境變數（Vercel）
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      console.log('Using FIREBASE_SERVICE_ACCOUNT_JSON from env')
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    } 
    // 其次使用文件路徑（本地開發）
    else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('Using FIREBASE_SERVICE_ACCOUNT file:', process.env.FIREBASE_SERVICE_ACCOUNT)
      const accountPath = resolve(process.env.FIREBASE_SERVICE_ACCOUNT)
      serviceAccount = JSON.parse(readFileSync(accountPath, 'utf8'))
    } 
    else {
      throw new Error('Firebase service account not configured. Please set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT')
    }
  } catch (error) {
    console.error('Error loading Firebase service account:', error.message)
    throw error
  }

  // 確保必要字段存在
  if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
    throw new Error('Invalid service account: missing required fields')
  }

  const app = initializeApp({
    credential: cert(serviceAccount)
  })

  console.log('Firebase Admin initialized for project:', serviceAccount.project_id)
  return getFirestore(app)
}

export const db = initAdmin()

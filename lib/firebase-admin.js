// 簡化的 Firebase Admin 配置
let db = null

export function getDb() {
  if (db) return db
  
  try {
    const { initializeApp, cert, getApps } = require('firebase-admin/app')
    const { getFirestore } = require('firebase-admin/firestore')
    
    if (getApps().length > 0) {
      db = getFirestore()
      return db
    }
    
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    
    if (!serviceAccountJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON not set')
    }
    
    let serviceAccount
    try {
      serviceAccount = JSON.parse(serviceAccountJson)
    } catch (e) {
      throw new Error('Invalid JSON in FIREBASE_SERVICE_ACCOUNT_JSON: ' + e.message)
    }
    
    const app = initializeApp({
      credential: cert(serviceAccount)
    })
    
    db = getFirestore(app)
    return db
    
  } catch (error) {
    console.error('[Firebase Admin] Init error:', error.message)
    throw error
  }
}

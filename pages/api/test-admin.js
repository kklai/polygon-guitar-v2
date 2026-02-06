import { db } from '../../lib/firebase-admin'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  
  try {
    // 測試數據庫連接
    const testDoc = db.collection('settings').doc('test')
    const snapshot = await testDoc.get()
    
    return res.status(200).json({
      success: true,
      message: 'Firebase Admin connected',
      hasSettings: snapshot.exists,
      env: {
        nodeEnv: process.env.NODE_ENV,
        hasServiceAccountJson: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
        hasServiceAccountFile: !!process.env.FIREBASE_SERVICE_ACCOUNT
      }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    })
  }
}

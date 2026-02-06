export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  
  try {
    const { getDb } = require('../../lib/firebase-admin')
    const db = getDb()
    const snapshot = await db.collection('settings').doc('test').get()
    
    return res.status(200).json({
      success: true,
      message: 'Firebase Admin OK',
      hasTestDoc: snapshot.exists
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

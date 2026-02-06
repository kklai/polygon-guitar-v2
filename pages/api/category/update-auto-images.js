import { getDb } from '../../../lib/firebase-admin'

/**
 * 自動更新分類封面 API
 * - 每天自動運行（Vercel Cron）
 * - 獲取各類別（男歌手/女歌手/組合）最熱門的歌手
 * - 更新首頁分類顯示的封面圖片
 */
export default async function handler(req, res) {
  // 設置 CORS 和內容類型
  res.setHeader('Content-Type', 'application/json')
  
  try {
    // 驗證請求來源（Cron Job 或手動觸發）
    const { key } = req.query
    const cronSecret = process.env.UPDATE_CATEGORY_KEY
    
    // Vercel Cron 驗證
    const isVercelCron = req.headers['x-vercel-signature'] || 
                         req.headers['user-agent']?.includes('vercel') ||
                         req.headers['x-vercel-deployment-url']
    
    // 手動觸發需要 key
    const isManualTrigger = key && key === cronSecret
    
    // 開發環境跳過驗證
    const isDev = process.env.NODE_ENV !== 'production'
    
    if (!isVercelCron && !isManualTrigger && !isDev) {
      return res.status(401).json({ error: 'Unauthorized', reason: 'invalid_key' })
    }

    // 初始化數據庫
    const db = getDb()

    const categories = {
      male: '男歌手',
      female: '女歌手',
      group: '組合'
    }
    
    const updates = {}
    const details = {}

    for (const [type, label] of Object.entries(categories)) {
      try {
        // 查詢該類別最熱門的歌手（以 tabCount 排序）
        const artistsRef = db.collection('artists')
        const q = artistsRef
          .where('artistType', '==', type)
          .orderBy('tabCount', 'desc')
          .limit(1)

        const snapshot = await q.get()
        
        if (!snapshot.empty) {
          const artistDoc = snapshot.docs[0]
          const artist = artistDoc.data()
          
          // 優先使用 wikiPhotoURL，其次是 photoURL
          const photoUrl = artist.wikiPhotoURL || artist.photoURL
          
          if (photoUrl) {
            updates[type] = {
              image: photoUrl,
              artistId: artistDoc.id,
              artistName: artist.name,
              updatedAt: new Date().toISOString(),
              hotScore: artist.tabCount || 0
            }
            
            details[type] = {
              artistName: artist.name,
              image: photoUrl,
              hotScore: artist.tabCount || 0
            }
          } else {
            details[type] = { error: 'No photo found', artistName: artist.name }
          }
        } else {
          details[type] = { error: 'No artists found' }
        }
      } catch (typeError) {
        details[type] = { error: typeError.message }
      }
    }

    // 更新 settings/categoryImages 文檔
    if (Object.keys(updates).length > 0) {
      try {
        const settingsRef = db.collection('settings').doc('categoryImages')
        await settingsRef.set(updates, { merge: true })
      } catch (dbError) {
        return res.status(500).json({
          error: 'Database update failed',
          details: dbError.message
        })
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Category images updated successfully',
      timestamp: new Date().toISOString(),
      data: details
    })

  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

import { collection, query, where, orderBy, limit, getDocs, doc, setDoc } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

/**
 * 自動更新分類封面 API
 * - 每天自動運行（Vercel Cron）
 * - 獲取各類別（男歌手/女歌手/組合）最熱門的歌手
 * - 更新首頁分類顯示的封面圖片
 */
export default async function handler(req, res) {
  // 驗證請求來源（Cron Job 或手動觸發）
  const { key } = req.query
  const cronSecret = process.env.UPDATE_CATEGORY_KEY
  
  // Vercel Cron 不帶 key，使用其他方式驗證
  const isVercelCron = req.headers['x-vercel-signature'] || 
                       req.headers['user-agent']?.includes('vercel') ||
                       req.headers['x-vercel-deployment-url']
  
  // 本地開發或手動觸發需要 key
  const isManualTrigger = key === cronSecret
  
  if (!isVercelCron && !isManualTrigger && process.env.NODE_ENV === 'production') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const categories = {
      male: '男歌手',
      female: '女歌手',
      group: '組合'
    }
    
    const updates = {}
    const details = {}

    for (const [type, label] of Object.entries(categories)) {
      // 查詢該類別最熱門的歌手（以 tabCount 排序）
      const q = query(
        collection(db, 'artists'),
        where('artistType', '==', type),
        orderBy('tabCount', 'desc'),
        limit(1)
      )

      const snapshot = await getDocs(q)
      
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
        }
      }
    }

    // 更新 settings/categoryImages 文檔
    if (Object.keys(updates).length > 0) {
      const settingsRef = doc(db, 'settings', 'categoryImages')
      await setDoc(settingsRef, updates, { merge: true })
    }

    return res.status(200).json({
      success: true,
      message: 'Category images updated successfully',
      timestamp: new Date().toISOString(),
      data: details
    })

  } catch (error) {
    console.error('Error updating category images:', error)
    return res.status(500).json({
      error: 'Failed to update category images',
      details: error.message
    })
  }
}

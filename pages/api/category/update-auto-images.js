import { getAllArtists } from '@/lib/tabs'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const COLLECTION_NAME = 'settings'
const DOC_ID = 'categoryImages'

// 獲取每個類別最熱門的歌手
async function getTopArtistsByType() {
  const artists = await getAllArtists()
  
  const categories = {
    male: [],
    female: [],
    group: []
  }
  
  // 按類別分組
  artists.forEach(artist => {
    const type = artist.artistType
    if (type && categories[type]) {
      // 計算熱度分數：瀏覽量 * 0.7 + 總讚數 * 0.3
      const popularity = (artist.viewCount || 0) * 0.7 + (artist.totalLikes || 0) * 0.3
      categories[type].push({
        ...artist,
        popularityScore: popularity
      })
    }
  })
  
  // 每類別按熱度排序並取第一個
  const result = {}
  for (const [type, list] of Object.entries(categories)) {
    if (list.length > 0) {
      // 按熱度分數排序
      list.sort((a, b) => b.popularityScore - a.popularityScore)
      const topArtist = list[0]
      
      // 獲取圖片（優先順序：heroPhoto > photoURL > wikiPhotoURL）
      const image = topArtist.heroPhoto || topArtist.photoURL || topArtist.wikiPhotoURL || topArtist.photo
      
      result[type] = {
        artistId: topArtist.id,
        artistName: topArtist.name,
        image: image,
        viewCount: topArtist.viewCount || 0,
        totalLikes: topArtist.totalLikes || 0,
        popularityScore: topArtist.popularityScore,
        updatedAt: new Date().toISOString()
      }
    }
  }
  
  return result
}

export default async function handler(req, res) {
  // 驗證請求（支援 Cron Job 或 Admin 調用）
  const { authorization } = req.headers
  const isCronJob = req.headers['x-vercel-cron'] === '1'
  
  // 如果是 Cron Job 或有正確授權碼
  if (!isCronJob && authorization !== `Bearer ${process.env.ADMIN_API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    console.log('🔄 開始更新分類圖片...')
    
    const topArtists = await getTopArtistsByType()
    
    // 準備更新數據
    const updates = {}
    const updateLog = []
    
    for (const [type, data] of Object.entries(topArtists)) {
      if (data.image) {
        updates[type] = data.image
        updates[`${type}Source`] = 'auto'
        updates[`${type}ArtistId`] = data.artistId
        updates[`${type}ArtistName`] = data.artistName
        updates[`${type}UpdatedAt`] = data.updatedAt
        
        updateLog.push({
          category: type,
          artist: data.artistName,
          views: data.viewCount,
          likes: data.totalLikes,
          score: Math.round(data.popularityScore)
        })
      }
    }
    
    // 保存到 Firestore
    if (Object.keys(updates).length > 0) {
      const docRef = doc(db, COLLECTION_NAME, DOC_ID)
      
      // 獲取現有設置，保留手動上傳的圖片（如果設置了 manualOverride）
      const existingDoc = await getDoc(docRef)
      const existingData = existingDoc.exists() ? existingDoc.data() : {}
      
      // 檢查是否有手動覆蓋的設置
      for (const type of ['male', 'female', 'group']) {
        if (existingData[`${type}ManualOverride`]) {
          // 保留手動設置，不更新
          delete updates[type]
          delete updates[`${type}Source`]
          delete updates[`${type}ArtistId`]
          delete updates[`${type}ArtistName`]
          delete updates[`${type}UpdatedAt`]
          
          updateLog.push({
            category: type,
            skipped: true,
            reason: '手動覆蓋已啟用'
          })
        }
      }
      
      await setDoc(docRef, updates, { merge: true })
    }
    
    res.status(200).json({
      success: true,
      message: '分類圖片已更新',
      updated: Object.keys(topArtists).length,
      details: updateLog,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('更新分類圖片失敗:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

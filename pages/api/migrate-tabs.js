import { 
  collection, 
  getDocs, 
  doc,
  updateDoc,
  setDoc,
  getDoc,
  increment
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

// 生成 artistId
function generateArtistId(artistName) {
  if (!artistName) return null
  return artistName.toLowerCase().replace(/\s+/g, '-')
}

export default async function handler(req, res) {
  // 只允許 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const results = {
    total: 0,
    fixed: 0,
    errors: [],
    artists: {}
  }

  try {
    // 1. 獲取所有樂譜
    const tabsSnapshot = await getDocs(collection(db, 'tabs'))
    const tabsWithoutArtistId = []

    tabsSnapshot.forEach((docSnapshot) => {
      const tab = docSnapshot.data()
      results.total++
      
      if (!tab.artistId) {
        tabsWithoutArtistId.push({
          id: docSnapshot.id,
          ...tab
        })
      }
    })

    // 2. 修復每一個冇 artistId 嘅樂譜
    for (const tab of tabsWithoutArtistId) {
      const artistId = generateArtistId(tab.artist)
      
      if (!artistId) {
        results.errors.push({ id: tab.id, reason: 'No artist field' })
        continue
      }

      try {
        // 更新樂譜
        const tabRef = doc(db, 'tabs', tab.id)
        await updateDoc(tabRef, { artistId })
        results.fixed++

        // 統計歌手譜數
        if (!results.artists[artistId]) {
          results.artists[artistId] = {
            name: tab.artist,
            count: 0
          }
        }
        results.artists[artistId].count++

      } catch (error) {
        results.errors.push({ id: tab.id, reason: error.message })
      }
    }

    // 3. 更新歌手文件
    for (const [artistId, data] of Object.entries(results.artists)) {
      try {
        const artistRef = doc(db, 'artists', artistId)
        const artistSnap = await getDoc(artistRef)

        if (artistSnap.exists()) {
          await updateDoc(artistRef, {
            tabCount: increment(data.count)
          })
        } else {
          await setDoc(artistRef, {
            name: data.name,
            normalizedName: artistId,
            tabCount: data.count,
            createdAt: new Date().toISOString()
          })
        }
      } catch (error) {
        results.errors.push({ artistId, reason: error.message })
      }
    }

    return res.status(200).json({
      success: true,
      message: `Fixed ${results.fixed} tabs`,
      results
    })

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

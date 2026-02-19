import { db } from './firebase'
import { auth } from './firebase'
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  increment
} from 'firebase/firestore'

/**
 * 提交或更新用戶對歌曲的評分
 * @param {string} songId - 歌曲 ID
 * @param {number} rating - 評分 (1-5)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function submitRating(songId, rating) {
  try {
    const user = auth.currentUser
    if (!user) {
      return { success: false, message: '請先登入' }
    }

    if (!songId || !rating || rating < 1 || rating > 5) {
      return { success: false, message: '無效的評分' }
    }

    const userId = user.uid
    const ratingId = `${userId}_${songId}`
    const ratingRef = doc(db, 'ratings', ratingId)
    const songRef = doc(db, 'songs', songId)

    // 檢查用戶是否已評分
    const existingRatingDoc = await getDoc(ratingRef)
    const existingRating = existingRatingDoc.exists() ? existingRatingDoc.data().rating : null

    // 開始批次更新
    const batch = writeBatch(db)

    if (existingRating) {
      // 更新現有評分
      batch.update(ratingRef, {
        rating: rating,
        updatedAt: serverTimestamp()
      })

      // 更新歌曲統計：減去舊評分，加上新評分
      batch.update(songRef, {
        totalRating: increment(rating - existingRating),
        averageRating: (songRef.totalRating + rating - existingRating) / songRef.ratingCount
      })
    } else {
      // 創建新評分
      batch.set(ratingRef, {
        userId: userId,
        songId: songId,
        rating: rating,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      // 更新歌曲統計
      const songDoc = await getDoc(songRef)
      if (songDoc.exists()) {
        const songData = songDoc.data()
        const currentCount = songData.ratingCount || 0
        const currentTotal = songData.totalRating || 0
        
        batch.update(songRef, {
          ratingCount: increment(1),
          totalRating: increment(rating),
          averageRating: (currentTotal + rating) / (currentCount + 1)
        })
      }
    }

    await batch.commit()
    return { success: true, message: existingRating ? '評分已更新' : '評分已提交' }
  } catch (error) {
    console.error('Error submitting rating:', error)
    return { success: false, message: '提交評分失敗：' + error.message }
  }
}

/**
 * 獲取用戶對某歌曲的評分
 * @param {string} songId - 歌曲 ID
 * @returns {Promise<{rating: number|null, exists: boolean}>}
 */
export async function getUserRating(songId) {
  try {
    const user = auth.currentUser
    if (!user || !songId) {
      return { rating: null, exists: false }
    }

    const ratingId = `${user.uid}_${songId}`
    const ratingRef = doc(db, 'ratings', ratingId)
    const ratingDoc = await getDoc(ratingRef)

    if (ratingDoc.exists()) {
      return { 
        rating: ratingDoc.data().rating, 
        exists: true,
        updatedAt: ratingDoc.data().updatedAt
      }
    }

    return { rating: null, exists: false }
  } catch (error) {
    console.error('Error getting user rating:', error)
    return { rating: null, exists: false }
  }
}

/**
 * 獲取歌曲的評分統計
 * @param {string} songId - 歌曲 ID
 * @returns {Promise<{averageRating: number, ratingCount: number, distribution: object}>}
 */
export async function getSongStats(songId) {
  try {
    if (!songId) {
      return { 
        averageRating: 0, 
        ratingCount: 0, 
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      }
    }

    // 從 songs 集合獲取緩存的統計
    const songRef = doc(db, 'songs', songId)
    const songDoc = await getDoc(songRef)

    if (songDoc.exists()) {
      const data = songDoc.data()
      return {
        averageRating: data.averageRating || 0,
        ratingCount: data.ratingCount || 0,
        totalRating: data.totalRating || 0
      }
    }

    // 如果 songs 沒有統計，實時計算
    const ratingsQuery = query(
      collection(db, 'ratings'),
      where('songId', '==', songId)
    )
    const ratingsSnapshot = await getDocs(ratingsQuery)

    let total = 0
    let count = 0
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

    ratingsSnapshot.forEach(doc => {
      const rating = doc.data().rating
      total += rating
      count++
      distribution[rating] = (distribution[rating] || 0) + 1
    })

    return {
      averageRating: count > 0 ? total / count : 0,
      ratingCount: count,
      totalRating: total,
      distribution
    }
  } catch (error) {
    console.error('Error getting song stats:', error)
    return { 
      averageRating: 0, 
      ratingCount: 0, 
      totalRating: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    }
  }
}

/**
 * 刪除用戶對某歌曲的評分
 * @param {string} songId - 歌曲 ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteRating(songId) {
  try {
    const user = auth.currentUser
    if (!user) {
      return { success: false, message: '請先登入' }
    }

    const ratingId = `${user.uid}_${songId}`
    const ratingRef = doc(db, 'ratings', ratingId)
    const songRef = doc(db, 'songs', songId)

    const ratingDoc = await getDoc(ratingRef)
    if (!ratingDoc.exists()) {
      return { success: false, message: '評分不存在' }
    }

    const oldRating = ratingDoc.data().rating

    // 批次更新
    const batch = writeBatch(db)
    batch.delete(ratingRef)

    // 更新歌曲統計
    const songDoc = await getDoc(songRef)
    if (songDoc.exists()) {
      const songData = songDoc.data()
      const currentCount = songData.ratingCount || 0
      const currentTotal = songData.totalRating || 0
      
      if (currentCount > 1) {
        batch.update(songRef, {
          ratingCount: increment(-1),
          totalRating: increment(-oldRating),
          averageRating: (currentTotal - oldRating) / (currentCount - 1)
        })
      } else {
        // 如果只有一個評分，重置為 0
        batch.update(songRef, {
          ratingCount: 0,
          totalRating: 0,
          averageRating: 0
        })
      }
    }

    await batch.commit()
    return { success: true, message: '評分已刪除' }
  } catch (error) {
    console.error('Error deleting rating:', error)
    return { success: false, message: '刪除評分失敗：' + error.message }
  }
}

// 引入 writeBatch
import { writeBatch } from 'firebase/firestore'

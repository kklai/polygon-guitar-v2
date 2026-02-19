// lib/ratingApi.js
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc, 
  updateDoc, 
  increment,
  writeBatch,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * 提交或更新評分
 * @param {string} userId - 用戶ID
 * @param {string} songId - 歌曲ID
 * @param {number} rating - 1-5星
 * @returns {Promise<{success: boolean, newAverage: number, newCount: number}>}
 */
export async function submitRating(userId, songId, rating) {
  if (!userId || !songId || rating < 1 || rating > 5) {
    throw new Error('參數錯誤');
  }

  const ratingRef = doc(db, 'ratings', `${userId}_${songId}`);
  const songRef = doc(db, 'songs', songId);
  
  try {
    // 檢查是否已有評分
    const existingRatingDoc = await getDoc(ratingRef);
    const songDoc = await getDoc(songRef);
    
    if (!songDoc.exists()) {
      throw new Error('歌曲不存在');
    }
    
    const songData = songDoc.data();
    const currentAvg = songData.averageRating || 0;
    const currentCount = songData.ratingCount || 0;
    const currentTotal = songData.totalRating || 0;

    if (existingRatingDoc.exists()) {
      const oldRating = existingRatingDoc.data().rating;
      
      if (oldRating === rating) {
        // 相同評分 = 取消評分
        await deleteDoc(ratingRef);
        
        const newCount = Math.max(0, currentCount - 1);
        const newTotal = currentTotal - oldRating;
        const newAvg = newCount > 0 ? newTotal / newCount : 0;
        
        await updateDoc(songRef, {
          totalRating: increment(-oldRating),
          ratingCount: increment(-1),
          averageRating: newAvg
        });
        
        return { 
          success: true, 
          action: 'removed',
          newAverage: newAvg, 
          newCount: newCount,
          userRating: 0
        };
      } else {
        // 更新評分
        await setDoc(ratingRef, {
          userId,
          songId,
          rating,
          updatedAt: serverTimestamp()
        }, { merge: true });
        
        const diff = rating - oldRating;
        const newTotal = currentTotal + diff;
        const newAvg = newTotal / currentCount;
        
        await updateDoc(songRef, {
          totalRating: increment(diff),
          averageRating: newAvg
        });
        
        return { 
          success: true, 
          action: 'updated',
          newAverage: newAvg, 
          newCount: currentCount,
          userRating: rating
        };
      }
    } else {
      // 新增評分
      await setDoc(ratingRef, {
        userId,
        songId,
        rating,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const newCount = currentCount + 1;
      const newTotal = currentTotal + rating;
      const newAvg = newTotal / newCount;
      
      await updateDoc(songRef, {
        totalRating: increment(rating),
        ratingCount: increment(1),
        averageRating: newAvg
      });
      
      return { 
        success: true, 
        action: 'added',
        newAverage: newAvg, 
        newCount: newCount,
        userRating: rating
      };
    }
  } catch (error) {
    console.error('評分失敗:', error);
    throw error;
  }
}

/**
 * 獲取用戶對某歌曲的評分
 * @param {string} userId 
 * @param {string} songId 
 * @returns {Promise<number|null>}
 */
export async function getUserRating(userId, songId) {
  if (!userId || !songId) return null;
  
  try {
    const ratingRef = doc(db, 'ratings', `${userId}_${songId}`);
    const ratingDoc = await getDoc(ratingRef);
    
    if (ratingDoc.exists()) {
      return ratingDoc.data().rating;
    }
    return null;
  } catch (error) {
    console.error('獲取用戶評分失敗:', error);
    return null;
  }
}

/**
 * 獲取歌曲統計資料
 * @param {string} songId 
 * @returns {Promise<{averageRating: number, ratingCount: number}>}
 */
export async function getSongStats(songId) {
  if (!songId) return { averageRating: 0, ratingCount: 0 };
  
  try {
    const songRef = doc(db, 'songs', songId);
    const songDoc = await getDoc(songRef);
    
    if (songDoc.exists()) {
      const data = songDoc.data();
      return {
        averageRating: data.averageRating || 0,
        ratingCount: data.ratingCount || 0,
        totalRating: data.totalRating || 0
      };
    }
    return { averageRating: 0, ratingCount: 0, totalRating: 0 };
  } catch (error) {
    console.error('獲取歌曲統計失敗:', error);
    return { averageRating: 0, ratingCount: 0, totalRating: 0 };
  }
}

/**
 * 獲取用戶所有評分（可選，用於個人記錄頁面）
 * @param {string} userId 
 * @returns {Promise<Array>}
 */
export async function getUserAllRatings(userId) {
  if (!userId) return [];
  
  try {
    const q = query(
      collection(db, 'ratings'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('獲取用戶所有評分失敗:', error);
    return [];
  }
}

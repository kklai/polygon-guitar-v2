// lib/ratingApi.js
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc, 
  updateDoc, 
  increment,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from '@/lib/firestore-tracked';
import { db } from './firebase';

/**
 * 提交或更新評分
 */
export async function submitRating(userId, tabId, rating) {
  if (!userId || !tabId || rating < 1 || rating > 5) {
    throw new Error('參數錯誤');
  }

  const ratingRef = doc(db, 'ratings', `${userId}_${tabId}`);
  const tabRef = doc(db, 'tabs', tabId);  // ✅ 改為 tabs
  
  try {
    const existingRatingDoc = await getDoc(ratingRef);
    const tabDoc = await getDoc(tabRef);  // ✅ 改為 tabs
    
    if (!tabDoc.exists()) {
      throw new Error('樂譜不存在');
    }
    
    const tabData = tabDoc.data();  // ✅ 改為 tabData
    const currentAvg = tabData.averageRating || 0;
    const currentCount = tabData.ratingCount || 0;
    const currentTotal = tabData.totalRating || 0;

    if (existingRatingDoc.exists()) {
      const oldRating = existingRatingDoc.data().rating;
      
      if (oldRating === rating) {
        // 取消評分
        await deleteDoc(ratingRef);
        const newCount = Math.max(0, currentCount - 1);
        const newTotal = currentTotal - oldRating;
        const newAvg = newCount > 0 ? newTotal / newCount : 0;
        
        await updateDoc(tabRef, {  // ✅ 改為 tabRef
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
          tabId,  // ✅ 改為 tabId
          rating,
          updatedAt: serverTimestamp()
        }, { merge: true });
        
        const diff = rating - oldRating;
        const newTotal = currentTotal + diff;
        const newAvg = newTotal / currentCount;
        
        await updateDoc(tabRef, {  // ✅ 改為 tabRef
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
        tabId,  // ✅ 改為 tabId
        rating,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const newCount = currentCount + 1;
      const newTotal = currentTotal + rating;
      const newAvg = newTotal / newCount;
      
      await updateDoc(tabRef, {  // ✅ 改為 tabRef
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
 * 獲取用戶對某樂譜的評分
 */
export async function getUserRating(userId, tabId) {  // ✅ 改參數名
  if (!userId || !tabId) return null;
  
  try {
    const ratingRef = doc(db, 'ratings', `${userId}_${tabId}`);
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
 * 獲取樂譜統計資料
 */
export async function getTabStats(tabId) {  // ✅ 改函數名
  if (!tabId) return { averageRating: 0, ratingCount: 0 };
  
  try {
    const tabRef = doc(db, 'tabs', tabId);  // ✅ 改為 tabs
    const tabDoc = await getDoc(tabRef);
    
    if (tabDoc.exists()) {
      const data = tabDoc.data();
      return {
        averageRating: data.averageRating || 0,
        ratingCount: data.ratingCount || 0,
        totalRating: data.totalRating || 0
      };
    }
    return { averageRating: 0, ratingCount: 0, totalRating: 0 };
  } catch (error) {
    console.error('獲取樂譜統計失敗:', error);
    return { averageRating: 0, ratingCount: 0, totalRating: 0 };
  }
}

/**
 * 獲取用戶所有評分
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

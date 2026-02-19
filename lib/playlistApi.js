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
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore'

/**
 * 切換歌曲喜愛狀態（喜愛/取消喜愛）
 * @param {string} songId - 歌曲 ID
 * @returns {Promise<{success: boolean, liked: boolean, message: string}>}
 */
export async function toggleLikeSong(songId) {
  try {
    const user = auth.currentUser
    if (!user) {
      return { success: false, liked: false, message: '請先登入' }
    }

    if (!songId) {
      return { success: false, liked: false, message: '無效的歌曲 ID' }
    }

    const userId = user.uid
    const docId = `${userId}_${songId}`
    const likedRef = doc(db, 'userLikedSongs', docId)
    const songRef = doc(db, 'songs', songId)

    // 檢查是否已喜愛
    const likedDoc = await getDoc(likedRef)
    const isLiked = likedDoc.exists()

    if (isLiked) {
      // 取消喜愛
      await deleteDoc(likedRef)
      
      // 更新歌曲喜愛計數
      try {
        await updateDoc(songRef, {
          likes: increment(-1)
        })
      } catch (e) {
        // 如果歌曲不存在或更新失敗，繼續
        console.log('Song like count update skipped')
      }

      return { success: true, liked: false, message: '已取消喜愛' }
    } else {
      // 添加喜愛
      await setDoc(likedRef, {
        userId: userId,
        songId: songId,
        createdAt: serverTimestamp()
      })

      // 更新歌曲喜愛計數
      try {
        await updateDoc(songRef, {
          likes: increment(1)
        })
      } catch (e) {
        console.log('Song like count update skipped')
      }

      return { success: true, liked: true, message: '已加入喜愛' }
    }
  } catch (error) {
    console.error('Error toggling like:', error)
    return { success: false, liked: false, message: '操作失敗：' + error.message }
  }
}

/**
 * 檢查用戶是否已喜愛某歌曲
 * @param {string} songId - 歌曲 ID
 * @returns {Promise<boolean>}
 */
export async function isSongLiked(songId) {
  try {
    const user = auth.currentUser
    if (!user || !songId) return false

    const docId = `${user.uid}_${songId}`
    const likedRef = doc(db, 'userLikedSongs', docId)
    const likedDoc = await getDoc(likedRef)

    return likedDoc.exists()
  } catch (error) {
    console.error('Error checking like status:', error)
    return false
  }
}

/**
 * 獲取用戶喜愛的所有歌曲 ID 列表
 * @returns {Promise<string[]>}
 */
export async function getUserLikedSongIds() {
  try {
    const user = auth.currentUser
    if (!user) return []

    const q = query(
      collection(db, 'userLikedSongs'),
      where('userId', '==', user.uid)
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => doc.data().songId)
  } catch (error) {
    console.error('Error getting liked songs:', error)
    return []
  }
}

/**
 * 創建用戶歌單
 * @param {string} title - 歌單名稱
 * @param {string} description - 歌單描述（可選）
 * @param {boolean} isPublic - 是否公開
 * @returns {Promise<{success: boolean, playlistId: string|null, message: string}>}
 */
export async function createPlaylist(title, description = '', isPublic = false) {
  try {
    const user = auth.currentUser
    if (!user) {
      return { success: false, playlistId: null, message: '請先登入' }
    }

    if (!title || title.trim().length === 0) {
      return { success: false, playlistId: null, message: '請輸入歌單名稱' }
    }

    const playlistRef = doc(collection(db, 'userPlaylists'))
    const playlistData = {
      id: playlistRef.id,
      userId: user.uid,
      userName: user.displayName || user.email || '匿名用戶',
      title: title.trim(),
      description: description.trim(),
      isPublic: isPublic,
      songs: [],
      songCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    await setDoc(playlistRef, playlistData)

    return { 
      success: true, 
      playlistId: playlistRef.id, 
      message: '歌單創建成功' 
    }
  } catch (error) {
    console.error('Error creating playlist:', error)
    return { success: false, playlistId: null, message: '創建失敗：' + error.message }
  }
}

/**
 * 獲取用戶的所有歌單
 * @returns {Promise<Array>}
 */
export async function getUserPlaylists() {
  try {
    const user = auth.currentUser
    if (!user) return []

    const q = query(
      collection(db, 'userPlaylists'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  } catch (error) {
    console.error('Error getting user playlists:', error)
    return []
  }
}

/**
 * 獲取單個歌單詳情
 * @param {string} playlistId - 歌單 ID
 * @returns {Promise<object|null>}
 */
export async function getPlaylist(playlistId) {
  try {
    if (!playlistId) return null

    const playlistRef = doc(db, 'userPlaylists', playlistId)
    const playlistDoc = await getDoc(playlistRef)

    if (!playlistDoc.exists()) return null

    const data = playlistDoc.data()
    
    // 檢查權限
    const user = auth.currentUser
    if (!data.isPublic && (!user || user.uid !== data.userId)) {
      return null // 私有歌單且非擁有者
    }

    return { id: playlistDoc.id, ...data }
  } catch (error) {
    console.error('Error getting playlist:', error)
    return null
  }
}

/**
 * 添加歌曲到歌單
 * @param {string} playlistId - 歌單 ID
 * @param {string} songId - 歌曲 ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function addSongToPlaylist(playlistId, songId) {
  try {
    const user = auth.currentUser
    if (!user) {
      return { success: false, message: '請先登入' }
    }

    const playlistRef = doc(db, 'userPlaylists', playlistId)
    const playlistDoc = await getDoc(playlistRef)

    if (!playlistDoc.exists()) {
      return { success: false, message: '歌單不存在' }
    }

    const playlistData = playlistDoc.data()
    if (playlistData.userId !== user.uid) {
      return { success: false, message: '無權限修改此歌單' }
    }

    // 檢查是否已存在
    if (playlistData.songs && playlistData.songs.includes(songId)) {
      return { success: false, message: '歌曲已在歌單中' }
    }

    await updateDoc(playlistRef, {
      songs: arrayUnion(songId),
      songCount: increment(1),
      updatedAt: serverTimestamp()
    })

    return { success: true, message: '已添加到歌單' }
  } catch (error) {
    console.error('Error adding song to playlist:', error)
    return { success: false, message: '添加失敗：' + error.message }
  }
}

/**
 * 從歌單移除歌曲
 * @param {string} playlistId - 歌單 ID
 * @param {string} songId - 歌曲 ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function removeSongFromPlaylist(playlistId, songId) {
  try {
    const user = auth.currentUser
    if (!user) {
      return { success: false, message: '請先登入' }
    }

    const playlistRef = doc(db, 'userPlaylists', playlistId)
    const playlistDoc = await getDoc(playlistRef)

    if (!playlistDoc.exists()) {
      return { success: false, message: '歌單不存在' }
    }

    const playlistData = playlistDoc.data()
    if (playlistData.userId !== user.uid) {
      return { success: false, message: '無權限修改此歌單' }
    }

    await updateDoc(playlistRef, {
      songs: arrayRemove(songId),
      songCount: increment(-1),
      updatedAt: serverTimestamp()
    })

    return { success: true, message: '已從歌單移除' }
  } catch (error) {
    console.error('Error removing song from playlist:', error)
    return { success: false, message: '移除失敗：' + error.message }
  }
}

/**
 * 更新歌單資訊
 * @param {string} playlistId - 歌單 ID
 * @param {object} updates - 更新內容 {title, description, isPublic}
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function updatePlaylist(playlistId, updates) {
  try {
    const user = auth.currentUser
    if (!user) {
      return { success: false, message: '請先登入' }
    }

    const playlistRef = doc(db, 'userPlaylists', playlistId)
    const playlistDoc = await getDoc(playlistRef)

    if (!playlistDoc.exists()) {
      return { success: false, message: '歌單不存在' }
    }

    if (playlistDoc.data().userId !== user.uid) {
      return { success: false, message: '無權限修改此歌單' }
    }

    const updateData = {
      updatedAt: serverTimestamp()
    }

    if (updates.title !== undefined) updateData.title = updates.title.trim()
    if (updates.description !== undefined) updateData.description = updates.description.trim()
    if (updates.isPublic !== undefined) updateData.isPublic = updates.isPublic

    await updateDoc(playlistRef, updateData)

    return { success: true, message: '歌單已更新' }
  } catch (error) {
    console.error('Error updating playlist:', error)
    return { success: false, message: '更新失敗：' + error.message }
  }
}

/**
 * 刪除歌單
 * @param {string} playlistId - 歌單 ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deletePlaylist(playlistId) {
  try {
    const user = auth.currentUser
    if (!user) {
      return { success: false, message: '請先登入' }
    }

    const playlistRef = doc(db, 'userPlaylists', playlistId)
    const playlistDoc = await getDoc(playlistRef)

    if (!playlistDoc.exists()) {
      return { success: false, message: '歌單不存在' }
    }

    if (playlistDoc.data().userId !== user.uid) {
      return { success: false, message: '無權限刪除此歌單' }
    }

    await deleteDoc(playlistRef)

    return { success: true, message: '歌單已刪除' }
  } catch (error) {
    console.error('Error deleting playlist:', error)
    return { success: false, message: '刪除失敗：' + error.message }
  }
}

/**
 * 獲取包含某歌曲的所有用戶歌單
 * @param {string} songId - 歌曲 ID
 * @returns {Promise<Array>}
 */
export async function getPlaylistsContainingSong(songId) {
  try {
    const user = auth.currentUser
    if (!user || !songId) return []

    const q = query(
      collection(db, 'userPlaylists'),
      where('userId', '==', user.uid),
      where('songs', 'array-contains', songId)
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  } catch (error) {
    console.error('Error getting playlists with song:', error)
    return []
  }
}

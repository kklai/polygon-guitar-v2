// lib/playlistApi.js
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
  addDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  documentId
} from '@/lib/firestore-tracked';
import { db } from './firebase';

/**
 * 切換喜愛狀態（加入或移除喜愛）
 * @param {string} userId 
 * @param {string} songId 
 * @returns {Promise<{isLiked: boolean}>}
 */
export async function toggleLikeSong(userId, songId) {
  if (!userId || !songId) throw new Error('參數錯誤');
  
  const likedRef = doc(db, 'userLikedSongs', `${userId}_${songId}`);
  
  try {
    const likedDoc = await getDoc(likedRef);
    
    if (likedDoc.exists()) {
      // 已喜愛 -> 移除
      await deleteDoc(likedRef);
      return { isLiked: false, action: 'removed' };
    } else {
      // 未喜愛 -> 加入
      await setDoc(likedRef, {
        userId,
        songId,
        likedAt: serverTimestamp()
      });
      return { isLiked: true, action: 'added' };
    }
  } catch (error) {
    console.error('切換喜愛狀態失敗:', error);
    throw error;
  }
}

/**
 * 檢查歌曲是否已被喜愛
 * @param {string} userId 
 * @param {string} songId 
 * @returns {Promise<boolean>}
 */
export async function checkIsLiked(userId, songId) {
  if (!userId || !songId) return false;
  
  try {
    const likedRef = doc(db, 'userLikedSongs', `${userId}_${songId}`);
    const likedDoc = await getDoc(likedRef);
    return likedDoc.exists();
  } catch (error) {
    console.error('檢查喜愛狀態失敗:', error);
    return false;
  }
}

/**
 * 獲取用戶所有喜愛歌曲ID
 * @param {string} userId 
 * @returns {Promise<Array<string>>}
 */
export async function getUserLikedSongs(userId) {
  if (!userId) return [];
  
  try {
    const q = query(
      collection(db, 'userLikedSongs'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data().songId);
  } catch (error) {
    console.error('獲取喜愛歌曲失敗:', error);
    return [];
  }
}

// ==================== 已收藏歌單（site playlists 收藏到收藏頁） ====================

/**
 * 將站內歌單加入「已收藏歌單」
 * @param {string} userId
 * @param {string} playlistId - 來自 playlists collection 的 id
 * @returns {Promise<{saved: boolean}>}
 */
export async function savePlaylistToLibrary(userId, playlistId) {
  if (!userId || !playlistId) throw new Error('參數錯誤');
  const ref = doc(db, 'userSavedPlaylists', `${userId}_${playlistId}`);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    return { saved: true, alreadySaved: true };
  }
  await setDoc(ref, {
    userId,
    playlistId,
    savedAt: serverTimestamp()
  });
  return { saved: true, alreadySaved: false };
}

/**
 * 從「已收藏歌單」移除
 */
export async function removeSavedPlaylist(userId, playlistId) {
  if (!userId || !playlistId) throw new Error('參數錯誤');
  const ref = doc(db, 'userSavedPlaylists', `${userId}_${playlistId}`);
  await deleteDoc(ref);
  return { saved: false };
}

/**
 * 檢查當前歌單是否已收藏
 */
export async function checkIsPlaylistSaved(userId, playlistId) {
  if (!userId || !playlistId) return false;
  try {
    const ref = doc(db, 'userSavedPlaylists', `${userId}_${playlistId}`);
    const snap = await getDoc(ref);
    return snap.exists();
  } catch (e) {
    console.error('檢查收藏歌單失敗:', e);
    return false;
  }
}

/**
 * 獲取用戶已收藏的站內歌單 ID 列表
 */
export async function getUserSavedPlaylistIds(userId) {
  if (!userId) return [];
  try {
    const q = query(
      collection(db, 'userSavedPlaylists'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data().playlistId);
  } catch (error) {
    console.error('獲取已收藏歌單失敗:', error);
    return [];
  }
}

const BATCH_IN_LIMIT = 30; // Firestore 'in' query max

/** Ensure playlist title is always a displayable string (avoids "NaN" from bad data). */
function safePlaylistTitle(title) {
  if (typeof title === 'string' && title.trim()) return title.trim();
  return '未命名歌單';
}

/**
 * 獲取已收藏歌單（含 savedAt，供收藏頁「最近加入」排序）
 * 使用 batch 查詢 playlists，避免 N+1：1 query + ceil(N/30) getDocs(playlists)
 */
export async function getSavedPlaylistsWithMeta(userId) {
  if (!userId) return [];
  try {
    const q = query(
      collection(db, 'userSavedPlaylists'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    const orderedIds = snapshot.docs.map((d) => d.data().playlistId);
    const savedAtMap = new Map(
      snapshot.docs.map((d) => {
        const { playlistId, savedAt } = d.data();
        return [playlistId, savedAt?.toMillis?.() ?? 0];
      })
    );
    if (orderedIds.length === 0) return [];

    const playlistById = new Map();
    for (let i = 0; i < orderedIds.length; i += BATCH_IN_LIMIT) {
      const chunk = orderedIds.slice(i, i + BATCH_IN_LIMIT);
      const batchQ = query(
        collection(db, 'playlists'),
        where(documentId(), 'in', chunk)
      );
      const batchSnap = await getDocs(batchQ);
      batchSnap.docs.forEach((d) => playlistById.set(d.id, { id: d.id, ...d.data() }));
    }

    const list = orderedIds
      .map((id) => {
        const meta = playlistById.get(id);
        if (!meta) return null;
        return { ...meta, title: safePlaylistTitle(meta.title), savedAtMs: savedAtMap.get(id) ?? 0 };
      })
      .filter(Boolean);
    return list;
  } catch (error) {
    console.error('獲取已收藏歌單（含 meta）失敗:', error);
    return [];
  }
}

// ==================== 已收藏歌手 ====================

/**
 * 將歌手加入「已收藏歌手」
 */
export async function saveArtistToLibrary(userId, artistId) {
  if (!userId || !artistId) throw new Error('參數錯誤');
  const ref = doc(db, 'userSavedArtists', `${userId}_${artistId}`);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    return { saved: true, alreadySaved: true };
  }
  await setDoc(ref, {
    userId,
    artistId,
    savedAt: serverTimestamp()
  });
  return { saved: true, alreadySaved: false };
}

/**
 * 從「已收藏歌手」移除（取消收藏）
 */
export async function removeSavedArtist(userId, artistId) {
  if (!userId || !artistId) throw new Error('參數錯誤');
  const ref = doc(db, 'userSavedArtists', `${userId}_${artistId}`);
  await deleteDoc(ref);
  return { saved: false };
}

/**
 * 檢查歌手是否已收藏
 */
export async function checkIsArtistSaved(userId, artistId) {
  if (!userId || !artistId) return false;
  try {
    const ref = doc(db, 'userSavedArtists', `${userId}_${artistId}`);
    const snap = await getDoc(ref);
    return snap.exists();
  } catch (e) {
    console.error('檢查收藏歌手失敗:', e);
    return false;
  }
}

/**
 * 獲取用戶已收藏的歌手 ID 列表
 */
export async function getUserSavedArtistIds(userId) {
  if (!userId) return [];
  try {
    const q = query(
      collection(db, 'userSavedArtists'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data().artistId);
  } catch (error) {
    console.error('獲取已收藏歌手失敗:', error);
    return [];
  }
}

/**
 * 獲取已收藏歌手（含 savedAt，供收藏頁「最近加入」排序）
 * 使用 batch 查詢 artists，避免 N+1：1 query + ceil(N/30) getDocs(artists)
 */
export async function getSavedArtistsWithMeta(userId) {
  if (!userId) return [];
  try {
    const q = query(
      collection(db, 'userSavedArtists'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    const orderedIds = snapshot.docs.map((d) => d.data().artistId);
    const savedAtMap = new Map(
      snapshot.docs.map((d) => {
        const { artistId, savedAt } = d.data();
        return [artistId, savedAt?.toMillis?.() ?? 0];
      })
    );
    if (orderedIds.length === 0) return [];

    const artistById = new Map();
    for (let i = 0; i < orderedIds.length; i += BATCH_IN_LIMIT) {
      const chunk = orderedIds.slice(i, i + BATCH_IN_LIMIT);
      const batchQ = query(
        collection(db, 'artists'),
        where(documentId(), 'in', chunk)
      );
      const batchSnap = await getDocs(batchQ);
      batchSnap.docs.forEach((d) => artistById.set(d.id, { id: d.id, ...d.data() }));
    }

    const list = orderedIds
      .map((id) => {
        const meta = artistById.get(id);
        if (!meta) return null;
        return { ...meta, savedAtMs: savedAtMap.get(id) ?? 0 };
      })
      .filter(Boolean);
    return list;
  } catch (error) {
    console.error('獲取已收藏歌手（含 meta）失敗:', error);
    return [];
  }
}

/**
 * 創建新歌單
 * @param {string} userId 
 * @param {string} title 
 * @param {string} description 
 * @returns {Promise<{playlistId: string}>}
 */
export async function createPlaylist(userId, title, description = '') {
  if (!userId || !title.trim()) throw new Error('參數錯誤');
  
  try {
    const playlistData = {
      userId,
      title: title.trim(),
      description: description.trim(),
      songIds: [],
      coverImage: null, // 如果為 null，會用前4首歌封面拼貼
      isPublic: false,
      likes: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, 'userPlaylists'), playlistData);
    return { playlistId: docRef.id, ...playlistData };
  } catch (error) {
    console.error('創建歌單失敗:', error);
    throw error;
  }
}

/**
 * 獲取用戶所有歌單
 * @param {string} userId 
 * @returns {Promise<Array>}
 */
export async function getUserPlaylists(userId) {
  if (!userId) return [];
  
  try {
    const q = query(
      collection(db, 'userPlaylists'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    
    // 按創建時間排序（最新的在前面）
    const playlists = snapshot.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, title: safePlaylistTitle(data.title) };
    }).sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    });
    
    return playlists;
  } catch (error) {
    console.error('獲取用戶歌單失敗:', error);
    return [];
  }
}

/**
 * 獲取單個歌單詳情
 * @param {string} playlistId 
 * @returns {Promise<Object|null>}
 */
export async function getPlaylist(playlistId) {
  if (!playlistId) return null;
  
  try {
    const playlistRef = doc(db, 'userPlaylists', playlistId);
    const playlistDoc = await getDoc(playlistRef);
    
    if (playlistDoc.exists()) {
      return { id: playlistDoc.id, ...playlistDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('獲取歌單詳情失敗:', error);
    return null;
  }
}

/**
 * 添加歌曲到歌單
 * @param {string} playlistId 
 * @param {string} songId 
 * @returns {Promise<{success: boolean}>}
 */
export async function addSongToPlaylist(playlistId, songId) {
  if (!playlistId || !songId) throw new Error('參數錯誤');
  
  try {
    const playlistRef = doc(db, 'userPlaylists', playlistId);
    const playlistDoc = await getDoc(playlistRef);
    
    if (!playlistDoc.exists()) {
      throw new Error('歌單不存在');
    }
    
    const currentSongs = playlistDoc.data().songIds || [];
    
    // 檢查是否已存在
    if (currentSongs.includes(songId)) {
      return { success: false, message: '歌曲已在歌單中' };
    }
    
    await updateDoc(playlistRef, {
      songIds: arrayUnion(songId),
      updatedAt: serverTimestamp()
    });
    
    return { success: true, action: 'added' };
  } catch (error) {
    console.error('添加歌曲到歌單失敗:', error);
    throw error;
  }
}

/**
 * 從歌單移除歌曲
 * @param {string} playlistId 
 * @param {string} songId 
 */
export async function removeSongFromPlaylist(playlistId, songId) {
  if (!playlistId || !songId) throw new Error('參數錯誤');
  
  try {
    const playlistRef = doc(db, 'userPlaylists', playlistId);
    await updateDoc(playlistRef, {
      songIds: arrayRemove(songId),
      updatedAt: serverTimestamp()
    });
    
    return { success: true, action: 'removed' };
  } catch (error) {
    console.error('從歌單移除歌曲失敗:', error);
    throw error;
  }
}

/**
 * 刪除歌單
 * @param {string} playlistId 
 * @param {string} userId 
 */
export async function deletePlaylist(playlistId, userId) {
  if (!playlistId || !userId) throw new Error('參數錯誤');
  
  try {
    // 驗證權限
    const playlist = await getPlaylist(playlistId);
    if (!playlist || playlist.userId !== userId) {
      throw new Error('無權限刪除此歌單');
    }
    
    await deleteDoc(doc(db, 'userPlaylists', playlistId));
    return { success: true };
  } catch (error) {
    console.error('刪除歌單失敗:', error);
    throw error;
  }
}

/**
 * 更新歌單資訊
 * @param {string} playlistId 
 * @param {Object} updates - { title, description, isPublic }
 */
export async function updatePlaylist(playlistId, updates) {
  if (!playlistId) throw new Error('參數錯誤');
  
  try {
    const playlistRef = doc(db, 'userPlaylists', playlistId);
    await updateDoc(playlistRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('更新歌單失敗:', error);
    throw error;
  }
}

/**
 * 獲取歌單封面（前4首歌的封面）
 * 使用單次 getDocs(documentId() in ids)，避免 4 次 getDoc。
 * @param {Array<string>} songIds
 * @returns {Promise<Array<string>>}
 */
export async function getPlaylistCovers(songIds) {
  if (!songIds || songIds.length === 0) return [];

  const ids = songIds.slice(0, 4);
  if (ids.length === 0) return [];

  try {
    const q = query(
      collection(db, 'tabs'),
      where(documentId(), 'in', ids)
    );
    const snapshot = await getDocs(q);
    const byId = new Map(snapshot.docs.map((d) => [d.id, d.data()]));
    return ids
      .map((id) => byId.get(id)?.thumbnail)
      .filter(Boolean);
  } catch (error) {
    console.error('獲取歌單封面失敗:', error);
    return [];
  }
}

// 瀏覽記錄功能
import { doc, updateDoc, arrayUnion, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const MAX_RECENT_ITEMS = 20;

// 添加瀏覽記錄
export async function addRecentView(userId, item) {
  if (!userId) return;

  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    const viewItem = {
      ...item,
      timestamp: new Date().toISOString()
    };

    if (userDoc.exists()) {
      const currentData = userDoc.data();
      const recentViews = currentData.recentViews || [];
      
      // 移除同類型同 ID 嘅舊記錄（避免重複）
      const filtered = recentViews.filter(
        v => !(v.type === item.type && v.itemId === item.itemId)
      );
      
      // 添加新記錄到最前面
      const updated = [viewItem, ...filtered].slice(0, MAX_RECENT_ITEMS);
      
      await updateDoc(userRef, {
        recentViews: updated
      });
    } else {
      // 創建新用戶文檔
      await setDoc(userRef, {
        recentViews: [viewItem]
      });
    }
  } catch (error) {
    console.error('Error adding recent view:', error);
  }
}

// 記錄歌曲瀏覽
export async function recordSongView(userId, song) {
  await addRecentView(userId, {
    type: 'song',
    itemId: song.id,
    title: song.title,
    subtitle: song.artist,
    thumbnail: song.thumbnail || null
  });
}

// 記錄歌手瀏覽
export async function recordArtistView(userId, artist) {
  await addRecentView(userId, {
    type: 'artist',
    itemId: artist.id || artist.normalizedName || artist.slug,
    title: artist.name,
    subtitle: '歌手',
    thumbnail: artist.photoURL || artist.wikiPhotoURL || artist.photo || null
  });
}

// 記錄歌單瀏覽
export async function recordPlaylistView(userId, playlist) {
  await addRecentView(userId, {
    type: 'playlist',
    itemId: playlist.id,
    title: playlist.title,
    subtitle: '歌單',
    thumbnail: playlist.coverImage || null
  });
}

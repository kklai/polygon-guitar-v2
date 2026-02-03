import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  orderBy, 
  where,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  setDoc
} from 'firebase/firestore'
import { db } from './firebase'

const TABS_COLLECTION = 'tabs'
const ARTISTS_COLLECTION = 'artists'

// Get all tabs
export async function getAllTabs() {
  const q = query(collection(db, TABS_COLLECTION), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

// Get tabs by artist
export async function getTabsByArtist(artistName) {
  // 使用 artistId 进行查询，避免大小写问题
  const artistId = artistName.toLowerCase().replace(/\s+/g, '-')
  const q = query(
    collection(db, TABS_COLLECTION), 
    where('artistId', '==', artistId),
    orderBy('createdAt', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

// Get single tab
export async function getTab(id) {
  const docRef = doc(db, TABS_COLLECTION, id)
  const docSnap = await getDoc(docRef)
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() }
  }
  return null
}

// Increment view count
export async function incrementViewCount(id) {
  try {
    const tabRef = doc(db, TABS_COLLECTION, id)
    await updateDoc(tabRef, {
      viewCount: increment(1)
    })
  } catch (error) {
    console.error('Error incrementing view count:', error)
  }
}

// Get or create artist
async function getOrCreateArtist(artistName, artistData = {}) {
  if (!artistName) return null
  
  const artistId = artistName.toLowerCase().replace(/\s+/g, '-')
  const artistRef = doc(db, ARTISTS_COLLECTION, artistId)
  const artistSnap = await getDoc(artistRef)
  
  if (!artistSnap.exists()) {
    await setDoc(artistRef, {
      name: artistName,
      normalizedName: artistId,
      tabCount: 0,
      photo: artistData.photo || null,
      heroPhoto: artistData.heroPhoto || null,
      bio: artistData.bio || '',
      year: artistData.year || '',
      artistType: artistData.artistType || '',
      createdAt: new Date().toISOString()
    })
  } else if (artistData.photo || artistData.heroPhoto || artistData.bio || artistData.year || artistData.artistType) {
    // 更新現有歌手的資料（如果有新資料）
    const existingData = artistSnap.data()
    const updates = {}
    if (artistData.photo && !existingData.photo) updates.photo = artistData.photo
    if (artistData.heroPhoto) updates.heroPhoto = artistData.heroPhoto
    if (artistData.bio && !existingData.bio) updates.bio = artistData.bio
    if (artistData.year && !existingData.year) updates.year = artistData.year
    if (artistData.artistType && !existingData.artistType) updates.artistType = artistData.artistType
    
    if (Object.keys(updates).length > 0) {
      await updateDoc(artistRef, updates)
    }
  }
  
  return artistId
}

// Create tab
export async function createTab(tabData, userId) {
  // Create or get artist with photo/bio/year
  const artistData = {
    photo: tabData.artistPhoto || null,
    bio: tabData.artistBio || '',
    year: tabData.artistYear || ''
  }
  const artistId = await getOrCreateArtist(tabData.artist, artistData)
  
  const newTab = {
    ...tabData,
    originalKey: tabData.originalKey || 'C',
    artistType: tabData.artistType || '',
    artistId,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    likes: 0,
    likedBy: [],
    viewCount: 0
  }
  
  const docRef = await addDoc(collection(db, TABS_COLLECTION), newTab)
  
  // Increment artist tab count
  if (artistId) {
    const artistRef = doc(db, ARTISTS_COLLECTION, artistId)
    await updateDoc(artistRef, {
      tabCount: increment(1)
    })
  }
  
  return { id: docRef.id, ...newTab }
}

// Update tab
export async function updateTab(id, tabData, userId) {
  const tabRef = doc(db, TABS_COLLECTION, id)
  const tabSnap = await getDoc(tabRef)
  
  if (!tabSnap.exists()) {
    throw new Error('Tab not found')
  }
  
  const currentTab = tabSnap.data()
  
  // Check if user is the owner
  if (currentTab.createdBy !== userId) {
    throw new Error('Unauthorized: You can only edit your own tabs')
  }
  
  // Handle artist change
  const oldArtistId = currentTab.artistId
  const newArtistId = tabData.artist ? tabData.artist.toLowerCase().replace(/\s+/g, '-') : oldArtistId
  
  if (oldArtistId !== newArtistId && tabData.artist) {
    // Decrement old artist count
    if (oldArtistId) {
      const oldArtistRef = doc(db, ARTISTS_COLLECTION, oldArtistId)
      await updateDoc(oldArtistRef, {
        tabCount: increment(-1)
      })
    }
    
    // Create/get new artist with photo/bio/year and increment count
    const artistData = {
      photo: tabData.artistPhoto || null,
      bio: tabData.artistBio || '',
      year: tabData.artistYear || ''
    }
    await getOrCreateArtist(tabData.artist, artistData)
    const newArtistRef = doc(db, ARTISTS_COLLECTION, newArtistId)
    await updateDoc(newArtistRef, {
      tabCount: increment(1)
    })
  } else if (oldArtistId === newArtistId && (tabData.artistPhoto || tabData.artistBio || tabData.artistYear)) {
    // 同一歌手但更新了資料
    const artistData = {
      photo: tabData.artistPhoto || null,
      bio: tabData.artistBio || '',
      year: tabData.artistYear || ''
    }
    await getOrCreateArtist(tabData.artist, artistData)
  }
  
  const updatedData = {
    ...tabData,
    artistId: newArtistId,
    updatedAt: new Date().toISOString()
  }
  
  await updateDoc(tabRef, updatedData)
  return { id, ...currentTab, ...updatedData }
}

// Delete tab
export async function deleteTab(id, userId) {
  const tabRef = doc(db, TABS_COLLECTION, id)
  const tabSnap = await getDoc(tabRef)
  
  if (!tabSnap.exists()) {
    throw new Error('Tab not found')
  }
  
  const tab = tabSnap.data()
  
  // Check if user is the owner
  if (tab.createdBy !== userId) {
    throw new Error('Unauthorized: You can only delete your own tabs')
  }
  
  // Decrement artist tab count
  if (tab.artistId) {
    const artistRef = doc(db, ARTISTS_COLLECTION, tab.artistId)
    await updateDoc(artistRef, {
      tabCount: increment(-1)
    })
  }
  
  await deleteDoc(tabRef)
  return true
}

// Toggle like
export async function toggleLike(tabId, userId) {
  const tabRef = doc(db, TABS_COLLECTION, tabId)
  const tabSnap = await getDoc(tabRef)
  
  if (!tabSnap.exists()) {
    throw new Error('Tab not found')
  }
  
  const tab = tabSnap.data()
  const likedBy = tab.likedBy || []
  const hasLiked = likedBy.includes(userId)
  
  if (hasLiked) {
    // Unlike
    await updateDoc(tabRef, {
      likes: increment(-1),
      likedBy: arrayRemove(userId)
    })
    return { liked: false, likes: (tab.likes || 1) - 1 }
  } else {
    // Like
    await updateDoc(tabRef, {
      likes: increment(1),
      likedBy: arrayUnion(userId)
    })
    return { liked: true, likes: (tab.likes || 0) + 1 }
  }
}

// Check if user liked tab
export function hasUserLiked(tab, userId) {
  if (!tab || !userId) return false
  return (tab.likedBy || []).includes(userId)
}

// Get all artists
export async function getAllArtists() {
  const q = query(collection(db, ARTISTS_COLLECTION), orderBy('name'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => {
    const data = doc.data()
    // 優先級：photoURL (用戶上傳) > wikiPhotoURL (維基百科) > photo (舊資料兼容)
    const displayPhoto = data.photoURL || data.wikiPhotoURL || data.photo || null
    return {
      id: doc.id,
      ...data,
      photo: displayPhoto,
      photoURL: data.photoURL || null,
      wikiPhotoURL: data.wikiPhotoURL || null
    }
  })
}

// Get artist by slug (normalizedName)
export async function getArtistBySlug(slug) {
  const q = query(
    collection(db, ARTISTS_COLLECTION),
    where('normalizedName', '==', slug)
  )
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  const data = doc.data()
  // 優先級：photoURL (用戶上傳 Cloudinary) > wikiPhotoURL (維基百科備份) > photo (舊資料兼容)
  const displayPhoto = data.photoURL || data.wikiPhotoURL || data.photo || null
  return {
    id: doc.id,
    ...data,
    photo: displayPhoto,
    photoURL: data.photoURL || null,
    wikiPhotoURL: data.wikiPhotoURL || null,
    heroPhoto: data.heroPhoto || null
  }
}

// Get top 5 songs by view count for an artist
export async function getTopSongsByArtist(artistName, normalizedName, limitCount = 5) {
  // 嘗試多種 artistId 格式
  const possibleIds = [
    normalizedName,  // 優先使用 normalizedName (e.g., "jc")
    artistName.toLowerCase().replace(/\s+/g, '-'),  // 標準格式 (e.g., "陳詠桐-jc")
    artistName,  // 原始名
  ].filter(Boolean)
  
  let songs = []
  
  // 嘗試每個可能的 ID
  for (const id of possibleIds) {
    if (songs.length > 0) break
    try {
      const q = query(
        collection(db, TABS_COLLECTION),
        where('artistId', '==', id)
      )
      const snapshot = await getDocs(q)
      songs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (e) {
      console.log('Query by artistId failed:', id, e)
    }
  }
  
  // 方法 2: 如果沒有結果，嘗試用 artist 欄位查詢（舊數據兼容）
  if (songs.length === 0) {
    try {
      const q = query(
        collection(db, TABS_COLLECTION),
        where('artist', '==', artistName)
      )
      const snapshot = await getDocs(q)
      songs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (e) {
      console.log('Query by artist name failed:', e)
    }
  }
  
  // 客戶端排序
  return songs
    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    .slice(0, limitCount)
}

// Get all songs by artist ordered by upload year
export async function getAllSongsByArtistGrouped(artistName, normalizedName) {
  // 嘗試多種 artistId 格式
  const possibleIds = [
    normalizedName,  // 優先使用 normalizedName
    artistName.toLowerCase().replace(/\s+/g, '-'),
    artistName,
  ].filter(Boolean)
  
  // 嘗試多種查詢方式
  let songs = []
  
  // 方法 1: 嘗試每個可能的 ID
  for (const id of possibleIds) {
    if (songs.length > 0) break
    try {
      const q = query(
        collection(db, TABS_COLLECTION),
        where('artistId', '==', id)
      )
      const snapshot = await getDocs(q)
      songs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (e) {
      console.log('Query by artistId failed:', id, e)
    }
  }
  
  // 方法 2: 如果沒有結果，嘗試用 artist 欄位查詢
  if (songs.length === 0) {
    try {
      const q = query(
        collection(db, TABS_COLLECTION),
        where('artist', '==', artistName)
      )
      const snapshot = await getDocs(q)
      songs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (e) {
      console.log('Query by artist name failed:', e)
    }
  }
  
  // 客戶端排序
  return songs.sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0)
    const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0)
    return dateB - dateA
  })
}

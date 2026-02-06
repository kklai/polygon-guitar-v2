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

// Get migrated tabs (source: 'blogger')
export async function getMigratedTabs() {
  const q = query(
    collection(db, TABS_COLLECTION),
    where('source', '==', 'blogger'),
    orderBy('createdAt', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

// Check tab for issues
export function checkTabIssues(tab) {
  const issues = []
  if (!tab.artistId) issues.push('缺少 artistId')
  if (!tab.artist) issues.push('缺少歌手名')
  if (!tab.content || tab.content.length < 10) issues.push('內容過短或缺失')
  if (!tab.title) issues.push('缺少歌名')
  return issues
}

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
export async function getTabsByArtist(artistName, artistIdParam = null) {
  // 生成可能的 artistId 變體
  const artistIdFromName = artistName.toLowerCase().replace(/\s+/g, '-')
  // 如果提供了歌手ID（如"me"），優先使用
  const artistId = artistIdParam || artistIdFromName
  
  // 嘗試多種查詢方式（兼容改名後的情況）
  let allTabs = []
  const seenIds = new Set()
  
  // 方法1: 用歌手ID查詢（最高優先級）
  try {
    const q1 = query(
      collection(db, TABS_COLLECTION), 
      where('artistId', '==', artistId)
    )
    const snapshot1 = await getDocs(q1)
    snapshot1.docs.forEach(doc => {
      if (!seenIds.has(doc.id)) {
        seenIds.add(doc.id)
        allTabs.push({ id: doc.id, ...doc.data() })
      }
    })
  } catch (e) { console.log('Query by artistId failed:', e) }
  
  // 方法2: 用 artistIdFromName 查詢（如果不同於artistId）
  if (artistIdFromName !== artistId) {
    try {
      const q1b = query(
        collection(db, TABS_COLLECTION), 
        where('artistId', '==', artistIdFromName)
      )
      const snapshot1b = await getDocs(q1b)
      snapshot1b.docs.forEach(doc => {
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id)
          allTabs.push({ id: doc.id, ...doc.data() })
        }
      })
    } catch (e) { console.log('Query by artistIdFromName failed:', e) }
  }
  
  // 方法3: 用 artist 名稱查詢（舊數據兼容）
  try {
    const q2 = query(
      collection(db, TABS_COLLECTION),
      where('artist', '==', artistName)
    )
    const snapshot2 = await getDocs(q2)
    snapshot2.docs.forEach(doc => {
      if (!seenIds.has(doc.id)) {
        seenIds.add(doc.id)
        allTabs.push({ id: doc.id, ...doc.data() })
      }
    })
  } catch (e) { console.log('Query by artist name failed:', e) }
  
  // 方法4: 如果歌手名係雙語（如"陳柏宇 Jason Chan"），嘗試用中文名查詢
  const chineseMatch = artistName.match(/^([\u4e00-\u9fa5]{2,})/)
  if (chineseMatch && chineseMatch[1] !== artistName) {
    const chineseName = chineseMatch[1]
    const chineseId = chineseName.toLowerCase().replace(/\s+/g, '-')
    
    try {
      const q3 = query(
        collection(db, TABS_COLLECTION),
        where('artistId', '==', chineseId)
      )
      const snapshot3 = await getDocs(q3)
      snapshot3.docs.forEach(doc => {
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id)
          allTabs.push({ id: doc.id, ...doc.data() })
        }
      })
    } catch (e) { console.log('Query by chinese name failed:', e) }
  }
  
  // 按創建時間排序
  return allTabs.sort((a, b) => {
    const dateA = a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(a.createdAt || 0)
    const dateB = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.createdAt || 0)
    return dateB - dateA
  })
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
export async function updateTab(id, tabData, userId, isAdmin = false) {
  const tabRef = doc(db, TABS_COLLECTION, id)
  const tabSnap = await getDoc(tabRef)
  
  if (!tabSnap.exists()) {
    throw new Error('Tab not found')
  }
  
  const currentTab = tabSnap.data()
  
  // Check if user is the owner or admin
  if (currentTab.createdBy !== userId && !isAdmin) {
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
export async function deleteTab(id, userId, isAdmin = false) {
  const tabRef = doc(db, TABS_COLLECTION, id)
  const tabSnap = await getDoc(tabRef)
  
  if (!tabSnap.exists()) {
    throw new Error('Tab not found')
  }
  
  const tab = tabSnap.data()
  
  // Check if user is the owner or admin
  if (tab.createdBy !== userId && !isAdmin) {
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
    artistName.toLowerCase().replace(/\s+/g, '-'),  // 標準格式
    artistName,  // 原始名
  ].filter(Boolean)
  
  // 添加中文名 ID（如果是雙語名）
  const chineseMatch = artistName.match(/^([\u4e00-\u9fa5]{2,})/)
  if (chineseMatch) {
    possibleIds.push(chineseMatch[1].toLowerCase().replace(/\s+/g, '-'))
  }
  
  let songs = []
  const seenIds = new Set()
  
  // 方法 1: 嘗試每個可能的 ID
  for (const id of [...new Set(possibleIds)]) {
    try {
      const q = query(
        collection(db, TABS_COLLECTION),
        where('artistId', '==', id)
      )
      const snapshot = await getDocs(q)
      snapshot.docs.forEach(doc => {
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id)
          songs.push({ id: doc.id, ...doc.data() })
        }
      })
    } catch (e) {
      console.log('Query by artistId failed:', id, e)
    }
  }
  
  // 方法 2: 用 artist 欄位查詢（舊數據兼容）
  try {
    const q = query(
      collection(db, TABS_COLLECTION),
      where('artist', '==', artistName)
    )
    const snapshot = await getDocs(q)
    snapshot.docs.forEach(doc => {
      if (!seenIds.has(doc.id)) {
        seenIds.add(doc.id)
        songs.push({ id: doc.id, ...doc.data() })
      }
    })
  } catch (e) {
    console.log('Query by artist name failed:', e)
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
  
  // 添加中文名 ID（如果是雙語名）
  const chineseMatch = artistName.match(/^([\u4e00-\u9fa5]{2,})/)
  if (chineseMatch) {
    possibleIds.push(chineseMatch[1].toLowerCase().replace(/\s+/g, '-'))
  }
  
  // 嘗試多種查詢方式，合併結果
  let songs = []
  const seenIds = new Set()
  
  // 方法 1: 嘗試每個可能的 ID
  for (const id of [...new Set(possibleIds)]) {
    try {
      const q = query(
        collection(db, TABS_COLLECTION),
        where('artistId', '==', id)
      )
      const snapshot = await getDocs(q)
      snapshot.docs.forEach(doc => {
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id)
          songs.push({ id: doc.id, ...doc.data() })
        }
      })
    } catch (e) {
      console.log('Query by artistId failed:', id, e)
    }
  }
  
  // 方法 2: 用 artist 欄位查詢
  try {
    const q = query(
      collection(db, TABS_COLLECTION),
      where('artist', '==', artistName)
    )
    const snapshot = await getDocs(q)
    snapshot.docs.forEach(doc => {
      if (!seenIds.has(doc.id)) {
        seenIds.add(doc.id)
        songs.push({ id: doc.id, ...doc.data() })
      }
    })
  } catch (e) {
    console.log('Query by artist name failed:', e)
  }
  
  // 客戶端排序
  return songs.sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0)
    const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0)
    return dateB - dateA
  })
}

// ==================== 系統設定 (Settings) ====================

const SETTINGS_COLLECTION = 'settings'
const GLOBAL_SETTINGS_DOC = 'global'

// 取得系統設定
export async function getGlobalSettings() {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, GLOBAL_SETTINGS_DOC)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      }
    }
    
    // 如果沒有設定，返回預設值
    return {
      id: GLOBAL_SETTINGS_DOC,
      logoUrl: null,
      siteName: 'Polygon 結他譜',
      updatedAt: null,
      updatedBy: null
    }
  } catch (error) {
    console.error('Error getting global settings:', error)
    return {
      id: GLOBAL_SETTINGS_DOC,
      logoUrl: null,
      siteName: 'Polygon 結他譜',
      updatedAt: null,
      updatedBy: null
    }
  }
}

// 更新系統設定（Logo）
export async function updateGlobalSettings(settings, userId) {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, GLOBAL_SETTINGS_DOC)
    const updateData = {
      ...settings,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    }
    
    await setDoc(docRef, updateData, { merge: true })
    return { success: true }
  } catch (error) {
    console.error('Error updating global settings:', error)
    throw error
  }
}

// 上傳 Logo 並更新設定
export async function uploadLogoAndUpdateSettings(cloudinaryUrl, userId) {
  try {
    // 更新系統設定
    await updateGlobalSettings({
      logoUrl: cloudinaryUrl
    }, userId)
    
    return { 
      success: true, 
      logoUrl: cloudinaryUrl 
    }
  } catch (error) {
    console.error('Error uploading logo:', error)
    throw error
  }
}

// 獲取分類封面圖片設定
export async function getCategoryImages() {
  try {
    const docRef = doc(db, 'settings', 'categoryImages')
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      return docSnap.data()
    }
    
    return null
  } catch (error) {
    console.error('Error getting category images:', error)
    return null
  }
}

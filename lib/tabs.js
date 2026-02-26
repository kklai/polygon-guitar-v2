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
  limit,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  setDoc
} from 'firebase/firestore'
import { db } from './firebase'

const TABS_COLLECTION = 'tabs'
const ARTISTS_COLLECTION = 'artists'

// ==================== 多歌手處理工具 ====================

// 解析多歌手字符串
// 支持格式："歌手A，歌手B"、"歌手A/歌手B"、"歌手A & 歌手B"、"歌手A feat. 歌手B"
export function parseCollaborators(artistString) {
  if (!artistString || typeof artistString !== 'string') {
    return {
      primaryArtist: '',
      collaborators: [],
      collaborationType: null
    }
  }
  
  const trimmed = artistString.trim()
  
  // 檢查是否包含多個歌手分隔符（支援全型同半型）
  const separators = ['，', ',', '/', '&', '、', '｜', '|', '／', '＆']
  const featPatterns = [/\s+feat\.?\s*/i, /\s+ft\.?\s*/i, /\s+featuring\s+/i, /\s+with\s+/i]
  
  let collaborators = []
  let collaborationType = null
  let primaryArtist = trimmed
  
  // 先檢查 feat. 模式（優先）- 按 pattern 長度排序，避免 'feat' 匹配 'featuring'
  const sortedPatterns = [...featPatterns].sort((a, b) => b.source.length - a.source.length)
  for (const pattern of sortedPatterns) {
    if (pattern.test(trimmed)) {
      const parts = trimmed.split(pattern).map(p => p.trim()).filter(Boolean)
      if (parts.length >= 2) {
        primaryArtist = parts[0]
        collaborators = parts
        collaborationType = 'feat'
        break
      }
    }
  }
  
  // 如果沒有 feat 模式，檢查其他分隔符
  if (collaborators.length === 0) {
    for (const sep of separators) {
      if (trimmed.includes(sep)) {
        const parts = trimmed.split(sep).map(p => p.trim()).filter(Boolean)
        if (parts.length >= 2) {
          primaryArtist = parts[0]
          collaborators = parts
          collaborationType = '合唱'
          break
        }
      }
    }
  }
  
  // 如果只有一個歌手，collaborators 只包含主歌手
  if (collaborators.length === 0) {
    collaborators = [trimmed]
  }
  
  return {
    primaryArtist,
    collaborators: [...new Set(collaborators)], // 去重
    collaborationType,
    displayName: trimmed // 原始顯示名
  }
}

// 生成歌手的 normalized ID
export function normalizeArtistId(artistName) {
  if (!artistName) return ''
  return artistName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-\u4e00-\u9fa5]/g, '')
}

// 簡單內存緩存（5分鐘過期）
const cache = new Map()
const CACHE_DURATION = 5 * 60 * 1000 // 5分鐘

function getCached(key) {
  const item = cache.get(key)
  if (!item) return null
  if (Date.now() - item.timestamp > CACHE_DURATION) {
    cache.delete(key)
    return null
  }
  return item.data
}

function setCached(key, data) {
  cache.set(key, { data, timestamp: Date.now() })
}

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

// Get recent tabs (for homepage - limited count)
export async function getRecentTabs(count = 20) {
  const cacheKey = `recentTabs_${count}`
  const cached = getCached(cacheKey)
  if (cached) return cached
  
  const q = query(
    collection(db, TABS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(count)
  )
  const snapshot = await getDocs(q)
  const result = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
  setCached(cacheKey, result)
  return result
}

// Get tabs by IDs (for manual selection - fetches specific tabs regardless of views)
export async function getTabsByIds(ids = []) {
  if (!ids.length) return []
  
  // 過濾掉無效 ID
  const validIds = ids.filter(id => typeof id === 'string' && id.trim() !== '')
  if (!validIds.length) return []
  
  // Firestore 'in' query 最多支持 10 個 ID，需要分批
  const batchSize = 10
  const results = []
  
  for (let i = 0; i < validIds.length; i += batchSize) {
    const batch = validIds.slice(i, i + batchSize)
    const q = query(
      collection(db, TABS_COLLECTION),
      where('__name__', 'in', batch)
    )
    const snapshot = await getDocs(q)
    results.push(...snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })))
  }
  
  // 按照傳入的 ID 順序排序
  const orderMap = new Map(validIds.map((id, index) => [id, index]))
  return results.sort((a, b) => orderMap.get(a.id) - orderMap.get(b.id))
}

// Search tabs by title or artist (for admin selection - no view count restrictions)
export async function searchTabs(searchTerm, count = 20) {
  if (!searchTerm || searchTerm.trim().length < 2) return []
  
  const term = searchTerm.toLowerCase().trim()
  
  // 使用範圍查詢進行標題搜索（前綴匹配）
  const titleQuery = query(
    collection(db, TABS_COLLECTION),
    orderBy('title'),
    where('title', '>=', term),
    where('title', '<=', term + '\uf8ff'),
    limit(count)
  )
  
  const artistQuery = query(
    collection(db, TABS_COLLECTION),
    orderBy('artistName'),
    where('artistName', '>=', term),
    where('artistName', '<=', term + '\uf8ff'),
    limit(count)
  )
  
  const [titleSnapshot, artistSnapshot] = await Promise.all([
    getDocs(titleQuery),
    getDocs(artistQuery)
  ])
  
  const results = new Map()
  
  titleSnapshot.docs.forEach(doc => {
    results.set(doc.id, { id: doc.id, ...doc.data() })
  })
  
  artistSnapshot.docs.forEach(doc => {
    results.set(doc.id, { id: doc.id, ...doc.data() })
  })
  
  return Array.from(results.values()).slice(0, count)
}

// Get hot tabs (by view count - limited count)
export async function getHotTabs(count = 12) {
  const cacheKey = `hotTabs_${count}`
  const cached = getCached(cacheKey)
  if (cached) return cached
  
  const q = query(
    collection(db, TABS_COLLECTION),
    orderBy('viewCount', 'desc'),
    limit(count)
  )
  const snapshot = await getDocs(q)
  const result = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
  setCached(cacheKey, result)
  return result
}

// Get tabs by artist
export async function getTabsByArtist(artistName, artistIdParam = null) {
  // 生成可能的 artistId 變體
  const artistIdFromName = artistName.toLowerCase().replace(/\s+/g, '-')
  const artistId = artistIdParam || artistIdFromName
  
  // 生成純英文/數字 ID（去掉中文）- 用於匹配 "Gareth.T" 而不是 "gareth.t-湯令山"
  const asciiOnlyId = artistName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')
  
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
  
  // 方法1b: 用 collaboratorIds 數組查詢（多歌手支持）- 原始 ID
  try {
    const q1b = query(
      collection(db, TABS_COLLECTION), 
      where('collaboratorIds', 'array-contains', artistId)
    )
    const snapshot1b = await getDocs(q1b)
    snapshot1b.docs.forEach(doc => {
      if (!seenIds.has(doc.id)) {
        seenIds.add(doc.id)
        allTabs.push({ id: doc.id, ...doc.data() })
      }
    })
  } catch (e) { console.log('Query by collaboratorIds failed:', e) }
  
  // 方法1c: 用 collaboratorIds 查詢 - ASCII only ID（處理 "Gareth.T" vs "gareth.t-湯令山"）
  if (asciiOnlyId && asciiOnlyId !== artistId) {
    try {
      const q1c = query(
        collection(db, TABS_COLLECTION), 
        where('collaboratorIds', 'array-contains', asciiOnlyId)
      )
      const snapshot1c = await getDocs(q1c)
      snapshot1c.docs.forEach(doc => {
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id)
          allTabs.push({ id: doc.id, ...doc.data() })
        }
      })
    } catch (e) { console.log('Query by asciiOnlyId failed:', e) }
  }
  
  // 方法2: 用 artistIdFromName 查詢（如果不同於artistId）
  if (artistIdFromName !== artistId) {
    try {
      const q2 = query(
        collection(db, TABS_COLLECTION), 
        where('artistId', '==', artistIdFromName)
      )
      const snapshot2 = await getDocs(q2)
      snapshot2.docs.forEach(doc => {
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
      birthYear: artistData.birthYear || '',
      debutYear: artistData.debutYear || '',
      artistType: artistData.artistType || '',
      createdAt: new Date().toISOString()
    })
  } else if (artistData.photo || artistData.heroPhoto || artistData.bio || artistData.year || artistData.birthYear || artistData.debutYear || artistData.artistType) {
    // 更新現有歌手的資料（如果有新資料）
    const existingData = artistSnap.data()
    const updates = {}
    if (artistData.photo && !existingData.photo) updates.photo = artistData.photo
    if (artistData.heroPhoto) updates.heroPhoto = artistData.heroPhoto
    if (artistData.bio && !existingData.bio) updates.bio = artistData.bio
    if (artistData.year && !existingData.year) updates.year = artistData.year
    if (artistData.birthYear && !existingData.birthYear) updates.birthYear = artistData.birthYear
    if (artistData.debutYear && !existingData.debutYear) updates.debutYear = artistData.debutYear
    if (artistData.artistType && !existingData.artistType) updates.artistType = artistData.artistType
    
    if (Object.keys(updates).length > 0) {
      await updateDoc(artistRef, updates)
    }
  }
  
  return artistId
}

// Create tab
export async function createTab(tabData, userId) {
  // 解析多歌手
  const { primaryArtist, collaborators, collaborationType, displayName } = parseCollaborators(tabData.artist)
  
  // 歌手資料模板
  const artistData = {
    photo: tabData.artistPhoto || null,
    bio: tabData.artistBio || '',
    year: tabData.artistYear || '',
    birthYear: tabData.artistBirthYear || '',
    debutYear: tabData.artistDebutYear || '',
    artistType: tabData.artistType || ''
  }
  
  // 為所有合作歌手創建記錄（如果不存在）
  const collaboratorIds = []
  for (const collabName of collaborators) {
    const collabId = await getOrCreateArtist(collabName, artistData)
    if (collabId) {
      collaboratorIds.push(collabId)
    }
  }
  
  // 主歌手 ID（第一個合作歌手）
  const artistId = collaboratorIds[0] || null
  
  const newTab = {
    ...tabData,
    originalKey: tabData.originalKey || 'C',
    artistType: tabData.artistType || '',
    artistId,
    // 多歌手支持
    collaborators,
    collaboratorIds,
    collaborationType,
    isCollaboration: collaborators.length > 1,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    likes: 0,
    likedBy: [],
    viewCount: 0,
    // 儲存上傳者筆名（如果有）
    uploaderPenName: tabData.uploaderPenName || ''
  }
  
  const docRef = await addDoc(collection(db, TABS_COLLECTION), newTab)
  
  // Increment all collaborator artist tab counts
  for (const collabId of collaboratorIds) {
    const artistRef = doc(db, ARTISTS_COLLECTION, collabId)
    const artistSnap = await getDoc(artistRef)
    if (artistSnap.exists()) {
      await updateDoc(artistRef, {
        tabCount: increment(1)
      })
    }
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
  
  // 權限檢查：
  const isOwner = currentTab.createdBy === userId
  const isOldTab = !currentTab.createdBy
  
  if (isOldTab && !isAdmin) {
    throw new Error('Unauthorized: Only admin can edit old migrated tabs')
  }
  
  if (!isOldTab && !isOwner && !isAdmin) {
    throw new Error('Unauthorized: You can only edit your own tabs')
  }
  
  // 解析新歌手
  const { primaryArtist, collaborators, collaborationType } = parseCollaborators(tabData.artist)
  const newArtistId = normalizeArtistId(primaryArtist)
  const newCollaboratorIds = collaborators.map(name => normalizeArtistId(name)).filter(Boolean)
  
  // 獲取舊的合作歌手 ID
  const oldCollaboratorIds = currentTab.collaboratorIds || 
    (currentTab.artistId ? [currentTab.artistId] : [])
  
  // 計算需要增減的歌手
  const addedArtists = newCollaboratorIds.filter(id => !oldCollaboratorIds.includes(id))
  const removedArtists = oldCollaboratorIds.filter(id => !newCollaboratorIds.includes(id))
  
  // Decrement removed artists
  for (const artistId of removedArtists) {
    const artistRef = doc(db, ARTISTS_COLLECTION, artistId)
    const artistSnap = await getDoc(artistRef)
    if (artistSnap.exists()) {
      await updateDoc(artistRef, {
        tabCount: increment(-1)
      })
    }
  }
  
  // Create/get new artists and increment count
  if (addedArtists.length > 0) {
    const artistData = {
      photo: tabData.artistPhoto || null,
      bio: tabData.artistBio || '',
      year: tabData.artistYear || '',
      artistType: tabData.artistType || ''
    }
    
    for (const collabName of collaborators) {
      const collabId = normalizeArtistId(collabName)
      if (addedArtists.includes(collabId)) {
        await getOrCreateArtist(collabName, artistData)
        const artistRef = doc(db, ARTISTS_COLLECTION, collabId)
        const artistSnap = await getDoc(artistRef)
        if (artistSnap.exists()) {
          await updateDoc(artistRef, {
            tabCount: increment(1)
          })
        }
      }
    }
  }
  
  const updatedData = {
    ...tabData,
    artistId: newArtistId,
    collaborators,
    collaboratorIds: newCollaboratorIds,
    collaborationType,
    isCollaboration: collaborators.length > 1,
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
  
  // 權限檢查：
  const isOwner = tab.createdBy === userId
  const isOldTab = !tab.createdBy
  
  if (isOldTab && !isAdmin) {
    throw new Error('Unauthorized: Only admin can delete old migrated tabs')
  }
  
  if (!isOldTab && !isOwner && !isAdmin) {
    throw new Error('Unauthorized: You can only delete your own tabs')
  }
  
  // Decrement all collaborator artist tab counts
  const collaboratorIds = tab.collaboratorIds || (tab.artistId ? [tab.artistId] : [])
  
  for (const artistId of collaboratorIds) {
    if (artistId) {
      const artistRef = doc(db, ARTISTS_COLLECTION, artistId)
      const artistSnap = await getDoc(artistRef)
      if (artistSnap.exists()) {
        await updateDoc(artistRef, {
          tabCount: increment(-1)
        })
      }
    }
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
  // 1. 獲取所有歌手
  const q = query(collection(db, ARTISTS_COLLECTION), orderBy('name'))
  const snapshot = await getDocs(q)
  const artists = snapshot.docs.map(doc => {
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
  
  // 2. 獲取所有 tabs 並統計每個歌手的譜數量
  const tabsSnapshot = await getDocs(collection(db, TABS_COLLECTION))
  const artistTabCounts = {}
  
  tabsSnapshot.docs.forEach(doc => {
    const tab = doc.data()
    if (tab.artistId) {
      artistTabCounts[tab.artistId] = (artistTabCounts[tab.artistId] || 0) + 1
    }
    // 同時統計 artist 名稱（兼容舊數據）
    if (tab.artist) {
      const artistIdFromName = tab.artist.toLowerCase().replace(/\s+/g, '-')
      if (!artistTabCounts[artistIdFromName]) {
        artistTabCounts[artistIdFromName] = 0
      }
      artistTabCounts[artistIdFromName]++
    }
  })
  
  // 3. 將統計結果合併到歌手數據
  return artists.map(artist => {
    // 計算可能的 artistId 變體
    const possibleIds = [
      artist.id,
      artist.normalizedName,
      artist.name?.toLowerCase().replace(/\s+/g, '-')
    ].filter(Boolean)
    
    // 獲取實際譜數量（取最大值，避免重複計算）
    let actualCount = 0
    const countedTabs = new Set()
    
    possibleIds.forEach(id => {
      if (artistTabCounts[id]) {
        actualCount = Math.max(actualCount, artistTabCounts[id])
      }
    })
    
    // 如果實際統計有數據，用之；否則用數據庫的欄位
    const finalCount = actualCount > 0 ? actualCount : (artist.songCount || artist.tabCount || 0)

    return {
      ...artist,
      songCount: finalCount,
      tabCount: finalCount
    }
  })
}

// Get popular artists (for homepage - with tab counts)
export async function getPopularArtists(count = 30) {
  const cacheKey = `popularArtists_${count}`
  const cached = getCached(cacheKey)
  if (cached) return cached
  
  const q = query(
    collection(db, ARTISTS_COLLECTION),
    orderBy('viewCount', 'desc'),
    limit(count)
  )
  const snapshot = await getDocs(q)
  const result = snapshot.docs.map(doc => {
    const data = doc.data()
    return {
      id: doc.id,
      ...data,
      photo: data.photoURL || data.wikiPhotoURL || data.photo || null,
      tabCount: data.songCount || data.tabCount || 0
    }
  })
  setCached(cacheKey, result)
  return result
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


// 處理合唱歌曲功能
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove
} from '@/lib/firestore-tracked'
import { db } from './firebase'

// 獲取歌手的所有歌曲（包括合唱）
export async function getArtistTabsWithCollabs(artistId, artistName) {
  const tabs = []
  const seenIds = new Set()
  
  // 生成可能的 artistId 變體
  const artistIdFromName = artistName.toLowerCase().replace(/\s+/g, '-')
  const possibleIds = [...new Set([artistId, artistIdFromName])].filter(Boolean)
  
  // 如果是雙語名稱，添加中文名 ID
  const chineseMatch = artistName.match(/^([\u4e00-\u9fa5]{2,})/)
  if (chineseMatch) {
    possibleIds.push(chineseMatch[1].toLowerCase().replace(/\s+/g, '-'))
  }
  
  // 1. 嘗試每個可能的 artistId 查詢
  for (const id of possibleIds) {
    try {
      const mainQuery = query(
        collection(db, 'tabs'),
        where('artistId', '==', id)
      )
      const mainSnap = await getDocs(mainQuery)
      mainSnap.docs.forEach(d => {
        if (!seenIds.has(d.id)) {
          seenIds.add(d.id)
          tabs.push({ 
            id: d.id, 
            ...d.data(),
            isPrimary: true // 標記為主要歌手
          })
        }
      })
    } catch (e) {
      console.log('Query by artistId failed:', id, e)
    }
  }
  
  // 2. 用 artist 名稱查詢（兼容舊數據）
  try {
    const nameQuery = query(
      collection(db, 'tabs'),
      where('artist', '==', artistName)
    )
    const nameSnap = await getDocs(nameQuery)
    nameSnap.docs.forEach(d => {
      if (!seenIds.has(d.id)) {
        seenIds.add(d.id)
        tabs.push({ 
          id: d.id, 
          ...d.data(),
          isPrimary: true
        })
      }
    })
  } catch (e) {
    console.log('Query by artist name failed:', e)
  }
  
  // 3. 獲取合唱歌曲（該歌手在 collaborators 中）
  for (const id of possibleIds) {
    try {
      const collabQuery = query(
        collection(db, 'tabs'),
        where('collaborators', 'array-contains', id)
      )
      const collabSnap = await getDocs(collabQuery)
      collabSnap.docs.forEach(d => {
        if (!seenIds.has(d.id)) {
          seenIds.add(d.id)
          tabs.push({ 
            id: d.id, 
            ...d.data(),
            isPrimary: false // 標記為合唱歌手
          })
        }
      })
    } catch (e) {
      console.log('Query by collaborators failed:', id, e)
    }
  }
  
  // 按創建時間排序
  return tabs.sort((a, b) => {
    const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0)
    const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0)
    return dateB - dateA
  })
}

// 獲取歌曲的所有合作歌手資訊
export async function getTabCollaborators(tabId) {
  const tabRef = doc(db, 'tabs', tabId)
  const tabSnap = await getDoc(tabRef)
  
  if (!tabSnap.exists()) return []
  
  const tab = tabSnap.data()
  const collaboratorIds = tab.collaborators || []
  
  // 獲取每個合作歌手的詳細資訊
  const collaborators = []
  for (const id of collaboratorIds) {
    const artistRef = doc(db, 'artists', id)
    const artistSnap = await getDoc(artistRef)
    if (artistSnap.exists()) {
      collaborators.push({
        id: artistSnap.id,
        ...artistSnap.data()
      })
    }
  }
  
  return collaborators
}

// 添加合唱歌手到歌曲
export async function addCollaborator(tabId, artistId) {
  const tabRef = doc(db, 'tabs', tabId)
  await updateDoc(tabRef, {
    collaborators: arrayUnion(artistId),
    updatedAt: new Date().toISOString()
  })
}

// 移除合唱歌手
export async function removeCollaborator(tabId, artistId) {
  const tabRef = doc(db, 'tabs', tabId)
  await updateDoc(tabRef, {
    collaborators: arrayRemove(artistId),
    updatedAt: new Date().toISOString()
  })
}

// 拆分複合歌手名稱（如「吳卓羲 陳鍵鋒 謝天華」）
export function parseCollaborativeTitle(title) {
  // 常見分隔符：空格、/、|、&、feat.、ft.、x、X
  const separators = /[\s\/\|&,]|\s+(?:feat\.?|ft\.?|x|X)\s+/i
  
  const parts = title.split(separators).map(s => s.trim()).filter(Boolean)
  
  // 如果只有一部分，返回單一歌手
  if (parts.length <= 1) {
    return { isCollaboration: false, artists: parts }
  }
  
  // 檢查是否可能係多個歌手（長度判斷）
  const potentialArtists = parts.filter(part => part.length >= 2 && part.length <= 20)
  
  return {
    isCollaboration: potentialArtists.length > 1,
    artists: potentialArtists
  }
}

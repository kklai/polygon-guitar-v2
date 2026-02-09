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
} from 'firebase/firestore'
import { db } from './firebase'

// 獲取歌手的所有歌曲（包括合唱）
export async function getArtistTabsWithCollabs(artistId, artistName) {
  const tabs = []
  
  // 1. 獲取主要歌手的歌曲
  const mainQuery = query(
    collection(db, 'tabs'),
    where('artistId', '==', artistId)
  )
  const mainSnap = await getDocs(mainQuery)
  mainSnap.docs.forEach(d => {
    tabs.push({ 
      id: d.id, 
      ...d.data(),
      isPrimary: true // 標記為主要歌手
    })
  })
  
  // 2. 獲取合唱歌曲（該歌手在 collaborators 中）
  const collabQuery = query(
    collection(db, 'tabs'),
    where('collaborators', 'array-contains', artistId)
  )
  const collabSnap = await getDocs(collabQuery)
  collabSnap.docs.forEach(d => {
    // 避免重複
    if (!tabs.find(t => t.id === d.id)) {
      tabs.push({ 
        id: d.id, 
        ...d.data(),
        isPrimary: false // 標記為合唱歌手
      })
    }
  })
  
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

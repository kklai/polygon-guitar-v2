// 樂譜留言功能
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp
} from '@/lib/firestore-tracked'
import { db } from './firebase'

// 獲取樂譜留言
export async function getTabComments(tabId) {
  if (!tabId) return []
  
  const q = query(
    collection(db, 'comments'),
    where('tabId', '==', tabId),
    where('isDeleted', '==', false),
    orderBy('createdAt', 'desc')
  )
  
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// 添加留言
export async function addTabComment(tabId, userId, userName, content) {
  if (!tabId || !userId || !content.trim()) {
    throw new Error('缺少必要參數')
  }
  
  return await addDoc(collection(db, 'comments'), {
    tabId,
    userId,
    userName: userName || '匿名用戶',
    content: content.trim(),
    createdAt: serverTimestamp(),
    isDeleted: false
  })
}

// 獲取歌手求譜列表
export async function getArtistRequests(artistId) {
  if (!artistId) return []
  
  const q = query(
    collection(db, 'tabRequests'),
    where('artistId', '==', artistId),
    where('status', 'in', ['pending', 'completed']),
    orderBy('createdAt', 'desc')
  )
  
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// 添加求譜
export async function addTabRequest(artistId, userId, userName, songTitle, message = '') {
  if (!artistId || !userId || !songTitle.trim()) {
    throw new Error('缺少必要參數')
  }
  
  return await addDoc(collection(db, 'tabRequests'), {
    artistId,
    userId,
    userName: userName || '匿名用戶',
    songTitle: songTitle.trim(),
    message: message.trim(),
    status: 'pending',
    createdAt: serverTimestamp()
  })
}

// 標記求譜為已完成
export async function completeTabRequest(requestId, tabId) {
  const ref = doc(db, 'tabRequests', requestId)
  await updateDoc(ref, {
    status: 'completed',
    completedTabId: tabId,
    completedAt: serverTimestamp()
  })
}

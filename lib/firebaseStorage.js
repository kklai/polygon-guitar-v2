/**
 * Firebase Storage 上傳工具
 * 替代 Cloudinary 用於上傳 Guitar Pro 文件
 */

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { app } from './firebase'

const storage = getStorage(app)

/**
 * 上傳 GP 文件到 Firebase Storage
 * @param {File} file - 用戶選擇的 GP 文件
 * @param {string} songId - 歌曲 ID（用於組織文件路徑）
 * @returns {Promise<{url: string, path: string}>}
 */
export async function uploadGpFileToFirebase(file, songId = 'temp') {
  if (!file) {
    throw new Error('請選擇文件')
  }

  // 檢查文件類型
  const validExtensions = ['.gp3', '.gp4', '.gp5', '.gpx', '.gp']
  const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  
  if (!validExtensions.includes(fileExtension)) {
    throw new Error(`不支援的文件格式。請上傳: ${validExtensions.join(', ')}`)
  }

  // 檢查文件大小 (10MB)
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    throw new Error('文件大小超過 10MB 限制')
  }

  try {
    // 生成唯一文件名
    const timestamp = Date.now()
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const path = `guitar-pro-segments/${songId}/${timestamp}-${safeFilename}`
    
    // 創建存儲引用
    const storageRef = ref(storage, path)
    
    // 上傳文件
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: 'application/octet-stream', // 二進制文件
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      }
    })
    
    // 獲取下載 URL
    const downloadUrl = await getDownloadURL(snapshot.ref)
    
    return {
      url: downloadUrl,
      path: path,
      originalFilename: file.name,
      fileSize: file.size,
      format: fileExtension
    }
    
  } catch (error) {
    console.error('Firebase Storage upload error:', error)
    throw new Error('上傳失敗: ' + error.message)
  }
}

/**
 * 從 Firebase Storage 刪除 GP 文件
 * @param {string} path - 文件路徑
 */
export async function deleteGpFileFromFirebase(path) {
  try {
    const storageRef = ref(storage, path)
    await deleteObject(storageRef)
    return { success: true }
  } catch (error) {
    console.error('Delete error:', error)
    throw new Error('刪除失敗: ' + error.message)
  }
}

/**
 * 獲取文件信息
 */
export function getGpFileInfo(filename) {
  const extension = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  
  const formatMap = {
    '.gp3': { format: 'Guitar Pro 3', version: 3 },
    '.gp4': { format: 'Guitar Pro 4', version: 4 },
    '.gp5': { format: 'Guitar Pro 5', version: 5 },
    '.gpx': { format: 'Guitar Pro 6', version: 6 },
    '.gp':  { format: 'Guitar Pro 7+', version: 7 }
  }
  
  return formatMap[extension] || { format: 'Unknown', version: 0 }
}

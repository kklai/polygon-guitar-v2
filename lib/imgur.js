// Imgur 匿名上傳功能（含圖片壓縮）
// 注意：Imgur 匿名上傳每日限制 50 張

const IMGUR_CLIENT_ID = '6db47bd7029562d'
const MAX_WIDTH = 1200
const MAX_HEIGHT = 1200
const MAX_FILE_SIZE = 500 * 1024 // 500KB
const OUTPUT_QUALITY = 0.85

/**
 * 壓縮圖片
 * @param {File} file - 原始圖片檔案
 * @returns {Promise<{blob: Blob, originalSize: number, compressedSize: number}>}
 */
export async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    
    img.onload = () => {
      URL.revokeObjectURL(url)
      
      // 計算新尺寸（保持比例）
      let { width, height } = img
      
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      
      // 創建 Canvas
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      
      // 繪製圖片
      ctx.drawImage(img, 0, 0, width, height)
      
      // 轉換為 WebP Blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('圖片壓縮失敗'))
            return
          }
          
          resolve({
            blob,
            originalSize: file.size,
            compressedSize: blob.size,
            width,
            height
          })
        },
        'image/webp',
        OUTPUT_QUALITY
      )
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('讀取圖片失敗'))
    }
    
    img.src = url
  })
}

/**
 * 將 Blob 轉為 Base64
 * @param {Blob} blob 
 * @returns {Promise<string>}
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * 格式化檔案大小
 * @param {number} bytes 
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 上傳圖片到 Imgur（匿名，自動壓縮）
 * @param {File} file - 圖片檔案
 * @param {Function} onProgress - 進度回調 (status, data)
 * @returns {Promise<string>} - 圖片 URL
 */
export async function uploadToImgur(file, onProgress = () => {}) {
  // 步驟 1: 壓縮圖片
  onProgress('compressing', { message: '正在壓縮圖片...' })
  
  const { blob, originalSize, compressedSize, width, height } = await compressImage(file)
  
  onProgress('compressed', {
    originalSize,
    compressedSize,
    width,
    height,
    message: `壓縮完成：${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)}`
  })
  
  // 檢查壓縮後大小
  if (compressedSize > MAX_FILE_SIZE) {
    throw new Error(`壓縮後仍超過 500KB (${formatFileSize(compressedSize)})，請選擇更小的圖片`)
  }
  
  // 步驟 2: 轉為 Base64
  onProgress('converting', { message: '正在轉換格式...' })
  const base64 = await blobToBase64(blob)
  
  // 步驟 3: 上傳到 Imgur
  onProgress('uploading', { message: '正在上傳到 Imgur...' })
  
  const response = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      image: base64,
      type: 'base64'
    })
  })
  
  const data = await response.json()
  
  if (!data.success) {
    throw new Error(data.data?.error || '上傳失敗')
  }
  
  onProgress('completed', {
    url: data.data.link,
    originalSize,
    compressedSize
  })
  
  return {
    url: data.data.link,
    originalSize,
    compressedSize,
    width,
    height
  }
}

/**
 * 檢查檔案是否有效
 * @param {File} file - 檔案
 * @returns {Object} - { valid: boolean, error?: string }
 */
export function validateImageFile(file) {
  // 原始檔案大小限制 (20MB，壓縮前)
  const MAX_ORIGINAL_SIZE = 20 * 1024 * 1024
  
  // 允許的類型
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff']
  
  if (!file) {
    return { valid: false, error: '請選擇檔案' }
  }
  
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: '只支援 JPG、PNG、GIF、WebP、BMP、TIFF 格式' }
  }
  
  if (file.size > MAX_ORIGINAL_SIZE) {
    return { valid: false, error: '檔案大小不能超過 20MB' }
  }
  
  return { valid: true }
}

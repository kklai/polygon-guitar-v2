// Cloudinary 上傳功能（Unsigned Upload）
const CLOUD_NAME = 'drld2cjpo'
const UPLOAD_PRESET = 'artist_photos'

/** 預設：超過此尺寸（寬或高）會縮圖 */
const DEFAULT_MAX_DIMENSION = 500
/** 預設：超過此大小（bytes）會先縮細再上傳 */
const DEFAULT_MAX_SIZE_BEFORE_RESIZE = 1 * 1024 * 1024 // 1MB
/** 縮圖 JPEG 品質 0–1 */
const RESIZE_QUALITY = 0.88

/**
 * 將圖片縮細（用 canvas），保持比例，限制寬高與檔案大小
 * @param {File} file - 圖片檔案
 * @param {Object} opts - { maxWidth, maxHeight, maxSizeBytes, quality }
 * @returns {Promise<File>} - 縮圖後的 File（JPEG）
 */
export function resizeImageFile(file, opts = {}) {
  const maxWidth = opts.maxWidth ?? DEFAULT_MAX_DIMENSION
  const maxHeight = opts.maxHeight ?? DEFAULT_MAX_DIMENSION
  const maxSizeBytes = opts.maxSizeBytes ?? DEFAULT_MAX_SIZE_BEFORE_RESIZE
  const quality = opts.quality ?? RESIZE_QUALITY

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (w <= maxWidth && h <= maxHeight && file.size <= maxSizeBytes) {
        resolve(file)
        return
      }
      const scale = Math.min(maxWidth / w, maxHeight / h, 1)
      w = Math.round(w * scale)
      h = Math.round(h * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          const name = file.name.replace(/\.[^.]+$/, '') || 'image'
          const out = new File([blob], `${name}.jpg`, { type: 'image/jpeg' })
          resolve(out)
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('無法讀取圖片'))
    }
    img.src = url
  })
}

/**
 * 上傳圖片到 Cloudinary（Unsigned Upload）
 * @param {File} file - 圖片檔案
 * @param {string} name - 名稱（用於生成檔案名）
 * @param {string} folder - 文件夾（默認 'artists'）
 * @returns {Promise<string>} - 圖片 URL
 */
export async function uploadToCloudinary(file, name, folder = 'artists') {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('folder', folder)
  
  // 使用名稱同時間戳生成檔案名
  const sanitizedName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
  formData.append('public_id', `${sanitizedName}_${Date.now()}`)
  
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData
    }
  )
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || '上傳失敗')
  }
  
  const result = await response.json()
  
  return result.secure_url
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
 * 檢查檔案是否有效
 * @param {File} file - 檔案
 * @returns {Object} - { valid: boolean, error?: string }
 */
export function validateImageFile(file) {
  const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB（過大會在上傳前自動縮圖）
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']

  if (!file) {
    return { valid: false, error: '請選擇檔案' }
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: '只支援 JPG、PNG、GIF、WebP、BMP 格式' }
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: '檔案大小不能超過 2MB' }
  }

  return { valid: true }
}

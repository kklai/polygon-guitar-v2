// Cloudinary 上傳功能（Unsigned Upload）
const CLOUD_NAME = 'drld2cjpo'
const UPLOAD_PRESET = 'artist_photos'

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
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']
  
  if (!file) {
    return { valid: false, error: '請選擇檔案' }
  }
  
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: '只支援 JPG、PNG、GIF、WebP、BMP 格式' }
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: '檔案大小不能超過 10MB' }
  }
  
  return { valid: true }
}

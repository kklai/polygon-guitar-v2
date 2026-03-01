/**
 * Guitar Pro 文件上傳到 Cloudinary
 * 
 * 使用 Cloudinary Unsigned Upload Preset
 * 建議 Preset 配置：
 * - folder: guitar-pro-segments
 * - allowed_formats: gp3, gp4, gp5, gpx, gp
 * - max_file_size: 5242880 (5MB)
 * - resource_type: raw
 */

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'drld2cjpo'
const UPLOAD_PRESET = 'guitar_pro_segments' // 需要在 Cloudinary 創建

/**
 * 上傳 Guitar Pro 文件到 Cloudinary
 * @param {File} file - 用戶選擇的 GP 文件
 * @param {string} songTitle - 歌曲名（用於生成 public_id）
 * @returns {Promise<{url: string, publicId: string}>}
 */
export async function uploadGpFile(file, songTitle = '') {
  if (!file) {
    throw new Error('請選擇文件')
  }

  // 檢查文件類型
  const validExtensions = ['.gp3', '.gp4', '.gp5', '.gpx', '.gp']
  const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  
  if (!validExtensions.includes(fileExtension)) {
    throw new Error(`不支援的文件格式。請上傳: ${validExtensions.join(', ')}`)
  }

  // 檢查文件大小 (5MB)
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    throw new Error('文件大小超過 5MB 限制')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('resource_type', 'raw')
  
  // 生成有意義的 public_id
  const timestamp = Date.now()
  const safeTitle = songTitle 
    ? songTitle.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-').slice(0, 30)
    : 'untitled'
  formData.append('public_id', `gp-${safeTitle}-${timestamp}`)

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`,
      {
        method: 'POST',
        body: formData
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || '上傳失敗')
    }

    const data = await response.json()
    
    return {
      url: data.secure_url,
      publicId: data.public_id,
      originalFilename: file.name,
      fileSize: file.size,
      format: data.format
    }
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    throw new Error('上傳到 Cloudinary 失敗: ' + error.message)
  }
}

/**
 * 從 Cloudinary 刪除 GP 文件
 * @param {string} publicId - Cloudinary public_id
 * @param {string} apiKey - Cloudinary API Key（需要後端支援）
 * @param {string} apiSecret - Cloudinary API Secret
 */
export async function deleteGpFile(publicId) {
  // 注意：刪除 raw 文件需要 API Key 和 Signature
  // 建議通過後端 API 處理刪除
  // 這裡只返回需要的信息，實際刪除由後端處理
  
  return {
    publicId,
    requiresBackend: true,
    message: '請通過後端 API 刪除文件'
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

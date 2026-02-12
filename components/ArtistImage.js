import { useState } from 'react'

/**
 * ArtistImage 組件 - 統一歌手圖片顯示邏輯
 * 優先順序：
 * 1. photoURL（用戶上傳的 Cloudinary 相片）
 * 2. wikiPhotoURL（維基百科備份相片）
 * 3. placeholder（預設佔位圖）
 */
export default function ArtistImage({ 
  artist, 
  size = 'medium',
  className = '',
  showFallback = true 
}) {
  const [error, setError] = useState(false)

  // 根據 size 設置尺寸
  const sizeClasses = {
    small: 'w-10 h-10',
    medium: 'w-16 h-16',
    large: 'w-24 h-24',
    xl: 'w-32 h-32',
    hero: 'w-full h-full'
  }

  // 獲取圖片 URL（按優先順序）
  const getImageUrl = () => {
    if (!artist) return null
    
    // 1. 優先使用用戶上傳的 photoURL（非 Spotify）
    if (artist.photoURL && !artist.photoURL.includes('spotify') && !error) {
      return artist.photoURL
    }
    
    // 2. 其次使用 Spotify 相片
    if (artist.spotifyPhotoURL && !error) {
      return artist.spotifyPhotoURL
    }
    
    // 3. 再其次使用維基百科相片
    if (artist.wikiPhotoURL && !error) {
      return artist.wikiPhotoURL
    }
    
    // 4. 兼容舊資料的 photo 欄位
    if (artist.photo && !error) {
      return artist.photo
    }
    
    return null
  }

  const imageUrl = getImageUrl()
  const sizeClass = sizeClasses[size] || sizeClasses.medium

  // 如果沒有圖片且不需要顯示 fallback
  if (!imageUrl && !showFallback) {
    return null
  }

  // 如果沒有圖片，顯示預設佔位圖
  if (!imageUrl) {
    return (
      <div 
        className={`
          ${sizeClass}
          bg-gradient-to-br from-[#FFD700] to-orange-500
          flex items-center justify-center
          rounded-full
          ${className}
        `}
      >
        <span className="text-2xl">🎤</span>
      </div>
    )
  }

  // 顯示歌手圖片
  return (
    <img
      src={imageUrl}
      alt={artist?.name || '歌手'}
      className={`
        ${sizeClass}
        object-cover
        rounded-full
        ${className}
      `}
      onError={() => setError(true)}
    />
  )
}

/**
 * ArtistHeroImage - Hero 區域專用（16:9 比例）
 * 優先順序：
 * 1. heroPhoto（用戶上傳的 Hero 圖片）
 * 2. photoURL（歌手相）
 * 3. wikiPhotoURL（維基備份）
 */
export function ArtistHeroImage({ artist, className = '' }) {
  const [error, setError] = useState(false)

  const getImageUrl = () => {
    if (!artist) return null
    
    // 1. 優先使用 heroPhoto（用戶上傳的 Hero 圖片）
    if (artist.heroPhoto && !error) return artist.heroPhoto
    
    // 2. 其次使用 Spotify 相片（高質素）
    if (artist.spotifyPhotoURL && !error) return artist.spotifyPhotoURL
    
    // 3. 再其次使用用戶上傳 photoURL
    if (artist.photoURL && !error) return artist.photoURL
    
    // 4. 再其次使用維基百科相片
    if (artist.wikiPhotoURL && !error) return artist.wikiPhotoURL
    
    // 5. 兼容舊資料
    if (artist.photo && !error) return artist.photo
    
    return null
  }

  const imageUrl = getImageUrl()

  if (!imageUrl) {
    return (
      <div 
        className={`
          w-full h-full
          bg-gradient-to-br from-[#FFD700] to-orange-500
          flex items-center justify-center
          ${className}
        `}
      >
        <span className="text-6xl md:text-8xl">🎤</span>
      </div>
    )
  }

  return (
    <img
      src={imageUrl}
      alt={artist?.name || '歌手'}
      className={`w-full h-full object-cover object-top ${className}`}
      onError={() => setError(true)}
    />
  )
}

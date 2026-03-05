import { useState } from 'react'
import Skeleton from './Skeleton'

/**
 * LazyImage - 帶骨架屏的延遲載入圖片
 * 
 * @param {string} src - 圖片 URL
 * @param {string} alt - 圖片描述
 * @param {string} className - 圖片樣式
 * @param {string} containerClassName - 容器樣式
 * @param {function} onClick - 點擊事件
 * @param {ReactNode} fallback - 載入失敗或無圖片時的顯示內容
 * @param {ReactNode} skeleton - 自定義骨架屏
 * @param {boolean} priority - 是否優先載入（不使用 lazy）
 */
export default function LazyImage({
  src,
  alt = '',
  className = '',
  containerClassName = '',
  onClick,
  fallback,
  skeleton,
  priority = false
}) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  // 如果沒有圖片或載入失敗，顯示 fallback
  if (!src || error) {
    return (
      <div 
        className={`${containerClassName} flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900`}
        onClick={onClick}
      >
        {fallback || <span className="text-4xl">🎵</span>}
      </div>
    )
  }

  return (
    <div 
      className={`${containerClassName} relative overflow-hidden bg-[#282828]`}
      onClick={onClick}
    >
      {/* 骨架屏 - 圖片載入前顯示 */}
      {!loaded && (
        <div className="absolute inset-0 z-10">
          {skeleton || <Skeleton className="w-full h-full" />}
        </div>
      )}
      
      <img
        src={src}
        alt={alt}
        className={`${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  )
}

/**
 * SongCard - 帶骨架屏的歌曲卡片
 */
export function SongCard({ song, artistPhoto, onClick }) {
  const [imageLoaded, setImageLoaded] = useState(false)

  // 獲取封面圖
  const getCoverImage = () => {
    if (song.albumImage) return song.albumImage
    if (song.youtubeVideoId) return `https://img.youtube.com/vi/${song.youtubeVideoId}/mqdefault.jpg`
    if (song.youtubeUrl) {
      const match = song.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)
      if (match) return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`
    }
    if (song.thumbnail) return song.thumbnail
    if (artistPhoto) return artistPhoto
    return null
  }

  const coverImage = getCoverImage()

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 flex flex-col text-left w-36 group"
    >
      {/* 封面區域 */}
      <div className="w-36 h-36 rounded-lg overflow-hidden bg-[#282828] mb-2 shadow-lg relative transition-transform duration-200 active:scale-110 active:z-20">
        {coverImage ? (
          <>
            {/* 骨架屏 */}
            {!imageLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#282828] z-10">
                <span className="text-3xl mb-1">🎵</span>
                <span className="text-[10px] text-gray-500 text-center px-2 line-clamp-1">
                  {song.artist}
                </span>
              </div>
            )}
            <img
              src={coverImage}
              alt={song.title}
              className={`w-full h-full object-cover transition-all duration-300 pointer-events-none select-none ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
              decoding="async"
              draggable="false"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
            />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <span className="text-4xl mb-1">🎵</span>
            <span className="text-[10px] text-gray-500 text-center px-2 line-clamp-1">
              {song.artist}
            </span>
          </div>
        )}
      </div>
      
      <h3 className="text-white font-medium truncate" style={{ fontSize: 15 }}>
        {song.title}
      </h3>
      <p className="text-gray-500 truncate" style={{ fontSize: 13 }}>{song.artist}</p>
    </button>
  )
}

/**
 * PlaylistCard - 帶骨架屏的歌單卡片
 */
export function PlaylistCard({ playlist, onClick }) {
  const [imageLoaded, setImageLoaded] = useState(false)

  // 獲取封面圖
  const getCoverImage = () => {
    if (playlist.coverImage) return playlist.coverImage
    return null
  }

  const coverImage = getCoverImage()

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 flex flex-col text-left w-40 group"
    >
      {/* 封面區域 */}
      <div className="w-40 aspect-square rounded-lg overflow-hidden bg-[#282828] mb-2 shadow-lg relative transition-transform duration-200 active:scale-110 active:z-20">
        {coverImage ? (
          <>
            {/* 骨架屏 */}
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#282828] z-10">
                <span className="text-3xl">🎸</span>
              </div>
            )}
            <img
              src={coverImage}
              alt={playlist.title}
              className={`w-full h-full object-cover transition-all duration-300 pointer-events-none select-none ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
              decoding="async"
              draggable="false"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <span className="text-4xl">🎸</span>
          </div>
        )}
      </div>
      
      <h3 className="text-white font-medium truncate" style={{ fontSize: 15 }}>
        {playlist.title}
      </h3>
      {playlist.description && (
        <p className="text-gray-500 line-clamp-2" style={{ fontSize: 13 }}>{playlist.description}</p>
      )}
    </button>
  )
}

/**
 * ArtistAvatar - 帶骨架屏的歌手頭像
 */
export function ArtistAvatar({ artist, onClick }) {
  const [imageLoaded, setImageLoaded] = useState(false)

  const photoUrl = artist.photoURL || artist.wikiPhotoURL

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center group"
    >
      {/* 頭像區域 */}
      <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-[#282828] mb-2 shadow-lg relative transition-transform duration-200 active:scale-110 active:z-20">
        {photoUrl ? (
          <>
            {/* 骨架屏 */}
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#282828] z-10">
                <span className="text-2xl">🎤</span>
              </div>
            )}
            <img
              src={photoUrl}
              alt={artist.name}
              className={`w-full h-full object-cover transition-all duration-300 pointer-events-none select-none ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
              decoding="async"
              draggable="false"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <span className="text-3xl">🎤</span>
          </div>
        )}
      </div>
      
      <span className="text-white font-medium text-center line-clamp-1 max-w-[100px]" style={{ fontSize: 15 }}>
        {artist.name}
      </span>
    </button>
  )
}

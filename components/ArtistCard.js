import Link from 'next/link'

const CATEGORY_EMOJI = {
  male: '👨‍🎤',
  female: '👩‍🎤',
  group: '🎸',
  soundtrack: '🎬',
  other: '🎵'
}

export default function ArtistCard({ artist, category }) {
  const emoji = CATEGORY_EMOJI[category] || '🎵'
  const songCount = artist.songCount || artist.tabCount || 0
  
  return (
    <Link
      href={`/artists/${artist.normalizedName}`}
      className="group block bg-[#121212] rounded-[10px] p-[8px_6px] border border-transparent hover:border-[#FFD700] transition-all duration-200 hover:-translate-y-1"
    >
      {/* 頭像 - 1:1.2 比例 */}
      <div className="relative w-full aspect-[1/1.2] rounded-md overflow-hidden bg-[#333] mb-2">
        {artist.photoURL || artist.wikiPhotoURL ? (
          <img
            src={artist.photoURL || artist.wikiPhotoURL}
            alt={artist.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-2xl">{emoji}</span>
          </div>
        )}
      </div>
      
      {/* 歌手名 */}
      <h3 className="text-white text-xs text-center truncate px-1 mb-1.5 leading-tight">
        {artist.name}
      </h3>
      
      {/* 歌曲數 badge */}
      <div className="flex justify-center">
        <span className="inline-block bg-[#FFD700] text-black text-[10px] font-medium px-2 py-0.5 rounded-full">
          {songCount}
        </span>
      </div>
    </Link>
  )
}

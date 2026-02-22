import Link from 'next/link'

export default function ArtistCard({ artist }) {
  const songCount = artist.songCount || artist.tabCount || 0
  
  return (
    <Link
      href={`/artists/${artist.id}`}
      className="group block text-center"
    >
      {/* 圓形頭像 */}
      <div className="relative w-full aspect-square rounded-full overflow-hidden bg-[#282828] mb-2">
        {artist.photoURL || artist.wikiPhotoURL ? (
          <img
            src={artist.photoURL || artist.wikiPhotoURL}
            alt={artist.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-2xl">🎵</span>
          </div>
        )}
      </div>
      
      {/* 歌手名 */}
      <h3 className="text-white text-sm text-center truncate leading-tight">
        {artist.name}
      </h3>
    </Link>
  )
}

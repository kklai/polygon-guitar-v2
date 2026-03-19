import Link from '@/components/Link'
import { getArtistSlug } from '@/lib/tabs'
import { Music } from 'lucide-react'

export default function ArtistCard({ artist }) {
  const songCount = artist.songCount || artist.tabCount || 0
  const slug = getArtistSlug(artist) || artist.id

  return (
    <Link
      href={`/artists/${encodeURIComponent(slug)}`}
      className="block text-center"
    >
      {/* 圓形頭像 - 無點擊效果 */}
      <div className="relative w-full aspect-square rounded-full overflow-hidden bg-[#282828] mb-2">
        {artist.photoURL || artist.wikiPhotoURL ? (
          <img
            src={artist.photoURL || artist.wikiPhotoURL}
            alt={artist.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover pointer-events-none"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-8 h-8 text-neutral-500" strokeWidth={1.5} />
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

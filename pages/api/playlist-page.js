/**
 * GET /api/playlist-page?id=xxx
 * Returns full playlist page payload (playlist, songs, uniqueArtists, otherPlaylists).
 * When Firestore cache/playlist_{id} is fresh: 1 read. On miss: full build then 1 write.
 * Used by client-side navigation to playlist page to avoid N+1 reads.
 */

import { getPlaylistPageCache, setPlaylistPageCache } from '@/lib/playlistPageCache'
import { getPlaylist, getPlaylistSongs, getAllActivePlaylists } from '@/lib/playlists'

function serializePayload(obj) {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v))
  )
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const id = typeof req.query.id === 'string' ? req.query.id.trim() : null
  if (!id) {
    return res.status(400).json({ error: 'Missing id' })
  }

  try {
    const cached = await getPlaylistPageCache(id)
    if (cached) {
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
      return res.json(cached)
    }

    const playlistData = await getPlaylist(id)
    if (!playlistData) {
      return res.status(404).json({ error: 'Playlist not found' })
    }

    const songIds = playlistData.songIds || []
    const { songs, uniqueArtists } = songIds.length > 0
      ? await getPlaylistSongs(songIds)
      : { songs: [], uniqueArtists: [] }
    const otherPlaylists = await getAllActivePlaylists()

    const payload = {
      playlist: playlistData,
      songs,
      uniqueArtists,
      otherPlaylists
    }
    await setPlaylistPageCache(id, payload)

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return res.json(serializePayload(payload))
  } catch (err) {
    console.error('[playlist-page API]', err?.message)
    return res.status(500).json({ error: 'Failed to load playlist', message: err?.message })
  }
}

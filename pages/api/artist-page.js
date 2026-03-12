/**
 * GET /api/artist-page?id=xxx
 * Returns artist page payload (artist, hotTabs, allTabs slim).
 * When Firestore cache/artistPage_{id} is fresh: 1 read. On miss: resolve artist + getTabsByArtist, then 1 write.
 * Used by client-side navigation to artist page to avoid 1 + 6×N reads.
 */

import { doc, getDoc } from '@/lib/firestore-tracked'
import { db } from '@/lib/firebase'
import { getArtistBySlug, getTabsByArtist, slimTabForArtistPage } from '@/lib/tabs'
import { getArtistPageCache, setArtistPageCache } from '@/lib/artistPageCache'

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
    let cached = await getArtistPageCache(id)
    if (cached) {
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
      return res.json(cached)
    }

    let artistDoc = await getDoc(doc(db, 'artists', id))
    if (!artistDoc.exists()) {
      const bySlug = await getArtistBySlug(id)
      if (!bySlug) {
        return res.status(404).json({ error: 'Artist not found' })
      }
      artistDoc = { exists: () => true, id: bySlug.id, data: () => ({ ...bySlug }) }
    }
    const artistData = { id: artistDoc.id, ...artistDoc.data() }
    const artistId = artistData.id

    cached = await getArtistPageCache(artistId)
    if (cached) {
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
      return res.json(cached)
    }

    const tabs = await getTabsByArtist(artistData.name, artistData.normalizedName || artistId)
    tabs.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    const slimTabs = tabs.map(slimTabForArtistPage)
    const payload = {
      artist: artistData,
      hotTabs: slimTabs.slice(0, 5),
      allTabs: slimTabs
    }
    await setArtistPageCache(artistId, payload)

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return res.json(serializePayload(payload))
  } catch (err) {
    console.error('[artist-page API]', err?.message)
    return res.status(500).json({ error: 'Failed to load artist', message: err?.message })
  }
}

import { getSearchData } from '@/lib/searchData'

/**
 * Artists list API: reads from Firestore cache/searchData (1 read when cache fresh).
 * Cache TTL 24h; same source as /api/search-data?only=artists. No direct getDocs(artists).
 *
 * On Vercel serverless, in-memory cache does not persist across invocations (each request
 * can hit a new instance), so we use the shared Firestore cache instead. Refresh once per
 * day or via admin "Rebuild search cache" in home-settings.
 */
const CACHE_MAX_AGE = 24 * 60 * 60 // 24h in seconds
const STALE_WHILE_REVALIDATE = 24 * 60 * 60 // 24h

export default async function handler(req, res) {
  try {
    const data = await getSearchData()
    const artists = data?.artists ?? []

    res.setHeader('Cache-Control', `public, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`)
    return res.json(artists)
  } catch (err) {
    console.error('[api/artists] error:', err?.message)
    res.status(500).json({ error: 'Failed to load artists', message: err?.message })
  }
}

import { getSearchDataCached, bustSearchDataApiCache } from '@/lib/searchData'

/**
 * Search data API: reads from Firestore cache/searchData (1 read when fresh).
 * In-memory cache 10min; use ?bust=1 to clear. Use admin "Rebuild search cache" to refresh Firestore cache.
 */
export default async function handler(req, res) {
  if (req.query.bust === '1' || req.query.bust === 'true') {
    bustSearchDataApiCache()
  }

  try {
    const data = await getSearchDataCached()

    // Optional: return only tabs or only artists to reduce payload for single-purpose callers (same 1 read)
    const only = req.query.only === 'artists' ? 'artists' : req.query.only === 'tabs' ? 'tabs' : null
    const body = only === 'artists' ? { artists: data.artists } : only === 'tabs' ? { tabs: data.tabs } : data
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200')
    return res.json(body)
  } catch (err) {
    console.error('search-data API error:', err)
    res.status(500).json({ error: 'Failed to load search data', message: err?.message })
  }
}

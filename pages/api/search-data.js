import { getSearchData } from '@/lib/searchData'

/**
 * Search data API: reads from Firestore cache/searchData (1 read when fresh).
 * Cache TTL 24h; full query at most once per day. Use admin "Rebuild search cache" to break cache.
 */
export default async function handler(req, res) {
  try {
    const result = await getSearchData({ includeCacheStatus: true })
    const data = result.data ?? result
    const cacheStatus = result.cacheStatus || (result.data ? 'hit' : null)

    // Optional: return only tabs or only artists to reduce payload for single-purpose callers (same 1 read)
    const only = req.query.only === 'artists' ? 'artists' : req.query.only === 'tabs' ? 'tabs' : null
    const body = only === 'artists' ? { artists: data.artists } : only === 'tabs' ? { tabs: data.tabs } : data

    if (cacheStatus) res.setHeader('X-Search-Cache', cacheStatus)
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200')
    return res.json(body)
  } catch (err) {
    console.error('search-data API error:', err)
    res.status(500).json({ error: 'Failed to load search data', message: err?.message })
  }
}

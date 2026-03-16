import { getSearchDataCached, bustSearchDataApiCache } from '@/lib/searchData'

/**
 * Search data API: reads from Firestore cache/searchData (1 read when fresh).
 * In-memory cache 45s; use ?bust=1 to clear. Use admin "Rebuild search cache" to refresh Firestore cache.
 */
export default async function handler(req, res) {
  if (req.query.bust === '1' || req.query.bust === 'true') {
    bustSearchDataApiCache()
  }

  try {
    const data = await getSearchDataCached()

    // Optional: return only orphaned tabs (artistId not in artists). Same 1 read; useful when cache is warm.
    if (req.query.orphaned === '1' || req.query.orphaned === 'true') {
      const artists = data.artists || []
      const tabs = data.tabs || []
      const artistIds = new Set()
      artists.forEach((a) => {
        if (a.id) {
          artistIds.add(a.id)
          artistIds.add(a.id.toLowerCase())
        }
      })
      const orphaned = tabs
        .filter((t) => {
          const aid = t.artistId || ''
          return aid && !artistIds.has(aid) && !artistIds.has(aid.toLowerCase())
        })
        .map((t) => ({ tabId: t.id, title: t.title || '', artistId: t.artistId || '' }))
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=30')
      return res.json({ orphaned, count: orphaned.length })
    }

    // Optional: return only tabs or only artists to reduce payload for single-purpose callers (same 1 read)
    const only = req.query.only === 'artists' ? 'artists' : req.query.only === 'tabs' ? 'tabs' : null
    const body = only === 'artists' ? { artists: data.artists } : only === 'tabs' ? { tabs: data.tabs } : data
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=30')
    return res.json(body)
  } catch (err) {
    console.error('search-data API error:', err)
    res.status(500).json({ error: 'Failed to load search data', message: err?.message })
  }
}

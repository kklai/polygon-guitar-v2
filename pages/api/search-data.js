import { getSearchData } from '@/lib/searchData'

// In-memory cache so repeated requests within TTL don't even hit Firestore (0 reads)
let cachedData = null
let cacheTime = 0
const SERVER_CACHE_TTL = 10 * 60 * 1000 // 10 min

export default async function handler(req, res) {
  if (req.query.bust === '1' || req.query.bust === 'true') {
    cachedData = null
    cacheTime = 0
  }
  if (cachedData && Date.now() - cacheTime < SERVER_CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200')
    return res.json(cachedData)
  }

  try {
    // When Firestore cache/searchData is fresh: 1 read. When stale: 1 read + background rebuild. When missing: full build (~3.7k reads) then 1 write.
    const data = await getSearchData()
    cachedData = data
    cacheTime = Date.now()

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

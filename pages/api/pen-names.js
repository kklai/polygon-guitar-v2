/**
 * GET: Return existing uploader pen names that match query (for autocomplete).
 * Uses search-data cache (1 read when cache warm). Query: ?q=xxx
 */
import { getSearchDataCached } from '@/lib/searchData'

const MAX_RESULTS = 15

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const q = (typeof req.query.q === 'string' ? req.query.q : '').trim().toLowerCase()

  try {
    const data = await getSearchDataCached()
    const tabs = data?.tabs || []
    const unique = [...new Set(tabs.map(t => (t.uploaderPenName || '').trim()).filter(Boolean))]

    if (!q) {
      return res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=30').json({ penNames: unique.slice(0, MAX_RESULTS) })
    }

    const prefixMatch = unique.filter(n => n.toLowerCase().startsWith(q))
    const rest = unique.filter(n => !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q))
    const combined = [...prefixMatch, ...rest].slice(0, MAX_RESULTS)

    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=30')
    return res.json({ penNames: combined })
  } catch (err) {
    console.error('[pen-names]', err?.message)
    return res.status(500).json({ error: 'Failed to load pen names' })
  }
}

/**
 * GET /api/tab-requests
 * Returns cached tab requests list. 1 Firestore read when cache is warm; N reads + 1 write on cold.
 */
import { getTabRequestsCache, buildTabRequestsPayload, setTabRequestsCache } from '@/lib/tabRequestsCache'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    let list = await getTabRequestsCache()
    // Create or repopulate cache if it doesn't exist or is empty
    if (list === null || (Array.isArray(list) && list.length === 0)) {
      list = await buildTabRequestsPayload()
      await setTabRequestsCache(list).catch((err) => console.error('[tab-requests] setCache failed', err?.message))
    }
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    return res.json({ tabRequests: Array.isArray(list) ? list : [] })
  } catch (err) {
    console.error('[tab-requests] API error:', err)
    // Return 200 with empty list so the page still loads (e.g. Admin not configured)
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    return res.status(200).json({ tabRequests: [] })
  }
}

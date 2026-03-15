/**
 * GET /api/tab-requests
 * Returns cached tab requests list. 1 Firestore read when cache is warm; N reads + 1 write on cold.
 * Uses a short timeout so quota errors (RESOURCE_EXHAUSTED) don't block the response for 15–20s+.
 */
import { getTabRequestsCache, buildTabRequestsPayload, setTabRequestsCache } from '@/lib/tabRequestsCache'

const READ_TIMEOUT_MS = 4000

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
}

function isQuotaError(err) {
  const msg = err?.message || ''
  return msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded')
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const setHeaders = () => {
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=30')
  }
  try {
    let list = null
    try {
      list = await Promise.race([getTabRequestsCache(), timeout(READ_TIMEOUT_MS)])
    } catch (e) {
      if (isQuotaError(e)) {
        setHeaders()
        return res.status(200).json({ tabRequests: [] })
      }
      throw e
    }
    if (list === null || (Array.isArray(list) && list.length === 0)) {
      try {
        list = await Promise.race([buildTabRequestsPayload(), timeout(READ_TIMEOUT_MS)])
      } catch (e) {
        if (isQuotaError(e)) {
          setHeaders()
          return res.status(200).json({ tabRequests: [] })
        }
        throw e
      }
      await setTabRequestsCache(list || []).catch((err) => console.error('[tab-requests] setCache failed', err?.message))
    }
    setHeaders()
    return res.json({ tabRequests: Array.isArray(list) ? list : [] })
  } catch (err) {
    if (err?.message === 'timeout' || isQuotaError(err)) {
      setHeaders()
      return res.status(200).json({ tabRequests: [] })
    }
    console.error('[tab-requests] API error:', err)
    setHeaders()
    return res.status(200).json({ tabRequests: [] })
  }
}

/**
 * Rebuild the search page Firestore cache (cache/searchData).
 * After rebuild, each search-data API call uses 1 read until the cache expires (10 min) or is bust again.
 *
 * Auth: Bearer <idToken> (admin) or x-cron-secret header (cron job).
 */

import { verifyAdmin } from '@/lib/firebase-admin'
import { buildSearchDataPayload, setSearchCache } from '@/lib/searchData'

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'POST, GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronSecret = (process.env.CRON_SECRET || process.env.HOME_CACHE_BUST_SECRET || '').trim()
  const hasCronSecret = cronSecret && req.headers['x-cron-secret'] === cronSecret

  if (!hasCronSecret) {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: use Bearer token or x-cron-secret' })
    }
    const token = authHeader.slice(7)
    const decoded = await verifyAdmin(token)
    if (!decoded) {
      return res.status(403).json({ error: 'Forbidden' })
    }
  }

  try {
    const payload = await buildSearchDataPayload()
    await setSearchCache(payload)
    return res.status(200).json({
      ok: true,
      message: 'Search cache rebuilt',
      updatedAt: new Date().toISOString()
    })
  } catch (e) {
    console.error('[rebuild-search-cache]', e?.message)
    return res.status(500).json({ error: e?.message || 'Failed to rebuild search cache' })
  }
}

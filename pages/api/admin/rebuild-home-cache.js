/**
 * Rebuild the homepage Firestore cache (cache/homePage).
 * After rebuild, every homepage visit uses 1 read until the cache expires (6h) or is bust again.
 *
 * Auth: Bearer <idToken> (admin) or x-cron-secret header (cron job).
 */

import { verifyAdmin } from '@/lib/firebase-admin'
import { buildHomeDataPayload, setHomeCache, bustHomeDataApiCache } from '@/lib/homeData'

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
    const payload = await buildHomeDataPayload()
    const latestSongs = payload?.latestSongs || []
    await setHomeCache(payload)
    bustHomeDataApiCache()

    // Verify the cache was actually written by reading it back
    let cacheVerified = false
    try {
      const { getAdminDb } = await import('@/lib/admin-db')
      const adminDb = getAdminDb()
      if (adminDb) {
        const snap = await adminDb.collection('cache').doc('homePage').get()
        cacheVerified = snap.exists && Array.isArray(snap.data()?.data?.latestSongs)
      }
    } catch (_) {}

    return res.status(200).json({
      ok: true,
      cacheVerified,
      message: cacheVerified ? 'Home cache rebuilt and verified' : 'Payload built but cache write may have failed — check Admin SDK env vars',
      updatedAt: new Date().toISOString(),
      latestSongsCount: latestSongs.length,
      latestSongsPreview: latestSongs.slice(0, 5).map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist
      }))
    })
  } catch (e) {
    console.error('[rebuild-home-cache]', e?.message)
    return res.status(500).json({ error: e?.message || 'Failed to rebuild home cache' })
  }
}

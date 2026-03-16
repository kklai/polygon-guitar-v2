/**
 * Delete Firestore cache/artistPage_{artistId} so the next artist page load rebuilds from live data.
 * Use when quota prevented patch-caches from running (e.g. after renaming an artist).
 *
 * Auth: Bearer <idToken> (admin) or x-cron-secret header.
 * Query or body: id = artist doc id or slug (e.g. candy-王家晴 or Candy-王家晴).
 */

import { verifyAdmin } from '@/lib/firebase-admin'
import { getArtistByIdOrSlug } from '@/lib/tabs'

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

  const id = (req.query.id || req.body?.id || '').trim()
  if (!id) {
    return res.status(400).json({ error: 'Missing id (artist doc id or slug)' })
  }

  try {
    const artist = await getArtistByIdOrSlug(id)
    if (!artist?.id) {
      return res.status(404).json({ error: 'Artist not found', id })
    }

    const { getAdminDb } = await import('@/lib/admin-db')
    const adminDb = getAdminDb()
    if (!adminDb) {
      return res.status(503).json({ error: 'Admin DB not available' })
    }

    const ref = adminDb.collection('cache').doc(`artistPage_${artist.id}`)
    await ref.delete() // no get() first — saves 1 read; delete of missing doc is a no-op
    return res.status(200).json({
      ok: true,
      artistId: artist.id,
      deleted: true,
      message: 'Artist page cache cleared; next load will rebuild'
    })
  } catch (e) {
    const isQuota = e?.code === 8 || /quota|resource exhausted|RESOURCE_EXHAUSTED/i.test(e?.message || '')
    if (isQuota) {
      console.warn('[bust-artist-cache] skipped (quota exceeded):', e?.message)
      return res.status(200).json({
        ok: true,
        artistId: id,
        skipped: true,
        reason: 'quota_exceeded',
        message: 'Cache bust skipped (quota exceeded). Reload the artist page in a few minutes to see updates.'
      })
    }
    console.error('[bust-artist-cache]', e?.message)
    return res.status(500).json({ error: e?.message || 'Failed to bust cache' })
  }
}

/**
 * GET /api/home-data
 * Returns one JSON payload with all homepage data (settings, hot tabs, latest,
 * playlists, artists, categories, and preloaded songs for custom sections like 最新廣東歌).
 * Single round-trip for the client; all Firestore reads run on the server.
 */

import { getHomeData } from '@/lib/homeData'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const data = await getHomeData()
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    return res.status(200).json(data)
  } catch (e) {
    console.error('[api/home-data]', e?.message)
    return res.status(500).json({ error: 'Failed to load homepage data' })
  }
}

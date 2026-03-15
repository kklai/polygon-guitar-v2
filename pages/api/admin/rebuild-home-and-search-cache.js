/**
 * Rebuild both homepage and search Firestore caches in one run (single shared Firestore read).
 * Fetches tabs, artists, playlists, settings/home, settings/categoryImages once, then builds
 * both cache payloads and writes cache/homePage + cache/searchData. Saves a full DB read
 * compared to running rebuild-home-cache and rebuild-search-cache separately.
 *
 * Auth: Bearer <idToken> (admin) or x-cron-secret header (cron job).
 */

import { verifyAdmin } from '@/lib/firebase-admin'
import { doc, getDoc, collection, getDocs, query, orderBy } from '@/lib/firestore-tracked'
import { db } from '@/lib/firebase'
import { pacificTime } from '@/lib/logTime'
import {
  buildSearchDataPayloadFromSnapshots,
  setSearchCache,
  bustSearchDataApiCache
} from '@/lib/searchData'
import {
  buildHomeDataPayloadFromRaw,
  setHomeCache,
  bustHomeDataApiCache
} from '@/lib/homeData'

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
    const startMs = Date.now()
    console.log('[rebuild-home-and-search-cache] single fetch started', pacificTime())

    const [tabsSnap, artistsSnap, playlistsSnap, settingsDoc, categoryImagesDoc] = await Promise.all([
      getDocs(query(collection(db, 'tabs'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'artists'), orderBy('name'))),
      getDocs(collection(db, 'playlists')),
      getDoc(doc(db, 'settings', 'home')),
      getDoc(doc(db, 'settings', 'categoryImages'))
    ])

    const totalReads =
      tabsSnap.docs.length + artistsSnap.docs.length + playlistsSnap.docs.length +
      (settingsDoc?.exists ? 1 : 0) + (categoryImagesDoc?.exists ? 1 : 0)
    console.log(`[rebuild-home-and-search-cache] Firestore fetch done in ${Date.now() - startMs}ms — ${tabsSnap.docs.length} tabs, ${artistsSnap.docs.length} artists, ${playlistsSnap.docs.length} playlists (total reads: ${totalReads}) at ${pacificTime()}`)

    const searchPayload = buildSearchDataPayloadFromSnapshots(tabsSnap, artistsSnap, playlistsSnap)
    const homePayload = buildHomeDataPayloadFromRaw({
      tabsSnap,
      artistsSnap,
      playlistsSnap,
      settingsDoc,
      categoryImagesDoc
    })

    await Promise.all([
      setSearchCache(searchPayload),
      setHomeCache(homePayload)
    ])
    bustSearchDataApiCache()
    bustHomeDataApiCache()

    const latestSongs = homePayload?.latestSongs || []
    return res.status(200).json({
      ok: true,
      message: 'Home + search cache rebuilt (single read)',
      updatedAt: new Date().toISOString(),
      reads: totalReads,
      latestSongsCount: latestSongs.length,
      searchTabsCount: searchPayload?.tabs?.length ?? 0,
      searchArtistsCount: searchPayload?.artists?.length ?? 0
    })
  } catch (e) {
    console.error('[rebuild-home-and-search-cache]', e?.message)
    return res.status(500).json({ error: e?.message || 'Failed to rebuild home + search cache' })
  }
}

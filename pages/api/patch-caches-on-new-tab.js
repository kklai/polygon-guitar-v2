/**
 * POST /api/patch-caches-on-new-tab
 *
 * Incrementally patches Firestore cache docs when data changes,
 * instead of doing a full rebuild (~3,700 reads).
 *
 * Tab actions:
 *   { tab: { id, title, artist, ... }, action: 'create' | 'update' | 'delete' }
 *   Patches: searchData, homePage. Deletes: artistPage_{artistId}.
 *   (allTabs is skipped — it's only used by admin pages and is too large to patch safely.)
 *
 * Artist actions:
 *   { artist: { id, name, ... }, action: 'create-artist' | 'update-artist' }
 *   Patches: searchData (artists array). Deletes: artistPage_{id}.
 *
 * Auth: Bearer <idToken> (any logged-in user)
 * Cost: 2-3 reads + 2-3 writes per call, fire-and-forget from client.
 */

import { getAdminDb } from '@/lib/admin-db'
import { bustSearchDataApiCache } from '@/lib/searchData'
import { pacificTime } from '@/lib/logTime'

function resolveTabCoverImage(tab) {
  if (tab?.coverImage) return tab.coverImage
  if (tab?.albumImage) return tab.albumImage
  const videoId = tab?.youtubeVideoId ?? tab?.youtubeUrl?.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1]
  if (videoId) return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
  if (tab?.thumbnail) return tab.thumbnail
  return null
}

function toSearchTabSlim(tab) {
  return stripUndefined({
    id: tab.id,
    title: tab.title || '',
    artist: tab.artist || tab.artistName || '',
    composer: tab.composer || '',
    lyricist: tab.lyricist || '',
    arranger: tab.arranger || '',
    uploaderPenName: tab.uploaderPenName || '',
    arrangedBy: tab.arrangedBy || ''
  })
}

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

function toHomeSlim(tab) {
  const coverImage = resolveTabCoverImage(tab)
  return stripUndefined({
    id: tab.id,
    title: tab.title,
    artist: tab.artist ?? tab.artistName,
    artistId: tab.artistId,
    ...(coverImage ? { coverImage } : {})
  })
}

function toSearchArtistSlim(artist) {
  const regions = (artist.regions?.length > 0) ? artist.regions : (artist.region ? [artist.region] : [])
  return stripUndefined({
    id: artist.id,
    name: artist.name || '',
    photo: artist.photoURL || artist.wikiPhotoURL || null,
    artistType: artist.artistType || artist.gender || 'other',
    regions,
    displayOrder: artist.displayOrder ?? null,
    tier: artist.tier ?? 5,
    tabCount: artist.songCount || artist.tabCount || 0
  })
}

const MAX_CACHE_BYTES = 900 * 1024

async function patchCacheDoc(adminDb, docId, patchFn) {
  try {
    const startMs = Date.now()
    const ref = adminDb.collection('cache').doc(docId)
    const snap = await ref.get()
    if (!snap.exists) {
      console.log(`[patch-caches] cache/${docId} does not exist, skipping at ${pacificTime()}`)
      return false
    }

    const docData = snap.data()
    const payload = docData?.data
    if (!payload) {
      console.log(`[patch-caches] cache/${docId} has no data field, skipping at ${pacificTime()}`)
      return false
    }

    const patched = patchFn(payload)
    if (!patched) {
      console.log(`[patch-caches] cache/${docId} no changes needed (1 read, 0 writes) in ${Date.now() - startMs}ms at ${pacificTime()}`)
      return false
    }

    const size = JSON.stringify(patched).length
    if (size > MAX_CACHE_BYTES) {
      console.warn(`[patch-caches] cache/${docId} would be ${Math.round(size / 1024)}KB, skipping patch at ${pacificTime()}`)
      return false
    }

    const { FieldValue } = await import('firebase-admin/firestore')
    await ref.set({ data: patched, updatedAt: FieldValue.serverTimestamp() })
    console.log(`[patch-caches] cache/${docId} patched (1 read, 1 write, ${Math.round(size / 1024)}KB) in ${Date.now() - startMs}ms at ${pacificTime()}`)
    return true
  } catch (e) {
    console.error(`[patch-caches] failed to patch cache/${docId}: ${e?.message} at ${pacificTime()}`)
    return false
  }
}

async function deleteArtistPageCache(adminDb, artistId) {
  if (!artistId) return false
  try {
    const ref = adminDb.collection('cache').doc(`artistPage_${artistId}`)
    const snap = await ref.get()
    if (!snap.exists) return false
    await ref.delete()
    console.log(`[patch-caches] deleted cache/artistPage_${artistId} (1 read, 1 delete) at ${pacificTime()}`)
    return true
  } catch (e) {
    console.error(`[patch-caches] failed to delete artistPage_${artistId}: ${e?.message} at ${pacificTime()}`)
    return false
  }
}

async function handleTabAction(adminDb, tab, action) {
  const results = {}

  results.searchData = await patchCacheDoc(adminDb, 'searchData', (payload) => {
    const tabs = Array.isArray(payload.tabs) ? payload.tabs : []

    if (action === 'delete') {
      const filtered = tabs.filter(t => t.id !== tab.id)
      return filtered.length === tabs.length ? null : { ...payload, tabs: filtered }
    }
    const slim = toSearchTabSlim(tab)
    if (action === 'create') {
      return { ...payload, tabs: [slim, ...tabs] }
    }
    const idx = tabs.findIndex(t => t.id === tab.id)
    if (idx === -1) return null
    const updated = [...tabs]
    updated[idx] = { ...updated[idx], ...slim }
    return { ...payload, tabs: updated }
  })

  results.homePage = await patchCacheDoc(adminDb, 'homePage', (payload) => {
    if (action === 'delete') {
      const filterArr = (arr) => Array.isArray(arr) ? arr.filter(t => t.id !== tab.id) : arr
      const latestSongs = filterArr(payload.latestSongs)
      const hotTabs = filterArr(payload.hotTabs)
      const changed = latestSongs?.length !== payload.latestSongs?.length || hotTabs?.length !== payload.hotTabs?.length
      return changed ? { ...payload, latestSongs, hotTabs } : null
    }
    const slim = toHomeSlim(tab)
    if (action === 'create') {
      const latestSongs = Array.isArray(payload.latestSongs) ? payload.latestSongs : []
      return { ...payload, latestSongs: [slim, ...latestSongs].slice(0, 10) }
    }
    let changed = false
    const patchArray = (arr) => {
      if (!Array.isArray(arr)) return arr
      const idx = arr.findIndex(t => t.id === tab.id)
      if (idx === -1) return arr
      changed = true
      const updated = [...arr]
      updated[idx] = { ...updated[idx], ...slim }
      return updated
    }
    const patched = {
      ...payload,
      latestSongs: patchArray(payload.latestSongs),
      hotTabs: patchArray(payload.hotTabs)
    }
    return changed ? patched : null
  })

  const artistId = tab.artistId
  if (artistId) {
    results.artistPageDeleted = await deleteArtistPageCache(adminDb, artistId)
  }

  return results
}

async function handleArtistAction(adminDb, artist, action) {
  const results = {}

  results.searchData = await patchCacheDoc(adminDb, 'searchData', (payload) => {
    const slim = toSearchArtistSlim(artist)
    const artists = Array.isArray(payload.artists) ? payload.artists : []

    if (action === 'create-artist') {
      return { ...payload, artists: [...artists, slim] }
    }
    const idx = artists.findIndex(a => a.id === artist.id)
    if (idx === -1) return null
    const updated = [...artists]
    updated[idx] = { ...updated[idx], ...slim }
    return { ...payload, artists: updated }
  })

  results.artistPageDeleted = await deleteArtistPageCache(adminDb, artist.id)

  return results
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ') || authHeader.length < 20) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { tab, artist, action } = req.body || {}
  const validActions = ['create', 'update', 'delete', 'create-artist', 'update-artist']
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` })
  }

  const adminDb = getAdminDb()
  if (!adminDb) {
    console.warn('[patch-caches] Admin SDK not available')
    return res.status(500).json({ error: 'Admin SDK not available' })
  }

  const startMs = Date.now()
  let results

  if (action === 'create' || action === 'update' || action === 'delete') {
    if (!tab?.id) {
      return res.status(400).json({ error: 'Missing tab.id' })
    }
    results = await handleTabAction(adminDb, tab, action)
    console.log(`[patch-caches] ${action} tab ${tab.id} "${tab.title}" — searchData:${results.searchData}, homePage:${results.homePage}, artistPage:${results.artistPageDeleted ?? '-'} in ${Date.now() - startMs}ms at ${pacificTime()}`)
  } else {
    if (!artist?.id || !artist?.name) {
      return res.status(400).json({ error: 'Missing artist.id or artist.name' })
    }
    results = await handleArtistAction(adminDb, artist, action)
    console.log(`[patch-caches] ${action} artist ${artist.id} "${artist.name}" — searchData:${results.searchData}, artistPage:${results.artistPageDeleted ?? '-'} in ${Date.now() - startMs}ms at ${pacificTime()}`)
  }

  bustSearchDataApiCache()
  return res.status(200).json({ ok: true, results })
}

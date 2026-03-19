/**
 * GET /api/debug/tab-artist?tabId=xxx
 * Returns tab's artistId, artist doc lookup, and why the tab might not show on the artist page.
 * Auth: Bearer <idToken> (admin). Development only or admin-only.
 */

import { verifyAdmin } from '@/lib/firebase-admin'
import { doc, getDoc } from '@/lib/firestore-tracked'
import { db } from '@/lib/firebase'

const TABS_COLLECTION = 'tabs'
const ARTISTS_COLLECTION = 'artists'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Bearer token required (admin)' })
  }
  const decoded = await verifyAdmin(authHeader.slice(7))
  if (!decoded) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const tabId = (req.query.tabId || req.query.id || '').trim()
  if (!tabId) {
    return res.status(400).json({ error: 'Missing tabId (e.g. ?tabId=G5IIyUTQTq3Qu2OZavLE)' })
  }

  res.setHeader('Cache-Control', 'private, no-store, max-age=0')

  try {
    const tabRef = doc(db, TABS_COLLECTION, tabId)
    const tabSnap = await getDoc(tabRef)
    if (!tabSnap.exists()) {
      return res.status(404).json({ error: 'Tab not found', tabId })
    }

    const tab = tabSnap.data()
    const payload = {
      tabId,
      tab: {
        title: tab.title,
        artistId: tab.artistId ?? null,
        artist: tab.artist ?? null,
        artistName: tab.artistName ?? null,
        collaboratorIds: tab.collaboratorIds ?? []
      },
      artistDoc: null,
      queryIdUsedByArtistPage: null,
      match: false,
      reason: ''
    }

    if (!tab.artistId) {
      payload.reason = 'Tab has no artistId.'
      return res.status(200).json(payload)
    }

    let artistSnap = await getDoc(doc(db, ARTISTS_COLLECTION, tab.artistId))
    if (!artistSnap.exists() && tab.artistId !== tab.artistId.toLowerCase()) {
      artistSnap = await getDoc(doc(db, ARTISTS_COLLECTION, tab.artistId.toLowerCase()))
    }

    if (!artistSnap.exists()) {
      payload.reason = `No artist document with id "${tab.artistId}" (or lowercase). Create the artist or set this tab's artistId to an existing artist doc id.`
      return res.status(200).json(payload)
    }

    const artistData = artistSnap.data()
    const artistDocId = artistSnap.id
    const queryId = artistData.normalizedName || artistDocId
    const match = tab.artistId === queryId || tab.artistId === artistDocId

    payload.artistDoc = {
      id: artistDocId,
      name: artistData.name,
      normalizedName: artistData.normalizedName ?? null
    }
    payload.queryIdUsedByArtistPage = queryId
    payload.match = match

    if (!match) {
      payload.reason = `Artist page queries artistId == "${queryId}" but this tab has artistId == "${tab.artistId}". Set tab.artistId to "${artistDocId}" to fix.`
    } else {
      payload.reason = 'Tab artistId matches artist doc. Should appear on artist page. If not, clear artist page cache (edit artist → 清除歌手頁快取).'
    }

    return res.status(200).json(payload)
  } catch (e) {
    console.error('[debug/tab-artist]', e?.message)
    return res.status(500).json({ error: e?.message || 'Failed to check tab' })
  }
}

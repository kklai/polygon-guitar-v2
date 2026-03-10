/**
 * Playlist page cache: one Firestore doc per playlist (cache/playlist_{id}).
 * When warm, playlist page = 1 read (plus 1 for checkIsPlaylistSaved when logged in).
 * TTL 10 min. Write via Admin only (cache collection rules).
 */

import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const CACHE_TTL_MS = 10 * 60 * 1000 // 10 min
const CACHE_COLLECTION = 'cache'

function cacheDocId(playlistId) {
  return `playlist_${playlistId}`
}

/**
 * Read playlist page cache. Uses client SDK (allowed by rules). Call from getStaticProps or API.
 * @param {string} playlistId
 * @returns {Promise<{ playlist: object, songs: array, uniqueArtists: array, otherPlaylists: { auto: array, manual: array } } | null>}
 */
export async function getPlaylistPageCache(playlistId) {
  if (!playlistId) return null
  try {
    const ref = doc(db, CACHE_COLLECTION, cacheDocId(playlistId))
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    const data = snap.data()
    const expiresAt = data.expiresAt?.toDate
      ? data.expiresAt.toDate()
      : data.expiresAt
        ? new Date(data.expiresAt)
        : null
    if (!expiresAt || expiresAt.getTime() < Date.now()) return null
    return data.payload || null
  } catch (e) {
    console.error('[playlistPageCache] get', e?.message)
    return null
  }
}

function serializePayload(obj) {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v))
  )
}

/**
 * Write playlist page cache. Uses Admin SDK so cache collection can be read-only for client.
 * Payload is serialized (Timestamps → ISO strings) for consistent reads.
 * @param {string} playlistId
 * @param {object} payload - { playlist, songs, uniqueArtists, otherPlaylists }
 */
export async function setPlaylistPageCache(playlistId, payload) {
  if (!playlistId || !payload) return
  try {
    const { getAdminDb } = await import('@/lib/admin-db')
    const adminDb = getAdminDb()
    if (!adminDb) return
    const { FieldValue } = await import('firebase-admin/firestore')
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS)
    const serialized = serializePayload(payload)
    await adminDb.collection(CACHE_COLLECTION).doc(cacheDocId(playlistId)).set({
      payload: serialized,
      expiresAt: expiresAt.toISOString(),
      updatedAt: FieldValue.serverTimestamp()
    })
  } catch (e) {
    console.error('[playlistPageCache] set', e?.message)
  }
}

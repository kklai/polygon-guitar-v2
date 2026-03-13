/**
 * Artist page cache: one Firestore doc per artist (cache/artistPage_{id}).
 * When warm, artist page = 1 read (cache doc has artist + hotTabs + allTabs slim).
 * TTL 10 min. Write via Admin only (cache collection rules).
 */

import { doc, getDoc } from '@/lib/firestore-tracked'
import { db } from '@/lib/firebase'

const CACHE_TTL_MS = 365 * 24 * 60 * 60 * 1000 // ~forever (bust on write)
const CACHE_COLLECTION = 'cache'

function cacheDocId(artistId) {
  return `artistPage_${artistId}`
}

/**
 * Read artist page cache. Uses client SDK (allowed by rules). Call from getStaticProps or API.
 * @param {string} artistId - Firestore artist document id
 * @returns {Promise<{ artist: object, hotTabs: array, allTabs: array } | null>}
 */
export async function getArtistPageCache(artistId) {
  if (!artistId) return null
  try {
    const ref = doc(db, CACHE_COLLECTION, cacheDocId(artistId))
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
    console.error('[artistPageCache] get', e?.message)
    return null
  }
}

function serializePayload(obj) {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v))
  )
}

/**
 * Write artist page cache. Uses Admin SDK so cache collection can be read-only for client.
 * Payload is serialized (Timestamps → ISO strings). Tabs must already be slim (no content).
 * @param {string} artistId
 * @param {object} payload - { artist, hotTabs, allTabs }
 */
export async function setArtistPageCache(artistId, payload) {
  if (!artistId || !payload) return
  try {
    const { getAdminDb } = await import('@/lib/admin-db')
    const adminDb = getAdminDb()
    if (!adminDb) return
    const { FieldValue } = await import('firebase-admin/firestore')
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS)
    const serialized = serializePayload(payload)
    await adminDb.collection(CACHE_COLLECTION).doc(cacheDocId(artistId)).set({
      payload: serialized,
      expiresAt: expiresAt.toISOString(),
      updatedAt: FieldValue.serverTimestamp()
    })
  } catch (e) {
    console.error('[artistPageCache] set', e?.message)
  }
}

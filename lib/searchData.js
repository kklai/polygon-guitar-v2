/**
 * Search page data: full tabs + artists payload for client-side search/filter.
 * Stored in Firestore at cache/searchData, TTL 10 min. Each search-data API call = 1 read when cache is fresh.
 */

import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const CACHE_TTL_MS = 10 * 60 * 1000 // 10 min

function isPermissionError(e) {
  const msg = e?.message || String(e)
  return /permission|Permission/i.test(msg) || msg.includes('PERMISSION_DENIED')
}

/**
 * Write search payload to Firestore cache. Prefers Admin SDK so we don't need public write rules.
 */
export async function setSearchCache(payload) {
  try {
    const { getAdminDb } = await import('@/lib/admin-db')
    const adminDb = getAdminDb()
    if (adminDb) {
      const { FieldValue } = await import('firebase-admin/firestore')
      await adminDb.collection('cache').doc('searchData').set({
        data: payload,
        updatedAt: FieldValue.serverTimestamp()
      })
      return
    }
  } catch (e) {
    console.error('[searchData] setSearchCache via Admin failed', e?.message)
  }
  const ref = doc(db, 'cache', 'searchData')
  await setDoc(ref, { data: payload, updatedAt: serverTimestamp() })
}

/**
 * Build search payload from live Firestore (all tabs + all artists). ~3.7k+ reads.
 * Tabs: only fields needed for search (title, artist, composer, lyricist, arranger, uploaderPenName).
 * Artists: id, name, photo, plus type/region/counts for artists list page (same cache, 1 read when fresh).
 */
export async function buildSearchDataPayload() {
  const [tabsSnap, artistsSnap] = await Promise.all([
    getDocs(query(collection(db, 'tabs'), orderBy('createdAt', 'desc'))),
    getDocs(query(collection(db, 'artists'), orderBy('name')))
  ])

  // Slim lists for search/filter only. 熱門/分類圖片 come from home-data.
  const tabs = tabsSnap.docs.map(docSnap => {
    const d = docSnap.data()
    return {
      id: docSnap.id,
      title: d.title || '',
      artist: d.artist || d.artistName || '',
      composer: d.composer || '',
      lyricist: d.lyricist || '',
      arranger: d.arranger || '',
      uploaderPenName: d.uploaderPenName || ''
    }
  })

  // Artist list page: 排序用 displayOrder（拖曳次序）→ tier → 譜數
  const artists = artistsSnap.docs.map(docSnap => {
    const d = docSnap.data()
    const count = d.songCount || d.tabCount || 0
    return {
      id: docSnap.id,
      name: d.name || '',
      photo: d.photoURL || d.wikiPhotoURL || null,
      artistType: d.artistType || d.gender || 'other',
      region: d.region || null,
      regions: d.regions || [],
      displayOrder: d.displayOrder ?? null,
      tier: d.tier ?? 5,
      tabCount: count
    }
  })

  return { tabs, artists }
}

/**
 * Get search data: 1 Firestore read when cache is fresh (< 10 min).
 * On cache miss or stale, builds payload, writes cache, returns. Optionally serves stale and revalidates in background.
 */
export async function getSearchData() {
  const cacheRef = doc(db, 'cache', 'searchData')
  let snap = null
  try {
    snap = await getDoc(cacheRef)
  } catch (e) {
    if (isPermissionError(e)) {
      console.warn('[searchData] Cache read not allowed. Building payload.')
    } else {
      throw e
    }
  }

  const now = Date.now()
  if (snap?.exists()) {
    const d = snap.data()
    const updatedAt = d?.updatedAt
    const data = d?.data
    if (data && updatedAt && typeof updatedAt.toMillis === 'function') {
      const age = now - updatedAt.toMillis()
      if (age <= CACHE_TTL_MS) {
        return data
      }
      // Stale: return stale data and revalidate in background
      setImmediate(() => {
        buildSearchDataPayload()
          .then((payload) => setSearchCache(payload))
          .catch((err) => console.error('[searchData] background revalidate failed', err))
      })
      return data
    }
  }

  // No cache or invalid: build, write (best-effort), return
  const payload = await buildSearchDataPayload()
  const payloadSize = typeof payload === 'object' ? JSON.stringify(payload).length : 0
  if (payloadSize <= 900 * 1024) {
    setSearchCache(payload).catch((err) => console.error('[searchData] setSearchCache failed', err?.message))
  } else {
    console.warn('[searchData] Payload too large for cache (~', Math.round(payloadSize / 1024), 'KB)')
  }
  return payload
}

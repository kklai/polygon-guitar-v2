/**
 * Search page data: full tabs + artists payload for client-side search/filter.
 * Stored in Firestore at cache/searchData, TTL 24h. Each search-data API call = 1 read when cache is fresh.
 * Full query runs at most once per day (or when admin triggers rebuild).
 */

import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function isPermissionError(e) {
  const msg = e?.message || String(e)
  return /permission|Permission/i.test(msg) || msg.includes('PERMISSION_DENIED')
}

/**
 * Write search payload to Firestore cache. Uses Admin SDK only (client cannot write to cache/ by design).
 * If FIREBASE_ADMIN_* env vars are not set, write is skipped and a one-time warning is logged.
 */
let _warnedNoAdmin = false
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
      console.log('[searchData] cache written (searchData)')
      return
    }
  } catch (e) {
    console.error('[searchData] setSearchCache via Admin failed', e?.message)
    return
  }
  if (!_warnedNoAdmin) {
    _warnedNoAdmin = true
    console.warn('[searchData] Cache write skipped. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY in .env.local to enable search cache writes.')
  }
}

/**
 * Build search payload from live Firestore (all tabs + all artists). ~3.7k+ reads.
 * Tabs: only fields needed for search (title, artist, composer, lyricist, arranger, uploaderPenName).
 * Artists: id, name, photo, type, regions (normalised from region/regions), counts for artists list page (same cache, 1 read when fresh).
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
  // Normalise region/regions into a single regions array so list filter works (many artists only have region set)
  const artists = artistsSnap.docs.map(docSnap => {
    const d = docSnap.data()
    const count = d.songCount || d.tabCount || 0
    const regions = (d.regions && d.regions.length > 0) ? d.regions : (d.region ? [d.region] : [])
    return {
      id: docSnap.id,
      name: d.name || '',
      photo: d.photoURL || d.wikiPhotoURL || null,
      artistType: d.artistType || d.gender || 'other',
      regions,
      displayOrder: d.displayOrder ?? null,
      tier: d.tier ?? 5,
      tabCount: count
    }
  })

  return { tabs, artists }
}

/**
 * Get search data: 1 Firestore read when cache is fresh (< 24h).
 * On cache miss or stale, builds payload, writes cache, returns. Optionally serves stale and revalidates in background.
 * @param {{ includeCacheStatus?: boolean }} opts - If includeCacheStatus is true, returns { data, cacheStatus: 'hit'|'miss'|'stale' }.
 */
export async function getSearchData(opts = {}) {
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
      const ageMs = now - updatedAt.toMillis()
      const ageMin = Math.round(ageMs / 60000)
      if (ageMs <= CACHE_TTL_MS) {
        console.log('[searchData] cache hit (age %d min, 1 read)', ageMin)
        if (opts.includeCacheStatus) return { data, cacheStatus: 'hit' }
        return data
      }
      console.log('[searchData] cache stale (age %d min), serving stale + revalidating in background', ageMin)
      setImmediate(() => {
        buildSearchDataPayload()
          .then((payload) => setSearchCache(payload))
          .catch((err) => console.error('[searchData] background revalidate failed', err))
      })
      if (opts.includeCacheStatus) return { data, cacheStatus: 'stale' }
      return data
    }
    console.log('[searchData] cache doc exists but invalid (missing data or updatedAt)')
  } else {
    console.log('[searchData] cache miss (no doc or read failed), building payload...')
  }

  const payload = await buildSearchDataPayload()
  const payloadSize = typeof payload === 'object' ? JSON.stringify(payload).length : 0
  if (payloadSize <= 900 * 1024) {
    setSearchCache(payload).catch((err) => console.error('[searchData] setSearchCache failed', err?.message))
  } else {
    console.warn('[searchData] Payload too large for cache (~', Math.round(payloadSize / 1024), 'KB)')
  }
  if (opts.includeCacheStatus) return { data: payload, cacheStatus: 'miss' }
  return payload
}

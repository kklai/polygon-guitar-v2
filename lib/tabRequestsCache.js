/**
 * Tab requests list cache. Stored at cache/tabRequestsList.
 * GET /api/tab-requests = 1 read when warm. Cache is updated on every add/vote/delete/edit via POST /api/tab-requests/refresh.
 */

const CACHE_DOC_ID = 'tabRequestsList'

function serializeRequest(d) {
  const createdAt =
    typeof d.createdAt === 'number' ? d.createdAt
    : d.createdAt?.toMillis?.() ?? d.createdAt?.toDate?.()?.getTime?.() ?? null
  const fulfilledAt =
    typeof d.fulfilledAt === 'number' ? d.fulfilledAt
    : d.fulfilledAt?.toMillis?.() ?? d.fulfilledAt?.toDate?.()?.getTime?.() ?? null
  return {
    id: d.id,
    songTitle: d.songTitle || '',
    artistName: d.artistName || '',
    albumImage: d.albumImage || null,
    albumName: d.albumName || null,
    youtubeUrl: d.youtubeUrl || null,
    searchSource: d.searchSource || null,
    requestedBy: d.requestedBy || null,
    requesterName: d.requesterName || null,
    requesterPhoto: d.requesterPhoto || null,
    voteCount: d.voteCount ?? 0,
    voters: Array.isArray(d.voters) ? d.voters : [],
    status: d.status || 'pending',
    fulfilledBy: d.fulfilledBy || null,
    fulfilledByName: d.fulfilledByName || null,
    fulfilledAt,
    tabId: d.tabId || null,
    createdAt,
  }
}

/**
 * Build full list from Firestore (Admin). Used on cold cache. N reads.
 */
export async function buildTabRequestsPayload() {
  try {
    const { getAdminDb } = await import('@/lib/admin-db')
    const adminDb = getAdminDb?.()
    if (!adminDb) return []
    const snap = await adminDb.collection('tabRequests').orderBy('voteCount', 'desc').get()
    const list = snap.docs.map((docSnap) => {
      const d = docSnap.data()
      return serializeRequest({ id: docSnap.id, ...d })
    })
    list.sort((a, b) => {
      if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount
      return (b.createdAt || 0) - (a.createdAt || 0)
    })
    return list
  } catch (e) {
    console.error('[tabRequestsCache] buildTabRequestsPayload:', e?.message)
    return []
  }
}

/**
 * Get cached list. Returns null if missing/stale or on error. 1 read.
 */
export async function getTabRequestsCache() {
  try {
    const { getAdminDb } = await import('@/lib/admin-db')
    const adminDb = getAdminDb?.()
    if (!adminDb) return null
    const ref = adminDb.collection('cache').doc(CACHE_DOC_ID)
    const snap = await ref.get()
    if (!snap.exists) return null
    const data = snap.data()
    const list = data?.list
    return Array.isArray(list) ? list : null
  } catch (e) {
    console.error('[tabRequestsCache] getTabRequestsCache:', e?.message)
    return null
  }
}

/**
 * Write cache (Admin). 1 write.
 */
export async function setTabRequestsCache(list) {
  try {
    const { getAdminDb } = await import('@/lib/admin-db')
    const adminDb = getAdminDb?.()
    if (!adminDb) return
    const { FieldValue } = await import('firebase-admin/firestore')
    await adminDb.collection('cache').doc(CACHE_DOC_ID).set({
      list,
      updatedAt: FieldValue.serverTimestamp(),
    })
  } catch (e) {
    console.error('[tabRequestsCache] setTabRequestsCache:', e?.message)
  }
}

/**
 * Merge a delta into the cached list and write back. 1 read + 1 write.
 */
export async function mergeTabRequestsCache(payload) {
  const list = await getTabRequestsCache()
  const next = list ? [...list] : []
  const { action, id, doc: docData, voteCount, voters, songTitle, artistName } = payload || {}

  if (action === 'add' && docData) {
    const createdAt =
      docData.createdAt instanceof Date ? docData.createdAt.getTime()
      : typeof docData.createdAt === 'number' ? docData.createdAt
      : Date.now()
    const item = serializeRequest({ ...docData, createdAt })
    next.push(item)
    next.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0) || ((b.createdAt || 0) - (a.createdAt || 0)))
  } else if (action === 'vote' && id != null) {
    const idx = next.findIndex((r) => r.id === id)
    if (idx !== -1) {
      next[idx] = { ...next[idx], voteCount: voteCount ?? next[idx].voteCount, voters: Array.isArray(voters) ? voters : next[idx].voters }
      next.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0) || ((b.createdAt || 0) - (a.createdAt || 0)))
    }
  } else if (action === 'delete' && id) {
    const filtered = next.filter((r) => r.id !== id)
    next.length = 0
    next.push(...filtered)
  } else if (action === 'edit' && id != null) {
    const idx = next.findIndex((r) => r.id === id)
    if (idx !== -1) {
      if (songTitle !== undefined) next[idx].songTitle = songTitle
      if (artistName !== undefined) next[idx].artistName = artistName
    }
  }

  await setTabRequestsCache(next)
  return next
}

/**
 * Server-only: write Firestore cache docs using Admin SDK.
 * Import only from API routes or getServerSideProps to avoid pulling firebase-admin into client bundle.
 *
 * Firestore doc size limit is 1 MiB. allTabs payload can exceed that, so we split into
 * cache/allTabs_0, allTabs_1, ... and cache/allTabs_meta { partCount, updatedAt }.
 * Converts client-SDK Timestamps to Admin Timestamps so writes succeed.
 */

import { getAdminDb } from '@/lib/admin-db'

const MAX_DOC_BYTES = 900 * 1024 // stay under 1 MiB (1,048,576)

function toAdminSerializable(v, Timestamp) {
  if (v == null) return v
  if (typeof v.toMillis === 'function') return Timestamp.fromMillis(v.toMillis())
  if (typeof v.toDate === 'function') return Timestamp.fromDate(v.toDate())
  if (Array.isArray(v)) return v.map((x) => toAdminSerializable(x, Timestamp))
  if (typeof v === 'object' && v !== null && typeof v.toMillis !== 'function' && typeof v.toDate !== 'function') {
    const out = {}
    for (const [k, val] of Object.entries(v)) out[k] = toAdminSerializable(val, Timestamp)
    return out
  }
  return v
}

export async function setAllTabsCacheAdmin(payload) {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Admin DB not available')
  const { FieldValue, Timestamp } = await import('firebase-admin/firestore')
  const rawArr = Array.isArray(payload) ? payload : []
  const arr = rawArr.map((tab) => toAdminSerializable(tab, Timestamp))
  const parts = []
  let chunk = []
  let chunkSize = 0
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]
    const itemSize = Buffer.byteLength(JSON.stringify(item), 'utf8')
    if (chunk.length > 0 && chunkSize + itemSize > MAX_DOC_BYTES) {
      parts.push(chunk)
      chunk = []
      chunkSize = 0
    }
    chunk.push(item)
    chunkSize += itemSize
  }
  if (chunk.length > 0) parts.push(chunk)

  const cacheCol = adminDb.collection('cache')
  if (parts.length === 0) {
    await cacheCol.doc('allTabs_meta').set({
      partCount: 0,
      updatedAt: FieldValue.serverTimestamp()
    })
    return
  }

  for (let p = 0; p < parts.length; p++) {
    await cacheCol.doc(`allTabs_${p}`).set({
      data: parts[p],
      updatedAt: FieldValue.serverTimestamp()
    })
  }
  await cacheCol.doc('allTabs_meta').set({
    partCount: parts.length,
    updatedAt: FieldValue.serverTimestamp()
  })
}

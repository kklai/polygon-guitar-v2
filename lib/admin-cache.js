/**
 * Server-only: write Firestore cache docs using Admin SDK.
 * Import only from API routes or getServerSideProps to avoid pulling firebase-admin into client bundle.
 */

import { getAdminDb } from '@/lib/admin-db'

export async function setAllTabsCacheAdmin(payload) {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Admin DB not available')
  const { FieldValue } = await import('firebase-admin/firestore')
  await adminDb.collection('cache').doc('allTabs').set({
    data: payload,
    updatedAt: FieldValue.serverTimestamp()
  })
}

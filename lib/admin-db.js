/**
 * Firebase Admin SDK – server only. Use for cache writes so we don't need public write rules.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

let _adminDb = null

export function getAdminDb() {
  if (_adminDb) return _adminDb
  if (typeof window !== 'undefined') return null
  try {
    if (getApps().length === 0) {
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
      if (privateKey && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PROJECT_ID) {
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey
          })
        })
      } else {
        initializeApp()
      }
    }
    _adminDb = getFirestore()
    return _adminDb
  } catch (e) {
    console.error('[admin-db]', e?.message)
    return null
  }
}

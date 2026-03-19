/**
 * GET: Resolve 出譜者名稱 (penName) to a profile page id.
 * Always matches by penName: if any user doc (authed account or placeholder) has that penName, return its id.
 * If no user has that penName, return { id: null } — tab page shows arranger name with no link.
 *
 * Query: ?penName=Kermit%20Tam
 * Response: { id: "actual-uid-or-pen-xxx" } or { id: null }
 */

import { getAdminDb } from '@/lib/admin-db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const penName = typeof req.query.penName === 'string' ? req.query.penName.trim() : ''
  if (!penName) {
    return res.status(400).json({ error: 'penName query required' })
  }

  try {
    const adminDb = getAdminDb()
    if (adminDb) {
      const snap = await adminDb.collection('users').where('penName', '==', penName).limit(1).get()
      if (!snap.empty) {
        const doc = snap.docs[0]
        return res.status(200).json({ id: doc.id })
      }
    }
    return res.status(200).json({ id: null })
  } catch (e) {
    console.error('[resolve-pen-name]', e?.message)
    return res.status(500).json({ error: e?.message || 'Failed to resolve' })
  }
}

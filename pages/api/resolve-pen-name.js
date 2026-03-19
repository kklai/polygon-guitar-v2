/**
 * GET: Resolve 出譜者名稱 (penName) to a profile page id.
 * - If a user doc (real or placeholder) has that penName, return its id.
 * - Else return the placeholder id (pen-<hash>) so the tab can link to it.
 *
 * Query: ?penName=Kermit%20Tam
 * Response: { id: "actual-uid-or-pen-xxx" }
 */

import { getAdminDb } from '@/lib/admin-db'
import crypto from 'crypto'

function getPlaceholderUserId(penName) {
  if (!penName || typeof penName !== 'string') return null
  const trimmed = penName.trim()
  if (!trimmed) return null
  const hash = crypto.createHash('md5').update(trimmed, 'utf8').digest('hex').slice(0, 20)
  return `pen-${hash}`
}

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
    const fallbackId = getPlaceholderUserId(penName)
    return res.status(200).json({ id: fallbackId || null })
  } catch (e) {
    console.error('[resolve-pen-name]', e?.message)
    return res.status(500).json({ error: e?.message || 'Failed to resolve' })
  }
}

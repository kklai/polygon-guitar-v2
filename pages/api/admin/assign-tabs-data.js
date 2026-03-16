/**
 * GET: Return users and slim tabs for the "樂譜移植" admin page.
 * Auth: Bearer token (admin).
 */

import { verifyAdmin } from '@/lib/firebase-admin'
import { getAdminDb } from '@/lib/admin-db'
import { getAllTabs } from '@/lib/tabs'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Bearer token required' })
  }
  const token = authHeader.slice(7)
  const decoded = await verifyAdmin(token)
  if (!decoded) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const [tabs, adminDb] = await Promise.all([getAllTabs(), Promise.resolve(getAdminDb())])

    let users = []
    if (adminDb) {
      const usersSnap = await adminDb.collection('users').get()
      users = usersSnap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          displayName: data.displayName || '',
          penName: data.penName || '',
          email: data.email || ''
        }
      })
    }

    return res.status(200).json({
      users,
      tabs: tabs || []
    })
  } catch (e) {
    console.error('[assign-tabs-data]', e?.message)
    return res.status(500).json({ error: e?.message || 'Failed to load data' })
  }
}

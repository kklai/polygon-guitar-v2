/**
 * POST: Batch assign tabs to a user (set createdBy so tabs show on that user's profile
 * and the "出譜者" link goes to their profile).
 *
 * Body: { tabIds: string[], targetUserId: string | null, updatePenName?: boolean }
 * - targetUserId: user UID to assign; null/empty = clear createdBy (unlink from any profile).
 * - updatePenName: if true and targetUserId set, set each tab's uploaderPenName to the user's penName/displayName.
 *
 * Auth: Bearer token (admin). On success, rebuilds allTabs cache.
 */

import { verifyAdmin } from '@/lib/firebase-admin'
import { getAdminDb } from '@/lib/admin-db'
import { buildAllTabsSlim } from '@/lib/tabs'
import { setAllTabsCacheAdmin } from '@/lib/admin-cache'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
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

  let tabIds = req.body?.tabIds
  const targetUserId = req.body?.targetUserId
  const updatePenName = !!req.body?.updatePenName

  if (!Array.isArray(tabIds) || tabIds.length === 0) {
    return res.status(400).json({ error: 'tabIds must be a non-empty array' })
  }
  tabIds = tabIds.filter(Boolean).map(String)

  const adminDb = getAdminDb()
  if (!adminDb) {
    return res.status(500).json({ error: 'Admin DB not available' })
  }

  const { FieldValue } = await import('firebase-admin/firestore')
  const tabsRef = adminDb.collection('tabs')

  let userPenName = null
  if (targetUserId && updatePenName) {
    const userSnap = await adminDb.collection('users').doc(targetUserId).get()
    if (userSnap.exists()) {
      const d = userSnap.data()
      userPenName = (d.penName || d.displayName || '').trim() || null
    }
  }

  const clearCreatedBy = targetUserId == null || targetUserId === ''

  const results = { successCount: 0, failed: [] }

  for (const id of tabIds) {
    try {
      const ref = tabsRef.doc(id)
      const snap = await ref.get()
      if (!snap.exists()) {
        results.failed.push({ id, error: 'Tab not found' })
        continue
      }

      const updates = {
        updatedAt: FieldValue.serverTimestamp()
      }

      if (clearCreatedBy) {
        updates.createdBy = FieldValue.delete()
      } else {
        updates.createdBy = targetUserId
      }

      if (updatePenName && userPenName != null) {
        updates.uploaderPenName = userPenName
      }

      await ref.update(updates)
      results.successCount += 1
    } catch (e) {
      results.failed.push({ id, error: e?.message || 'Update failed' })
    }
  }

  if (results.successCount > 0) {
    try {
      const payload = await buildAllTabsSlim()
      await setAllTabsCacheAdmin(payload)
      results.cacheRebuilt = true
    } catch (e) {
      console.error('[assign-tabs-to-user] cache rebuild failed', e?.message)
      results.cacheRebuilt = false
      results.cacheError = e?.message
    }
  }

  return res.status(200).json({
    ok: true,
    ...results
  })
}

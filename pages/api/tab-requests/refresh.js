/**
 * POST /api/tab-requests/refresh
 * Updates the tab-requests cache after a client-side write (add/vote/delete/edit). 1 read + 1 write.
 * Body: { action: 'add'|'vote'|'delete'|'edit', id?, doc?, voteCount?, voters?, songTitle?, artistName? }
 */
import { mergeTabRequestsCache } from '@/lib/tabRequestsCache'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
    const { action, id, doc: docData, voteCount, voters, songTitle, artistName } = body
    if (!action || !['add', 'vote', 'delete', 'edit'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' })
    }
    if (action === 'add' && !docData) {
      return res.status(400).json({ error: 'Missing doc for add' })
    }
    if ((action === 'vote' || action === 'delete' || action === 'edit') && !id) {
      return res.status(400).json({ error: 'Missing id' })
    }
    await mergeTabRequestsCache(body)
    return res.json({ ok: true })
  } catch (err) {
    console.error('[tab-requests/refresh] error:', err)
    return res.status(500).json({ error: 'Refresh failed', message: err?.message })
  }
}

import { clearTabCache } from '@/lib/tabs'

export default async function handler(req, res) {
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'Missing id' })

  try {
    clearTabCache(id)
    await res.revalidate(`/tabs/${id}`)
    return res.json({ revalidated: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to revalidate' })
  }
}

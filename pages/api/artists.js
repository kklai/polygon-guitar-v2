import { collection, getDocs, query } from 'firebase/firestore'
import { db } from '../../lib/firebase'

let cachedData = null
let cacheTime = 0
const SERVER_CACHE_TTL = 5 * 60 * 1000 // 5 min in-memory

export default async function handler(req, res) {
  const bust = req.query.bust === '1' || req.query.bust === 'true'
  if (bust) {
    cachedData = null
    cacheTime = 0
  }
  if (!bust && cachedData && Date.now() - cacheTime < SERVER_CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return res.json(cachedData)
  }

  const t0 = Date.now()
  const snapshot = await getDocs(query(collection(db, 'artists')))
  const artists = snapshot.docs.map(doc => {
    const d = doc.data()
    const count = d.songCount || d.tabCount || 0
    return {
      id: doc.id,
      name: d.name,
      photoURL: d.photoURL || null,
      wikiPhotoURL: d.wikiPhotoURL || null,
      photo: d.photoURL || d.wikiPhotoURL || d.photo || null,
      artistType: d.artistType || d.gender || 'other',
      gender: d.gender || null,
      region: d.region || null,
      regions: d.regions || [],
      totalViewCount: d.totalViewCount || 0,
      viewCount: d.viewCount || 0,
      songCount: count,
      tabCount: count,
      spotifyFollowers: d.spotifyFollowers || 0,
      spotifyPopularity: d.spotifyPopularity || 0,
      normalizedName: d.normalizedName || null
    }
  })

  cachedData = artists
  cacheTime = Date.now()

  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  return res.json(artists)
}

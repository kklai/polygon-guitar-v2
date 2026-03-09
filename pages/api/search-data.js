import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'

let cachedData = null
let cacheTime = 0
const SERVER_CACHE_TTL = 10 * 60 * 1000 // 10 min server-side

export default async function handler(req, res) {
  if (req.query.bust === '1' || req.query.bust === 'true') {
    cachedData = null
    cacheTime = 0
  }
  if (cachedData && Date.now() - cacheTime < SERVER_CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200')
    return res.json(cachedData)
  }

  try {
    const [tabsSnap, artistsSnap, categoryImagesSnap] = await Promise.all([
      getDocs(query(collection(db, 'tabs'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'artists'), orderBy('name'))),
      getDoc(doc(db, 'settings', 'categoryImages'))
    ])
    const categoryImages = categoryImagesSnap?.exists?.() ? categoryImagesSnap.data() : null

  const tabs = tabsSnap.docs.map(doc => {
    const d = doc.data()
    return {
      id: doc.id,
      title: d.title || '',
      artist: d.artist || d.artistName || '',
      originalKey: d.originalKey || '',
      youtubeVideoId: d.youtubeVideoId || d.youtubeUrl?.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1] || '',
      coverImage: d.coverImage || null,
      albumImage: d.albumImage || null,
      thumbnail: d.thumbnail || d.albumImage || '',
      youtubeUrl: d.youtubeUrl || null,
      composer: d.composer || '',
      lyricist: d.lyricist || '',
      arranger: d.arranger || '',
      uploaderPenName: d.uploaderPenName || '',
      viewCount: d.viewCount || 0,
      uploadYear: d.uploadYear || d.songYear || 0
    }
  })

  const artists = artistsSnap.docs.map(doc => {
    const d = doc.data()
    const count = d.songCount || d.tabCount || 0
    return {
      id: doc.id,
      name: d.name || '',
      photoURL: d.photoURL || null,
      wikiPhotoURL: d.wikiPhotoURL || null,
      artistType: d.artistType || d.gender || 'other',
      gender: d.gender || null,
      adminScore: d.adminScore || 0,
      viewCount: d.viewCount || 0,
      songCount: count,
      tabCount: count
    }
  })

  const hotTabs = [...tabs].sort((a, b) => b.viewCount - a.viewCount).slice(0, 12)
  const hotArtists = [...artists].sort((a, b) => b.viewCount - a.viewCount).slice(0, 12)

  cachedData = { tabs, artists, hotTabs, hotArtists, categoryImages }
  cacheTime = Date.now()

  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200')
  return res.json(cachedData)
  } catch (err) {
    console.error('search-data API error:', err)
    res.status(500).json({ error: 'Failed to load search data', message: err?.message })
  }
}

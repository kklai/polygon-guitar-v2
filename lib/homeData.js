/**
 * Server-side: build one JSON payload with all homepage data.
 * Use from getServerSideProps or GET /api/home-data for a single round-trip load.
 *
 * Home cache: full payload is stored in Firestore at cache/homePage, updated every 6h
 * (or on manual bust). Each homepage visit = 1 Firestore read when cache is fresh.
 */

import { doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  getPopularArtists,
  getHotTabs,
  getRecentTabs,
  getCategoryImages,
  getTabsByIds
} from '@/lib/tabs'
import { getAllActivePlaylists } from '@/lib/playlists'

const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

const DEFAULT_CATEGORIES = [
  { id: 'male', name: '男歌手', image: null, color: 'from-blue-900/80 to-black/80' },
  { id: 'female', name: '女歌手', image: null, color: 'from-pink-900/80 to-black/80' },
  { id: 'group', name: '組合', image: null, color: 'from-purple-900/80 to-black/80' }
]

function getCroppedWikiImage(url) {
  if (!url) return url
  if (url.includes('/thumb/')) {
    return url.replace(/\/\d+px-/, '/200px-')
  }
  return url
}

function serialize(obj) {
  return JSON.parse(
    JSON.stringify(obj, (_, v) =>
      v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v
    )
  )
}

/** Resolve one cover image URL (same priority as SongCard: coverImage → albumImage → YouTube thumb → thumbnail) */
function resolveTabCoverImage(tab) {
  if (tab?.coverImage) return tab.coverImage
  if (tab?.albumImage) return tab.albumImage
  const videoId = tab?.youtubeVideoId ?? tab?.youtubeUrl?.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1]
  if (videoId) return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
  if (tab?.thumbnail) return tab.thumbnail
  return null
}

/** Only fields needed for home SongCard: id, title, artist, artistId; one image — coverImage, or artistPhoto only when no cover (saves payload). */
function slimTabForHome(tab, photoMap) {
  if (!tab) return tab
  const coverImage = resolveTabCoverImage(tab)
  const artistPhoto =
    !coverImage && photoMap && (photoMap[tab.artistId] ?? photoMap[tab.artist] ?? photoMap[tab.artistName])
  return {
    id: tab.id,
    title: tab.title,
    artist: tab.artist ?? tab.artistName,
    artistId: tab.artistId,
    ...(coverImage ? { coverImage } : {}),
    ...(artistPhoto && typeof artistPhoto === 'string' ? { artistPhoto } : {})
  }
}

/** Only fields needed for home ArtistAvatar / link: id, name, one photo URL */
function slimArtistForHome(artist) {
  if (!artist) return artist
  return {
    id: artist.id,
    name: artist.name,
    photo: artist.photoURL ?? artist.wikiPhotoURL ?? artist.photo
  }
}

/** customPlaylistSections: omit playlistId when it equals id (client can use id as playlistId) */
function slimCustomPlaylistSections(sections) {
  if (!Array.isArray(sections)) return sections
  return sections.map((s) => {
    const out = { id: s.id, type: s.type }
    if (s.type === 'customPlaylist' && s.playlistId !== s.id) out.playlistId = s.playlistId
    if (s.type === 'playlistGroup') out.playlistIds = s.playlistIds
    if (s.title != null) out.title = s.title
    if (s.customLabel != null && s.customLabel !== '') out.customLabel = s.customLabel
    return out
  })
}

/** Section order: only include enabled when false (client treats missing as true) */
function slimSectionOrder(order) {
  if (!Array.isArray(order)) return order
  return order.map((s) => {
    const out = { id: s.id }
    if (s.customLabel != null && s.customLabel !== '') out.customLabel = s.customLabel
    if (s.enabled === false) out.enabled = false
    return out
  })
}

/** Only fields needed for home PlaylistCard: id, title, cover; description only when non-empty. */
function slimPlaylistForHome(playlist) {
  if (!playlist) return playlist
  const desc =
    typeof playlist.description === 'string' && playlist.description.trim()
      ? playlist.description.trim()
      : null
  return {
    id: playlist.id,
    title: playlist.title,
    coverImage: playlist.coverImage,
    ...(desc != null ? { description: desc } : {})
  }
}

/**
 * Write the full home payload to Firestore cache (used by rebuild and on first build).
 * Prefers Admin SDK so we don't need public write rules on cache/homePage.
 */
export async function setHomeCache(payload) {
  try {
    const { getAdminDb } = await import('@/lib/admin-db')
    const adminDb = getAdminDb()
    if (adminDb) {
      const { FieldValue } = await import('firebase-admin/firestore')
      await adminDb.collection('cache').doc('homePage').set({
        data: payload,
        updatedAt: FieldValue.serverTimestamp()
      })
      return
    }
  } catch (e) {
    console.error('[homeData] setHomeCache via Admin failed', e?.message)
  }
  const ref = doc(db, 'cache', 'homePage')
  await setDoc(ref, { data: payload, updatedAt: serverTimestamp() })
}

/**
 * Build homepage payload from live Firestore data (all reads happen here).
 * Returns a plain object suitable for JSON (Timestamps → ISO strings).
 */
export async function buildHomeDataPayload() {
  const [
    settingsDoc,
    popularArtistsData,
    playlistsData,
    recentTabsData,
    defaultHotTabsData,
    categoryImages
  ] = await Promise.all([
    getDoc(doc(db, 'settings', 'home')),
    getPopularArtists(30),
    getAllActivePlaylists(),
    getRecentTabs(10),
    getHotTabs(22),
    getCategoryImages()
  ])

  const settings = settingsDoc.exists() ? settingsDoc.data() : {}
  const autoPlaylistsData = playlistsData.auto || []
  const manualPlaylistsData = playlistsData.manual || []

  // Hot tabs (manual selection or default)
  const targetCount = Math.min(settings.hotTabs?.displayCount || 12, 100)
  let hotTabsData = defaultHotTabsData.slice(0, targetCount)
  if (settings.hotTabs?.useManual && settings.hotTabs?.manualSelection?.length > 0) {
    const manualIds = settings.hotTabs.manualSelection
      .map((t) => (typeof t === 'object' && t !== null ? t.id : t))
      .filter((id) => typeof id === 'string' && id.trim() !== '')
      .slice(0, 30)
    if (manualIds.length > 0) {
      const manualTabs = await getTabsByIds(manualIds)
      if (manualTabs.length >= targetCount) {
        hotTabsData = manualTabs.slice(0, targetCount)
      } else {
        const manualIdsSet = new Set(manualIds)
        const autoFill = defaultHotTabsData
          .filter((t) => !manualIdsSet.has(t.id))
          .slice(0, targetCount - manualTabs.length)
        hotTabsData = [...manualTabs, ...autoFill].slice(0, targetCount)
      }
    }
  }

  // Custom playlist sections: collect all song IDs per section, then one batch fetch
  const customSections = settings.customPlaylistSections || []
  const sectionSongIds = {} // { [sectionId]: string[] }
  const allCustomIds = new Set()
  customSections.forEach((section) => {
    if (section.type === 'customPlaylist' && section.playlistId) {
      const playlist =
        autoPlaylistsData.find((p) => p.id === section.playlistId) ||
        manualPlaylistsData.find((p) => p.id === section.playlistId)
      if (playlist?.songIds?.length) {
        sectionSongIds[section.id] = playlist.songIds
        playlist.songIds.forEach((id) => allCustomIds.add(id))
      }
    }
  })

  let customPlaylistSongs = {} // { [sectionId]: tab[] } — raw first, slim with photoMap after it's built
  if (allCustomIds.size > 0) {
    const fetched = await getTabsByIds(Array.from(allCustomIds))
    const byId = new Map(fetched.map((t) => [t.id, t]))
    Object.keys(sectionSongIds).forEach((sectionId) => {
      const ordered = (sectionSongIds[sectionId] || [])
        .map((id) => byId.get(id))
        .filter(Boolean)
      customPlaylistSongs[sectionId] = ordered
    })
  }

  // Missing artists for manual selection
  let popularArtists = popularArtistsData || []
  const rawManualSelection = Array.isArray(settings.manualSelection)
    ? settings.manualSelection
    : [
        ...(settings.manualSelection?.male || []),
        ...(settings.manualSelection?.female || []),
        ...(settings.manualSelection?.group || [])
      ]
  const manualArtistIds = rawManualSelection
    .map((item) => (typeof item === 'object' && item !== null ? item.id : item))
    .filter((id) => typeof id === 'string' && id.trim() !== '')
  if (manualArtistIds.length > 0) {
    const existingIds = new Set(popularArtists.map((a) => a.id))
    const missingIds = manualArtistIds.filter((id) => !existingIds.has(id))
    if (missingIds.length > 0) {
      const batchSize = 10
      const allMissing = []
      for (let i = 0; i < missingIds.length; i += batchSize) {
        const batch = missingIds.slice(i, i + batchSize)
        const q = query(
          collection(db, 'artists'),
          where('__name__', 'in', batch)
        )
        const snapshot = await getDocs(q)
        snapshot.docs.forEach((d) => {
          const data = d.data()
          allMissing.push({
            id: d.id,
            ...data,
            photo: data.photoURL || data.wikiPhotoURL || data.photo || null,
            tabCount: data.songCount || data.tabCount || 0
          })
        })
      }
      popularArtists = [...popularArtists, ...allMissing]
    }
  }

  const photoMap = {}
  popularArtists.forEach((artist) => {
    photoMap[artist.id] = artist.photoURL || artist.wikiPhotoURL || artist.photo || null
    if (artist.name) photoMap[artist.name] = photoMap[artist.id]
  })

  // Slim custom playlist songs now that we have photoMap (artist photo fallback on cards)
  for (const sectionId of Object.keys(customPlaylistSongs)) {
    customPlaylistSongs[sectionId] = customPlaylistSongs[sectionId].map((t) =>
      slimTabForHome(t, photoMap)
    )
  }

  const displayCount = settings.displayCount || 20
  const sortBy = settings.hotArtistSortBy || 'viewCount'
  const sortArtists = (artists) =>
    [...artists].sort((a, b) => {
      if (sortBy === 'tabCount') {
        return (b.songCount || b.tabCount || 0) - (a.songCount || a.tabCount || 0)
      }
      if (sortBy === 'adminScore') return (b.adminScore || 0) - (a.adminScore || 0)
      if (sortBy === 'mixed') {
        const scoreA =
          (a.viewCount || 0) * 0.5 +
          (a.songCount || a.tabCount || 0) * 30 +
          (a.adminScore || 0) * 200
        const scoreB =
          (b.viewCount || 0) * 0.5 +
          (b.songCount || b.tabCount || 0) * 30 +
          (b.adminScore || 0) * 200
        return scoreB - scoreA
      }
      const viewsA = a.viewCount || 0
      const viewsB = b.viewCount || 0
      if (viewsB !== viewsA) return viewsB - viewsA
      if ((b.adminScore || 0) !== (a.adminScore || 0)) return (b.adminScore || 0) - (a.adminScore || 0)
      return (b.songCount || b.tabCount || 0) - (a.songCount || a.tabCount || 0)
    })

  const sortedArtists = sortArtists(popularArtists)
  let manualIds = []
  if (Array.isArray(settings.manualSelection)) {
    manualIds = settings.manualSelection
  } else if (typeof settings.manualSelection === 'object' && settings.manualSelection) {
    manualIds = [
      ...(settings.manualSelection?.male || []),
      ...(settings.manualSelection?.female || []),
      ...(settings.manualSelection?.group || [])
    ]
  }
  const hasManualSelection = Array.isArray(settings.manualSelection)
    ? manualIds.length > 0
    : !!(settings.useManualSelection?.male || settings.useManualSelection?.female || settings.useManualSelection?.group)

  const getHotArtists = () => {
    if (hasManualSelection && manualIds.length > 0) {
      const manualArtists = manualIds
        .map((id) => popularArtists.find((a) => a.id === id))
        .filter(Boolean)
      const manualIdsSet = new Set(manualIds)
      const autoFill = sortedArtists
        .filter((a) => !manualIdsSet.has(a.id))
        .slice(0, displayCount - manualArtists.length)
      return [...manualArtists, ...autoFill].slice(0, displayCount)
    }
    return sortedArtists.slice(0, displayCount)
  }

  const artistPageSort = (artists) =>
    [...artists].sort((a, b) => {
      const scoreA = a.adminScore || a.viewCount || a.tabCount || 0
      const scoreB = b.adminScore || b.viewCount || b.tabCount || 0
      return scoreB - scoreA
    })

  const hotArtistsData = {
    all: getHotArtists().map(slimArtistForHome),
    male: artistPageSort(popularArtists.filter((a) => (a.artistType || a.gender) === 'male')).slice(0, 5).map(slimArtistForHome),
    female: artistPageSort(popularArtists.filter((a) => (a.artistType || a.gender) === 'female')).slice(0, 5).map(slimArtistForHome),
    group: artistPageSort(popularArtists.filter((a) => (a.artistType || a.gender) === 'group')).slice(0, 5).map(slimArtistForHome)
  }

  let processedCategories = DEFAULT_CATEGORIES.map((cat) => ({ ...cat }))
  if (categoryImages) {
    const artistMap = new Map(popularArtists.map((a) => [a.id, a]))
    processedCategories = DEFAULT_CATEGORIES.map((cat) => {
      const catData = categoryImages[cat.id]
      let imageUrl = null
      if (catData?.artistId && artistMap.has(catData.artistId)) {
        const artist = artistMap.get(catData.artistId)
        imageUrl = artist.photoURL || artist.wikiPhotoURL || artist.photo || catData.image || null
      } else if (catData?.image) {
        imageUrl = catData.image
      }
      if (imageUrl?.includes('wikipedia.org')) imageUrl = getCroppedWikiImage(imageUrl)
      return { ...cat, image: imageUrl }
    })
  }

  const totalViewCount = popularArtists.reduce((sum, a) => sum + (a.viewCount || 0), 0)
  return serialize({
    homeSettings: {
      ...settings,
      sectionOrder: slimSectionOrder(settings.sectionOrder) ?? settings.sectionOrder,
      customPlaylistSections: slimCustomPlaylistSections(settings.customPlaylistSections) ?? settings.customPlaylistSections
    },
    hotTabs: hotTabsData.map((t) => slimTabForHome(t, photoMap)),
    latestSongs: (recentTabsData || []).map((t) => slimTabForHome(t, photoMap)),
    autoPlaylists: autoPlaylistsData.length > 0 ? autoPlaylistsData.map(slimPlaylistForHome) : [],
    manualPlaylists: manualPlaylistsData.length > 0 ? manualPlaylistsData.map(slimPlaylistForHome) : [],
    hotArtists: hotArtistsData,
    categories: processedCategories,
    ...(totalViewCount > 0 ? { totalViewCount } : {}),
    customPlaylistSongs
  })
}

function isPermissionError(e) {
  const msg = e?.message || String(e)
  return /permission|Permission/i.test(msg) || msg.includes('PERMISSION_DENIED')
}

/**
 * Get homepage data: 1 Firestore read when cache is fresh (< 6h).
 * On cache miss or stale, builds payload, writes cache, returns. Optionally serves
 * stale and revalidates in background when cache exists but is expired.
 * If reading cache fails (e.g. rules not deployed for cache), falls back to full build.
 */
export async function getHomeData() {
  const cacheRef = doc(db, 'cache', 'homePage')
  let snap = null
  try {
    snap = await getDoc(cacheRef)
  } catch (e) {
    if (isPermissionError(e)) {
      console.warn('[homeData] Cache read not allowed (deploy firestore.rules with cache block?). Building payload.')
    } else {
      throw e
    }
  }

  const now = Date.now()
  if (snap?.exists()) {
    const d = snap.data()
    const updatedAt = d?.updatedAt
    const data = d?.data
    if (data && updatedAt && typeof updatedAt.toMillis === 'function') {
      const age = now - updatedAt.toMillis()
      if (age <= CACHE_TTL_MS) {
        return data
      }
      // Stale: return stale data and revalidate in background (do not await)
      setImmediate(() => {
        buildHomeDataPayload()
          .then((payload) => setHomeCache(payload))
          .catch((err) => console.error('[homeData] background revalidate failed', err))
      })
      return data
    }
  }

  // No cache or invalid: build, write (best-effort), return
  const payload = await buildHomeDataPayload()
  // Firestore doc limit 1 MiB; skip write if payload too large
  const payloadSize = typeof payload === 'object' ? JSON.stringify(payload).length : 0
  if (payloadSize <= 900 * 1024) {
    setHomeCache(payload).catch((err) => console.error('[homeData] setHomeCache failed', err?.message))
  } else {
    console.warn('[homeData] Payload too large for cache (~', Math.round(payloadSize / 1024), 'KB). Consider reducing hotTabs/latestSongs/customPlaylistSongs size.')
  }
  return payload
}

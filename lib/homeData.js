/**
 * Server-side: build one JSON payload with all homepage data.
 * Use from getServerSideProps or GET /api/home-data for a single round-trip load.
 */

import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  getPopularArtists,
  getHotTabs,
  getRecentTabs,
  getCategoryImages,
  getTabsByIds
} from '@/lib/tabs'
import { getAllActivePlaylists } from '@/lib/playlists'

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

/**
 * Fetch and process all homepage data in one go (server-side).
 * Returns a plain object suitable for JSON (Timestamps → ISO strings).
 */
export async function getHomeData() {
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

  let customPlaylistSongs = {} // { [sectionId]: tab[] }
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
      const scoreA = a.adminScore || a.totalViewCount || a.viewCount || a.tabCount || 0
      const scoreB = b.adminScore || b.totalViewCount || b.viewCount || b.tabCount || 0
      return scoreB - scoreA
    })

  const hotArtistsData = {
    all: getHotArtists(),
    male: artistPageSort(popularArtists.filter((a) => (a.artistType || a.gender) === 'male')).slice(0, 5),
    female: artistPageSort(popularArtists.filter((a) => (a.artistType || a.gender) === 'female')).slice(0, 5),
    group: artistPageSort(popularArtists.filter((a) => (a.artistType || a.gender) === 'group')).slice(0, 5)
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

  return serialize({
    homeSettings: {
      ...settings,
      sectionOrder: settings.sectionOrder,
      customPlaylistSections: settings.customPlaylistSections
    },
    hotTabs: hotTabsData,
    latestSongs: recentTabsData || [],
    autoPlaylists: autoPlaylistsData.length > 0 ? autoPlaylistsData : [],
    manualPlaylists: manualPlaylistsData.length > 0 ? manualPlaylistsData : [],
    hotArtists: hotArtistsData,
    artistPhotoMap: photoMap,
    categories: processedCategories,
    totalViewCount: popularArtists.reduce((sum, a) => sum + (a.viewCount || 0), 0),
    customPlaylistSongs
  })
}

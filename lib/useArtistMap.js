/**
 * Shared artist name resolution — uses the search-data cache (localStorage → CDN → Firestore)
 * so we never need extra Firestore reads for artist names.
 *
 * Usage (React hook):
 *   const { getArtistName, artistMap } = useArtistMap()
 *   // getArtistName(tab) returns the display name, resolving from artistId
 *
 * Usage (plain async, e.g. in event handlers or non-component code):
 *   const map = await fetchArtistMap()
 *   const name = map.get(artistDocId) || ''
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getTabArtistId } from '@/lib/tabs'

const SEARCH_CACHE_KEY = 'searchPageData'

let _sharedMap = null
let _fetchPromise = null

const ARTIST_MAP_INVALIDATE = 'pg-artist-map-invalidate'

/** 清除 artist map 快取並通知已掛載嘅組件重新拉 search-data artists */
export function clearArtistMapCache() {
  _sharedMap = null
  _fetchPromise = null
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(SEARCH_CACHE_KEY)
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent(ARTIST_MAP_INVALIDATE))
    } catch {}
  }
}

function readFromLocalStorage() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SEARCH_CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!Array.isArray(data.artists) || data.artists.length === 0) return null
    const map = new Map()
    data.artists.forEach(a => { if (a.id && a.name) map.set(a.id, a.name) })
    return map
  } catch { return null }
}

export async function fetchArtistMap() {
  if (_sharedMap && _sharedMap.size > 0) return _sharedMap

  const cached = readFromLocalStorage()
  if (cached && cached.size > 0) {
    _sharedMap = cached
    return _sharedMap
  }

  if (_fetchPromise) return _fetchPromise

  _fetchPromise = fetch('/api/search-data?only=artists')
    .then(r => r.json())
    .then(data => {
      const map = new Map()
      ;(data.artists || []).forEach(a => { if (a.id && a.name) map.set(a.id, a.name) })
      _sharedMap = map
      _fetchPromise = null
      return map
    })
    .catch(() => {
      _fetchPromise = null
      return _sharedMap || new Map()
    })

  return _fetchPromise
}

export function buildArtistMap(artists) {
  const map = new Map()
  if (Array.isArray(artists)) {
    artists.forEach(a => { if (a.id && a.name) map.set(a.id, a.name) })
  }
  return map
}

/**
 * Single source of truth: resolve display name from artistId via artistMap.
 * Only fall back to tab.artist / tab.artistName when map is empty (e.g. before load).
 * Uses getTabArtistId so both legacy (tab.artistId) and new (tab.artists / tab.artistIds) shape work.
 */
export function resolveArtistName(tab, artistMap) {
  if (!tab) return ''
  const artistId = getTabArtistId(tab)
  if (artistMap && artistId) {
    const name = artistMap.get(artistId) || artistMap.get(artistId.toLowerCase())
    if (name) return name
  }
  return tab.artist || tab.artistName || artistId || ''
}

/** 首頁 recentViews tab 項：用 artistIds + map 組副標題；兼容舊紀錄的 artist / artistId */
export function resolveRecentTabArtistLine(item, artistMap) {
  if (!item || item.type !== 'tab') return ''
  const map = artistMap && artistMap.size ? artistMap : new Map()
  let ids = Array.isArray(item.artistIds) ? item.artistIds.filter(Boolean) : []
  if (ids.length === 0 && item.artistId) ids = [item.artistId]
  const names = ids
    .map((id) => map.get(id) || map.get(String(id).toLowerCase()) || '')
    .filter(Boolean)
  if (names.length > 0) return names.join('/')
  return (item.artist || item.artistName || '').trim()
}

export function useArtistMap() {
  const [artistMap, setArtistMap] = useState(() => _sharedMap || new Map())
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const applyMap = (map, force) => {
      if (!mounted.current) return
      if (force || (map && map.size > 0)) {
        setArtistMap(map instanceof Map ? map : new Map(map))
      }
    }
    fetchArtistMap().then((map) => applyMap(map, false))
    const onInvalidate = () => {
      fetchArtistMap().then((map) => applyMap(map, true))
    }
    if (typeof window !== 'undefined') {
      window.addEventListener(ARTIST_MAP_INVALIDATE, onInvalidate)
    }
    return () => {
      mounted.current = false
      if (typeof window !== 'undefined') {
        window.removeEventListener(ARTIST_MAP_INVALIDATE, onInvalidate)
      }
    }
  }, [])

  const getArtistName = useCallback((tab) => resolveArtistName(tab, artistMap), [artistMap])

  return { artistMap, getArtistName }
}

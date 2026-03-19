/**
 * 搜尋頁「搜尋記錄」：localStorage 記錄用戶從搜尋點擊過的歌曲與歌手（最多 25 項）
 */

const STORAGE_KEY = 'pg_search_history'
const MAX_ENTRIES = 25

/**
 * @typedef {{ type: 'song', id: string, title: string, artistId?: string, thumbnail?: string, uploaderName?: string, viewedAt: number }} SearchHistorySong
 * @typedef {{ type: 'artist', id: string, name: string, photo?: string, viewedAt: number }} SearchHistoryArtist
 * @typedef {SearchHistorySong | SearchHistoryArtist} SearchHistoryEntry
 */

/**
 * 取得搜尋記錄（按時間新到舊）
 * @returns {SearchHistoryEntry[]}
 */
export function getSearchHistory() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const list = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    return list.length > MAX_ENTRIES ? list.slice(0, MAX_ENTRIES) : list
  } catch {
    return []
  }
}

/**
 * 記錄一次點擊歌曲
 * @param {{ id: string, title?: string, artistId?: string, thumbnail?: string, uploaderPenName?: string }} song
 */
export function addSearchHistorySong(song) {
  if (typeof window === 'undefined' || !song?.id) return
  try {
    const list = getSearchHistory().filter((e) => !(e.type === 'song' && e.id === song.id))
    const uploaderName = (song.uploaderPenName || '').trim() || null
    const entry = {
      type: 'song',
      id: song.id,
      title: song.title || '',
      artistId: song.artistId || '',
      thumbnail: song.thumbnail || null,
      uploaderName: uploaderName || undefined,
      viewedAt: Date.now(),
    }
    list.unshift(entry)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)))
  } catch (_) {}
}

/**
 * 為搜尋記錄內嘅歌曲條目補上縮圖並寫入 localStorage（Firebase 取到圖後只寫一次，之後都從 localStorage 讀）
 * @param {string} id - 歌曲/tab id
 * @param {string} thumbnail - 縮圖 URL
 */
export function updateSongEntryThumbnail(id, thumbnail) {
  if (typeof window === 'undefined' || !id || !thumbnail) return
  try {
    const list = getSearchHistory()
    const idx = list.findIndex((e) => e.type === 'song' && e.id === id)
    if (idx === -1) return
    list[idx] = { ...list[idx], thumbnail }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (_) {}
}

/**
 * 記錄一次點擊歌手
 * @param {{ id: string, name?: string, photoURL?: string, wikiPhotoURL?: string }} artist
 */
/**
 * 清除所有搜尋記錄
 */
export function clearSearchHistory() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (_) {}
}

/**
 * 刪除單一搜尋記錄
 * @param {string} type - 'song' | 'artist' | 'playlist'
 * @param {string} id
 */
export function removeSearchHistoryEntry(type, id) {
  if (typeof window === 'undefined' || !type || !id) return
  try {
    const list = getSearchHistory().filter((e) => !(e.type === type && e.id === id))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (_) {}
}

/**
 * 記錄一次點擊歌單
 * @param {{ id: string, title?: string, coverImage?: string }} playlist
 */
export function addSearchHistoryPlaylist(playlist) {
  if (typeof window === 'undefined' || !playlist?.id) return
  try {
    const list = getSearchHistory().filter((e) => !(e.type === 'playlist' && e.id === playlist.id))
    const entry = {
      type: 'playlist',
      id: playlist.id,
      title: playlist.title || '',
      coverImage: playlist.coverImage || null,
      viewedAt: Date.now(),
    }
    list.unshift(entry)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)))
  } catch (_) {}
}

export function addSearchHistoryArtist(artist) {
  if (typeof window === 'undefined' || !artist?.id) return
  try {
    const list = getSearchHistory().filter((e) => !(e.type === 'artist' && e.id === artist.id))
    const photo = artist.photoURL || artist.wikiPhotoURL || artist.photo || null
    const entry = {
      type: 'artist',
      id: artist.id,
      name: artist.name || '',
      photo: photo || null,
      viewedAt: Date.now(),
    }
    list.unshift(entry)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)))
  } catch (_) {}
}

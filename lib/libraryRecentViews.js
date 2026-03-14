/**
 * 收藏頁「最近瀏覽」：用 localStorage 記錄用戶最近打開過的歌手/歌單，
 * 供 /library 頁面按「最近瀏覽」排序。
 * 另：最近瀏覽結他譜（最多 20 份）供 /library/recent-tabs 顯示。
 */

const STORAGE_KEY = 'pg_library_recent_views';
const MAX_ENTRIES = 200;

const RECENT_TABS_KEY = 'pg_recent_tabs';
const MAX_RECENT_TABS = 20;

/**
 * 取得所有最近瀏覽記錄 { [key]: timestamp }
 */
export function getRecentViews() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * 取得某項目的最後瀏覽時間（毫秒），無則 0
 * @param {string} type - 'artist' | 'playlist' | 'userPlaylist'
 * @param {string} id
 */
export function getLastViewedAt(type, id) {
  const key = `${type}_${id}`;
  const views = getRecentViews();
  return views[key] || 0;
}

/**
 * 記錄一次瀏覽（由 _app 路由變化時呼叫）
 * @param {string} type - 'artist' | 'playlist' | 'userPlaylist'
 * @param {string} id
 */
export function recordView(type, id) {
  if (typeof window === 'undefined' || !type || !id) return;
  try {
    const key = `${type}_${id}`;
    const views = getRecentViews();
    views[key] = Date.now();
    const entries = Object.entries(views);
    if (entries.length > MAX_ENTRIES) {
      const sorted = entries.sort((a, b) => b[1] - a[1]).slice(0, MAX_ENTRIES);
      const trimmed = Object.fromEntries(sorted);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
    }
  } catch (_) {}
}

// ==================== 最近瀏覽結他譜（最多 20 份） ====================

/**
 * 記錄一次結他譜瀏覽，保留最近 20 份
 * @param {string} tabId - Firestore tabs 文件 id
 * @param {Object} [meta] - 可選元數據（title, artist, thumbnail 等），避免之後再 fetch
 */
export function recordTabView(tabId, meta) {
  if (typeof window === 'undefined' || !tabId) return;
  try {
    const raw = localStorage.getItem(RECENT_TABS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const filtered = list.filter((e) => e.id !== tabId);
    const entry = { id: tabId, viewedAt: now };
    if (meta) {
      if (meta.title) entry.title = meta.title;
      if (meta.artistId) entry.artistId = meta.artistId;
      const thumb = meta.coverImage || meta.thumbnail || meta.albumImage;
      if (thumb) entry.thumbnail = thumb;
      if (meta.youtubeUrl) entry.youtubeUrl = meta.youtubeUrl;
      if (meta.artistPhoto) entry.artistPhoto = meta.artistPhoto;
    }
    const next = [entry, ...filtered].slice(0, MAX_RECENT_TABS);
    localStorage.setItem(RECENT_TABS_KEY, JSON.stringify(next));
  } catch (_) {}
}

/**
 * 取得最近瀏覽的結他譜 id 列表（按瀏覽時間新到舊）
 * @returns {Array<{ id: string, viewedAt: number }>}
 */
export function getRecentTabIds() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_TABS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * 統一歌曲/樂譜縮圖 URL 優先序：自訂封面 > Spotify 專輯 > YouTube > thumbnail > 歌手相。
 * 支援 song / tab / playlist 等物件（欄位名兼容）。
 * @param {Object} item - 歌曲或樂譜物件，可含 coverImage, albumImage, youtubeVideoId, youtubeUrl, thumbnail, artistPhoto 等
 * @param {{ artistPhoto?: string|null }} [options] - 可選，傳入歌手相作 fallback
 * @returns {string|null} 縮圖 URL 或 null
 */
export function getSongThumbnail(item, options = {}) {
  if (!item) return null
  const { artistPhoto: optionsArtistPhoto } = options

  // 1. 用戶自訂封面 / 已有 thumbnail（兼容 tab、song）
  if (item.coverImage) return item.coverImage
  if (item.thumbnail) return item.thumbnail

  // 2. Spotify 專輯封面
  if (item.albumImage) return item.albumImage

  // 3. YouTube 縮圖
  const ytId = item.youtubeVideoId || item.youtubeThumbnail || extractYouTubeId(item.youtubeUrl)
  if (ytId) {
    return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
  }

  // 4. 歌手相 fallback（item 自身或 options 傳入）
  if (item.artistPhoto) return item.artistPhoto
  if (optionsArtistPhoto) return optionsArtistPhoto

  return null
}

function extractYouTubeId(url) {
  if (!url) return null
  const match = url.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

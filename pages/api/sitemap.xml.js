// 動態生成 Sitemap
import { getAllTabs, getAllArtists } from '@/lib/tabs'
import { getManualPlaylists } from '@/lib/playlists'

const SITE_URL = 'https://polygon.guitars'

export default async function handler(req, res) {
  try {
    // 獲取所有數據
    const [tabs, artists, playlists] = await Promise.all([
      getAllTabs(),
      getAllArtists(),
      getManualPlaylists().catch(() => [])
    ])

    // 生成 sitemap XML
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- 首頁 -->
  <url>
    <loc>${SITE_URL}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  
  <!-- 歌手列表 -->
  <url>
    <loc>${SITE_URL}/artists</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  
  <!-- 搜尋頁 -->
  <url>
    <loc>${SITE_URL}/search</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <!-- 樂譜庫 -->
  <url>
    <loc>${SITE_URL}/library</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  
  <!-- 歌手頁面 -->
  ${artists.map(artist => `
  <url>
    <loc>${SITE_URL}/artists/${artist.normalizedName || artist.id}</loc>
    <lastmod>${artist.updatedAt ? new Date(artist.updatedAt).toISOString() : new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  `).join('')}
  
  <!-- 樂譜頁面 -->
  ${tabs.map(tab => `
  <url>
    <loc>${SITE_URL}/tabs/${tab.id}</loc>
    <lastmod>${tab.updatedAt ? new Date(tab.updatedAt).toISOString() : tab.createdAt ? new Date(tab.createdAt).toISOString() : new Date().toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  `).join('')}
  
  <!-- Playlist 頁面 -->
  ${playlists.map(playlist => `
  <url>
    <loc>${SITE_URL}/playlist/${playlist.id}</loc>
    <lastmod>${playlist.updatedAt ? new Date(playlist.updatedAt).toISOString() : new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  `).join('')}
</urlset>`

    // 設置響應頭
    res.setHeader('Content-Type', 'application/xml')
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    res.status(200).send(sitemap)
  } catch (error) {
    console.error('Sitemap generation error:', error)
    res.status(500).send('Error generating sitemap')
  }
}

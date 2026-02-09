// 動態生成 Sitemap
// 使用 Firebase Admin SDK 從 Firestore 讀取數據

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const SITE_URL = 'https://polygon.guitars'

// 初始化 Firebase Admin
function getAdminDb() {
  if (getApps().length === 0) {
    try {
      // 嘗試使用環境變數初始化
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
      
      if (privateKey && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PROJECT_ID) {
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: privateKey
          })
        })
      } else {
        // 如果沒有環境變數，使用應用默認憑證 (GCE/Cloud Run 環境)
        initializeApp()
      }
    } catch (error) {
      console.error('Firebase Admin initialization error:', error)
      throw error
    }
  }
  
  return getFirestore()
}

export default async function handler(req, res) {
  try {
    const db = getAdminDb()
    
    // 獲取所有數據
    const [tabsSnapshot, artistsSnapshot, playlistsSnapshot] = await Promise.all([
      db.collection('tabs').orderBy('createdAt', 'desc').get(),
      db.collection('artists').orderBy('name').get(),
      db.collection('playlists').where('isActive', '==', true).get().catch(() => ({ docs: [] }))
    ])

    const tabs = tabsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    const artists = artistsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    const playlists = playlistsSnapshot.docs?.map(doc => ({ id: doc.id, ...doc.data() })) || []

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
  ${artists.map(artist => {
    const artistSlug = artist.normalizedName || artist.slug || artist.id
    const lastmod = artist.updatedAt?.toDate?.() || artist.updatedAt || new Date()
    return `
  <url>
    <loc>${SITE_URL}/artists/${artistSlug}</loc>
    <lastmod>${lastmod instanceof Date ? lastmod.toISOString() : new Date(lastmod).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  `
  }).join('')}
  
  <!-- 樂譜頁面 -->
  ${tabs.map(tab => {
    const lastmod = tab.updatedAt?.toDate?.() || tab.updatedAt || tab.createdAt?.toDate?.() || tab.createdAt || new Date()
    return `
  <url>
    <loc>${SITE_URL}/tabs/${tab.id}</loc>
    <lastmod>${lastmod instanceof Date ? lastmod.toISOString() : new Date(lastmod).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  `
  }).join('')}
  
  <!-- Playlist 頁面 -->
  ${playlists.map(playlist => {
    const lastmod = playlist.updatedAt?.toDate?.() || playlist.updatedAt || new Date()
    return `
  <url>
    <loc>${SITE_URL}/playlist/${playlist.id}</loc>
    <lastmod>${lastmod instanceof Date ? lastmod.toISOString() : new Date(lastmod).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  `
  }).join('')}
</urlset>`

    // 設置響應頭
    res.setHeader('Content-Type', 'application/xml')
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    res.status(200).send(sitemap)
  } catch (error) {
    console.error('Sitemap generation error:', error)
    
    // 返回基本 sitemap (不包括動態內容)
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/artists</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${SITE_URL}/search</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${SITE_URL}/library</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`
    
    res.setHeader('Content-Type', 'application/xml')
    res.status(200).send(fallbackSitemap)
  }
}

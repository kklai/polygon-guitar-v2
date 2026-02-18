import { getGlobalSettings } from '@/lib/tabs'

export default async function handler(req, res) {
  try {
    const settings = await getGlobalSettings()
    const appIconUrl = settings.appIconUrl

    const manifest = {
      name: 'Polygon Guitar - 香港最大結他譜庫',
      short_name: 'Polygon Guitar',
      description: '超過 3000 份香港廣東歌、國語歌結他譜，支援轉調、自動滾動',
      start_url: '/',
      display: 'standalone',
      background_color: '#000000',
      theme_color: '#FFD700',
      orientation: 'portrait',
      scope: '/',
      lang: 'zh-HK',
      icons: []
    }

    if (appIconUrl) {
      // 使用上載的 App Icon
      manifest.icons = [
        {
          src: appIconUrl,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: appIconUrl,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    } else {
      // 使用預設圖標
      manifest.icons = [
        {
          src: '/icon-512x512.svg',
          sizes: '512x512',
          type: 'image/svg+xml',
          purpose: 'any maskable'
        },
        {
          src: '/icon-192x192.svg',
          sizes: '192x192',
          type: 'image/svg+xml',
          purpose: 'any maskable'
        },
        {
          src: '/favicon.ico',
          sizes: '64x64 32x32 24x24 16x16',
          type: 'image/x-icon'
        }
      ]
    }

    res.setHeader('Content-Type', 'application/manifest+json')
    res.status(200).json(manifest)
  } catch (error) {
    console.error('Manifest error:', error)
    
    // 返回預設 manifest
    res.setHeader('Content-Type', 'application/manifest+json')
    res.status(200).json({
      name: 'Polygon Guitar - 香港最大結他譜庫',
      short_name: 'Polygon Guitar',
      description: '超過 3000 份香港廣東歌、國語歌結他譜，支援轉調、自動滾動',
      start_url: '/',
      display: 'standalone',
      background_color: '#000000',
      theme_color: '#FFD700',
      orientation: 'portrait',
      scope: '/',
      lang: 'zh-HK',
      icons: [
        {
          src: '/icon-512x512.svg',
          sizes: '512x512',
          type: 'image/svg+xml',
          purpose: 'any maskable'
        },
        {
          src: '/icon-192x192.svg',
          sizes: '192x192',
          type: 'image/svg+xml',
          purpose: 'any maskable'
        }
      ]
    })
  }
}

// Hardcoded so we don't hit Firebase on every manifest request
const MANIFEST = {
  name: 'Polygon 結他譜 - 香港最大結他譜庫',
  short_name: 'Polygon 結他譜',
  description: '超過 3000 份香港廣東歌、國語歌結他譜，支援轉調、自動滾動',
  start_url: '/',
  display: 'standalone',
  background_color: '#000000',
  theme_color: '#FFD700',
  orientation: 'portrait',
  scope: '/',
  lang: 'zh-HK',
  icons: [
    { src: '/icon-512x512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
    { src: '/icon-192x192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
    { src: '/favicon.ico', sizes: '64x64 32x32 24x24 16x16', type: 'image/x-icon' }
  ]
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/manifest+json')
  res.status(200).json(MANIFEST)
}

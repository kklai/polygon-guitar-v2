/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 圖片優化設定
  images: {
    remotePatterns: [
      { hostname: 'i.ytimg.com' },           // YouTube 縮圖
      { hostname: 'res.cloudinary.com' },    // Cloudinary
      { hostname: 'upload.wikimedia.org' },  // 維基百科
      { hostname: 'i.scdn.co' },             // Spotify
      { hostname: 'mosaic.scdn.co' },        // Spotify mosaic
      { hostname: 'image-cdn-ak.spotifycdn.com' },
      { hostname: 'image-cdn-fa.spotifycdn.com' },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 86400, // 24小時快取
  },

  async redirects() {
    return [
      {
        source: '/songs/:slug',
        destination: '/artists/:slug',
        permanent: true,
      },
    ]
  },

  // 壓縮設定
  compress: true,

  // 實驗性功能（加速）
  experimental: {
    optimizeCss: true,
  },
}

module.exports = nextConfig

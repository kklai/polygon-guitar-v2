/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/songs/:slug',
        destination: '/artists/:slug',
        permanent: true,
      },
    ];
  },
}

module.exports = nextConfig

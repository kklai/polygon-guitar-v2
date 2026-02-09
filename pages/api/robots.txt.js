// robots.txt - 搜索引擎爬蟲規則
export default function handler(req, res) {
  const SITE_URL = 'https://polygon.guitars'
  
  const robotsTxt = `# Polygon Guitar - 結他譜分享平台
# https://polygon.guitars

User-agent: *
Allow: /

# 不允許爬蟲訪問的路徑
Disallow: /admin/
Disallow: /api/
Disallow: /login
Disallow: /new

# Sitemap
Sitemap: ${SITE_URL}/api/sitemap.xml

# Crawl rate
Crawl-delay: 1
`

  res.setHeader('Content-Type', 'text/plain')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.status(200).send(robotsTxt)
}

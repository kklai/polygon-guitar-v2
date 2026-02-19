// Spotify API 代理 - 避免 CORS

export default async function handler(req, res) {
  console.log('=== Spotify API called ===')
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    const { query } = req.body
    console.log('Query:', query)
    
    if (!query) {
      return res.status(400).json({ error: 'Missing query' })
    }
    
    // 獲取環境變數（確保冇空格）
    const SPOTIFY_CLIENT_ID = (process.env.SPOTIFY_CLIENT_ID || '').trim()
    const SPOTIFY_CLIENT_SECRET = (process.env.SPOTIFY_CLIENT_SECRET || '').trim()
    
    console.log('SPOTIFY_CLIENT_ID length:', SPOTIFY_CLIENT_ID.length)
    console.log('SPOTIFY_CLIENT_SECRET length:', SPOTIFY_CLIENT_SECRET.length)
    
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      return res.status(500).json({ 
        error: 'Missing credentials',
        clientIdExists: !!SPOTIFY_CLIENT_ID,
        secretExists: !!SPOTIFY_CLIENT_SECRET
      })
    }
    
    // 獲取 Token（使用 Spotify Client Credentials Flow - Basic Auth）
    console.log('Requesting token...')
    
    // Base64 encode client_id:client_secret（Spotify 官方做法）
    const credentialsString = `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
    const base64Credentials = Buffer.from(credentialsString).toString('base64')
    
    console.log('Credentials string length:', credentialsString.length)
    console.log('Base64 credentials preview:', base64Credentials.substring(0, 30) + '...')
    console.log('Base64 credentials length:', base64Credentials.length)
    
    // 驗證 decode 係咪正確
    const decoded = Buffer.from(base64Credentials, 'base64').toString('utf8')
    console.log('Decode match:', decoded === credentialsString)
    
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${base64Credentials}`
      },
      body: 'grant_type=client_credentials'
    })
    
    // 檢查是否為 rate limit 錯誤
    const contentType = tokenResponse.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      const text = await tokenResponse.text()
      console.error('Token error (non-JSON):', text)
      return res.status(429).json({ 
        error: 'Rate limited',
        message: 'Spotify API rate limit reached. Please try again later.'
      })
    }
    
    const tokenData = await tokenResponse.json()
    
    console.log('Token status:', tokenResponse.status)
    console.log('Token response:', JSON.stringify(tokenData, null, 2))
    
    if (!tokenResponse.ok) {
      return res.status(500).json({ 
        error: 'Spotify auth failed',
        status: tokenResponse.status,
        spotifyError: tokenData.error,
        description: tokenData.error_description
      })
    }
    
    // 搜索歌手
    const cleanName = query.replace(/\s*[\(\（].*?[\)\）]\s*/g, '').trim()
    
    const searchResponse = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(cleanName)}&type=artist&limit=1`,
      {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      }
    )
    
    // 檢查是否為 rate limit 錯誤
    const searchContentType = searchResponse.headers.get('content-type')
    if (!searchContentType?.includes('application/json')) {
      const text = await searchResponse.text()
      console.error('Search error (non-JSON):', text)
      return res.status(429).json({ 
        error: 'Rate limited',
        message: 'Spotify API rate limit reached. Please try again later.'
      })
    }
    
    const searchData = await searchResponse.json()
    
    if (searchData.error) {
      return res.status(500).json({ 
        error: 'Search failed',
        spotifyError: searchData.error
      })
    }
    
    const artist = searchData.artists?.items?.[0]
    
    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' })
    }
    
    // 檢查名稱匹配
    const spotifyName = artist.name.toLowerCase()
    const searchName = cleanName.toLowerCase()
    
    if (spotifyName.includes(searchName) || searchName.includes(spotifyName)) {
      return res.status(200).json({
        id: artist.id,
        name: artist.name,
        images: artist.images,
        followers: artist.followers?.total || 0,
        popularity: artist.popularity || 0,
        genres: artist.genres || []
      })
    }
    
    return res.status(404).json({ error: 'No match' })
    
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack
    })
  }
}

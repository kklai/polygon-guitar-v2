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
    
    // 獲取環境變數
    const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
    const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
    
    console.log('SPOTIFY_CLIENT_ID exists:', !!SPOTIFY_CLIENT_ID)
    console.log('SPOTIFY_CLIENT_SECRET exists:', !!SPOTIFY_CLIENT_SECRET)
    
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      return res.status(500).json({ 
        error: 'Missing credentials',
        clientIdExists: !!SPOTIFY_CLIENT_ID,
        secretExists: !!SPOTIFY_CLIENT_SECRET
      })
    }
    
    // 獲取 Token
    const credentials = `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
    const base64Credentials = Buffer.from(credentials).toString('base64')
    
    console.log('Requesting token...')
    
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${base64Credentials}`
      },
      body: 'grant_type=client_credentials'
    })
    
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
        images: artist.images
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

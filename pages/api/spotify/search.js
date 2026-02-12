// Spotify API 代理 - 避免 CORS
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

// 獲取 Spotify Token
async function getSpotifyToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')
    },
    body: 'grant_type=client_credentials'
  })
  
  const data = await response.json()
  return data.access_token
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    const { query } = req.body
    
    if (!query) {
      return res.status(400).json({ error: 'Missing query' })
    }
    
    const token = await getSpotifyToken()
    const cleanName = query.replace(/\s*[\(\（].*?[\)\）]\s*/g, '').trim()
    
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(cleanName)}&type=artist&limit=1`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )
    
    const data = await response.json()
    const artist = data.artists?.items?.[0]
    
    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' })
    }
    
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
    console.error('Spotify search error:', error)
    return res.status(500).json({ error: error.message })
  }
}

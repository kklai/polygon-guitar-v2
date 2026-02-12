// Spotify API 代理 - 避免 CORS
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

// 獲取 Spotify Token
async function getSpotifyToken() {
  console.log('Getting Spotify token...')
  console.log('Client ID exists:', !!SPOTIFY_CLIENT_ID)
  console.log('Client Secret exists:', !!SPOTIFY_CLIENT_SECRET)
  
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')
    },
    body: 'grant_type=client_credentials'
  })
  
  const data = await response.json()
  
  if (!response.ok) {
    console.error('Spotify token error:', data)
    throw new Error(data.error_description || 'Failed to get token')
  }
  
  console.log('Token received:', data.access_token ? 'Yes' : 'No')
  return data.access_token
}

export default async function handler(req, res) {
  console.log('Spotify search API called')
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    const { query } = req.body
    console.log('Search query:', query)
    
    if (!query) {
      return res.status(400).json({ error: 'Missing query' })
    }
    
    const token = await getSpotifyToken()
    const cleanName = query.replace(/\s*[\(\（].*?[\)\）]\s*/g, '').trim()
    console.log('Clean name:', cleanName)
    
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(cleanName)}&type=artist&limit=1`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )
    
    const data = await response.json()
    console.log('Spotify response status:', response.status)
    
    if (data.error) {
      console.error('Spotify API error:', data.error)
      return res.status(500).json({ error: data.error.message })
    }
    
    const artist = data.artists?.items?.[0]
    
    if (!artist) {
      console.log('No artist found')
      return res.status(404).json({ error: 'Artist not found' })
    }
    
    console.log('Found artist:', artist.name)
    console.log('Images count:', artist.images?.length || 0)
    
    const spotifyName = artist.name.toLowerCase()
    const searchName = cleanName.toLowerCase()
    
    if (spotifyName.includes(searchName) || searchName.includes(spotifyName)) {
      return res.status(200).json({
        id: artist.id,
        name: artist.name,
        images: artist.images
      })
    }
    
    console.log('Name mismatch:', spotifyName, 'vs', searchName)
    return res.status(404).json({ error: 'No match' })
    
  } catch (error) {
    console.error('Spotify search error:', error)
    return res.status(500).json({ error: error.message })
  }
}

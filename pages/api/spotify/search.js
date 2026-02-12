// Spotify API 代理 - 避免 CORS

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
    
    const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
    const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
    
    console.log('Client ID length:', SPOTIFY_CLIENT_ID?.length)
    console.log('Client Secret length:', SPOTIFY_CLIENT_SECRET?.length)
    
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      return res.status(500).json({ 
        error: 'Missing Spotify credentials',
        clientIdExists: !!SPOTIFY_CLIENT_ID,
        secretExists: !!SPOTIFY_CLIENT_SECRET
      })
    }
    
    // 獲取 Spotify Token
    console.log('Getting token...')
    const authString = Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')
    
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + authString
      },
      body: 'grant_type=client_credentials'
    })
    
    const tokenData = await tokenResponse.json()
    console.log('Token response status:', tokenResponse.status)
    
    if (!tokenResponse.ok) {
      console.error('Token error:', tokenData)
      return res.status(500).json({ 
        error: 'Spotify auth failed', 
        details: tokenData.error,
        description: tokenData.error_description 
      })
    }
    
    const token = tokenData.access_token
    console.log('Token received')
    
    // 搜索歌手
    const cleanName = query.replace(/\s*[\(\（].*?[\)\）]\s*/g, '').trim()
    console.log('Clean name:', cleanName)
    
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(cleanName)}&type=artist&limit=1`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )
    
    const data = await response.json()
    console.log('Search response status:', response.status)
    
    if (data.error) {
      console.error('Search error:', data.error)
      return res.status(500).json({ error: data.error.message })
    }
    
    const artist = data.artists?.items?.[0]
    
    if (!artist) {
      console.log('No artist found')
      return res.status(404).json({ error: 'Artist not found' })
    }
    
    console.log('Found artist:', artist.name)
    
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

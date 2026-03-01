// Spotify API - 搜尋歌曲

export default async function handler(req, res) {
  console.log('=== Spotify Track Search API called ===')
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    const { q, artist } = req.query
    console.log('Query:', q, 'Artist:', artist)
    
    if (!q || !artist) {
      return res.status(400).json({ error: 'Missing query or artist' })
    }
    
    // 獲取環境變數
    const SPOTIFY_CLIENT_ID = (process.env.SPOTIFY_CLIENT_ID || '').trim()
    const SPOTIFY_CLIENT_SECRET = (process.env.SPOTIFY_CLIENT_SECRET || '').trim()
    
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Missing Spotify credentials' })
    }
    
    // 獲取 Token
    const credentialsString = `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
    const base64Credentials = Buffer.from(credentialsString).toString('base64')
    
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${base64Credentials}`
      },
      body: 'grant_type=client_credentials'
    })
    
    const tokenData = await tokenResponse.json()
    
    if (!tokenResponse.ok) {
      return res.status(500).json({ 
        error: 'Spotify auth failed',
        spotifyError: tokenData
      })
    }
    
    // 搜尋歌曲
    const searchQuery = `track:${q} artist:${artist}`
    
    const searchResponse = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=1`,
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
    
    const track = searchData.tracks?.items?.[0]
    
    if (!track) {
      // 嘗試更寬鬆的搜尋
      const looseSearchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(q + ' ' + artist)}&type=track&limit=3`,
        {
          headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        }
      )
      
      const looseData = await looseSearchResponse.json()
      const looseTrack = looseData.tracks?.items?.[0]
      
      if (!looseTrack) {
        return res.status(404).json({ error: 'Track not found' })
      }
      
      return res.status(200).json({
        track: {
          id: looseTrack.id,
          name: looseTrack.name,
          artists: looseTrack.artists.map(a => ({ name: a.name })),
          album: {
            name: looseTrack.album?.name,
            images: looseTrack.album?.images
          }
        }
      })
    }
    
    return res.status(200).json({
      track: {
        id: track.id,
        name: track.name,
        artists: track.artists.map(a => ({ name: a.name })),
        album: {
          name: track.album?.name,
          images: track.album?.images
        }
      }
    })
    
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: error.message })
  }
}

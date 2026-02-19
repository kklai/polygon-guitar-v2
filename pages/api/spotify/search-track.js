// Spotify API - 搜尋歌曲資訊
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    const { artist, title, query: customQuery } = req.body
    
    if (!artist && !title && !customQuery) {
      return res.status(400).json({ error: 'Missing search parameters' })
    }
    
    // 獲取環境變數
    const SPOTIFY_CLIENT_ID = (process.env.SPOTIFY_CLIENT_ID || '').trim()
    const SPOTIFY_CLIENT_SECRET = (process.env.SPOTIFY_CLIENT_SECRET || '').trim()
    
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Missing Spotify credentials' })
    }
    
    // 獲取 Access Token
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
    
    if (!tokenResponse.ok) {
      return res.status(500).json({ 
        error: 'Spotify auth failed',
        details: tokenData
      })
    }
    
    // 構建搜尋查詢
    let searchQuery = customQuery
    if (!searchQuery && artist && title) {
      searchQuery = `track:${title} artist:${artist}`
    } else if (!searchQuery) {
      searchQuery = title || artist
    }
    
    // 搜尋歌曲
    const searchResponse = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=5&market=HK`,
      {
        headers: { 
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
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
    
    const tracks = searchData.tracks?.items || []
    
    if (tracks.length === 0) {
      return res.status(404).json({ error: 'No tracks found' })
    }
    
    // 格式化結果
    const results = tracks.map(track => {
      const album = track.album
      const artists = track.artists
      
      return {
        id: track.id,
        name: track.name,
        artist: artists.map(a => a.name).join(', '),
        artistId: artists[0]?.id,
        album: album.name,
        albumId: album.id,
        albumImage: album.images?.[0]?.url,
        releaseDate: album.release_date,
        releaseYear: album.release_date?.split('-')[0],
        duration: track.duration_ms,
        popularity: track.popularity,
        previewUrl: track.preview_url,
        spotifyUrl: track.external_urls?.spotify,
        trackNumber: track.track_number,
        // 用於顯示的資訊
        displayTitle: track.name,
        displayArtist: artists[0]?.name,
        displayAlbum: album.name,
        thumbnail: album.images?.[album.images.length - 1]?.url || album.images?.[0]?.url
      }
    })
    
    return res.status(200).json({
      results,
      query: searchQuery,
      total: searchData.tracks?.total || 0
    })
    
  } catch (error) {
    console.error('Spotify track search error:', error)
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

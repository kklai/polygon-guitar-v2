// Spotify API - 搜尋歌曲

export const config = {
  api: {
    bodyParser: true,
  },
}

export default async function handler(req, res) {
  console.log('=== Spotify Track Search API called ===')
  console.log('Method:', req.method)
  
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    // 支援多種參數名組合
    const params = req.method === 'POST' ? req.body : req.query
    console.log('Params received:', params)
    
    // 支援: q (完整查詢) 或 artist + title 組合
    let q = params.q || params.query
    const artist = params.artist || params.artistName
    const title = params.title || params.songTitle || params.name
    
    console.log('Parsed - q:', q, 'artist:', artist, 'title:', title)
    
    // 如果冇 q 但有 artist 同 title，組合成 q
    if (!q && artist && title) {
      q = `${title} ${artist}`
    }
    
    if (!q && !artist && !title) {
      return res.status(400).json({ error: 'Missing query or artist/title' })
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
    
    // 搜尋歌曲 - 返回多個結果（最多 5 個）
    const searchQuery = title && artist 
      ? `track:${title} artist:${artist}`
      : q
    
    console.log('Spotify search query:', searchQuery)
    
    const searchResponse = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=5`,
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
    
    const tracks = searchData.tracks?.items || []
    
    if (tracks.length === 0) {
      // 嘗試更寬鬆的搜尋
      const looseQuery = q || `${title} ${artist}`
      console.log('Trying loose search:', looseQuery)
      
      const looseSearchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(looseQuery)}&type=track&limit=5`,
        {
          headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        }
      )
      
      const looseData = await looseSearchResponse.json()
      const looseTracks = looseData.tracks?.items || []
      
      if (looseTracks.length === 0) {
        return res.status(404).json({ error: 'Track not found' })
      }
      
      // 轉換格式並返回
      const results = looseTracks.map(track => formatTrackData(track))
      return res.status(200).json({ results })
    }
    
    // 轉換格式並返回
    const results = tracks.map(track => formatTrackData(track))
    return res.status(200).json({ results })
    
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: error.message })
  }
}

// 將 Spotify track 數據轉換為前端期望的格式
function formatTrackData(track) {
  // 從專輯圖片中選擇合適的尺寸
  const images = track.album?.images || []
  const albumImage = images[0]?.url || '' // 最大圖
  const thumbnail = images[images.length - 1]?.url || '' // 最小圖
  
  // 從專輯發行日期提取年份
  const releaseDate = track.album?.release_date || ''
  const releaseYear = releaseDate ? releaseDate.split('-')[0] : ''
  
  // 獲取第一個歌手的 ID
  const firstArtist = track.artists?.[0]
  
  return {
    id: track.id,
    name: track.name,
    artist: firstArtist?.name || '',
    artists: track.artists?.map(a => ({ name: a.name, id: a.id })) || [],
    album: track.album?.name || '',
    albumId: track.album?.id || '',
    artistId: firstArtist?.id || '',
    albumImage: albumImage,
    thumbnail: thumbnail || albumImage,
    duration: track.duration_ms || 0,
    releaseYear: releaseYear,
    popularity: track.popularity || 0,
    previewUrl: track.preview_url || null,
    spotifyUrl: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`
  }
}

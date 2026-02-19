// Spotify API - 獲取歌曲詳細資訊（包括 BPM、作曲填詞等）
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    const { trackId } = req.body
    
    if (!trackId) {
      return res.status(400).json({ error: 'Missing trackId' })
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
    
    const accessToken = tokenData.access_token
    
    // 只獲取歌曲基本資訊（減少 API 請求避免 rate limit）
    const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    
    // 檢查 rate limit（返回純文本時）
    const ct = trackRes.headers.get('content-type')
    if (!ct?.includes('application/json')) {
      const text = await trackRes.text()
      console.error('Track response (non-JSON):', text)
      return res.status(429).json({ 
        error: 'Rate limited',
        message: 'Spotify API rate limit reached. Please try again later.'
      })
    }
    
    if (!trackRes.ok) {
      return res.status(trackRes.status).json({ 
        error: 'Track not found',
        status: trackRes.status 
      })
    }
    
    const trackData = await trackRes.json()
    
    // 格式化結果（只包含基本資料）
    const result = {
      // 基本資訊
      id: trackData?.id,
      name: trackData?.name,
      artist: trackData?.artists?.map(a => a.name).join(', '),
      artistId: trackData?.artists?.[0]?.id,
      album: trackData?.album?.name,
      albumId: trackData?.album?.id,
      albumImage: trackData?.album?.images?.[0]?.url,
      releaseDate: trackData?.album?.release_date,
      releaseYear: trackData?.album?.release_date?.split('-')[0],
      duration: trackData?.duration_ms,
      popularity: trackData?.popularity,
      previewUrl: trackData?.preview_url,
      spotifyUrl: trackData?.external_urls?.spotify,
    }
    
    return res.status(200).json({
      result,
      hasCredits: false,
      hasAudioFeatures: false,
      message: 'Basic info only (BPM/credits excluded to avoid rate limit)'
    })
    
  } catch (error) {
    console.error('Spotify track details error:', error)
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

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
    
    // 並行獲取歌曲詳情和 Audio Features
    const [trackRes, audioFeaturesRes] = await Promise.all([
      // 歌曲基本資訊
      fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }),
      // Audio Features (BPM、調性等)
      fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
    ])
    
    // 檢查 rate limit（返回純文本時）
    const trackData = await (async () => {
      if (!trackRes.ok) return null
      const ct = trackRes.headers.get('content-type')
      if (!ct?.includes('application/json')) {
        console.error('Track response (non-JSON):', await trackRes.text())
        return null
      }
      return await trackRes.json()
    })()
    
    const audioFeatures = await (async () => {
      if (!audioFeaturesRes.ok) return null
      const ct = audioFeaturesRes.headers.get('content-type')
      if (!ct?.includes('application/json')) {
        console.error('Audio features response (non-JSON):', await audioFeaturesRes.text())
        return null
      }
      return await audioFeaturesRes.json()
    })()
    
    // 嘗試獲取 Credits（作曲、填詞等）
    let credits = null
    try {
      const creditsRes = await fetch(`https://api.spotify.com/v1/tracks/${trackId}/credits`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      if (creditsRes.ok) {
        const ct = creditsRes.headers.get('content-type')
        if (ct?.includes('application/json')) {
          credits = await creditsRes.json()
        }
      }
    } catch (e) {
      // Credits API 可能未開放，忽略錯誤
    }
    
    // 格式化結果
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
      
      // Audio Features（BPM、調性等）
      bpm: audioFeatures?.tempo ? Math.round(audioFeatures.tempo) : null,
      key: audioFeatures?.key !== undefined ? audioFeatures.key : null,
      mode: audioFeatures?.mode,
      timeSignature: audioFeatures?.time_signature,
      danceability: audioFeatures?.danceability,
      energy: audioFeatures?.energy,
      valence: audioFeatures?.valence,
      acousticness: audioFeatures?.acousticness,
      instrumentalness: audioFeatures?.instrumentalness,
      
      // Credits（作曲、填詞等）- 如果有
      composers: credits?.composers?.map(c => c.name).join(', ') || null,
      lyricists: credits?.lyricists?.map(c => c.name).join(', ') || null,
      producers: credits?.producers?.map(c => c.name).join(', ') || null,
      performers: credits?.performers?.map(c => c.name).join(', ') || null,
    }
    
    return res.status(200).json({
      result,
      hasCredits: !!credits,
      hasAudioFeatures: !!audioFeatures
    })
    
  } catch (error) {
    console.error('Spotify track details error:', error)
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

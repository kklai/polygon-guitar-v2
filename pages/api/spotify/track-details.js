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
    
    const tokenData = await tokenResponse.json()
    
    if (!tokenResponse.ok) {
      return res.status(500).json({ 
        error: 'Spotify auth failed',
        details: tokenData
      })
    }
    
    const accessToken = tokenData.access_token
    
    // 獲取歌曲基本資訊
    const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    
    if (!trackRes.ok) {
      return res.status(trackRes.status).json({ 
        error: 'Track not found',
        status: trackRes.status 
      })
    }
    
    const trackData = await trackRes.json()
    
    // 獲取 Audio Features
    let audioFeaturesData = null
    let audioFeaturesError = null
    try {
      const audioFeaturesRes = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      
      if (audioFeaturesRes.ok) {
        audioFeaturesData = await audioFeaturesRes.json()
      } else {
        audioFeaturesError = {
          status: audioFeaturesRes.status,
          statusText: audioFeaturesRes.statusText,
          body: await audioFeaturesRes.text()
        }
      }
    } catch (e) {
      audioFeaturesError = e.message
    }
    
    // 獲取 Credits
    let creditsData = null
    let creditsError = null
    try {
      const creditsRes = await fetch(`https://api.spotify.com/v1/tracks/${trackId}/credits`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      
      if (creditsRes.ok) {
        creditsData = await creditsRes.json()
      } else {
        creditsError = {
          status: creditsRes.status,
          statusText: creditsRes.statusText
        }
      }
    } catch (e) {
      creditsError = e.message
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
      
      // Audio Features
      audioFeatures: audioFeaturesData ? {
        bpm: Math.round(audioFeaturesData.tempo),
        key: formatKey(audioFeaturesData.key, audioFeaturesData.mode),
        mode: audioFeaturesData.mode === 1 ? 'Major' : 'Minor',
        timeSignature: audioFeaturesData.time_signature,
        energy: Math.round(audioFeaturesData.energy * 100),
        danceability: Math.round(audioFeaturesData.danceability * 100),
        valence: Math.round(audioFeaturesData.valence * 100),
        acousticness: Math.round(audioFeaturesData.acousticness * 100),
        instrumentalness: Math.round(audioFeaturesData.instrumentalness * 100),
        loudness: audioFeaturesData.loudness,
        speechiness: Math.round(audioFeaturesData.speechiness * 100)
      } : null,
      
      // Credits
      credits: creditsData?.credits?.map(c => ({
        role: c.role,
        artists: c.artists?.map(a => a.name)
      })) || null
    }
    
    return res.status(200).json({
      result,
      hasCredits: !!creditsData,
      hasAudioFeatures: !!audioFeaturesData,
      audioFeaturesError,
      creditsError,
      message: audioFeaturesData ? 'Full data retrieved' : 'Basic info only'
    })
    
  } catch (error) {
    console.error('Spotify track details error:', error)
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

// 格式化調性
function formatKey(key, mode) {
  const keys = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B']
  const keyName = keys[key] || '?'
  const modeName = mode === 1 ? '' : 'm' // Major 不顯示，Minor 顯示 m
  return keyName + modeName
}

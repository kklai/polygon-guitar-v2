// Spotify API 工具
// 用於獲取歌曲、專輯、歌手資料

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

// 獲取 Access Token（Client Credentials Flow - Basic Auth）
async function getAccessToken() {
  try {
    // Base64 encode client_id:client_secret
    const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
    
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: 'grant_type=client_credentials'
    })
    
    // 檢查是否為 rate limit 錯誤（返回純文本）
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      const text = await response.text()
      console.error('Spotify auth error (non-JSON):', text)
      return null
    }
    
    const data = await response.json()
    
    if (!response.ok) {
      console.error('Spotify auth error:', data)
      return null
    }
    
    return data.access_token
  } catch (error) {
    console.error('Spotify token error:', error)
    return null
  }
}

// 搜索歌曲
export async function searchSpotifyTrack(query, limit = 5) {
  try {
    const token = await getAccessToken()
    if (!token) return null
    
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )
    
    // 檢查是否為 rate limit 錯誤
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      const text = await response.text()
      console.error('Spotify search error (non-JSON):', text)
      return null
    }
    
    const data = await response.json()
    return data.tracks?.items || []
  } catch (error) {
    console.error('Spotify search error:', error)
    return null
  }
}

// 獲取專輯詳情
export async function getSpotifyAlbum(albumId) {
  try {
    const token = await getAccessToken()
    if (!token) return null
    
    const response = await fetch(
      `https://api.spotify.com/v1/albums/${albumId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )
    
    // 檢查是否為 rate limit 錯誤
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      const text = await response.text()
      console.error('Spotify album error (non-JSON):', text)
      return null
    }
    
    return await response.json()
  } catch (error) {
    console.error('Spotify album error:', error)
    return null
  }
}

// 獲取歌手詳情
export async function getSpotifyArtist(artistId) {
  try {
    const token = await getAccessToken()
    if (!token) return null
    
    const response = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )
    
    return await response.json()
  } catch (error) {
    console.error('Spotify artist error:', error)
    return null
  }
}

// 獲取歌手熱門歌曲
export async function getSpotifyArtistTopTracks(artistId, market = 'HK') {
  try {
    const token = await getAccessToken()
    if (!token) return null
    
    const response = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=${market}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )
    
    // 檢查是否為 rate limit 錯誤
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      const text = await response.text()
      console.error('Spotify top tracks error (non-JSON):', text)
      return null
    }
    
    const data = await response.json()
    return data.tracks || []
  } catch (error) {
    console.error('Spotify top tracks error:', error)
    return null
  }
}

// 格式化歌曲資料（用於顯示）
export function formatSpotifyTrack(track) {
  if (!track) return null
  
  return {
    id: track.id,
    name: track.name,
    artist: track.artists.map(a => a.name).join(', '),
    album: track.album.name,
    albumId: track.album.id,
    albumImage: track.album.images[0]?.url,
    releaseDate: track.album.release_date,
    duration: track.duration_ms,
    popularity: track.popularity,
    previewUrl: track.preview_url,
    spotifyUrl: track.external_urls.spotify
  }
}

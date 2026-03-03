// YouTube 搜尋 API
// 用於求譜功能，當 Spotify 找不到歌曲時作為後備

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { q } = req.query
  
  if (!q) {
    return res.status(400).json({ error: 'Missing query parameter' })
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY
    
    if (!apiKey) {
      console.error('YOUTUBE_API_KEY not set')
      return res.status(500).json({ error: 'YouTube API not configured' })
    }

    // 搜尋 YouTube 影片
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=3&key=${apiKey}`
    
    const response = await fetch(searchUrl)
    
    if (!response.ok) {
      const error = await response.text()
      console.error('YouTube API error:', error)
      return res.status(500).json({ error: 'YouTube search failed' })
    }

    const data = await response.json()
    
    if (!data.items || data.items.length === 0) {
      return res.status(404).json({ video: null })
    }

    // 返回第一個結果
    const video = data.items[0]
    
    return res.status(200).json({
      video: {
        id: video.id.videoId,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url,
        channelTitle: video.snippet.channelTitle,
      }
    })
    
  } catch (error) {
    console.error('YouTube search error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// MusicBrainz API - 免費音樂資料庫，可以攞到 BPM、作曲填詞等
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    const { artist, title } = req.body
    
    if (!artist || !title) {
      return res.status(400).json({ error: 'Missing artist or title' })
    }
    
    // 1. 搜尋歌曲
    const searchQuery = encodeURIComponent(`artist:"${artist}" AND recording:"${title}"`)
    const searchRes = await fetch(
      `https://musicbrainz.org/ws/2/recording?query=${searchQuery}&fmt=json&limit=5`,
      {
        headers: {
          'User-Agent': 'PolygonGuitar/1.0 (kermit.tam@gmail.com)'
        }
      }
    )
    
    // 檢查 rate limit
    if (searchRes.status === 503 || searchRes.status === 429) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Please wait a moment and try again.',
        retryAfter: searchRes.headers.get('Retry-After') || 5
      })
    }
    
    if (!searchRes.ok) {
      const errorText = await searchRes.text()
      return res.status(searchRes.status).json({ 
        error: 'MusicBrainz search failed',
        status: searchRes.status,
        details: errorText
      })
    }
    
    const searchData = await searchRes.json()
    
    if (!searchData.recordings || searchData.recordings.length === 0) {
      return res.status(404).json({ error: 'No results found' })
    }
    
    const recording = searchData.recordings[0]
    
    // 2. 獲取詳細資訊（包括作曲填詞等）
    let detailsData = null
    let workData = null
    try {
      const detailsRes = await fetch(
        `https://musicbrainz.org/ws/2/recording/${recording.id}?inc=artists+releases+artist-rels+work-rels+work-level-rels&fmt=json`,
        {
          headers: {
            'User-Agent': 'PolygonGuitar/1.0 (kermit.tam@example.com)'
          }
        }
      )
      
      if (detailsRes.ok) {
        detailsData = await detailsRes.json()
        
        // 如果有 work（作品），再查 work 嘅詳細資訊（作曲填詞通常喺度）
        const workRel = detailsData.relations?.find(r => r.work)
        if (workRel?.work?.id) {
          const workRes = await fetch(
            `https://musicbrainz.org/ws/2/work/${workRel.work.id}?inc=artist-rels&fmt=json`,
            {
              headers: {
                'User-Agent': 'PolygonGuitar/1.0 (kermit.tam@example.com)'
              }
            }
          )
          if (workRes.ok) {
            workData = await workRes.json()
          }
        }
      }
    } catch (e) {
      console.log('Error fetching details:', e)
    }
    
    // 3. 嘗試獲取 AcousticBrainz 數據（BPM、Key 等）
    let acousticData = null
    try {
      const acousticRes = await fetch(
        `https://acousticbrainz.org/api/v1/recording/${recording.id}/low-level`,
        {
          headers: {
            'User-Agent': 'PolygonGuitar/1.0 (kermit.tam@example.com)'
          }
        }
      )
      
      if (acousticRes.ok) {
        acousticData = await acousticRes.json()
      }
    } catch (e) {
      console.log('Error fetching acoustic data:', e)
    }
    
    // 4. 格式化結果
    const result = {
      // 基本資訊
      id: recording.id,
      title: recording.title,
      artist: recording['artist-credit']?.map(a => a.name).join(', '),
      length: recording.length,
      
      // 專輯資訊
      releases: recording.releases?.map(r => ({
        id: r.id,
        title: r.title,
        date: r.date,
        country: r.country
      })).slice(0, 3),
      
      // 作曲填詞等（從 recording 同 work 關聯提取）
      credits: extractCredits(detailsData, workData),
      
      // AcousticBrainz 數據（BPM、Key 等）
      audioFeatures: acousticData ? {
        bpm: extractBPM(acousticData),
        key: extractKey(acousticData),
        chords: extractChords(acousticData)
      } : null,
      
      // 原始數據
      raw: {
        recording: detailsData,
        work: workData,
        acoustic: acousticData
      }
    }
    
    return res.status(200).json({
      result,
      hasAudioFeatures: !!acousticData,
      hasCredits: !!(result.credits?.composers?.length || result.credits?.lyricists?.length),
      message: acousticData ? 'Full data retrieved' : 'Basic info only (no acoustic data)'
    })
    
  } catch (error) {
    console.error('MusicBrainz error:', error)
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

// 從 MusicBrainz 數據提取作曲填詞（從 recording 同 work 關聯）
function extractCredits(detailsData, workData) {
  const credits = {
    composers: [],
    lyricists: [],
    arrangers: [],
    producers: []
  }
  
  // 1. 先從 recording relations 搵
  if (detailsData?.relations) {
    detailsData.relations.forEach(rel => {
      if (rel.type === 'composer' || rel.type === 'writer') {
        credits.composers.push(rel.artist?.name)
      }
      if (rel.type === 'lyricist') {
        credits.lyricists.push(rel.artist?.name)
      }
      if (rel.type === 'arranger') {
        credits.arrangers.push(rel.artist?.name)
      }
      if (rel.type === 'producer') {
        credits.producers.push(rel.artist?.name)
      }
    })
  }
  
  // 2. 再從 work relations 搵（作曲填詞通常喺度）
  if (workData?.relations) {
    workData.relations.forEach(rel => {
      if (rel.type === 'composer' || rel.type === 'writer') {
        credits.composers.push(rel.artist?.name)
      }
      if (rel.type === 'lyricist') {
        credits.lyricists.push(rel.artist?.name)
      }
      if (rel.type === 'arranger') {
        credits.arrangers.push(rel.artist?.name)
      }
    })
  }
  
  // 去重
  credits.composers = [...new Set(credits.composers.filter(Boolean))]
  credits.lyricists = [...new Set(credits.lyricists.filter(Boolean))]
  credits.arrangers = [...new Set(credits.arrangers.filter(Boolean))]
  credits.producers = [...new Set(credits.producers.filter(Boolean))]
  
  return credits
}

// 從 AcousticBrainz 提取 BPM
function extractBPM(acousticData) {
  // AcousticBrainz 節奏分析
  const rhythm = acousticData?.rhythm
  if (rhythm?.bpm) {
    return Math.round(rhythm.bpm)
  }
  return null
}

// 從 AcousticBrainz 提取 Key
function extractKey(acousticData) {
  const tonal = acousticData?.tonal
  if (tonal?.key_key && tonal?.key_scale) {
    const scale = tonal.key_scale === 'minor' ? 'm' : ''
    return tonal.key_key + scale
  }
  return null
}

// 提取和弦資訊
function extractChords(acousticData) {
  const tonal = acousticData?.tonal
  if (tonal?.chords_key) {
    return tonal.chords_key
  }
  return null
}

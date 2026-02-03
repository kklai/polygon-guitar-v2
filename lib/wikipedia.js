// Wikipedia 歌手資料搜尋
export async function searchArtistFromWikipedia(artistName) {
  if (!artistName?.trim()) return null;
  
  try {
    // 試中文維基（繁體偏好）
    const response = await fetch(
      `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artistName)}`,
      { 
        headers: { 
          'Accept-Language': 'zh-HK,zh-TW;q=0.9,zh-CN;q=0.8',
          'User-Agent': 'PolygonGuitar/1.0'
        } 
      }
    );
    
    const data = await response.json();
    
    // 如果搵唔到或係消歧義頁
    if (data.type === 'disambiguation' || !data.extract) {
      // 試加 " (歌手)" 後綴
      const singerResponse = await fetch(
        `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artistName + ' (歌手)')}`,
        { headers: { 'Accept-Language': 'zh-HK,zh-TW' } }
      );
      const singerData = await singerResponse.json();
      if (singerData.extract) return parseArtistData(singerData);
      
      // 試加 " (樂隊)" 後綴
      const bandResponse = await fetch(
        `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artistName + ' (樂隊)')}`,
        { headers: { 'Accept-Language': 'zh-HK,zh-TW' } }
      );
      const bandData = await bandResponse.json();
      if (bandData.extract) return parseArtistData(bandData);
      
      // 試加 " (組合)" 後綴
      const groupResponse = await fetch(
        `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artistName + ' (組合)')}`,
        { headers: { 'Accept-Language': 'zh-HK,zh-TW' } }
      );
      const groupData = await groupResponse.json();
      if (groupData.extract) return parseArtistData(groupData);
      
      return null;
    }
    
    return parseArtistData(data);
    
  } catch (error) {
    console.error('Wikipedia search error:', error);
    return null;
  }
}

// 解析維基資料
function parseArtistData(data) {
  // 搵年份（出道/出生年份）
  const yearMatch = data.extract.match(/(\d{4})[年歲]/);
  const year = yearMatch ? yearMatch[1] : null;
  
  // 搵類別（歌手、樂隊等）
  const description = data.description || '';
  
  // 推斷歌手類型
  let artistType = 'unknown';
  const descLower = description.toLowerCase();
  const titleLower = data.title.toLowerCase();
  
  if (descLower.includes('組合') || descLower.includes('樂隊') || descLower.includes('band') || descLower.includes('group')) {
    artistType = 'group';
  } else if (descLower.includes('男歌手') || descLower.includes('男')) {
    artistType = 'male';
  } else if (descLower.includes('女歌手') || descLower.includes('女')) {
    artistType = 'female';
  }
  
  return {
    name: data.title,
    photo: data.thumbnail?.source || null,
    bio: data.extract.substring(0, 300),
    year: year,
    artistType: artistType,
    description: description,
    wikipediaUrl: data.content_urls?.desktop?.page
  };
}

// ============ 歌曲資訊搜尋 ============
export async function searchSongInfo(artistName, songTitle) {
  if (!artistName?.trim() || !songTitle?.trim()) return null;
  
  try {
    // 搜尋歌曲頁面（多種組合嘗試）
    const searchQueries = [
      `${songTitle} (${artistName}歌曲)`,
      `${songTitle} (${artistName})`,
      `${songTitle} (歌曲)`,
      songTitle
    ];
    
    for (const query of searchQueries) {
      const data = await tryFetchSongPage(query, artistName);
      if (data) return data;
    }
    
    return null;
    
  } catch (error) {
    console.error('Song search error:', error);
    return null;
  }
}

async function tryFetchSongPage(title, artistName) {
  // 先試中文維基
  const zhData = await tryFetchFromWiki(title, artistName, 'zh');
  if (zhData) return zhData;
  
  // 再試粵語維基（香港歌曲常見）
  const yueData = await tryFetchFromWiki(title, artistName, 'zh-yue');
  if (yueData) return yueData;
  
  return null;
}

async function tryFetchFromWiki(title, artistName, lang) {
  try {
    const response = await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { 
        headers: { 
          'Accept-Language': 'zh-HK,zh-TW;q=0.9,zh-CN;q=0.8',
          'User-Agent': 'PolygonGuitar/1.0'
        } 
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    // 確認係咪歌曲相關頁面
    if (!data.extract) return null;
    
    // 檢查內容是否包含歌曲關鍵字或歌手名
    const extractLower = data.extract.toLowerCase();
    const artistLower = artistName.toLowerCase();
    
    const isSongPage = 
      data.description?.toLowerCase().includes('歌曲') ||
      data.description?.toLowerCase().includes('單曲') ||
      extractLower.includes('歌曲') ||
      extractLower.includes('作曲') ||
      extractLower.includes('填詞') ||
      extractLower.includes(artistLower);
    
    if (!isSongPage) return null;
    
    return parseSongData(data, artistName);
    
  } catch (error) {
    return null;
  }
}

function parseSongData(data, artistName) {
  const extract = data.extract;
  
  // 搵年份（支援多種格式）
  const yearMatch = extract.match(/(\d{4})[年]?/) || 
                   extract.match(/(\d{4})\s*年/) ||
                   extract.match(/[《『](\d{4})[』》]/);
  const year = yearMatch ? yearMatch[1] : null;
  
  // 搵作曲（支援多種分隔符同格式）
  const composerMatch = extract.match(/作曲[：:]\s*([^，。；\n]+)/) || 
                       extract.match(/作曲[人家]*[：:]\s*([^，。；\n]+)/) ||
                       extract.match(/曲[：:]\s*([^，。；\n]+)/);
  const composer = composerMatch ? composerMatch[1].trim() : null;
  
  // 搵填詞（支援多種分隔符同格式）
  const lyricistMatch = extract.match(/填[詞词][：:]\s*([^，。；\n]+)/) || 
                       extract.match(/作[詞词][：:]\s*([^，。；\n]+)/) ||
                       extract.match(/[詞词][：:]\s*([^，。；\n]+)/);
  const lyricist = lyricistMatch ? lyricistMatch[1].trim() : null;
  
  // 搵編曲
  const arrangerMatch = extract.match(/編曲[：:]\s*([^，。；\n]+)/) ||
                       extract.match(/編[：:]\s*([^，。；\n]+)/);
  const arranger = arrangerMatch ? arrangerMatch[1].trim() : null;
  
  // 搵監製
  const producerMatch = extract.match(/監製[：:]\s*([^，。；\n]+)/) ||
                       extract.match(/監[製制][：:]\s*([^，。；\n]+)/) ||
                       extract.match(/製作人[：:]\s*([^，。；\n]+)/);
  const producer = producerMatch ? producerMatch[1].trim() : null;
  
  // 搵專輯（支援多種格式）
  const albumMatch = extract.match(/專[輯辑][《『]?([^』》]+)[』》]?/) ||
                    extract.match(/收錄[於于][《『]?([^』》]+)[』》]?/) ||
                    extract.match(/[《『]([^』》]+)[』》]/) ||
                    extract.match(/專[輯辑][：:]\s*([^，。\n]+)/);
  const album = albumMatch ? albumMatch[1].trim() : null;
  
  return {
    title: data.title.replace(` (${artistName}歌曲)`, '').replace(` (${artistName})`, ''),
    year: year,
    composer: composer,
    lyricist: lyricist,
    arranger: arranger,
    producer: producer,
    album: album,
    description: data.description || '',
    wikipediaUrl: data.content_urls?.desktop?.page
  };
}

// ============ YouTube 搜尋 ============
export function getYouTubeSearchUrl(artistName, songTitle) {
  const query = encodeURIComponent(`${artistName} ${songTitle}`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

export function getYouTubeEmbedUrl(videoId) {
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}`;
}

// 從 URL 提取 Video ID
export function extractYouTubeVideoId(url) {
  if (!url) return null;
  
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/shorts\/([^?]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

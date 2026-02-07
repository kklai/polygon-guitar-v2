// 提取核心歌手名（淨係中文名）
function extractCoreName(artistName) {
  if (!artistName) return '';
  
  // 移除括號內容，例如「陳奕迅 (歌手)」→「陳奕迅」
  let name = artistName.replace(/\s*[\(（].*?[\)）]\s*/g, '');
  
  // 提取連續中文字符（通常係歌手名）
  const chineseMatch = name.match(/[\u4e00-\u9fa5]{2,}/);
  if (chineseMatch) {
    return chineseMatch[0];
  }
  
  // 如果冇中文，返第一個詞（可能係英文名）
  return name.trim().split(/\s+/)[0];
}

// 生成搜尋變體
function generateNameVariants(artistName) {
  const variants = [artistName];
  const coreName = extractCoreName(artistName);
  
  if (coreName && coreName !== artistName) {
    variants.push(coreName);
  }
  
  return variants;
}

// Wikipedia 歌手資料搜尋
export async function searchArtistFromWikipedia(artistName) {
  if (!artistName?.trim()) return null;
  
  // 生成多種搜尋變體
  const nameVariants = generateNameVariants(artistName);
  
  try {
    // 嘗試每個變體
    for (const name of nameVariants) {
      // 試原始名稱
      const data = await tryFetchArtist(name);
      if (data) return data;
    }
    
    return null;
    
  } catch (error) {
    console.error('Wikipedia search error:', error);
    return null;
  }
}

// 嘗試搜尋歌手
async function tryFetchArtist(artistName) {
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
  
  if (!response.ok) return null;
  
  const data = await response.json();
  
  // 成功搵到資料
  if (data.extract && data.type !== 'disambiguation') {
    return parseArtistData(data);
  }
  
  // 如果搵唔到或係消歧義頁，試加後綴
  if (data.type === 'disambiguation' || !data.extract) {
    const suffixes = [' (歌手)', ' (藝人)', ' (樂隊)', ' (組合)'];
    
    for (const suffix of suffixes) {
      const response = await fetch(
        `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artistName + suffix)}`,
        { headers: { 'Accept-Language': 'zh-HK,zh-TW' } }
      );
      
      if (!response.ok) continue;
      
      const suffixData = await response.json();
      if (suffixData.extract) {
        return parseArtistData(suffixData);
      }
    }
  }
  
  return null;
}

// 解析維基資料
function parseArtistData(data) {
  const extract = data.extract || '';
  const description = data.description || '';
  
  // 搵出生年份（通常格式：1990年出生、生於1990年）
  let birthYear = null;
  const birthPatterns = [
    /(\d{4})年\s*出生/,
    /生[於于]\s*(\d{4})年/,
    /出生[於于]\s*(\d{4})年/,
    /(\d{4})年\s*生[，。]/,
    /(\d{4})年\s*出生[，。]/
  ];
  
  for (const pattern of birthPatterns) {
    const match = extract.match(pattern);
    if (match) {
      birthYear = match[1];
      break;
    }
  }
  
  // 搵出道年份（通常格式：2010年出道、2015年推出首張專輯）
  let debutYear = null;
  const debutPatterns = [
    /(\d{4})年\s*出道/,
    /(\d{4})年\s*推出.*首.*[尯辑輯]/,
    /(\d{4})年\s*發.*首.*[尯辑輯]/,
    /(\d{4})年\s*加盟/,
    /(\d{4})年\s*簽約/
  ];
  
  for (const pattern of debutPatterns) {
    const match = extract.match(pattern);
    if (match) {
      debutYear = match[1];
      break;
    }
  }
  
  // 如果沒有出道年份，但有其他年份提到，嘗試提取
  if (!debutYear) {
    const yearMatches = extract.match(/(\d{4})年/g);
    if (yearMatches) {
      // 過濾掉出生年份，找其他年份
      const years = yearMatches.map(m => m.replace('年', ''));
      const otherYears = years.filter(y => y !== birthYear);
      if (otherYears.length > 0) {
        // 取第一個非出生年份作為參考
        debutYear = otherYears[0];
      }
    }
  }
  
  // 搵類別（歌手、樂隊等）
  let artistType = 'unknown';
  const descLower = description.toLowerCase();
  
  if (descLower.includes('組合') || descLower.includes('樂隊') || descLower.includes('band') || descLower.includes('group')) {
    artistType = 'group';
  } else if (descLower.includes('男歌手') || descLower.includes('男')) {
    artistType = 'male';
  } else if (descLower.includes('女歌手') || descLower.includes('女')) {
    artistType = 'female';
  }
  
  // 清理歌手名：移除括號內容（如「王傑 (1962年)」→「王傑」）
  const cleanName = extractCoreName(data.title);
  
  return {
    name: cleanName,
    photo: data.thumbnail?.source || null,
    bio: extract.substring(0, 300),
    birthYear: birthYear,
    debutYear: debutYear,
    year: debutYear || birthYear, // 保持向後兼容
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

// 多來源歌曲資訊搜尋
// 支援：Wikipedia (中文/粵語) + 其他來源

const WIKIPEDIA_SOURCES = [
  { lang: 'zh', name: '中文維基' },
  { lang: 'zh-yue', name: '粵語維基' }
];

/**
 * 從多個來源搜尋歌曲資訊
 */
export async function searchSongInfoFromMultipleSources(artistName, songTitle) {
  if (!artistName?.trim() || !songTitle?.trim()) return null;

  console.log(`搜尋歌曲資料：${artistName} - ${songTitle}`);

  // 1. 先試 Wikipedia 多語言版本
  for (const source of WIKIPEDIA_SOURCES) {
    const data = await searchWikipediaEnhanced(artistName, songTitle, source.lang);
    if (data && hasSongDetails(data)) {
      console.log(`✓ 從 ${source.name} 搵到詳細資料`);
      return { ...data, source: `Wikipedia (${source.name})` };
    }
  }

  // 2. 嘗試合併搜尋（攞取最多資料）
  const mergedData = await mergeSearchResults(artistName, songTitle);
  if (mergedData && hasAnyInfo(mergedData)) {
    console.log(`✓ 從合併搜尋搵到資料`);
    return { ...mergedData, source: '合併搜尋結果' };
  }

  console.log(`✗ 搵唔到歌曲資料`);
  return null;
}

/**
 * 強化版維基百科搜尋（獲取完整內容）
 */
async function searchWikipediaEnhanced(artistName, songTitle, lang) {
  const searchQueries = [
    `${songTitle} (${artistName}歌曲)`,
    `${songTitle} (${artistName})`,
    `${songTitle} (歌曲)`,
    songTitle
  ];

  for (const query of searchQueries) {
    try {
      // 1. 先用 REST API 搵頁面
      const summaryResponse = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
        {
          headers: {
            'Accept-Language': 'zh-HK,zh-TW;q=0.9,zh-CN;q=0.8',
            'User-Agent': 'PolygonGuitar/1.0'
          }
        }
      );

      if (!summaryResponse.ok) continue;

      const summaryData = await summaryResponse.json();
      if (!summaryData.title) continue;

      // 2. 嘗試獲取完整頁面內容（使用 action=parse API）
      const pageTitle = summaryData.title;
      const fullContent = await fetchWikipediaFullContent(pageTitle, lang);

      // 3. 合併摘要同完整內容進行解析
      const combinedText = fullContent || summaryData.extract;

      // 驗證係咪歌曲相關
      const isSongPage = verifySongPage(summaryData, combinedText);
      if (!isSongPage) continue;

      // 4. 解析資料
      const parsedData = parseSongDataEnhanced(combinedText, summaryData);
      parsedData.title = summaryData.title.replace(` (${artistName}歌曲)`, '').replace(` (${artistName})`, '');
      parsedData.wikipediaUrl = summaryData.content_urls?.desktop?.page;

      return parsedData;

    } catch (error) {
      console.error(`Wikipedia ${lang} search error for "${query}":`, error);
    }
  }

  return null;
}

/**
 * 獲取維基百科完整頁面內容
 */
async function fetchWikipediaFullContent(title, lang) {
  try {
    const response = await fetch(
      `https://${lang}.wikipedia.org/w/api.php?` +
      `action=parse&` +
      `page=${encodeURIComponent(title)}&` +
      `prop=text&` +
      `format=json&` +
      `origin=*`,
      {
        headers: {
          'User-Agent': 'PolygonGuitar/1.0'
        }
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.parse?.text?.['*']) {
      // 將 HTML 轉為純文字
      const html = data.parse.text['*'];
      return htmlToText(html);
    }
  } catch (error) {
    console.error('Fetch full content error:', error);
  }
  return null;
}

/**
 * 簡單 HTML 轉文字
 */
function htmlToText(html) {
  // 移除 script 同 style
  let text = html.replace(/<script[^>]*>.*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>.*?<\/style>/gi, '');

  // 將表格轉為文字（資訊框通常係表格）
  text = text.replace(/<tr[^>]*>/gi, '\n');
  text = text.replace(/<td[^>]*>/gi, ' ');
  text = text.replace(/<th[^>]*>/gi, ' ');

  // 其他標籤
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<p[^>]*>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '\n• ');

  // 移除所有剩餘標籤
  text = text.replace(/<[^>]+>/g, ' ');

  // 清理空白
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/\n\s*\n/g, '\n');
  text = text.replace(/\s+/g, ' ');

  return text.trim();
}

/**
 * 驗證係咪歌曲頁面
 */
function verifySongPage(summaryData, content) {
  const desc = (summaryData.description || '').toLowerCase();
  const text = (content || '').toLowerCase();

  return desc.includes('歌曲') ||
         desc.includes('單曲') ||
         desc.includes('音樂') ||
         text.includes('作曲') ||
         text.includes('填詞') ||
         text.includes('主唱');
}

/**
 * 強化版資料解析
 */
function parseSongDataEnhanced(text, summaryData) {
  // 年份
  const yearPatterns = [
    /(\d{4})[年]?/,                           // 2016年
    /發行[於于].*?(\d{4})/,                   // 發行於 2016
    /出版[於于].*?(\d{4})/,                   // 出版於 2016
    /推[出介].*?(\d{4})/,                     // 推出 2016
    /[《『](\d{4})[』》]/                      // 《2016》
  ];

  let year = null;
  for (const pattern of yearPatterns) {
    const match = text.match(pattern);
    if (match) {
      year = match[1];
      break;
    }
  }

  // 作曲 - 多種格式
  const composer = extractField(text, [
    /作曲[：:]\s*([^，。；\n\(\[【]+)/,
    /作曲[人]\s*[:：]\s*([^，。；\n\(\[【]+)/,
    /曲\s*[:：]\s*([^，。；\n\(\[【]{2,20})/,  // 至少2個字
    /music\s*by[：:]\s*([^，。；\n\(\[【]+)/i,
    /composed\s*by[：:]\s*([^，。；\n\(\[【]+)/i,
    /composer[：:]\s*([^，。；\n\(\[【]+)/i
  ]);

  // 填詞/作詞
  const lyricist = extractField(text, [
    /填[詞词][：:]\s*([^，。；\n\(\[【]+)/,
    /作[詞词][：:]\s*([^，。；\n\(\[【]+)/,
    /[詞词][：:]\s*([^，。；\n\(\[【]{2,20})/,
    /lyrics?\s*by[：:]\s*([^，。；\n\(\[【]+)/i,
    /written\s*by[：:]\s*([^，。；\n\(\[【]+)/i,
    /lyricist[：:]\s*([^，。；\n\(\[【]+)/i
  ]);

  // 編曲
  const arranger = extractField(text, [
    /編曲[：:]\s*([^，。；\n\(\[【]+)/,
    /編[：:]\s*([^，。；\n\(\[【]{2,20})/,
    /arranged\s*by[：:]\s*([^，。；\n\(\[【]+)/i,
    /arrangement[：:]\s*([^，。；\n\(\[【]+)/i,
    /arranger[：:]\s*([^，。；\n\(\[【]+)/i
  ]);

  // 監製
  const producer = extractField(text, [
    /監製[：:]\s*([^，。；\n\(\[【]+)/,
    /監[製制][：:]\s*([^，。；\n\(\[【]+)/,
    /製作人[：:]\s*([^，。；\n\(\[【]+)/,
    /producer[：:]\s*([^，。；\n\(\[【]+)/i,
    /produced\s*by[：:]\s*([^，。；\n\(\[【]+)/i
  ]);

  // 專輯
  const album = extractField(text, [
    /專[輯辑][《『]?([^』》]{2,30})[』》]?/,
    /收錄[於于][《『]?([^』》]{2,30})[』》]?/,
    /[《『]([^』》]{2,30})[』》][^》]*專[輯辑]/,
    /album[：:]\s*([^，。\n]{2,30})/i,
    /from\s*the\s*album[《『]?([^』》]{2,30})[』》]?/i
  ]);

  // BPM
  const bpm = extractBPM(text);

  return {
    year,
    composer,
    lyricist,
    arranger,
    producer,
    album,
    bpm,
    description: summaryData.description || '',
    wikipediaUrl: summaryData.content_urls?.desktop?.page
  };
}

/**
 * 從多個 pattern 提取欄位
 */
function extractField(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const value = cleanValue(match[1]);
      if (value && value.length >= 2) {  // 至少2個字
        return value;
      }
    }
  }
  return null;
}

/**
 * 提取 BPM
 */
function extractBPM(text) {
  const patterns = [
    /(\d{2,3})\s*BPM/i,
    /BPM[：:]\s*(\d{2,3})/,
    /拍[子速].*?(\d{2,3})/,
    /tempo[：:]\s*(\d{2,3})/i,
    /(\d{2,3})\s*beats?\s*per\s*minute/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const bpm = parseInt(match[1]);
      if (bpm >= 40 && bpm <= 250) {  // 合理 BPM 範圍
        return bpm.toString();
      }
    }
  }
  return null;
}

/**
 * 清理數值
 */
function cleanValue(value) {
  if (!value) return null;
  return value
    .replace(/[\(\[【].*?[\)\]】]/g, '')
    .replace(/[、，。；]/g, '')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 檢查係咪有歌曲詳細資料
 */
function hasSongDetails(data) {
  return data.composer || data.lyricist || data.arranger || data.producer;
}

/**
 * 檢查係咪有任何資訊
 */
function hasAnyInfo(data) {
  return data.year || data.composer || data.lyricist || data.arranger ||
         data.producer || data.album || data.bpm;
}

/**
 * 合併多個搜尋結果
 */
async function mergeSearchResults(artistName, songTitle) {
  const results = [];

  for (const source of WIKIPEDIA_SOURCES) {
    const data = await searchWikipediaEnhanced(artistName, songTitle, source.lang);
    if (data) results.push(data);
  }

  if (results.length === 0) return null;

  // 合併結果：取每個欄位第一個非空值
  const merged = {
    title: results[0].title,
    year: results.find(r => r.year)?.year || null,
    composer: results.find(r => r.composer)?.composer || null,
    lyricist: results.find(r => r.lyricist)?.lyricist || null,
    arranger: results.find(r => r.arranger)?.arranger || null,
    producer: results.find(r => r.producer)?.producer || null,
    album: results.find(r => r.album)?.album || null,
    bpm: results.find(r => r.bpm)?.bpm || null,
    description: results[0].description || '',
    wikipediaUrl: results.find(r => r.wikipediaUrl)?.wikipediaUrl || ''
  };

  return merged;
}

// 向後兼容
export { searchSongInfoFromMultipleSources as searchSongInfo };

// 智能歌手名匹配算法
// 學習用戶手動處理嘅模式，提供更聰明嘅匹配

// 簡繁轉換對照表（常見字）
const TRADITIONAL_TO_SIMPLIFIED = {
  '陳': '陳', '澤': '泽', '賢': '贤', '偉': '伟', '傑': '杰',
  '詠': '咏', '詩': '诗', '語': '语', '謙': '谦', '讓': '让',
  '樂': '乐', '東': '东', '馬': '马', '鳥': '鸟', '魚': '鱼',
  '歸': '归', '綽': '绰', '嶢': '嶢', '關': '关', '務': '务',
  '見': '见', '記': '记', '話': '话', '說': '说', '誰': '话',
  '頭': '头', '發': '发', '長': '长', '門': '门', '馬': '马'
};

// 常見變體對照
const COMMON_VARIANTS = {
  '陳奕迅': ['陳奕迅', 'Eason Chan', '陳奕迅 Eason Chan', 'Eason Chan 陳奕迅'],
  '周杰倫': ['周杰倫', 'Jay Chou', '周杰倫 Jay Chou'],
  '林俊傑': ['林俊傑', 'JJ Lin', '林俊傑 JJ Lin'],
  '張學友': ['張學友', 'Jacky Cheung'],
  '劉德華': ['劉德華', 'Andy Lau'],
  '張國榮': ['張國榮', 'Leslie Cheung'],
  '梅艷芳': ['梅艷芳', 'Anita Mui'],
  'Beyond': ['Beyond', 'beyond'],
};

// 計算 Levenshtein 距離（編輯距離）
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // 刪除
        matrix[i][j - 1] + 1,      // 插入
        matrix[i - 1][j - 1] + cost // 替換
      );
    }
  }

  return matrix[len1][len2];
}

// 計算相似度（0-1）
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(s1, s2);
  return 1 - distance / maxLen;
}

// 轉換簡體為繁體（反向查找）
function toTraditional(chinese) {
  let result = chinese;
  for (const [trad, simp] of Object.entries(TRADITIONAL_TO_SIMPLIFIED)) {
    result = result.replace(new RegExp(simp, 'g'), trad);
  }
  return result;
}

// 轉換繁體為簡體
function toSimplified(chinese) {
  let result = chinese;
  for (const [trad, simp] of Object.entries(TRADITIONAL_TO_SIMPLIFIED)) {
    result = result.replace(new RegExp(trad, 'g'), simp);
  }
  return result;
}

// 解析雙語名（改進版）
export function parseBilingualNameImproved(artistName) {
  if (!artistName || artistName === 'Unknown') return { preferred: artistName };
  
  const prefixes = ['MK三部曲', 'EP', 'Album', 'Single', '新歌', '新碟', '大碟', '專輯', 'OST', '主題曲', '插曲'];
  let cleanName = artistName;
  
  // 移除前綴
  for (const prefix of prefixes) {
    const regex = new RegExp(`^${prefix}\\s*[-:]?\\s*`, 'i');
    cleanName = cleanName.replace(regex, '');
  }
  
  cleanName = cleanName.trim();
  
  // 標準化：移除多餘空格
  cleanName = cleanName.replace(/\s+/g, ' ');
  
  // 匹配 "中文名 英文名"（支援 2-5 個中文字）
  const chineseFirstMatch = cleanName.match(/^([\u4e00-\u9fa5]{2,5})\s+([a-zA-Z][a-zA-Z\s]+)$/i);
  if (chineseFirstMatch) {
    const chinese = chineseFirstMatch[1].trim();
    return {
      chinese: chinese,
      chineseSimplified: toSimplified(chinese),
      chineseTraditional: toTraditional(chinese),
      english: chineseFirstMatch[2].trim(),
      preferred: chinese,
      fullName: cleanName
    };
  }
  
  // 匹配 "英文名 中文名"
  const englishFirstMatch = cleanName.match(/^([a-zA-Z][a-zA-Z\s]+)\s+([\u4e00-\u9fa5]{2,5})$/i);
  if (englishFirstMatch) {
    const chinese = englishFirstMatch[2].trim();
    return {
      english: englishFirstMatch[1].trim(),
      chinese: chinese,
      chineseSimplified: toSimplified(chinese),
      chineseTraditional: toTraditional(chinese),
      preferred: chinese,
      fullName: cleanName
    };
  }
  
  // 純中文
  if (/^[\u4e00-\u9fa5]+$/.test(cleanName)) {
    return { 
      chinese: cleanName, 
      chineseSimplified: toSimplified(cleanName),
      chineseTraditional: toTraditional(cleanName),
      preferred: cleanName,
      fullName: cleanName
    };
  }
  
  // 純英文
  if (/^[a-zA-Z\s]+$/.test(cleanName)) {
    return { 
      english: cleanName, 
      preferred: cleanName,
      fullName: cleanName
    };
  }
  
  return { preferred: cleanName, fullName: cleanName };
}

// 智能匹配兩個歌手名
export function isArtistMatch(artist1, artist2, threshold = 0.8) {
  const name1 = typeof artist1 === 'string' ? artist1 : artist1.name;
  const name2 = typeof artist2 === 'string' ? artist2 : artist2.name;
  
  if (!name1 || !name2) return false;
  
  const parsed1 = parseBilingualNameImproved(name1);
  const parsed2 = parseBilingualNameImproved(name2);
  
  // 1. 完全匹配
  if (name1.toLowerCase().trim() === name2.toLowerCase().trim()) {
    return { match: true, confidence: 1, reason: 'exact' };
  }
  
  // 2. 中文名匹配（包括簡繁轉換）
  if (parsed1.chinese && parsed2.chinese) {
    // 完全匹配
    if (parsed1.chinese === parsed2.chinese) {
      return { match: true, confidence: 1, reason: 'chinese_exact' };
    }
    // 簡繁轉換後匹配
    if (parsed1.chineseSimplified === parsed2.chineseSimplified ||
        parsed1.chineseTraditional === parsed2.chineseTraditional) {
      return { match: true, confidence: 0.95, reason: 'chinese_traditional_simplified' };
    }
    // 相似度匹配（容錯一個字）
    const chineseSim = calculateSimilarity(parsed1.chinese, parsed2.chinese);
    if (chineseSim >= threshold) {
      return { match: true, confidence: chineseSim, reason: 'chinese_similar' };
    }
  }
  
  // 3. 英文名匹配
  if (parsed1.english && parsed2.english) {
    const englishSim = calculateSimilarity(parsed1.english, parsed2.english);
    if (englishSim >= threshold) {
      return { match: true, confidence: englishSim, reason: 'english_similar' };
    }
    // 部分匹配（例如 "Eason Chan" vs "Eason"）
    const e1 = parsed1.english.toLowerCase();
    const e2 = parsed2.english.toLowerCase();
    if (e1.includes(e2) || e2.includes(e1)) {
      const minLen = Math.min(e1.length, e2.length);
      const maxLen = Math.max(e1.length, e2.length);
      if (minLen / maxLen >= 0.6) { // 較長名包含較短名
        return { match: true, confidence: 0.85, reason: 'english_partial' };
      }
    }
  }
  
  // 4. 整體名稱相似度
  const fullSim = calculateSimilarity(name1, name2);
  if (fullSim >= threshold) {
    return { match: true, confidence: fullSim, reason: 'full_name_similar' };
  }
  
  // 5. 檢查常見變體表
  for (const [key, variants] of Object.entries(COMMON_VARIANTS)) {
    const inVariants1 = variants.some(v => 
      name1.toLowerCase().includes(v.toLowerCase()) || 
      v.toLowerCase().includes(name1.toLowerCase())
    );
    const inVariants2 = variants.some(v => 
      name2.toLowerCase().includes(v.toLowerCase()) || 
      v.toLowerCase().includes(name2.toLowerCase())
    );
    if (inVariants1 && inVariants2) {
      return { match: true, confidence: 0.9, reason: 'common_variant' };
    }
  }
  
  return { match: false, confidence: fullSim };
}

// 為一個歌手找到所有可能嘅匹配
export function findMatchesForArtist(targetArtist, allArtists, threshold = 0.8) {
  const matches = [];
  
  for (const candidate of allArtists) {
    if (candidate.id === targetArtist.id) continue;
    
    const result = isArtistMatch(targetArtist, candidate, threshold);
    if (result.match) {
      matches.push({
        artist: candidate,
        confidence: result.confidence,
        reason: result.reason
      });
    }
  }
  
  // 按信心度排序
  return matches.sort((a, b) => b.confidence - a.confidence);
}

// 生成建議嘅合併操作
export function generateMergeSuggestions(artists) {
  const suggestions = [];
  const processed = new Set();
  
  for (const artist of artists) {
    if (processed.has(artist.id)) continue;
    
    const matches = findMatchesForArtist(artist, artists, 0.75);
    
    if (matches.length > 0) {
      const group = [artist, ...matches.map(m => m.artist)];
      suggestions.push({
        primary: artist,
        matches: matches,
        allArtists: group,
        confidence: matches[0].confidence
      });
      
      // 標記所有相關歌手為已處理
      processed.add(artist.id);
      matches.forEach(m => processed.add(m.artist.id));
    }
  }
  
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

// 導出測試函數
export function testMatcher(name1, name2) {
  const result = isArtistMatch(name1, name2);
  console.log(`「${name1}」vs「${name2}」:`);
  console.log('  匹配:', result.match);
  console.log('  信心度:', result.confidence);
  console.log('  原因:', result.reason);
  return result;
}

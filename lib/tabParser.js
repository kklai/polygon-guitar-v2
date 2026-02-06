/**
 * 結他譜解析器 - 用於清理和格式化 Blogger 遷移的譜內容
 * 
 * 功能：
 * 1. 識別 Section Marker (Intro, Verse, Chorus, Bridge...)
 * 2. 區分和弦行與歌詞行
 * 3. 標準化格式
 */

// ============ Section Markers ============
const SECTION_MARKERS = [
  // 英文標準標記
  'Intro', 'Outro', 'Ending',
  'Verse', 'Verse 1', 'Verse 2', 'Verse 3', 'Verse 4',
  'Chorus', 'Chorus 1', 'Chorus 2', 'Chorus 3',
  'Prechorus', 'Pre-chorus', 'Pre Chorus', 'Pre Chorus 1', 'Pre Chorus 2',
  'Bridge', 'Middle 8',
  'Interlude', 'Instrumental',
  'Solo', 'Guitar Solo', 'Piano Solo',
  'Break', 'Music Break', 'instrumental',
  'Hook', 'Refrain',
  'Fade out', 'Fadeout',
  
  // 中文標記
  '前奏', '尾奏', '結尾',
  '主歌', '主歌一', '主歌二', '主歌1', '主歌2',
  '副歌', '副歌一', '副歌二', '副歌1', '副歌2',
  '導歌', '過門',
  '橋段', '間奏',
  '獨奏', '結他獨奏',
  '休息', '停頓',
  '漸弱', '淡出'
];

// 和弦模式 (用於識別和弦行)
const CHORD_PATTERN = /(\|[\s]*[A-G][#b]?|[\s/]*[A-G][#b]?)(m|maj|min|sus|dim|aug|add|m7|maj7|7|9|11|13|[0-9])*/g;

// ============ 核心工具函數 ============

/**
 * 檢查是否為 Section Marker 行
 */
function isSectionMarkerLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  
  // 檢查是否以任何 marker 開頭（不區分大小寫）
  return SECTION_MARKERS.some(marker => {
    const markerLower = marker.toLowerCase();
    const trimmedLower = trimmed.toLowerCase();
    
    // 精確匹配或開頭匹配
    return trimmedLower === markerLower || 
           trimmedLower.startsWith(markerLower + ' ') ||
           trimmedLower.startsWith(markerLower + ':') ||
           trimmedLower.startsWith(markerLower + '：');
  });
}

/**
 * 提取 Section Marker 和剩餘內容
 */
function extractSectionMarker(line) {
  const trimmed = line.trim();
  
  // 按長度排序，先匹配長的（避免 "Verse" 搶先匹配 "Verse 1"）
  const sortedMarkers = [...SECTION_MARKERS].sort((a, b) => b.length - a.length);
  
  for (const marker of sortedMarkers) {
    const markerLower = marker.toLowerCase();
    const trimmedLower = trimmed.toLowerCase();
    
    if (trimmedLower.startsWith(markerLower)) {
      // 找到 marker 後的內容
      let afterMarker = trimmed.substring(marker.length).trim();
      // 移除冒號
      afterMarker = afterMarker.replace(/^[:：]\s*/, '');
      
      return {
        isMarker: true,
        marker: marker,
        rest: afterMarker
      };
    }
  }
  
  return { isMarker: false, marker: '', rest: line };
}

/**
 * 檢查一行是否為純和弦行
 */
function isChordLine(line) {
  if (!line || !line.trim()) return false;
  
  const trimmed = line.trim();
  
  // 1. 檢查是否包含 Section Marker
  if (isSectionMarkerLine(trimmed)) {
    const { rest } = extractSectionMarker(trimmed);
    // 如果 marker 後面沒有內容，這不是和弦行
    if (!rest.trim()) return false;
    // 繼續檢查剩餘部分
    return isPureChordLine(rest);
  }
  
  return isPureChordLine(trimmed);
}

/**
 * 檢查是否為純和弦內容（不含歌詞）
 */
function isPureChordLine(text) {
  if (!text.trim()) return false;
  
  // 移除 | 和空格後檢查
  const cleaned = text.replace(/[|｜\s]/g, '');
  if (!cleaned) return false;
  
  // 計算中文字符比例
  const chineseChars = text.match(/[\u4e00-\u9fff]/g) || [];
  const chineseRatio = chineseChars.length / text.length;
  
  // 如果有超過 10% 中文字，不是純和弦行
  if (chineseRatio > 0.1) return false;
  
  // 檢查是否包含和弦模式
  const chordMatches = text.match(CHORD_PATTERN) || [];
  const hasChordSymbols = chordMatches.length >= 1;
  
  // 必須包含至少一個 A-G 開頭的詞
  const hasNoteNames = /[A-G][#b]?/.test(text);
  
  return hasChordSymbols && hasNoteNames;
}

/**
 * 檢查是否為歌詞行
 */
function isLyricLine(line) {
  if (!line || !line.trim()) return false;
  
  const trimmed = line.trim();
  
  // 1. 包含大量中文字符 = 歌詞
  const chineseChars = trimmed.match(/[\u4e00-\u9fff]/g) || [];
  const chineseRatio = chineseChars.length / trimmed.length;
  if (chineseRatio > 0.3) return true;
  
  // 2. 包含括號 (歌詞標記) = 可能是歌詞
  if (trimmed.includes('(') && trimmed.includes(')')) {
    // 檢查括號內容是否為中文字
    const bracketContent = trimmed.match(/\(([^)]*)\)/g) || [];
    for (const content of bracketContent) {
      const innerChinese = content.match(/[\u4e00-\u9fff]/g) || [];
      if (innerChinese.length > 0) return true;
    }
  }
  
  // 3. 沒有和弦符號，但有其他文字 = 歌詞
  const hasChordSymbols = /[A-G][#b]?/.test(trimmed);
  if (!hasChordSymbols && trimmed.length > 0) return true;
  
  return false;
}

/**
 * 檢查是否為混合行（和弦+歌詞在同一行）
 */
function isMixedLine(line) {
  if (!line || !line.trim()) return false;
  
  const trimmed = line.trim();
  
  // 必須包含括號（歌詞標記）
  if (!trimmed.includes('(')) return false;
  
  // 檢查是否有 Section Marker
  const sectionInfo = extractSectionMarker(trimmed);
  const contentToCheck = sectionInfo.isMarker ? sectionInfo.rest : trimmed;
  
  // 必須包含 | 開頭的和弦
  const hasChordBar = /\|[\s]*[A-G][#b]?/.test(contentToCheck);
  
  // 必須包含括號內的歌詞（括號內有中文字）
  const bracketMatches = contentToCheck.match(/\(([^)]*)\)/g) || [];
  let hasLyricInBrackets = false;
  for (const match of bracketMatches) {
    const innerContent = match.slice(1, -1); // 移除括號
    const chineseInBracket = innerContent.match(/[\u4e00-\u9fff]/g) || [];
    if (chineseInBracket.length > 0) {
      hasLyricInBrackets = true;
      break;
    }
  }
  
  return hasChordBar && hasLyricInBrackets;
}

/**
 * 清理單行內容
 */
function cleanLine(line) {
  return line
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // 移除零寬字符
    .trim();
}

/**
 * 標準化分隔符（將全形 | 轉為半形 |）
 */
function normalizeDividers(line) {
  return line.replace(/｜/g, '|').replace(/　/g, ' ');
}

/**
 * 譜內容解析結果類型
 */
const LINE_TYPES = {
  EMPTY: 'empty',           // 空行
  SECTION_MARKER: 'section', // Section Marker (Intro, Chorus...)
  CHORD: 'chord',           // 純和弦行
  LYRIC: 'lyric',           // 純歌詞行
  MIXED: 'mixed',           // 混合行（和弦+歌詞）
  UNKNOWN: 'unknown'        // 無法識別
};

/**
 * 分析單行類型
 */
function analyzeLine(line) {
  const cleaned = cleanLine(line);
  
  if (!cleaned) {
    return { type: LINE_TYPES.EMPTY, content: '', original: line };
  }
  
  // 1. 檢查 Section Marker
  if (isSectionMarkerLine(cleaned)) {
    const { marker, rest } = extractSectionMarker(cleaned);
    return {
      type: LINE_TYPES.SECTION_MARKER,
      content: cleaned,
      marker: marker,
      rest: rest,
      original: line
    };
  }
  
  // 2. 檢查混合行
  if (isMixedLine(cleaned)) {
    return {
      type: LINE_TYPES.MIXED,
      content: normalizeDividers(cleaned),
      original: line
    };
  }
  
  // 3. 檢查純和弦行
  if (isChordLine(cleaned)) {
    return {
      type: LINE_TYPES.CHORD,
      content: normalizeDividers(cleaned),
      original: line
    };
  }
  
  // 4. 檢查歌詞行
  if (isLyricLine(cleaned)) {
    return {
      type: LINE_TYPES.LYRIC,
      content: cleaned,
      original: line
    };
  }
  
  // 默認：當作歌詞行
  return {
    type: LINE_TYPES.LYRIC,
    content: cleaned,
    original: line
  };
}

/**
 * 主要函數：解析完整譜內容
 * 
 * @param {string} content - 原始譜內容
 * @returns {Object} 解析結果
 */
function parseTabContent(content) {
  if (!content) return { lines: [], pairs: [] };
  
  const rawLines = content.split('\n');
  const analyzedLines = rawLines.map(analyzeLine);
  
  // 將連續的和弦行+歌詞行配對
  const pairs = [];
  let i = 0;
  
  while (i < analyzedLines.length) {
    const current = analyzedLines[i];
    const next = analyzedLines[i + 1];
    
    // 跳過空行
    if (current.type === LINE_TYPES.EMPTY) {
      pairs.push({ type: 'empty', line: current });
      i++;
      continue;
    }
    
    // Section Marker 單獨處理
    if (current.type === LINE_TYPES.SECTION_MARKER) {
      pairs.push({
        type: 'section',
        marker: current.marker,
        rest: current.rest,
        original: current.original
      });
      i++;
      continue;
    }
    
    // 混合行處理
    if (current.type === LINE_TYPES.MIXED) {
      pairs.push({
        type: 'mixed',
        content: current.content,
        original: current.original
      });
      i++;
      continue;
    }
    
    // 和弦行 + 歌詞行 配對
    if (current.type === LINE_TYPES.CHORD && next && next.type === LINE_TYPES.LYRIC) {
      pairs.push({
        type: 'pair',
        chord: current.content,
        lyric: next.content,
        chordOriginal: current.original,
        lyricOriginal: next.original
      });
      i += 2;
      continue;
    }
    
    // 單獨和弦行
    if (current.type === LINE_TYPES.CHORD) {
      pairs.push({
        type: 'chord-only',
        chord: current.content,
        original: current.original
      });
      i++;
      continue;
    }
    
    // 單獨歌詞行
    if (current.type === LINE_TYPES.LYRIC) {
      pairs.push({
        type: 'lyric-only',
        lyric: current.content,
        original: current.original
      });
      i++;
      continue;
    }
    
    // 其他情況
    pairs.push({
      type: 'unknown',
      content: current.content,
      original: current.original
    });
    i++;
  }
  
  return {
    lines: analyzedLines,
    pairs: pairs
  };
}

/**
 * 格式化譜內容為標準格式
 */
function formatTabContent(content) {
  const { pairs } = parseTabContent(content);
  const lines = [];
  
  for (const pair of pairs) {
    switch (pair.type) {
      case 'empty':
        lines.push('');
        break;
        
      case 'section':
        if (pair.rest && pair.rest.trim()) {
          lines.push(`${pair.marker}: ${pair.rest}`);
        } else {
          lines.push(pair.marker);
        }
        break;
        
      case 'mixed':
        lines.push(pair.content);
        break;
        
      case 'pair':
        lines.push(pair.chord);
        lines.push(pair.lyric);
        break;
        
      case 'chord-only':
        lines.push(pair.chord);
        break;
        
      case 'lyric-only':
        lines.push(pair.lyric);
        break;
        
      default:
        lines.push(pair.content || pair.original || '');
    }
  }
  
  return lines.join('\n');
}

/**
 * 調試輸出：顯示解析結果
 */
function debugParse(content) {
  const { lines, pairs } = parseTabContent(content);
  
  console.log('=== 逐行分析 ===');
  lines.forEach((line, idx) => {
    console.log(`[${idx + 1}] ${line.type.padEnd(15)} | ${line.content.substring(0, 50)}`);
  });
  
  console.log('\n=== 配對結果 ===');
  pairs.forEach((pair, idx) => {
    console.log(`[${idx + 1}] ${pair.type}`);
    if (pair.type === 'pair') {
      console.log(`    和弦: ${pair.chord}`);
      console.log(`    歌詞: ${pair.lyric}`);
    } else if (pair.type === 'section') {
      console.log(`    Marker: ${pair.marker}`);
      if (pair.rest) console.log(`    內容: ${pair.rest}`);
    } else if (pair.type === 'mixed') {
      console.log(`    內容: ${pair.content}`);
    }
  });
  
  return { lines, pairs };
}

// ============ 導出 ============
module.exports = {
  // 核心函數
  parseTabContent,
  formatTabContent,
  analyzeLine,
  debugParse,
  
  // 類型檢查
  isSectionMarkerLine,
  isChordLine,
  isLyricLine,
  isMixedLine,
  
  // 工具函數
  extractSectionMarker,
  cleanLine,
  normalizeDividers,
  
  // 常數
  LINE_TYPES,
  SECTION_MARKERS
};

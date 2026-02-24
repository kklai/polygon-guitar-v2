/**
 * 結他譜對齊修正工具
 * 
 * 問題：Arial（比例字體）下對齊嘅譜，喺等寬字體下會錯位
 * 原因：Arial 入面中文字同英文字寬度比例，同等寬字體唔同
 * 
 * 解決方案：
 * 1. 計算 Arial 下每一行嘅「視覺起點」（第一個字符嘅水平位置）
 * 2. 將呢個視覺起點轉換為等寬字體下需要幾多「列」
 * 3. 調整歌詞行嘅空格，令佢喺等寬字體下對齊
 */

/**
 * 計算字符喺 Arial 下嘅寬度（相對於英文字符）
 */
function getCharWidthArial(char) {
  if (/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(char)) {
    // 中文字及全形字符：約 2.1 個英文字寬
    return 2.1;
  } else if (char === ' ') {
    // 空格：約 0.35 個英文字寬
    return 0.35;
  } else if (char === '|') {
    // | 符號：約 0.6 個英文字寬
    return 0.6;
  } else {
    // 其他半形字符（英文、數字、符號）：1 個英文字寬
    return 1.0;
  }
}

/**
 * 計算字符喺等寬字體下嘅列數
 */
function getCharColsMono(char) {
  if (/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(char)) {
    // 中文字及全形字符 = 2 列
    return 2;
  } else {
    // 半形字符 = 1 列
    return 1;
  }
}

/**
 * 計算一行在 Arial 下嘅總視覺寬度
 */
function getLineWidthArial(line) {
  let width = 0;
  for (const char of line) {
    width += getCharWidthArial(char);
  }
  return width;
}

/**
 * 計算一行在等寬字體下嘅總列數
 */
function getLineColsMono(line) {
  let cols = 0;
  for (const char of line) {
    cols += getCharColsMono(char);
  }
  return cols;
}

/**
 * 找出一行中第一個「內容」字符的「視覺起點」
 * 內容字符指：和弦、歌詞文字等（唔包括 | 同空格）
 * 返回：在 Arial 下嘅視覺寬度，同喺等寬字體下嘅列數
 */
function getContentStartPosition(line) {
  let arialWidth = 0;
  let monoCols = 0;
  let foundBar = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === ' ') {
      // 空格
      arialWidth += getCharWidthArial(char);
      monoCols += getCharColsMono(char);
    } else if (char === '|' && !foundBar) {
      // 第一個 |，跳過佢，繼續找
      foundBar = true;
      arialWidth += getCharWidthArial(char);
      monoCols += getCharColsMono(char);
    } else if (char === '|' && foundBar) {
      // 第二個 |，即係下一個小節，停止
      break;
    } else {
      // 找到內容字符（和弦或歌詞）
      return {
        arialWidth,
        monoCols,
        char: char,
        charWidthArial: getCharWidthArial(char),
        charColsMono: getCharColsMono(char),
        index: i
      };
    }
  }
  
  return null; // 找不到內容字符
}

/**
 * 檢測一行係唔係和弦行（包含和弦，但冇中文歌詞）
 */
function isChordLine(line) {
  if (!line || !line.trim()) return false;
  
  const trimmed = line.trim();
  
  // 如果有中文字，唔係純和弦行
  if (/[\u4e00-\u9fa5]/.test(trimmed)) return false;
  
  // 提取所有可能嘅和弦
  const content = trimmed.startsWith('|') ? trimmed.substring(1) : trimmed;
  const tokens = content.split(/\s+/).filter(t => t.length > 0 && t !== '|' && t !== '-');
  
  if (tokens.length === 0) return false;
  
  // 和弦 pattern
  const chordPattern = /^[A-G](?:#|b)?(?:m|M|maj|min|dim|aug|sus|add)?[0-9]*(?:\/[A-G](?:#|b)?)?$/;
  
  // 大部分 tokens 係和弦就算係和弦行
  const chordCount = tokens.filter(t => chordPattern.test(t)).length;
  return chordCount >= tokens.length * 0.5;
}

/**
 * 檢測係咪標記行（Verse, Chorus 等）
 */
function isMarkerLine(line) {
  if (!line) return false;
  const markers = ['verse', 'chorus', 'intro', 'outro', 'bridge', 'pre-chorus', 'solo', 'interlude', 'capo'];
  const trimmed = line.trim().toLowerCase();
  return markers.some(m => 
    trimmed === m || 
    trimmed.startsWith(m + ' ') || 
    trimmed.startsWith(m + ':') ||
    trimmed.match(/^\[.*?\]$/)
  );
}

/**
 * 對齊歌詞行到和弦行（帶可調參數）
 * 
 * 核心邏輯：
 * 1. 和弦行喺 Arial 下第一個「內容字符」（跳過 | 同空格）嘅視覺起點 = X
 * 2. 歌詞行應該喺等寬字體下達到相同嘅視覺效果
 * 3. 計算需要幾多個等寬空格
 * 
 * @param {string} chordLine - 和弦行
 * @param {string} lyricLine - 歌詞行  
 * @param {number} factor - 轉換因子（預設 1.1）
 */
function alignLyricToChord(chordLine, lyricLine, factor = 1.1) {
  if (!chordLine || !lyricLine) return lyricLine;
  
  const trimmedLyric = lyricLine.trimStart();
  if (!trimmedLyric) return lyricLine;
  
  // 如果歌詞行已有 | 開頭，視為已對齊
  if (trimmedLyric.startsWith('|')) return lyricLine;
  
  // 找到和弦行中第一個內容字符（跳過 | 同空格）嘅位置
  const chordPos = getContentStartPosition(chordLine);
  if (!chordPos) return lyricLine; // 和弦行冇內容
  
  // 找到歌詞行現有嘅第一個內容字符位置
  const lyricPos = getContentStartPosition(lyricLine);
  if (!lyricPos) {
    // 歌詞行冇內容，直接用和弦位置
    const spaces = ' '.repeat(Math.max(0, chordPos.monoCols));
    return spaces + trimmedLyric;
  }
  
  // 計算目標對齊位置
  // 和弦行喺 Arial 下第一個內容字符嘅視覺起點
  const targetArialWidth = chordPos.arialWidth;
  
  // 將呢個視覺寬度轉換為等寬字體下需要幾多「列」
  // 轉換比例：Arial 寬度 -> 等寬列數
  // 由於 Arial 入面空格較窄，需要放大轉換
  const targetMonoCols = Math.round(targetArialWidth * factor);
  
  // 計算歌詞行現有前導空格喺等寬字體下佔幾多列
  const currentMonoCols = lyricPos.monoCols;
  
  // 如果已經接近目標（誤差 <= 2），唔使改
  if (Math.abs(currentMonoCols - targetMonoCols) <= 2) {
    return lyricLine;
  }
  
  // 生成新嘅歌詞行
  const newSpaces = ' '.repeat(Math.max(0, targetMonoCols));
  return newSpaces + trimmedLyric;
}

/**
 * 壓縮和弦行嘅前導空格
 * 將 Arial 下嘅多個空格轉換為等寬字體下適量嘅空格
 */
function compressChordLineSpaces(line, factor = 1.1) {
  if (!line || !line.trim()) return line;
  
  // 找到第一個非空格字符
  const firstNonSpaceIndex = line.search(/\S/);
  if (firstNonSpaceIndex <= 0) return line; // 冇前導空格或全空格
  
  // 計算前導空格喺 Arial 下嘅視覺寬度
  const leadingSpaces = line.substring(0, firstNonSpaceIndex);
  const arialWidth = getLineWidthArial(leadingSpaces);
  
  // 轉換為等寬字體下應該有幾多空格
  // 經驗：通常 1-3 個空格就夠
  const targetSpaces = Math.max(1, Math.min(4, Math.round(arialWidth * factor * 0.3)));
  
  // 重建行
  return ' '.repeat(targetSpaces) + line.substring(firstNonSpaceIndex);
}

/**
 * 主要轉換函數 - 自動修正對齊（帶可調參數）
 * @param {string} content - 譜內容
 * @param {number} factor - 對齊因子（預設 1.1）
 */
export function autoFixTabFormatWithFactor(content, factor = 1.1) {
  if (!content) return content;
  
  const lines = content.split('\n');
  const result = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';
    
    // 標記行直接保留
    if (isMarkerLine(line)) {
      result.push(line.trim());
      continue;
    }
    
    // 空行保留
    if (!line || line.trim().length === 0) {
      result.push('');
      continue;
    }
    
    // 如果係和弦行
    if (isChordLine(line)) {
      // 壓縮和弦行嘅前導空格
      const compressedChordLine = compressChordLineSpaces(line, factor);
      result.push(compressedChordLine);
      
      // 檢查下一行係唔係歌詞
      if (nextLine && 
          !isChordLine(nextLine) && 
          !isMarkerLine(nextLine) && 
          nextLine.trim().length > 0 &&
          !nextLine.trim().startsWith('|')) {
        
        // 對齊歌詞（用壓縮後嘅和弦行）
        const alignedLyric = alignLyricToChord(compressedChordLine, nextLine, factor);
        result.push(alignedLyric);
        i++; // 跳過下一行
      }
    } else {
      // 普通行，保留原樣
      result.push(line);
    }
  }
  
  return result.join('\n');
}

/**
 * 主要轉換函數 - 自動修正對齊（向後兼容，用預設 factor）
 */
export function autoFixTabFormat(content) {
  return autoFixTabFormatWithFactor(content, 1.1);
}

/**
 * 清理空格（Paste 時用）
 */
export function cleanPastedText(text) {
  if (!text) return text;
  
  return text
    .replace(/\u3000/g, '  ')          // 全形空格 -> 2個半形空格
    .replace(/\t/g, '    ')            // Tab -> 4個空格
    .split('\n')
    .map(line => line.replace(/\s+$/, '')) // 只移除行尾空格
    .join('\n');
}

/**
 * 完整處理：清理 + 對齊修正
 */
export function processTabContent(content) {
  if (!content) return content;
  
  const cleaned = cleanPastedText(content);
  const fixed = autoFixTabFormat(cleaned);
  
  return fixed;
}

/**
 * 將 Arial 格式嘅譜轉換為等寬字體格式
 * 核心邏輯：將 Arial 下嘅視覺對齊轉換為等寬字體下嘅空格對齊
 */
export function convertArialToMono(content) {
  if (!content) return content;
  
  const lines = content.split('\n');
  const result = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';
    
    // 標記行直接保留
    if (isMarkerLine(line)) {
      result.push(line.trim());
      continue;
    }
    
    // 空行保留
    if (!line || line.trim().length === 0) {
      result.push('');
      continue;
    }
    
    // 如果係和弦行
    if (isChordLine(line)) {
      // 計算呢行喺 Arial 下第一個內容字符嘅視覺位置
      const chordPos = getContentStartPosition(line);
      
      // 轉換為等寬字體下需要幾多空格
      // 經驗：Arial 視覺寬度 / 1.5 ≈ 等寬空格數
      let targetSpaces = 2; // 預設 2 個空格
      if (chordPos) {
        targetSpaces = Math.max(2, Math.min(8, Math.round(chordPos.arialWidth / 1.5)));
      }
      
      // 重建和弦行，用適量嘅空格
      const trimmedLine = line.trimStart();
      const newChordLine = ' '.repeat(targetSpaces) + trimmedLine;
      result.push(newChordLine);
      
      // 檢查下一行係唔係歌詞
      if (nextLine && 
          !isChordLine(nextLine) && 
          !isMarkerLine(nextLine) && 
          nextLine.trim().length > 0 &&
          !nextLine.trim().startsWith('|')) {
        
        // 歌詞行用相同數量嘅空格
        const trimmedLyric = nextLine.trimStart();
        const newLyricLine = ' '.repeat(targetSpaces) + trimmedLyric;
        result.push(newLyricLine);
        i++; // 跳過下一行
      }
    } else {
      // 普通行，trim 前導空格後保留（因為 Arial 下可能有多餘空格）
      result.push(line.trimStart());
    }
  }
  
  return result.join('\n');
}

export default {
  autoFixTabFormat,
  autoFixTabFormatWithFactor,
  cleanPastedText,
  processTabContent,
  isChordLine,
  getContentStartPosition,
  convertArialToMono
};

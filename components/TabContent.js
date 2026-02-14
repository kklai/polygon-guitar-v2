import React, { useState, useRef, useEffect, useCallback } from 'react';

// ============ 智能字體大小計算 ============
// 根據內容長度計算合適的字體大小
function calculateFontSize(text, containerWidth = 800) {
  if (!text) return 16;
  
  const length = text.length;
  
  // 計算基礎字體大小
  let baseSize = 16;
  
  // 窄屏幕（手機）
  if (containerWidth < 400) {
    if (length > 50) baseSize = 11;
    else if (length > 35) baseSize = 12;
    else if (length > 20) baseSize = 13;
    else baseSize = 14;
  }
  // 中等屏幕（平板）
  else if (containerWidth < 768) {
    if (length > 60) baseSize = 12;
    else if (length > 40) baseSize = 13;
    else if (length > 25) baseSize = 14;
    else baseSize = 15;
  }
  // 寬屏幕（桌面）
  else {
    if (length > 80) baseSize = 13;
    else if (length > 50) baseSize = 14;
    else if (length > 30) baseSize = 15;
    else baseSize = 16;
  }
  
  return baseSize;
}

// ============ 常數定義 ============
// 根據原調類型顯示對應的 Key 選項（Major 只顯示 Major，Minor 只顯示 Minor）
// 顯示用 Key 列表（優先使用 sharp，避免重複）
const MAJOR_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEYS = ['Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
// 兼容舊代碼
const KEYS = [...MAJOR_KEYS, ...MINOR_KEYS];

// Key 對應的 semitone 位置 (C = 0)
const KEY_TO_SEMITONE = {
  // Major
  'C': 0, 'Db': 1, 'C#': 1, 'D': 2, 'Eb': 3, 'D#': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'Ab': 8, 'G#': 8,
  'A': 9, 'Bb': 10, 'A#': 10, 'B': 11,
  // Minor（同 Major 音高相同，用嚟識別相對小調）
  'Cm': 0, 'C#m': 1, 'Dm': 2, 'D#m': 3, 'Ebm': 3, 'Em': 4,
  'Fm': 5, 'F#m': 6, 'Gm': 7, 'G#m': 8, 'Am': 9, 'Bbm': 10, 'Bm': 11
};

// Semitone 對應的 Key (優先使用 flat)
const SEMITONE_TO_KEY = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// ============ 和弦轉調工具 ============
const CHORDS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHORDS_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// 轉調單個和弦（支援 slash chord，如 C/E）
function transposeChord(chord, semitones) {
  // 處理 slash chord，例如 C/E, D7/F#
  const slashMatch = chord.match(/^([A-G][#b]?[^\/]*)(?:\/([A-G][#b]?))?$/);
  if (!slashMatch) return chord;
  
  const [, mainChord, bassNote] = slashMatch;
  
  // 轉調主和弦
  const mainMatch = mainChord.match(/^([A-G][#b]?)(.*)$/);
  if (!mainMatch) return chord;
  
  const [, root, suffix] = mainMatch;
  let index = CHORDS.indexOf(root);
  if (index === -1) index = CHORDS_FLAT.indexOf(root);
  if (index === -1) return chord;
  
  const newIndex = (index + semitones + 12) % 12;
  const newRoot = CHORDS[newIndex];
  
  // 轉調 bass note（如果有）
  let newBass = '';
  if (bassNote) {
    let bassIndex = CHORDS.indexOf(bassNote);
    if (bassIndex === -1) bassIndex = CHORDS_FLAT.indexOf(bassNote);
    if (bassIndex !== -1) {
      const newBassIndex = (bassIndex + semitones + 12) % 12;
      newBass = '/' + CHORDS[newBassIndex];
    }
  }
  
  return newRoot + suffix + newBass;
}

function transposeChordLine(line, semitones) {
  if (!semitones || semitones === 0) {
    // 即使唔轉調，都確保和弦之間至少有一個空格
    return normalizeChordSpacing(line);
  }
  
  // 先規範化間距，再轉調
  const normalizedLine = normalizeChordSpacing(line);
  
  // 匹配：| 或 ｜ + 和弦，或 空格 + 和弦，或 | 或 ｜，或獨立的 -
  return normalizedLine.replace(/([\|｜]\s*|\s+)([A-G][#b]?[^\s|｜]*|-)|([\|｜])/g, (match, separator, chord, barOnly) => {
    // 處理只有 | 或 ｜ 的情況
    if (barOnly === '|' || barOnly === '｜') return ' |';
    
    // 判斷是否有 | 或 ｜
    const hasBar = separator && (/[\|｜]/.test(separator));
    const leadingSpace = separator && separator.match(/\s*$/)?.[0] || '';
    
    // 處理獨立的延長符號（只是 -）
    if (chord === '-') {
      return (hasBar ? ' |' : leadingSpace || ' ') + '-';
    }
    
    // 檢查係咪有延長符號（結尾係 -）
    const hasDash = chord.endsWith('-');
    const cleanChord = hasDash ? chord.slice(0, -1) : chord;
    const transposed = transposeChord(cleanChord, semitones);
    const result = hasDash ? transposed + '-' : transposed;
    return (hasBar ? ' |' : leadingSpace || ' ') + result;
  });
}

// 確保和弦之間至少有一個空格
function normalizeChordSpacing(line) {
  if (!line) return line;
  
  // 將全角豎線轉為半角
  let result = line.replace(/｜/g, '|');
  // 確保 | 後面至少有一個空格
  result = result.replace(/\|([^\s])/g, '| $1');
  
  // 確保和弦之間至少有一個空格
  // 方法：遍歷字符串，當發現 A-G 開頭嘅新和弦，而且前面係和弦字符（但不是 /），就加空格
  let output = '';
  for (let i = 0; i < result.length; i++) {
    const char = result[i];
    const prevChar = result[i - 1];
    
    // 檢查是否係 A-G 開頭（可能係新和弦）
    if (/[A-G]/.test(char)) {
      // 檢查前面係咪和弦字符（# b m M 數字等）
      // 排除：空格、|、/（slash chord 如 G/B 唔應該分開）
      if (prevChar && /[a-zA-Z0-9#b+\-]/.test(prevChar)) {
        output += ' ';
      }
      // 注意：如果前面係 /，代表係 slash chord，唔加空格
    }
    output += char;
  }
  
  return output;
}

// ============ 字寬計算工具 ============
function isCJK(char) {
  const code = char.charCodeAt(0);
  return (code >= 0x4E00 && code <= 0x9FFF) || 
         (code >= 0x3400 && code <= 0x4DBF) || 
         (code >= 0xF900 && code <= 0xFAFF);
}

function getCharWidth(char) {
  if (char === '\u3000') return 2;
  if (isCJK(char)) return 2;
  return 1;
}

function getTextWidth(text) {
  let width = 0;
  for (let char of text) width += getCharWidth(char);
  return width;
}

function findBracketPositions(lyricLine) {
  const positions = [];
  let currentWidth = 0;
  for (let char of lyricLine) {
    if (char === '(') positions.push(currentWidth);
    currentWidth += getCharWidth(char);
  }
  return positions;
}

function normalizeInput(text) {
  return text.replace(/｜/g, '|').replace(/　/g, ' ');
}

// Section marker 列表
const SECTION_MARKERS = [
  'Intro', 'Outro', 
  'Verse', 'Verse 1', 'Verse 2', 'Verse 3', 'Verse 4',
  'Chorus', 'Chorus 1', 'Chorus 2', 'Chorus 3',
  'Prechorus', 'Pre-chorus', 'Pre Chorus', 'Pre Chorus 1', 'Pre Chorus 2',
  'Bridge', 
  'Interlude', 
  'Solo', 'Guitar Solo',
  'Break', 'Music Break', ' instrumental',
  'Hook', 'Refrain',
  'Fade out'
];

// 檢查是否為 Section Marker 行
function isSectionMarkerLine(line) {
  const trimmed = line.trim();
  return SECTION_MARKERS.some(marker => 
    trimmed.toLowerCase().startsWith(marker.toLowerCase())
  );
}

// 提取 Section Marker 和其後的內容
function extractSectionMarker(line) {
  const trimmed = line.trim();
  
  // 按長度排序，先匹配長的（避免 "Verse" 搶先匹配 "Verse 1"）
  const sortedMarkers = [...SECTION_MARKERS].sort((a, b) => b.length - a.length);
  
  for (const marker of sortedMarkers) {
    const markerLower = marker.toLowerCase();
    const trimmedLower = trimmed.toLowerCase();
    
    if (trimmedLower.startsWith(markerLower)) {
      // 找到 marker 後的內容
      const afterMarker = trimmed.substring(marker.length).trim();
      return { 
        hasMarker: true, 
        marker: marker,
        rest: afterMarker 
      };
    }
  }
  return { hasMarker: false, marker: '', rest: line };
}

function extractSectionMarkers(line) {
  const prefixMatch = line.match(/^(\s*[#*]\s*)/);
  const suffixMatch = line.match(/(\s*[#*]\s*)$/);
  const prefix = prefixMatch ? prefixMatch[1] : '';
  const suffix = suffixMatch ? suffixMatch[1] : '';
  let cleanLine = line;
  if (prefix) cleanLine = cleanLine.substring(prefix.length);
  if (suffix) cleanLine = cleanLine.substring(0, cleanLine.length - suffix.length);
  return { prefix, suffix, cleanLine: cleanLine.trim() };
}

function getSemitoneFromKey(key) {
  return KEY_TO_SEMITONE[key] ?? 0;
}

function calculateCapo(originalKey, selectedKey) {
  const originalSemitone = getSemitoneFromKey(originalKey);
  const selectedSemitone = getSemitoneFromKey(selectedKey);
  let capo = (originalSemitone - selectedSemitone) % 12;
  if (capo < 0) capo += 12;
  return capo;
}

function calculateTransposeSemitones(originalKey, selectedKey) {
  const originalSemitone = getSemitoneFromKey(originalKey);
  const selectedSemitone = getSemitoneFromKey(selectedKey);
  return (selectedSemitone - originalSemitone + 12) % 12;
}

function getCapoSuggestion(capo) {
  if (capo === 0) {
    return { capo: 0, status: 'none', message: '無需變調夾', alternative: null };
  }
  if (capo >= 1 && capo <= 8) {
    return { capo: capo, status: 'ok', message: `建議 Capo: ${capo}`, alternative: null };
  }
  if (capo >= 9 && capo <= 11) {
    const dropTuningCapo = capo - 2;
    return { 
      capo: capo, 
      status: 'high',
      message: `Capo ${capo} 位置過高`,
      alternative: { type: 'dropTuning', capo: dropTuningCapo }
    };
  }
  return { capo: null, status: 'invalid', message: '', alternative: null };
}

// 檢查是否為簡譜行（數字譜，如 (6.)6.13312）
function isNumericNotationLine(line) {
  if (!line || !line.includes('(')) return false;
  
  // 簡譜特徵：
  // 1. 包含括號內的數字 (6.)、(2) 等
  // 2. 大量數字和點號
  // 3. 很少或沒有中文字符
  
  const numericBracketPattern = /\(\d+\.?\)/g;
  const numericBrackets = line.match(numericBracketPattern) || [];
  
  // 如果有 2+ 個數字括號模式，可能是簡譜
  if (numericBrackets.length >= 2) {
    const digits = (line.match(/\d/g) || []).length;
    const chineseChars = (line.match(/[\u4e00-\u9fff]/g) || []).length;
    
    // 數字多、中文字少 = 簡譜
    if (digits > 5 && chineseChars < 3) {
      return true;
    }
  }
  
  return false;
}

// 檢查是否為混合行（同時包含和弦和歌詞）
function isMixedLine(line) {
  // 必須包含括號（歌詞標記）
  if (!line.includes('(')) return false;
  
  // 檢查是否有 Section Marker
  const sectionInfo = extractSectionMarker(line);
  if (sectionInfo.hasMarker) {
    // 有 Section Marker 的行，檢查剩餘部分是否包含 |
    const rest = sectionInfo.rest;
    return /\|/.test(rest) && /\(/.test(rest);
  }
  
  // 沒有 Section Marker，檢查是否包含 | 開頭的和弦 + 括號歌詞
  // 但排除純歌詞行（只有中文字和括號）
  const hasChordBar = /\|[\s]*[A-G][#b]?/.test(line);
  const hasLyricBracket = /\([^A-G]/.test(line); // 括號內不是和弦（避免誤判）
  
  // 如果中文字比例高，視為歌詞行而非混合行
  const chineseChars = line.match(/[\u4e00-\u9fff]/g) || [];
  const chineseRatio = chineseChars.length / line.length;
  if (chineseRatio > 0.3) {
    return false;
  }
  
  return hasChordBar && hasLyricBracket;
}

// 嚴格檢查字符串是否只包含和弦相關字符（不包含中文字）
function isChordOnly(str) {
  // 移除空格後檢查
  const trimmed = str.trim();
  if (!trimmed) return true;
  
  // 如果係純數字（指法譜），唔係和弦
  if (/^[\d\s\.]+$/.test(trimmed)) {
    return false;
  }
  
  // 檢查係咪數字譜格式（如 (1)351' 或 6.7.1' 等）
  // 數字譜特徵：大量數字、點、括號、撇號，少於2個和弦
  const digits = (trimmed.match(/\d/g) || []).length;
  const chordRoots = (trimmed.match(/[A-G][#b]?/g) || []).length;
  
  // 如果數字多過和弦根音超過3倍，可能係數字譜
  if (digits > 6 && chordRoots < 2) {
    return false;
  }
  
  // 只允許：A-G, #, b, m, a, j, s, u, d, i, M, n, 0-9, /, -, +, *, (, ), |
  return /^[A-Ga-g#b0-9mMsSjJuUaAdDiInN\/\+\-\*\(\)\|\s]+$/.test(trimmed);
}

// 從 segment 提取和弦（到第一個中文字或 ( 為止）
function extractChordPart(segment) {
  let chordPart = '';
  let lyricPart = '';
  let foundLyric = false;
  
  for (let i = 0; i < segment.length; i++) {
    const char = segment[i];
    const charCode = char.charCodeAt(0);
    
    // 檢查是否為中文字或已經開始歌詞部分
    if (!foundLyric) {
      // 如果是中文字，開始歌詞部分
      if (charCode >= 0x4E00 && charCode <= 0x9FFF) {
        foundLyric = true;
        lyricPart += char;
      } else if (char === '(') {
        // 遇到 ( 也開始歌詞部分
        foundLyric = true;
        lyricPart += char;
      } else {
        chordPart += char;
      }
    } else {
      lyricPart += char;
    }
  }
  
  return { chord: chordPart.trim(), lyric: lyricPart.trim() };
}

// 處理混合行 - 將交替出現的和弦與歌詞分開
function processMixedLine(line, transposeSemitones = 0) {
  // 先確保和弦之間有空格
  const lineWithSpacing = normalizeChordSpacing(line);
  const normalizedLine = normalizeInput(lineWithSpacing);
  
  // 先檢查是否有 Section Marker
  const sectionInfo = extractSectionMarker(normalizedLine);
  const sectionPrefix = sectionInfo.hasMarker ? sectionInfo.marker : '';
  let remaining = sectionInfo.rest;
  
  // 用 | 分割行
  const segments = [];
  const parts = remaining.split('|').filter(p => p.trim());
  
  for (const part of parts) {
    // 提取和弦部分和歌詞部分
    const { chord, lyric } = extractChordPart(part);
    if (chord || lyric) {
      segments.push({ chord: chord || '', lyric: lyric || '' });
    }
  }
  
  if (segments.length === 0) {
    return { 
      sectionMarker: sectionPrefix,
      chordPart: remaining, 
      lyricParts: [{ text: remaining, isInside: false }], 
      error: true 
    };
  }
  
  // 組合所有和弦段落
  let chordLine = '';
  segments.forEach((seg, idx) => {
    if (idx > 0) chordLine += ' |';
    if (seg.chord) chordLine += ' ' + seg.chord;
  });
  
  // 處理轉調
  if (transposeSemitones !== 0) {
    chordLine = transposeChordLine(chordLine, transposeSemitones);
  }
  
  // 組合所有歌詞段落
  const lyricParts = [];
  segments.forEach((seg, idx) => {
    if (seg.lyric) {
      // 解析括號
      let buffer = '';
      let inBracket = false;
      for (let char of seg.lyric) {
        if (char === '(') {
          if (buffer) lyricParts.push({ text: buffer, isInside: false });
          buffer = '(';
          inBracket = true;
        } else if (char === ')') {
          buffer += ')';
          lyricParts.push({ text: buffer, isInside: true });
          buffer = '';
          inBracket = false;
        } else {
          buffer += char;
        }
      }
      if (buffer) lyricParts.push({ text: buffer, isInside: inBracket });
    }
    // 段落之間加空格
    if (idx < segments.length - 1) {
      lyricParts.push({ text: '  ', isInside: false });
    }
  });
  
  return { 
    sectionMarker: sectionPrefix,
    chordPart: chordLine || '|', 
    lyricParts, 
    error: false 
  };
}

function processPair(chordLine, lyricLine, transposeSemitones = 0) {
  // 先確保和弦之間有空格，再處理
  const chordWithSpacing = normalizeChordSpacing(chordLine);
  const normalizedChord = normalizeInput(chordWithSpacing);
  const normalizedLyric = normalizeInput(lyricLine);
  const bracketPositions = findBracketPositions(normalizedLyric);
  
  // 解析和弦行，記錄每個 token 及其位置
  const tokens = [];
  let i = 0;
  const chars = Array.from(normalizedChord);
  
  while (i < chars.length) {
    while (i < chars.length && chars[i] === ' ') i++;
    if (i >= chars.length) break;
    
    let hasBar = false;
    if (chars[i] === '|') {
      hasBar = true;
      i++;
      while (i < chars.length && chars[i] === ' ') i++;
    }
    
    let tokenName = '';
    while (i < chars.length && chars[i] !== ' ' && chars[i] !== '\u3000') {
      tokenName += chars[i];
      i++;
    }
    
    // 處理和弦（A-G 開頭）或延長符號/節奏記號（-、*、2/4 等）
    if (tokenName) {
      let displayName = tokenName;
      let isChord = /^[A-G]/.test(tokenName);
      let isDash = tokenName === '-' || tokenName === '*' || /^\d+\/\d+$/.test(tokenName);
      
      // 如果是和弦，處理轉調
      if (isChord && transposeSemitones !== 0) {
        displayName = transposeChord(tokenName, transposeSemitones);
      }
      
      tokens.push({
        name: displayName,
        fullToken: hasBar ? '|' + displayName : displayName,
        isBarStart: hasBar,
        isChord: isChord,
        isDash: isDash,
        width: getTextWidth(hasBar ? '|' + displayName : displayName),
        nameWidth: getTextWidth(displayName)
      });
    }
  }
  
  // 分離和弦（需要對齊）同延長符號（按位置顯示）
  const chordTokens = tokens.filter(t => t.isChord);
  
  // 檢查和弦數量是否匹配括號數量
  const mismatch = chordTokens.length !== bracketPositions.length;
  
  // 即使不匹配，也嘗試對齊（取最小值）
  const minCount = Math.min(chordTokens.length, bracketPositions.length);

  // 計算每個 token 應該對齊嘅位置
  // 和弦對齊括號，延長符號平均分布在前後和弦之間
  const tokenPositions = [];
  let chordIdx = 0;
  
  // 先收集所有延長符號，按它們在前後和弦之間的位置分組
  for (let idx = 0; idx < tokens.length; idx++) {
    const token = tokens[idx];
    
    if (token.isChord) {
      // 如果還有括號位置，對齊；否則放在最後
      if (chordIdx < minCount) {
        tokenPositions.push(bracketPositions[chordIdx]);
      } else {
        // 多餘的和弦，放喺最後一個位置後面
        const lastPos = bracketPositions.length > 0 ? bracketPositions[bracketPositions.length - 1] : 0;
        tokenPositions.push(lastPos + 6 * (chordIdx - minCount + 1));
      }
      chordIdx++;
    } else {
      // 延長符號：找前後和弦，然後平均分布
      let prevChordIdx = -1;  // 在 tokens 中的索引
      let nextChordIdx = -1;  // 在 tokens 中的索引
      let prevChordBracketIdx = -1;  // 在 bracketPositions 中的索引
      let nextChordBracketIdx = -1;  // 在 bracketPositions 中的索引
      
      // 找前一個和弦
      let chordCount = 0;
      for (let j = idx - 1; j >= 0; j--) {
        if (tokens[j].isChord) {
          prevChordIdx = j;
          prevChordBracketIdx = chordCount;
          break;
        }
        if (tokens[j].isChord) chordCount++;
      }
      
      // 重新計算前一個和弦的 bracket 索引
      chordCount = 0;
      for (let j = 0; j < idx; j++) {
        if (tokens[j].isChord) {
          prevChordBracketIdx = chordCount;
          chordCount++;
        }
      }
      prevChordBracketIdx = chordCount - 1;
      
      // 找後一個和弦
      chordCount = 0;
      for (let j = 0; j < tokens.length; j++) {
        if (tokens[j].isChord) {
          if (j > idx) {
            nextChordIdx = j;
            nextChordBracketIdx = chordCount;
            break;
          }
          chordCount++;
        }
      }
      
      if (prevChordBracketIdx >= 0 && nextChordBracketIdx >= 0) {
        // 計算這個延長符號是第幾個在這對和弦之間的
        let dashIndexInGap = 0;
        let totalDashesInGap = 0;
        for (let j = prevChordIdx + 1; j < nextChordIdx; j++) {
          if (tokens[j].isDash) {
            if (j < idx) dashIndexInGap++;
            totalDashesInGap++;
          }
        }
        
        const prevPos = bracketPositions[prevChordBracketIdx];
        const nextPos = bracketPositions[nextChordBracketIdx];
        const gap = nextPos - prevPos;
        
        // 平均分布：把 gap 分成 (totalDashesInGap + 1) 份
        const step = gap / (totalDashesInGap + 1);
        const pos = Math.round(prevPos + step * (dashIndexInGap + 1));
        tokenPositions.push(pos);
      } else if (prevChordBracketIdx >= 0) {
        tokenPositions.push(bracketPositions[prevChordBracketIdx] + 4);
      } else if (nextChordBracketIdx >= 0) {
        tokenPositions.push(Math.max(0, bracketPositions[nextChordBracketIdx] - 4));
      } else {
        tokenPositions.push(0);
      }
    }
  }

  // 重建和弦行
  let newChordLine = '';
  let currentCol = 0;

  for (let idx = 0; idx < tokens.length; idx++) {
    const token = tokens[idx];
    const targetPos = tokenPositions[idx];
    
    let startCol = token.isBarStart ? targetPos - 1 : targetPos;
    // 延長符號稍微調整位置
    if (token.isDash) startCol = targetPos;
    
    if (startCol < currentCol) startCol = currentCol;
    
    const spacesNeeded = startCol - currentCol;
    const fullSpaces = Math.floor(spacesNeeded / 2);
    const halfSpace = spacesNeeded % 2;
    
    newChordLine += '\u3000'.repeat(fullSpaces);
    if (halfSpace) newChordLine += ' ';
    
    newChordLine += token.fullToken;
    currentCol = startCol + token.width;
  }

  const parts = [];
  let buffer = '';
  let inBracket = false;
  
  for (let char of normalizedLyric) {
    if (char === '(') {
      if (buffer) parts.push({ text: buffer, isInside: false });
      buffer = '(';
      inBracket = true;
    } else if (char === ')') {
      buffer += ')';
      parts.push({ text: buffer, isInside: true });
      buffer = '';
      inBracket = false;
    } else {
      buffer += char;
    }
  }
  if (buffer) parts.push({ text: buffer, isInside: inBracket });

  return { chordLine: newChordLine, lyricParts: parts, error: mismatch };
}

// ============ 主組件 ============
const TabContent = ({ 
  content, 
  originalKey = 'C',
  playKey, // 實際內容的調（Capo後彈奏的調）
  editable = false,
  onContentChange,
  onKeyChange,
  showControls = true,
  className = '',
  initialKey,
  fullWidth = false,
  theme: externalTheme,
  setTheme: externalSetTheme
}) => {
  // 使用 playKey 作為基準調（如果有的話）
  const baseKey = playKey || originalKey;
  const [currentKey, setCurrentKey] = useState(initialKey || baseKey);
  const [fontSize, setFontSize] = useState(20);
  const [isAutoScroll, setIsAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(3);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content || '');
  const [internalTheme, setInternalTheme] = useState('night'); // 'night' | 'day'
  
  // 優先使用外部傳入的 theme，否則使用內部 state
  const theme = externalTheme !== undefined ? externalTheme : internalTheme;
  const setTheme = externalSetTheme !== undefined ? externalSetTheme : setInternalTheme;
  
  const autoScrollRef = useRef(null);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // 主題顏色配置
  const themeColors = {
    night: {
      bg: '#121212',
      text: '#FFFFFF',
      lyricNormal: '#A0A0A0',
      lyricInside: '#FFFFFF',
      chord: '#FFD700',
      sectionMarker: '#FFFFFF',
      numericNotation: '#A0A0A0',
      prefixSuffix: '#808080'
    },
    day: {
      bg: '#FFFFFF',
      text: '#000000',
      lyricNormal: '#333333',
      lyricInside: '#000000',
      chord: '#8B5CF6', // 紫色
      sectionMarker: '#000000',
      numericNotation: '#555555',
      prefixSuffix: '#666666'
    }
  };

  const colors = themeColors[theme];

  // 轉調計算：內容轉調以 baseKey 為準
  const transposeSemitones = calculateTransposeSemitones(baseKey, currentKey);
  // 但 Capo 顯示要以原調計算（顯示實際要夾幾多格）
  const displayCapo = calculateCapo(originalKey, currentKey);
  const capoSuggestion = getCapoSuggestion(displayCapo);

  // 強制使用 initialKey 作為初始值
  useEffect(() => {
    if (initialKey) {
      setCurrentKey(initialKey);
    }
  }, [initialKey]);

  // 監聽容器寬度變化
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    
    updateWidth();
    
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef.current);
    
    window.addEventListener('resize', updateWidth);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // 自動滾動 - 成個頁面一齊滾動
  useEffect(() => {
    if (isAutoScroll) {
      // 速度：6 個選項，最快速度為 1.0
      const speeds = [0, 0.2, 0.3, 0.5, 0.75, 1.0];
      autoScrollRef.current = setInterval(() => {
        window.scrollBy({ top: speeds[scrollSpeed] || 0.4, behavior: 'auto' });
      }, 50);
    } else {
      if (autoScrollRef.current) {
        clearInterval(autoScrollRef.current);
        autoScrollRef.current = null;
      }
    }
    return () => {
      if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    };
  }, [isAutoScroll, scrollSpeed]);

  const handleFontSize = (delta) => {
    setFontSize(prev => Math.max(12, Math.min(28, prev + delta)));
  };

  const handleCopy = useCallback(() => {
    if (content) {
      navigator.clipboard.writeText(content);
    }
  }, [content]);

  const handleSave = () => {
    if (onContentChange) {
      onContentChange(editContent);
    }
    setIsEditing(false);
  };

  // 計算單行字體大小
  const getLineFontSize = (lineText, isChordLine = false) => {
    if (!lineText) return fontSize;
    
    const adjustedBase = calculateFontSize(lineText, containerWidth);
    
    // 如果用戶手動調整了字體大小，按比例調整
    const ratio = fontSize / 16; // 16 是預設值
    return Math.max(10, Math.min(28, Math.round(adjustedBase * ratio)));
  };

  const renderContent = () => {
    if (!content) return null;

    const lines = content.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const nextLine = lines[i + 1] || '';
      
      if (!line.trim()) {
        // 跳過連續空行，只保留一個
        if (i > 0 && !lines[i - 1].trim()) {
          i++;
          continue;
        }
        elements.push(<div key={i} style={{ height: '0.8em' }} />);
        i++;
        continue;
      }
      
      // 計算當前行的字體大小
      const lineFontSize = getLineFontSize(line);
      
      // 更精確的和弦行檢測：必須包含和弦模式，且不能主要是中文字
      // 支援 | 和 ｜ 兩種豎線
      const chordPattern = /([\|｜][\s]*[A-G][#b]?|[\s/]*[A-G][#b]?)(m|maj|min|sus|dim|aug|add|[0-9])*/g;
      const chordMatches = line.match(chordPattern) || [];
      // 只計算真正有和弦字母嘅匹配（避免匹配到空字符串）
      const validChordMatches = chordMatches.filter(m => /[A-G]/.test(m));
      // 只要有 1 個或以上和弦就認為係和弦行（修復單個和弦如 ｜F 嘅問題）
      const hasChordPattern = validChordMatches.length >= 1 || /[\|｜][\s]*[A-G]/.test(line);
      // 檢查中文字比例，如果超過 30% 就不是和弦行
      const chineseChars = line.match(/[\u4e00-\u9fff]/g) || [];
      const chineseRatio = chineseChars.length / line.length;
      // 如果高中文比例且有括號歌詞，視為歌詞行
      const hasLyricBrackets = chineseRatio > 0.3 && /\([^A-G#b\)]{1,3}\)/.test(line);
      const isChord = hasChordPattern && chineseRatio < 0.3 && !hasLyricBrackets;
      // 同樣檢查下一行
      const nextChordMatches = nextLine.match(chordPattern) || [];
      const nextHasChordPattern = nextChordMatches.length >= 2 || nextLine.includes('|') || nextLine.includes('｜');
      const nextChineseChars = nextLine.match(/[\u4e00-\u9fff]/g) || [];
      const nextChineseRatio = nextChineseChars.length / nextLine.length;
      const nextIsChord = nextHasChordPattern && nextChineseRatio < 0.3;
      const isMixed = isMixedLine(line);
      const isSectionMarker = isSectionMarkerLine(line);
      
      // 處理 Section Marker 單獨一行
      if (isSectionMarker && !isChord && !isMixed) {
        const sectionInfo = extractSectionMarker(line);
        if (sectionInfo.hasMarker) {
          // Section Marker 單獨一行 - 白色、底線、粗體
          elements.push(
            <div key={`${i}-marker`} style={{ marginBottom: `${lineFontSize * 0.6}px` }}>
              <span style={{ color: colors.lyricInside, fontSize: `${lineFontSize}px`, fontWeight: 'bold', textDecoration: 'underline', textUnderlineOffset: '4px' }}>
                {sectionInfo.marker}
              </span>
            </div>
          );
          // 如果有剩餘內容（如和弦），顯示在下一行
          const restLine = sectionInfo.rest.trim();
          if (restLine) {
            const transposedRest = transposeChordLine(restLine, transposeSemitones);
            elements.push(
              <div key={i} style={{ color: colors.chord, fontWeight: 'bold', fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: `${lineFontSize * 0.6}px` }}>
                {transposedRest}
              </div>
            );
          }
          i++;
          continue;
        }
      }
      
      // 處理混合行（chord + lyric 在同一行）
      if (isMixed) {
        const { prefix, suffix, cleanLine } = extractSectionMarkers(line);
        const result = processMixedLine(cleanLine, transposeSemitones);
        
        if (result.error) {
          elements.push(
            <div key={i} style={{ marginBottom: `${lineFontSize * 0.6}px`, fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: '0.1em' }}>
              {prefix && <span style={{ color: colors.prefixSuffix, fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{prefix}</span>}
              <span style={{ color: colors.lyricNormal }}>{cleanLine}</span>
              {suffix && <span style={{ color: colors.prefixSuffix, fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{suffix}</span>}
            </div>
          );
        } else {
          // 有 Section Marker 時，分三行顯示
          if (result.sectionMarker) {
            elements.push(
              <div key={`${i}-marker`} style={{ marginBottom: `${lineFontSize * 0.6}px` }}>
                {/* Section Marker 單獨一行 - 白色、底線、粗體 */}
                <span style={{ color: colors.lyricInside, fontSize: `${lineFontSize}px`, fontWeight: 'bold', textDecoration: 'underline', textUnderlineOffset: '4px' }}>
                  {prefix && <span style={{ color: colors.prefixSuffix, fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{prefix}</span>}
                  {result.sectionMarker}
                  {suffix && <span style={{ color: colors.prefixSuffix, fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{suffix}</span>}
                </span>
                {/* 和弦行 */}
                <div className="font-bold" style={{ color: colors.chord, fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: '0.05em', lineHeight: '1.2', fontWeight: 700 }}>
                  {result.chordPart}
                </div>
                {/* 歌詞行 */}
                <div style={{ fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', lineHeight: '1.2' }}>
                  {result.lyricParts.map((part, idx) => (
                    <span key={idx} style={{ 
                      color: part.isInside ? colors.lyricInside : colors.lyricNormal,
                      fontWeight: part.isInside && theme === 'day' ? 'bold' : 'normal'
                    }}>
                      {part.text}
                    </span>
                  ))}
                </div>
              </div>
            );
          } else {
            elements.push(
              <div key={i} style={{ marginBottom: `${lineFontSize * 0.6}px` }}>
                {/* 和弦行 */}
                <div className="font-bold" style={{ color: colors.chord, fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: '0.05em', lineHeight: '1.2', fontWeight: 700 }}>
                  {prefix && <span style={{ color: colors.prefixSuffix, fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{prefix}</span>}
                  {result.chordPart}
                  {suffix && <span style={{ color: colors.prefixSuffix, fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{suffix}</span>}
                </div>
                {/* 歌詞行 */}
                <div style={{ fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', lineHeight: '1.2' }}>
                  {result.lyricParts.map((part, idx) => (
                    <span key={idx} style={{ 
                      color: part.isInside ? colors.lyricInside : colors.lyricNormal,
                      fontWeight: part.isInside && theme === 'day' ? 'bold' : 'normal'
                    }}>
                      {part.text}
                    </span>
                  ))}
                </div>
              </div>
            );
          }
        }
        i++;
      } else if (isChord) {
        // 如果下一行係空行，跳過去搵歌詞行
        let lyricLineIndex = i + 1;
        while (lyricLineIndex < lines.length && !lines[lyricLineIndex].trim()) {
          lyricLineIndex++;
        }
        const lyricLine = lines[lyricLineIndex] || '';
        
        // 檢查係咪和弦行 + 歌詞行組合
        if (lyricLine && lyricLine.includes('(') && !lyricLine.match(/\|[\s]*[A-G][#b]?/)) {
          // 檢查是否為簡譜行（數字譜）
          const isNumericNotation = isNumericNotationLine(lyricLine);
          
          if (isNumericNotation) {
            // 簡譜行：直接顯示，不做對齊處理，用等寬字體
            const { prefix, suffix, cleanLine } = extractSectionMarkers(line);
            const transposedChordLine = transposeChordLine(cleanLine, transposeSemitones);
            
            elements.push(
              <div key={i} style={{ marginBottom: `${lineFontSize * 0.6}px` }}>
                {/* 和弦行 */}
                <div className="font-bold" style={{ color: colors.chord, fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: '0.05em', lineHeight: '1.2', fontWeight: 700 }}>
                  {prefix && <span style={{ color: colors.prefixSuffix, fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{prefix}</span>}
                  {transposedChordLine}
                  {suffix && <span style={{ color: colors.prefixSuffix, fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{suffix}</span>}
                </div>
                {/* 簡譜行 - 用等寬字體，保持原樣 */}
                <div style={{ 
                  fontSize: `${lineFontSize}px`, 
                  whiteSpace: 'pre-wrap', 
                  overflowWrap: 'break-word', 
                  lineHeight: '1.2',
                  fontFamily: "'Noto Sans Mono CJK TC', 'Sarasa Mono TC', 'Consolas', 'Courier New', monospace",
                  color: colors.numericNotation
                }}>
                  {lyricLine}
                </div>
              </div>
            );
            i = lyricLineIndex + 1;
          } else {
            // 中文歌詞行：使用對齊處理
            const { prefix, suffix, cleanLine } = extractSectionMarkers(line);
            const result = processPair(cleanLine, lyricLine, transposeSemitones);
            
            if (result.error) {
              // 即使 mismatch 也使用對齊後的結果
              elements.push(
                <div key={i} style={{ marginBottom: `${lineFontSize * 0.6}px` }}>
                  <div className="font-bold" style={{ color: colors.chord, fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: '0.05em', lineHeight: '1.2', fontWeight: 700 }}>
                    {prefix && <span style={{ color: colors.prefixSuffix, fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{prefix}</span>}
                    {result.chordLine}
                    {suffix && <span style={{ color: colors.prefixSuffix, fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{suffix}</span>}
                  </div>
                  <div style={{ fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', lineHeight: '1.2' }}>
                    {result.lyricParts.map((part, idx) => (
                      <span key={idx} style={{ 
                        color: part.isInside ? colors.lyricInside : colors.lyricNormal,
                        fontWeight: part.isInside && theme === 'day' ? 'bold' : 'normal'
                      }}>
                        {part.text}
                      </span>
                    ))}
                  </div>
                </div>
              );
            } else {
              elements.push(
                <div key={i} style={{ marginBottom: `${lineFontSize * 0.6}px` }}>
                  <div className="font-bold" style={{ color: colors.chord, fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: '0.05em', lineHeight: '1.2', fontWeight: 700 }}>
                    {prefix && <span style={{ color: colors.prefixSuffix, fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{prefix}</span>}
                    {result.chordLine}
                    {suffix && <span style={{ color: colors.prefixSuffix, fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{suffix}</span>}
                  </div>
                  <div style={{ fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', lineHeight: '1.2' }}>
                    {result.lyricParts.map((part, idx) => (
                      <span key={idx} style={{ 
                        color: part.isInside ? colors.lyricInside : colors.lyricNormal,
                        fontWeight: part.isInside && theme === 'day' ? 'bold' : 'normal'
                      }}>
                        {part.text}
                      </span>
                    ))}
                  </div>
                </div>
              );
            }
            i = lyricLineIndex + 1;
          }
        } else {
          // 冇歌詞行，當作單獨和弦行處理（包括 Section Marker）
          const sectionInfo = extractSectionMarker(line);
          
          if (sectionInfo.hasMarker) {
            // Section Marker 單獨一行 - 白色、底線、粗體
            elements.push(
              <div key={`${i}-marker`} style={{ marginBottom: `${lineFontSize * 0.6}px` }}>
                <span style={{ color: colors.lyricInside, fontSize: `${lineFontSize}px`, fontWeight: 'bold', textDecoration: 'underline', textUnderlineOffset: '4px' }}>
                  {sectionInfo.marker}
                </span>
              </div>
            );
            // 和弦部分
            const transposedChordLine = transposeChordLine(sectionInfo.rest, transposeSemitones);
            if (transposedChordLine.trim()) {
              elements.push(
                <div key={i} style={{ color: colors.chord, fontWeight: 'bold', fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: `${lineFontSize * 0.6}px` }}>
                  {transposedChordLine}
                </div>
              );
            }
          } else {
            const { prefix, suffix, cleanLine } = extractSectionMarkers(line);
            const transposedChordLine = transposeChordLine(cleanLine, transposeSemitones);
            
            elements.push(
              <div key={i} style={{ color: colors.chord, fontWeight: 'bold', fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: `${lineFontSize * 0.6}px` }}>
                {prefix && <span style={{ color: colors.prefixSuffix, fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{prefix}</span>}
                {transposedChordLine}
                {suffix && <span style={{ color: colors.prefixSuffix, fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{suffix}</span>}
              </div>
            );
          }
          i++;
        }
      } else {
        elements.push(
          <div key={i} style={{ color: colors.lyricNormal, fontSize: `${lineFontSize}px`, marginBottom: `${lineFontSize * 0.6}px`, whiteSpace: 'normal', overflowWrap: 'break-word' }}>{line}</div>
        );
        i++;
      }
    }

    return elements;
  };

  const ControlBar = () => (
    <div className={`flex flex-col gap-2 sm:gap-4 p-2 sm:p-4 border-b transition-colors ${
      theme === 'day' 
        ? 'bg-gray-100 border-gray-300' 
        : 'bg-black border-gray-800'
    }`}>
      <div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
          <span className={`text-xs sm:text-sm ${theme === 'day' ? 'text-gray-600' : 'text-gray-400'}`}>原調:</span>
          <span className={`text-xs sm:text-sm font-medium ${theme === 'day' ? 'text-gray-900' : 'text-white'}`}>{originalKey}</span>
          <span className={theme === 'day' ? 'text-gray-400' : 'text-gray-600'}>→</span>
          <span className={`text-xs sm:text-sm ${theme === 'day' ? 'text-gray-600' : 'text-gray-400'}`}>PLAY:</span>
          <span className={`text-xs sm:text-sm font-bold ${currentKey !== originalKey ? (theme === 'day' ? 'text-purple-600' : 'text-[#FFD700]') : (theme === 'day' ? 'text-gray-900' : 'text-white')}`}>
            {currentKey}
          </span>
          
          {currentKey !== originalKey && (
            <>
              {capoSuggestion.status === 'none' && (
                <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded ${theme === 'day' ? 'bg-gray-200 text-gray-600' : 'bg-gray-800 text-gray-400'}`}>免Capo</span>
              )}
              {capoSuggestion.status === 'ok' && (
                <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded ${theme === 'day' ? 'bg-green-100 text-green-700' : 'bg-green-900/50 text-green-400'}`}>Capo {displayCapo}</span>
              )}
              {capoSuggestion.status === 'high' && (
                <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded ${theme === 'day' ? 'bg-orange-100 text-orange-700' : 'bg-orange-900/50 text-orange-400'}`}>Capo {displayCapo}太高</span>
              )}
            </>
          )}
        </div>
        
        {currentKey !== originalKey && capoSuggestion.alternative && (
          <div className={`mb-2 text-[10px] sm:text-xs ${theme === 'day' ? 'text-gray-500' : 'text-gray-500'}`}>
            <span className={theme === 'day' ? 'text-orange-600' : 'text-orange-400'}>提示：</span>
            建議 Drop Tuning
            <button
              onClick={() => {
                setCurrentKey('C')
                onKeyChange?.('C')
              }}
              className={`ml-2 hover:underline ${theme === 'day' ? 'text-purple-600' : 'text-[#FFD700]'}`}
            >
              改用 C
            </button>
          </div>
        )}
        
        {/* Key Selector - 響應式：手機 375px 顯示 12 個 Key */}
        <div className="flex flex-wrap gap-[2px] sm:gap-1.5 pb-1 sm:pb-2">
          {/* 只顯示 12 個基本 Key（移除 Gb 避免重複）*/}
          {(baseKey?.endsWith('m') ? MINOR_KEYS.filter(k => !['Ebm', 'G#m', 'A#m'].includes(k)) : MAJOR_KEYS).map((key) => {
            const isCurrent = key === currentKey;
            return (
              <button
                key={key}
                onClick={() => {
                  setCurrentKey(key)
                  onKeyChange?.(key)
                }}
                className={`
                  flex-shrink-0
                  w-5 h-5 sm:w-8 sm:h-8 md:w-9 md:h-9
                  rounded-full 
                  flex items-center justify-center 
                  text-[10px] sm:text-xs md:text-sm font-bold
                  transition hover:scale-105
                  ${isCurrent
                    ? theme === 'day'
                      ? 'bg-purple-600 text-white ring-1 sm:ring-2 ring-purple-600'
                      : 'bg-black text-[#FFD700] ring-1 sm:ring-2 ring-[#FFD700]'
                    : theme === 'day'
                      ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                      : 'bg-[#FFD700] text-black'
                  }
                `}
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`h-px ${theme === 'day' ? 'bg-gray-300' : 'bg-gray-700'}`} />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="flex items-center gap-0.5 sm:gap-2">
            <button
              onClick={() => handleFontSize(-1)}
              className={`w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded transition text-[10px] sm:text-xs ${
                theme === 'day'
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-gray-800 text-white hover:bg-gray-700'
              }`}
            >
              A-
            </button>
            <span className={`w-6 sm:w-8 text-center text-xs ${theme === 'day' ? 'text-gray-600' : 'text-gray-400'}`}>{fontSize}</span>
            <button
              onClick={() => handleFontSize(1)}
              className={`w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded transition text-xs sm:text-sm ${
                theme === 'day'
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-gray-800 text-white hover:bg-gray-700'
              }`}
            >
              A+
            </button>
          </div>

          <div className={`w-px h-4 sm:h-6 ${theme === 'day' ? 'bg-gray-300' : 'bg-gray-700'}`} />

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsAutoScroll(!isAutoScroll)}
              className={`flex items-center gap-0.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded transition text-xs ${
                isAutoScroll 
                  ? theme === 'day'
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#FFD700] text-black'
                  : theme === 'day'
                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    : 'bg-gray-800 text-white hover:bg-gray-700'
              }`}
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span className="hidden sm:inline">{isAutoScroll ? '停止' : '自動滾動'}</span>
            </button>
            
            {isAutoScroll && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setScrollSpeed(Math.max(1, scrollSpeed - 1))}
                  className={`w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded text-[10px] sm:text-xs ${
                    theme === 'day'
                      ? 'bg-gray-200 text-gray-700'
                      : 'bg-gray-700 text-white'
                  }`}
                  disabled={scrollSpeed <= 1}
                >
                  −
                </button>
                <span className={`w-4 sm:w-5 text-center text-[10px] sm:text-xs ${theme === 'day' ? 'text-gray-600' : 'text-gray-400'}`}>{scrollSpeed}</span>
                <button
                  onClick={() => setScrollSpeed(Math.min(5, scrollSpeed + 1))}
                  className={`w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded text-[10px] sm:text-xs ${
                    theme === 'day'
                      ? 'bg-gray-200 text-gray-700'
                      : 'bg-gray-700 text-white'
                  }`}
                  disabled={scrollSpeed >= 5}
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={`p-1.5 sm:px-3 sm:py-1.5 transition ${
              theme === 'day' ? 'text-purple-600 hover:text-purple-800' : 'text-[#FFD700] hover:opacity-80'
            }`}
            title="複製譜內容"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  if (isEditing && editable) {
    return (
      <div className={`${theme === 'day' ? 'bg-white rounded-xl border border-gray-300' : 'bg-[#121212] rounded-xl border border-gray-800'} ${className}`}>
        {showControls && <ControlBar />}
        <div className="p-4">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className={`w-full h-96 p-4 rounded-lg border focus:outline-none resize-none font-mono text-sm ${
              theme === 'day'
                ? 'bg-gray-50 text-gray-800 border-gray-300 focus:border-purple-500'
                : 'bg-black text-gray-300 border-gray-700 focus:border-[#FFD700]'
            }`}
            placeholder="輸入譜內容..."
          />
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => setIsEditing(false)}
              className={`px-4 py-2 transition ${theme === 'day' ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-white'}`}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className={`px-4 py-2 rounded-lg transition ${
                theme === 'day'
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-[#FFD700] text-black hover:opacity-90'
              }`}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 顯示模式 - 確保高度自適應內容
  return (
    <div 
      className={`${fullWidth 
        ? (theme === 'day' ? 'bg-white' : 'bg-black') 
        : (theme === 'day' ? 'bg-white rounded-xl border border-gray-300' : 'bg-[#121212] rounded-xl border border-gray-800')
      } ${className}`}
      style={{ 
        height: 'auto',
        minHeight: 'auto',
        maxHeight: 'none'
      }}
    >
      {showControls && <ControlBar />}
      <div 
        ref={containerRef}
        className={fullWidth ? 'p-3' : `p-3 sm:p-6 ${theme === 'day' ? 'bg-white' : 'bg-[#121212]'}`}
        style={{
          height: 'auto',
          minHeight: 'auto',
          maxHeight: 'none'
        }}
      >
        <div 
          className="tab-content-wrapper"
          style={{
            height: 'auto',
            minHeight: 'auto',
            maxHeight: 'none',
            fontFamily: "'Noto Sans Mono CJK TC', 'Sarasa Mono TC', 'Consolas', 'Courier New', monospace"
          }}
        >
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default TabContent;

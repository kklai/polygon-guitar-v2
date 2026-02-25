import React, { useState, useRef, useEffect, useCallback } from 'react';
import { extractChords, ChordDiagramModal, SingleChordDiagram, ChordWithHover, ChordLineWithHover } from './ChordDiagram';

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
  // 全形標點符號（如 （））寬度為 2
  const code = char.charCodeAt(0);
  if (code >= 0xFF01 && code <= 0xFF5E) return 2; // 全形 ASCII 變體
  if (code >= 0xFFE0 && code <= 0xFFE6) return 2; // 全形符號
  return 1;
}

function getTextWidth(text) {
  let width = 0;
  for (let char of text) width += getCharWidth(char);
  return width;
}

// 計算開括號位置（左對齊）
function findBracketPositions(lyricLine) {
  const positions = [];
  let currentWidth = 0;
  for (let char of lyricLine) {
    if (char === '(' || char === '（') positions.push(currentWidth);
    currentWidth += getCharWidth(char);
  }
  return positions;
}

// 計算隱藏括號後嘅調整位置（左對齊）
function findAdjustedBracketPositions(lyricLine) {
  const positions = [];
  let visibleWidth = 0;
  let inBracket = false;
  
  for (let char of lyricLine) {
    if (char === '(' || char === '（') {
      // 開括號位置 = 當前可視寬度（括號本身隱藏，唔佔位）
      positions.push(visibleWidth);
      inBracket = true;
    } else if (char === ')' || char === '）') {
      // 閉合括號唔佔位
      inBracket = false;
    } else {
      // 非括號字符正常計算寬度
      visibleWidth += getCharWidth(char);
    }
  }
  return positions;
}

function normalizeInput(text) {
  return text.replace(/｜/g, '|').replace(/　/g, ' ').replace(/\r?\n/g, '');
}

// Section marker 列表
const SECTION_MARKERS = [
  'Intro', 'Outro', 
  'Verse', 'Verse 1', 'Verse 2', 'Verse 3', 'Verse 4',
  'Chorus', 'Chorus 1', 'Chorus 2', 'Chorus 3',
  'Prechorus', 'Pre-chorus', 'Pre chorus', 'Pre Chorus', 'Pre Chorus 1', 'Pre Chorus 2',
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
  // Capo 9-11: 建議 Drop Tuning 替代方案
  if (capo === 11) {
    return { 
      capo: capo, 
      status: 'high',
      message: `Capo ${capo} 位置過高`,
      alternative: { 
        type: 'dropTuning', 
        tuning: 'Eb Tuning',
        tuningDesc: '降半音調音 (Eb Ab Db Gb Bb Eb)',
        newCapo: 1,
        message: '改用 Eb Tuning，Capo 1'
      }
    };
  }
  if (capo === 10) {
    return { 
      capo: capo, 
      status: 'high',
      message: `Capo ${capo} 位置過高`,
      alternative: { 
        type: 'dropTuning', 
        tuning: 'D Tuning',
        tuningDesc: '降全音調音 (D G C F A D)',
        newCapo: 0,
        message: '改用 D Tuning，免 Capo'
      }
    };
  }
  if (capo === 9) {
    return { 
      capo: capo, 
      status: 'high',
      message: `Capo ${capo} 位置過高`,
      alternative: { 
        type: 'dropTuning', 
        tuning: 'Db Tuning',
        tuningDesc: '降一個半音調音 (Db Gb B E Ab Db)',
        newCapo: 0,
        message: '改用 Db Tuning，免 Capo'
      }
    };
  }
  return { capo: null, status: 'invalid', message: '', alternative: null };
}

// 檢查是否為簡譜行（數字譜，如 5 5 6 6 或 (6.)6.13312）
function isNumericNotationLine(line) {
  if (!line) return false;
  
  // 簡譜特徵：
  // 1. 大量數字（多於 3 個）- 支持 1' 高音, 5# 升號
  // 2. 可以包含括號內的數字 (6.)、(2) 等
  // 3. 很少或沒有中文字符（少於 3 個）
  // 4. 冇和弦豎線 |
  // 5. 英文字母要少（簡譜只有 b, # 是合法的）
  
  // 匹配完整簡譜音符：數字 + 可選的 ' 或 #（如 1', 5#, 6, 3'）
  const notationPattern = /\d['#]*/g;
  const notationMatches = line.match(notationPattern) || [];
  const notationCount = notationMatches.length;
  
  // 也計算純數字（向後兼容）
  const digits = (line.match(/\d/g) || []).length;
  const chineseChars = (line.match(/[\u4e00-\u9fff]/g) || []).length;
  const hasChordBar = /\|[\s]*[A-G]/.test(line);
  
  // 檢查英文字母（簡譜只應有 b, # 或少量其他字母）
  const allLetters = (line.match(/[a-zA-Z]/g) || []);
  const otherLetters = allLetters.filter(c => !/[b#]/i.test(c));
  
  // 如果有很多其他英文字母（如 D7add4, xx0012 等），這不是簡譜
  if (otherLetters.length > 3) {
    return false;
  }
  
  // 簡譜音符多（>3）、中文字少（<3）、冇和弦 = 簡譜
  if ((notationCount > 3 || digits > 3) && chineseChars < 3 && !hasChordBar) {
    return true;
  }
  
  // 舊版兼容：有括號數字模式（半形或全形）
  if (line.includes('(') || line.includes('（')) {
    const numericBracketPattern = /[\(（]\d+\.?[\)）]/g;
    const numericBrackets = line.match(numericBracketPattern) || [];
    if (numericBrackets.length >= 1 && (notationCount > 3 || digits > 3) && chineseChars < 3 && otherLetters.length <= 3) {
      return true;
    }
  }
  
  return false;
}

// 從簡譜行提取所有音符（支持 1', 5#, 6 等格式）
function extractNotationNumbers(line) {
  const numbers = [];
  // 匹配完整簡譜音符：數字 + 可選的 ' 或 #（高音/升號）
  const regex = /\d['#]*/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    numbers.push({
      value: match[0],
      index: match.index
    });
  }
  return numbers;
}

// 從歌詞行提取字符（中文每個字算一個，英文每個單詞算一個，空格和括號不計）
function extractLyricChars(line) {
  const chars = [];
  // 先移除括號（半形 + 全形），再匹配中文字或英文單詞
  const lineWithoutBrackets = line.replace(/[()（）]/g, '');
  const charRegex = /[\u4e00-\u9fff]|[a-zA-Z]+/g;
  let match;
  while ((match = charRegex.exec(lineWithoutBrackets)) !== null) {
    chars.push({
      char: match[0],
      index: match.index
    });
  }
  return chars;
}

// 從歌詞行提取顯示單元（括號組 + 非括號文字）
function extractLyricUnits(line) {
  const units = [];
  let i = 0;
  
  while (i < line.length) {
    if (line[i] === '(' || line[i] === '（') {
      // 找到完整的括號對（半形或全形）
      const openBracket = line[i];
      const closeBracket = openBracket === '(' ? ')' : '）';
      let bracketContent = openBracket;
      let j = i + 1;
      while (j < line.length && line[j] !== closeBracket) {
        bracketContent += line[j];
        j++;
      }
      if (j < line.length && line[j] === closeBracket) {
        bracketContent += closeBracket;
        j++;
      }
      units.push({
        type: 'bracket',
        content: bracketContent,
        startIndex: i,
        endIndex: j,
        hasChinese: /[\u4e00-\u9fff]/.test(bracketContent)
      });
      i = j;
    } else {
      // 非括號文字
      let text = '';
      let startIndex = i;
      while (i < line.length && line[i] !== '(' && line[i] !== '（') {
        text += line[i];
        i++;
      }
      if (text) {
        // 計算字符數：中文每個字算一個，英文每個單詞算一個（空格不計）
        const chineseCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
        units.push({
          type: 'text',
          content: text,
          startIndex: startIndex,
          endIndex: i,
          chineseChars: chineseCount + englishWords
        });
      }
    }
  }
  
  return units;
}

// 將簡譜數字與歌詞字對齊
function alignNotationWithLyrics(notationLine, lyricLine) {
  const numbers = extractNotationNumbers(notationLine);
  const lyricChars = extractLyricChars(lyricLine);
  const lyricUnits = extractLyricUnits(lyricLine);
  
  // 如果數量不匹配，返回 null（使用普通渲染）
  if (numbers.length !== lyricChars.length || numbers.length === 0) {
    return null;
  }
  
  // 為每個中文字分配一個簡譜數字
  const result = [];
  let charIndex = 0;
  
  for (const unit of lyricUnits) {
    if (unit.type === 'bracket') {
      // 括號單元 - 只計算中文和英文單詞（括號本身不計）
      const innerContent = unit.content.slice(1, -1); // 去掉首尾括號
      const chineseCount = (innerContent.match(/[\u4e00-\u9fff]/g) || []).length;
      const englishWords = (innerContent.match(/[a-zA-Z]+/g) || []).length;
      const unitCharCount = chineseCount + englishWords;
      
      if (unitCharCount === 0) {
        // 空括號或無字符 - 白色
        result.push({
          type: 'bracket',
          content: unit.content,
          notation: null,
          isInside: true
        });
      } else if (unitCharCount === 1) {
        // 單個字符在括號內
        result.push({
          type: 'pair',
          notation: numbers[charIndex]?.value || '',
          lyric: unit.content,
          isInside: true
        });
        charIndex++;
      } else {
        // 多個字符在括號內 - 只取第一個對應的簡譜，也是白色
        result.push({
          type: 'bracket',
          content: unit.content,
          notation: numbers[charIndex]?.value || '',
          isInside: true
        });
        charIndex += unitCharCount;
      }
    } else {
      // 純文字單元
      const text = unit.content;
      // 匹配中文字或英文單詞
      const charMatches = [...text.matchAll(/[\u4e00-\u9fff]|[a-zA-Z]+/g)];
      
      if (charMatches.length === 0) {
        // 無字符
        result.push({
          type: 'text',
          content: text
        });
      } else {
        // 有需要對齊的字符
        let lastIndex = 0;
        for (const match of charMatches) {
          const charPos = match.index;
          // 字前的其他文字
          if (charPos > lastIndex) {
            result.push({
              type: 'text',
              content: text.substring(lastIndex, charPos)
            });
          }
          // 這個字符
          result.push({
            type: 'pair',
            notation: numbers[charIndex]?.value || '',
            lyric: match[0],
            isInside: false
          });
          charIndex++;
          lastIndex = charPos + match[0].length;
        }
        // 剩餘的非中文字
        if (lastIndex < text.length) {
          result.push({
            type: 'text',
            content: text.substring(lastIndex)
          });
        }
      }
    }
  }
  
  return result;
}

// 處理簡譜行（數字旋律譜）- 括號內所有內容（數字+歌詞）標記為白色
function processNumericNotationLine(line) {
  // 如果冇括號，成行都係簡譜數字（粉紅色）
  if (!line.includes('(') && !line.includes('（')) {
    return [{ type: 'outside', content: line }];
  }
  
  // 解析括號內容：(內容) 或 （內容）- 包括數字簡譜和歌詞
  const parts = [];
  let buffer = '';
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    
    if (char === '(' || char === '（') {
      // 保存括號前的內容（簡譜數字）
      if (buffer) {
        parts.push({ type: 'outside', content: buffer });
        buffer = '';
      }
      
      // 確定對應的閉合括號
      const closeBracket = char === '(' ? ')' : '）';
      
      // 讀取括號內容（包括數字和歌詞）
      let bracketContent = char;
      i++;
      while (i < line.length && line[i] !== closeBracket) {
        bracketContent += line[i];
        i++;
      }
      if (i < line.length && line[i] === closeBracket) {
        bracketContent += closeBracket;
        i++;
      }
      
      // 括號內所有內容（數字+歌詞）都標記為 inside（白色）
      parts.push({ type: 'inside', content: bracketContent });
    } else {
      buffer += char;
      i++;
    }
  }
  
  // 保存剩餘內容
  if (buffer) {
    parts.push({ type: 'outside', content: buffer });
  }
  
  return parts;
}

// 從簡譜行提取和弦、數字簡譜、歌詞
function extractNumericNotationComponents(line) {
  const components = {
    chords: [],      // 和弦數組，帶位置
    notations: [],   // 數字簡譜數組
    lyrics: []       // 歌詞數組
  };
  
  // 先處理 | 小節線
  const segments = line.split('|').map(s => s.trim()).filter(s => s);
  
  segments.forEach((segment, segIdx) => {
    // 在segment中找括號
    const regex = /(\([^)]*\))/g;
    let match;
    let lastIndex = 0;
    
    while ((match = regex.exec(segment)) !== null) {
      const bracketPos = match.index;
      const bracketContent = match[1]; // (內容)
      
      // 括號前的是和弦（如果有）
      const beforeBracket = segment.substring(lastIndex, bracketPos).trim();
      if (beforeBracket) {
        // 檢查是否為和弦
        const chordMatch = beforeBracket.match(/[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|m7|7|9|11|13)?$/);
        if (chordMatch) {
          components.chords.push({
            chord: chordMatch[0],
            position: segIdx,
            notation: bracketContent
          });
        }
      }
      
      // 括號內的是數字簡譜
      components.notations.push({
        notation: bracketContent,
        position: segIdx
      });
      
      lastIndex = regex.lastIndex;
    }
  });
  
  return components;
}

// 檢查是否為混合行（同時包含和弦和歌詞）
function isMixedLine(line) {
  // 必須包含括號（歌詞標記）- 半形或全形
  if (!line.includes('(') && !line.includes('（')) return false;
  
  // 排除數字譜行（大量數字、少中文字）
  const digits = (line.match(/\d/g) || []).length;
  const chineseChars = (line.match(/[\u4e00-\u9fff]/g) || []).length;
  if (digits > 5 && chineseChars < 3) {
    return false; // 這是數字譜行，不是混合行
  }
  
  // 檢查是否有 Section Marker
  const sectionInfo = extractSectionMarker(line);
  if (sectionInfo.hasMarker) {
    // 有 Section Marker 的行，檢查剩餘部分是否包含 |
    const rest = sectionInfo.rest;
    return /\|/.test(rest) && (/\(/.test(rest) || /\（/.test(rest));
  }
  
  // 沒有 Section Marker，檢查是否包含 | 開頭的和弦 + 括號歌詞
  // 但排除純歌詞行（只有中文字和括號）
  const hasChordBar = /\|[\s]*[A-G][#b]?/.test(line);
  const hasLyricBracket = /[\(（][^A-G]/.test(line); // 括號內不是和弦（避免誤判）
  
  // 如果中文字比例高，視為歌詞行而非混合行
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
      } else if (char === '(' || char === '（') {
        // 遇到 ( 或 （ 也開始歌詞部分
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
      // 解析括號，將括號與內容分開處理（支持隱藏括號功能）
      let buffer = '';
      let inBracket = false;
      for (let char of seg.lyric) {
        if (char === '(' || char === '（') {
          if (buffer) lyricParts.push({ text: buffer, isInside: false, type: 'text' });
          lyricParts.push({ text: char, isInside: false, type: 'bracket-open' });
          buffer = '';
          inBracket = true;
        } else if (char === ')' || char === '）') {
          if (buffer) lyricParts.push({ text: buffer, isInside: true, type: 'inside' });
          lyricParts.push({ text: char, isInside: false, type: 'bracket-close' });
          buffer = '';
          inBracket = false;
        } else {
          buffer += char;
        }
      }
      if (buffer) lyricParts.push({ text: buffer, isInside: inBracket, type: inBracket ? 'inside' : 'text' });
    }
    // 段落之間加空格
    if (idx < segments.length - 1) {
      lyricParts.push({ text: '  ', isInside: false, type: 'text' });
    }
  });
  
  return { 
    sectionMarker: sectionPrefix,
    chordPart: chordLine || '|', 
    lyricParts, 
    error: false 
  };
}

function processPair(chordLine, lyricLine, transposeSemitones = 0, hideBrackets = false, displayFont = 'mono') {
  // Arial 模式下，唔好做複雜對齊，直接返回原始行
  if (displayFont === 'arial') {
    return { 
      chordLine: transposeSemitones !== 0 ? transposeChordLine(chordLine, transposeSemitones) : chordLine, 
      lyricParts: [{ text: lyricLine, isInside: false, type: 'text' }], 
      error: false 
    };
  }
  
  // 先確保和弦之間有空格，再處理
  const chordWithSpacing = normalizeChordSpacing(chordLine);
  const normalizedChord = normalizeInput(chordWithSpacing);
  const normalizedLyric = normalizeInput(lyricLine);
  // 計算開括號位置（統一使用原位置，無論顯示/隱藏括號都保持相同寬度）
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

  // 重建和弦行 - 使用全形空格確保與中文字對齊
  let newChordLine = '';
  let currentVisualWidth = 0;
  
  for (let idx = 0; idx < tokens.length; idx++) {
    const token = tokens[idx];
    const targetPos = tokenPositions[idx];
    
    // 直接定位到 targetPos
    let startCol = targetPos;
    if (token.isBarStart) startCol -= 0.5;
    startCol = Math.round(startCol);
    if (startCol < 0) startCol = 0;
    
    // 計算需要填充嘅視覺寬度
    const spacesNeeded = startCol - currentVisualWidth;
    if (spacesNeeded > 0) {
      // 全形空格 　 寬度為 2，用嚟對齊中文字
      const fullWidthSpaces = Math.floor(spacesNeeded / 2);
      const halfWidthSpace = spacesNeeded % 2;
      newChordLine += '\u3000'.repeat(fullWidthSpaces);
      if (halfWidthSpace) newChordLine += ' ';
      currentVisualWidth += spacesNeeded;
    }
    
    newChordLine += token.fullToken;
    currentVisualWidth += token.width;
  }

  const parts = [];
  let buffer = '';
  let inBracket = false;
  
  for (let char of normalizedLyric) {
    // 跳過換行符
    if (char === '\n' || char === '\r') {
      continue;
    }
    if (char === '(' || char === '（') {
      // 括號前的內容
      if (buffer) parts.push({ text: buffer, isInside: false, type: 'text' });
      // 開括號獨立記錄（保留原始字符）
      parts.push({ text: char, isInside: false, type: 'bracket-open' });
      buffer = '';
      inBracket = true;
    } else if (char === ')' || char === '）') {
      // 括號內容
      if (buffer) {
        const normalizedBuffer = buffer.replace(/ /g, '\u3000');
        parts.push({ text: normalizedBuffer, isInside: true, type: 'inside' });
      }
      // 閉括號獨立記錄（保留原始字符）
      parts.push({ text: char, isInside: false, type: 'bracket-close' });
      buffer = '';
      inBracket = false;
    } else {
      buffer += char;
    }
  }
  if (buffer) {
    // 處理剩餘內容
    const normalizedBuffer = inBracket ? buffer.replace(/ /g, '\u3000') : buffer;
    parts.push({ text: normalizedBuffer, isInside: inBracket, type: inBracket ? 'inside' : 'text' });
  }

  return { chordLine: newChordLine, lyricParts: parts, error: mismatch };
}

// ============ 自動拆分長歌詞行 ============
// 將長的和弦行和歌詞行拆分成多對，保持每對不換行
// 只在手機版（屏幕寬度 < 768px）時啟用
function splitLongPair(chordLine, lyricLine, maxChars = 28, isMobile = false) {
  // 暫時禁用自動拆分功能，避免文字丟失和對齊問題
  // 直接返回原樣，讓歌詞自然換行
  return [{ chordLine, lyricLine }];
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
  setTheme: externalSetTheme,
  hideKeySelector = false,
  // 外部控制的字體大小和自動滾動
  externalFontSize,
  externalIsAutoScroll,
  externalScrollSpeed,
  onFontSizeChange,
  onAutoScrollChange,
  onScrollSpeedChange,
  // YouTube 和歌曲資訊
  youtubeVideoId,
  songInfo = {},
  // 編譜者名稱
  arrangedBy = '',
  // 顯示字體設定
  displayFont = 'mono'
}) => {
  // 使用 playKey 作為基準調（如果有的話）
  const baseKey = playKey || originalKey;
  const [currentKey, setCurrentKey] = useState(initialKey || baseKey);
  const [internalFontSize, setInternalFontSize] = useState(20);
  const [internalIsAutoScroll, setInternalIsAutoScroll] = useState(false);
  const [internalScrollSpeed, setInternalScrollSpeed] = useState(3);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content || '');
  const [internalTheme, setInternalTheme] = useState('night'); // 'night' | 'day'
  const [hideNotation, setHideNotation] = useState(false); // 隱藏簡譜功能
  const [hideBrackets, setHideBrackets] = useState(false); // 隱藏括號功能
  const [isMobile, setIsMobile] = useState(false); // 手機版檢測
  
  // 檢測是否為手機版
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // 優先使用外部傳入的值，否則使用內部 state
  const theme = externalTheme !== undefined ? externalTheme : internalTheme;
  const setTheme = externalSetTheme !== undefined ? externalSetTheme : setInternalTheme;
  const fontSize = externalFontSize !== undefined ? externalFontSize : internalFontSize;
  const setFontSize = onFontSizeChange !== undefined ? (v) => onFontSizeChange(v) : setInternalFontSize;
  const isAutoScroll = externalIsAutoScroll !== undefined ? externalIsAutoScroll : internalIsAutoScroll;
  const setIsAutoScroll = onAutoScrollChange !== undefined ? (v) => onAutoScrollChange(v) : setInternalIsAutoScroll;
  const scrollSpeed = externalScrollSpeed !== undefined ? externalScrollSpeed : internalScrollSpeed;
  const setScrollSpeed = onScrollSpeedChange !== undefined ? (v) => onScrollSpeedChange(v) : setInternalScrollSpeed;
  
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
      numericNotation: '#CCCCCC', // 淺灰色
      prefixSuffix: '#808080'
    },
    day: {
      bg: '#FFFFFF',
      text: '#000000',
      lyricNormal: '#333333',
      lyricInside: '#000000',
      chord: '#8B5CF6', // 紫色
      sectionMarker: '#000000',
      numericNotation: '#CCCCCC', // 淺灰色
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
      // 速度：6 個選項（0-5），由慢到快
      const speeds = [0, 0.3, 0.5, 0.7, 0.9, 1.2];
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
    const newSize = Math.max(12, Math.min(28, fontSize + delta));
    if (onFontSizeChange) {
      onFontSizeChange(newSize);
    } else {
      setInternalFontSize(newSize);
    }
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
    
    // 網頁版（寬度 >= 768）使用固定字體大小，唔根據行長調整
    if (containerWidth >= 768) {
      return Math.max(10, Math.min(28, Math.round(fontSize)));
    }
    
    // 手機版根據行長調整
    const adjustedBase = calculateFontSize(lineText, containerWidth);
    const ratio = fontSize / 16;
    return Math.max(10, Math.min(28, Math.round(adjustedBase * ratio)));
  };

  // 處理歌詞行：括號外灰色，括號內白色
  const processLyricLine = (line) => {
    const parts = [];
    let buffer = '';
    let inBracket = false;
    
    for (let char of line) {
      // 跳过换行符，避免产生空行
      if (char === '\n' || char === '\r') {
        continue;
      }
      if (char === '(' || char === '（') {
        // 括號前的內容
        if (buffer) {
          parts.push({ type: inBracket ? 'inside' : 'outside', text: buffer });
          buffer = '';
        }
        // 將開括號作為獨立部分（保留原始字符）
        parts.push({ type: 'bracket-open', text: char });
        inBracket = true;
      } else if (char === ')' || char === '）') {
        // 括號內的內容（包括空字符串）
        // 等寬字體模式下，將半形空格轉為全形空格，確保對齊
        const normalizedBuffer = displayFont === 'mono' ? buffer.replace(/ /g, '\u3000') : buffer;
        parts.push({ type: 'inside', text: normalizedBuffer }); // buffer 可能為空，但空括號也要顯示
        buffer = '';
        // 將閉括號作為獨立部分（保留原始字符）
        parts.push({ type: 'bracket-close', text: char });
        inBracket = false;
      } else {
        buffer += char;
      }
    }
    
    // 剩餘內容
    if (buffer) {
      parts.push({ type: inBracket ? 'inside' : 'outside', text: buffer });
    }
    
    return parts;
  };

  const renderContent = () => {
    if (!content) return null;

    const lines = content.split('\n');
    
    // Arial 模式：簡化處理，但仍需支援轉調，並保持和弦行與歌詞行緊貼
    if (displayFont === 'arial') {
      // 輔助函數：檢查是否為和弦行
      const checkIsChordLine = (line) => {
        if (!line) return false;
        const hasChordPattern = /\b[A-G][#b]?(m|maj|min|sus|dim|aug|add|m7|7|9|11|13)?\d*\b/.test(line);
        const hasChinese = /[\u4e00-\u9fff]/.test(line);
        return hasChordPattern && !hasChinese;
      };
      
      // 輔助函數：檢查是否為歌詞行
      const checkIsLyricLine = (line) => {
        if (!line) return false;
        const hasChinese = /[\u4e00-\u9fff]/.test(line);
        const hasEnglish = /[a-zA-Z]+/.test(line);
        const hasChordPattern = /\b[A-G][#b]?(m|maj|min|sus|dim|aug|add|m7|7|9|11|13)?\d*\b/.test(line);
        return (hasChinese || hasEnglish) && !hasChordPattern;
      };
      
      return (
        <div style={{ fontFamily: "Arial, Helvetica, sans-serif", lineHeight: '1' }}>
          {lines.map((line, idx) => {
            // 檢查是否為 Section Marker
            const sectionCheck = extractSectionMarker(line);
            if (sectionCheck.hasMarker) {
              return (
                <div key={idx} style={{ 
                  fontSize: `${fontSize}px`, 
                  marginTop: '0.5em',
                  marginBottom: '0.3em',
                  fontWeight: 'bold',
                  textDecoration: 'underline',
                  textUnderlineOffset: '4px',
                  color: colors.lyricInside
                }}>
                  {sectionCheck.marker}
                  {sectionCheck.rest && (
                    <span style={{ color: colors.chord }}> {sectionCheck.rest}</span>
                  )}
                </div>
              );
            }
            
            // 檢查是否為和弦行
            const isChordLine = checkIsChordLine(line);
            const isLyricLine = checkIsLyricLine(line);
            const hasChinese = /[\u4e00-\u9fff]/.test(line);
            
            // 如果是和弦行且有轉調，處理轉調
            let displayLine = line;
            if (isChordLine && transposeSemitones !== 0) {
              displayLine = transposeChordLine(line, transposeSemitones);
            }
            
            // 檢查下一行是否為歌詞行（如果當前是和弦行）
            const nextLine = lines[idx + 1];
            const isFollowedByLyric = isChordLine && checkIsLyricLine(nextLine);
            
            // 檢查上一行是否為和弦行（如果當前是歌詞行）
            const prevLine = lines[idx - 1];
            const isPrecededByChord = isLyricLine && checkIsChordLine(prevLine);
            
            // 設定行距：和弦行同歌詞行之間完全緊貼，lineHeight 設為 1 消除額外空隙
            const lineHeight = (isFollowedByLyric || isPrecededByChord) ? '1.1' : '1';
            const marginBottom = isFollowedByLyric ? '0em' : '0.3em';
            const marginTop = isPrecededByChord ? '0em' : '0';
            
            return (
              <div key={idx} style={{ 
                fontSize: `${fontSize}px`, 
                marginTop,
                marginBottom,
                lineHeight,
                whiteSpace: 'pre',
                color: hasChinese ? colors.lyricInside : colors.chord
              }}>
                {displayLine || ' '}
              </div>
            );
          })}
        </div>
      );
    }
    
    // 等寬字體模式：原有複雜處理
    const elements = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      
      if (!line.trim()) {
        // 跳過連續空行，只保留一個
        if (i > 0 && !lines[i - 1].trim()) {
          i++;
          continue;
        }
        // 和弦行與歌詞行之間的空行，顯示更小間距
        elements.push(<div key={i} style={{ height: '0.3em' }} />);
        i++;
        continue;
      }
      
      // 計算當前行的字體大小
      const lineFontSize = getLineFontSize(line);
      
      // ========== 優先檢查 Section Marker ==========
      const sectionCheck = extractSectionMarker(line);
      if (sectionCheck.hasMarker) {
        elements.push(
          <div key={`${i}-marker`} style={{ marginBottom: `${lineFontSize * 0.6}px` }}>
            <span style={{ color: colors.lyricInside, fontSize: `${lineFontSize}px`, fontWeight: 'bold', textDecoration: 'underline', textUnderlineOffset: '4px' }}>
              {sectionCheck.marker}
            </span>
          </div>
        );
        const restLine = sectionCheck.rest.trim();
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
      
      // 檢查是否為歌詞行或和弦行
      const chineseChars = line.match(/[\u4e00-\u9fff]/g) || [];
      const englishWords = line.match(/[a-zA-Z]+/g) || [];
      // 檢查是否有 | 開頭的和弦標記
      const hasChordBar = /\|[\s]*[A-G]/.test(line);
      
      // 檢查是否為和弦行（添加 \d* 支持 Em9 等數字結尾和弦）
      const strictChordPattern = /\b[A-G](#|b)?(m|maj|min|sus|dim|aug|add|m7|7|9|11|13)?\d*\b/g;
      const chordMatches = line.match(strictChordPattern) || [];
      const validChordMatches = chordMatches.filter(m => /^[A-G]/.test(m.trim()));
      const hasBarLineStart = /^[\s]*[\|｜]/.test(line);
      // 修復：單一和弦（無|）也要識別，只要全行符合和弦模式
      const isChordOnlyLine = validChordMatches.length > 0 && line.trim().split(/\s+/).every(part => {
        // 檢查每個部分是否為和弦或小節線
        const cleanPart = part.replace(/[\|\/\s]/g, '');
        return !cleanPart || cleanPart.match(/^[A-G](#|b)?(m|maj|min|sus|dim|aug|add|m7|7|9|11|13)?\d*$/);
      });
      const hasChordPattern = hasBarLineStart ? validChordMatches.length >= 1 : (validChordMatches.length >= 2 || isChordOnlyLine);
      const isChord = hasChordPattern && chineseChars.length < 3;
      
      // 檢查是否為歌詞行（有中文字或英文單詞，且冇和弦特徵）
      const isLyric = !isChord && (chineseChars.length > 0 || englishWords.length > 0);
      
      // 如果是歌詞行，優先處理
      if (isLyric) {
        // Arial 模式下，唔好拆開處理，直接顯示整行（保留空格）
        if (displayFont === 'arial') {
          elements.push(
            <div key={i} style={{ fontSize: `${lineFontSize}px`, marginBottom: `${lineFontSize * 0.6}px`, whiteSpace: 'pre', color: colors.lyricInside }}>
              {line}
            </div>
          );
          i++;
          continue;
        }
        
        // 等寬模式先拆開處理顏色
        const lyricParts = processLyricLine(line);
        elements.push(
          <div key={i} style={{ fontSize: `${lineFontSize}px`, marginBottom: `${lineFontSize * 0.6}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
            {lyricParts.map((part, idx) => {
              // 隱藏括號時，將括號變成空格占位（保持寬度）
              if (hideBrackets && (part.type === 'bracket-open' || part.type === 'bracket-close')) {
                return <span key={idx}>&nbsp;</span>;
              }
              // 決定顏色：括號內文字、括號本身都係白色
              let partColor;
              if (part.type === 'inside' || part.type === 'bracket-open' || part.type === 'bracket-close') {
                partColor = colors.lyricInside;
              } else {
                partColor = colors.lyricNormal;
              }
              return (
                <span key={idx} style={{ color: partColor, whiteSpace: 'pre' }}>
                  {part.text}
                </span>
              );
            })}
          </div>
        );
        i++;
        continue;
      }
      
      // 檢查是否為簡譜行（使用函數，包含英文字母檢查）
      const isNumericNotation = isNumericNotationLine(line) && !hasChordBar;
      
      // 處理簡譜行
      if (isNumericNotation) {
        const notationParts = processNumericNotationLine(line);
        elements.push(
          <div key={i} style={{ 
            fontSize: `${lineFontSize}px`, 
            marginBottom: `${lineFontSize * 0.6}px`,
            whiteSpace: 'pre-wrap', 
            overflowWrap: 'break-word',
            fontFamily: displayFont === 'arial' ? "Arial, Helvetica, sans-serif" : "'Noto Sans Mono CJK TC', 'Sarasa Mono TC', 'Consolas', 'Courier New', monospace"
          }}>
            {notationParts.map((part, idx) => {
              // 處理隱藏括號：將括號替換為空格占位
              let content = part.content;
              if (hideBrackets && part.type === 'inside') {
                // 將開頭和結尾的括號替換為空格
                content = content.replace(/^[\(（]/, ' ').replace(/[\)）]$/, ' ');
              }
              return (
                <span key={idx} style={{
                  color: part.type === 'inside' ? colors.lyricInside : colors.numericNotation,
                  fontWeight: part.type === 'inside' ? 'bold' : 'normal'
                }}>
                  {content}
                </span>
              );
            })}
          </div>
        );
        i++;
        continue;
      }
      
      // 處理和弦行
      if (isChord) {
        // 收集中間的所有簡譜行，找到最終的歌詞行
        const notationLines = [];
        let targetLyricIndex = i + 1;
        
        while (targetLyricIndex < lines.length) {
          const targetLine = lines[targetLyricIndex];
          if (!targetLine) break;
          
          const targetChinese = (targetLine.match(/[\u4e00-\u9fff]/g) || []).length;
          const targetHasChord = /\|[\s]*[A-G]/.test(targetLine);
          const targetDigits = (targetLine.match(/\d/g) || []).length;
          
          // 如果係歌詞行（有中文字或英文單詞，且冇和弦），停止搜索
          const targetEnglish = (targetLine.match(/[a-zA-Z]+/g) || []).length;
          if ((targetChinese > 0 || targetEnglish > 0) && !targetHasChord) {
            break;
          }
          // 如果係簡譜行，收集並繼續搵
          if (targetDigits > 3 && targetChinese < 3 && !targetHasChord) {
            notationLines.push({ index: targetLyricIndex, line: targetLine });
            targetLyricIndex++;
            continue;
          }
          // 其他情況停止
          break;
        }
        
        const lyricLine = lines[targetLyricIndex] || '';
        // 檢查歌詞行：有中文字或英文單詞
        const lyricChinese = (lyricLine.match(/[\u4e00-\u9fff]/g) || []).length;
        const lyricEnglish = (lyricLine.match(/[a-zA-Z]+/g) || []).length;
        const hasLyric = lyricLine && (lyricChinese > 0 || lyricEnglish > 0);
        
        if (hasLyric) {
          // 有歌詞行，渲染和弦 + 所有簡譜行 + 歌詞
          const { prefix, suffix, cleanLine } = extractSectionMarkers(line);
          
          // 判斷是否需要拆分：有簡譜行時不拆分，保持原有行為
          const shouldSplit = notationLines.length === 0;
          
          // 使用 splitLongPair 拆分長歌詞（只在沒有簡譜行時，且是手機版）
          const pairs = shouldSplit 
            ? splitLongPair(cleanLine, lyricLine, 24, isMobile) // 手機屏幕約24個中文字
            : [{ chordLine: cleanLine, lyricLine }];
          
          pairs.forEach((pair, pairIndex) => {
            const result = processPair(pair.chordLine, pair.lyricLine, transposeSemitones, hideBrackets, displayFont);
            
            elements.push(
              <div key={`${i}-${pairIndex}`} style={{ marginBottom: pairIndex < pairs.length - 1 ? `${lineFontSize * 0.3}px` : `${lineFontSize * 0.6}px` }}>
                {/* 和弦行 - 可 hover 的和弦 */}
                <ChordLineWithHover 
                  chordLine={result.chordLine}
                  prefix={pairIndex === 0 ? prefix : null}
                  suffix={pairIndex === pairs.length - 1 ? suffix : null}
                  fontSize={lineFontSize}
                  theme={theme}
                />
                
                {/* 只在第一個 pair 顯示簡譜行（如果有） */}
                {pairIndex === 0 && !hideNotation && notationLines.map(({ index, line: notationLine }) => {
                  const notationFontSize = getLineFontSize(notationLine);
                  
                  // 嘗試對齊簡譜與歌詞
                  const aligned = alignNotationWithLyrics(notationLine, lyricLine);
                  
                  if (aligned) {
                    // 對齊模式：簡譜數字對應歌詞括號
                    return (
                      <div key={index} style={{ marginBottom: '2px' }}>
                        {/* 簡譜行 */}
                        <div style={{ 
                          fontSize: `${notationFontSize}px`, 
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'break-word',
                          fontFamily: displayFont === 'arial' ? "Arial, Helvetica, sans-serif" : "'Noto Sans Mono CJK TC', 'Sarasa Mono TC', 'Consolas', 'Courier New', monospace",
                          color: colors.numericNotation,
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'flex-end'
                        }}>
                          {aligned.map((item, idx) => {
                            if (item.type === 'text' || item.type === 'bracket') {
                              // 無對應簡譜的文字 - 透明佔位
                              return (
                                <span key={idx} style={{ 
                                  visibility: 'hidden',
                                  whiteSpace: 'pre'
                                }}>
                                  {item.content}
                                </span>
                              );
                            } else if (item.type === 'pair') {
                              // 簡譜數字 - 置中對齊到對應歌詞字
                              // 計算字寬時，如果隱藏括號，去掉括號後計算（半形或全形）
                              const displayLyric = (hideBrackets && item.isInside) 
                                ? item.lyric.replace(/^[\(（]|[\)）]$/g, '') 
                                : item.lyric;
                              return (
                                <span key={idx} style={{
                                  display: 'inline-flex',
                                  justifyContent: 'center',
                                  minWidth: `${getTextWidth(displayLyric) * (notationFontSize / 2)}px`,
                                  color: colors.numericNotation,
                                  fontWeight: 'bold'
                                }}>
                                  {item.notation}
                                </span>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    );
                  } else {
                    // 普通模式：直接渲染簡譜
                    const notationParts = processNumericNotationLine(notationLine);
                    return (
                      <div key={index} style={{ 
                        fontSize: `${notationFontSize}px`, 
                        marginBottom: '2px',
                        whiteSpace: 'pre-wrap', 
                        overflowWrap: 'break-word',
                        fontFamily: displayFont === 'arial' ? "Arial, Helvetica, sans-serif" : "'Noto Sans Mono CJK TC', 'Sarasa Mono TC', 'Consolas', 'Courier New', monospace"
                      }}>
                        {notationParts.map((part, idx) => {
                          // 處理隱藏括號：將括號替換為空格占位
                          let content = part.content;
                          if (hideBrackets && part.type === 'inside') {
                            // 將開頭和結尾的括號替換為空格
                            content = content.replace(/^[\(（]/, ' ').replace(/[\)）]$/, ' ');
                          }
                          return (
                            <span key={idx} style={{
                              color: part.type === 'inside' ? colors.lyricInside : colors.numericNotation,
                              fontWeight: part.type === 'inside' ? 'bold' : 'normal'
                            }}>
                              {content}
                            </span>
                          );
                        })}
                      </div>
                    );
                  }
                })}
                
                {/* 歌詞行 - 括號外灰色，括號內白色 */}
                <div style={{ fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', lineHeight: '1.2' }}>
                  {result.lyricParts.map((part, idx) => {
                    // 隱藏括號時，將括號變成空格占位（保持寬度不變）
                    if (hideBrackets && (part.type === 'bracket-open' || part.type === 'bracket-close')) {
                      return <span key={idx}>&nbsp;</span>;
                    }
                    // 決定顏色
                    let partColor;
                    if (part.isInside || part.type === 'inside' || part.type === 'bracket-open' || part.type === 'bracket-close') {
                      partColor = colors.lyricInside;
                    } else {
                      partColor = colors.lyricNormal;
                    }
                    // 移除換行符
                    const cleanText = (part.text || '').replace(/\r?\n/g, '');
                    return (
                      <span key={idx} style={{ 
                        color: partColor,
                        fontWeight: (part.isInside || part.type === 'inside' || part.type === 'bracket-open' || part.type === 'bracket-close') && theme === 'day' ? 'bold' : 'normal'
                      }}>
                        {cleanText}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          });
          
          i = targetLyricIndex + 1;
        } else {
          // 冇歌詞行，單獨顯示和弦
          const { prefix, suffix, cleanLine } = extractSectionMarkers(line);
          const transposedChordLine = transposeChordLine(cleanLine, transposeSemitones);
          elements.push(
            <div key={i} style={{ color: colors.chord, fontWeight: 'bold', fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: `${lineFontSize * 0.6}px` }}>
              {prefix && <span style={{ color: colors.prefixSuffix, fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{prefix}</span>}
              {transposedChordLine}
              {suffix && <span style={{ color: colors.prefixSuffix, fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{suffix}</span>}
            </div>
          );
          i++;
        }
        continue;
      }
      
      // 其他行，普通顯示
      elements.push(
        <div key={i} style={{ color: colors.lyricNormal, fontSize: `${lineFontSize}px`, marginBottom: `${lineFontSize * 0.6}px`, whiteSpace: 'normal', overflowWrap: 'break-word' }}>{line}</div>
      );
      i++;
    }

    return elements;
  };


  const ControlBar = () => {
    const [showInfo, setShowInfo] = useState(false);
    const [showChordDiagram, setShowChordDiagram] = useState(false);
    
    // 提取本曲所有獨特和弦
    const uniqueChords = (() => {
      if (!content) return [];
      return extractChords(content);
    })();
    
    const chordStats = (() => {
      if (!content) return { total: 0, barreCount: 0 };
      const chordPattern = /\b[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|m7|maj7|7|9|11|13)?(?:\/[A-G][#b]?)?\b/g;
      const matches = content.match(chordPattern) || [];
      const validChordPattern = /^[A-G][#b]?(m|maj|min|dim|aug|sus|add|m7|maj7|7|9|11|13)*$/;
      const chords = matches.filter(c => validChordPattern.test(c.replace(/\/.*/, '')));
      const uniqueChords = [...new Set(chords)];
      const BARRE_CHORDS = ['B','Bm','Bb','Bbm','B7','Bm7','Bb7','C#','C#m','C#7','C#m7','Db','Dbm','F','Fm','F7','Fm7','F#','F#m','F#7','F#m7','Gb','Gbm','G#','G#m','G#7','G#m7','Ab','Abm'];
      const barreCount = uniqueChords.filter(c => BARRE_CHORDS.includes(c)).length;
      return { total: uniqueChords.length, barreCount };
    })();
    
    const hasSongInfo = songInfo && (songInfo.songYear || songInfo.composer || songInfo.lyricist || songInfo.arranger || songInfo.producer || songInfo.strummingPattern || songInfo.fingeringTips);
    
    return (
      <div className="px-2 sm:px-4 py-2 border-b border-gray-800">
        <div className={`rounded-2xl p-2.5 sm:p-3 ${theme === 'day' ? 'bg-gray-100' : 'bg-[#1A1A1A]'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs md:text-base whitespace-nowrap">
              <span className="flex items-center gap-1">
                <span className="text-[#FFD700]">♪</span>
                <span className="text-white font-medium">{originalKey}</span>
                {playKey && playKey !== originalKey && (
                  <span className="text-gray-400">({playKey})</span>
                )}
              </span>
              <span className="text-gray-600">|</span>
              {arrangedBy && (
                <span className="text-gray-400">
                  出譜: <span className="text-[#FFD700]">{arrangedBy}</span>
                </span>
              )}
              {chordStats.total > 0 && (
                <>
                  <span className="text-gray-600">|</span>
                  <button 
                    onClick={() => setShowChordDiagram(true)}
                    className="text-gray-400 hover:text-[#FFD700] transition flex items-center gap-1"
                    title="查看和弦圖"
                  >
                    和弦數 <span className="text-[#FFD700] underline">{chordStats.total}</span>
                    {chordStats.barreCount > 0 && (
                      <span className="text-orange-400">({chordStats.barreCount}Barre)</span>
                    )}
                  </button>
                </>
              )}
            </div>
            {(youtubeVideoId || hasSongInfo) && (
              <button onClick={() => setShowInfo(!showInfo)} className="p-1 md:p-1.5 text-gray-400 hover:text-white transition">
                <svg className={`w-4 h-4 md:w-5 md:h-5 transition-transform ${showInfo ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>

          {showInfo && (
            <div className="mt-3 pt-3 border-t border-gray-700 space-y-3">
              {youtubeVideoId && (
                <div className="aspect-video w-full rounded-lg overflow-hidden">
                  <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${youtubeVideoId}`} title="YouTube" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                </div>
              )}
              {hasSongInfo && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] sm:text-xs md:text-sm text-gray-400">
                  {songInfo.songYear && <span>年份：<span className="text-white">{songInfo.songYear}</span></span>}
                  {songInfo.composer && <span>作曲：<span className="text-white">{songInfo.composer}</span></span>}
                  {songInfo.lyricist && <span>填詞：<span className="text-white">{songInfo.lyricist}</span></span>}
                  {songInfo.arranger && <span>編曲：<span className="text-white">{songInfo.arranger}</span></span>}
                  {songInfo.producer && <span>監製：<span className="text-white">{songInfo.producer}</span></span>}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs md:text-base mt-3 whitespace-nowrap">
            <span className="text-gray-400">原調: <span className="text-white">{originalKey}</span></span>
            <span className="text-gray-600">→</span>
            <span className="text-gray-400">PLAY: <span className="text-[#FFD700] font-medium">{currentKey}</span></span>
            {displayCapo > 0 && (
              <span className="bg-[#FFD700] text-black text-[10px] md:text-xs px-1.5 py-0.5 md:px-2 md:py-1 rounded font-medium">Capo {displayCapo}</span>
            )}
          </div>

          {!hideKeySelector && (
            <div className="flex gap-0.5 mt-3 pt-3 border-t border-gray-700">
              {(baseKey?.endsWith('m') ? MINOR_KEYS.filter(k => !['Ebm','G#m','A#m'].includes(k)) : MAJOR_KEYS).map((key) => {
                const isCurrent = key === currentKey;
                return (
                  <button key={key} onClick={() => { setCurrentKey(key); onKeyChange?.(key); }} className={`flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center text-[10px] sm:text-xs md:text-sm font-bold transition hover:scale-105 ${isCurrent ? 'bg-[#FFD700] text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                    {key}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700">
            <div className="flex items-center gap-1.5 md:gap-2">
              <button onClick={() => handleFontSize(-1)} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded bg-gray-800 text-white hover:bg-gray-700 transition text-xs md:text-sm">A-</button>
              <span className="w-6 md:w-8 text-center text-xs md:text-sm text-gray-400">{fontSize}</span>
              <button onClick={() => handleFontSize(1)} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded bg-gray-800 text-white hover:bg-gray-700 transition text-xs md:text-sm">A+</button>
              <div className="w-px h-5 md:h-6 bg-gray-700 mx-1" />
              <button onClick={() => setIsAutoScroll(!isAutoScroll)} className={`flex items-center gap-1 px-2.5 py-1.5 md:px-4 md:py-2 rounded transition text-xs md:text-sm ${isAutoScroll ? 'bg-[#FFD700] text-black' : 'bg-gray-800 text-white hover:bg-gray-700'}`}>
                <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                <span className="hidden sm:inline">自動滾動</span>
              </button>
              {isAutoScroll && (
                <div className="flex items-center gap-0.5">
                  <button onClick={() => setScrollSpeed(Math.max(0, scrollSpeed - 1))} className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded bg-gray-700 text-white text-xs md:text-sm" disabled={scrollSpeed <= 0}>−</button>
                  <span className="w-4 md:w-5 text-center text-xs md:text-sm text-gray-400">{scrollSpeed}</span>
                  <button onClick={() => setScrollSpeed(Math.min(4, scrollSpeed + 1))} className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded bg-gray-700 text-white text-xs md:text-sm" disabled={scrollSpeed >= 4}>+</button>
                </div>
              )}
              <div className="w-px h-5 md:h-6 bg-gray-700 mx-1" />
              <button onClick={() => setHideNotation(!hideNotation)} className={`flex items-center gap-1 px-2.5 py-1.5 md:px-4 md:py-2 rounded transition text-xs md:text-sm ${hideNotation ? 'bg-gray-600 text-gray-300' : 'bg-gray-800 text-white hover:bg-gray-700'}`} title={hideNotation ? '顯示簡譜' : '隱藏簡譜'}>
                <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={hideNotation ? "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" : "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"} />
                </svg>
                <span className="hidden sm:inline">{hideNotation ? '顯示簡譜' : '隱藏簡譜'}</span>
              </button>
              <div className="w-px h-5 md:h-6 bg-gray-700 mx-1" />
              <button onClick={() => setHideBrackets(!hideBrackets)} className={`flex items-center gap-1 px-2.5 py-1.5 md:px-4 md:py-2 rounded transition text-xs md:text-sm ${hideBrackets ? 'bg-gray-600 text-gray-300' : 'bg-gray-800 text-white hover:bg-gray-700'}`} title={hideBrackets ? '顯示括號' : '隱藏括號'}>
                <span className="text-xs md:text-sm font-mono">( )</span>
                <span className="hidden sm:inline">{hideBrackets ? '顯示()' : '隱藏()'}</span>
              </button>
            </div>
            <button onClick={handleCopy} className="p-2 md:p-2.5 text-gray-400 hover:text-white transition" title="複製歌詞">
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* 和弦圖彈窗 */}
        <ChordDiagramModal 
          chords={uniqueChords}
          isOpen={showChordDiagram}
          onClose={() => setShowChordDiagram(false)}
          theme={theme}
        />
      </div>
    );
  };

  if (isEditing && editable) {
    return (
      <div className={`${theme === 'day' ? 'bg-white rounded-xl border border-gray-300' : 'bg-[#121212] rounded-xl border border-gray-800'} ${className}`}>
        {showControls && <ControlBar />}
        <div className="p-4">
          <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className={`w-full h-96 p-4 rounded-lg border focus:outline-none resize-none font-mono text-sm ${theme === 'day' ? 'bg-gray-50 text-gray-800 border-gray-300 focus:border-purple-500' : 'bg-black text-gray-300 border-gray-700 focus:border-[#FFD700]'}`} placeholder="輸入譜內容..." />
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setIsEditing(false)} className={`px-4 py-2 transition ${theme === 'day' ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-white'}`}>取消</button>
            <button onClick={handleSave} className={`px-4 py-2 rounded-lg transition ${theme === 'day' ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-[#FFD700] text-black hover:opacity-90'}`}>保存</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${fullWidth ? (theme === 'day' ? 'bg-white' : 'bg-black') : (theme === 'day' ? 'bg-white rounded-xl border border-gray-300' : 'bg-[#121212] rounded-xl border border-gray-800')} ${className}`} style={{ height: 'auto', minHeight: 'auto', maxHeight: 'none' }}>
      {showControls && <ControlBar />}
      <div ref={containerRef} className={fullWidth ? 'p-3' : `p-3 sm:p-6 ${theme === 'day' ? 'bg-white' : 'bg-[#121212]'}`} style={{ height: 'auto', minHeight: 'auto', maxHeight: 'none' }}>
        <div className="tab-content-wrapper" style={{ height: 'auto', minHeight: 'auto', maxHeight: 'none', fontFamily: displayFont === 'arial' ? "Arial, Helvetica, sans-serif" : "'Noto Sans Mono CJK TC', 'Sarasa Mono TC', 'Consolas', 'Courier New', monospace" }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default TabContent;
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
const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
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
  if (!semitones || semitones === 0) return line;
  
  // 匹配和弦，包括 slash chord（如 C/E, D7/F#）
  // 避免重複轉調已轉過的結果
  return line.replace(/\|?\s*([A-G][#b]?[^\s|]*)/g, (match, chord) => {
    const hasBar = match.includes('|');
    const transposed = transposeChord(chord, semitones);
    return hasBar ? '| ' + transposed : transposed;
  });
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
  const normalizedLine = normalizeInput(line);
  
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
  const normalizedChord = normalizeInput(chordLine);
  const normalizedLyric = normalizeInput(lyricLine);
  const bracketPositions = findBracketPositions(normalizedLyric);
  
  const chords = [];
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
    
    let chordName = '';
    while (i < chars.length && chars[i] !== ' ' && chars[i] !== '\u3000') {
      chordName += chars[i];
      i++;
    }
    
    if (chordName && /^[A-G]/.test(chordName)) {
      const transposedName = transposeSemitones !== 0 
        ? transposeChord(chordName, transposeSemitones)
        : chordName;
      
      chords.push({
        name: transposedName,
        fullToken: hasBar ? '|' + transposedName : transposedName,
        isBarStart: hasBar,
        width: getTextWidth(hasBar ? '|' + transposedName : transposedName),
        nameWidth: getTextWidth(transposedName)
      });
    }
  }

  if (chords.length !== bracketPositions.length) {
    return { chordLine, lyricLine, error: true };
  }

  let newChordLine = '';
  let currentCol = 0;

  for (let idx = 0; idx < chords.length; idx++) {
    const chord = chords[idx];
    const targetPos = bracketPositions[idx];
    const bracketWidth = 2;
    const centerOffset = Math.round((bracketWidth - chord.nameWidth) / 2);
    
    let startCol = chord.isBarStart ? targetPos - 1 + centerOffset : targetPos + centerOffset;
    if (startCol < currentCol) startCol = currentCol;
    
    const spacesNeeded = startCol - currentCol;
    const fullSpaces = Math.floor(spacesNeeded / 2);
    const halfSpace = spacesNeeded % 2;
    
    newChordLine += '\u3000'.repeat(fullSpaces);
    if (halfSpace) newChordLine += ' ';
    
    newChordLine += chord.fullToken;
    currentCol = startCol + chord.width;
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

  return { chordLine: newChordLine, lyricParts: parts, error: false };
}

// ============ 主組件 ============
const TabContent = ({ 
  content, 
  originalKey = 'C',
  editable = false,
  onContentChange,
  onKeyChange,
  showControls = true,
  className = '',
  initialKey,
  fullWidth = false
}) => {
  const [currentKey, setCurrentKey] = useState(initialKey || originalKey);
  const [fontSize, setFontSize] = useState(16);
  const [isAutoScroll, setIsAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(3);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content || '');
  
  const autoScrollRef = useRef(null);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(800);

  const capo = calculateCapo(originalKey, currentKey);
  const transposeSemitones = calculateTransposeSemitones(originalKey, currentKey);
  const capoSuggestion = getCapoSuggestion(capo);

  useEffect(() => {
    if (initialKey && initialKey !== currentKey) {
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
      // 速度：0.2 - 1.0（更慢更舒服）
      const speeds = [0, 0.5, 0.75, 1.0, 1.25, 1.5];
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
        elements.push(<div key={i} style={{ height: '1.5em' }} />);
        i++;
        continue;
      }
      
      // 計算當前行的字體大小
      const lineFontSize = getLineFontSize(line);
      
      // 更精確的和弦行檢測：必須包含和弦模式，且不能主要是中文字
      const chordPattern = /(\|[\s]*[A-G][#b]?|[\s/]*[A-G][#b]?)(m|maj|min|sus|dim|aug|add|[0-9])*/g;
      const chordMatches = line.match(chordPattern) || [];
      const hasChordPattern = chordMatches.length >= 2 || line.includes('|') || line.includes('｜');
      // 檢查中文字比例，如果超過 30% 就不是和弦行
      const chineseChars = line.match(/[\u4e00-\u9fff]/g) || [];
      const chineseRatio = chineseChars.length / line.length;
      const isChord = hasChordPattern && chineseRatio < 0.3;
      // 同樣檢查下一行
      const nextChordMatches = nextLine.match(chordPattern) || [];
      const nextHasChordPattern = nextChordMatches.length >= 2 || nextLine.includes('|') || nextLine.includes('｜');
      const nextChineseChars = nextLine.match(/[\u4e00-\u9fff]/g) || [];
      const nextChineseRatio = nextChineseChars.length / nextLine.length;
      const nextIsChord = nextHasChordPattern && nextChineseRatio < 0.3;
      const isMixed = isMixedLine(line);
      
      // 處理混合行（chord + lyric 在同一行）
      if (isMixed) {
        const { prefix, suffix, cleanLine } = extractSectionMarkers(line);
        const result = processMixedLine(cleanLine, transposeSemitones);
        
        if (result.error) {
          elements.push(
            <div key={i} style={{ marginBottom: `${lineFontSize * 0.6}px`, fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: '0.1em' }}>
              {prefix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{prefix}</span>}
              <span style={{ color: '#A0A0A0' }}>{cleanLine}</span>
              {suffix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{suffix}</span>}
            </div>
          );
        } else {
          // 有 Section Marker 時，分三行顯示
          if (result.sectionMarker) {
            elements.push(
              <div key={`${i}-marker`} style={{ marginBottom: `${lineFontSize * 0.6}px` }}>
                {/* Section Marker 單獨一行 */}
                <span style={{ color: '#FFFFFF', fontSize: `${lineFontSize}px`, fontWeight: 'bold' }}>
                  {prefix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{prefix}</span>}
                  {result.sectionMarker}
                  {suffix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{suffix}</span>}
                </span>
                {/* 和弦行 */}
                <div style={{ color: '#FFD700', fontWeight: 'bold', fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: '0.05em', lineHeight: '1.2' }}>
                  {result.chordPart}
                </div>
                {/* 歌詞行 */}
                <div style={{ fontSize: `${lineFontSize}px`, whiteSpace: 'normal', overflowWrap: 'break-word', lineHeight: '1.2' }}>
                  {result.lyricParts.map((part, idx) => (
                    <span key={idx} style={{ color: part.isInside ? '#FFFFFF' : '#A0A0A0' }}>
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
                <div style={{ color: '#FFD700', fontWeight: 'bold', fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: '0.05em', lineHeight: '1.2' }}>
                  {prefix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{prefix}</span>}
                  {result.chordPart}
                  {suffix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{suffix}</span>}
                </div>
                {/* 歌詞行 */}
                <div style={{ fontSize: `${lineFontSize}px`, whiteSpace: 'normal', overflowWrap: 'break-word', lineHeight: '1.2' }}>
                  {result.lyricParts.map((part, idx) => (
                    <span key={idx} style={{ color: part.isInside ? '#FFFFFF' : '#A0A0A0' }}>
                      {part.text}
                    </span>
                  ))}
                </div>
              </div>
            );
          }
        }
        i++;
      } else if (isChord && !nextIsChord && nextLine.trim() && nextLine.includes('(')) {
        const { prefix, suffix, cleanLine } = extractSectionMarkers(line);
        const result = processPair(cleanLine, nextLine, transposeSemitones);
        
        if (result.error) {
          elements.push(
            <div key={i} style={{ marginBottom: `${lineFontSize * 0.6}px` }}>
              <div style={{ color: '#FFD700', fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: '0.05em', lineHeight: '1.2' }}>
                {prefix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{prefix}</span>}
                {result.chordLine}
                {suffix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{suffix}</span>}
              </div>
              <div style={{ color: '#A0A0A0', fontSize: `${lineFontSize}px`, whiteSpace: 'normal', overflowWrap: 'break-word', lineHeight: '1.2' }}>{result.lyricLine}</div>
            </div>
          );
        } else {
          elements.push(
            <div key={i} style={{ marginBottom: `${lineFontSize * 0.6}px` }}>
              <div style={{ color: '#FFD700', fontWeight: 'bold', fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: '0.05em', lineHeight: '1.2' }}>
                {prefix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{prefix}</span>}
                {result.chordLine}
                {suffix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{suffix}</span>}
              </div>
              <div style={{ fontSize: `${lineFontSize}px`, whiteSpace: 'normal', overflowWrap: 'break-word', lineHeight: '1.2' }}>
                {result.lyricParts.map((part, idx) => (
                  <span key={idx} style={{ color: part.isInside ? '#FFFFFF' : '#A0A0A0' }}>
                    {part.text}
                  </span>
                ))}
              </div>
            </div>
          );
        }
        i += 2;
      } else if (isChord) {
        // 檢查是否有 Section Marker
        const sectionInfo = extractSectionMarker(line);
        
        if (sectionInfo.hasMarker) {
          // Section Marker 單獨一行
          elements.push(
            <div key={`${i}-marker`} style={{ marginBottom: `${lineFontSize * 0.6}px` }}>
              <span style={{ color: '#FFFFFF', fontSize: `${lineFontSize}px`, fontWeight: 'bold' }}>
                {sectionInfo.marker}
              </span>
            </div>
          );
          // 和弦部分
          const transposedChordLine = transposeChordLine(sectionInfo.rest, transposeSemitones);
          if (transposedChordLine.trim()) {
            elements.push(
              <div key={i} style={{ color: '#FFD700', fontWeight: 'bold', fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: `${lineFontSize * 0.6}px` }}>
                {transposedChordLine}
              </div>
            );
          }
        } else {
          const { prefix, suffix, cleanLine } = extractSectionMarkers(line);
          const transposedChordLine = transposeChordLine(cleanLine, transposeSemitones);
          
          elements.push(
            <div key={i} style={{ color: '#FFD700', fontWeight: 'bold', fontSize: `${lineFontSize}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: `${lineFontSize * 0.6}px` }}>
              {prefix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{prefix}</span>}
              {transposedChordLine}
              {suffix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: `${lineFontSize * 0.85}px` }}>{suffix}</span>}
            </div>
          );
        }
        i++;
      } else {
        elements.push(
          <div key={i} style={{ color: '#A0A0A0', fontSize: `${lineFontSize}px`, marginBottom: `${lineFontSize * 0.6}px`, whiteSpace: 'normal', overflowWrap: 'break-word' }}>{line}</div>
        );
        i++;
      }
    }

    return elements;
  };

  const ControlBar = () => (
    <div className="flex flex-col gap-2 sm:gap-4 p-2 sm:p-4 bg-black border-b border-gray-800">
      <div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
          <span className="text-xs sm:text-sm text-gray-400">原調:</span>
          <span className="text-xs sm:text-sm font-medium text-white">{originalKey}</span>
          <span className="text-gray-600">→</span>
          <span className="text-xs sm:text-sm text-gray-400">PLAY:</span>
          <span className={`text-xs sm:text-sm font-bold ${currentKey !== originalKey ? 'text-[#FFD700]' : 'text-white'}`}>
            {currentKey}
          </span>
          
          {currentKey !== originalKey && (
            <>
              {capoSuggestion.status === 'none' && (
                <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 bg-gray-800 text-gray-400 rounded">免Capo</span>
              )}
              {capoSuggestion.status === 'ok' && (
                <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 bg-green-900/50 text-green-400 rounded">Capo {capo}</span>
              )}
              {capoSuggestion.status === 'high' && (
                <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 bg-orange-900/50 text-orange-400 rounded">Capo {capo}太高</span>
              )}
            </>
          )}
        </div>
        
        {currentKey !== originalKey && capoSuggestion.alternative && (
          <div className="mb-2 text-[10px] sm:text-xs text-gray-500">
            <span className="text-orange-400">提示：</span>
            建議 Drop Tuning
            <button
              onClick={() => {
                setCurrentKey('C')
                onKeyChange?.('C')
              }}
              className="ml-2 text-[#FFD700] hover:underline"
            >
              改用 C
            </button>
          </div>
        )}
        
        <div className="flex flex-wrap gap-1 sm:gap-1.5 pb-1 sm:pb-2">
          {/* 根據原調類型顯示對應的 Key：Major 歌只顯示 Major Keys，Minor 歌只顯示 Minor Keys */}
          {(originalKey?.endsWith('m') ? MINOR_KEYS : MAJOR_KEYS).map((key) => {
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
                  w-6 h-6 sm:w-7 sm:h-7
                  rounded-full 
                  flex items-center justify-center 
                  text-[10px] sm:text-[11px] font-bold
                  transition hover:scale-105
                  ${isCurrent
                    ? 'bg-black text-[#FFD700] border border-[#FFD700]'
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

      <div className="h-px bg-gray-700" />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="flex items-center gap-0.5 sm:gap-2">
            <button
              onClick={() => handleFontSize(-1)}
              className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center bg-gray-800 text-white rounded hover:bg-gray-700 transition text-[10px] sm:text-xs"
            >
              A-
            </button>
            <span className="w-6 sm:w-8 text-center text-xs text-gray-400">{fontSize}</span>
            <button
              onClick={() => handleFontSize(1)}
              className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center bg-gray-800 text-white rounded hover:bg-gray-700 transition text-xs sm:text-sm"
            >
              A+
            </button>
          </div>

          <div className="w-px h-4 sm:h-6 bg-gray-700" />

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsAutoScroll(!isAutoScroll)}
              className={`flex items-center gap-0.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded transition text-xs ${
                isAutoScroll 
                  ? 'bg-[#FFD700] text-black' 
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
                  className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center bg-gray-700 text-white rounded text-[10px] sm:text-xs"
                  disabled={scrollSpeed <= 1}
                >
                  −
                </button>
                <span className="w-4 sm:w-5 text-center text-[10px] sm:text-xs text-gray-400">{scrollSpeed}</span>
                <button
                  onClick={() => setScrollSpeed(Math.min(5, scrollSpeed + 1))}
                  className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center bg-gray-700 text-white rounded text-[10px] sm:text-xs"
                  disabled={scrollSpeed >= 5}
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="p-1.5 sm:px-3 sm:py-1.5 text-[#FFD700] hover:opacity-80 transition"
          title="複製譜內容"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>
    </div>
  );

  if (isEditing && editable) {
    return (
      <div className={`bg-[#121212] rounded-xl border border-gray-800 ${className}`}>
        {showControls && <ControlBar />}
        <div className="p-4">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-96 bg-black text-gray-300 p-4 rounded-lg border border-gray-700 focus:border-[#FFD700] focus:outline-none resize-none font-mono text-sm"
            placeholder="輸入譜內容..."
          />
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-gray-400 hover:text-white transition"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-[#FFD700] text-black rounded-lg hover:opacity-90 transition"
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
      className={`${fullWidth ? '' : 'bg-[#121212] rounded-xl border border-gray-800'} ${className}`}
      style={{ 
        height: 'auto',
        minHeight: 'auto',
        maxHeight: 'none'
      }}
    >
      {showControls && <ControlBar />}
      <div 
        ref={containerRef}
        className={fullWidth ? 'p-3' : 'p-3 sm:p-6 bg-[#121212]'}
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
            maxHeight: 'none'
          }}
        >
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default TabContent;

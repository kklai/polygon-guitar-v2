import React, { useState, useRef, useEffect, useCallback } from 'react';

// ============ 常數定義 ============
const KEYS = ['A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab'];

// Key 對應的 semitone 位置 (C = 0)
const KEY_TO_SEMITONE = {
  'C': 0, 'Db': 1, 'C#': 1, 'D': 2, 'Eb': 3, 'D#': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'Ab': 8, 'G#': 8,
  'A': 9, 'Bb': 10, 'A#': 10, 'B': 11
};

// Semitone 對應的 Key (優先使用 flat)
const SEMITONE_TO_KEY = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// ============ 和弦轉調工具 ============
const CHORDS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHORDS_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// 轉調單個和弦（支援 slash chord，如 C/E）
function transposeChord(chord, semitones) {
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
  
  return line.replace(/\|?\s*([A-G][#b]?[^\s|]*)/g, (match, chord) => {
    const hasBar = match.includes('|');
    const transposed = transposeChord(chord, semitones);
    return hasBar ? '| ' + transposed : transposed;
  });
}

// ============ Section Markers ============
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

function extractSectionMarker(line) {
  const trimmed = line.trim();
  const sortedMarkers = [...SECTION_MARKERS].sort((a, b) => b.length - a.length);
  
  for (const marker of sortedMarkers) {
    const markerLower = marker.toLowerCase();
    const trimmedLower = trimmed.toLowerCase();
    
    if (trimmedLower.startsWith(markerLower)) {
      const afterMarker = trimmed.substring(marker.length).trim();
      return { hasMarker: true, marker, rest: afterMarker };
    }
  }
  return { hasMarker: false, marker: '', rest: line };
}

function getSemitoneFromKey(key) {
  return KEY_TO_SEMITONE[key] ?? 0;
}

function calculateTransposeSemitones(originalKey, selectedKey) {
  const originalSemitone = getSemitoneFromKey(originalKey);
  const selectedSemitone = getSemitoneFromKey(selectedKey);
  return (selectedSemitone - originalSemitone + 12) % 12;
}

function calculateCapo(originalKey, selectedKey) {
  const originalSemitone = getSemitoneFromKey(originalKey);
  const selectedSemitone = getSemitoneFromKey(selectedKey);
  let capo = (originalSemitone - selectedSemitone) % 12;
  if (capo < 0) capo += 12;
  return capo;
}

function getCapoSuggestion(capo) {
  if (capo === 0) return { capo: 0, status: 'none', message: '無需變調夾', alternative: null };
  if (capo >= 1 && capo <= 8) return { capo, status: 'ok', message: `建議 Capo: ${capo}`, alternative: null };
  if (capo >= 9 && capo <= 11) {
    return { capo, status: 'high', message: `Capo ${capo} 位置過高`, alternative: { type: 'dropTuning', capo: capo - 2 } };
  }
  return { capo: null, status: 'invalid', message: '', alternative: null };
}

// ============ 解析 Chord-Lyric Pairs ============

// 解析一對「和弦+歌詞」，如：|Cmaj7不(聽)間言
function parseChordLyricPair(segment) {
  // 找到第一個中文字或 ( 的位置
  let chordEnd = 0;
  for (let i = 0; i < segment.length; i++) {
    const char = segment[i];
    const charCode = char.charCodeAt(0);
    // 如果是中文字或 (，停止
    if ((charCode >= 0x4E00 && charCode <= 0x9FFF) || char === '(') {
      break;
    }
    chordEnd = i + 1;
  }
  
  const chord = segment.substring(0, chordEnd).trim();
  const lyric = segment.substring(chordEnd).trim();
  
  return { chord, lyric };
}

// 解析一行，提取所有 chord-lyric pairs
function parseLineToPairs(line) {
  const pairs = [];
  // 用 | 分割，但保留 |
  const parts = line.split(/(\|)/).filter(p => p);
  
  let currentSegment = '';
  for (const part of parts) {
    if (part === '|') {
      if (currentSegment.trim()) {
        const pair = parseChordLyricPair(currentSegment);
        if (pair.chord || pair.lyric) {
          pairs.push(pair);
        }
      }
      currentSegment = '|';
    } else {
      currentSegment += part;
    }
  }
  
  // 處理最後一段
  if (currentSegment.trim() && currentSegment !== '|') {
    const pair = parseChordLyricPair(currentSegment);
    if (pair.chord || pair.lyric) {
      pairs.push(pair);
    }
  }
  
  return pairs;
}

// 解析混合行（有 section marker + 和弦 + 歌詞）
function parseMixedLine(line) {
  const sectionInfo = extractSectionMarker(line);
  const sectionMarker = sectionInfo.hasMarker ? sectionInfo.marker : '';
  const remaining = sectionInfo.rest;
  
  const pairs = parseLineToPairs(remaining);
  
  return { sectionMarker, pairs };
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

  const capo = calculateCapo(originalKey, currentKey);
  const transposeSemitones = calculateTransposeSemitones(originalKey, currentKey);
  const capoSuggestion = getCapoSuggestion(capo);

  useEffect(() => {
    if (initialKey && initialKey !== currentKey) {
      setCurrentKey(initialKey);
    }
  }, [initialKey]);

  // 自動滾動
  useEffect(() => {
    if (isAutoScroll) {
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
    setFontSize(prev => Math.max(12, Math.min(24, prev + delta)));
  };

  const handleCopy = useCallback(() => {
    if (content) navigator.clipboard.writeText(content);
  }, [content]);

  const handleSave = () => {
    if (onContentChange) onContentChange(editContent);
    setIsEditing(false);
  };

  // 渲染 Chord-Lyric Pair
  const renderChordPair = (chord, lyric, index, transposeSemitones) => {
    // 轉調和弦
    const transposedChord = chord ? transposeChordLine(chord, transposeSemitones) : '';
    
    // 解析歌詞的括號
    const lyricParts = [];
    let buffer = '';
    let inBracket = false;
    
    for (let char of lyric || '') {
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
    
    return (
      <span key={index} className="inline-flex flex-col items-start whitespace-nowrap mr-4 mb-1">
        {/* 和弦 */}
        <span className="text-[#FFD700] font-bold font-mono text-base leading-tight">
          {transposedChord || '\u00A0'}
        </span>
        {/* 歌詞 */}
        <span className="leading-tight">
          {lyricParts.length > 0 ? lyricParts.map((part, idx) => (
            <span key={idx} className={part.isInside ? 'text-white' : 'text-gray-400'}>
              {part.text}
            </span>
          )) : <span className="text-gray-400">{lyric || '\u00A0'}</span>}
        </span>
      </span>
    );
  };

  // 主要渲染函數
  const renderContent = () => {
    if (!content) return null;

    const lines = content.split('\n');
    const elements = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (!line.trim()) {
        elements.push(<div key={i} className="h-4" />);
        continue;
      }
      
      // 檢查是否為 Key 行（Key: Am 4/4）
      if (line.match(/^Key:/i)) {
        elements.push(
          <div key={i} className="text-gray-500 text-sm mb-2 font-mono">
            {line}
          </div>
        );
        continue;
      }
      
      // 檢查是否為純和弦行（只有和弦，沒有歌詞）
      const chineseChars = line.match(/[\u4e00-\u9fff]/g) || [];
      const hasLyric = chineseChars.length > 0 || line.includes('(');
      
      // 解析混合行
      const { sectionMarker, pairs } = parseMixedLine(line);
      
      // 如果有 section marker，先顯示
      if (sectionMarker) {
        elements.push(
          <div key={`${i}-marker`} className="text-white font-bold text-base mt-4 mb-1">
            {sectionMarker}
          </div>
        );
      }
      
      // 如果有 pairs，用 flex-wrap 顯示
      if (pairs.length > 0) {
        elements.push(
          <div key={i} className="flex flex-wrap items-start mb-3">
            {pairs.map((pair, idx) => renderChordPair(pair.chord, pair.lyric, idx, transposeSemitones))}
          </div>
        );
      } else if (!hasLyric) {
        // 純和弦行（無歌詞）
        const transposedLine = transposeChordLine(line, transposeSemitones);
        elements.push(
          <div key={i} className="text-[#FFD700] font-bold font-mono mb-2 whitespace-pre-wrap">
            {transposedLine}
          </div>
        );
      } else {
        // 純歌詞行或其他
        elements.push(
          <div key={i} className="text-gray-400 mb-2">
            {line}
          </div>
        );
      }
    }
    
    return elements;
  };

  // 控制欄
  const ControlBar = () => (
    <div className={`${fullWidth ? 'sticky top-0 z-50' : ''} bg-black border-b border-gray-800 p-3`}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Key 選擇 */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">原調:</span>
          <span className="text-white text-sm font-medium">{originalKey}</span>
          <span className="text-gray-600">→</span>
          <select 
            value={currentKey}
            onChange={(e) => {
              setCurrentKey(e.target.value);
              onKeyChange?.(e.target.value);
            }}
            className="bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-700"
          >
            {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          {capo > 0 && capo <= 8 && (
            <span className="text-xs px-2 py-0.5 bg-green-900/50 text-green-400 rounded">
              Capo {capo}
            </span>
          )}
        </div>
        
        {/* 字體大小 */}
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => handleFontSize(-2)} className="p-1.5 bg-gray-800 rounded text-white hover:bg-gray-700 text-sm">A-</button>
          <span className="text-gray-400 text-sm">{fontSize}px</span>
          <button onClick={() => handleFontSize(2)} className="p-1.5 bg-gray-800 rounded text-white hover:bg-gray-700 text-sm">A+</button>
        </div>
        
        {/* 自動滾動 */}
        <button 
          onClick={() => setIsAutoScroll(!isAutoScroll)}
          className={`px-3 py-1.5 rounded text-sm ${isAutoScroll ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300'}`}
        >
          {isAutoScroll ? '⏹ 停止' : '▶ 自動滾動'}
        </button>
        
        {isAutoScroll && (
          <input 
            type="range" 
            min="1" max="5" 
            value={scrollSpeed}
            onChange={(e) => setScrollSpeed(parseInt(e.target.value))}
            className="w-20"
          />
        )}
        
        {editable && (
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="px-3 py-1.5 bg-gray-800 text-white rounded text-sm hover:bg-gray-700"
          >
            {isEditing ? '取消' : '編輯'}
          </button>
        )}
        
        <button onClick={handleCopy} className="px-3 py-1.5 bg-gray-800 text-white rounded text-sm hover:bg-gray-700">
          複製
        </button>
      </div>
    </div>
  );

  if (isEditing) {
    return (
      <div className={`bg-[#121212] rounded-xl border border-gray-800 ${className}`}>
        {showControls && <ControlBar />}
        <div className="p-4">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-96 bg-black text-white p-3 rounded font-mono text-sm resize-none"
          />
          <div className="flex gap-2 mt-3">
            <button onClick={handleSave} className="px-4 py-2 bg-[#FFD700] text-black rounded font-bold">保存</button>
            <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-700 text-white rounded">取消</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[#121212] ${fullWidth ? '' : 'rounded-xl border border-gray-800'} ${className}`}>
      {showControls && <ControlBar />}
      <div 
        className="p-3 sm:p-4"
        style={{ fontSize: `${fontSize}px`, fontFamily: '"Sarasa Mono TC", "Noto Sans TC", monospace' }}
      >
        {renderContent()}
      </div>
    </div>
  );
};

export default TabContent;

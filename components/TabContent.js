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

function transposeChord(chord, semitones) {
  const match = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return chord;
  
  const [, root, suffix] = match;
  
  let index = CHORDS.indexOf(root);
  if (index === -1) index = CHORDS_FLAT.indexOf(root);
  if (index === -1) return chord;
  
  const newIndex = (index + semitones + 12) % 12;
  return CHORDS[newIndex] + suffix;
}

// 轉調純和弦行（前奏/間奏用）
function transposeChordLine(line, semitones) {
  if (!semitones || semitones === 0) return line;
  
  // 匹配所有和弦（包括 | 前綴）
  return line.replace(/\|?\s*([A-G][#b]?[^\s|]*)/g, (match, chord) => {
    // 處理可能有 | 前綴的情況
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

// ============ Key 轉換工具 ============
function getSemitoneFromKey(key) {
  return KEY_TO_SEMITONE[key] ?? 0;
}

function getKeyFromSemitone(semitone) {
  return SEMITONE_TO_KEY[(semitone + 12) % 12];
}

/**
 * 計算 Capo 位置
 * 正確公式：由原調去現調要夾幾多格
 * 例如：原調 F (5)，揀 C (0) → 夾第 5 格（C 夾 5 格變 F）
 * 例如：原調 F (5)，揀 G (7) → 夾第 10 格（太高）
 */
function calculateCapo(originalKey, selectedKey) {
  const originalSemitone = getSemitoneFromKey(originalKey);
  const selectedSemitone = getSemitoneFromKey(selectedKey);
  // 關鍵：original - selected（不是 selected - original）
  let capo = (originalSemitone - selectedSemitone) % 12;
  if (capo < 0) capo += 12;
  return capo; // 0 表示唔使夾
}

/**
 * 計算轉調 semitones（用於和弦轉換）
 * 這是音樂上的轉調，由 originalKey 轉到 selectedKey
 */
function calculateTransposeSemitones(originalKey, selectedKey) {
  const originalSemitone = getSemitoneFromKey(originalKey);
  const selectedSemitone = getSemitoneFromKey(selectedKey);
  return (selectedSemitone - originalSemitone + 12) % 12;
}

// ============ Capo 建議 ============
function getCapoSuggestion(capo) {
  // Capo 0：唔使夾
  if (capo === 0) {
    return { 
      capo: 0, 
      status: 'none',
      message: '無需變調夾',
      alternative: null 
    };
  }
  // Capo 1-8：建議範圍
  if (capo >= 1 && capo <= 8) {
    return { 
      capo: capo, 
      status: 'ok',
      message: `建議 Capo: ${capo}`,
      alternative: null 
    };
  }
  // Capo 9-11：位置過高，建議 Drop Tuning
  if (capo >= 9 && capo <= 11) {
    const dropTuningCapo = capo - 2; // Drop Tuning 後只需夾 (capo-2) 格
    return { 
      capo: capo, 
      status: 'high',
      message: `Capo ${capo} 位置過高`,
      alternative: {
        type: 'dropTuning',
        capo: dropTuningCapo,
        message: `改用 Drop Tuning（降全音調弦），只需夾第 ${dropTuningCapo} 格`
      }
    };
  }
  return { capo: null, status: 'invalid', message: '', alternative: null };
}

// ============ 核心處理函數 ============
function processPair(chordLine, lyricLine, transposeSemitones = 0) {
  const normalizedChord = normalizeInput(chordLine);
  const normalizedLyric = normalizeInput(lyricLine);
  const bracketPositions = findBracketPositions(normalizedLyric);
  
  // 解析和弦
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

  // 對齊計算
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

  // 處理歌詞顏色
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

  return {
    chordLine: newChordLine,
    lyricParts: parts,
    error: false
  };
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
  initialKey
}) => {
  const [currentKey, setCurrentKey] = useState(initialKey || originalKey);
  const [fontSize, setFontSize] = useState(16);
  const [isAutoScroll, setIsAutoScroll] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content || '');
  
  const scrollRef = useRef(null);
  const autoScrollRef = useRef(null);

  // 計算 Capo 位置（正確公式）
  const capo = calculateCapo(originalKey, currentKey);
  
  // 計算和弦轉調 semitones（音樂轉調用）
  const transposeSemitones = calculateTransposeSemitones(originalKey, currentKey);
  
  // 計算 Capo 建議
  const capoSuggestion = getCapoSuggestion(capo);

  // 處理 initialKey 變化（從 URL query parameter）
  useEffect(() => {
    if (initialKey && initialKey !== currentKey) {
      setCurrentKey(initialKey);
    }
  }, [initialKey]);

  // 自動滾動
  useEffect(() => {
    if (isAutoScroll && scrollRef.current) {
      autoScrollRef.current = setInterval(() => {
        scrollRef.current.scrollTop += 1;
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
  }, [isAutoScroll]);

  // 處理字體大小
  const handleFontSize = (delta) => {
    setFontSize(prev => Math.max(12, Math.min(24, prev + delta)));
  };

  // 複製到剪貼板
  const handleCopy = useCallback(() => {
    if (content) {
      navigator.clipboard.writeText(content);
    }
  }, [content]);

  // 處理編輯保存
  const handleSave = () => {
    if (onContentChange) {
      onContentChange(editContent);
    }
    setIsEditing(false);
  };

  // 渲染譜內容
  const renderContent = () => {
    if (!content) return null;

    const lines = content.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const nextLine = lines[i + 1] || '';
      
      // 空行
      if (!line.trim()) {
        elements.push(<div key={i} style={{ height: '1.5em' }} />);
        i++;
        continue;
      }
      
      // 檢查是否和弦行
      const isChord = /[A-G][#b]?/.test(line) || line.includes('|') || line.includes('｜');
      const nextIsChord = /[A-G][#b]?/.test(nextLine) || nextLine.includes('|') || nextLine.includes('｜');
      
      if (isChord && !nextIsChord && nextLine.trim() && nextLine.includes('(')) {
        const { prefix, suffix, cleanLine } = extractSectionMarkers(line);
        const result = processPair(cleanLine, nextLine, transposeSemitones);
        
        if (result.error) {
          elements.push(
            <div key={i} style={{ marginBottom: '0.8em' }}>
              <div style={{ color: '#FFD700', whiteSpace: 'pre' }}>
                {prefix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: '0.85em' }}>{prefix}</span>}
                {result.chordLine}
                {suffix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: '0.85em' }}>{suffix}</span>}
              </div>
              <div style={{ color: '#A0A0A0' }}>{result.lyricLine}</div>
            </div>
          );
        } else {
          elements.push(
            <div key={i} style={{ marginBottom: '0.8em' }}>
              <div style={{ color: '#FFD700', fontWeight: 'bold', whiteSpace: 'pre' }}>
                {prefix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: '0.85em' }}>{prefix}</span>}
                {result.chordLine}
                {suffix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: '0.85em' }}>{suffix}</span>}
              </div>
              <div style={{ whiteSpace: 'pre' }}>
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
        // 純和弦行（前奏/間奏/尾奏）- 需要轉調
        const { prefix, suffix, cleanLine } = extractSectionMarkers(line);
        const transposedChordLine = transposeChordLine(cleanLine, transposeSemitones);
        
        elements.push(
          <div key={i} style={{ color: '#FFD700', fontWeight: 'bold', whiteSpace: 'pre', marginBottom: '0.5em' }}>
            {prefix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: '0.85em' }}>{prefix}</span>}
            {transposedChordLine}
            {suffix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: '0.85em' }}>{suffix}</span>}
          </div>
        );
        i++;
      } else {
        elements.push(
          <div key={i} style={{ color: '#A0A0A0', marginBottom: '0.5em', whiteSpace: 'pre' }}>{line}</div>
        );
        i++;
      }
    }

    return elements;
  };

  // ============ 控制器 UI ============
  const ControlBar = () => (
    <div className="flex flex-col gap-4 p-4 bg-black border-b border-gray-800">
      {/* 轉調控制區 */}
      <div>
        {/* 頂部顯示：原調 → PLAY + Capo 建議 */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm text-gray-400">原調:</span>
          <span className="text-sm font-medium text-white">{originalKey}</span>
          <span className="text-gray-600">→</span>
          <span className="text-sm text-gray-400">PLAY:</span>
          <span className={`text-sm font-bold ${currentKey !== originalKey ? 'text-[#FFD700]' : 'text-white'}`}>
            {currentKey}
          </span>
          
          {/* Capo 建議標籤 */}
          {currentKey !== originalKey && (
            <>
              {capoSuggestion.status === 'none' && (
                <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded">
                  {capoSuggestion.message}
                </span>
              )}
              {capoSuggestion.status === 'ok' && (
                <span className="text-xs px-2 py-0.5 bg-green-900/50 text-green-400 rounded">
                  {capoSuggestion.message}
                </span>
              )}
              {capoSuggestion.status === 'high' && (
                <span className="text-xs px-2 py-0.5 bg-orange-900/50 text-orange-400 rounded">
                  {capoSuggestion.message}
                </span>
              )}
            </>
          )}
        </div>
        
        {/* Drop Tuning 建議（當 capo >= 9）- 簡化版 */}
        {currentKey !== originalKey && capoSuggestion.alternative && (
          <div className="mb-3 text-xs text-gray-500">
            <span className="text-orange-400">提示：</span>
            位置過高，建議 Drop Tuning 後夾 {capoSuggestion.alternative.capo} 格
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
        
        {/* 12 Key 單行排列 - 新規格 w-7 h-7 */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
          {KEYS.map((key) => {
            const isCurrent = key === currentKey;
            const isOriginal = key === originalKey;
            
            return (
              <button
                key={key}
                onClick={() => {
                  setCurrentKey(key)
                  onKeyChange?.(key)
                }}
                className={`
                  flex-shrink-0
                  w-7 h-7
                  rounded-full 
                  flex items-center justify-center 
                  text-[11px] font-bold
                  transition hover:scale-105
                  ${isCurrent
                    ? 'bg-black text-[#FFD700] border border-[#FFD700]'
                    : 'bg-[#FFD700] text-black'
                  }
                `}
                title={isOriginal ? '原調' : ''}
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>

      {/* 分隔線 */}
      <div className="h-px bg-gray-700" />

      {/* 其他控制 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 字體大小控制 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">字體:</span>
          <button
            onClick={() => handleFontSize(-1)}
            className="w-8 h-8 flex items-center justify-center bg-gray-800 text-white rounded hover:bg-gray-700 transition text-xs"
          >
            A-
          </button>
          <span className="w-8 text-center text-sm text-gray-400">{fontSize}px</span>
          <button
            onClick={() => handleFontSize(1)}
            className="w-8 h-8 flex items-center justify-center bg-gray-800 text-white rounded hover:bg-gray-700 transition text-sm"
          >
            A+
          </button>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        {/* 自動滾動 */}
        <button
          onClick={() => setIsAutoScroll(!isAutoScroll)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded transition ${
            isAutoScroll 
              ? 'bg-[#FFD700] text-black' 
              : 'bg-gray-800 text-white hover:bg-gray-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <span className="text-sm">{isAutoScroll ? '停止' : '自動滾動'}</span>
        </button>

        <div className="flex-1" />

        {/* 編輯/複製按鈕 */}
        {editable && (
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white rounded hover:bg-gray-700 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="text-sm">{isEditing ? '預覽' : '編輯'}</span>
          </button>
        )}

        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-3 py-1.5 text-[#FFD700] hover:opacity-80 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="text-sm">複製</span>
        </button>
      </div>
    </div>
  );

  // ============ 編輯模式 ============
  if (isEditing && editable) {
    return (
      <div className={`bg-[#121212] rounded-xl border border-gray-800 overflow-hidden ${className}`}>
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

  // ============ 顯示模式 ============
  return (
    <div className={`bg-[#121212] rounded-xl border border-gray-800 overflow-hidden ${className}`}>
      {showControls && <ControlBar />}
      <div 
        ref={scrollRef}
        className="p-6 overflow-x-auto max-h-[70vh] overflow-y-auto"
        style={{ scrollBehavior: isAutoScroll ? 'auto' : 'smooth' }}
      >
        <div style={{
          fontFamily: "'Sarasa Mono TC', 'Noto Sans Mono CJK TC', 'MingLiU', monospace",
          whiteSpace: 'pre',
          lineHeight: '1.4',
          fontSize: `${fontSize}px`
        }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default TabContent;

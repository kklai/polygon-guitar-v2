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

function transposeChordLine(line, semitones) {
  if (!semitones || semitones === 0) return line;
  
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

  const capo = calculateCapo(originalKey, currentKey);
  const transposeSemitones = calculateTransposeSemitones(originalKey, currentKey);
  const capoSuggestion = getCapoSuggestion(capo);

  useEffect(() => {
    if (initialKey && initialKey !== currentKey) {
      setCurrentKey(initialKey);
    }
  }, [initialKey]);

  // 自動滾動 - 成個頁面一齊滾動
  useEffect(() => {
    if (isAutoScroll) {
      // 調慢速度：原來 1-5 變成 0.5-2.5（慢一半）
      const speeds = [0, 0.5, 1, 1.5, 2, 2.5];
      autoScrollRef.current = setInterval(() => {
        window.scrollBy({ top: speeds[scrollSpeed] || 1, behavior: 'auto' });
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

  const renderContent = () => {
    if (!content) return null;

    const lines = content.split('\n');
    const totalLines = lines.length;
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
      
      const isChord = /[A-G][#b]?/.test(line) || line.includes('|') || line.includes('｜');
      const nextIsChord = /[A-G][#b]?/.test(nextLine) || nextLine.includes('|') || nextLine.includes('｜');
      
      if (isChord && !nextIsChord && nextLine.trim() && nextLine.includes('(')) {
        const { prefix, suffix, cleanLine } = extractSectionMarkers(line);
        const result = processPair(cleanLine, nextLine, transposeSemitones);
        
        if (result.error) {
          elements.push(
            <div key={i} style={{ marginBottom: '0.8em' }}>
              <div style={{ color: '#FFD700', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
                {prefix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: '0.85em' }}>{prefix}</span>}
                {result.chordLine}
                {suffix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: '0.85em' }}>{suffix}</span>}
              </div>
              <div style={{ color: '#A0A0A0', whiteSpace: 'normal', overflowWrap: 'break-word' }}>{result.lyricLine}</div>
            </div>
          );
        } else {
          elements.push(
            <div key={i} style={{ marginBottom: '0.8em' }}>
              <div style={{ color: '#FFD700', fontWeight: 'bold', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
                {prefix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: '0.85em' }}>{prefix}</span>}
                {result.chordLine}
                {suffix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: '0.85em' }}>{suffix}</span>}
              </div>
              <div style={{ whiteSpace: 'normal', overflowWrap: 'break-word' }}>
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
        const { prefix, suffix, cleanLine } = extractSectionMarkers(line);
        const transposedChordLine = transposeChordLine(cleanLine, transposeSemitones);
        
        elements.push(
          <div key={i} style={{ color: '#FFD700', fontWeight: 'bold', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginBottom: '0.5em' }}>
            {prefix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: '0.85em' }}>{prefix}</span>}
            {transposedChordLine}
            {suffix && <span style={{ color: '#808080', fontStyle: 'italic', fontSize: '0.85em' }}>{suffix}</span>}
          </div>
        );
        i++;
      } else {
        elements.push(
          <div key={i} style={{ color: '#A0A0A0', marginBottom: '0.5em', whiteSpace: 'normal', overflowWrap: 'break-word' }}>{line}</div>
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
          {KEYS.map((key) => {
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

import { useState, useEffect } from 'react';

// 常見和弦指法數據庫
// 標準結他指法數據庫
// 格式: fingers: [[弦, 格], [弦, 格], ...] (1=高音E弦, 6=低音E弦)
const CHORD_SHAPES = {
  // ========== C 系列 ==========
  // C: x32010
  'C': { 
    fingers: [[2, 1], [4, 2], [5, 3]], 
    barre: null, 
    name: 'C',
    open: [1, 3] // 1弦和3弦開放
  },
  // Cm: x35543
  'Cm': { 
    fingers: [[2, 4], [3, 5], [4, 5]], 
    barre: { fret: 3, from: 1, to: 5 }, 
    name: 'Cm' 
  },
  // C7: x32310
  'C7': { 
    fingers: [[2, 1], [3, 3], [4, 2], [5, 3]], 
    barre: null, 
    name: 'C7' 
  },
  // Cmaj7: x32000
  'Cmaj7': { 
    fingers: [[4, 2], [5, 3]], 
    barre: null, 
    name: 'Cmaj7',
    open: [1, 2, 3]
  },
  // Cm7: x35343
  'Cm7': { 
    fingers: [[2, 4], [4, 5]], 
    barre: { fret: 3, from: 1, to: 5 }, 
    name: 'Cm7' 
  },
  
  // ========== D 系列 ==========
  // D: xx0232
  'D': { 
    fingers: [[1, 2], [2, 3], [3, 2]], 
    barre: null, 
    name: 'D',
    mute: [5, 6]
  },
  // Dm: xx0231
  'Dm': { 
    fingers: [[1, 1], [2, 3], [3, 2]], 
    barre: null, 
    name: 'Dm',
    mute: [5, 6]
  },
  // D7: xx0212
  'D7': { 
    fingers: [[1, 2], [2, 1], [3, 2]], 
    barre: null, 
    name: 'D7',
    mute: [5, 6]
  },
  // Dmaj7: xx0222
  'Dmaj7': { 
    fingers: [[1, 2], [2, 2], [3, 2]], 
    barre: null, 
    name: 'Dmaj7',
    mute: [5, 6]
  },
  // Dm7: xx0211
  'Dm7': { 
    fingers: [[1, 1], [2, 1], [3, 2]], 
    barre: null, 
    name: 'Dm7',
    mute: [5, 6]
  },
  
  // ========== E 系列 ==========
  // E: 022100
  'E': { 
    fingers: [[3, 1], [4, 2], [5, 2]], 
    barre: null, 
    name: 'E',
    open: [1, 2, 6]
  },
  // Em: 022000
  'Em': { 
    fingers: [[4, 2], [5, 2]], 
    barre: null, 
    name: 'Em',
    open: [1, 2, 3, 6]
  },
  // E7: 020100
  'E7': { 
    fingers: [[3, 1], [5, 2]], 
    barre: null, 
    name: 'E7',
    open: [1, 2, 4, 6]
  },
  // Emaj7: 021100 (或 0-11-14-13-0-0)
  'Emaj7': { 
    fingers: [[3, 1], [4, 1], [5, 2]], 
    barre: { fret: 1, from: 3, to: 4 }, 
    name: 'Emaj7',
    open: [1, 2, 6]
  },
  // Em7: 022030
  'Em7': { 
    fingers: [[2, 3], [4, 2], [5, 2]], 
    barre: null, 
    name: 'Em7',
    open: [1, 3, 6]
  },
  
  // ========== F 系列 ==========
  // F: 133211
  'F': { 
    fingers: [[2, 1], [3, 2], [4, 3]], 
    barre: { fret: 1, from: 1, to: 6 }, 
    name: 'F' 
  },
  // Fm: 133111
  'Fm': { 
    fingers: [[2, 1], [3, 1], [4, 3]], 
    barre: { fret: 1, from: 1, to: 6 }, 
    name: 'Fm' 
  },
  // F7: 131211
  'F7': { 
    fingers: [[2, 1], [3, 2], [4, 1], [5, 3]], 
    barre: { fret: 1, from: 1, to: 6 }, 
    name: 'F7' 
  },
  // Fmaj7: 133210
  'Fmaj7': { 
    fingers: [[2, 1], [3, 2], [4, 3], [5, 3]], 
    barre: { fret: 1, from: 1, to: 6 }, 
    name: 'Fmaj7',
    open: [1]
  },
  // Fm7: 131111
  'Fm7': { 
    fingers: [[2, 1], [4, 1]], 
    barre: { fret: 1, from: 1, to: 6 }, 
    name: 'Fm7' 
  },
  
  // ========== G 系列 ==========
  // G: 320003 或 355433
  'G': { 
    fingers: [[2, 3], [5, 2], [6, 3]], 
    barre: null, 
    name: 'G',
    open: [1, 2, 3]
  },
  // Gm: 355333
  'Gm': { 
    fingers: [[2, 3]], 
    barre: { fret: 3, from: 1, to: 6 }, 
    name: 'Gm' 
  },
  // G7: 320001 或 353433
  'G7': { 
    fingers: [[1, 1], [5, 2], [6, 3]], 
    barre: null, 
    name: 'G7',
    open: [2, 3]
  },
  // Gmaj7: 320002
  'Gmaj7': { 
    fingers: [[2, 4], [5, 2], [6, 3]], 
    barre: null, 
    name: 'Gmaj7',
    open: [1, 2, 3]
  },
  // Gm7: 353333
  'Gm7': { 
    fingers: [], 
    barre: { fret: 3, from: 1, to: 6 }, 
    name: 'Gm7' 
  },
  
  // ========== A 系列 ==========
  // A: x02220
  'A': { 
    fingers: [[2, 2], [3, 2], [4, 2]], 
    barre: null, 
    name: 'A',
    mute: [6],
    open: [1, 5]
  },
  // Am: x02210
  'Am': { 
    fingers: [[2, 1], [3, 2], [4, 2]], 
    barre: null, 
    name: 'Am',
    mute: [6],
    open: [1, 5]
  },
  // A7: x02020
  'A7': { 
    fingers: [[2, 2], [4, 2]], 
    barre: null, 
    name: 'A7',
    mute: [6],
    open: [1, 3, 5]
  },
  // Amaj7: x02120
  'Amaj7': { 
    fingers: [[2, 2], [3, 1], [4, 2]], 
    barre: null, 
    name: 'Amaj7',
    mute: [6],
    open: [1, 5]
  },
  // Am7: x02010
  'Am7': { 
    fingers: [[2, 1], [4, 2]], 
    barre: null, 
    name: 'Am7',
    mute: [6],
    open: [1, 3, 5]
  },
  
  // ========== B 系列 ==========
  // B: x24442
  'B': { 
    fingers: [[2, 4], [3, 4], [4, 4]], 
    barre: { fret: 2, from: 1, to: 5 }, 
    name: 'B',
    mute: [6]
  },
  // Bm: x24432
  'Bm': { 
    fingers: [[2, 3], [3, 4], [4, 4]], 
    barre: { fret: 2, from: 1, to: 5 }, 
    name: 'Bm',
    mute: [6]
  },
  // B7: x21202
  'B7': { 
    fingers: [[2, 2], [3, 1], [4, 2], [5, 2]], 
    barre: null, 
    name: 'B7',
    mute: [6],
    open: [1]
  },
  // Bmaj7: x24342
  'Bmaj7': { 
    fingers: [[2, 4], [3, 3], [4, 4]], 
    barre: { fret: 2, from: 1, to: 5 }, 
    name: 'Bmaj7',
    mute: [6]
  },
  // Bm7: x24232
  'Bm7': { 
    fingers: [[2, 3], [4, 4]], 
    barre: { fret: 2, from: 1, to: 5 }, 
    name: 'Bm7',
    mute: [6]
  },
  
  // ========== 升/降和弦 ==========
  // C#: x46664
  'C#': { fingers: [[2, 6], [3, 6], [4, 6]], barre: { fret: 4, from: 1, to: 5 }, name: 'C#', mute: [6] },
  // C#m: x46654
  'C#m': { fingers: [[2, 5], [3, 6], [4, 6]], barre: { fret: 4, from: 1, to: 5 }, name: 'C#m', mute: [6] },
  // Eb: x68886
  'Eb': { fingers: [[2, 8], [3, 8], [4, 8]], barre: { fret: 6, from: 1, to: 5 }, name: 'Eb', mute: [6] },
  // Ebm: x68876
  'Ebm': { fingers: [[2, 7], [3, 8], [4, 8]], barre: { fret: 6, from: 1, to: 5 }, name: 'Ebm', mute: [6] },
  // F#: 244322
  'F#': { fingers: [[2, 2], [3, 3], [4, 4]], barre: { fret: 2, from: 1, to: 6 }, name: 'F#' },
  // F#m: 244222
  'F#m': { fingers: [[2, 2], [3, 2], [4, 4]], barre: { fret: 2, from: 1, to: 6 }, name: 'F#m' },
  // G#: 466544
  'G#': { fingers: [[2, 4], [3, 5], [4, 6]], barre: { fret: 4, from: 1, to: 6 }, name: 'G#' },
  // G#m: 466444
  'G#m': { fingers: [[2, 4], [4, 6]], barre: { fret: 4, from: 1, to: 6 }, name: 'G#m' },
  // Bb: x13331
  'Bb': { fingers: [[2, 3], [3, 3], [4, 3]], barre: { fret: 1, from: 1, to: 5 }, name: 'Bb', mute: [6] },
  // Bbm: x13321
  'Bbm': { fingers: [[2, 2], [3, 3], [4, 3]], barre: { fret: 1, from: 1, to: 5 }, name: 'Bbm', mute: [6] },
};

// 解析和弦名稱（移除 slash chord 的低音部分）
function parseChordName(chord) {
  if (!chord) return null;
  
  // 移除空格
  const clean = chord.trim();
  
  // 處理 slash chord，例如 "G/B" -> "G"
  const slashIndex = clean.indexOf('/');
  const baseChord = slashIndex > 0 ? clean.slice(0, slashIndex) : clean;
  
  return baseChord;
}

// 獲取和弦指法
export function getChordShape(chord) {
  const baseChord = parseChordName(chord);
  if (!baseChord) return null;
  
  // 直接查找
  if (CHORD_SHAPES[baseChord]) {
    return { ...CHORD_SHAPES[baseChord], originalName: chord };
  }
  
  return null;
}

// 從樂譜內容提取所有獨特和弦
export function extractChords(content) {
  if (!content) return [];
  
  const chordPattern = /\b[A-G][#b]?(m|maj|min|dim|aug|sus|add|m7|maj7|7|9|11|13)?\d*\b/g;
  const matches = content.match(chordPattern) || [];
  
  // 過濾有效和弦
  const validChordPattern = /^[A-G][#b]?(m|maj|min|dim|aug|sus|add|m7|maj7|7|9|11|13)*$/;
  const validChords = matches.filter(c => validChordPattern.test(c.replace(/\/.*/, '')));
  
  // 返回獨特和弦列表
  return [...new Set(validChords)];
}

// 單個和弦圖組件
export function SingleChordDiagram({ chord, size = 80, theme = 'dark' }) {
  const shape = getChordShape(chord);
  const isDark = theme === 'dark';
  
  if (!shape) {
    return (
      <div 
        className={`flex items-center justify-center rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}
        style={{ width: size, height: size * 1.2 }}
      >
        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{chord}</span>
      </div>
    );
  }
  
  const fretCount = 4;
  const stringCount = 6;
  const padding = 8;
  const fretHeight = (size - padding * 2) / fretCount;
  const stringWidth = (size - padding * 2) / (stringCount - 1);
  
  // 顏色
  const colors = {
    bg: isDark ? '#1a1a1a' : '#ffffff',
    grid: isDark ? '#444' : '#ddd',
    text: isDark ? '#fff' : '#333',
    finger: '#FFD700',
    barre: '#FFD700',
  };
  
  return (
    <div 
      className="relative rounded-lg overflow-hidden"
      style={{ 
        width: size, 
        height: size * 1.2,
        backgroundColor: colors.bg,
        border: `1px solid ${colors.grid}`
      }}
    >
      {/* 和弦名稱 */}
      <div 
        className="text-center font-bold text-xs py-1"
        style={{ color: colors.text }}
      >
        {shape.originalName || shape.name}
      </div>
      
      {/* 指板 */}
      <svg width={size} height={size} className="absolute bottom-0">
        {/* 品格線 */}
        {Array.from({ length: fretCount + 1 }).map((_, i) => (
          <line
            key={`fret-${i}`}
            x1={padding}
            y1={padding + i * fretHeight}
            x2={size - padding}
            y2={padding + i * fretHeight}
            stroke={colors.grid}
            strokeWidth={i === 0 ? 3 : 1}
          />
        ))}
        
        {/* 弦線 */}
        {Array.from({ length: stringCount }).map((_, i) => (
          <line
            key={`string-${i}`}
            x1={padding + i * stringWidth}
            y1={padding}
            x2={padding + i * stringWidth}
            y2={size - padding}
            stroke={colors.grid}
            strokeWidth={1}
          />
        ))}
        
        {/* Barre */}
        {shape.barre && (
          <rect
            x={padding + (shape.barre.from - 1) * stringWidth - 3}
            y={padding + (shape.barre.fret - 1) * fretHeight + fretHeight / 2 - 4}
            width={(shape.barre.to - shape.barre.from + 1) * stringWidth}
            height={8}
            rx={4}
            fill={colors.barre}
          />
        )}
        
        {/* 手指位置 */}
        {shape.fingers.map(([string, fret], i) => (
          <circle
            key={`finger-${i}`}
            cx={padding + (string - 1) * stringWidth}
            cy={padding + (fret - 0.5) * fretHeight}
            r={5}
            fill={colors.finger}
          />
        ))}
        
        {/* 開放弦標記 (o) */}
        {shape.open && shape.open.map((string) => (
          <text
            key={`open-${string}`}
            x={padding + (string - 1) * stringWidth}
            y={padding - 4}
            textAnchor="middle"
            fill={colors.text}
            fontSize="10"
            fontWeight="bold"
          >
            o
          </text>
        ))}
        
        {/* 悶音標記 (x) */}
        {shape.mute && shape.mute.map((string) => (
          <text
            key={`mute-${string}`}
            x={padding + (string - 1) * stringWidth}
            y={padding - 4}
            textAnchor="middle"
            fill="#ff4444"
            fontSize="10"
            fontWeight="bold"
          >
            x
          </text>
        ))}
      </svg>
    </div>
  );
}

// 所有和弦圖彈窗
export function ChordDiagramModal({ chords, isOpen, onClose, theme = 'dark' }) {
  if (!isOpen) return null;
  
  const isDark = theme === 'dark';
  const uniqueChords = [...new Set(chords)];
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 彈窗內容 */}
      <div className={`relative rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden ${isDark ? 'bg-[#121212]' : 'bg-white'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            本曲使用和弦 ({uniqueChords.length}個)
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* 和弦圖網格 */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
            {uniqueChords.map((chord, index) => (
              <div key={index} className="flex flex-col items-center">
                <SingleChordDiagram chord={chord} size={70} theme={theme} />
                <span className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {chord}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-700 text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}

// Hover 顯示和弦圖的組件
export function ChordWithHover({ chord, theme = 'dark' }) {
  const [showDiagram, setShowDiagram] = useState(false);
  const shape = getChordShape(chord);
  const isDark = theme === 'dark';
  
  if (!shape) {
    return <span className="text-[#FFD700] font-bold">{chord}</span>;
  }
  
  return (
    <span 
      className="relative inline-block cursor-pointer"
      onMouseEnter={() => setShowDiagram(true)}
      onMouseLeave={() => setShowDiagram(false)}
    >
      <span className="text-[#FFD700] font-bold hover:underline">{chord}</span>
      
      {/* Hover 彈出框 */}
      {showDiagram && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
          <div className={`p-2 rounded-lg shadow-xl ${isDark ? 'bg-gray-800' : 'bg-white'} border border-gray-600`}>
            <SingleChordDiagram chord={chord} size={100} theme={theme} />
          </div>
          {/* 箭頭 */}
          <div className={`absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent ${isDark ? 'border-t-gray-800' : 'border-t-white'}`} />
        </div>
      )}
    </span>
  );
}

// 可 hover 的和弦行組件
export function ChordLineWithHover({ chordLine, prefix, suffix, fontSize, theme = 'dark' }) {
  const isDark = theme === 'dark';
  const colors = {
    chord: '#FFD700',
    prefixSuffix: isDark ? '#B3B3B3' : '#666',
  };
  
  // 解析和弦行，分離和弦和非和弦部分
  const parts = [];
  const chordPattern = /\b[A-G][#b]?(m|maj|min|dim|aug|sus|add|m7|maj7|7|9|11|13)?\b/g;
  
  let lastIndex = 0;
  let match;
  
  // 創建一個臨時的正則對象來迭代匹配
  const tempLine = chordLine;
  let tempMatch;
  while ((tempMatch = chordPattern.exec(tempLine)) !== null) {
    // 添加和弦前的文本
    if (tempMatch.index > lastIndex) {
      parts.push({
        type: 'text',
        content: tempLine.slice(lastIndex, tempMatch.index)
      });
    }
    // 添加和弦
    parts.push({
      type: 'chord',
      content: tempMatch[0]
    });
    lastIndex = tempMatch.index + tempMatch[0].length;
  }
  // 添加剩餘文本
  if (lastIndex < tempLine.length) {
    parts.push({
      type: 'text',
      content: tempLine.slice(lastIndex)
    });
  }
  
  return (
    <div 
      className="font-bold"
      style={{ 
        fontSize: `${fontSize}px`, 
        whiteSpace: 'pre-wrap', 
        marginBottom: '0.05em', 
        lineHeight: '1.2', 
        fontWeight: 700 
      }}
    >
      {prefix && (
        <span style={{ color: colors.prefixSuffix, fontStyle: 'italic', fontSize: `${fontSize * 0.85}px` }}>
          {prefix}
        </span>
      )}
      
      {parts.map((part, index) => (
        part.type === 'chord' ? (
          <ChordWithHover key={index} chord={part.content} theme={theme} />
        ) : (
          <span key={index} style={{ color: colors.chord }}>{part.content}</span>
        )
      ))}
      
      {suffix && (
        <span style={{ color: colors.prefixSuffix, fontStyle: 'italic', fontSize: `${fontSize * 0.85}px` }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

export default SingleChordDiagram;

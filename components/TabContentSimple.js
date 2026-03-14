// 簡化版 TabContent - 淨係顯示內容，冇 Key Selector，冇控制項
import { useMemo } from 'react';

// 轉調函數
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function transposeChord(chord, fromKey, toKey) {
  if (!chord || fromKey === toKey) return chord;
  
  const getIndex = (key) => {
    const cleanKey = key.replace(/maj|mj|m|min|dim|aug|sus|add|7|9|11|13/g, '');
    return NOTES.indexOf(cleanKey);
  };
  
  const fromIndex = getIndex(fromKey);
  const toIndex = getIndex(toKey);
  if (fromIndex === -1 || toIndex === -1) return chord;
  
  const diff = (toIndex - fromIndex + 12) % 12;
  
  return chord.replace(/[A-G][#b]?/g, (match) => {
    const idx = NOTES.indexOf(match);
    if (idx === -1) return match;
    return NOTES[(idx + diff) % 12];
  });
}

function transposeLine(line, fromKey, toKey) {
  if (!line || fromKey === toKey) return line;
  
  return line.replace(/\b[A-G][#b]?(maj|mj|m|min|dim|aug|sus|add|m7|maj7|7|9|11|13)?[0-9]*(\/[A-G][#b]?)?\b/g, (match) => {
    return transposeChord(match, fromKey, toKey);
  });
}

export default function TabContentSimple({ 
  content, 
  originalKey = 'C',
  playKey = 'C'
}) {
  const lines = useMemo(() => {
    if (!content) return [];
    return content.split('\n');
  }, [content]);

  const renderContent = () => {
    return lines.map((line, index) => {
      // 空行
      if (!line.trim()) {
        return <div key={index} className="h-4" />;
      }
      
      // 段落標記 [Intro], [Verse] 等
      const sectionMatch = line.match(/^\[(.+)\]$/);
      if (sectionMatch) {
        return (
          <div key={index} className="my-4">
            <span className="text-[#FFD700] font-bold text-lg tracking-wider">
              {sectionMatch[1]}
            </span>
            <div className="h-0.5 w-16 bg-[#FFD700] mt-1" />
          </div>
        );
      }
      
      // 轉調後嘅行
      const transposedLine = transposeLine(line, originalKey, playKey);
      
      // 檢查係咪純和弦行（有 | 或只有和弦）
      const hasChords = /[A-G][#b]?(maj|mj|m|min|dim|aug|sus|add|m7|maj7|7|9|11|13)?/.test(transposedLine);
      const isChordLine = hasChords && !/[\u4e00-\u9fa5]/.test(transposedLine); // 冇中文字
      
      if (isChordLine) {
        return (
          <div 
            key={index} 
            className="font-mono my-2 text-sm sm:text-base overflow-x-auto whitespace-nowrap"
            style={{ lineHeight: '1.8' }}
          >
            {transposedLine.split('').map((char, i) => {
              // 和弦字母（黃色）
              if (/[A-G]/.test(char)) {
                return (
                  <span key={i} className="text-[#FFD700] font-light">
                    {char}
                  </span>
                );
              }
              // 分隔線
              if (char === '|') {
                return <span key={i} className="text-neutral-500">{char}</span>;
              }
              // 其他
              return <span key={i} className="text-neutral-300">{char}</span>;
            })}
          </div>
        );
      }
      
      // 混合行（和弦 + 歌詞）
      if (hasChords) {
        return (
          <div 
            key={index} 
            className="font-mono my-3 text-sm sm:text-base overflow-x-auto whitespace-nowrap"
            style={{ lineHeight: '1.8' }}
          >
            {transposedLine.split('').map((char, i) => {
              if (/[A-G]/.test(char)) {
                return (
                  <span key={i} className="text-[#FFD700] font-light">
                    {char}
                  </span>
                );
              }
              if (char === '|') {
                return <span key={i} className="text-neutral-500">{char}</span>;
              }
              if (char === '(' || char === ')' || char === '（' || char === '）') {
                return <span key={i} className="text-neutral-400">{char}</span>;
              }
              return <span key={i} className="text-neutral-200">{char}</span>;
            })}
          </div>
        );
      }
      
      // 純文字行
      return (
        <div key={index} className="text-neutral-400 my-2 text-sm">
          {transposedLine}
        </div>
      );
    });
  };

  return (
    <div className="bg-black px-4 py-4">
      {/* Key 顯示 */}
      <div className="text-neutral-500 text-xs mb-4 font-mono">
        Key: {originalKey} {playKey !== originalKey && `> Play ${playKey}`}
      </div>
      
      {/* 內容 */}
      {renderContent()}
    </div>
  );
}

import { useState, useCallback, useEffect } from 'react';
import { useTabPlayer, usePluckSound } from './TabPlayer';

/**
 * CSS 六線譜編輯器
 * 像真六線譜顯示（六條橫線），點擊輸入，有聲播放
 */
export function GuitarTabEditor({ 
  onChange,
  defaultTimeSignature = '4/4',
  defaultBPM = 120
}) {
  // ===== 狀態 =====
  const [measures, setMeasures] = useState([]);
  const [selectedMeasure, setSelectedMeasure] = useState(0);
  const [selectedBeat, setSelectedBeat] = useState(0);     // 第幾個拍子
  const [selectedString, setSelectedString] = useState(5); // 0=第1弦(e), 5=第6弦(E)
  const [duration, setDuration] = useState(4);             // 4=四分, 8=八分, 16=十六分
  const [timeSignature, setTimeSignature] = useState(defaultTimeSignature);
  const [bpm, setBpm] = useState(defaultBPM);
  const [autoPlay, setAutoPlay] = useState(true);
  
  const { isReady, isPlaying, currentPosition, play, stop, initSynth } = useTabPlayer();
  const { pluck } = usePluckSound();
  
  const strings = ['e', 'B', 'G', 'D', 'A', 'E'];
  const durations = [
    { value: 1, label: '𝅝', name: '全音符' },
    { value: 2, label: '𝅗𝅥', name: '二分' },
    { value: 4, label: '♩', name: '四分' },
    { value: 8, label: '♪', name: '八分' },
    { value: 16, label: '♬', name: '十六分' },
  ];
  
  const currentDuration = durations.find(d => d.value === duration) || durations[2];
  const beatsPerMeasure = parseInt(timeSignature.split('/')[0]);
  
  // 初始化
  useEffect(() => {
    if (measures.length === 0) {
      addMeasure(0);
    }
  }, []);
  
  // 添加小節
  const addMeasure = useCallback((afterIndex) => {
    setMeasures(prev => {
      const newMeasure = {
        id: Date.now(),
        notes: [] // { string, fret, beatIndex, duration }
      };
      const newMeasures = [...prev];
      newMeasures.splice(afterIndex + 1, 0, newMeasure);
      return newMeasures;
    });
    setSelectedMeasure(afterIndex + 1);
    setSelectedBeat(0);
  }, []);
  
  // 添加音符
  const addNote = useCallback((measureIdx, beatIdx, stringIdx, fret) => {
    setMeasures(prev => {
      const newMeasures = prev.map((m, mi) => {
        if (mi !== measureIdx) return m;
        
        // 移除同位置同弦的舊音符
        const filtered = m.notes.filter(n => 
          !(n.beatIndex === beatIdx && n.string === stringIdx)
        );
        
        return {
          ...m,
          notes: [...filtered, {
            id: Date.now(),
            string: stringIdx,
            fret,
            beatIndex: beatIdx,
            duration
          }]
        };
      });
      return newMeasures;
    });
    
    if (autoPlay) pluck(stringIdx, fret);
    
    // 自動前進
    const step = duration === 4 ? 1 : duration === 8 ? 0.5 : 0.25;
    if (beatIdx + step < beatsPerMeasure) {
      setSelectedBeat(beatIdx + step);
    } else if (measureIdx < measures.length - 1) {
      setSelectedMeasure(measureIdx + 1);
      setSelectedBeat(0);
    }
  }, [duration, beatsPerMeasure, measures.length, autoPlay, pluck]);
  
  // 刪除音符
  const removeNote = useCallback((measureIdx, beatIdx, stringIdx) => {
    setMeasures(prev => prev.map((m, mi) => {
      if (mi !== measureIdx) return m;
      return {
        ...m,
        notes: m.notes.filter(n => 
          !(n.beatIndex === beatIdx && n.string === stringIdx)
        )
      };
    }));
  }, []);
  
  // 兩位數品數輸入狀態
  const [digitBuffer, setDigitBuffer] = useState('');
  const [digitTimeout, setDigitTimeout] = useState(null);
  
  // 鍵盤控制
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 數字鍵輸入（支援兩位數如 10, 11, 12）
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        
        const newDigit = digitBuffer + e.key;
        setDigitBuffer(newDigit);
        
        // 清除舊 timeout
        if (digitTimeout) clearTimeout(digitTimeout);
        
        if (newDigit.length === 2) {
          // 已輸入兩位數，立即確認
          const fretNum = parseInt(newDigit);
          if (fretNum <= 24) { // 結他最高通常24品
            addNote(selectedMeasure, selectedBeat, selectedString, fretNum);
          }
          setDigitBuffer('');
        } else {
          // 等待第二個數字
          const timeout = setTimeout(() => {
            // 超時，使用單數字
            addNote(selectedMeasure, selectedBeat, selectedString, parseInt(newDigit));
            setDigitBuffer('');
          }, 400);
          setDigitTimeout(timeout);
        }
      }
      
      // +/- 切換時值
      const durIdx = durations.findIndex(d => d.value === duration);
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        if (durIdx < durations.length - 1) setDuration(durations[durIdx + 1].value);
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        if (durIdx > 0) setDuration(durations[durIdx - 1].value);
      }
      
      // 方向鍵
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (selectedBeat < beatsPerMeasure - 1) setSelectedBeat(b => b + 1);
        else if (selectedMeasure < measures.length - 1) {
          setSelectedMeasure(m => m + 1);
          setSelectedBeat(0);
        }
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (selectedBeat > 0) setSelectedBeat(b => b - 1);
        else if (selectedMeasure > 0) {
          setSelectedMeasure(m => m - 1);
          setSelectedBeat(beatsPerMeasure - 1);
        }
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedString(s => Math.max(0, s - 1));
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedString(s => Math.min(5, s + 1));
      }
      
      // Delete
      if (e.key === 'Delete') {
        e.preventDefault();
        removeNote(selectedMeasure, selectedBeat, selectedString);
      }
      
      // Space 播放
      if (e.key === ' ') {
        e.preventDefault();
        isPlaying ? stop() : play(measures, timeSignature, bpm);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (digitTimeout) clearTimeout(digitTimeout);
    };
  }, [selectedMeasure, selectedBeat, selectedString, duration, measures, beatsPerMeasure, isPlaying, play, stop, addNote, removeNote, digitBuffer, digitTimeout]);
  
  // 匯出 ASCII
  const exportASCII = () => {
    return measures.map((m, mi) => {
      const lines = ['e|', 'B|', 'G|', 'D|', 'A|', 'E|'];
      for (let beat = 0; beat < beatsPerMeasure; beat++) {
        for (let s = 0; s < 6; s++) {
          const note = m.notes.find(n => n.beatIndex === beat && n.string === s);
          lines[s] += note ? note.fret.toString().padStart(2, '-') : '--';
          lines[s] += '-';
        }
      }
      return lines.map(l => l + '|').join('\n');
    }).join('\n\n');
  };
  
  return (
    <div className="bg-[#121212] rounded-xl border border-neutral-800 overflow-hidden">
      {/* 工具欄 */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-[#1a1a1a] border-b border-neutral-800">
        <button onClick={() => isPlaying ? stop() : play(measures, timeSignature, bpm)}
          className={`w-10 h-8 flex items-center justify-center rounded ${
            isPlaying ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
          }`}>
          {isPlaying ? '⏹' : '▶'}
        </button>
        <button onClick={initSynth} className={isReady ? 'text-[#FFD700]' : 'text-neutral-500'}>
          {isReady ? '🔊' : '🔇'}
        </button>
        
        <select value={timeSignature} onChange={e => setTimeSignature(e.target.value)}
          className="bg-[#282828] text-white text-sm px-2 py-1 rounded">
          <option value="4/4">4/4</option>
          <option value="3/4">3/4</option>
        </select>
        
        <input type="number" value={bpm} onChange={e => setBpm(parseInt(e.target.value) || 120)}
          className="w-16 bg-[#282828] text-white text-sm px-2 py-1 rounded" />
        
        {/* 時值選擇 */}
        <div className="flex bg-[#282828] rounded p-0.5">
          {durations.map(d => (
            <button key={d.value} onClick={() => setDuration(d.value)}
              className={`px-2 py-1 text-sm rounded ${
                duration === d.value ? 'bg-[#FFD700] text-black font-bold' : 'text-neutral-400'
              }`}>
              {d.label}
            </button>
          ))}
        </div>
        
        <button onClick={() => addMeasure(selectedMeasure)} className="px-3 py-1 bg-[#282828] text-white text-sm rounded">
          + 小節
        </button>
      </div>
      
      {/* 六線譜編輯區 */}
      <div className="p-4 overflow-x-auto">
        <div className="flex gap-8" style={{ minWidth: 'max-content' }}>
          {measures.map((measure, mi) => (
            <Measure 
              key={measure.id}
              measure={measure}
              index={mi}
              beats={beatsPerMeasure}
              isSelected={selectedMeasure === mi}
              selectedBeat={selectedMeasure === mi ? selectedBeat : -1}
              selectedString={selectedString}
              duration={duration}
              isPlaying={isPlaying}
              playPosition={currentPosition.measure === mi ? currentPosition.beat : -1}
              onSelect={(beat, string) => {
                setSelectedMeasure(mi);
                setSelectedBeat(beat);
                if (string !== undefined) setSelectedString(string);
              }}
              onAddNote={(beat, string, fret) => addNote(mi, beat, string, fret)}
            />
          ))}
        </div>
      </div>
      
      {/* 狀態欄 */}
      <div className="px-4 py-2 bg-[#0a0a0a] border-t border-neutral-800 text-sm text-neutral-400">
        第 {selectedMeasure + 1} 小節 | 拍 {selectedBeat + 1} | 
        時值: <span className="text-[#FFD700] text-lg">{currentDuration.label}</span> | 
        選中: {strings[selectedString]}弦
        {digitBuffer && (
          <span className="ml-2 text-[#FFD700]">輸入中: {digitBuffer}...</span>
        )}
      </div>
    </div>
  );
}

/**
 * 單個小節 - 像真六線譜
 */
function Measure({ 
  measure, index, beats, isSelected, selectedBeat, selectedString, 
  duration, isPlaying, playPosition, onSelect, onAddNote 
}) {
  const strings = ['e', 'B', 'G', 'D', 'A', 'E'];
  
  // 獲取某弦某拍的音符
  const getNote = (stringIdx, beatIdx) => {
    return measure.notes.find(n => n.string === stringIdx && n.beatIndex === beatIdx);
  };
  
  // 檢查是否應該顯示符尾
  const hasFlag = (stringIdx, beatIdx) => {
    const note = getNote(stringIdx, beatIdx);
    return note && note.duration >= 8;
  };
  
  return (
    <div className={`relative ${isSelected ? 'ring-2 ring-[#FFD700]/30 rounded' : ''}`}>
      {/* 小節編號 */}
      <div className="absolute -top-5 left-0 text-xs text-neutral-500 font-bold">
        {index + 1}
      </div>
      
      {/* 六條弦 */}
      <div className="relative" style={{ width: `${beats * 60 + 20}px` }}>
        {strings.map((stringName, sIdx) => (
          <div key={sIdx} className="relative h-8">
            {/* 弦名 */}
            <span className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 text-sm font-bold ${
              selectedString === sIdx ? 'text-[#FFD700]' : 'text-neutral-500'
            }`}>
              {stringName}
            </span>
            
            {/* 弦線 */}
            <div className="absolute left-0 right-0 top-1/2 h-px bg-neutral-600"></div>
            
            {/* 拍子位置 */}
            <div className="absolute left-0 right-0 top-0 h-full flex">
              {Array.from({ length: beats }).map((_, bIdx) => {
                const note = getNote(sIdx, bIdx);
                const isCurrent = isSelected && selectedBeat === bIdx && selectedString === sIdx;
                const isPlayPos = isPlaying && Math.abs(playPosition - bIdx) < 0.5;
                
                return (
                  <div key={bIdx} className="flex-1 relative">
                    {/* 小節線 */}
                    {bIdx === 0 && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-neutral-400"></div>
                    )}
                    
                    {/* 拍子線 */}
                    <div className="absolute right-0 top-0 bottom-0 w-px bg-neutral-700"></div>
                    
                    {/* 選中指示 */}
                    {(isCurrent || isPlayPos) && (
                      <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded ${
                        isPlayPos ? 'bg-green-500/30' : 'bg-[#FFD700]/20'
                      }`}></div>
                    )}
                    
                    {/* 輸入中指示 */}
                    {isCurrent && digitBuffer && (
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <span className="text-[#FFD700] font-bold text-lg animate-pulse">{digitBuffer}</span>
                      </div>
                    )}
                    
                    {/* 音符數字（支援兩位數） */}
                    {note && (
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <span className={`text-[#FFD700] font-bold bg-[#121212] px-0.5 ${
                          note.fret >= 10 ? 'text-base' : 'text-lg'
                        }`}>
                          {note.fret}
                        </span>
                        {/* 符尾 */}
                        {note.duration === 8 && (
                          <div className="absolute -right-1 top-0 w-2 h-3 border-r-2 border-b-2 border-[#FFD700] rounded-br"></div>
                        )}
                        {note.duration === 16 && (
                          <>
                            <div className="absolute -right-1 top-0 w-2 h-2 border-r-2 border-b-2 border-[#FFD700] rounded-br"></div>
                            <div className="absolute -right-1 top-2 w-2 h-2 border-r-2 border-b-2 border-[#FFD700] rounded-br"></div>
                          </>
                        )}
                      </div>
                    )}
                    
                    {/* 點擊區 */}
                    <button
                      onClick={() => onSelect(bIdx, sIdx)}
                      className="absolute inset-0 w-full h-full opacity-0 hover:opacity-10 bg-white"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      
      {/* 底部拍子標記 */}
      <div className="flex mt-1" style={{ width: `${beats * 60 + 20}px`, paddingLeft: '10px' }}>
        {Array.from({ length: beats }).map((_, i) => (
          <div key={i} className="flex-1 text-center text-xs text-neutral-600">
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

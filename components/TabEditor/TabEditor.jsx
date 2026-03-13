import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTabPlayer, usePluckSound } from './TabPlayer';

// TUXGUITAR 模式：時值順序（由長到短）
const DURATIONS = [
  { value: 1, label: '𝅝', name: '全音符', width: 4 },      // 全音符
  { value: 2, label: '𝅗𝅥', name: '二分音符', width: 2 },    // 二分音符  
  { value: 4, label: '♩', name: '四分音符', width: 1 },    // 四分音符
  { value: 8, label: '♪', name: '八分音符', width: 0.5 },  // 八分音符
  { value: 16, label: '♬', name: '十六分音符', width: 0.25 }, // 十六分音符
];

/**
 * TUXGUITAR 風格六線譜編輯器
 * 固定拍子位置，+/- 切換時值，數字鍵輸入品數
 */
export function TabEditor({ 
  initialValue = '', 
  onChange,
  defaultTimeSignature = '4/4',
  defaultBPM = 120,
  measuresPerRow = 4
}) {
  // ===== 狀態管理 =====
  const [measures, setMeasures] = useState([]);
  const [selectedMeasure, setSelectedMeasure] = useState(0);
  const [selectedBeat, setSelectedBeat] = useState(0);     // 第幾個拍子
  const [selectedString, setSelectedString] = useState(5); // 0=e, 5=E
  const [durationValue, setDurationValue] = useState(4);   // 當前時值 (4=四分音符)
  const [timeSignature, setTimeSignature] = useState(defaultTimeSignature);
  const [bpm, setBpm] = useState(defaultBPM);
  const [showHelp, setShowHelp] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [autoPlay, setAutoPlay] = useState(true);
  
  // 播放器
  const { isReady, isPlaying, currentPosition, play, stop, initSynth } = useTabPlayer();
  const { pluck } = usePluckSound();
  
  // 和弦快捷鍵
  const chordShortcuts = {
    'C':  { 5: 3, 4: 2, 3: 0, 2: 1, 1: 0 },
    'G':  { 5: 3, 4: 2, 3: 0, 2: 0, 1: 0, 0: 3 },
    'Am': { 5: 0, 4: 2, 3: 2, 2: 1, 1: 0 },
    'Em': { 5: 0, 4: 2, 3: 2, 2: 0, 1: 0, 0: 0 },
    'D':  { 3: 0, 2: 2, 1: 3, 0: 2 },
    'F':  { 5: 1, 4: 3, 3: 3, 2: 2, 1: 1, 0: 1 },
  };
  
  // 獲取當前時值資訊
  const currentDuration = DURATIONS.find(d => d.value === durationValue) || DURATIONS[2];
  
  // 獲取小節拍子數
  const getBeatsPerMeasure = useCallback(() => {
    const [beats] = timeSignature.split('/').map(Number);
    return beats;
  }, [timeSignature]);
  
  // 初始化
  useEffect(() => {
    if (measures.length === 0) {
      addMeasure(0);
    }
  }, []);
  
  // 保存歷史
  const saveHistory = useCallback((newMeasures) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newMeasures)));
    if (newHistory.length > 30) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);
  
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setMeasures(JSON.parse(JSON.stringify(history[newIndex])));
    }
  }, [history, historyIndex]);
  
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setMeasures(JSON.parse(JSON.stringify(history[newIndex])));
    }
  }, [history, historyIndex]);
  
  // ===== 小節操作 =====
  const addMeasure = useCallback((afterIndex) => {
    const beats = getBeatsPerMeasure();
    setMeasures(prev => {
      const newMeasure = {
        id: Date.now(),
        notes: [] // { string, fret, beatIndex, duration }
      };
      const newMeasures = [...prev];
      newMeasures.splice(afterIndex + 1, 0, newMeasure);
      if (prev.length === 0) return newMeasures;
      saveHistory(newMeasures);
      return newMeasures;
    });
    setSelectedMeasure(afterIndex + 1);
    setSelectedBeat(0);
  }, [getBeatsPerMeasure, saveHistory]);
  
  const deleteMeasure = useCallback((index) => {
    setMeasures(prev => {
      if (prev.length <= 1) return prev;
      const newMeasures = prev.filter((_, i) => i !== index);
      saveHistory(newMeasures);
      return newMeasures;
    });
    if (selectedMeasure >= index && selectedMeasure > 0) {
      setSelectedMeasure(selectedMeasure - 1);
    }
  }, [selectedMeasure, saveHistory]);
  
  const clearMeasure = useCallback((index) => {
    setMeasures(prev => {
      const newMeasures = prev.map((m, mi) => mi !== index ? m : { ...m, notes: [] });
      saveHistory(newMeasures);
      return newMeasures;
    });
  }, [saveHistory]);
  
  // ===== 音符操作 =====
  // 添加/更新音符
  const addNote = useCallback((measureIndex, beatIndex, stringIndex, fretNumber) => {
    setMeasures(prev => {
      const newMeasures = prev.map((m, mi) => {
        if (mi !== measureIndex) return m;
        
        // 移除同位置同弦的舊音符
        const filteredNotes = m.notes.filter(n => 
          !(n.beatIndex === beatIndex && n.string === stringIndex)
        );
        
        // 添加新音符
        const newNote = {
          id: Date.now() + Math.random(),
          string: stringIndex,
          fret: fretNumber,
          beatIndex,
          duration: durationValue
        };
        
        return { ...m, notes: [...filteredNotes, newNote] };
      });
      saveHistory(newMeasures);
      return newMeasures;
    });
    
    if (autoPlay) {
      pluck(stringIndex, fretNumber);
    }
  }, [durationValue, saveHistory, pluck, autoPlay]);
  
  // 刪除音符
  const removeNote = useCallback((measureIndex, beatIndex, stringIndex) => {
    setMeasures(prev => {
      const newMeasures = prev.map((m, mi) => {
        if (mi !== measureIndex) return m;
        return {
          ...m,
          notes: m.notes.filter(n => 
            !(n.beatIndex === beatIndex && n.string === stringIndex)
          )
        };
      });
      saveHistory(newMeasures);
      return newMeasures;
    });
  }, [saveHistory]);
  
  // 插入和弦
  const addChord = useCallback((measureIndex, chordShape) => {
    const beats = getBeatsPerMeasure();
    
    Object.entries(chordShape).forEach(([string, fret], idx) => {
      setTimeout(() => {
        addNote(measureIndex, selectedBeat, parseInt(string), fret);
      }, idx * 30);
    });
    
    // 移動到下一拍
    if (selectedBeat < beats - 1) {
      setSelectedBeat(b => b + 1);
    } else if (selectedMeasure < measures.length - 1) {
      setSelectedMeasure(m => m + 1);
      setSelectedBeat(0);
    } else {
      addMeasure(selectedMeasure);
    }
  }, [selectedBeat, selectedMeasure, measures.length, getBeatsPerMeasure, addMeasure, addNote]);
  
  // ===== 鍵盤快捷鍵 =====
  useEffect(() => {
    const handleKeyDown = (e) => {
      const beats = getBeatsPerMeasure();
      const durationIdx = DURATIONS.findIndex(d => d.value === durationValue);
      
      // 數字鍵輸入品數
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const fret = parseInt(e.key);
        addNote(selectedMeasure, selectedBeat, selectedString, fret);
        
        // 自動前進（根據時值）
        const step = Math.max(1, Math.round(1 / currentDuration.width));
        if (selectedBeat + step < beats) {
          setSelectedBeat(b => b + step);
        } else if (selectedMeasure < measures.length - 1) {
          setSelectedMeasure(m => m + 1);
          setSelectedBeat(0);
        }
      }
      
      // + 減少時值（音符變短）
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        if (durationIdx < DURATIONS.length - 1) {
          setDurationValue(DURATIONS[durationIdx + 1].value);
        }
      }
      
      // - 增加時值（音符變長）
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        if (durationIdx > 0) {
          setDurationValue(DURATIONS[durationIdx - 1].value);
        }
      }
      
      // 方向鍵
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (selectedBeat < beats - 1) {
          setSelectedBeat(b => b + 1);
        } else if (selectedMeasure < measures.length - 1) {
          setSelectedMeasure(m => m + 1);
          setSelectedBeat(0);
        }
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (selectedBeat > 0) {
          setSelectedBeat(b => b - 1);
        } else if (selectedMeasure > 0) {
          setSelectedMeasure(m => m - 1);
          const prevBeats = getBeatsPerMeasure();
          setSelectedBeat(prevBeats - 1);
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
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeNote(selectedMeasure, selectedBeat, selectedString);
      }
      
      // 撤銷/重做
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        redo();
      }
      
      // Tab
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          if (selectedMeasure > 0) {
            setSelectedMeasure(m => m - 1);
            setSelectedBeat(0);
          }
        } else {
          if (selectedMeasure < measures.length - 1) {
            setSelectedMeasure(m => m + 1);
            setSelectedBeat(0);
          } else {
            addMeasure(selectedMeasure);
          }
        }
      }
      
      // Space 播放
      if (e.key === ' ') {
        e.preventDefault();
        if (isPlaying) {
          stop();
        } else {
          play(measures, timeSignature, bpm);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMeasure, selectedBeat, selectedString, durationValue, measures.length, getBeatsPerMeasure, currentDuration, addNote, removeNote, undo, redo, addMeasure, isPlaying, play, stop, timeSignature, bpm]);
  
  // ===== 匯出 =====
  const exportASCII = useCallback(() => {
    const beats = getBeatsPerMeasure();
    const rows = Math.ceil(measures.length / measuresPerRow);
    let result = [];
    
    for (let row = 0; row < rows; row++) {
      const rowMeasures = measures.slice(row * measuresPerRow, (row + 1) * measuresPerRow);
      const lines = ['e|', 'B|', 'G|', 'D|', 'A|', 'E|'];
      
      rowMeasures.forEach((measure) => {
        for (let beat = 0; beat < beats; beat++) {
          // 獲取這個拍子的所有音符
          const beatNotes = measure.notes.filter(n => n.beatIndex === beat);
          
          for (let s = 0; s < 6; s++) {
            const note = beatNotes.find(n => n.string === s);
            if (note) {
              lines[s] += note.fret.toString().padStart(2, '-');
            } else {
              lines[s] += '--';
            }
            lines[s] += '-';
          }
        }
        
        // 小節線
        for (let s = 0; s < 6; s++) {
          lines[s] += '|';
        }
      });
      
      result = result.concat(lines);
      if (row < rows - 1) result.push('');
    }
    
    return result.join('\n');
  }, [measures, measuresPerRow, getBeatsPerMeasure]);
  
  // 通知父組件
  useEffect(() => {
    if (measures.length > 0) {
      onChange?.({ measures, timeSignature, bpm, ascii: exportASCII() });
    }
  }, [measures, timeSignature, bpm, onChange, exportASCII]);
  
  // 統計
  const stats = useMemo(() => {
    let noteCount = 0;
    measures.forEach(m => noteCount += m.notes.length);
    return { noteCount, measureCount: measures.length };
  }, [measures]);
  
  const currentMeasure = measures[selectedMeasure];
  
  return (
    <div className="bg-[#121212] rounded-xl border border-neutral-800 overflow-hidden">
      {/* 工具欄 */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-[#1a1a1a] border-b border-neutral-800">
        {/* 播放控制 */}
        <div className="flex items-center gap-1 bg-[#282828] rounded p-1">
          <button onClick={() => isPlaying ? stop() : play(measures, timeSignature, bpm)}
            className={`w-10 h-8 flex items-center justify-center rounded transition ${
              isPlaying ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
            }`}>
            {isPlaying ? '⏹' : '▶'}
          </button>
          <button onClick={initSynth}
            className={`w-8 h-8 flex items-center justify-center rounded ${isReady ? 'text-[#FFD700]' : 'text-neutral-500'}`}>
            {isReady ? '🔊' : '🔇'}
          </button>
        </div>
        
        <div className="w-px h-6 bg-neutral-700 mx-1"></div>
        
        {/* 拍子 */}
        <select value={timeSignature} onChange={(e) => setTimeSignature(e.target.value)}
          className="bg-[#282828] text-white text-sm px-2 py-1.5 rounded border border-neutral-700">
          <option value="4/4">4/4</option>
          <option value="3/4">3/4</option>
          <option value="2/4">2/4</option>
          <option value="6/8">6/8</option>
        </select>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">BPM</span>
          <input type="number" value={bpm} onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
            className="w-16 bg-[#282828] text-white text-sm px-2 py-1.5 rounded border border-neutral-700" />
        </div>
        
        <div className="w-px h-6 bg-neutral-700 mx-1"></div>
        
        {/* 時值選擇 */}
        <div className="flex items-center gap-1 bg-[#282828] rounded p-0.5">
          {DURATIONS.map(({ value, label, name }) => (
            <button
              key={value}
              onClick={() => setDurationValue(value)}
              className={`px-2 py-1 text-sm rounded transition ${
                durationValue === value 
                  ? 'bg-[#FFD700] text-black font-bold' 
                  : 'text-neutral-400 hover:text-white'
              }`}
              title={name}
            >
              {label}
            </button>
          ))}
        </div>
        
        <div className="w-px h-6 bg-neutral-700 mx-1"></div>
        
        <button onClick={undo} disabled={historyIndex <= 0} className="px-2 py-1.5 text-sm text-neutral-400 hover:text-white disabled:opacity-30">↩️</button>
        <button onClick={redo} disabled={historyIndex >= history.length - 1} className="px-2 py-1.5 text-sm text-neutral-400 hover:text-white disabled:opacity-30">↪️</button>
        
        <button onClick={() => addMeasure(selectedMeasure)} className="px-3 py-1.5 bg-[#282828] hover:bg-[#3E3E3E] text-white text-sm rounded border border-neutral-700">
          + 小節
        </button>
      </div>
      
      {/* 主編輯區 */}
      <div className="p-4">
        {showHelp && (
          <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="text-sm text-blue-200">
                <p className="font-medium mb-1">💡 TUXGUITAR 模式</p>
                <div className="text-xs text-blue-300/80 space-y-0.5">
                  <p>• <b>數字鍵 0-9</b>：喺當前拍子輸入品數</p>
                  <p>• <b>+ / -</b>：切換時值（長→短 / 短→長）</p>
                  <p>• <b>方向鍵</b>：移動拍子位置</p>
                  <p>• <b>Delete</b>：刪除音符</p>
                </div>
              </div>
              <button onClick={() => setShowHelp(false)} className="text-blue-400 hover:text-blue-300">✕</button>
            </div>
          </div>
        )}
        
        {/* 小節網格 - TUXGUITAR 風格 */}
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
            {measures.map((measure, mIdx) => (
              <MeasureGrid
                key={measure.id}
                measure={measure}
                index={mIdx}
                beats={getBeatsPerMeasure()}
                isSelected={selectedMeasure === mIdx}
                selectedBeat={selectedMeasure === mIdx ? selectedBeat : -1}
                selectedString={selectedString}
                isPlaying={isPlaying}
                playPosition={currentPosition.measure === mIdx ? currentPosition.beat : -1}
                onSelectBeat={(beatIdx) => {
                  setSelectedMeasure(mIdx);
                  setSelectedBeat(beatIdx);
                }}
                onSelectString={(beatIdx, stringIdx) => {
                  setSelectedMeasure(mIdx);
                  setSelectedBeat(beatIdx);
                  setSelectedString(stringIdx);
                }}
                onAddNote={(beatIdx, stringIdx, fret) => addNote(mIdx, beatIdx, stringIdx, fret)}
                onRemoveNote={(beatIdx, stringIdx) => removeNote(mIdx, beatIdx, stringIdx)}
                onDelete={() => deleteMeasure(mIdx)}
                onClear={() => clearMeasure(mIdx)}
              />
            ))}
          </div>
        </div>
        
        <div className="mt-4 flex items-center gap-4 text-xs text-neutral-500">
          <span>{stats.measureCount} 小節</span>
          <span>{stats.noteCount} 音符</span>
          <span className="ml-auto text-neutral-400">
            第 {selectedMeasure + 1} 小節 | 拍 {selectedBeat + 1} / {getBeatsPerMeasure()} | 
            時值: <span className="text-[#FFD700] text-lg">{currentDuration.label}</span> {currentDuration.name}
          </span>
        </div>
      </div>
      
      {/* ASCII 預覽 */}
      <div className="border-t border-neutral-800 p-4 bg-[#0a0a0a]">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-medium text-neutral-400">ASCII 預覽</h4>
          <button onClick={() => navigator.clipboard.writeText(exportASCII())}
            className="text-xs text-[#FFD700] hover:underline">複製</button>
        </div>
        <pre className="text-xs text-[#FFD700] bg-[#1a1a1a] p-3 rounded overflow-x-auto font-mono leading-tight whitespace-pre">
          {exportASCII()}
        </pre>
      </div>
    </div>
  );
}

/**
 * 小節網格 - TUXGUITAR 風格（固定拍子）
 */
function MeasureGrid({ 
  measure, index, beats, isSelected, selectedBeat, selectedString,
  isPlaying, playPosition,
  onSelectBeat, onSelectString, onAddNote, onRemoveNote, onDelete, onClear
}) {
  const strings = ['e', 'B', 'G', 'D', 'A', 'E'];
  
  return (
    <div className={`border rounded-lg overflow-hidden flex-shrink-0 ${
      isSelected ? 'border-[#FFD700]/50 bg-[#FFD700]/5' : 'border-neutral-800 bg-[#1a1a1a]'
    }`} style={{ width: `${beats * 40 + 40}px` }}>
      {/* 標題 */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#282828] border-b border-neutral-800">
        <span className="text-xs text-neutral-400">{index + 1}</span>
        <div className="flex gap-1">
          <button onClick={onClear} className="text-xs text-neutral-500 hover:text-yellow-400 px-1" title="清空">🗑️</button>
          {index > 0 && (
            <button onClick={onDelete} className="text-xs text-neutral-500 hover:text-red-400 px-1" title="刪除">✕</button>
          )}
        </div>
      </div>
      
      {/* 拍子網格 */}
      <div className="p-2">
        {/* 拍子編號 */}
        <div className="flex mb-1">
          <div className="w-6"></div>
          {Array.from({ length: beats }).map((_, bIdx) => (
            <div key={bIdx} className={`flex-1 text-center text-xs ${
              selectedBeat === bIdx ? 'text-[#FFD700] font-bold' : 'text-neutral-600'
            }`}>
              {bIdx + 1}
            </div>
          ))}
        </div>
        
        {/* 每條弦 */}
        {strings.map((stringName, sIdx) => (
          <div key={sIdx} className="flex items-center mb-1">
            <span className={`text-xs font-bold w-6 text-right pr-1 ${
              selectedString === sIdx ? 'text-[#FFD700]' : 'text-neutral-500'
            }`}>{stringName}</span>
            
            <div className="flex-1 flex">
              {Array.from({ length: beats }).map((_, bIdx) => {
                const note = measure.notes.find(n => n.beatIndex === bIdx && n.string === sIdx);
                const isCurrent = isSelected && selectedBeat === bIdx && selectedString === sIdx;
                const isPlayPos = isPlaying && Math.abs(playPosition - bIdx) < 0.5;
                
                return (
                  <button
                    key={bIdx}
                    onClick={() => {
                      onSelectString(bIdx, sIdx);
                      if (note) {
                        onRemoveNote(bIdx, sIdx);
                      }
                    }}
                    className={`
                      flex-1 h-8 flex items-center justify-center text-sm font-bold
                      border-r border-neutral-800 last:border-r-0
                      transition
                      ${isPlayPos ? 'bg-green-500/30' : ''}
                      ${isCurrent ? 'bg-[#FFD700]/30 ring-1 ring-[#FFD700]' : ''}
                      ${note ? 'text-[#FFD700]' : 'text-neutral-700 hover:bg-[#282828]'}
                    `}
                  >
                    {note ? note.fret : ''}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

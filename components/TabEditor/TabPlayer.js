import { useEffect, useRef, useCallback, useState } from 'react';
import * as Tone from 'tone';

/**
 * 六線譜播放器
 * 使用 Tone.js 生成吉他聲音
 */
export function useTabPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState({ measure: 0, beat: 0 });
  const [isReady, setIsReady] = useState(false);
  
  const synthRef = useRef(null);
  const scheduleRef = useRef([]);
  
  // 吉他標準調音
  const guitarTuning = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
  
  // 計算品位對應的音符
  const getNoteFromFret = useCallback((stringIndex, fret) => {
    const baseNote = guitarTuning[5 - stringIndex];
    if (!baseNote) return null;
    
    const noteMatch = baseNote.match(/^([A-G])(#|b?)(\d+)$/);
    if (!noteMatch) return null;
    
    const [, note, accidental, octave] = noteMatch;
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    let noteIndex = notes.indexOf(note + accidental);
    let newOctave = parseInt(octave);
    
    noteIndex += fret;
    while (noteIndex >= 12) {
      noteIndex -= 12;
      newOctave++;
    }
    
    return notes[noteIndex] + newOctave;
  }, []);
  
  // 停止播放
  const stopPlayback = useCallback(() => {
    try {
      Tone.Transport.stop();
      Tone.Transport.cancel();
      scheduleRef.current = [];
      setIsPlaying(false);
      setCurrentPosition({ measure: 0, beat: 0 });
    } catch (e) {
      console.error('Stop error:', e);
    }
  }, []);
  
  // 初始化合成器
  const initSynth = useCallback(async () => {
    if (synthRef.current) {
      setIsReady(true);
      return;
    }
    
    try {
      await Tone.start();
      
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.02,
          decay: 0.3,
          sustain: 0.3,
          release: 1
        },
        volume: -8
      }).toDestination();
      
      const reverb = new Tone.Reverb({
        decay: 1.5,
        preDelay: 0.01,
        wet: 0.2
      }).toDestination();
      
      synthRef.current.connect(reverb);
      setIsReady(true);
    } catch (e) {
      console.error('Init error:', e);
    }
  }, []);
  
  // 播放整個譜
  const play = useCallback(async (measures, timeSignature, bpm) => {
    if (!synthRef.current) {
      await initSynth();
    }
    
    stopPlayback();
    
    Tone.Transport.bpm.value = bpm;
    
    const [beats, beatType] = timeSignature.split('/').map(Number);
    const quarterNotesPerBeat = beatType === 8 ? 0.5 : 1;
    
    let currentTime = 0;
    const scheduleIds = [];
    
    measures.forEach((measure, mIdx) => {
      const sortedNotes = [...measure.notes].sort((a, b) => a.position - b.position);
      
      const noteGroups = [];
      let currentGroup = [];
      let currentPos = null;
      
      sortedNotes.forEach(note => {
        if (currentPos === null || Math.abs(note.position - currentPos) < 0.01) {
          currentGroup.push(note);
          currentPos = note.position;
        } else {
          if (currentGroup.length > 0) {
            noteGroups.push({ position: currentPos, notes: currentGroup });
          }
          currentGroup = [note];
          currentPos = note.position;
        }
      });
      
      if (currentGroup.length > 0) {
        noteGroups.push({ position: currentPos, notes: currentGroup });
      }
      
      noteGroups.forEach(({ position, notes }) => {
        const time = currentTime + position * quarterNotesPerBeat;
        const duration = notes[0]?.duration || 'quarter';
        
        const id = Tone.Transport.schedule((t) => {
          if (notes.length === 1) {
            const note = notes[0];
            const toneNote = getNoteFromFret(note.string, note.fret);
            if (toneNote && synthRef.current) {
              synthRef.current.triggerAttackRelease(
                toneNote, 
                { 'quarter': '4n', 'eighth': '8n', 'sixteenth': '16n' }[duration] || '4n',
                t
              );
            }
          } else {
            const toneNotes = notes
              .map(n => getNoteFromFret(n.string, n.fret))
              .filter(Boolean);
            if (toneNotes.length > 0 && synthRef.current) {
              synthRef.current.triggerAttackRelease(
                toneNotes,
                { 'quarter': '4n', 'eighth': '8n', 'sixteenth': '16n' }[duration] || '4n',
                t
              );
            }
          }
          
          setCurrentPosition({ measure: mIdx, beat: position });
        }, time);
        
        scheduleIds.push(id);
      });
      
      currentTime += beats * quarterNotesPerBeat;
    });
    
    const endId = Tone.Transport.schedule(() => {
      stopPlayback();
    }, currentTime);
    scheduleIds.push(endId);
    
    scheduleRef.current = scheduleIds;
    Tone.Transport.start();
    setIsPlaying(true);
  }, [initSynth, stopPlayback, getNoteFromFret]);
  
  // 清理
  useEffect(() => {
    return () => {
      try {
        Tone.Transport.stop();
        Tone.Transport.cancel();
        if (synthRef.current) {
          synthRef.current.dispose();
        }
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    };
  }, []);
  
  return {
    isReady,
    isPlaying,
    currentPosition,
    play,
    stop: stopPlayback,
    initSynth
  };
}

/**
 * 簡單的撥弦聲（預覽用）
 */
export function usePluckSound() {
  const synthRef = useRef(null);
  
  const init = useCallback(async () => {
    if (synthRef.current) return;
    try {
      await Tone.start();
      synthRef.current = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.1, release: 0.5 },
        volume: -10
      }).toDestination();
    } catch (e) {
      console.error('Pluck init error:', e);
    }
  }, []);
  
  const pluck = useCallback(async (stringIndex, fret) => {
    try {
      if (!synthRef.current) {
        await init();
      }
      
      const guitarTuning = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
      const baseNote = guitarTuning[5 - stringIndex];
      if (!baseNote) return;
      
      const noteMatch = baseNote.match(/^([A-G])(#|b?)(\d+)$/);
      if (!noteMatch) return;
      
      const [, note, accidental, octave] = noteMatch;
      const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      
      let noteIndex = notes.indexOf(note + accidental);
      let newOctave = parseInt(octave);
      
      noteIndex += fret;
      while (noteIndex >= 12) {
        noteIndex -= 12;
        newOctave++;
      }
      
      const finalNote = notes[noteIndex] + newOctave;
      if (synthRef.current) {
        synthRef.current.triggerAttackRelease(finalNote, '8n');
      }
    } catch (e) {
      console.error('Pluck error:', e);
    }
  }, [init]);
  
  return { pluck, init };
}

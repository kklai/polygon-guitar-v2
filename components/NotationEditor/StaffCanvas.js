/**
 * Six-line staff built with HTML so each subdivision can wrap.
 * First subdivision: opening double bar, beats, rest, single bar.
 * Additional subdivisions (on + click): single bar, empty note columns, single bar.
 * Closing double bar, then add slot. New subdivisions go between last subdivision and closing double bar.
 */

import { useState, useEffect, useCallback, useRef } from 'react'

const STAFF_HEIGHT = 80
const NUM_STRINGS = 6
const BEAT_COLUMN_WIDTH = 20  // time signature column
const NOTE_COLUMN_WIDTH = 40  // rest symbol / beat column width
const THICK_BAR = 8
const THIN_BAR = 1
const BAR_WIDTH = THICK_BAR + 2 + THIN_BAR  // gap 2px between thick and thin
const SINGLE_LINE_WIDTH = 1   // single line between subdivisions
const SUBDIV_ADD_BUTTON_WIDTH = 14  // small + at end of each subdivision

// Duration ID → Unicode rest symbol (Noto Music): whole 𝄻 half 𝄼 quarter 𝄽 1/8 𝄾 1/16 𝄿 1/32 𝅀
const REST_BY_DURATION = {
  whole: '\u{1D13B}',      // 𝄻
  half: '\u{1D13C}',       // 𝄼
  quarter: '\u{1D13D}',    // 𝄽
  eighth: '\u{1D13E}',     // 𝄾
  sixteenth: '\u{1D13F}',  // 𝄿
  thirtySecond: '\u{1D140}', // 𝅀
}

// Time signature ID → PNG in public folder
const TS_IMAGE_BY_ID = {
  '2/4': '/ts_2-4.png',
  '3/4': '/ts_3-4.png',
  '4/4': '/ts_4-4.png',
  '6/8': '/ts_6-8.png',
}

// Total beats per measure for the time signature
const BEATS_PER_MEASURE = {
  '2/4': 2,
  '3/4': 3,
  '4/4': 4,
  '6/8': 6,
}

// Beat value of a duration: for 2/4, 3/4, 4/4 use quarter-note unit; for 6/8 use eighth-note unit
function getBeatValue(durationId, timeSignatureId) {
  const quarterValues = { whole: 4, half: 2, quarter: 1, eighth: 0.5, sixteenth: 0.25, thirtySecond: 0.125 }
  const eighthValues = { whole: 8, half: 4, quarter: 2, eighth: 1, sixteenth: 0.5, thirtySecond: 0.25 }
  if (timeSignatureId === '6/8') return eighthValues[durationId] ?? 1
  return quarterValues[durationId] ?? 1
}

const DURATION_ROW_GAP = 10
const STEM_HEIGHT_QUARTER = 40
const STEM_HEIGHT_HALF = 20
const STEM_WIDTH = 1
const FLAG_SPACING = 4
const FLAG_EXTEND = 40
const FLAG_MIN_STANDALONE = 10  // minimum beam width when not connected to adjacent notes

const FLAGGED_DURATIONS = ['eighth', 'sixteenth', 'thirtySecond']

function getStemFlags(beats) {
  const result = beats.map(() => ({ left: false, right: false }))
  let i = 0
  while (i < beats.length) {
    const d = beats[i].duration
    if (!FLAGGED_DURATIONS.includes(d)) {
      i++
      continue
    }
    let j = i
    while (j < beats.length && beats[j].duration === d) j++
    const maxGroupSize = d === 'eighth' ? 2 : d === 'sixteenth' ? 4 : Infinity
    for (let k = i; k < j; k++) {
      const posInRun = k - i
      const posInGroup = maxGroupSize === Infinity ? posInRun : posInRun % maxGroupSize
      const hasNextInGroup = posInGroup < maxGroupSize - 1 && k + 1 < j
      const hasPrevInGroup = posInGroup > 0
      result[k].right = hasNextInGroup
      result[k].left = hasPrevInGroup
    }
    i = j
  }
  return result
}

function DurationStem({ duration, flagLeft, flagRight, hasNote }) {
  if (!hasNote) return <div style={{ width: NOTE_COLUMN_WIDTH, height: STEM_HEIGHT_QUARTER }} />
  if (duration === 'whole') return <div style={{ width: NOTE_COLUMN_WIDTH, height: STEM_HEIGHT_QUARTER }} />
  const isFlagged = FLAGGED_DURATIONS.includes(duration)
  const stemHeight = duration === 'half' ? STEM_HEIGHT_HALF : STEM_HEIGHT_QUARTER
  const flagCount = duration === 'eighth' ? 1 : duration === 'sixteenth' ? 2 : duration === 'thirtySecond' ? 3 : 0
  const beamWidth =
    flagLeft || flagRight
      ? (flagLeft ? FLAG_EXTEND : 0) + STEM_WIDTH + (flagRight ? FLAG_EXTEND : 0)
      : Math.max(FLAG_MIN_STANDALONE, STEM_WIDTH)
  const beamMarginLeft =
    !flagLeft && flagRight ? 0 : flagLeft ? -FLAG_EXTEND : 0
  const flagBlockHeight = isFlagged && flagCount > 0 ? flagCount * FLAG_SPACING : 0
  return (
    <div className="relative flex flex-col items-center justify-end" style={{ width: NOTE_COLUMN_WIDTH, height: STEM_HEIGHT_QUARTER }}>
      {isFlagged && flagCount > 0 && (
        <div
          className="absolute left-1/2"
          style={{
            bottom: 0,
            marginLeft: beamMarginLeft,
            width: beamWidth,
            height: flagBlockHeight,
          }}
        >
          {Array.from({ length: flagCount }, (_, i) => (
            <div
              key={i}
              className="absolute left-0 bg-black"
              style={{
                bottom: i * FLAG_SPACING,
                width: beamWidth,
                height: 2,
              }}
            />
          ))}
        </div>
      )}
      <div
        className="flex-shrink-0 bg-black"
        style={{
          width: STEM_WIDTH,
          height: stemHeight,
          marginBottom: 0,
        }}
      />
    </div>
  )
}

// 6 horizontal lines, evenly spaced over STAFF_HEIGHT, 1px thick
function StaffLinesBackground({ lineColor = '#000' }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" style={{ paddingTop: 0, paddingBottom: 0 }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="w-full flex-shrink-0" style={{ height: 1, backgroundColor: lineColor }} />
      ))}
    </div>
  )
}

// Two lines: thick (8px) + thin (1px)
function DoubleBar() {
  return (
    <div className="flex flex-shrink-0 self-stretch" style={{ width: BAR_WIDTH }}>
      <div className="h-full bg-black flex-shrink-0" style={{ width: THICK_BAR }} />
      <div className="h-full bg-black flex-shrink-0" style={{ width: THIN_BAR, marginLeft: 2 }} />
    </div>
  )
}

// Single line — divides subdivisions (1px)
function SingleBar() {
  return (
    <div className="flex flex-shrink-0 self-stretch" style={{ width: SINGLE_LINE_WIDTH }}>
      <div className="h-full bg-black w-full flex-shrink-0" style={{ width: 1 }} />
    </div>
  )
}

// Closing double bar before add slot — thin first, then thick
function ClosingDoubleBar() {
  return (
    <div className="flex flex-shrink-0 self-stretch" style={{ width: BAR_WIDTH }}>
      <div className="h-full bg-black flex-shrink-0" style={{ width: THIN_BAR }} />
      <div className="h-full bg-black flex-shrink-0" style={{ width: THICK_BAR, marginLeft: 2 }} />
    </div>
  )
}

function AddSlot({ onClick }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="relative flex flex-shrink-0 cursor-pointer select-none items-center justify-center"
      style={{ width: NOTE_COLUMN_WIDTH, minHeight: STAFF_HEIGHT }}
      aria-label="Add notation"
    >
      <StaffLinesBackground lineColor="#999" />
      <span className="relative z-10 text-neutral-400 text-2xl font-bold leading-none">+</span>
    </div>
  )
}

// One beat cell: rest or fret numbers on 6 lines; hover shows box (no focus); click focuses and selects that fret. Duration toolbar only affects clicked beat.
function BeatCell({
  beat,
  isFocused,
  isHovered,
  onFocus,
  onHover,
  onHoverEnd,
  onAddNote,
  onLineClick,
  selectedLine,
  cellWidth = NOTE_COLUMN_WIDTH,
  cellHeight = STAFF_HEIGHT,
  restChar,
  restMarginTop,
}) {
  const [hoveredLine, setHoveredLine] = useState(null)
  const hasNotes = beat.notes?.length > 0
  const notesByString = (beat.notes ?? []).reduce((acc, n) => {
    acc[n.stringIndex] = n.fret != null ? n.fret : null
    return acc
  }, {})
  const tiedByString = (beat.notes ?? []).reduce((acc, n) => {
    if (n.tiedFromPrevious) acc[n.stringIndex] = true
    return acc
  }, {})
  const tieIconStyle = { fontFamily: '"Noto Music", sans-serif', fontSize: 14, marginTop: 10, marginLeft: -35, transform: 'scale(2.1, -1.5)' }

  const commitFret = useCallback((stringIndex, n) => {
    if (n >= 0 && n <= 24) onAddNote(stringIndex, n)
  }, [onAddNote])

  useEffect(() => {
    if (!hasNotes) setHoveredLine(null)
  }, [hasNotes])

  useEffect(() => {
    if (selectedLine === null) return
    const handleKeyDown = (e) => {
      if (!/^[0-9]$/.test(e.key)) return
      e.preventDefault()
      const current = notesByString[selectedLine]
      const newDigit = parseInt(e.key, 10)
      const newValue = (current != null && current < 10) ? current * 10 + newDigit : newDigit
      if (newValue <= 24) {
        commitFret(selectedLine, newValue)
      } else {
        commitFret(selectedLine, newDigit)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedLine, notesByString, commitFret])

  const showRest = !hasNotes
  const showBoxOnLine = (i) => (isHovered && hoveredLine === i) || (isFocused && selectedLine === i)

  const LINE_TOP_PERCENT = [0, 20, 38, 60, 81, 100]
  const lineFromClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = ((e.clientY - rect.top) / rect.height) * 100
    const boundaries = [0, 10, 29, 49, 70.5, 90.5, 100]
    for (let i = 0; i < 6; i++) {
      if (pct < boundaries[i + 1]) return i
    }
    return 5
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        if (!isFocused) {
          onFocus()
          onLineClick?.(lineFromClick(e))
        } else {
          onFocus()
        }
      }}
      onMouseLeave={() => onHoverEnd?.()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFocus() } }}
      className="flex flex-shrink-0 flex-col justify-between cursor-pointer outline-none relative"
      style={{
        width: cellWidth,
        minWidth: cellWidth,
        maxWidth: cellWidth,
        minHeight: cellHeight,
        boxSizing: 'border-box',
        border: '2px solid transparent',
        borderRadius: 2,
      }}
    >
      {showRest && (
        <span
          className="text-black flex items-center justify-center absolute inset-0"
          style={{ fontFamily: 'Noto Music, sans-serif', fontSize: 34, marginTop: restMarginTop }}
        >
          {restChar}
        </span>
      )}
      {/* Line positions: show fret number outside box when not hovered/selected; show box (with value) when hovered or selected */}
      {(() => (
          <>
            {hasNotes && (
              <div className="absolute inset-0 pointer-events-none">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  (tiedByString[i] || notesByString[i] != null) && !showBoxOnLine(i) && (
                    <span
                      key={i}
                      className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-black font-semibold flex items-center justify-center gap-0.5"
                      style={{
                        top: `${LINE_TOP_PERCENT[i]}%`,
                        fontSize: 12,
                      }}
                    >
                      {tiedByString[i] && <span className="text-black font-normal" style={tieIconStyle} aria-label="Tied from previous">⁀</span>}
                      {!tiedByString[i] && notesByString[i] != null && notesByString[i]}
                    </span>
                  )
                ))}
              </div>
            )}
            {/* Always render line hit areas so hover shows box and focuses beat */}
            <div className="absolute inset-0 pointer-events-none">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                  style={{
                    top: `${LINE_TOP_PERCENT[i]}%`,
                    width: 20,
                    height: 20,
                  }}
                  onMouseEnter={() => {
                    setHoveredLine(i)
                    onHover?.()
                  }}
                  onMouseLeave={() => setHoveredLine((prev) => (prev === i ? null : prev))}
                  onClick={(e) => {
                    e.stopPropagation()
                    onFocus()
                    onLineClick?.(i)
                  }}
                >
                  {showBoxOnLine(i) ? (
                    <div
                      className="w-full h-full flex items-center justify-center gap-0.5"
                      style={{ border: '1px solid #000', backgroundColor: 'transparent', fontSize: 12, color: '#000' }}
                    >
                      {tiedByString[i] && <span style={tieIconStyle}>⁀</span>}
                      {!tiedByString[i] && (notesByString[i] != null ? notesByString[i] : '')}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </>
      ))()}
    </div>
  )
}

export default function StaffCanvas({ onAddNotation, timeSignatureId = '4/4', selectedDuration = 'quarter', selectedDivision, onTieApplied }) {
  const [firstBeats, setFirstBeats] = useState([{ duration: 'quarter' }])
  const [subdivisions, setSubdivisions] = useState([])
  const [focus, setFocus] = useState({ subdivIndex: null, beatIndex: null })
  const [hoveredBeat, setHoveredBeat] = useState({ subdivIndex: null, beatIndex: null })
  const [focusedChordInput, setFocusedChordInput] = useState({ subdivIndex: null, beatIndex: null })
  const [focusedBeatClickedLine, setFocusedBeatClickedLine] = useState(null)
  const tsImageSrc = TS_IMAGE_BY_ID[timeSignatureId] || TS_IMAGE_BY_ID['4/4']
  const totalBeatsPerMeasure = BEATS_PER_MEASURE[timeSignatureId] ?? 4

  // When toolbar duration changes and a beat is focused, update that beat's duration and the stem below (deferred to avoid setState during render)
  useEffect(() => {
    const { subdivIndex, beatIndex } = focus
    if (subdivIndex === null || beatIndex === null) return
    const duration = selectedDuration
    const id = setTimeout(() => {
      if (subdivIndex === 0) {
        setFirstBeats((prev) => prev.map((b, i) => (i === beatIndex ? { ...b, duration } : b)))
      } else {
        const subIdx = subdivIndex
        setSubdivisions((prev) =>
          prev.map((sub, si) => {
            if (si !== subIdx - 1) return sub
            const beats = (sub.beats ?? [sub]).map((b, bi) => (bi === beatIndex ? { ...b, duration } : b))
            return { ...sub, beats }
          })
        )
      }
    }, 0)
    return () => clearTimeout(id)
  }, [selectedDuration, focus.subdivIndex, focus.beatIndex])

  const handleAddSlotClick = () => {
    setSubdivisions((prev) => [...prev, { beats: [{ duration: selectedDuration }] }])
    onAddNotation?.()
  }

  const addBeatToSubdivision = (subdivIndex) => {
    if (subdivIndex === 0) {
      setFirstBeats((prev) => [...prev, { duration: selectedDuration }])
    } else {
      setSubdivisions((prev) => {
        const next = [...prev]
        const sub = next[subdivIndex - 1]
        const existingBeats = sub.beats ?? [sub]
        next[subdivIndex - 1] = { beats: [...existingBeats, { duration: selectedDuration }] }
        return next
      })
    }
    onAddNotation?.()
  }

  const addNoteToBeat = useCallback((subdivIndex, beatIndex, stringIndex, fret) => {
    if (subdivIndex === 0) {
      setFirstBeats((prev) => prev.map((b, i) => {
        if (i !== beatIndex) return b
        const notes = [...(b.notes ?? [])]
        const existing = notes.findIndex((n) => n.stringIndex === stringIndex)
        if (existing >= 0) notes[existing] = { ...notes[existing], stringIndex, fret }
        else notes.push({ stringIndex, fret })
        return { ...b, notes }
      }))
    } else {
      setSubdivisions((prev) => prev.map((sub, si) => {
        if (si !== subdivIndex - 1) return sub
        const beats = (sub.beats ?? [sub]).map((b, bi) => {
          if (bi !== beatIndex) return b
          const notes = [...(b.notes ?? [])]
          const existing = notes.findIndex((n) => n.stringIndex === stringIndex)
          if (existing >= 0) notes[existing] = { ...notes[existing], stringIndex, fret }
          else notes.push({ stringIndex, fret })
          return { ...b, notes }
        })
        return { ...sub, beats }
      }))
    }
  }, [])

  const removeNoteFromBeat = useCallback((subdivIndex, beatIndex, stringIndex) => {
    if (subdivIndex === 0) {
      setFirstBeats((prev) => prev.map((b, i) => {
        if (i !== beatIndex) return b
        const notes = (b.notes ?? []).filter((n) => n.stringIndex !== stringIndex)
        return { ...b, notes }
      }))
    } else {
      setSubdivisions((prev) => prev.map((sub, si) => {
        if (si !== subdivIndex - 1) return sub
        const beats = (sub.beats ?? [sub]).map((b, bi) => {
          if (bi !== beatIndex) return b
          const notes = (b.notes ?? []).filter((n) => n.stringIndex !== stringIndex)
          return { ...b, notes }
        })
        return { ...sub, beats }
      }))
    }
  }, [])

  const setChordOnBeat = useCallback((subdivIndex, beatIndex, chord) => {
    if (subdivIndex === 0) {
      setFirstBeats((prev) => prev.map((b, i) => (i !== beatIndex ? b : { ...b, chord: chord || undefined })))
    } else {
      setSubdivisions((prev) =>
        prev.map((sub, si) => {
          if (si !== subdivIndex - 1) return sub
          const beats = (sub.beats ?? [sub]).map((b, bi) => (bi !== beatIndex ? b : { ...b, chord: chord || undefined }))
          return { ...sub, beats }
        })
      )
    }
  }, [])

  const setTieFromPrevious = useCallback((subdivIndex, beatIndex, stringIndex, value) => {
    if (subdivIndex === 0) {
      setFirstBeats((prev) => prev.map((b, i) => {
        if (i !== beatIndex) return b
        const notes = [...(b.notes ?? [])]
        const idx = notes.findIndex((n) => n.stringIndex === stringIndex)
        if (value) {
          if (idx >= 0) notes[idx] = { ...notes[idx], tiedFromPrevious: true, fret: null }
          else notes.push({ stringIndex, tiedFromPrevious: true, fret: null })
        } else if (idx >= 0) {
          notes[idx] = { ...notes[idx], tiedFromPrevious: false }
        }
        return { ...b, notes }
      }))
    } else {
      setSubdivisions((prev) =>
        prev.map((sub, si) => {
          if (si !== subdivIndex - 1) return sub
          const beats = (sub.beats ?? [sub]).map((b, bi) => {
            if (bi !== beatIndex) return b
            const notes = [...(b.notes ?? [])]
            const idx = notes.findIndex((n) => n.stringIndex === stringIndex)
            if (value) {
              if (idx >= 0) notes[idx] = { ...notes[idx], tiedFromPrevious: true, fret: null }
              else notes.push({ stringIndex, tiedFromPrevious: true, fret: null })
            } else if (idx >= 0) {
              notes[idx] = { ...notes[idx], tiedFromPrevious: false }
            }
            return { ...b, notes }
          })
          return { ...sub, beats }
        })
      )
    }
  }, [])

  const tryApplyTie = useCallback((subdivIndex, beatIndex, stringIndex) => {
    if (beatIndex < 1) return false
    const beats = subdivIndex === 0 ? firstBeats : (subdivisions[subdivIndex - 1]?.beats ?? [subdivisions[subdivIndex - 1]])
    const beatsArray = Array.isArray(beats) ? beats : [beats]
    const prevBeat = beatsArray[beatIndex - 1]
    if (!prevBeat?.notes?.some((n) => n.stringIndex === stringIndex)) return false
    setTieFromPrevious(subdivIndex, beatIndex, stringIndex, true)
    return true
  }, [firstBeats, subdivisions, setTieFromPrevious])

  // When user clicks tie icon: if a fret is already selected (clicked) and previous beat has a note on same fret, add tie. Always deselect tie after.
  useEffect(() => {
    if (selectedDivision !== 'tie' || !onTieApplied) return
    const { subdivIndex, beatIndex } = focus
    if (subdivIndex === null || beatIndex === null || beatIndex === 0) {
      onTieApplied()
      return
    }
    if (focusedBeatClickedLine == null) {
      onTieApplied()
      return
    }
    tryApplyTie(subdivIndex, beatIndex, focusedBeatClickedLine)
    onTieApplied()
  }, [selectedDivision, focus.subdivIndex, focus.beatIndex, focusedBeatClickedLine, tryApplyTie, onTieApplied])

  const deleteFocusedBeat = useCallback(() => {
    const { subdivIndex, beatIndex } = focus
    if (subdivIndex === null || beatIndex === null) return
    if (subdivIndex === 0) {
      setFirstBeats((prev) => {
        const beat = prev[beatIndex]
        const hasNotes = beat?.notes?.length > 0
        if (hasNotes) {
          return prev.map((b, i) => i === beatIndex ? { ...b, notes: [] } : b)
        }
        if (prev.length <= 1) return prev
        return prev.filter((_, i) => i !== beatIndex)
      })
      setFocus((f) => (f.subdivIndex === 0 && f.beatIndex === beatIndex
        ? { subdivIndex: 0, beatIndex: Math.min(beatIndex, Math.max(0, firstBeats.length - 2)) }
        : f))
    } else {
      setSubdivisions((prev) => {
        const sub = prev[subdivIndex - 1]
        const beats = sub.beats ?? [sub]
        const beat = beats[beatIndex]
        const hasNotes = beat?.notes?.length > 0
        if (hasNotes) {
          const nextBeats = beats.map((b, i) => i === beatIndex ? { ...b, notes: [] } : b)
          const next = [...prev]
          next[subdivIndex - 1] = { ...sub, beats: nextBeats }
          return next
        }
        if (beats.length <= 1) {
          return prev.filter((_, i) => i !== subdivIndex - 1)
        }
        const nextBeats = beats.filter((_, i) => i !== beatIndex)
        const next = [...prev]
        next[subdivIndex - 1] = { beats: nextBeats }
        return next
      })
      setFocus((f) => {
        if (f.subdivIndex !== subdivIndex || f.beatIndex !== beatIndex) return f
        const sub = subdivisions[subdivIndex - 1]
        const beats = sub.beats ?? [sub]
        if (beats.length <= 1) return { subdivIndex: null, beatIndex: null }
        return { subdivIndex, beatIndex: Math.min(beatIndex, beats.length - 2) }
      })
    }
  }, [focus, firstBeats.length, subdivisions])

  useEffect(() => {
    const handleKeyDown = (e) => {
      const active = document.activeElement
      if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable) return
      const hasFocus = focus.subdivIndex !== null && focus.beatIndex !== null

      if (e.key === 'Tab' && hasFocus) {
        e.preventDefault()
        addBeatToSubdivision(focus.subdivIndex)
        if (focus.subdivIndex === 0) {
          setFocus({ subdivIndex: 0, beatIndex: firstBeats.length })
        } else {
          const sub = subdivisions[focus.subdivIndex - 1]
          const beats = sub.beats ?? [sub]
          setFocus({ subdivIndex: focus.subdivIndex, beatIndex: beats.length })
        }
        return
      }

      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (!hasFocus) return
      const { subdivIndex, beatIndex } = focus
      const beat = subdivIndex === 0 ? firstBeats[beatIndex] : (subdivisions[subdivIndex - 1]?.beats ?? [subdivisions[subdivIndex - 1]])[beatIndex]
      const hasNotes = (beat?.notes?.length ?? 0) > 0
      const hasDeleteTarget =
        (focusedBeatClickedLine !== null && beat?.notes?.some((n) => n.stringIndex === focusedBeatClickedLine)) ||
        !hasNotes
      if (!hasDeleteTarget) return
      e.preventDefault()
      if (focusedBeatClickedLine !== null && beat?.notes?.some((n) => n.stringIndex === focusedBeatClickedLine)) {
        removeNoteFromBeat(subdivIndex, beatIndex, focusedBeatClickedLine)
      } else if (!hasNotes) {
        deleteFocusedBeat()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focus, focusedBeatClickedLine, deleteFocusedBeat, firstBeats, subdivisions, removeNoteFromBeat])

  // First subdivision total beats and over check
  const firstSubdivTotalBeats = firstBeats.reduce((sum, b) => sum + getBeatValue(b.duration, timeSignatureId), 0)
  const firstSubdivOver = firstSubdivTotalBeats > totalBeatsPerMeasure
  const firstStemFlags = getStemFlags(firstBeats)

  return (
    <div className="bg-neutral-100 min-h-[200px] overflow-x-auto" style={{ padding: '1rem' }}>
      <div className="flex flex-wrap items-start" style={{ rowGap: '2rem' }}>
        {/* First subdivision: opening double bar, beats (20), then one cell per beat + small + ; single line at end if more subdivisions */}
        <div
          className="relative flex-shrink-0"
          style={{
            width: BAR_WIDTH + BEAT_COLUMN_WIDTH + firstBeats.length * NOTE_COLUMN_WIDTH + SUBDIV_ADD_BUTTON_WIDTH + (subdivisions.length > 0 ? SINGLE_LINE_WIDTH : 0),
            backgroundColor: firstSubdivOver ? 'rgba(255, 100, 100, 0.25)' : undefined,
          }}
        >
          <div className="absolute left-0 text-red-600" style={{ top: -20, fontWeight: 500, fontSize: 12 }}>1</div>
          {/* Chord row above staff */}
          <div
            className="flex flex-shrink-0 items-center"
            style={{
              width: BAR_WIDTH + BEAT_COLUMN_WIDTH + firstBeats.length * NOTE_COLUMN_WIDTH + SUBDIV_ADD_BUTTON_WIDTH + (subdivisions.length > 0 ? SINGLE_LINE_WIDTH : 0),
              marginBottom: 6,
            }}
          >
            <div style={{ width: BAR_WIDTH + BEAT_COLUMN_WIDTH, flexShrink: 0 }} />
            {firstBeats.map((beat, beatIdx) => {
              const isChordFocused = focusedChordInput.subdivIndex === 0 && focusedChordInput.beatIndex === beatIdx
              return (
                <input
                  key={beatIdx}
                  type="text"
                  value={beat.chord ?? ''}
                  onChange={(e) => setChordOnBeat(0, beatIdx, e.target.value)}
                  onFocus={() => setFocusedChordInput({ subdivIndex: 0, beatIndex: beatIdx })}
                  onBlur={() => setFocusedChordInput({ subdivIndex: null, beatIndex: null })}
                  placeholder=""
                  className="text-center outline-none"
                  style={{
                    width: NOTE_COLUMN_WIDTH,
                    flexShrink: 0,
                    height: 20,
                    fontSize: 11,
                    padding: '2px 4px',
                    boxSizing: 'border-box',
                    backgroundColor: '#e5e7eb',
                    border: `1px solid ${isChordFocused ? '#000' : '#9ca3af'}`,
                    borderRadius: 4,
                  }}
                  aria-label="Chord"
                />
              )
            })}
            <div style={{ width: SUBDIV_ADD_BUTTON_WIDTH, flexShrink: 0 }} />
            {subdivisions.length > 0 && <div style={{ width: SINGLE_LINE_WIDTH, flexShrink: 0 }} />}
          </div>
          <div
            className="relative flex items-stretch flex-shrink-0"
            style={{
              height: STAFF_HEIGHT,
              width: BAR_WIDTH + BEAT_COLUMN_WIDTH + firstBeats.length * NOTE_COLUMN_WIDTH + SUBDIV_ADD_BUTTON_WIDTH + (subdivisions.length > 0 ? SINGLE_LINE_WIDTH : 0),
            }}
          >
            <StaffLinesBackground />
            <DoubleBar />
            <div className="flex flex-shrink-0 items-center min-w-0" style={{ width: BEAT_COLUMN_WIDTH }}>
              <img src={tsImageSrc} alt={timeSignatureId} className="block w-full h-auto" style={{ maxWidth: 20, objectFit: 'contain' }} />
            </div>
            {firstBeats.map((beat, beatIdx) => {
              const restChar = REST_BY_DURATION[beat.duration] ?? REST_BY_DURATION.quarter
              const isWholeRest = beat.duration === 'whole'
              const isHalfRest = beat.duration === 'half'
              const restMarginTop = undefined
              const isFocused = focus.subdivIndex === 0 && focus.beatIndex === beatIdx
              const isHovered = hoveredBeat.subdivIndex === 0 && hoveredBeat.beatIndex === beatIdx
              return (
                <BeatCell
                  key={beatIdx}
                  beat={beat}
                  isFocused={isFocused}
                  isHovered={isHovered}
                  onFocus={() => {
                    setFocusedBeatClickedLine(null)
                    setFocus({ subdivIndex: 0, beatIndex: beatIdx })
                  }}
                  onHover={() => setHoveredBeat({ subdivIndex: 0, beatIndex: beatIdx })}
                  onHoverEnd={() => setHoveredBeat({ subdivIndex: null, beatIndex: null })}
                  onAddNote={(stringIndex, fret) => addNoteToBeat(0, beatIdx, stringIndex, fret)}
                  onLineClick={(si) => {
                    setFocusedBeatClickedLine(si)
                    if (selectedDivision === 'tie' && beatIdx >= 1) tryApplyTie(0, beatIdx, si)
                  }}
                  selectedLine={isFocused ? focusedBeatClickedLine : null}
                  restChar={restChar}
                  restMarginTop={restMarginTop}
                />
              )
            })}
            <button
              type="button"
              onClick={() => addBeatToSubdivision(0)}
              className="flex flex-shrink-0 items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200 cursor-pointer border-0 rounded"
              style={{ width: SUBDIV_ADD_BUTTON_WIDTH, minHeight: STAFF_HEIGHT, fontSize: 14, lineHeight: 1 }}
              aria-label="Add beat"
            >
              +
            </button>
            {subdivisions.length > 0 && <SingleBar />}
          </div>
          {/* Duration stems 10px below staff — fixed width so alignment doesn't shift on hover */}
          <div
            className="flex flex-shrink-0 items-start"
            style={{
              marginTop: DURATION_ROW_GAP,
              height: STEM_HEIGHT_QUARTER,
              width: BAR_WIDTH + BEAT_COLUMN_WIDTH + firstBeats.length * NOTE_COLUMN_WIDTH + SUBDIV_ADD_BUTTON_WIDTH + (subdivisions.length > 0 ? SINGLE_LINE_WIDTH : 0),
            }}
          >
            <div style={{ width: BAR_WIDTH + BEAT_COLUMN_WIDTH, flexShrink: 0 }} />
            {firstBeats.map((beat, i) => (
              <DurationStem
                key={i}
                duration={beat.duration}
                flagLeft={firstStemFlags[i].left}
                flagRight={firstStemFlags[i].right}
                hasNote={beat.notes?.length > 0}
              />
            ))}
            <div style={{ width: SUBDIV_ADD_BUTTON_WIDTH, flexShrink: 0 }} />
            {subdivisions.length > 0 && <div style={{ width: SINGLE_LINE_WIDTH, flexShrink: 0 }} />}
          </div>
        </div>

        {/* Additional subdivisions: one cell per beat + small + ; bar only at end, last has no bar */}
        {subdivisions.map((sub, i) => {
          const isLast = i === subdivisions.length - 1
          const beats = sub.beats ?? [sub]
          const subdivTotalBeats = beats.reduce((sum, b) => sum + getBeatValue(b.duration, timeSignatureId), 0)
          const subdivOver = subdivTotalBeats > totalBeatsPerMeasure
          const subdivIndex = i + 1
          const subdivStemFlags = getStemFlags(beats)
          return (
            <div
              key={i}
              className="relative flex-shrink-0"
              style={{
                width: beats.length * NOTE_COLUMN_WIDTH + SUBDIV_ADD_BUTTON_WIDTH + (isLast ? 0 : SINGLE_LINE_WIDTH),
                backgroundColor: subdivOver ? 'rgba(255, 100, 100, 0.25)' : undefined,
              }}
            >
              <div className="absolute left-0 text-red-600" style={{ top: -20, fontWeight: 500, fontSize: 12 }}>{i + 2}</div>
              {/* Chord row above staff */}
              <div
                className="flex flex-shrink-0 items-center"
                style={{
                  width: beats.length * NOTE_COLUMN_WIDTH + SUBDIV_ADD_BUTTON_WIDTH + (isLast ? 0 : SINGLE_LINE_WIDTH),
                  marginBottom: 6,
                }}
              >
                {beats.map((beat, beatIdx) => {
                  const isChordFocused = focusedChordInput.subdivIndex === subdivIndex && focusedChordInput.beatIndex === beatIdx
                  return (
                    <input
                      key={beatIdx}
                      type="text"
                      value={beat.chord ?? ''}
                      onChange={(e) => setChordOnBeat(subdivIndex, beatIdx, e.target.value)}
                      onFocus={() => setFocusedChordInput({ subdivIndex, beatIndex: beatIdx })}
                      onBlur={() => setFocusedChordInput({ subdivIndex: null, beatIndex: null })}
                      placeholder=""
                      className="text-center outline-none"
                      style={{
                        width: NOTE_COLUMN_WIDTH,
                        flexShrink: 0,
                        height: 20,
                        fontSize: 11,
                        padding: '2px 4px',
                        boxSizing: 'border-box',
                        backgroundColor: '#e5e7eb',
                        border: `1px solid ${isChordFocused ? '#000' : '#9ca3af'}`,
                        borderRadius: 4,
                      }}
                      aria-label="Chord"
                    />
                  )
                })}
                <div style={{ width: SUBDIV_ADD_BUTTON_WIDTH, flexShrink: 0 }} />
                {!isLast && <div style={{ width: SINGLE_LINE_WIDTH, flexShrink: 0 }} />}
              </div>
              <div
                className="relative flex items-stretch flex-shrink-0"
                style={{
                  height: STAFF_HEIGHT,
                  width: beats.length * NOTE_COLUMN_WIDTH + SUBDIV_ADD_BUTTON_WIDTH + (isLast ? 0 : SINGLE_LINE_WIDTH),
                }}
              >
                <StaffLinesBackground />
                {beats.map((beat, beatIdx) => {
                  const restChar = REST_BY_DURATION[beat.duration] ?? REST_BY_DURATION.quarter
                  const isWholeRest = beat.duration === 'whole'
                  const isHalfRest = beat.duration === 'half'
                  const restMarginTop = undefined
                  const isFocused = focus.subdivIndex === subdivIndex && focus.beatIndex === beatIdx
                  const isHovered = hoveredBeat.subdivIndex === subdivIndex && hoveredBeat.beatIndex === beatIdx
                  return (
                    <BeatCell
                      key={beatIdx}
                      beat={beat}
                      isFocused={isFocused}
                      isHovered={isHovered}
                      onFocus={() => {
                        setFocusedBeatClickedLine(null)
                        setFocus({ subdivIndex, beatIndex: beatIdx })
                      }}
                      onHover={() => setHoveredBeat({ subdivIndex, beatIndex: beatIdx })}
                      onHoverEnd={() => setHoveredBeat({ subdivIndex: null, beatIndex: null })}
                      onAddNote={(stringIndex, fret) => addNoteToBeat(subdivIndex, beatIdx, stringIndex, fret)}
                      onLineClick={(si) => {
                        setFocusedBeatClickedLine(si)
                        if (selectedDivision === 'tie' && beatIdx >= 1) tryApplyTie(subdivIndex, beatIdx, si)
                      }}
                      selectedLine={isFocused ? focusedBeatClickedLine : null}
                      restChar={restChar}
                      restMarginTop={restMarginTop}
                    />
                  )
                })}
                <button
                  type="button"
                  onClick={() => addBeatToSubdivision(subdivIndex)}
                  className="flex flex-shrink-0 items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200 cursor-pointer border-0 rounded"
                  style={{ width: SUBDIV_ADD_BUTTON_WIDTH, minHeight: STAFF_HEIGHT, fontSize: 14, lineHeight: 1 }}
                  aria-label="Add beat"
                >
                  +
                </button>
                {!isLast && <SingleBar />}
              </div>
              <div
                className="flex flex-shrink-0 items-start"
                style={{
                  marginTop: DURATION_ROW_GAP,
                  height: STEM_HEIGHT_QUARTER,
                  width: beats.length * NOTE_COLUMN_WIDTH + SUBDIV_ADD_BUTTON_WIDTH + (isLast ? 0 : SINGLE_LINE_WIDTH),
                }}
              >
                {beats.map((beat, idx) => (
                  <DurationStem
                    key={idx}
                    duration={beat.duration}
                    flagLeft={subdivStemFlags[idx].left}
                    flagRight={subdivStemFlags[idx].right}
                    hasNote={beat.notes?.length > 0}
                  />
                ))}
                <div style={{ width: SUBDIV_ADD_BUTTON_WIDTH, flexShrink: 0 }} />
                {!isLast && <div style={{ width: SINGLE_LINE_WIDTH, flexShrink: 0 }} />}
              </div>
            </div>
          )
        })}

        {/* Closing double bar (20), then add slot (30) */}
        <div className="relative flex flex-shrink-0" style={{ width: BAR_WIDTH, height: STAFF_HEIGHT }}>
          <StaffLinesBackground />
          <ClosingDoubleBar />
        </div>
        <AddSlot onClick={handleAddSlotClick} />
      </div>
    </div>
  )
}

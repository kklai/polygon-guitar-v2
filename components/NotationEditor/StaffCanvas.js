/**
 * Six-line staff built with HTML so each subdivision can wrap.
 * First subdivision: opening double bar, beats, rest, single bar.
 * Additional subdivisions (on + click): single bar, empty note columns, single bar.
 * Closing double bar, then add slot. New subdivisions go between last subdivision and closing double bar.
 */

import { useState } from 'react'

const STAFF_HEIGHT = 48
const NOTE_COLUMN_WIDTH = 30  // rest symbol column width
const BAR_WIDTH = 20          // double bar (opening/closing)
const SINGLE_LINE_WIDTH = 3   // single line between subdivisions

// Duration ID → Unicode rest symbol (Noto Music)
const REST_BY_DURATION = {
  whole: '\u{1D13C}',
  half: '\u{1D13E}',
  quarter: '\u{1D13D}',
  eighth: '\u{1D13F}',
  sixteenth: '\u{1D140}',
  thirtySecond: '\u{1D141}',
}

// Parse "4/4", "6/8" etc into { top, bottom }
function parseTimeSignature(id) {
  if (!id || !id.includes('/')) return { top: 4, bottom: 4 }
  const [top, bottom] = id.split('/').map(Number)
  return { top: top || 4, bottom: bottom || 4 }
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

// Two lines: thick + thin, total BAR_WIDTH
function DoubleBar() {
  return (
    <div className="flex flex-shrink-0 self-stretch" style={{ width: BAR_WIDTH }}>
      <div className="h-full bg-black" style={{ width: 14 }} />
      <div className="h-full bg-black flex-shrink-0" style={{ width: 2, marginLeft: 4 }} />
    </div>
  )
}

// Single line — divides subdivisions (one thin line only)
function SingleBar() {
  return (
    <div className="flex flex-shrink-0 self-stretch items-center justify-center" style={{ width: SINGLE_LINE_WIDTH }}>
      <div className="h-full bg-black flex-shrink-0" style={{ width: 2 }} />
    </div>
  )
}

// Closing double bar before add slot
function ClosingDoubleBar() {
  return (
    <div className="flex flex-shrink-0 self-stretch" style={{ width: BAR_WIDTH }}>
      <div className="h-full bg-black flex-shrink-0" style={{ width: 14 }} />
      <div className="h-full bg-black flex-shrink-0" style={{ width: 2, marginLeft: 4 }} />
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

export default function StaffCanvas({ onAddNotation, timeSignatureId = '4/4', selectedDuration = 'quarter' }) {
  const [subdivisions, setSubdivisions] = useState([])
  const { top: timeTop, bottom: timeBottom } = parseTimeSignature(timeSignatureId)
  const is24 = timeSignatureId === '2/4'
  const is68 = timeSignatureId === '6/8'
  const beatsContainerStyle = {
    fontSize: 15,
    fontWeight: 700,
    fontFamily: 'Georgia, serif',
    lineHeight: is24 ? 0.8 : 0.9,
    marginTop: is24 ? -2 : is68 ? 1 : -4,
  }

  const handleAddSlotClick = () => {
    setSubdivisions((prev) => [...prev, { duration: selectedDuration }])
    onAddNotation?.()
  }

  return (
    <div className="bg-neutral-100 min-h-[200px] overflow-x-auto" style={{ paddingTop: 20 }}>
      <div className="flex flex-wrap items-start">
        {/* First subdivision: opening double bar (20), beats (30), rest (30), single line (3) */}
        <div className="relative flex-shrink-0" style={{ width: BAR_WIDTH + NOTE_COLUMN_WIDTH * 2 + SINGLE_LINE_WIDTH }}>
          <div className="absolute left-0 text-red-600" style={{ top: -20, fontWeight: 500, fontSize: 12 }}>1</div>
          <div className="relative flex items-stretch" style={{ height: STAFF_HEIGHT }}>
            <StaffLinesBackground />
            <DoubleBar />
            <div className="flex flex-shrink-0 items-center min-w-0" style={{ width: NOTE_COLUMN_WIDTH * 2 }}>
              <div className="text-black flex flex-col items-center justify-center shrink-0" style={{ ...beatsContainerStyle, width: NOTE_COLUMN_WIDTH }}>
                <span style={is24 ? { transform: 'scaleY(1.3)' } : undefined}>{timeTop}</span>
                <span>{timeBottom}</span>
              </div>
              <span className="text-black flex items-center justify-center shrink-0" style={{ fontFamily: 'Noto Music, sans-serif', fontSize: 24, width: NOTE_COLUMN_WIDTH }}>{'\u{1D13D}'}</span>
            </div>
            <SingleBar />
          </div>
        </div>

        {/* Additional subdivisions: rest (30) only; bar only at end, and last has no bar */}
        {subdivisions.map((sub, i) => {
          const isLast = i === subdivisions.length - 1
          const restChar = REST_BY_DURATION[sub.duration] ?? REST_BY_DURATION.quarter
          return (
            <div key={i} className="relative flex-shrink-0" style={{ width: NOTE_COLUMN_WIDTH + (isLast ? 0 : SINGLE_LINE_WIDTH) }}>
              <div className="relative flex items-stretch" style={{ height: STAFF_HEIGHT }}>
                <StaffLinesBackground />
                <div className="flex flex-shrink-0 items-center justify-center" style={{ width: NOTE_COLUMN_WIDTH }}>
                  <span className="text-black flex items-center justify-center" style={{ fontFamily: 'Noto Music, sans-serif', fontSize: 24, width: NOTE_COLUMN_WIDTH }}>{restChar}</span>
                </div>
                {!isLast && <SingleBar />}
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

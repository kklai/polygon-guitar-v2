/**
 * Toolbar for music notation editor.
 * Uses Noto Music font (https://fonts.google.com/noto/specimen/Noto+Music) for symbols.
 * Sections: Duration (whole→32nd), Division (dotted, tie, tuplet), Beats (2/4, 3/4, 4/4, 6/8), Chord name input.
 */

import { useState } from 'react'

const NOTO_MUSIC = '"Noto Music", sans-serif'

// Duration: one of these is selected at a time
export const TOOL_IDS = {
  WHOLE: 'whole',
  HALF: 'half',
  QUARTER: 'quarter',
  EIGHTH: 'eighth',
  SIXTEENTH: 'sixteenth',
  THIRTY_SECOND: 'thirtySecond',
}

// Division: additive toggles (can combine with duration)
export const DIVISION_IDS = {
  DOTTED: 'dotted',   // 0.5 note
  TIE: 'tie',
  TUPLET: 'tuplet',
}

// Unicode note values in Noto Music (U+1D15D–1D162)
const DURATION_SYMBOLS = {
  [TOOL_IDS.WHOLE]: '\u{1D15D}',      // 𝅗
  [TOOL_IDS.HALF]: '\u{1D15E}',       // 𝅗𝅥
  [TOOL_IDS.QUARTER]: '\u{1D15F}',    // 𝅘𝅥
  [TOOL_IDS.EIGHTH]: '\u{1D160}',     // 𝅘𝅥𝅮
  [TOOL_IDS.SIXTEENTH]: '\u{1D161}',  // 𝅘𝅥𝅯
  [TOOL_IDS.THIRTY_SECOND]: '\u{1D162}', // 𝅘𝅥𝅰
}

// Time signature options
export const TIME_SIGNATURES = [
  { id: '2/4', top: 2, bottom: 4 },
  { id: '3/4', top: 3, bottom: 4 },
  { id: '4/4', top: 4, bottom: 4 },
  { id: '6/8', top: 6, bottom: 8 },
]

const DURATION_ORDER = [
  TOOL_IDS.WHOLE,
  TOOL_IDS.HALF,
  TOOL_IDS.QUARTER,
  TOOL_IDS.EIGHTH,
  TOOL_IDS.SIXTEENTH,
  TOOL_IDS.THIRTY_SECOND,
]

const DIVISION_ORDER = [DIVISION_IDS.DOTTED, DIVISION_IDS.TIE, DIVISION_IDS.TUPLET]

const btnBase = 'flex items-center justify-center rounded transition-colors border border-transparent'
const btnSelected = 'bg-neutral-300 text-neutral-800 border-neutral-400'
const btnUnselected = 'text-neutral-600 hover:bg-neutral-200 hover:text-neutral-800'

function ToolButton({ selected, onClick, label, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${btnBase} w-10 h-10 ${selected ? btnSelected : btnUnselected} ${className}`}
      title={label}
      aria-label={label}
      aria-pressed={selected}
    >
      {children}
    </button>
  )
}

export default function NotationToolbar({
  selectedDuration,
  onSelectDuration,
  divisionFlags = {},
  onToggleDivision,
  timeSignatureId,
  onSelectTimeSignature,
  chordName,
  onChordNameChange,
}) {
  const [tupletImgFailed, setTupletImgFailed] = useState(false)

  return (
    <div className="p-3 bg-neutral-200 border-b border-neutral-300 space-y-3" style={{ fontFamily: NOTO_MUSIC }}>
      {/* Duration */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-xs font-medium text-neutral-600 px-2 py-1.5 uppercase tracking-wide w-20 shrink-0">
          Duration
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {DURATION_ORDER.map((id) => (
            <ToolButton
              key={id}
              selected={selectedDuration === id}
              onClick={() => onSelectDuration(id)}
              label={id}
            >
              <span className="text-2xl" aria-hidden>{DURATION_SYMBOLS[id]}</span>
            </ToolButton>
          ))}
        </div>
      </div>

      {/* Division (additive) */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-xs font-medium text-neutral-600 px-2 py-1.5 uppercase tracking-wide w-20 shrink-0">
          Division
        </span>
        <div className="flex flex-wrap items-center gap-1">
          <ToolButton
            selected={divisionFlags[DIVISION_IDS.DOTTED]}
            onClick={() => onToggleDivision(DIVISION_IDS.DOTTED)}
            label="Dotted (0.5)"
          >
            <span className="text-2xl" aria-hidden>𝅘𝅥.</span>
          </ToolButton>
          <ToolButton
            selected={divisionFlags[DIVISION_IDS.TIE]}
            onClick={() => onToggleDivision(DIVISION_IDS.TIE)}
            label="Tie"
          >
            <span className="text-xl" aria-hidden>𝅘𝅥𝆤</span>
          </ToolButton>
          <ToolButton
            selected={divisionFlags[DIVISION_IDS.TUPLET]}
            onClick={() => onToggleDivision(DIVISION_IDS.TUPLET)}
            label="Tuplet"
            className="overflow-hidden"
          >
            {tupletImgFailed ? (
              <span className="text-lg font-bold text-current" aria-hidden>3</span>
            ) : (
              <img
                src="/tuplet.png"
                alt="Tuplet"
                className="w-6 h-6 object-contain"
                onError={() => setTupletImgFailed(true)}
              />
            )}
          </ToolButton>
        </div>
      </div>

      {/* Beats (time signature) */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-xs font-medium text-neutral-600 px-2 py-1.5 uppercase tracking-wide w-20 shrink-0">
          Beats
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {TIME_SIGNATURES.map(({ id, top, bottom }) => (
            <ToolButton
              key={id}
              selected={timeSignatureId === id}
              onClick={() => onSelectTimeSignature(id)}
              label={`${top}/${bottom}`}
            >
              <span className="text-sm font-normal tabular-nums" style={{ fontFamily: 'system-ui, sans-serif' }}>
                {top}
                <br />
                {bottom}
              </span>
            </ToolButton>
          ))}
        </div>
      </div>

      {/* Chord name */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="notation-chord-name" className="text-xs font-medium text-neutral-600 px-2 py-1.5 uppercase tracking-wide w-20 shrink-0">
          Chord
        </label>
        <input
          id="notation-chord-name"
          type="text"
          value={chordName}
          onChange={(e) => onChordNameChange(e.target.value)}
          placeholder="e.g. C, Am7, G/B"
          className="px-3 py-2 rounded border border-neutral-400 bg-white text-neutral-800 placeholder-neutral-400 min-w-[120px] max-w-[200px] text-sm"
          aria-label="Chord name"
        />
      </div>
    </div>
  )
}

export { DURATION_ORDER, DIVISION_ORDER, DURATION_SYMBOLS }

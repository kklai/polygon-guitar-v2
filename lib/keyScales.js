/**
 * 自然大調／自然小調嘅七聲音階（依你提供嘅樂理表整理）。
 * 音符用 ASCII # / b，方便同現有 CHORDS / transpose 邏輯對照。
 *
 * 用途：將來可做 Key 內音高亮、調號說明、練習模式等；目前純資料 export。
 */

/** @type {Record<string, string[]>} 大調 tonic → 上行自然音階（7 個音名） */
export const DIATONIC_MAJOR = {
  C: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  G: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
  D: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
  A: ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
  E: ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
  B: ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
  'F#': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],
  'C#': ['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#'],
  F: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
  Bb: ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
  Eb: ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
  Ab: ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'],
  Db: ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],
  Gb: ['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F'],
  Cb: ['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb'],
}

/** @type {Record<string, string[]>} 自然小調 tonic（小寫 m 後綴）→ 自然音階 */
export const DIATONIC_NATURAL_MINOR = {
  Am: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  Em: ['E', 'F#', 'G', 'A', 'B', 'C', 'D'],
  Bm: ['B', 'C#', 'D', 'E', 'F#', 'G', 'A'],
  'F#m': ['F#', 'G#', 'A', 'B', 'C#', 'D', 'E'],
  'C#m': ['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B'],
  'G#m': ['G#', 'A#', 'B', 'C#', 'D#', 'E', 'F#'],
  'D#m': ['D#', 'E#', 'F#', 'G#', 'A#', 'B', 'C#'],
  'A#m': ['A#', 'B#', 'C#', 'D#', 'E#', 'F#', 'G#'],
  Dm: ['D', 'E', 'F', 'G', 'A', 'Bb', 'C'],
  Gm: ['G', 'A', 'Bb', 'C', 'D', 'Eb', 'F'],
  Cm: ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'],
  Fm: ['F', 'G', 'Ab', 'Bb', 'C', 'Db', 'Eb'],
  Bbm: ['Bb', 'C', 'Db', 'Eb', 'F', 'Gb', 'Ab'],
  Ebm: ['Eb', 'F', 'Gb', 'Ab', 'Bb', 'Cb', 'Db'],
  Abm: ['Ab', 'Bb', 'Cb', 'Db', 'Eb', 'Fb', 'Gb'],
}

/** 大調 key 列表（順時針五度圈近似順序：升系 → 降系） */
export const MAJOR_KEY_ORDER = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
  'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
]

/** 自然小調 key 列表（對應上面相對關係） */
export const MINOR_KEY_ORDER = [
  'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m',
  'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm',
]

/**
 * 用「原調字串」搵大調音階（支援 C、Cm、C major 等常見寫法；小調會回 null，請用 getNaturalMinorScale）
 * @param {string} keyLabel 如 "C"、"Bb"、"F#m"（m 結尾會當小調）
 * @returns {string[] | null}
 */
export function getMajorScaleNotes(keyLabel) {
  if (!keyLabel || typeof keyLabel !== 'string') return null
  const t = keyLabel.trim()
  const isMinor = /m$/i.test(t) && !/^([A-G][#b]?)maj/i.test(t)
  if (isMinor) return null
  const root = t.replace(/\s*(major|maj|大調)?$/i, '').replace(/m$/i, '').trim()
  const normalized = normalizeKeyRoot(root)
  return DIATONIC_MAJOR[normalized] || null
}

/**
 * @param {string} keyLabel 如 "Am"、"A minor"、"A小調"
 * @returns {string[] | null}
 */
export function getNaturalMinorScaleNotes(keyLabel) {
  if (!keyLabel || typeof keyLabel !== 'string') return null
  let t = keyLabel.trim().replace(/小調$/u, '').replace(/\s*(minor|自然小調)?$/i, '').trim()
  if (!/m$/i.test(t)) t = `${t}m`
  const root = t.replace(/m$/i, '')
  const normalized = `${normalizeKeyRoot(root)}m`
  return DIATONIC_NATURAL_MINOR[normalized] || null
}

/** 將單字母根音寫法統一成 DIATONIC_* 嘅 key（只做常見別名） */
function normalizeKeyRoot(root) {
  const r = root.trim()
  const map = {
    'C#': 'C#', Db: 'Db', D: 'D', 'D#': 'D#', Eb: 'Eb', E: 'E', F: 'F', 'F#': 'F#', Gb: 'Gb',
    G: 'G', 'G#': 'G#', Ab: 'Ab', A: 'A', 'A#': 'A#', Bb: 'Bb', B: 'B', Cb: 'Cb', C: 'C',
  }
  return map[r] || r
}

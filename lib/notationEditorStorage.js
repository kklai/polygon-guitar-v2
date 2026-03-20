/**
 * Persist notation editor draft (staff + toolbar + last preview tex) in localStorage.
 */
export const NOTATION_EDITOR_STORAGE_KEY = 'polygon-notation-editor-v1'

export const NOTATION_EDITOR_SCHEMA_VERSION = 1

/**
 * @returns {object | null}
 */
export function readNotationEditorState() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(NOTATION_EDITOR_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || data.version !== NOTATION_EDITOR_SCHEMA_VERSION) return null
    return data
  } catch {
    return null
  }
}

/**
 * @param {object} payload
 */
export function writeNotationEditorState(payload) {
  if (typeof window === 'undefined') return
  try {
    const data = {
      version: NOTATION_EDITOR_SCHEMA_VERSION,
      ...payload,
    }
    window.localStorage.setItem(NOTATION_EDITOR_STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* quota / private mode */
  }
}

export function clearNotationEditorState() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(NOTATION_EDITOR_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Handoff between tab new/edit forms and /notation-editor (sessionStorage).
 * Return path: where to go after Save on the notation editor.
 * Pending tex: alphaTex string to merge into form after returning.
 */

const RETURN_KEY = 'polygon-notation-return-path'
const PENDING_TEX_KEY = 'polygon-notation-pending-tex'

export function setNotationEditorReturnPath(path) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(RETURN_KEY, path)
  } catch (_) {}
}

/** Read return path without removing (e.g. Back link on notation editor). */
export function getNotationEditorReturnPath() {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(RETURN_KEY)
  } catch (_) {
    return null
  }
}

/** Read and clear return path (call when navigating away after Save). */
export function consumeNotationReturnPath() {
  if (typeof window === 'undefined') return null
  try {
    const p = sessionStorage.getItem(RETURN_KEY)
    if (p) sessionStorage.removeItem(RETURN_KEY)
    return p
  } catch (_) {
    return null
  }
}

export function setPendingNotationTex(tex) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(PENDING_TEX_KEY, tex)
  } catch (_) {}
}

/** Read pending tex without removing (use when applying to React state; see clearPendingNotationTex). */
export function peekPendingNotationTex() {
  if (typeof window === 'undefined') return null
  try {
    const tex = sessionStorage.getItem(PENDING_TEX_KEY)
    return tex != null && tex !== '' ? tex : null
  } catch (_) {
    return null
  }
}

export function clearPendingNotationTex() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(PENDING_TEX_KEY)
  } catch (_) {}
}

/** @deprecated Use peekPendingNotationTex — does not clear storage (call clearPendingNotationTex after merge). */
export function consumePendingNotationTex() {
  return peekPendingNotationTex()
}

/**
 * Firestore re-export that counts document reads (getDoc, getDocs) for console reporting.
 * Import from this file instead of 'firebase/firestore' so the app uses a single Firestore instance.
 */
import * as real from 'firebase/firestore'

let readCount = 0
/** caller string -> count (capped to MAX_CALLERS unique; overflow goes to "(other)") */
const callerCounts = new Map()
const MAX_CALLERS = 50
const OTHER_KEY = '(other)'

export function getFirestoreReadCount() {
  return readCount
}

export function resetFirestoreReadCount() {
  readCount = 0
  callerCounts.clear()
}

/** Returns sorted array of { caller, count } for the summary. */
export function getFirestoreReadBreakdown() {
  const entries = []
  callerCounts.forEach((count, caller) => entries.push({ caller, count }))
  entries.sort((a, b) => b.count - a.count)
  return entries
}

function getCaller() {
  try {
    const stack = new Error().stack || ''
    const lines = stack.split('\n')
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line.includes('firestore-tracked') && !line.includes('wrapRead')) {
        const inParens = line.match(/\(([^)]+)\)/)
        const pathPart = inParens ? inParens[1] : line
        const fileLine = pathPart.match(/([^/\\]+\.(?:js|jsx|ts|tsx)):(\d+)/)
        if (fileLine) return `${fileLine[1]}:${fileLine[2]}`
        const anyFile = pathPart.match(/([^/\\]+\.(?:js|jsx|ts|tsx))(?::\d+)?(?::\d+)?/)
        if (anyFile) return anyFile[0]
        return line.trim().replace(/^\s*at\s+/, '').slice(0, 70)
      }
    }
  } catch (_) {}
  return '?'
}

function addCaller(caller) {
  if (callerCounts.has(caller)) {
    callerCounts.set(caller, callerCounts.get(caller) + 1)
    return
  }
  if (callerCounts.size < MAX_CALLERS) {
    callerCounts.set(caller, 1)
  } else {
    callerCounts.set(OTHER_KEY, (callerCounts.get(OTHER_KEY) || 0) + 1)
  }
}

function wrapRead(fn) {
  if (typeof fn !== 'function') return fn
  return function (...args) {
    readCount += 1
    addCaller(getCaller())
    return fn.apply(this, args)
  }
}

export const getDoc = wrapRead(real.getDoc)
export const getDocs = wrapRead(real.getDocs)

// Re-export everything else from real (no export * to avoid duplicating getDoc/getDocs)
export {
  doc,
  collection,
  query,
  where,
  or,
  orderBy,
  limit,
  startAfter,
  endBefore,
  getDocFromCache,
  getDocsFromCache,
  getDocFromServer,
  getDocsFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  addDoc,
  writeBatch,
  runTransaction,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  documentId,
  getFirestore,
  getCountFromServer,
  onSnapshot,
  enableIndexedDbPersistence,
  enableMultiTabIndexedDbPersistence,
  initializeFirestore,
  CACHE_SIZE_UNLIMITED,
  connectFirestoreEmulator,
  Timestamp,
  FieldValue
} from 'firebase/firestore'

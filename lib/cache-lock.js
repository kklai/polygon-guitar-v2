/**
 * Firestore-based distributed lock for cache rebuilds.
 * Prevents thundering herd: only one serverless instance rebuilds at a time.
 *
 * Lock docs live in cache/lock_{name} (same collection as cache data).
 * Uses Admin SDK via getAdminDb() — same path as setSearchCache / setHomeCache.
 */

const LOCK_DEFAULT_TTL_MS = 2 * 60 * 1000 // 2 minutes

/**
 * Try to acquire a named lock. Returns { acquired: true, lockId } or { acquired: false }.
 * Lock auto-expires after ttlMs so crashed builders don't hold the lock forever.
 */
export async function tryAcquireLock(name, ttlMs = LOCK_DEFAULT_TTL_MS) {
  try {
    const { getAdminDb } = await import('@/lib/admin-db')
    const adminDb = getAdminDb()
    if (!adminDb) {
      console.warn('[cache-lock] Admin SDK not available, skipping lock')
      return { acquired: true, lockId: 'no-admin' }
    }

    const lockRef = adminDb.collection('cache').doc(`lock_${name}`)
    const lockId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const now = Date.now()

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(lockRef)
      if (snap.exists) {
        const data = snap.data()
        const lockedUntil = data?.lockedUntil || 0
        if (lockedUntil > now) {
          return { acquired: false }
        }
      }
      tx.set(lockRef, {
        lockedBy: lockId,
        lockedUntil: now + ttlMs,
        acquiredAt: now
      })
      return { acquired: true, lockId }
    })

    if (result.acquired) {
      console.log(`[cache-lock] acquired lock_${name} (id: ${result.lockId}, ttl: ${ttlMs}ms)`)
    } else {
      console.log(`[cache-lock] lock_${name} held by another instance, skipping rebuild`)
    }
    return result
  } catch (e) {
    console.error(`[cache-lock] tryAcquireLock(${name}) failed:`, e?.message)
    return { acquired: true, lockId: 'error-fallback' }
  }
}

/**
 * Release a named lock (only if lockId matches).
 */
export async function releaseLock(name, lockId) {
  if (!lockId || lockId === 'no-admin' || lockId === 'error-fallback') return
  try {
    const { getAdminDb } = await import('@/lib/admin-db')
    const adminDb = getAdminDb()
    if (!adminDb) return

    const lockRef = adminDb.collection('cache').doc(`lock_${name}`)
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(lockRef)
      if (snap.exists && snap.data()?.lockedBy === lockId) {
        tx.delete(lockRef)
      }
    })
    console.log(`[cache-lock] released lock_${name} (id: ${lockId})`)
  } catch (e) {
    console.error(`[cache-lock] releaseLock(${name}) failed:`, e?.message)
  }
}

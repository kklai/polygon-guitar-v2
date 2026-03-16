#!/usr/bin/env node
/**
 * One-time migration: normalize all tab.artistId values to Firestore doc IDs,
 * and remove stale denormalized fields (artist, artistName, artistSlug).
 *
 * Usage:
 *   node scripts/normalize-artist-ids.js                    # dry run
 *   node scripts/normalize-artist-ids.js --write            # write changes
 *   node scripts/normalize-artist-ids.js --skip=500         # skip first 500 tabs (resume)
 *   node scripts/normalize-artist-ids.js --limit=200        # only process 200 tabs
 *   node scripts/normalize-artist-ids.js --artists-only     # only load artists (test connectivity)
 */

const admin = require('firebase-admin')
const path = require('path')

if (!admin.apps.length) {
  const serviceAccount = require(path.resolve(__dirname, '../polygon-guitar-v2-firebase-adminsdk-fbsvc-1d54646e39.json'))
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
}

const db = admin.firestore()
const args = process.argv.slice(2)
const DRY_RUN = !args.includes('--write')
const ARTISTS_ONLY = args.includes('--artists-only')
const SKIP = (() => {
  const b = args.find(a => a.startsWith('--skip='))
  return b ? parseInt(b.split('=')[1], 10) : 0
})()
const LIMIT = (() => {
  const b = args.find(a => a.startsWith('--limit='))
  return b ? parseInt(b.split('=')[1], 10) : Infinity
})()

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function retryQuery(queryFn, label, maxRetries = 5) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn()
    } catch (err) {
      if (err.code === 8 || (err.message && err.message.includes('RESOURCE_EXHAUSTED'))) {
        const waitSec = Math.pow(2, attempt + 1) * 5
        console.log(`  [${label}] Quota hit, waiting ${waitSec}s before retry ${attempt + 1}/${maxRetries}...`)
        await sleep(waitSec * 1000)
      } else {
        throw err
      }
    }
  }
  throw new Error(`${label}: max retries exceeded`)
}

async function main() {
  console.log(`\n=== Normalize Artist IDs ${DRY_RUN ? '(DRY RUN)' : '(WRITING)'} ===`)
  if (SKIP > 0) console.log(`  Skipping first ${SKIP} tabs`)
  if (LIMIT < Infinity) console.log(`  Processing max ${LIMIT} tabs`)
  console.log()

  // 1. Load artists in pages of 50
  console.log('Loading artists (pages of 50)...')
  const slugToDocId = new Map()
  const docIds = new Set()
  let artistCount = 0
  let lastArtistDoc = null

  while (true) {
    let q = db.collection('artists').orderBy('__name__').limit(50)
    if (lastArtistDoc) q = q.startAfter(lastArtistDoc)

    const snap = await retryQuery(() => q.get(), `artists page ${artistCount}`)
    if (snap.empty) break

    snap.docs.forEach(doc => {
      const data = doc.data()
      docIds.add(doc.id)
      slugToDocId.set(doc.id, doc.id)
      if (data.normalizedName && data.normalizedName !== doc.id) {
        slugToDocId.set(data.normalizedName, doc.id)
      }
      if (data.name) {
        const fromName = data.name.toLowerCase().replace(/\s+/g, '-')
        if (!slugToDocId.has(fromName)) slugToDocId.set(fromName, doc.id)
      }
    })
    artistCount += snap.docs.length
    lastArtistDoc = snap.docs[snap.docs.length - 1]
    process.stdout.write(`  ${artistCount} artists...\r`)
    if (snap.docs.length < 50) break
    await sleep(2000)
  }
  console.log(`  ${artistCount} artists loaded, ${slugToDocId.size} slug mappings`)

  if (ARTISTS_ONLY) {
    console.log('\n--artists-only: stopping here.')
    return
  }

  // 2. Process tabs in pages of 50
  console.log('\nProcessing tabs (pages of 50)...')
  let fixedCount = 0
  let cleanedCount = 0
  let alreadyCorrect = 0
  let orphaned = 0
  let totalTabs = 0
  let processed = 0
  const orphanedList = []

  let lastTabDoc = null

  while (processed < LIMIT) {
    let q = db.collection('tabs').orderBy('__name__').limit(50)
    if (lastTabDoc) q = q.startAfter(lastTabDoc)

    const snap = await retryQuery(() => q.get(), `tabs page ${totalTabs}`)
    if (snap.empty) break

    const pendingUpdates = []

    for (const tabDoc of snap.docs) {
      totalTabs++
      lastTabDoc = tabDoc

      if (totalTabs <= SKIP) continue
      if (processed >= LIMIT) break
      processed++

      const data = tabDoc.data()
      const currentArtistId = data.artistId || ''
      const updates = {}
      let needsUpdate = false

      let artistIdValid = false
      if (currentArtistId && !docIds.has(currentArtistId)) {
        const resolved = slugToDocId.get(currentArtistId) || (currentArtistId && slugToDocId.get(currentArtistId.toLowerCase()))
        if (resolved) {
          updates.artistId = resolved
          fixedCount++
          needsUpdate = true
          artistIdValid = true
        } else {
          orphaned++
          if (orphanedList.length < 50) {
            orphanedList.push({ tabId: tabDoc.id, title: data.title, currentArtistId })
          }
        }
      } else if (currentArtistId && docIds.has(currentArtistId)) {
        alreadyCorrect++
        artistIdValid = true
      }

      // Only remove denormalized fields when artistId is valid (or was just fixed), so orphaned tabs keep artist/artistName for manual repair
      if (artistIdValid && (data.artist !== undefined || data.artistName !== undefined || data.artistSlug !== undefined)) {
        if (data.artist !== undefined) { updates.artist = admin.firestore.FieldValue.delete(); needsUpdate = true }
        if (data.artistName !== undefined) { updates.artistName = admin.firestore.FieldValue.delete(); needsUpdate = true }
        if (data.artistSlug !== undefined) { updates.artistSlug = admin.firestore.FieldValue.delete(); needsUpdate = true }
      }

      if (needsUpdate) {
        cleanedCount++
        pendingUpdates.push({ ref: tabDoc.ref, updates })
      }
    }

    // Write this page's updates as a batch
    if (!DRY_RUN && pendingUpdates.length > 0) {
      const batch = db.batch()
      pendingUpdates.forEach(({ ref, updates }) => batch.update(ref, updates))
      await retryQuery(() => batch.commit(), `write batch at ${totalTabs}`)
      await sleep(3000)
    }

    process.stdout.write(`  ${totalTabs} scanned, ${cleanedCount} updated, ${alreadyCorrect} correct, ${orphaned} orphaned\r`)
    if (snap.docs.length < 50) break
    await sleep(2000)
  }

  // 3. Report
  console.log(`\n\n=== Results ===`)
  console.log(`  Total scanned:    ${totalTabs}`)
  console.log(`  Processed:        ${processed}`)
  console.log(`  Already correct:  ${alreadyCorrect}`)
  console.log(`  Fixed artistId:   ${fixedCount}`)
  console.log(`  Fields cleaned:   ${cleanedCount}`)
  console.log(`  Orphaned:         ${orphaned}`)

  if (orphanedList.length > 0) {
    console.log('\nOrphaned tabs (artistId doesn\'t match any artist):')
    orphanedList.forEach(o => {
      console.log(`  ${o.tabId}: "${o.title}" -> artistId="${o.currentArtistId}"`)
    })
    if (orphaned > orphanedList.length) console.log(`  ... and ${orphaned - orphanedList.length} more`)
  }

  if (DRY_RUN) {
    console.log('\n(Dry run. Use --write to apply.)')
  } else {
    console.log('\nDone! Rebuild caches:')
    console.log('  - POST /api/admin/rebuild-search-cache')
    console.log('  - POST /api/admin/rebuild-home-cache')
  }
  if (processed >= LIMIT || totalTabs > processed + SKIP) {
    console.log(`\nTo continue: --skip=${SKIP + processed}`)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

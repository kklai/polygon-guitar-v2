#!/usr/bin/env node
/**
 * Remove denormalized artist fields from all tabs. Optionally ensure each tab
 * has an `artists` array in canonical shape [{ id, role }].
 *
 * Removes: artist, artistName, artistSlug, artistBio, artistBirthYear,
 *          artistDebutYear, artistPhoto, artistType, artistYear, region, collaborators,
 *          artistId, collaboratorIds (replaced by artists + artistIds)
 *
 * Keeps only: artists: [{ id, role: 'main'|'feat' }, ...], artistIds: [id, ...] (for Firestore query),
 *             collaborationType, isCollaboration
 * Adds: artists (if missing, derived from current artistId + collaboratorIds), artistIds = artists.map(a => a.id)
 *
 * Usage:
 *   node scripts/cleanup-tab-artist-fields.js                 # dry run
 *   node scripts/cleanup-tab-artist-fields.js --write          # apply changes
 *   node scripts/cleanup-tab-artist-fields.js --limit=200     # process max 200 tabs
 *   node scripts/cleanup-tab-artist-fields.js --skip=500      # resume after first 500
 *   node scripts/cleanup-tab-artist-fields.js --no-artists    # only delete fields, don't set artists[]
 *   node scripts/cleanup-tab-artist-fields.js --write --verbose   # print each updated tab id + artistId
 *   node scripts/cleanup-tab-artist-fields.js --write --out=cleanup-report.json  # write full lists to file
 *   node scripts/cleanup-tab-artist-fields.js --tab-id=ABC123   # only process this tab (test, dry run)
 *   node scripts/cleanup-tab-artist-fields.js --write --tab-id=ABC123   # only process this tab and write
 */

const admin = require('firebase-admin')
const fs = require('fs')
const path = require('path')

if (!admin.apps.length) {
  try {
    const serviceAccount = require(path.resolve(__dirname, '../polygon-guitar-v2-firebase-adminsdk-fbsvc-1d54646e39.json'))
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  } catch (e) {
    console.error('Need Firebase Admin key: polygon-guitar-v2-firebase-adminsdk-fbsvc-1d54646e39.json in project root, or set GOOGLE_APPLICATION_CREDENTIALS')
    process.exit(1)
  }
}

const db = admin.firestore()
const FieldValue = admin.firestore.FieldValue

const args = process.argv.slice(2)
const DRY_RUN = !args.includes('--write')
const SKIP = (() => {
  const b = args.find(a => a.startsWith('--skip='))
  return b ? parseInt(b.split('=')[1], 10) : 0
})()
const LIMIT = (() => {
  const b = args.find(a => a.startsWith('--limit='))
  return b ? parseInt(b.split('=')[1], 10) : Infinity
})()
const SET_ARTISTS = !args.includes('--no-artists')
const VERBOSE = args.includes('--verbose')
const OUT_FILE = (() => {
  const b = args.find(a => a.startsWith('--out='))
  return b ? b.slice('--out='.length).trim() : null
})()
// Only process this one tab (e.g. --tab-id=G5IIyUTQTq3Qu2OZavLE). For testing.
const TAB_ID = (() => {
  const b = args.find(a => a.startsWith('--tab-id='))
  return b ? b.slice('--tab-id='.length).trim() : null
})()

const FIELDS_TO_REMOVE = [
  'artist',
  'artistName',
  'artistSlug',
  'artistBio',
  'artistBirthYear',
  'artistDebutYear',
  'artistPhoto',
  'artistType',
  'artistYear',
  'region',
  'collaborators',
  'artistId',
  'collaboratorIds'
]

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

/**
 * Check if tab already has canonical artists array: array of { id, role }.
 */
function hasCanonicalArtists(data) {
  const arr = data.artists
  if (!Array.isArray(arr) || arr.length === 0) return false
  const first = arr[0]
  return first && typeof first.id === 'string' && (first.role === 'main' || first.role === 'feat')
}

/**
 * Derive artists: [{ id, role }] from artistId + collaboratorIds.
 * Main = first id; rest = feat.
 */
function deriveArtists(data) {
  const artistId = data.artistId || null
  const collabIds = data.collaboratorIds || (artistId ? [artistId] : [])
  if (collabIds.length === 0 && !artistId) return []
  const ids = collabIds.length > 0 ? [...collabIds] : [artistId]
  // If artistId is set and not first in list, put it first as main
  const mainId = artistId || ids[0]
  const ordered = ids.includes(mainId)
    ? [mainId, ...ids.filter(id => id !== mainId)]
    : ids
  return ordered.map((id, i) => ({ id, role: i === 0 ? 'main' : 'feat' }))
}

async function main() {
  console.log('\n=== Cleanup tab artist fields ' + (DRY_RUN ? '(DRY RUN)' : '(WRITING)') + ' ===')
  if (SKIP > 0) console.log('  Skipping first ' + SKIP + ' tabs')
  if (LIMIT < Infinity) console.log('  Processing max ' + LIMIT + ' tabs')
  if (!SET_ARTISTS) console.log('  --no-artists: only deleting fields, not setting artists[]')
  if (VERBOSE) console.log('  --verbose: print each updated tab id + artistId')
  if (OUT_FILE) console.log('  --out: will write updatedTabIds + affectedArtistIds to ' + OUT_FILE)
  if (TAB_ID) console.log('  --tab-id: only processing tab ' + TAB_ID)
  console.log('  Removing: ' + FIELDS_TO_REMOVE.join(', '))
  console.log()

  let totalTabs = 0
  let processed = 0
  let updatedCount = 0
  let fieldsDeleted = 0
  let artistsSetCount = 0
  let lastDoc = null
  const updatedTabIds = []
  const affectedArtistIds = new Set()

  if (TAB_ID) {
    // Single-tab mode: fetch one doc by ID
    const ref = db.collection('tabs').doc(TAB_ID)
    const docSnap = await ref.get()
    if (!docSnap.exists) {
      console.error('Tab not found: ' + TAB_ID)
      process.exit(1)
    }
    const data = docSnap.data()
    const updates = {}
    for (const key of FIELDS_TO_REMOVE) {
      if (data[key] !== undefined) {
        updates[key] = FieldValue.delete()
        fieldsDeleted++
      }
    }
    if (SET_ARTISTS) {
      if (hasCanonicalArtists(data)) {
        if (!data.artistIds || data.artistIds.length === 0) {
          updates.artistIds = data.artists.map(a => a.id)
          artistsSetCount++
        }
      } else {
        const derived = deriveArtists(data)
        if (derived.length > 0) {
          updates.artists = derived
          updates.artistIds = derived.map(a => a.id)
          artistsSetCount++
        }
      }
    }
    totalTabs = 1
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date().toISOString()
      if (!DRY_RUN) {
        await ref.update(updates)
      }
      updatedCount = 1
      updatedTabIds.push(docSnap.id)
      const ids = updates.artistIds || (data.artistIds || (data.artists || []).map(a => a.id))
      if (data.artistId) affectedArtistIds.add(data.artistId)
      if (Array.isArray(data.collaboratorIds)) data.collaboratorIds.forEach(id => id && affectedArtistIds.add(id))
      if (Array.isArray(ids)) ids.forEach(id => id && affectedArtistIds.add(id))
      processed = 1
      console.log('  Tab ' + TAB_ID + ': would ' + (DRY_RUN ? 'apply' : 'applied') + ' ' + Object.keys(updates).length + ' updates (deleted ' + (Object.keys(updates).length - (updates.artists ? 2 : 1)) + ' fields' + (updates.artists ? ', set artists[]' : '') + ')')
    } else {
      console.log('  Tab ' + TAB_ID + ': no changes needed (already clean or no denormalized fields)')
      const present = (key) => data[key] !== undefined
      const denorm = FIELDS_TO_REMOVE.filter(present)
      console.log('  Current: artists=' + (present('artists') ? (hasCanonicalArtists(data) ? 'canonical' : 'set') : '(not set)') + ', artistIds=' + (present('artistIds') ? 'set' : '(not set)') + ', artistId=' + (present('artistId') ? data.artistId : '(not set)') + ', collaboratorIds=' + (present('collaboratorIds') ? 'set' : '(not set)'))
      if (denorm.length) console.log('  Denormalized still present: ' + denorm.join(', '))
      else console.log('  No denormalized fields on this tab.')
    }
  } else {
    while (processed < LIMIT) {
      let q = db.collection('tabs').orderBy('__name__').limit(50)
      if (lastDoc) q = q.startAfter(lastDoc)

      const snap = await retryQuery(() => q.get(), 'tabs page ' + totalTabs)
      if (snap.empty) break

      const batch = db.batch()
      let batchSize = 0

      for (const docSnap of snap.docs) {
        totalTabs++
        lastDoc = docSnap
        if (totalTabs <= SKIP) continue
        if (processed >= LIMIT) break
        processed++

        const data = docSnap.data()
        const updates = {}

        for (const key of FIELDS_TO_REMOVE) {
          if (data[key] !== undefined) {
            updates[key] = FieldValue.delete()
            fieldsDeleted++
          }
        }

        if (SET_ARTISTS) {
          if (hasCanonicalArtists(data)) {
            if (!data.artistIds || data.artistIds.length === 0) {
              updates.artistIds = data.artists.map(a => a.id)
              artistsSetCount++
            }
          } else {
            const derived = deriveArtists(data)
            if (derived.length > 0) {
              updates.artists = derived
              updates.artistIds = derived.map(a => a.id)
              artistsSetCount++
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = new Date().toISOString()
          batch.update(docSnap.ref, updates)
          batchSize++
          updatedCount++
          updatedTabIds.push(docSnap.id)
          if (data.artistId) affectedArtistIds.add(data.artistId)
          if (Array.isArray(data.collaboratorIds)) data.collaboratorIds.forEach(id => id && affectedArtistIds.add(id))
          const ids = updates.artistIds || data.artistIds || (data.artists || []).map(a => a.id)
          if (Array.isArray(ids)) ids.forEach(id => id && affectedArtistIds.add(id))
          if (VERBOSE) console.log('  updated tab ' + docSnap.id + ' (artistId: ' + (data.artistId || '') + ')')
        }
      }

      if (!DRY_RUN && batchSize > 0) {
        await retryQuery(() => batch.commit(), 'write batch at ' + totalTabs)
        await sleep(3000)
      }

      process.stdout.write('  Scanned: ' + totalTabs + ' | Updated: ' + updatedCount + ' | Fields deleted: ' + fieldsDeleted + ' | artists[] set: ' + artistsSetCount + '\r')
      if (snap.docs.length < 50) break
      await sleep(2000)
    }
  }

  console.log('\n\n=== Results ===')
  console.log('  Total scanned:     ' + totalTabs)
  console.log('  Tabs updated:      ' + updatedCount)
  console.log('  Field deletions:  ' + fieldsDeleted)
  console.log('  artists[] set:    ' + artistsSetCount)

  if (updatedCount > 0) {
    const artistList = [...affectedArtistIds]
    const showTabs = 20
    const showArtists = 20
    console.log('\n--- Updated tab IDs (first ' + showTabs + ') ---')
    console.log('  ' + updatedTabIds.slice(0, showTabs).join(', ') + (updatedTabIds.length > showTabs ? ' ... and ' + (updatedTabIds.length - showTabs) + ' more' : ''))
    console.log('\n--- Affected artist IDs (singers whose tabs were cleaned, first ' + showArtists + ') ---')
    console.log('  ' + artistList.slice(0, showArtists).join(', ') + (artistList.length > showArtists ? ' ... and ' + (artistList.length - showArtists) + ' more' : ''))
    if (OUT_FILE) {
      const report = { updatedTabIds, affectedArtistIds: artistList, updatedCount, affectedArtistCount: artistList.length }
      fs.writeFileSync(OUT_FILE, JSON.stringify(report, null, 2), 'utf8')
      console.log('\n  Full list written to: ' + OUT_FILE)
    }
  }

  if (DRY_RUN) {
    console.log('\n(Dry run. Use --write to apply.)')
  } else {
    console.log('\nDone. Consider rebuilding caches:')
    console.log('  - POST /api/admin/rebuild-search-cache')
    console.log('  - POST /api/admin/rebuild-home-cache')
  }
  if (processed >= LIMIT || totalTabs > processed + SKIP) {
    console.log('\nTo continue: node scripts/cleanup-tab-artist-fields.js --write --skip=' + (SKIP + processed))
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

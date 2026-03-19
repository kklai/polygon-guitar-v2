#!/usr/bin/env node
/**
 * One-time migration for the artists collection:
 * 1. Set normalizedName = nameToSlug(name) for every artist (always derived from name, lowercased).
 * 2. Remove field "region"; use only "regions" (array).
 *    - If both region and regions exist: delete region.
 *    - If only region exists: set regions = [region] (as array), delete region.
 *    - If only regions exists: leave as is.
 *
 * Usage:
 *   node scripts/migrate-artist-normalizedName-and-regions.js           # dry run
 *   node scripts/migrate-artist-normalizedName-and-regions.js --write   # write changes
 */

const admin = require('firebase-admin')
const path = require('path')

if (!admin.apps.length) {
  const serviceAccount = require(path.resolve(__dirname, '../polygon-guitar-v2-firebase-adminsdk-fbsvc-1d54646e39.json'))
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
}

const db = admin.firestore()
const DRY_RUN = !process.argv.includes('--write')

/** Same as lib/tabs.js nameToSlug (lowercased slug from name) */
function nameToSlug(name) {
  if (!name || typeof name !== 'string') return ''
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

async function main() {
  console.log(`\n=== Migrate artists: normalizedName from name + region → regions ${DRY_RUN ? '(DRY RUN)' : '(WRITING)'} ===\n`)

  const snapshot = await db.collection('artists').get()
  let normalizedCount = 0
  let regionsCount = 0

  for (const docSnap of snapshot.docs) {
    const id = docSnap.id
    const data = docSnap.data()
    const updates = {}
    let changed = false

    // 1. normalizedName = nameToSlug(name)
    const name = data.name
    const expectedSlug = name ? nameToSlug(name) : ''
    const currentSlug = data.normalizedName
    if (expectedSlug && currentSlug !== expectedSlug) {
      updates.normalizedName = expectedSlug
      changed = true
      normalizedCount++
      if (DRY_RUN) console.log(`  [${id}] normalizedName: "${currentSlug || '(empty)'}" → "${expectedSlug}"`)
    }

    // 2. region → regions
    const hasRegion = data.region !== undefined && data.region !== null
    const hasRegions = Array.isArray(data.regions) || (data.regions !== undefined && data.regions !== null)

    if (hasRegion && hasRegions) {
      updates.region = admin.firestore.FieldValue.delete()
      changed = true
      regionsCount++
      if (DRY_RUN) console.log(`  [${id}] remove region (keep regions)`)
    } else if (hasRegion && !hasRegions) {
      const arr = Array.isArray(data.region) ? data.region : [data.region].filter(Boolean)
      updates.regions = arr
      updates.region = admin.firestore.FieldValue.delete()
      changed = true
      regionsCount++
      if (DRY_RUN) console.log(`  [${id}] region → regions: ${JSON.stringify(arr)}`)
    }

    if (!DRY_RUN && changed && Object.keys(updates).length > 0) {
      await db.collection('artists').doc(id).update(updates)
    }
  }

  console.log(`\nDone. Artists with normalizedName updated: ${normalizedCount}, with region→regions: ${regionsCount}`)
  if (DRY_RUN && (normalizedCount > 0 || regionsCount > 0)) {
    console.log('Run with --write to apply changes.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

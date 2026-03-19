#!/usr/bin/env node
/**
 * Delete Firestore users (collection `users`) whose penName exactly matches one of the listed names.
 * These are typically placeholder/duplicate pen-name accounts, not Firebase Auth accounts.
 *
 * Usage: node scripts/delete-users-by-pen-names.js [--dry-run]
 *   --dry-run  List matching users only, do not delete.
 */

const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
require('dotenv').config({ path: '.env.local' })

const path = require('path')
const rootDir = path.resolve(__dirname, '..')
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT
const fullPath = path.resolve(rootDir, serviceAccountPath || '')

const dryRun = process.argv.includes('--dry-run')

// Pen names to delete (exact match; one per line from user list, trimmed)
const PEN_NAMES_TO_DELETE = [
  'Alienzlo Bert and Kermit Tam',
  'AndyChan/TonyMak',
  'anthelion',
  'Anthelion',
  'Bobby / Kermit Tam',
  'Cheungdash',
  'Chord_Log',
  'Dash Cheung',
  'DashCheung',
  'DashCheung and Kermit Tam',
  'David Wong / Kermit Tam',
  'DAVIDS WONG',
  'Davids Wong / Kermit Tam',
  'Day Day Guitar',
  'FelixTom',
  'Giles',
  'GioGiostar',
  'HinryLau',
  'Kermit',
  'Kermit Tam / 李重光',
  'Kermit Tam A E',
  'Kermit Tam C Am',
  'Kermit Tam G Em C D',
  'Kermit Tam/ 鴨仔',
  'Kermit Tam/Davids Wong',
  'Kermit Tam/鴨仔',
  'Kermit Translated By Karl Kwok',
  'Kermit X Karson',
  'Lady_喳咋',
  'Lee Chong Kwon',
  'N icki Ng',
  'Nicki N g',
  'Nicki Ng Em C',
  'NickiNg',
  'PeterLee',
  'poorjaso n',
  'PoorJason',
  'poorjason C G F G',
  'Remmus_853',
  'Rhodrhi',
  'Sharon tse',
  'Showroom',
  'Showroom Chan',
  'Summer',
  'Tony Mak',
  'Tony Mak / Andy Chan',
  'Tony Mark',
  'Tony Tse',
  'Unknown',
  'WChi kit',
  'Zeta',
  '匿名',
  '周鍚漢   監製',
  '太極       Key',
  '張家誠   監製',
  '強BB',
  '盧凱彤',
  '秋笙 s',
  '謝國維    　監製',
  '賴映彤',
  '賴映彤      監製',
  '鴨',
  '鴨 仔',
  '鴨仔/Sunny Lee',
].map(s => s.trim()).filter(Boolean)

if (!serviceAccountPath || !require('fs').existsSync(fullPath)) {
  console.error('Need FIREBASE_SERVICE_ACCOUNT in .env.local pointing to service account JSON')
  process.exit(1)
}

const serviceAccount = require(fullPath)
const app = initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore(app)

async function main() {
  console.log(`Pen names to match: ${PEN_NAMES_TO_DELETE.length}\n`)
  if (dryRun) console.log('🔸 dry-run: will not delete\n')

  const toDelete = []
  for (const penName of PEN_NAMES_TO_DELETE) {
    const snap = await db.collection('users').where('penName', '==', penName).get()
    snap.docs.forEach(d => {
      toDelete.push({ id: d.id, penName, ...d.data() })
    })
  }

  if (toDelete.length === 0) {
    console.log('No users found with these pen names.')
    process.exit(0)
  }

  console.log(`Found ${toDelete.length} user(s) to delete:\n`)
  toDelete.forEach(u => {
    console.log(`  ${u.id}  penName="${u.penName}"  email=${u.email || '(none)'}`)
  })

  if (!dryRun && toDelete.length > 0) {
    console.log('\nDeleting...')
    const BATCH_SIZE = 500
    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
      const chunk = toDelete.slice(i, i + BATCH_SIZE)
      const batch = db.batch()
      chunk.forEach(u => batch.delete(db.collection('users').doc(u.id)))
      await batch.commit()
    }
    console.log(`Deleted ${toDelete.length} user document(s).`)
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

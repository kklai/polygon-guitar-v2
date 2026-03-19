#!/usr/bin/env node
/**
 * Export the entire artists collection from Firestore to a single JSON file.
 * Uses startAfter() + limit() pagination to avoid loading everything into memory.
 *
 * Usage:
 *   node scripts/export-artists-json.js                    # output: artists-export.json
 *   node scripts/export-artists-json.js --output=backup.json
 *   node scripts/export-artists-json.js --limit=200       # page size (default 200)
 */

const admin = require('firebase-admin')
const path = require('path')
const fs = require('fs')

if (!admin.apps.length) {
  const keyPath = path.resolve(__dirname, '../polygon-guitar-v2-firebase-adminsdk-fbsvc-1d54646e39.json')
  if (!fs.existsSync(keyPath)) {
    console.error('Firebase Admin key not found:', keyPath)
    console.error('Alternatively set GOOGLE_APPLICATION_CREDENTIALS')
    process.exit(1)
  }
  const serviceAccount = require(keyPath)
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
}

const db = admin.firestore()

const args = process.argv.slice(2)
const OUTPUT = (() => {
  const a = args.find(x => x.startsWith('--output='))
  return a ? a.split('=')[1].trim() : 'artists-export.json'
})()
const PAGE_SIZE = (() => {
  const a = args.find(x => x.startsWith('--limit='))
  return a ? Math.max(1, parseInt(a.split('=')[1], 10)) : 200
})()

/** Convert Firestore Timestamp (and other non-JSON types) to JSON-serializable form */
function toPlainValue (value) {
  if (value == null) return value
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString()
  if (value && typeof value.toMillis === 'function') return value.toMillis()
  if (Array.isArray(value)) return value.map(toPlainValue)
  if (typeof value === 'object' && value.constructor?.name === 'Timestamp') {
    return value.toDate ? value.toDate().toISOString() : value.toMillis()
  }
  if (typeof value === 'object') {
    const out = {}
    for (const k of Object.keys(value)) out[k] = toPlainValue(value[k])
    return out
  }
  return value
}

function sleep (ms) { return new Promise(r => setTimeout(r, ms)) }

async function main () {
  const outPath = path.isAbsolute(OUTPUT) ? OUTPUT : path.resolve(process.cwd(), OUTPUT)
  console.log('Exporting artists to', outPath)
  console.log('Page size:', PAGE_SIZE)
  console.log('')

  const stream = fs.createWriteStream(outPath, { encoding: 'utf8', flags: 'w' })

  const write = (chunk) => new Promise((resolve, reject) => {
    stream.write(chunk, err => (err ? reject(err) : resolve()))
  })

  await write('{"artists":[\n')

  let lastDoc = null
  let total = 0
  let first = true

  while (true) {
    let q = db.collection('artists').orderBy('__name__').limit(PAGE_SIZE)
    if (lastDoc) q = q.startAfter(lastDoc)

    const snap = await q.get()
    if (snap.empty) break

    for (const doc of snap.docs) {
      lastDoc = doc
      const data = doc.data()
      const row = { id: doc.id, ...toPlainValue(data) }
      const line = (first ? '' : ',\n') + JSON.stringify(row)
      await write(line)
      first = false
      total++
    }

    process.stdout.write(`  ${total} artists written\r`)
    if (snap.docs.length < PAGE_SIZE) break
    await sleep(100)
  }

  await write('\n],"meta":{"exportedAt":"' + new Date().toISOString() + '","count":' + total + '}}\n')
  stream.end()

  await new Promise((resolve, reject) => stream.on('finish', resolve).on('error', reject))

  console.log('\nDone. Total artists:', total)
  console.log('File:', outPath)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

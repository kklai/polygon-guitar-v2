#!/usr/bin/env node
/**
 * Check a tab's artistId and why it might not show on the artist page.
 * Usage: node scripts/check-tab-artist-id.js <tabId>
 * Example: node scripts/check-tab-artist-id.js G5IIyUTQTq3Qu2OZavLE
 */

const admin = require('firebase-admin')
const path = require('path')

const tabId = process.argv[2] || 'G5IIyUTQTq3Qu2OZavLE'
if (!tabId) {
  console.error('Usage: node scripts/check-tab-artist-id.js <tabId>')
  process.exit(1)
}

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

async function main() {
  console.log('\n=== Tab artistId check ===')
  console.log('Tab ID:', tabId)
  console.log('')

  const tabRef = db.collection('tabs').doc(tabId)
  const tabSnap = await tabRef.get()
  if (!tabSnap.exists) {
    console.log('Tab not found.')
    process.exit(1)
  }

  const tab = tabSnap.data()
  const artistId = tab.artistId || '(missing)'
  const artistName = tab.artist || tab.artistName || '(missing)'

  console.log('Tab fields:')
  console.log('  title:      ', tab.title)
  console.log('  artistId:   ', artistId)
  console.log('  artist:     ', tab.artist ?? '(not set)')
  console.log('  artistName: ', tab.artistName ?? '(not set)')
  console.log('  collaboratorIds:', tab.collaboratorIds ?? [])
  console.log('')

  if (!tab.artistId) {
    console.log('Reason not on artist page: tab has no artistId.')
    process.exit(0)
  }

  // Artist page uses getTabsByArtist(artistData.name, artistData.normalizedName || artistId)
  // and queries where('artistId', '==', artistId) — so tab.artistId must equal the artist doc id.
  const artistRef = db.collection('artists').doc(artistId)
  let artistSnap = await artistRef.get()
  const tryLower = artistId !== artistId.toLowerCase() && !artistSnap.exists
  if (tryLower) {
    artistSnap = await db.collection('artists').doc(artistId.toLowerCase()).get()
  }

  if (!artistSnap.exists) {
    console.log('Artist doc: NOT FOUND')
    console.log('  Looked up: artists/' + artistId + (tryLower ? ', artists/' + artistId.toLowerCase() : ''))
    console.log('')
    console.log('Reason not on artist page: no artist document with id matching tab.artistId.')
    console.log('  Fix: create an artist with doc id "' + artistId + '" or update this tab\'s artistId to an existing artist doc id.')
    process.exit(0)
  }

  const artistData = artistSnap.data()
  const artistDocId = artistSnap.id
  console.log('Artist doc: FOUND')
  console.log('  doc id:    ', artistDocId)
  console.log('  name:     ', artistData.name)
  console.log('  normalizedName:', artistData.normalizedName ?? '(not set)')
  console.log('')

  const queryId = artistData.normalizedName || artistDocId
  const match = tab.artistId === queryId || tab.artistId === artistDocId
  if (!match) {
    console.log('Reason not on artist page: artistId MISMATCH.')
    console.log('  Artist page queries: artistId == "' + queryId + '" (normalizedName or doc id)')
    console.log('  This tab has:        artistId == "' + tab.artistId + '"')
    console.log('  Firestore equality is case-sensitive, so they must match exactly.')
    console.log('')
    console.log('  Fix: set this tab\'s artistId to "' + artistDocId + '" (e.g. via normalize-artist-ids --write or edit in admin).')
  } else {
    console.log('Tab artistId matches artist doc id / normalizedName. It should appear on the artist page.')
    console.log('  If it still does not: clear artist page cache (edit artist → 清除歌手頁快取) or wait for cache to expire.')
  }
  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

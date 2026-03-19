#!/usr/bin/env node
/**
 * Read tabs.json and write a new JSON file with content and media/metadata fields removed.
 *
 * Stripped: content, album, albumImage, artists, spotify*, youtubeVideoId,
 * originalKey, capo, playKey, likes, likedBy, duration
 *
 * Usage:
 *   node scripts/strip-content-from-tabs-json.js
 *   node scripts/strip-content-from-tabs-json.js --input=tabs.json --output=tabs-no-content.json
 */

const fs = require('fs')
const path = require('path')

const FIELDS_TO_STRIP = [
  'album',
  'albumImage',
  'artists',
  'artistBio',
  'artistBirthYear',
  'artistDebutYear',
  'averageRating',
  'bpm',
  'capo',
  'content',
  'displayFont',
  'duration',
  'fingeringTips',
  'gpSegments',
  'gpTheme',
  'inputFont',
  'isReviewed',
  'likedBy',
  'likes',
  'musicbrainzId',
  'musicbrainzRecordingId',
  'musicbrainzYear',
  'originalKey',
  'playKey',
  'playlistCount',
  'ratingCount',
  'region',
  'remark',
  'reviewedAt',
  'source',
  'spotifyAlbumId',
  'spotifyArtistId',
  'spotifyTrackId',
  'spotifyFilledAlbum',
  'spotifyFilledSongYear',
  'spotifyTrackId',
  'spotifyUrl',
  'spotifyYear',
  'strummingPattern',
  'tags',
  'totalRating',
  'yearSource',
  'youtubeChannelTitle',
  'youtubeVideoId',
  'youtubeVideoTitle',
]

const args = process.argv.slice(2)
const INPUT = (() => {
  const a = args.find(x => x.startsWith('--input='))
  return a ? a.split('=')[1].trim() : 'tabs.json'
})()
const OUTPUT = (() => {
  const a = args.find(x => x.startsWith('--output='))
  return a ? a.split('=')[1].trim() : 'tabs-no-content.json'
})()

const inputPath = path.isAbsolute(INPUT) ? INPUT : path.resolve(process.cwd(), INPUT)
const outputPath = path.isAbsolute(OUTPUT) ? OUTPUT : path.resolve(process.cwd(), OUTPUT)

if (!fs.existsSync(inputPath)) {
  console.error('Input file not found:', inputPath)
  process.exit(1)
}

console.log('Reading', inputPath)
const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'))

if (data.tabs && Array.isArray(data.tabs)) {
  data.tabs.forEach(tab => {
    FIELDS_TO_STRIP.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(tab, field)) {
        delete tab[field]
      }
    })
    // Spread artistIds array into artistId1, artistId2, ...
    if (Array.isArray(tab.artistIds) && tab.artistIds.length > 0) {
      tab.artistIds.forEach((id, i) => {
        tab[`artistId${i + 1}`] = id
      })
      delete tab.artistIds
    }
  })
  console.log('Stripped', FIELDS_TO_STRIP.join(', '), 'from', data.tabs.length, 'tabs')
  console.log('Spread artistIds -> artistId1, artistId2, ...')
}

console.log('Writing', outputPath)
fs.writeFileSync(outputPath, JSON.stringify(data), 'utf8')
console.log('Done.')

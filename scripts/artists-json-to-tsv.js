#!/usr/bin/env node
/**
 * Convert artists JSON to TSV. Spreads regions array into region1, region2, etc.
 *
 * Usage:
 *   node scripts/artists-json-to-tsv.js --input=artists-back.json
 *   node scripts/artists-json-to-tsv.js --input=artists-export.json --output=artists.tsv
 */

const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const INPUT = (() => {
  const a = args.find(x => x.startsWith('--input='))
  return a ? a.split('=')[1].trim() : 'artists-back.json'
})()
const OUTPUT = (() => {
  const a = args.find(x => x.startsWith('--output='))
  if (a) return a.split('=')[1].trim()
  const base = path.basename(INPUT, path.extname(INPUT))
  return base + '.tsv'
})()

const inputPath = path.isAbsolute(INPUT) ? INPUT : path.resolve(process.cwd(), INPUT)
const outputPath = path.isAbsolute(OUTPUT) ? OUTPUT : path.resolve(process.cwd(), OUTPUT)

if (!fs.existsSync(inputPath)) {
  console.error('Input file not found:', inputPath)
  process.exit(1)
}

function escapeTSV (val) {
  if (val == null) return ''
  const s = typeof val === 'object' ? JSON.stringify(val) : String(val)
  if (s.includes('\t') || s.includes('\n') || s.includes('\r') || s.includes('"')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const artists = data.artists || []

artists.forEach(artist => {
  if (Array.isArray(artist.regions) && artist.regions.length > 0) {
    artist.regions.forEach((r, i) => {
      artist[`region${i + 1}`] = r
    })
    delete artist.regions
  }
})

const allKeys = new Set()
artists.forEach(a => Object.keys(a).forEach(k => allKeys.add(k)))
const headers = [...allKeys].sort()

const headerRow = headers.join('\t')
const dataRows = artists.map(a => headers.map(h => escapeTSV(a[h])).join('\t'))

const tsv = [headerRow, ...dataRows].join('\n')
fs.writeFileSync(outputPath, tsv, 'utf8')

console.log('Wrote', outputPath, '(', artists.length, 'rows,', headers.length, 'columns )')

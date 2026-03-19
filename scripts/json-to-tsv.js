#!/usr/bin/env node
/**
 * Convert tabs JSON (e.g. tabs-no-content.json) to TSV.
 * Uses first-level keys as columns; collects all unique keys across tabs for header.
 *
 * Usage:
 *   node scripts/json-to-tsv.js
 *   node scripts/json-to-tsv.js --input=tabs-no-content.json --output=tabs-no-content.tsv
 */

const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const INPUT = (() => {
  const a = args.find(x => x.startsWith('--input='))
  return a ? a.split('=')[1].trim() : 'tabs-no-content.json'
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
const tabs = data.tabs || []

const allKeys = new Set()
tabs.forEach(tab => Object.keys(tab).forEach(k => allKeys.add(k)))
const headers = [...allKeys].sort()

const headerRow = headers.join('\t')
const dataRows = tabs.map(tab => {
  return headers.map(h => escapeTSV(tab[h])).join('\t')
})

const tsv = [headerRow, ...dataRows].join('\n')
fs.writeFileSync(outputPath, tsv, 'utf8')

console.log('Wrote', outputPath, '(', tabs.length, 'rows,', headers.length, 'columns )')

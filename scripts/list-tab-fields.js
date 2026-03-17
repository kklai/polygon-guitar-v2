#!/usr/bin/env node
/**
 * List every unique field name that appears in tabs from tabs.json
 *
 * Usage: node scripts/list-tab-fields.js [--input=tabs.json]
 */

const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const INPUT = (() => {
  const a = args.find(x => x.startsWith('--input='))
  return a ? a.split('=')[1].trim() : 'tabs.json'
})()

const inputPath = path.isAbsolute(INPUT) ? INPUT : path.resolve(process.cwd(), INPUT)

if (!fs.existsSync(inputPath)) {
  console.error('Input file not found:', inputPath)
  process.exit(1)
}

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const tabs = data.tabs || []

const fields = new Set()
tabs.forEach(tab => {
  Object.keys(tab).forEach(k => fields.add(k))
})

const sorted = [...fields].sort()
console.log('Unique fields (' + sorted.length + '):\n')
sorted.forEach(f => console.log(f))

#!/usr/bin/env node
/**
 * 將 arrangedBy 統一寫入 uploaderPenName（出譜者名稱一律用 uploaderPenName）
 * - 若 uploaderPenName 為空但有 arrangedBy：寫入 uploaderPenName = arrangedBy
 * - 若兩者皆空：寫入 uploaderPenName = '結他友'
 *
 * 用法：node scripts/backfill-uploader-pen-name.js [--dry-run] [--limit=N]
 */

const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
require('dotenv').config({ path: '.env.local' })

const path = require('path')
const fs = require('fs')
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT
const rootDir = path.resolve(__dirname, '..')
const fullPath = path.resolve(rootDir, serviceAccountPath)

const dryRun = process.argv.includes('--dry-run')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null

if (!serviceAccountPath) {
  console.error('需要 FIREBASE_SERVICE_ACCOUNT 環境變數')
  process.exit(1)
}

const serviceAccount = require(fullPath)
const app = initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore(app)

async function main() {
  console.log('📋 查詢 uploaderPenName 為空的樂譜（有 arrangedBy 則用其值，否則填「結他友」）...\n')
  if (dryRun) console.log('🔸 dry-run 模式，不會寫入\n')

  const snapshot = await db.collection('tabs').get()
  const toUpdate = []
  const uniqueNames = new Set()
  for (const doc of snapshot.docs) {
    const d = doc.data()
    const up = (d.uploaderPenName || '').trim()
    const ab = (d.arrangedBy || '').trim()
    const effective = up || ab || '結他友'
    uniqueNames.add(effective)
    if (!up) {
      const value = ab || '結他友'
      toUpdate.push({ id: doc.id, title: d.title, artist: d.artist, uploaderPenName: value })
    }
  }

  const namesArray = [...uniqueNames].filter(Boolean).sort()
  const outputPath = path.join(__dirname, 'uploader-pen-names.json')
  fs.writeFileSync(outputPath, JSON.stringify(namesArray, null, 2), 'utf8')
  console.log(`📁 已寫入 ${namesArray.length} 個不重複出譜者名稱 → ${outputPath}\n`)

  const capped = limit ? toUpdate.slice(0, limit) : toUpdate
  console.log(`找到 ${toUpdate.length} 份需寫入 uploaderPenName${limit ? `，本次處理 ${capped.length} 份` : ''}\n`)

  for (const item of capped) {
    if (dryRun) {
      console.log(`[dry-run] ${item.id} "${item.title}" | ${item.artist} → uploaderPenName: "${item.uploaderPenName}"`)
      continue
    }
    await db.collection('tabs').doc(item.id).update({
      uploaderPenName: item.uploaderPenName,
      updatedAt: new Date().toISOString()
    })
    console.log(`✓ ${item.id} "${item.title}" → uploaderPenName: "${item.uploaderPenName}"`)
  }

  console.log(`\n✅ 完成${dryRun ? ' (dry-run)' : ''}，已更新 ${dryRun ? 0 : capped.length} 份`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

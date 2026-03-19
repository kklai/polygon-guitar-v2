#!/usr/bin/env node
/**
 * 1. 讀取 Firestore "users" 集合，收集所有現有 penName
 * 2. 讀取 scripts/uploader-pen-names.json（樂譜出譜者名稱列表）
 * 3. 若某名稱在 users 中沒有對應的 penName，則建立一個新 user doc（placeholder，無 Firebase Auth）
 *
 * 新 user 的 doc id 為 "pen-" + MD5(penName) 前 20 字，避免重複；欄位：penName, displayName, isPlaceholder: true, createdAt, updatedAt
 *
 * 用法：node scripts/create-users-from-pen-names.js [--dry-run]
 */

const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
require('dotenv').config({ path: '.env.local' })

const rootDir = path.resolve(__dirname, '..')
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT
const fullPath = path.resolve(rootDir, serviceAccountPath || '')

const dryRun = process.argv.includes('--dry-run')

if (!serviceAccountPath) {
  console.error('需要 FIREBASE_SERVICE_ACCOUNT 環境變數（.env.local）')
  process.exit(1)
}

const serviceAccount = require(fullPath)
const app = initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore(app)

function stableId(penName) {
  const hash = crypto.createHash('md5').update(penName.trim(), 'utf8').digest('hex').slice(0, 20)
  return `pen-${hash}`
}

async function main() {
  console.log('📋 讀取 Firestore users 集合...\n')
  if (dryRun) console.log('🔸 dry-run 模式，不會寫入\n')

  const usersSnap = await db.collection('users').get()
  const existingPenNames = new Set()
  const existingIds = new Set()
  usersSnap.docs.forEach(doc => {
    const d = doc.data()
    const p = (d.penName || '').trim()
    if (p) existingPenNames.add(p)
    existingIds.add(doc.id)
  })
  console.log(`現有 users 數量: ${usersSnap.size}，不重複 penName: ${existingPenNames.size}\n`)

  const jsonPath = path.join(__dirname, 'uploader-pen-names.json')
  if (!fs.existsSync(jsonPath)) {
    console.error(`找不到 ${jsonPath}，請先執行 backfill-uploader-pen-name.js 生成該檔案。`)
    process.exit(1)
  }
  const penNamesFromTabs = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  if (!Array.isArray(penNamesFromTabs)) {
    console.error('uploader-pen-names.json 應為 JSON array')
    process.exit(1)
  }
  console.log(`uploader-pen-names.json 內名稱數量: ${penNamesFromTabs.length}\n`)

  const toCreate = []
  for (const name of penNamesFromTabs) {
    const trimmed = (name || '').trim()
    if (!trimmed) continue
    if (existingPenNames.has(trimmed)) continue
    const id = stableId(trimmed)
    if (existingIds.has(id)) continue
    toCreate.push({ id, penName: trimmed })
  }

  console.log(`需新建的 user（penName 在 users 中無匹配）: ${toCreate.length}\n`)

  const created = []
  for (const u of toCreate) {
    if (dryRun) {
      console.log(`[dry-run] 會建立 user id=${u.id} penName="${u.penName}"`)
      continue
    }
    await db.collection('users').doc(u.id).set({
      penName: u.penName,
      displayName: u.penName,
      isPlaceholder: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    created.push({ id: u.id, penName: u.penName })
    console.log(`✓ 建立 user id=${u.id} penName="${u.penName}"`)
  }

  if (created.length > 0) {
    const outPath = path.join(__dirname, 'created-pen-name-users.json')
    const payload = created.sort((a, b) => (a.penName || '').localeCompare(b.penName || ''))
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8')
    console.log(`\n📁 已寫入 ${created.length} 個新建出譜者 → ${outPath}`)
  }

  console.log(`\n✅ 完成${dryRun ? ' (dry-run)' : ''}，已建立 ${dryRun ? 0 : toCreate.length} 個 user`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

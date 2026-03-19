/**
 * 搵出 slug（normalizedName / doc id）同「由歌手名計出嚟嘅 slug」唔一致嘅歌手
 * 規則：nameToSlug(name) 應該等於而家嘅 URL id（normalizedName || doc id）
 *
 * 用法：node scripts/find-artists-slug-mismatch.js
 * 需要 .env.local 有 Firebase 配置
 */

require('dotenv').config({ path: '.env.local' });
const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, collection, getDocs, query, orderBy } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

/** 同 lib/tabs.js nameToSlug 一致（一律小寫） */
function nameToSlug(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

async function main() {
  console.log('🔍 檢查邊個歌手嘅 slug 同輸入嘅歌手名唔一致...\n');
  console.log('規則：當前 slug 應該 = nameToSlug(歌手名)。已撇除只係英文大小寫唔同嘅項目。\n');

  const snapshot = await getDocs(query(collection(db, 'artists'), orderBy('name')));
  const mismatches = [];

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const name = data.name || '';
    const docId = docSnap.id;
    const currentSlug = data.normalizedName != null ? data.normalizedName : docId;
    const expectedSlug = nameToSlug(name);

    if (!expectedSlug) return; // 冇名就唔比較
    if (currentSlug === expectedSlug) return;
    // 撇除「只係英文大小寫唔同」：當小寫後相同就唔當 mismatch
    if (currentSlug.toLowerCase() === expectedSlug.toLowerCase()) return;

    mismatches.push({
      docId,
      name,
      currentSlug,
      expectedSlug,
      hasNormalizedName: data.normalizedName != null
    });
  });

  if (mismatches.length === 0) {
    console.log('✅ 全部歌手嘅 slug 都同歌手名一致。');
    process.exit(0);
    return;
  }

  console.log(`找到 ${mismatches.length} 個 slug 唔一致嘅歌手：\n`);
  console.log('='.repeat(80));

  mismatches.forEach((a, i) => {
    console.log(`\n${i + 1}. ${a.name}`);
    console.log(`   doc id:        ${a.docId}`);
    console.log(`   當前 slug:     ${a.currentSlug}`);
    console.log(`   應有 slug:     ${a.expectedSlug}`);
    console.log(`   (normalizedName 已設: ${a.hasNormalizedName ? '是' : '否'})`);
  });

  console.log('\n' + '='.repeat(80));
  console.log(`\n共 ${mismatches.length} 個。可到編輯頁改歌手名後保存，系統會自動更新 slug。`);

  // 若加 --md，輸出 Markdown 表格到 docs/slug-mismatch-artists.md
  if (process.argv.includes('--md')) {
    const fs = require('fs');
    const path = require('path');
    const outPath = path.join(__dirname, '../docs/slug-mismatch-artists.md');
    const rows = [
      '# Slug 與歌手名不一致嘅歌手',
      '',
      '規則：當前 slug 應等於 `nameToSlug(歌手名)`。已撇除只係英文大小寫唔同嘅項目。',
      '',
      '| # | 歌手名 | 當前 slug | 應有 slug |',
      '|---|--------|-----------|-----------|'
    ];
    mismatches.forEach((a, i) => {
      rows.push(`| ${i + 1} | ${a.name.replace(/\|/g, '\\|')} | ${a.currentSlug.replace(/\|/g, '\\|')} | ${a.expectedSlug.replace(/\|/g, '\\|')} |`);
    });
    rows.push('', `共 ${mismatches.length} 個。可到編輯頁改歌手名後保存，系統會自動更新 slug。`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, rows.join('\n'), 'utf8');
    console.log(`\n已寫入表格：${outPath}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

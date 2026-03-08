/**
 * 將指定填詞人（如林夕）嘅歌全部放入一個 playlist。
 *
 * 用法：
 *   node scripts/fill-playlist-by-lyricist.js 林夕 [playlistId]
 *   node scripts/fill-playlist-by-lyricist.js 林夕 wRKAo84uAbpgvdRMiiZI
 *
 * 若 Firestore 出現 Quota exceeded：
 *   1) 等配額重置（例如聽日）後執行一次：
 *      node scripts/fill-playlist-by-lyricist.js --cache-only
 *   2) 之後用快取（唔使再讀 3000+ 份譜）：
 *      node scripts/fill-playlist-by-lyricist.js 林夕 --from-cache
 *      node scripts/fill-playlist-by-lyricist.js 林夕 wRKAo84uAbpgvdRMiiZI --from-cache
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const FROM_CACHE = args.includes('--from-cache');
const CACHE_ONLY = args.includes('--cache-only');
const nonFlags = args.filter((a) => !a.startsWith('--'));
const LYRICIST_NAME = nonFlags[0] || '林夕';
const PLAYLIST_ID = nonFlags[1] || null;

const CACHE_FILE = path.join(__dirname, '.cache-tabs-lyricist.json');

// Service account：可放 scripts/firebase-service-account.json 或專案根目錄，或設 GOOGLE_APPLICATION_CREDENTIALS
const possiblePaths = [
  path.join(__dirname, 'firebase-service-account.json'),
  path.join(process.cwd(), 'firebase-service-account.json'),
  path.join(process.cwd(), 'scripts', 'firebase-service-account.json'),
  process.env.GOOGLE_APPLICATION_CREDENTIALS
].filter(Boolean).map((p) => (p ? path.resolve(p) : p));
let serviceAccountPath = possiblePaths.find((p) => p && fs.existsSync(p));
if (!serviceAccountPath && !(FROM_CACHE && !PLAYLIST_ID)) {
  console.error('❌ 找不到 Firebase service account。');
  console.error('');
  console.error('已檢查以下位置（請確認檔案存在、檔名 exactly 係 firebase-service-account.json）：');
  possiblePaths.forEach((p) => console.error('  • ' + p));
  console.error('');
  console.error('做法：從 Firebase Console 下載服務帳戶金鑰 JSON，複製到上述其中一個路徑並改名為 firebase-service-account.json');
  process.exit(1);
}

let db = null;
if (serviceAccountPath) {
  const serviceAccount = require(serviceAccountPath);
  if (admin.apps.length === 0) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  db = admin.firestore();
}

function lyricistMatches(lyricist) {
  if (!lyricist || typeof lyricist !== 'string') return false;
  const t = lyricist.trim();
  return t === LYRICIST_NAME || t.includes(LYRICIST_NAME);
}

const BATCH_SIZE = 400;
const BATCH_DELAY_MS = 300;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadFromCache() {
  if (!fs.existsSync(CACHE_FILE)) return null;
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveCache(tabs) {
  const minimal = tabs.map((t) => ({
    id: t.id,
    lyricist: t.lyricist || '',
    title: t.title || '',
    artistName: t.artistName || t.artist || ''
  }));
  fs.writeFileSync(CACHE_FILE, JSON.stringify(minimal, null, 0), 'utf8');
}

async function fetchAllTabsInBatches() {
  const all = [];
  let lastDoc = null;
  const coll = db.collection('tabs');
  let q = coll.orderBy('createdAt', 'desc').limit(BATCH_SIZE);
  while (true) {
    const snap = await q.get();
    if (snap.empty) break;
    snap.docs.forEach((d) => all.push({ id: d.id, ...d.data() }));
    if (snap.docs.length < BATCH_SIZE) break;
    lastDoc = snap.docs[snap.docs.length - 1];
    q = coll.orderBy('createdAt', 'desc').startAfter(lastDoc).limit(BATCH_SIZE);
    await sleep(BATCH_DELAY_MS);
  }
  return all;
}

async function main() {
  if (CACHE_ONLY) {
    console.log('\n📥 建立快取：分批讀取樂譜並儲存到 ' + CACHE_FILE + ' …\n');
    const all = await fetchAllTabsInBatches();
    saveCache(all);
    console.log('✅ 已儲存 ' + all.length + ' 份樂譜到快取。之後可用 --from-cache 篩選／更新歌單，唔使再讀 Firestore。\n');
    process.exit(0);
    return;
  }

  console.log(`\n🎵 填詞人：${LYRICIST_NAME}\n`);

  let all = [];
  if (FROM_CACHE) {
    const cached = loadFromCache();
    if (!cached || cached.length === 0) {
      console.error('❌ 找不到快取。請先喺配額重置後執行：');
      console.error('   node scripts/fill-playlist-by-lyricist.js --cache-only\n');
      process.exit(1);
    }
    all = cached;
    console.log('已從快取讀取 ' + all.length + ' 份樂譜。');
  } else {
    const cached = loadFromCache();
    if (cached && cached.length > 0) {
      all = cached;
      console.log('使用現有快取（' + all.length + ' 份）。要重新拉取請先刪除 ' + CACHE_FILE);
    } else {
      console.log('正在分批讀取樂譜…');
      all = await fetchAllTabsInBatches();
      console.log('已讀取 ' + all.length + ' 份，儲存快取供下次使用。');
      saveCache(all);
    }
  }

  const matched = all.filter((tab) => lyricistMatches(tab.lyricist));
  console.log('篩選填詞人「' + LYRICIST_NAME + '」：');

  console.log(`符合「${LYRICIST_NAME}」填詞嘅歌：${matched.length} 首\n`);
  if (matched.length === 0) {
    console.log('（可能資料庫未有 lyricist 欄位，或填詞名寫法唔同，可檢查樂譜編輯頁嘅「填詞」欄位）');
    process.exit(0);
    return;
  }

  matched.slice(0, 30).forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.artistName || s.artist || '?'} - ${s.title}`);
  });
  if (matched.length > 30) {
    console.log(`  ... 仲有 ${matched.length - 30} 首\n`);
  }

  if (!PLAYLIST_ID) {
    console.log('\n未提供 playlist ID，只作預覽。要寫入歌單請執行：');
    console.log(`  node scripts/fill-playlist-by-lyricist.js ${LYRICIST_NAME} <playlistId>\n`);
    process.exit(0);
    return;
  }

  if (!db) {
    console.error('\n❌ 寫入歌單需要 Firebase，請確保 firebase-service-account.json 存在。\n');
    process.exit(1);
  }

  const playlistRef = db.collection('playlists').doc(PLAYLIST_ID);
  const playlistSnap = await playlistRef.get();
  if (!playlistSnap.exists) {
    console.error(`\n❌ 歌單不存在：${PLAYLIST_ID}`);
    process.exit(1);
  }

  const songIds = matched.map((s) => s.id);
  await playlistRef.update({
    songIds,
    updatedAt: new Date().toISOString(),
  });

  console.log(`\n✅ 已將 ${songIds.length} 首歌寫入歌單 ${PLAYLIST_ID}`);
  console.log(`   預覽：${process.env.VERCEL_URL || 'https://polygon.guitars'}/playlist/${PLAYLIST_ID}\n`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});

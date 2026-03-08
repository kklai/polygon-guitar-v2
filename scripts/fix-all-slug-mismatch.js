/**
 * 一次過修正所有「slug 與歌手名唔一致」嘅歌手
 * - 更新 artist 嘅 normalizedName 為應有 slug
 * - 更新所有相關 tabs 嘅 artistId、artistSlug、artist、artistName
 *
 * 用法：
 *   node scripts/fix-all-slug-mismatch.js        # 只列出會改咩，唔寫入（用 client SDK 讀）
 *   node scripts/fix-all-slug-mismatch.js --write   # 真正寫入（要用 Admin SDK，需 .env.local 設 FIREBASE_SERVICE_ACCOUNT）
 */

require('dotenv').config({ path: '.env.local' });
const path = require('path');

// --write 時用 Admin SDK（先要有 FIREBASE_SERVICE_ACCOUNT 或 FIREBASE_ADMIN_* 環境變數）
const DRY_RUN = !process.argv.includes('--write');
let db;
let useAdmin = false;

if (DRY_RUN) {
  const { initializeApp, getApps } = require('firebase/app');
  const { getFirestore } = require('firebase/firestore');
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  };
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  db = getFirestore(app);
} else {
  useAdmin = true;
  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  if (getApps().length === 0) {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountPath) {
      const fullPath = path.resolve(__dirname, '..', serviceAccountPath);
      const serviceAccount = require(fullPath);
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
      if (privateKey && process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || 'polygon-guitar-v2',
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey
          })
        });
      } else {
        console.error('❌ --write 需要 Firebase Admin：請喺 .env.local 設 FIREBASE_SERVICE_ACCOUNT（指向 service account JSON 路徑）或 FIREBASE_ADMIN_PRIVATE_KEY + FIREBASE_ADMIN_CLIENT_EMAIL');
        process.exit(1);
      }
    }
  }
  db = getFirestore();
}

function nameToSlug(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function getMismatches() {
  let snapshot;
  if (useAdmin) {
    snapshot = await db.collection('artists').orderBy('name').get();
  } else {
    const { collection, getDocs, query, orderBy } = require('firebase/firestore');
    snapshot = await getDocs(query(collection(db, 'artists'), orderBy('name')));
  }
  const mismatches = [];
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const name = data.name || '';
    const docId = docSnap.id;
    const currentSlug = data.normalizedName != null ? data.normalizedName : docId;
    const expectedSlug = nameToSlug(name);
    if (!expectedSlug) return;
    if (currentSlug === expectedSlug) return;
    if (currentSlug.toLowerCase() === expectedSlug.toLowerCase()) return;
    mismatches.push({ docId, name, currentSlug, expectedSlug });
  });
  return mismatches;
}

async function getTabRefsForArtist(artistName, possibleOldIds) {
  const seen = new Set();
  const tabRefs = [];

  if (useAdmin) {
    for (const oldId of possibleOldIds) {
      const snap = await db.collection('tabs').where('artistId', '==', oldId).get();
      snap.docs.forEach((d) => {
        if (seen.has(d.id)) return;
        seen.add(d.id);
        tabRefs.push(d.ref);
      });
    }
    const snap2 = await db.collection('tabs').where('artist', '==', artistName).get();
    snap2.docs.forEach((d) => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      tabRefs.push(d.ref);
    });
  } else {
    const { collection, getDocs, query, where } = require('firebase/firestore');
    for (const oldId of possibleOldIds) {
      const snap = await getDocs(query(collection(db, 'tabs'), where('artistId', '==', oldId)));
      snap.docs.forEach((d) => {
        if (seen.has(d.id)) return;
        seen.add(d.id);
        tabRefs.push(d.ref);
      });
    }
    const snap2 = await getDocs(query(collection(db, 'tabs'), where('artist', '==', artistName)));
    snap2.docs.forEach((d) => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      tabRefs.push(d.ref);
    });
  }
  return tabRefs;
}

const BATCH_SIZE = 500;
/** 每個歌手處理完等幾多 ms，避免 Firestore Quota exceeded */
const DELAY_MS = 600;
/** 每批 tab 寫入後等幾多 ms */
const DELAY_BATCH_MS = 200;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(DRY_RUN ? '🔍 [Dry run] 只列出會改嘅內容，唔會寫入。加 --write 先會真正更新。\n' : '✏️ 開始修正所有 slug 唔一致嘅歌手...\n');

  let mismatches;
  try {
    mismatches = await getMismatches();
  } catch (err) {
    if (err.code === 8 || (err.details && err.details.includes('Quota exceeded'))) {
      console.log('⚠️ Firestore 讀取限額用盡，請等 1–2 分鐘再執行一次。');
    }
    throw err;
  }

  if (mismatches.length === 0) {
    console.log('✅ 冇需要修正嘅歌手。');
    process.exit(0);
    return;
  }

  console.log(`共 ${mismatches.length} 個歌手會更新。（每個歌手後會等 ${DELAY_MS}ms，避免 Quota exceeded）\n`);

  let artistsUpdated = 0;
  let tabsUpdated = 0;

  for (let i = 0; i < mismatches.length; i++) {
    const { docId, name, currentSlug, expectedSlug } = mismatches[i];
    const possibleOldIds = [docId, currentSlug, name.toLowerCase().replace(/\s+/g, '-'), name].filter(Boolean);

    let tabRefs;
    try {
      tabRefs = await getTabRefsForArtist(name, possibleOldIds);
    } catch (err) {
      if (err.code === 8 || (err.details && err.details.includes('Quota exceeded'))) {
        console.log(`   ⚠️ Quota exceeded，等 5 秒後重試...`);
        await delay(5000);
        tabRefs = await getTabRefsForArtist(name, possibleOldIds);
      } else throw err;
    }

    console.log(`${i + 1}/${mismatches.length} ${name}`);
    console.log(`   artist: normalizedName ${currentSlug} → ${expectedSlug}`);
    console.log(`   tabs: ${tabRefs.length} 首會更新 artistId/artistSlug`);

    if (!DRY_RUN) {
      try {
        await db.collection('artists').doc(docId).update({
          normalizedName: expectedSlug,
          updatedAt: new Date().toISOString()
        });
        artistsUpdated++;

        const songUpdates = {
          artist: name,
          artistName: name,
          artistId: expectedSlug,
          artistSlug: expectedSlug,
          updatedAt: new Date().toISOString()
        };

        for (let j = 0; j < tabRefs.length; j += BATCH_SIZE) {
          const batch = db.batch();
          const chunk = tabRefs.slice(j, j + BATCH_SIZE);
          chunk.forEach((ref) => batch.update(ref, songUpdates));
          await batch.commit();
          tabsUpdated += chunk.length;
          if (DELAY_BATCH_MS && j + BATCH_SIZE < tabRefs.length) await delay(DELAY_BATCH_MS);
        }
      } catch (err) {
        if (err.code === 8 || (err.details && err.details.includes('Quota exceeded'))) {
          console.log(`   ⚠️ Quota exceeded，請等 1–2 分鐘後再執行： node scripts/fix-all-slug-mismatch.js --write`);
          console.log(`   已更新 ${artistsUpdated} 個歌手、${tabsUpdated} 首歌曲。其餘可稍後再跑。`);
          process.exit(1);
        }
        throw err;
      }
      await delay(DELAY_MS);
    }
  }

  if (DRY_RUN) {
    console.log('\n' + '='.repeat(60));
    console.log('以上為預覽。要真正寫入請執行：');
    console.log('  node scripts/fix-all-slug-mismatch.js --write');
  } else {
    console.log('\n' + '='.repeat(60));
    console.log(`✅ 完成。已更新 ${artistsUpdated} 個歌手、${tabsUpdated} 首歌曲。`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

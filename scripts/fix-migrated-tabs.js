// 修復已導入但冇 artistId 嘅 tabs
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

const path = require('path');
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
const rootDir = path.resolve(__dirname, '..');
const fullPath = path.resolve(rootDir, serviceAccountPath);
const serviceAccount = require(fullPath);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

function generateArtistId(artistName) {
  if (!artistName || artistName === 'Unknown') return null;
  return artistName.toLowerCase().replace(/\s+/g, '-');
}

async function getOrCreateArtist(artistName) {
  if (!artistName || artistName === 'Unknown') return null;
  const artistId = generateArtistId(artistName);
  const artistRef = db.collection('artists').doc(artistId);
  const artistSnap = await artistRef.get();
  
  if (!artistSnap.exists) {
    await artistRef.set({
      name: artistName,
      normalizedName: artistId,
      tabCount: 0,
      createdAt: new Date().toISOString()
    });
    console.log(`🎤 創建歌手: ${artistName}`);
  }
  return artistId;
}

async function fixTabs() {
  console.log('🔧 修復沒有 artistId 的 tabs...\n');
  
  // 獲取所有沒有 artistId 的 tabs
  const snapshot = await db.collection('tabs').where('source', '==', 'blogger').get();
  
  let fixed = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.artistId && data.artist) {
      const artistId = await getOrCreateArtist(data.artist);
      
      // 更新 tab
      await doc.ref.update({
        artistId: artistId,
        likedBy: [],
        viewCount: data.views || 0
      });
      
      // 增加歌手 tabCount
      if (artistId) {
        await db.collection('artists').doc(artistId).update({
          tabCount: FieldValue.increment(1)
        });
      }
      
      console.log(`✓ 修復: ${data.artist} - ${data.title}`);
      fixed++;
    }
  }
  
  console.log(`\n✅ 修復完成！共修復 ${fixed} 首`);
}

fixTabs().catch(console.error);

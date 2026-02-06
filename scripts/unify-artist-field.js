// 統一歌手欄位名（將 artistName 轉為 artist）
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function unifyArtistField() {
  console.log('🔧 統一歌手欄位名\n');
  
  const tabs = await db.collection('tabs').get();
  let updatedCount = 0;
  
  for (const doc of tabs.docs) {
    const t = doc.data();
    
    // 如果有 artistName 但冇 artist，或者 artistName 同 artist 唔同
    if (t.artistName && !t.artist) {
      await doc.ref.update({
        artist: t.artistName,
        artistName: admin.firestore.FieldValue.delete() // 刪除舊欄位
      });
      console.log('✓ 更新: ' + t.title + ' (' + t.artistName + ')');
      updatedCount++;
    }
  }
  
  console.log('\n✅ 完成！更新咗 ' + updatedCount + ' 份譜');
}

unifyArtistField().then(() => process.exit(0));

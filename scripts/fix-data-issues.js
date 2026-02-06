// 修復數據問題：清理重複譜 + 合併歌手
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function fixData() {
  console.log('🔧 修復數據問題\n');
  
  // 1. 找出並刪除重複譜
  const tabsSnap = await db.collection('tabs').get();
  const titles = {};
  
  tabsSnap.docs.forEach(d => {
    const t = d.data();
    const key = (t.title || '') + '|' + (t.artistName || t.artist || '');
    if (!titles[key]) titles[key] = [];
    titles[key].push({ id: d.id, ref: d.ref, ...t });
  });
  
  const duplicates = Object.entries(titles).filter(([k, v]) => v.length > 1);
  let deletedCount = 0;
  
  if (duplicates.length > 0) {
    console.log('🗑️  刪除重複譜：');
    for (const [key, docs] of duplicates) {
      // 保留第一個，刪除其餘
      for (let i = 1; i < docs.length; i++) {
        await docs[i].ref.delete();
        console.log('  - 刪除：' + key.replace('|', ' - '));
        deletedCount++;
      }
    }
    console.log('  共刪除 ' + deletedCount + ' 份重複譜\n');
  }
  
  // 2. 合併鄧麗欣
  const artistsSnap = await db.collection('artists').get();
  const tangArtists = [];
  
  artistsSnap.docs.forEach(d => {
    const a = d.data();
    if (a.name && a.name.includes('鄧麗')) {
      tangArtists.push({ id: d.id, ref: d.ref, ...a });
    }
  });
  
  if (tangArtists.length > 1) {
    console.log('🎤 合併鄧麗欣：');
    // 揾有 artistType 嘅做主要
    const primary = tangArtists.find(a => a.artistType && a.artistType !== 'unknown') || tangArtists[0];
    const others = tangArtists.filter(a => a.id !== primary.id);
    
    console.log('  保留：' + primary.name + ' (ID: ' + primary.id + ')');
    
    // 更新主要歌手
    const totalTabs = tangArtists.reduce((sum, a) => sum + (a.tabCount || 0), 0);
    await primary.ref.update({
      tabCount: totalTabs,
      artistType: primary.artistType || 'female',
      updatedAt: new Date().toISOString()
    });
    
    // 更新相關歌曲
    for (const other of others) {
      const songs = await db.collection('tabs').where('artistId', '==', other.id).get();
      for (const song of songs.docs) {
        await song.ref.update({
          artistId: primary.id,
          artistName: primary.name
        });
      }
      await other.ref.delete();
      console.log('  合併：' + other.name + ' (ID: ' + other.id + ')');
    }
    console.log('');
  }
  
  console.log('✅ 修復完成！');
  
  // 顯示最終狀態
  const finalTabs = await db.collection('tabs').get();
  const finalArtists = await db.collection('artists').get();
  console.log('\n📊 最終狀態：');
  console.log('  Tabs: ' + finalTabs.size);
  console.log('  Artists: ' + finalArtists.size);
}

fixData().then(() => process.exit(0)).catch(e => {
  console.error('❌ 錯誤:', e);
  process.exit(1);
});

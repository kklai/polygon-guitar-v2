// 最終合併重複歌手
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 提取核心名
function extractCoreName(name) {
  const chineseMatch = name.match(/[\u4e00-\u9fa5]{2,}/);
  return chineseMatch ? chineseMatch[0] : name;
}

async function mergeArtists() {
  console.log('🔧 最終合併重複歌手\n');
  
  const artistsSnap = await db.collection('artists').get();
  const artists = [];
  artistsSnap.docs.forEach(d => {
    artists.push({ id: d.id, ref: d.ref, ...d.data() });
  });
  
  // 搵核心名相同嘅歌手
  const coreNameMap = {};
  artists.forEach(a => {
    const core = extractCoreName(a.name);
    if (!coreNameMap[core]) coreNameMap[core] = [];
    coreNameMap[core].push(a);
  });
  
  const duplicates = Object.entries(coreNameMap).filter(([k, v]) => v.length > 1);
  
  if (duplicates.length === 0) {
    console.log('✅ 沒有重複歌手');
    return;
  }
  
  console.log('發現 ' + duplicates.length + ' 組重複:\n');
  
  for (const [coreName, group] of duplicates) {
    console.log('處理: ' + coreName);
    
    // 揾有 artistType 嘅做主要
    const primary = group.find(a => a.artistType && a.artistType !== 'unknown') || group[0];
    const others = group.filter(a => a.id !== primary.id);
    
    console.log('  保留: ' + primary.name + ' (ID: ' + primary.id + ', type: ' + (primary.artistType || 'unknown') + ')');
    
    // 合併資料
    const totalTabs = group.reduce((sum, a) => sum + (a.tabCount || 0), 0);
    await primary.ref.update({
      tabCount: totalTabs,
      artistType: primary.artistType || 'unknown',
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
      console.log('  刪除: ' + other.name + ' (ID: ' + other.id + ')');
    }
    console.log('');
  }
  
  console.log('✅ 合併完成！');
}

mergeArtists().then(() => process.exit(0)).catch(e => {
  console.error('❌ 錯誤:', e);
  process.exit(1);
});

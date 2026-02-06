const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function checkStatus() {
  console.log('🔍 檢查數據庫狀態\n');
  
  // 檢查所有譜
  const tabsSnap = await db.collection('tabs').get();
  console.log('總共有', tabsSnap.size, '份譜');
  
  // 檢查重複（按標題+歌手）
  const titles = {};
  tabsSnap.docs.forEach(d => {
    const t = d.data();
    const key = (t.title || '') + '|' + (t.artistName || t.artist || '');
    if (!titles[key]) titles[key] = [];
    titles[key].push({ id: d.id, ...t });
  });
  
  const duplicates = Object.entries(titles).filter(([k, v]) => v.length > 1);
  if (duplicates.length > 0) {
    console.log('\n⚠️ 發現重複譜：');
    duplicates.forEach(([key, docs]) => {
      console.log('  "' + key.replace('|', '" - "') + '": ' + docs.length + '份');
    });
  }
  
  // 檢查所有歌手
  const artistsSnap = await db.collection('artists').get();
  console.log('\n總共有', artistsSnap.size, '個歌手');
  
  // 列出所有歌手
  console.log('\n🎤 歌手列表：');
  artistsSnap.docs
    .sort((a, b) => (a.data().tabCount || 0) - (b.data().tabCount || 0))
    .forEach(d => {
      const a = d.data();
      console.log('  - ' + a.name + ' (' + (a.artistType || '?') + ', ' + (a.tabCount || 0) + '譜)');
    });
  
  // 列出最新譜
  console.log('\n📋 最新10份譜：');
  const tabs = tabsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  tabs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  tabs.slice(0, 10).forEach(t => {
    console.log('  - ' + (t.artistName || t.artist || 'Unknown') + ' - ' + t.title);
  });
}

checkStatus().then(() => process.exit(0));

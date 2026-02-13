// 修復所有歌手的 tabCount/songCount，根據實際的 tabs 數量
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  updateDoc,
  writeBatch
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixAllArtistCounts() {
  console.log('=== 修復所有歌手譜數量 ===\n');
  
  // 1. 獲取所有歌手
  console.log('📋 獲取歌手列表...');
  const artistsSnap = await getDocs(collection(db, 'artists'));
  const artists = artistsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`✅ 找到 ${artists.length} 個歌手\n`);
  
  // 2. 獲取所有 tabs
  console.log('📋 獲取所有譜...');
  const tabsSnap = await getDocs(collection(db, 'tabs'));
  const tabs = tabsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`✅ 找到 ${tabs.length} 份譜\n`);
  
  // 3. 統計每個歌手的實際譜數量
  console.log('📊 統計每個歌手的實際譜數量...\n');
  
  const artistCounts = {};
  
  // 初始化
  artists.forEach(artist => {
    artistCounts[artist.id] = {
      id: artist.id,
      name: artist.name,
      count: 0
    };
  });
  
  // 統計 tabs
  tabs.forEach(tab => {
    const artistId = tab.artistId;
    if (artistId && artistCounts[artistId]) {
      artistCounts[artistId].count++;
    } else if (artistId) {
      // 如果找不到對應的歌手記錄，記錄下來
      if (!artistCounts[`__orphan_${artistId}`]) {
        artistCounts[`__orphan_${artistId}`] = {
          id: artistId,
          name: tab.artist || 'Unknown',
          count: 0,
          isOrphan: true
        };
      }
      artistCounts[`__orphan_${artistId}`].count++;
    }
  });
  
  // 4. 顯示統計結果
  console.log('📈 統計結果：\n');
  
  const updates = [];
  const orphans = [];
  
  Object.values(artistCounts).forEach(item => {
    if (item.isOrphan) {
      orphans.push(item);
      return;
    }
    
    const artist = artists.find(a => a.id === item.id);
    const currentCount = artist.songCount || artist.tabCount || 0;
    
    if (currentCount !== item.count) {
      console.log(`${item.name}`);
      console.log(`  當前數量: ${currentCount}`);
      console.log(`  實際數量: ${item.count}`);
      console.log(`  差異: ${item.count - currentCount}`);
      console.log();
      
      updates.push({
        id: item.id,
        name: item.name,
        oldCount: currentCount,
        newCount: item.count
      });
    }
  });
  
  // 顯示 orphan tabs
  if (orphans.length > 0) {
    console.log('\n⚠️ 以下 artistId 找不到對應的歌手記錄：');
    orphans.forEach(o => {
      console.log(`  - ${o.id}: ${o.count} 份譜`);
    });
    console.log();
  }
  
  console.log(`\n📊 需要更新的歌手: ${updates.length} 個\n`);
  
  if (updates.length === 0) {
    console.log('✅ 所有歌手的譜數量都正確，無需更新');
    process.exit(0);
  }
  
  // 5. 執行更新
  console.log('💾 開始更新數據庫...\n');
  
  const batch = writeBatch(db);
  let batchCount = 0;
  
  for (const update of updates) {
    const artistRef = doc(db, 'artists', update.id);
    batch.update(artistRef, {
      songCount: update.newCount,
      tabCount: update.newCount,
      updatedAt: new Date().toISOString()
    });
    
    batchCount++;
    console.log(`  ✅ ${update.name}: ${update.oldCount} → ${update.newCount}`);
    
    // Firestore batch 限制 500 個操作
    if (batchCount >= 400) {
      await batch.commit();
      console.log('\n  💾 已提交批次\n');
      batchCount = 0;
    }
  }
  
  // 提交剩餘的
  if (batchCount > 0) {
    await batch.commit();
  }
  
  console.log(`\n✅ 完成！已更新 ${updates.length} 個歌手的譜數量`);
  
  // 顯示 Top 10 歌手
  console.log('\n📈 Top 10 譜數量最多的歌手：');
  const sortedArtists = Object.values(artistCounts)
    .filter(a => !a.isOrphan)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  sortedArtists.forEach((a, i) => {
    console.log(`  ${i + 1}. ${a.name}: ${a.count} 份譜`);
  });
  
  process.exit(0);
}

fixAllArtistCounts().catch(err => {
  console.error('錯誤:', err);
  process.exit(1);
});

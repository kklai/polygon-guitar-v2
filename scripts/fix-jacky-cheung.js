// 修復張學友的譜 - 確保所有譜的 artistId 與歌手 ID 匹配
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  getDoc,
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

async function fixJackyCheung() {
  console.log('=== 修復張學友的譜 ===\n');
  
  // 1. 查找所有名字包含「張學友」的歌手記錄
  const artistsQuery = query(collection(db, 'artists'));
  const artistsSnap = await getDocs(artistsQuery);
  
  const jackyArtists = [];
  artistsSnap.docs.forEach(d => {
    const data = d.data();
    const name = data.name || '';
    if (name.includes('張學友') || name.toLowerCase().includes('jacky')) {
      jackyArtists.push({ id: d.id, ...data });
    }
  });
  
  console.log(`找到 ${jackyArtists.length} 個相關歌手記錄:`);
  jackyArtists.forEach(a => {
    console.log(`  - ID: "${a.id}", Name: "${a.name}", normalizedName: "${a.normalizedName}"`);
  });
  console.log();
  
  if (jackyArtists.length === 0) {
    console.log('❌ 找不到張學友的歌手記錄');
    process.exit(1);
  }
  
  // 選擇正確的歌手記錄（名字完全匹配「張學友」的）
  const mainArtist = jackyArtists.find(a => a.name === '張學友') || jackyArtists[0];
  console.log(`✅ 使用主歌手記錄: ID="${mainArtist.id}", Name="${mainArtist.name}"\n`);
  
  // 2. 查找所有 artist 欄位是「張學友」的譜
  const tabsQuery = query(
    collection(db, 'tabs'),
    where('artist', '==', '張學友')
  );
  const tabsSnap = await getDocs(tabsQuery);
  
  console.log(`找到 ${tabsSnap.size} 份 artist="張學友" 的譜\n`);
  
  // 3. 檢查哪些譜的 artistId 不正確
  const tabsToFix = [];
  const correctTabs = [];
  
  tabsSnap.docs.forEach(d => {
    const tab = { id: d.id, ...d.data() };
    if (tab.artistId !== mainArtist.id) {
      tabsToFix.push({
        id: tab.id,
        title: tab.title,
        currentArtistId: tab.artistId,
        correctArtistId: mainArtist.id
      });
    } else {
      correctTabs.push(tab);
    }
  });
  
  console.log('=== 分析結果 ===');
  console.log(`✅ artistId 正確的譜: ${correctTabs.length} 份`);
  console.log(`❌ artistId 需要修復的譜: ${tabsToFix.length} 份\n`);
  
  if (tabsToFix.length > 0) {
    console.log('需要修復的譜:');
    tabsToFix.forEach((tab, i) => {
      console.log(`  ${i+1}. ${tab.title}`);
      console.log(`     ID: ${tab.id}`);
      console.log(`     當前 artistId: "${tab.currentArtistId}"`);
      console.log(`     應改為: "${tab.correctArtistId}"`);
    });
    console.log();
    
    // 4. 執行修復
    console.log('正在修復...');
    const batch = writeBatch(db);
    
    for (const tab of tabsToFix) {
      const tabRef = doc(db, 'tabs', tab.id);
      batch.update(tabRef, {
        artistId: tab.correctArtistId,
        updatedAt: new Date().toISOString()
      });
      console.log(`  ✓ ${tab.title}`);
    }
    
    await batch.commit();
    console.log(`\n✅ 成功修復 ${tabsToFix.length} 份譜`);
    
    // 5. 更新歌手計數
    const correctCount = correctTabs.length + tabsToFix.length;
    const artistRef = doc(db, 'artists', mainArtist.id);
    await updateDoc(artistRef, {
      tabCount: correctCount,
      songCount: correctCount,
      updatedAt: new Date().toISOString()
    });
    console.log(`✅ 更新歌手記錄的 tabCount 為 ${correctCount}`);
    
    // 6. 刪除多餘的歌手記錄（如果有的話）
    const artistsToDelete = jackyArtists.filter(a => a.id !== mainArtist.id);
    if (artistsToDelete.length > 0) {
      console.log(`\n發現 ${artistsToDelete.length} 個重複歌手記錄需要清理:`);
      for (const artist of artistsToDelete) {
        console.log(`  - ${artist.name} (ID: ${artist.id})`);
        // 注意：這裡只是標記，實際刪除需要謹慎操作
      }
      console.log('請在後台手動刪除這些重複記錄');
    }
  } else {
    console.log('✅ 所有譜的 artistId 都已正確，無需修復');
  }
  
  console.log('\n=== 修復完成 ===');
  process.exit(0);
}

fixJackyCheung().catch(err => {
  console.error('錯誤:', err);
  process.exit(1);
});

// 檢查張學友的譜
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  getDoc
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

async function checkJackyCheung() {
  console.log('=== 檢查張學友的譜 ===\n');
  
  // 1. 查找張學友的歌手記錄
  const artistQuery = query(
    collection(db, 'artists'),
    where('name', '==', '張學友')
  );
  const artistSnap = await getDocs(artistQuery);
  
  if (artistSnap.empty) {
    console.log('❌ 找不到「張學友」的歌手記錄');
    
    // 嘗試用部分匹配查找
    const allArtistsQuery = query(collection(db, 'artists'));
    const allArtistsSnap = await getDocs(allArtistsQuery);
    const possibleMatches = allArtistsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(a => a.name && (a.name.includes('學友') || a.name.includes('Jacky')));
    
    if (possibleMatches.length > 0) {
      console.log('\n可能匹配的歌手：');
      possibleMatches.forEach(a => {
        console.log(`  - ID: ${a.id}, Name: ${a.name}`);
      });
    }
  } else {
    const artist = { id: artistSnap.docs[0].id, ...artistSnap.docs[0].data() };
    console.log('✅ 找到歌手記錄：');
    console.log(`   ID: ${artist.id}`);
    console.log(`   Name: ${artist.name}`);
    console.log(`   normalizedName: ${artist.normalizedName}`);
    console.log(`   tabCount: ${artist.tabCount || 0}`);
    console.log();
    
    // 2. 用 artistId 查詢譜
    const tabsByIdQuery = query(
      collection(db, 'tabs'),
      where('artistId', '==', artist.id)
    );
    const tabsByIdSnap = await getDocs(tabsByIdQuery);
    console.log(`📊 用 artistId="${artist.id}" 查到: ${tabsByIdSnap.size} 份譜`);
    
    // 3. 用 artist 名稱查詢譜
    const tabsByNameQuery = query(
      collection(db, 'tabs'),
      where('artist', '==', '張學友')
    );
    const tabsByNameSnap = await getDocs(tabsByNameQuery);
    console.log(`📊 用 artist="張學友" 查到: ${tabsByNameSnap.size} 份譜`);
    
    // 4. 列出所有找到的譜
    console.log('\n=== 譜列表 ===');
    const allTabs = [];
    const seenIds = new Set();
    
    tabsByIdSnap.docs.forEach(d => {
      if (!seenIds.has(d.id)) {
        seenIds.add(d.id);
        allTabs.push({ id: d.id, ...d.data(), foundBy: 'artistId' });
      }
    });
    
    tabsByNameSnap.docs.forEach(d => {
      if (!seenIds.has(d.id)) {
        seenIds.add(d.id);
        allTabs.push({ id: d.id, ...d.data(), foundBy: 'artist' });
      }
    });
    
    allTabs.forEach((tab, i) => {
      console.log(`${i+1}. ${tab.title}`);
      console.log(`   ID: ${tab.id}`);
      console.log(`   artistId: ${tab.artistId}`);
      console.log(`   artist: ${tab.artist}`);
      console.log(`   找到方式: ${tab.foundBy}`);
      console.log();
    });
    
    // 5. 檢查是否有 artistId 不匹配的譜
    const mismatchedTabs = allTabs.filter(t => t.artistId !== artist.id);
    if (mismatchedTabs.length > 0) {
      console.log('\n⚠️ 注意: 以下譜的 artistId 與歌手 ID 不匹配:');
      mismatchedTabs.forEach(t => {
        console.log(`   - ${t.title}: artistId="${t.artistId}" (應該是 "${artist.id}")`);
      });
    }
  }
  
  process.exit(0);
}

checkJackyCheung().catch(err => {
  console.error('錯誤:', err);
  process.exit(1);
});

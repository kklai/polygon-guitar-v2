// 修復新青年理髮廳被標記為 UNKNOWN 的問題
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  where,
  updateDoc,
  doc,
  setDoc,
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

async function fixNewYouthBarber() {
  console.log('🔍 查找「新青年理髮廳」相關歌曲...\n');
  
  // 1. 查找所有可能包含「新青年」或「理髮廳」的歌曲
  const tabsSnapshot = await getDocs(collection(db, 'tabs'));
  const matchingTabs = [];
  
  tabsSnapshot.forEach(docSnap => {
    const data = docSnap.data();
    const title = (data.title || '').toLowerCase();
    const artist = (data.artist || '').toLowerCase();
    const searchText = `${title} ${artist}`;
    
    // 匹配「新青年理髮廳」的各種變體
    if (searchText.includes('新青年') || 
        searchText.includes('理髮廳') ||
        searchText.includes('新青年理髮')) {
      matchingTabs.push({
        id: docSnap.id,
        title: data.title,
        artist: data.artist,
        artistId: data.artistId,
        originalKey: data.originalKey
      });
    }
  });
  
  console.log(`找到 ${matchingTabs.length} 首相關歌曲：\n`);
  matchingTabs.forEach((tab, i) => {
    console.log(`${i + 1}. ${tab.title}`);
    console.log(`   歌手欄位: ${tab.artist}`);
    console.log(`   artistId: ${tab.artistId}`);
    console.log(`   ID: ${tab.id}\n`);
  });
  
  // 2. 檢查是否已有「新青年理髮廳」歌手
  const artistId = 'new-youth-barber';  // 標準化 ID
  const artistRef = doc(db, 'artists', artistId);
  const artistSnap = await getDoc(artistRef);
  
  if (!artistSnap.exists()) {
    console.log('⚠️ 歌手「新青年理髮廳」不存在，創建中...');
    
    await setDoc(artistRef, {
      name: '新青年理髮廳',
      normalizedName: artistId,
      slug: artistId,
      artistType: 'group',
      gender: 'group',
      songCount: matchingTabs.length,
      tabCount: matchingTabs.length,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    console.log('✅ 歌手「新青年理髮廳」已創建\n');
  } else {
    console.log('✅ 歌手「新青年理髮廳」已存在\n');
  }
  
  // 3. 修復所有相關歌曲的 artist 欄位
  console.log('🔧 修復歌曲資料...\n');
  
  for (const tab of matchingTabs) {
    // 檢查是否需要修復
    if (tab.artist !== '新青年理髮廳' || tab.artistId !== artistId) {
      console.log(`修復: ${tab.title}`);
      console.log(`  原歌手: ${tab.artist} → 新青年理髮廳`);
      console.log(`  原 artistId: ${tab.artistId} → ${artistId}`);
      
      await updateDoc(doc(db, 'tabs', tab.id), {
        artist: '新青年理髮廳',
        artistId: artistId,
        artistSlug: artistId,
        updatedAt: new Date().toISOString()
      });
      
      console.log('  ✅ 已修復\n');
    } else {
      console.log(`✓ ${tab.title} - 資料正確，無需修復\n`);
    }
  }
  
  // 4. 更新歌手歌曲數
  const finalCount = matchingTabs.length;
  await updateDoc(artistRef, {
    songCount: finalCount,
    tabCount: finalCount,
    updatedAt: new Date().toISOString()
  });
  
  console.log(`\n✅ 完成！共修復 ${matchingTabs.length} 首歌曲`);
  console.log('歌手頁面：https://polygon.guitars/artists/new-youth-barber');
}

fixNewYouthBarber().catch(console.error);

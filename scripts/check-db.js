const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, collection, getDocs, query, orderBy } = require('firebase/firestore');

// Firebase 配置
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// 初始化 Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

async function checkDatabase() {
  console.log('🔍 檢查 Firestore 資料庫...\n');

  try {
    // 1. 獲取所有樂譜
    console.log('📋 所有樂譜文件：');
    console.log('=' .repeat(60));
    
    const tabsSnapshot = await getDocs(query(collection(db, 'tabs'), orderBy('createdAt', 'desc')));
    
    if (tabsSnapshot.empty) {
      console.log('❌ 資料庫中冇任何樂譜');
    } else {
      tabsSnapshot.forEach((doc) => {
        const tab = doc.data();
        console.log(`\n🎸 ID: ${doc.id}`);
        console.log(`   歌名: ${tab.title}`);
        console.log(`   artist 欄位: "${tab.artist}"`);
        console.log(`   artistId 欄位: "${tab.artistId}"`);
        console.log(`   創建時間: ${tab.createdAt}`);
      });
    }

    console.log('\n\n🎤 所有歌手：');
    console.log('=' .repeat(60));
    
    // 2. 獲取所有歌手
    const artistsSnapshot = await getDocs(query(collection(db, 'artists'), orderBy('name')));
    
    if (artistsSnapshot.empty) {
      console.log('❌ 資料庫中冇任何歌手');
    } else {
      artistsSnapshot.forEach((doc) => {
        const artist = doc.data();
        console.log(`\n🎤 ID: ${doc.id}`);
        console.log(`   name: "${artist.name}"`);
        console.log(`   normalizedName: "${artist.normalizedName}"`);
        console.log(`   tabCount: ${artist.tabCount}`);
      });
    }

    console.log('\n\n📊 總結：');
    console.log('=' .repeat(60));
    console.log(`樂譜總數: ${tabsSnapshot.size}`);
    console.log(`歌手總數: ${artistsSnapshot.size}`);
    
    console.log('\n\n🔎 歌手頁面查詢代碼使用欄位：');
    console.log('=' .repeat(60));
    console.log('getTabsByArtist() 函數使用 artistId 欄位查詢');
    console.log('artistId 生成方式: artistName.toLowerCase().replace(/\\s+/g, "-")');
    
  } catch (error) {
    console.error('❌ 錯誤:', error);
  }
  
  process.exit(0);
}

checkDatabase();

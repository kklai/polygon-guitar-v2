const { initializeApp, getApps } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  where,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  increment
} = require('firebase/firestore');

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

const TABS_COLLECTION = 'tabs';
const ARTISTS_COLLECTION = 'artists';

// 生成 artistId
function generateArtistId(artistName) {
  if (!artistName) return null;
  return artistName.toLowerCase().replace(/\s+/g, '-');
}

async function migrateTabs() {
  console.log('🔧 開始修復舊樂譜...\n');

  try {
    // 1. 獲取所有冇 artistId 嘅樂譜
    console.log('📋 步驟 1: 讀取所有樂譜...');
    const tabsSnapshot = await getDocs(collection(db, TABS_COLLECTION));
    
    const tabsWithoutArtistId = [];
    const allTabs = [];
    
    tabsSnapshot.forEach((docSnapshot) => {
      const tab = docSnapshot.data();
      const tabData = { id: docSnapshot.id, ...tab };
      allTabs.push(tabData);
      
      if (!tab.artistId) {
        tabsWithoutArtistId.push(tabData);
      }
    });

    console.log(`   找到 ${allTabs.length} 份樂譜`);
    console.log(`   其中 ${tabsWithoutArtistId.length} 份冇 artistId\n`);

    if (tabsWithoutArtistId.length === 0) {
      console.log('✅ 所有樂譜都已經有 artistId，唔需要修復！');
      return;
    }

    // 2. 顯示將要修復嘅樂譜
    console.log('📋 步驟 2: 以下樂譜將會被修復：');
    console.log('=' .repeat(70));
    tabsWithoutArtistId.forEach((tab) => {
      const newArtistId = generateArtistId(tab.artist);
      console.log(`   🎸 ${tab.title}`);
      console.log(`      artist: "${tab.artist}"`);
      console.log(`      將會加入 artistId: "${newArtistId}"\n`);
    });

    // 3. 修復每一個樂譜
    console.log('📋 步驟 3: 開始更新樂譜...');
    console.log('=' .repeat(70));
    
    const artistCountMap = {}; // 用於統計每個歌手嘅譜數

    for (const tab of tabsWithoutArtistId) {
      const artistId = generateArtistId(tab.artist);
      
      if (!artistId) {
        console.log(`   ⚠️  跳過 ${tab.id}: 冇 artist 欄位`);
        continue;
      }

      try {
        // 更新樂譜，加入 artistId
        const tabRef = doc(db, TABS_COLLECTION, tab.id);
        await updateDoc(tabRef, { artistId });
        console.log(`   ✅ 已更新: ${tab.title} -> artistId: "${artistId}"`);

        // 統計歌手譜數
        if (!artistCountMap[artistId]) {
          artistCountMap[artistId] = {
            name: tab.artist,
            count: 0
          };
        }
        artistCountMap[artistId].count++;

      } catch (error) {
        console.error(`   ❌ 更新失敗 ${tab.id}:`, error.message);
      }
    }

    // 4. 更新歌手文件
    console.log('\n📋 步驟 4: 更新歌手文件...');
    console.log('=' .repeat(70));

    for (const [artistId, data] of Object.entries(artistCountMap)) {
      try {
        const artistRef = doc(db, ARTISTS_COLLECTION, artistId);
        const artistSnap = await getDoc(artistRef);

        if (artistSnap.exists()) {
          // 更新現有歌手
          await updateDoc(artistRef, {
            tabCount: increment(data.count)
          });
          console.log(`   ✅ 已更新歌手: "${data.name}" (+${data.count})`);
        } else {
          // 創建新歌手
          await setDoc(artistRef, {
            name: data.name,
            normalizedName: artistId,
            tabCount: data.count,
            createdAt: new Date().toISOString()
          });
          console.log(`   ✅ 已創建歌手: "${data.name}" (count: ${data.count})`);
        }
      } catch (error) {
        console.error(`   ❌ 更新歌手失敗 ${artistId}:`, error.message);
      }
    }

    // 5. 驗證結果
    console.log('\n📋 步驟 5: 驗證結果...');
    console.log('=' .repeat(70));
    
    const verifySnapshot = await getDocs(collection(db, TABS_COLLECTION));
    let missingCount = 0;
    
    verifySnapshot.forEach((docSnapshot) => {
      const tab = docSnapshot.data();
      if (!tab.artistId) {
        missingCount++;
      }
    });

    if (missingCount === 0) {
      console.log('   ✅ 所有樂譜都已經有 artistId！');
    } else {
      console.log(`   ⚠️  仲有 ${missingCount} 份樂譜冇 artistId`);
    }

    console.log('\n' + '=' .repeat(70));
    console.log('🎉 修復完成！');
    console.log(`   總共修復: ${tabsWithoutArtistId.length} 份樂譜`);
    console.log(`   涉及歌手: ${Object.keys(artistCountMap).length} 位`);

  } catch (error) {
    console.error('❌ 錯誤:', error);
  }
  
  process.exit(0);
}

migrateTabs();

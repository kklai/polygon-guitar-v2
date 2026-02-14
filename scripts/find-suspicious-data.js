// 找出可疑的歌手和歌曲
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

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

// 可疑模式
const SUSPICIOUS_ARTIST_PATTERNS = [
  { pattern: /^[A-Z]$/, desc: '單個大寫字母' },
  { pattern: /^[a-z]$/, desc: '單個小寫字母' },
  { pattern: /^\d+$/, desc: '純數字' },
  { pattern: /課程|課堂|教學|課程|教學| tutorial|lesson|course/i, desc: '包含教學關鍵詞' },
  { pattern: /排行榜|排名|chart|top.*list/i, desc: '排行榜關鍵詞' },
  { pattern: /攻略|指南|guide/i, desc: '指南攻略關鍵詞' },
  { pattern: /測驗|quiz|測試|test/i, desc: '測驗關鍵詞' },
  { pattern: /^第.*課$/, desc: '第X課格式' },
  { pattern: /product|產品|商品|樂器/, desc: '產品關鍵詞' }
];

const SUSPICIOUS_TAB_PATTERNS = [
  { pattern: /課程|教學|攻略|指南|tutorial|lesson|course/i, desc: '教學內容' },
  { pattern: /測驗|quiz|測試|test|考試/i, desc: '測驗內容' },
  { pattern: /drum|鼓譜|cajon|木箱鼓|kalimba|卡林巴/i, desc: '非結他樂器' },
  { pattern: /鋼琴|piano|小提琴|violin/i, desc: '其他樂器' },
  { pattern: /目錄|directory|index/i, desc: '目錄索引' },
  { pattern: /目錄|目錄|歌曲列表|song list/i, desc: '列表內容' }
];

async function findSuspiciousData() {
  console.log('🔍 掃描可疑數據...\n');
  
  // 獲取所有歌手
  const artistsSnapshot = await getDocs(collection(db, 'artists'));
  const artists = [];
  artistsSnapshot.forEach(doc => {
    artists.push({ id: doc.id, ...doc.data() });
  });
  
  // 獲取所有歌曲
  const tabsSnapshot = await getDocs(collection(db, 'tabs'));
  const tabs = [];
  tabsSnapshot.forEach(doc => {
    tabs.push({ id: doc.id, ...doc.data() });
  });
  
  console.log(`📊 總歌手數: ${artists.length}`);
  console.log(`📊 總歌曲數: ${tabs.length}\n`);
  
  // 找出可疑歌手
  const suspiciousArtists = [];
  artists.forEach(artist => {
    const name = artist.name || '';
    
    // 檢查各種可疑模式
    SUSPICIOUS_ARTIST_PATTERNS.forEach(({ pattern, desc }) => {
      if (pattern.test(name)) {
        suspiciousArtists.push({
          id: artist.id,
          name: name,
          issue: desc,
          songCount: artist.songCount || 0,
          tabCount: artist.tabCount || 0
        });
      }
    });
    
    // 檢查名稱長度
    if (name.length <= 2 && !suspiciousArtists.find(a => a.id === artist.id)) {
      suspiciousArtists.push({
        id: artist.id,
        name: name,
        issue: '名稱過短（2字或以下）',
        songCount: artist.songCount || 0,
        tabCount: artist.tabCount || 0
      });
    }
    
    // 檢查沒有歌曲的歌手
    if ((artist.songCount === 0 || artist.tabCount === 0) && 
        !suspiciousArtists.find(a => a.id === artist.id)) {
      suspiciousArtists.push({
        id: artist.id,
        name: name,
        issue: '沒有關聯歌曲',
        songCount: 0,
        tabCount: 0
      });
    }
  });
  
  // 找出可疑歌曲
  const suspiciousTabs = [];
  tabs.forEach(tab => {
    const title = tab.title || '';
    const content = tab.content || '';
    const artist = tab.artist || '';
    
    // 檢查標題模式
    SUSPICIOUS_TAB_PATTERNS.forEach(({ pattern, desc }) => {
      if (pattern.test(title)) {
        suspiciousTabs.push({
          id: tab.id,
          title: title,
          artist: artist,
          issue: desc
        });
      }
    });
    
    // 檢查內容模式
    SUSPICIOUS_TAB_PATTERNS.forEach(({ pattern, desc }) => {
      if (pattern.test(content) && !suspiciousTabs.find(t => t.id === tab.id)) {
        suspiciousTabs.push({
          id: tab.id,
          title: title,
          artist: artist,
          issue: `內容包含: ${desc}`
        });
      }
    });
    
    // 檢查標題長度
    if (title.length > 100 && !suspiciousTabs.find(t => t.id === tab.id)) {
      suspiciousTabs.push({
        id: tab.id,
        title: title.substring(0, 50) + '...',
        artist: artist,
        issue: '標題過長（可能包含錯誤內容）'
      });
    }
    
    // 檢查沒有內容的歌曲
    if ((!content || content.length < 10) && !suspiciousTabs.find(t => t.id === tab.id)) {
      suspiciousTabs.push({
        id: tab.id,
        title: title,
        artist: artist,
        issue: '內容過短或為空'
      });
    }
  });
  
  // 輸出結果
  console.log('🚨 可疑歌手:');
  console.log('='.repeat(80));
  if (suspiciousArtists.length === 0) {
    console.log('✅ 沒有發現可疑歌手');
  } else {
    console.log(`發現 ${suspiciousArtists.length} 個可疑歌手:\n`);
    suspiciousArtists.forEach((artist, i) => {
      console.log(`${i + 1}. ${artist.name}`);
      console.log(`   ID: ${artist.id}`);
      console.log(`   問題: ${artist.issue}`);
      console.log(`   歌曲數: ${artist.songCount || artist.tabCount || 0}`);
      console.log('');
    });
  }
  
  console.log('\n🚨 可疑歌曲:');
  console.log('='.repeat(80));
  if (suspiciousTabs.length === 0) {
    console.log('✅ 沒有發現可疑歌曲');
  } else {
    console.log(`發現 ${suspiciousTabs.length} 首可疑歌曲:\n`);
    suspiciousTabs.forEach((tab, i) => {
      console.log(`${i + 1}. ${tab.title}`);
      console.log(`   ID: ${tab.id}`);
      console.log(`   歌手: ${tab.artist}`);
      console.log(`   問題: ${tab.issue}`);
      console.log('');
    });
  }
  
  // 保存結果到 JSON
  const fs = require('fs');
  const result = {
    scanDate: new Date().toISOString(),
    totalArtists: artists.length,
    totalTabs: tabs.length,
    suspiciousArtists,
    suspiciousTabs
  };
  fs.writeFileSync('suspicious-data-report.json', JSON.stringify(result, null, 2));
  console.log('\n💾 報告已保存到 suspicious-data-report.json');
}

findSuspiciousData().catch(console.error);

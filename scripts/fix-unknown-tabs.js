// 批量修正 Unknown 歌手樂譜
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 修正清單 (tabId: { artist, title, tags? })
const FIXES = {
  // 1. 謝雅兒 - 我們都(可以)是天使
  '012rGmoqGk5tMi03Ih3u': { 
    artist: '謝雅兒', 
    title: '我們都(可以)是天使',
    tags: []
  },
  // 2. 草蜢 - 失戀
  '14q1qeRTrhTArvhILBJn': { 
    artist: '草蜢', 
    title: '失戀',
    tags: []
  },
  // 3. 郭富城 - 強
  '3pC1bQTUQjOjf4333JSe': { 
    artist: '郭富城', 
    title: '強',
    tags: ['父親節必唱']
  },
  // 4. Cookies - 心急人上
  '6VUcLOm3GprydXxadbzs': { 
    artist: 'Cookies', 
    title: '心急人上',
    tags: []
  },
  // 5. 朱咪咪 - 如果太多牛奶味 (廣告歌)
  '98TmJxWbjksfxmWy79Qo': { 
    artist: '朱咪咪', 
    title: '如果太多牛奶味',
    tags: ['廣告歌', '兒歌']
  },
  // 6. 周國賢 - 離魂記
  'CYs9bIdGyf2krRBWx2U6': { 
    artist: '周國賢', 
    title: '離魂記',
    tags: []
  },
  // 7. Tiger 邱傲然 - 問多一次
  'XX9YoWlQHqvbTfgNDDaX': { 
    artist: 'Tiger 邱傲然', 
    title: '問多一次',
    tags: []
  },
  // 8. 動畫主題曲 - 勇気100％
  'a5K4hFnIj5yiV1vyUPV8': { 
    artist: '忍者亂太郎', 
    title: '勇気100％',
    tags: ['動畫主題曲']
  },
  // 9. 陳百強 - 念親恩
  'et2MmC6b0kG1amnnK8oJ': { 
    artist: '陳百強', 
    title: '念親恩',
    tags: []
  },
  
  // 10. 永倫籃球會 - 伸手觸碰那些夢
  'kYU2ESuENMMZYGwXKivH': { 
    artist: '永倫籃球會', 
    title: '伸手觸碰那些夢',
    tags: ['主題曲', '籃球']
  },
  // 11. TYSON YOSHI & 周殷廷 - 1994 (feat.)
  'oeTu7pZ88lSrWpyI4Pxy': { 
    artist: 'TYSON YOSHI', 
    title: '1994 (feat. 周殷廷)',
    tags: ['合唱']
  },
  // 12. 陳曉東 - 水瓶座
  'p27TLYMsJQjGH4hN5QFx': { 
    artist: '陳曉東', 
    title: '水瓶座',
    tags: []
  },
  // 13. Forward - 出走半生
  'pGd4GWiquRr2l6DNZCMU': { 
    artist: 'Forward', 
    title: '出走半生',
    tags: []
  },
  // 14. 兒歌 - 點心歌
  'u5uQhg7jRyFmPwfY7f78': { 
    artist: '兒歌', 
    title: '點心歌',
    tags: ['兒歌', '單音譜']
  },
  // 15. 謝霆鋒 - 愛後餘生
  'uUGbJAxLnth2eJ9gpGg7': { 
    artist: '謝霆鋒', 
    title: '愛後餘生',
    tags: []
  },
  // 16. 陳慧琳 - 最佳位置
  'vwHQDFftnpVYSWDZYnbV': { 
    artist: '陳慧琳', 
    title: '最佳位置',
    tags: []
  },
  // 17. 張學友 - 分手總要在雨天
  'y4fypqIOvfwY2fMwbcYX': { 
    artist: '張學友', 
    title: '分手總要在雨天',
    tags: []
  }
};

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}

async function getOrCreateArtist(artistName) {
  // 檢查是否已存在
  const existing = await db.collection('artists')
    .where('name', '==', artistName)
    .limit(1)
    .get();
  
  if (!existing.empty) {
    const doc = existing.docs[0];
    const data = doc.data();
    return { 
      id: doc.id, 
      slug: data.slug || data.artistSlug || slugify(artistName),
      ...data 
    };
  }
  
  // 創建新歌手
  console.log(`  🎤 創建新歌手: ${artistName}`);
  const slug = slugify(artistName);
  const newArtist = {
    name: artistName,
    slug: slug,
    artistType: 'unknown',
    isActive: true,
    songCount: 0,
    viewCount: 0,
    createdAt: new Date().toISOString()
  };
  
  const docRef = await db.collection('artists').add(newArtist);
  return { id: docRef.id, ...newArtist };
}

async function fixUnknownTabs() {
  console.log('🔧 開始修正 Unknown 歌手樂譜\n');
  
  let fixedCount = 0;
  let errorCount = 0;
  
  for (const [tabId, fix] of Object.entries(FIXES)) {
    try {
      const tabRef = db.collection('tabs').doc(tabId);
      const tabDoc = await tabRef.get();
      
      if (!tabDoc.exists) {
        console.log(`  ⚠️  找不到: ${tabId}`);
        continue;
      }
      
      // 獲取或創建歌手
      const artist = await getOrCreateArtist(fix.artist);
      
      // 更新樂譜
      const updateData = {
        artist: fix.artist,
        artistName: fix.artist,
        artistId: artist.id,
        artistSlug: artist.slug,
        title: fix.title,
        updatedAt: new Date().toISOString()
      };
      
      if (fix.tags && fix.tags.length > 0) {
        updateData.tags = fix.tags;
      }
      
      await tabRef.update(updateData);
      
      // 更新歌手歌曲數
      await db.collection('artists').doc(artist.id).update({
        songCount: admin.firestore.FieldValue.increment(1)
      });
      
      console.log(`  ✓ ${fix.artist} - ${fix.title}`);
      fixedCount++;
      
    } catch (error) {
      console.error(`  ❌ 錯誤 ${tabId}:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`\n✅ 完成！修正: ${fixedCount}, 錯誤: ${errorCount}`);
  
  // 顯示剩餘 Unknown
  const remaining = await db.collection('tabs').get();
  const unknownCount = remaining.docs.filter(d => 
    d.data().artist === 'Unknown' || !d.data().artist
  ).length;
  
  console.log(`📊 剩餘 Unknown: ${unknownCount} 首`);
  process.exit(0);
}

fixUnknownTabs().catch(console.error);

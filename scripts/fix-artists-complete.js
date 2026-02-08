/**
 * 歌手資料完整修復工具
 * 
 * 處理邏輯：
 * 1. 刪除所有冇歌譜嘅歌手（一定係錯）
 * 2. 清理 Fingerstyle 標記（之前已刪除 Fingerstyle 譜，歌手記錄殘留）
 * 3. 對於似歌名嘅歌手，上網搜尋驗證，然後合併到正確歌手
 */

const admin = require('firebase-admin');
const axios = require('axios');
const serviceAccount = require('./firebase-service-account.json');
const fs = require('fs');

// 初始化 Firebase
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 統計
const stats = {
  deleted: 0,        // 已刪除
  cleaned: 0,        // 已清理標記
  merged: 0,         // 已合併
  failed: 0,         // 失敗
  needManual: 0      // 需人手處理
};

// 延遲函數
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 判斷是否為歌名（而非歌手名）
function isLikelySongName(name) {
  if (!name || name.trim() === '') return false;
  
  const indicators = [
    /\[.*?\]/,
    /【.*?】/,
    /feat\./i,
    /\(.*?版\)/,
    /\(.*?ver\)/i,
    /《.*?》/,
    /「.*?」/,
    /「.*?」/,
    /vs\./i,
    /^Best\s+Of/i,
    /^I['']ll\s+/i,
    /^Lemon$/i,
    /^Perfect$/i,
    /^Shallow$/i,
    /^Sometimes\s+When/i,
  ];
  
  return indicators.some(pattern => pattern.test(name));
}

// 從歌名中提取真正嘅歌手名（簡單規則）
function extractPossibleArtists(name) {
  const possibilities = [];
  
  // 1. 移除標記後嘅名
  let clean = name
    .replace(/\s*\[.*?\]\s*/gi, ' ')
    .replace(/\s*【.*?】\s*/gi, ' ')
    .replace(/\s*\(.*?\)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (clean && clean !== name) {
    possibilities.push(clean);
  }
  
  // 2. 提取 "歌手A 歌手B" 格式
  const artistsMatch = name.match(/^([\u4e00-\u9fa5]{2,4})\s+([\u4e00-\u9fa5]{2,4})/);
  if (artistsMatch) {
    possibilities.push(artistsMatch[1]);
    possibilities.push(artistsMatch[2]);
  }
  
  // 3. 提取 "A - B" 格式中嘅 A
  const dashMatch = name.match(/^(.+?)\s*[\-–—]\s*/);
  if (dashMatch) {
    possibilities.push(dashMatch[1].trim());
  }
  
  return [...new Set(possibilities)].filter(p => p.length >= 2);
}

// 搜尋維基百科驗證歌手
async function verifyArtistOnWiki(name) {
  try {
    const searchUrl = `https://zh.wikipedia.org/w/index.php?search=${encodeURIComponent(name)}&title=Special%3ASearch`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'zh-HK,zh-TW;q=0.9,zh;q=0.8'
      },
      timeout: 10000,
      maxRedirects: 3
    });
    
    const html = response.data;
    
    // 如果直接跳轉到條目頁，通常係歌手
    if (html.includes('歌手') || html.includes('音樂家') || html.includes('樂隊')) {
      return { isArtist: true, confidence: 'high' };
    }
    
    // 如果係搜尋結果頁，檢查第一個結果
    if (html.includes('搜索結果') || html.includes('搜索结果')) {
      // 可能係歌名
      return { isArtist: false, confidence: 'medium' };
    }
    
    return { isArtist: null, confidence: 'low' };
  } catch (error) {
    console.log(`    ⚠️  搜尋失敗: ${error.message}`);
    return { isArtist: null, confidence: 'none' };
  }
}

// 主程序
async function fixArtists() {
  console.log('🔧 歌手資料完整修復');
  console.log('====================\n');
  
  // 讀取所有歌手
  console.log('📖 讀取歌手資料...');
  const artistsSnapshot = await db.collection('artists').get();
  const artists = [];
  artistsSnapshot.forEach(doc => {
    artists.push({ id: doc.id, ...doc.data() });
  });
  console.log(`找到 ${artists.length} 個歌手\n`);
  
  // 讀取所有歌譜
  console.log('📖 讀取歌譜資料...');
  const tabsSnapshot = await db.collection('tabs').get();
  const tabs = [];
  tabsSnapshot.forEach(doc => {
    tabs.push({ id: doc.id, ...doc.data() });
  });
  console.log(`找到 ${tabs.length} 個歌譜\n`);
  
  // 統計每個歌手的歌譜數量
  const artistTabCounts = {};
  tabs.forEach(tab => {
    const artistId = tab.artistId;
    if (artistId) {
      artistTabCounts[artistId] = (artistTabCounts[artistId] || 0) + 1;
    }
  });
  
  // 分類處理
  const toDelete = [];      // 要刪除嘅（冇歌譜）
  const toClean = [];       // 要清理標記嘅
  const toVerify = [];      // 要驗證嘅（似歌名）
  
  artists.forEach(artist => {
    const name = artist.name || '';
    const tabCount = artistTabCounts[artist.id] || 0;
    
    // 1. 冇歌譜 -> 一定刪除
    if (tabCount === 0) {
      toDelete.push(artist);
      return;
    }
    
    // 2. 有歌譜但係似歌名 -> 需要驗證
    if (isLikelySongName(name)) {
      toVerify.push({ ...artist, tabCount });
      return;
    }
    
    // 3. 包含 fingerstyle 標記 -> 清理
    if (/fingerstyle|木結他獨奏/i.test(name)) {
      toClean.push(artist);
    }
  });
  
  console.log('📊 分類結果');
  console.log(`  要刪除（冇歌譜）: ${toDelete.length} 個`);
  console.log(`  要清理標記: ${toClean.length} 個`);
  console.log(`  要驗證（似歌名）: ${toVerify.length} 個\n`);
  
  // ===== 第一步：刪除冇歌譜嘅歌手 =====
  if (toDelete.length > 0) {
    console.log(`\n🗑️  第一步：刪除 ${toDelete.length} 個冇歌譜嘅歌手`);
    console.log('（呢啲係之前刪除 Fingerstyle 譜後殘留嘅歌手記錄）\n');
    
    for (const artist of toDelete) {
      try {
        await db.collection('artists').doc(artist.id).delete();
        console.log(`  ✅ 已刪除: "${artist.name}"`);
        stats.deleted++;
      } catch (err) {
        console.error(`  ❌ 刪除失敗: "${artist.name}" - ${err.message}`);
        stats.failed++;
      }
    }
  }
  
  // ===== 第二步：清理 Fingerstyle 標記 =====
  if (toClean.length > 0) {
    console.log(`\n🧹 第二步：清理 ${toClean.length} 個歌手嘅 Fingerstyle 標記`);
    console.log('（移除 [Fingerstyle]、木結他獨奏 等標記）\n');
    
    for (const artist of toClean) {
      const cleanName = artist.name
        .replace(/\s*\[.*?\]\s*/gi, ' ')
        .replace(/\s*木結他獨奏\s*/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (cleanName && cleanName !== artist.name) {
        try {
          // 檢查是否已有同名歌手
          const existing = await db.collection('artists')
            .where('name', '==', cleanName)
            .get();
          
          if (!existing.empty && existing.docs[0].id !== artist.id) {
            // 有同名歌手，需要合併
            const existingId = existing.docs[0].id;
            console.log(`  ⚠️  "${artist.name}" 應合併到 "${cleanName}"`);
            console.log(`      請到 /admin/merge-artists 手動合併`);
            stats.needManual++;
          } else {
            // 直接改名
            await db.collection('artists').doc(artist.id).update({
              name: cleanName,
              originalName: artist.name
            });
            console.log(`  ✅ "${artist.name}" → "${cleanName}"`);
            stats.cleaned++;
          }
        } catch (err) {
          console.error(`  ❌ 清理失敗: "${artist.name}" - ${err.message}`);
          stats.failed++;
        }
      }
    }
  }
  
  // ===== 第三步：處理似歌名嘅歌手 =====
  if (toVerify.length > 0) {
    console.log(`\n🔍 第三步：處理 ${toVerify.length} 個似歌名嘅歌手`);
    console.log('（呢啲係 Blogger 遷移時標題解析錯誤導致嘅）\n');
    
    const needManualReview = [];
    
    for (const artist of toVerify) {
      console.log(`\n  📋 "${artist.name}"`);
      console.log(`     有 ${artist.tabCount} 個歌譜`);
      
      // 提取可能嘅歌手名
      const possibilities = extractPossibleArtists(artist.name);
      console.log(`     可能嘅歌手名: ${possibilities.join(' / ') || '無法自動提取'}`);
      
      // 嘗試喺現有資料庫搵匹配
      let foundMatch = false;
      for (const possibleName of possibilities) {
        const match = await db.collection('artists')
          .where('name', '==', possibleName)
          .get();
        
        if (!match.empty) {
          const matchArtist = match.docs[0];
          console.log(`     ✅ 搵到匹配: "${possibleName}"`);
          console.log(`        建議：將歌譜轉移到 "${possibleName}"，然後刪除此歌手`);
          
          needManualReview.push({
            artist: artist,
            matchId: matchArtist.id,
            matchName: possibleName,
            action: 'merge'
          });
          
          foundMatch = true;
          break;
        }
      }
      
      if (!foundMatch) {
        // 上網驗證
        console.log(`     🔍 上網驗證中...`);
        await delay(1000);
        
        const verifyResult = await verifyArtistOnWiki(artist.name);
        
        if (verifyResult.isArtist === false) {
          console.log(`     ⚠️  維基百科顯示呢個係歌名，唔係歌手名`);
          console.log(`        需要人手檢查歌譜內容，確定真正嘅歌手`);
          
          needManualReview.push({
            artist: artist,
            action: 'manual_review'
          });
        } else if (verifyResult.isArtist === true) {
          console.log(`     ✅ 維基百科確認係歌手，保留`);
        } else {
          console.log(`     ❓ 無法確定，建議人手檢查`);
          needManualReview.push({
            artist: artist,
            action: 'manual_review'
          });
        }
      }
    }
    
    // 保存需人手處理嘅清單
    if (needManualReview.length > 0) {
      const filename = `artists-need-manual-review-${new Date().toISOString().split('T')[0]}.json`;
      fs.writeFileSync(filename, JSON.stringify(needManualReview, null, 2));
      console.log(`\n\n📋 ${needManualReview.length} 個歌手需要人手檢查`);
      console.log(`💾 清單已保存：${filename}`);
      stats.needManual = needManualReview.length;
    }
  }
  
  // 最終報告
  console.log('\n\n' + '='.repeat(50));
  console.log('📊 修復報告');
  console.log('='.repeat(50));
  console.log(`✅ 已刪除（冇歌譜）: ${stats.deleted} 個`);
  console.log(`✅ 已清理標記: ${stats.cleaned} 個`);
  console.log(`⚠️  需人手處理: ${stats.needManual} 個`);
  console.log(`❌ 失敗: ${stats.failed} 個`);
  console.log('');
  console.log('🔧 下一步：');
  if (stats.needManual > 0) {
    console.log('1. 檢查「artists-need-manual-review-*.json」清單');
    console.log('2. 到 /admin/merge-artists 合併重複歌手');
  }
  console.log('3. 運行腳本再次檢查：node scripts/fix-artists-complete.js');
  
  console.log('\n✅ 完成！');
}

fixArtists().catch(err => {
  console.error('程序錯誤：', err);
  process.exit(1);
});

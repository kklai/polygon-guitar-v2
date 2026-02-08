/**
 * 歌手資料整理工具
 * 處理以下問題：
 * 1. 找出沒有歌譜的歌手（孤兒歌手）
 * 2. 找出名字其實是歌名的歌手（誤判）
 * 3. 清理包含 "fingerstyle" 的歌手名
 */

const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');
const fs = require('fs');

// 初始化 Firebase
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 統計
const stats = {
  totalArtists: 0,
  orphanArtists: 0,      // 沒有歌譜的歌手
  songNameArtists: 0,    // 名字是歌名的歌手
  fingerstyleArtists: 0, // 包含 fingerstyle 的歌手
  unknownArtists: 0      // Unknown 歌手
};

// 判斷是否為歌名（而非歌手名）的規則
function isLikelySongName(name) {
  if (!name || name.trim() === '') return false;
  
  const indicators = [
    // 包含這些詞，很可能是歌名
    /\[.*?\]/,           // [Fingerstyle], [Live] 等
    /【.*?】/,           // 【特別版】等
    /feat\./i,          // feat. 合作標記
    /\(.*?版\)/,        // (現場版), (Remix版) 等
    /\(.*?ver\)/i,      // (Acoustic Ver.) 等
    /\-/,               // 包含 - 分隔
    /《.*?》/,           // 書名號
    /「.*?」/,           // 引號
    /「.*?」/,           // 直角引號
    /vs\./i,            // vs. 對唱
    /x\s+/i,            // x 合作
    /&/,                // & 合作
    /\+/,               // + 合作
    /\//,               // / 分隔（如 衛蘭/應昌佑）
  ];
  
  return indicators.some(pattern => pattern.test(name));
}

// 判斷是否包含 fingerstyle
function containsFingerstyle(name) {
  if (!name) return false;
  return /fingerstyle|木結他獨奏|結他獨奏/i.test(name);
}

// 提取乾淨的歌手名（移除 fingerstyle 標記）
function extractCleanArtistName(name) {
  if (!name) return name;
  
  // 移除 [Fingerstyle] 等標記
  let clean = name
    .replace(/\s*\[.*?\]\s*/gi, ' ')     // [xxx]
    .replace(/\s*【.*?】\s*/gi, ' ')     // 【xxx】
    .replace(/\s*\(.*?\)\s*/gi, ' ')     // (xxx)
    .replace(/\s*[\-–—]\s*/g, ' ')       // - – —
    .replace(/\s+/g, ' ')                // 多餘空格
    .trim();
  
  return clean;
}

// 主程序
async function analyzeArtists() {
  console.log('🔍 歌手資料整理分析');
  console.log('====================\n');
  
  // 讀取所有歌手
  console.log('📖 讀取歌手資料...');
  const artistsSnapshot = await db.collection('artists').get();
  const artists = [];
  
  artistsSnapshot.forEach(doc => {
    artists.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  stats.totalArtists = artists.length;
  console.log(`找到 ${artists.length} 個歌手\n`);
  
  // 讀取所有歌譜
  console.log('📖 讀取歌譜資料...');
  const tabsSnapshot = await db.collection('tabs').get();
  const tabs = [];
  
  tabsSnapshot.forEach(doc => {
    tabs.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  console.log(`找到 ${tabs.length} 個歌譜\n`);
  
  // 統計每個歌手的歌譜數量
  const artistTabCounts = {};
  tabs.forEach(tab => {
    const artistId = tab.artistId || tab.artist;
    if (artistId) {
      artistTabCounts[artistId] = (artistTabCounts[artistId] || 0) + 1;
    }
  });
  
  // 分析結果
  const orphanArtists = [];      // 沒有歌譜的歌手
  const songNameArtists = [];    // 名字是歌名的歌手
  const fingerstyleArtists = []; // 包含 fingerstyle 的歌手
  const unknownArtists = [];     // Unknown 歌手
  
  artists.forEach(artist => {
    const name = artist.name || '';
    const tabCount = artistTabCounts[artist.id] || 0;
    
    // 1. 檢查是否沒有歌譜
    if (tabCount === 0) {
      orphanArtists.push({
        id: artist.id,
        name: name,
        reason: '沒有歌譜'
      });
      stats.orphanArtists++;
    }
    
    // 2. 檢查名字是否為歌名
    if (isLikelySongName(name)) {
      songNameArtists.push({
        id: artist.id,
        name: name,
        tabCount: tabCount,
        cleanName: extractCleanArtistName(name),
        reason: '名字格式似歌名'
      });
      stats.songNameArtists++;
    }
    
    // 3. 檢查是否包含 fingerstyle
    if (containsFingerstyle(name)) {
      fingerstyleArtists.push({
        id: artist.id,
        name: name,
        tabCount: tabCount,
        cleanName: extractCleanArtistName(name),
        reason: '包含 Fingerstyle 標記'
      });
      stats.fingerstyleArtists++;
    }
    
    // 4. 檢查是否為 Unknown
    if (name.toLowerCase() === 'unknown' || name === '未知' || name === '') {
      unknownArtists.push({
        id: artist.id,
        name: name || '(空)',
        tabCount: tabCount,
        reason: 'Unknown 歌手'
      });
      stats.unknownArtists++;
    }
  });
  
  // 生成報告
  console.log('📊 分析報告');
  console.log('='.repeat(50));
  console.log(`總歌手數：${stats.totalArtists}`);
  console.log(`總歌譜數：${tabs.length}`);
  console.log('');
  console.log('問題統計：');
  console.log(`  ❌ 沒有歌譜的歌手：${stats.orphanArtists} 個 (${((stats.orphanArtists/stats.totalArtists)*100).toFixed(1)}%)`);
  console.log(`  ⚠️  名字似歌名的歌手：${stats.songNameArtists} 個 (${((stats.songNameArtists/stats.totalArtists)*100).toFixed(1)}%)`);
  console.log(`  🎸 包含 Fingerstyle：${stats.fingerstyleArtists} 個 (${((stats.fingerstyleArtists/stats.totalArtists)*100).toFixed(1)}%)`);
  console.log(`  ❓ Unknown 歌手：${stats.unknownArtists} 個 (${((stats.unknownArtists/stats.totalArtists)*100).toFixed(1)}%)`);
  
  // 顯示詳細清單
  console.log('\n\n📋 詳細清單');
  console.log('='.repeat(50));
  
  // 1. 沒有歌譜的歌手
  if (orphanArtists.length > 0) {
    console.log(`\n❌ 沒有歌譜的歌手（前 10 個）：`);
    orphanArtists.slice(0, 10).forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.name}`);
    });
    if (orphanArtists.length > 10) {
      console.log(`  ... 還有 ${orphanArtists.length - 10} 個`);
    }
  }
  
  // 2. 名字似歌名的歌手
  if (songNameArtists.length > 0) {
    console.log(`\n⚠️  名字似歌名的歌手（前 10 個）：`);
    songNameArtists.slice(0, 10).forEach((a, i) => {
      console.log(`  ${i + 1}. "${a.name}"`);
      console.log(`      建議改為: "${a.cleanName}"`);
      console.log(`      有 ${a.tabCount} 個歌譜`);
    });
    if (songNameArtists.length > 10) {
      console.log(`  ... 還有 ${songNameArtists.length - 10} 個`);
    }
  }
  
  // 3. 包含 Fingerstyle 的歌手
  if (fingerstyleArtists.length > 0) {
    console.log(`\n🎸 包含 Fingerstyle 的歌手（前 10 個）：`);
    fingerstyleArtists.slice(0, 10).forEach((a, i) => {
      console.log(`  ${i + 1}. "${a.name}"`);
      console.log(`      建議改為: "${a.cleanName}"`);
      console.log(`      有 ${a.tabCount} 個歌譜`);
    });
    if (fingerstyleArtists.length > 10) {
      console.log(`  ... 還有 ${fingerstyleArtists.length - 10} 個`);
    }
  }
  
  // 4. Unknown 歌手
  if (unknownArtists.length > 0) {
    console.log(`\n❓ Unknown 歌手（前 10 個）：`);
    unknownArtists.slice(0, 10).forEach((a, i) => {
      console.log(`  ${i + 1}. "${a.name}" - ${a.tabCount} 個歌譜`);
    });
    if (unknownArtists.length > 10) {
      console.log(`  ... 還有 ${unknownArtists.length - 10} 個`);
    }
  }
  
  // 保存詳細報告
  const report = {
    generatedAt: new Date().toISOString(),
    stats,
    orphanArtists,
    songNameArtists,
    fingerstyleArtists,
    unknownArtists
  };
  
  const filename = `artist-cleanup-report-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));
  console.log(`\n\n💾 詳細報告已保存：${filename}`);
  
  // 建議操作
  console.log('\n\n🔧 建議操作');
  console.log('='.repeat(50));
  
  if (orphanArtists.length > 0) {
    console.log(`\n1. 刪除沒有歌譜的歌手`);
    console.log(`   運行: node scripts/cleanup-artists.js --delete-orphan`);
  }
  
  if (fingerstyleArtists.length > 0) {
    console.log(`\n2. 清理 Fingerstyle 標記`);
    console.log(`   運行: node scripts/cleanup-artists.js --clean-fingerstyle`);
  }
  
  if (songNameArtists.length > 0) {
    console.log(`\n3. 修復歌名誤判為歌手名的問題`);
    console.log(`   需要手動檢查後運行修復腳本`);
  }
  
  console.log('\n4. 查看所有選項');
  console.log('   運行: node scripts/cleanup-artists.js --help');
  
  return {
    orphanArtists,
    songNameArtists,
    fingerstyleArtists,
    unknownArtists
  };
}

// 刪除沒有歌譜的歌手
async function deleteOrphanArtists(orphanList) {
  console.log(`\n🗑️  刪除 ${orphanList.length} 個沒有歌譜的歌手...\n`);
  
  let deleted = 0;
  let failed = 0;
  
  for (const artist of orphanList) {
    try {
      await db.collection('artists').doc(artist.id).delete();
      console.log(`  ✅ 已刪除: ${artist.name}`);
      deleted++;
    } catch (err) {
      console.error(`  ❌ 刪除失敗: ${artist.name} - ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\n✅ 完成：成功 ${deleted} 個，失敗 ${failed} 個`);
}

// 清理 Fingerstyle 標記
async function cleanFingerstyleMarkers(artistList) {
  console.log(`\n🧹 清理 ${artistList.length} 個歌手的 Fingerstyle 標記...\n`);
  
  let updated = 0;
  let failed = 0;
  
  for (const artist of artistList) {
    const cleanName = extractCleanArtistName(artist.name);
    
    if (cleanName !== artist.name && cleanName.trim() !== '') {
      try {
        // 檢查是否已有同名歌手
        const existing = await db.collection('artists')
          .where('name', '==', cleanName)
          .get();
        
        if (!existing.empty) {
          // 有同名歌手，需要合併
          console.log(`  ⚠️  "${artist.name}" 與 "${cleanName}" 重複，需要合併`);
          console.log(`      請使用 /admin/merge-artists 頁面手動合併`);
        } else {
          // 直接改名
          await db.collection('artists').doc(artist.id).update({
            name: cleanName,
            originalName: artist.name,
            cleanedAt: new Date().toISOString()
          });
          console.log(`  ✅ "${artist.name}" → "${cleanName}"`);
          updated++;
        }
      } catch (err) {
        console.error(`  ❌ 更新失敗: ${artist.name} - ${err.message}`);
        failed++;
      }
    }
  }
  
  console.log(`\n✅ 完成：成功 ${updated} 個，失敗 ${failed} 個`);
}

// 顯示幫助
function showHelp() {
  console.log('歌手資料整理工具');
  console.log('================\n');
  console.log('使用方法:');
  console.log('  node scripts/cleanup-artists.js           (分析模式，不修改資料)');
  console.log('  node scripts/cleanup-artists.js --delete-orphan    (刪除沒有歌譜的歌手)');
  console.log('  node scripts/cleanup-artists.js --clean-fingerstyle (清理 Fingerstyle 標記)');
  console.log('  node scripts/cleanup-artists.js --help    (顯示幫助)');
  console.log('');
  console.log('選項:');
  console.log('  --dry-run    預覽模式（不實際刪除/修改）');
}

// 主程序
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    showHelp();
    process.exit(0);
  }
  
  const dryRun = args.includes('--dry-run');
  const deleteOrphan = args.includes('--delete-orphan');
  const cleanFingerstyle = args.includes('--clean-fingerstyle');
  
  if (dryRun) {
    console.log('👁️  預覽模式（不會修改資料）\n');
  }
  
  // 執行分析
  const result = await analyzeArtists();
  
  // 根據參數執行清理
  if (deleteOrphan && !dryRun) {
    if (result.orphanArtists.length > 0) {
      const confirm = await question(`\n確認刪除 ${result.orphanArtists.length} 個沒有歌譜的歌手？(yes/no) `);
      if (confirm.toLowerCase() === 'yes') {
        await deleteOrphanArtists(result.orphanArtists);
      }
    }
  }
  
  if (cleanFingerstyle && !dryRun) {
    if (result.fingerstyleArtists.length > 0) {
      const confirm = await question(`\n確認清理 ${result.fingerstyleArtists.length} 個歌手的 Fingerstyle 標記？(yes/no) `);
      if (confirm.toLowerCase() === 'yes') {
        await cleanFingerstyleMarkers(result.fingerstyleArtists);
      }
    }
  }
  
  process.exit(0);
}

function question(prompt) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

main().catch(err => {
  console.error('程序錯誤：', err);
  process.exit(1);
});

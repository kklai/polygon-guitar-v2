// 清理錯誤歌手名並修復相關樂譜
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const WRITE_MODE = process.argv.includes('--write');

// 常見錯誤歌手名模式（需要清理）
const BAD_ARTIST_PATTERNS = [
  /^\[/,                    // [開頭的（如 [12堂Ukulele）
  /^\d+$/,                  // 純數字
  /^[a-z]$/i,               // 單個字母（如 A, C）
  /結他教室/i,               // 課程相關
  /ukulele/i,               // 課程相關
  /樂理小知識/i,             // 知識文
  /書籍/i,                  // 書籍
  /產品/i,                  // 產品
  /band房/i,                // Band房目錄
  /privacy/i,               // 隱私政策
  /like|抽獎/i,             // 活動
  /Other/i,                 // 其他分類
];

// 常見標題解析錯誤（歌手名其實是歌名的一部分）
const KNOWN_MISPARSED = {
  'A': { fix: 'delete', reason: '單個字母' },
  'C': { fix: 'delete', reason: '單個字母' },
  'Air': { fix: 'Air Supply', reason: '樂隊名不完整' },
  'Ben.E.King Stand': { fix: 'Ben E. King', reason: '歌名混入' },
  'Stand': { fix: 'delete', reason: '只是歌名單詞' },
  'Me': { fix: 'delete', reason: '只是歌名單詞' },
  'Adam Levine  Lost Stars': { fix: 'Adam Levine', reason: '歌名混入' },
  'Lost Stars': { fix: 'delete', reason: '只是歌名' },
  'Can': { fix: 'delete', reason: '只是歌名單詞' },
  'T Be': { fix: 'delete', reason: '無效名稱' },
  'Head': { fix: 'delete', reason: '無效名稱' },
  'Blackout': { fix: 'delete', reason: '只是歌名' },
  'Man': { fix: 'delete', reason: '無效名稱' },
  'Good': { fix: 'delete', reason: '無效名稱' },
  'Bye': { fix: 'delete', reason: '只是歌名單詞' },
  'Alin': { fix: 'A-Lin', reason: '正確藝名' },
  'At 17': { fix: 'at17', reason: '格式統一' },
  'At17': { fix: 'at17', reason: '格式統一' },
  'Busking': { fix: 'delete', reason: '活動名稱' },
  'CHEERS': { fix: 'delete', reason: '無法確定歌手' },
  'Concert YY': { fix: 'delete', reason: '演唱會名稱' },
  'Do re mi': { fix: 'delete', reason: '課程名稱' },
  'FFx': { fix: 'delete', reason: '無法確定' },
  'Pick': { fix: 'delete', reason: '產品名稱' },
  'SG110 Sole': { fix: 'delete', reason: '產品名稱' },
  'Sole': { fix: 'delete', reason: '產品名稱' },
  'Tuner': { fix: 'delete', reason: '產品名稱' },
  'V': { fix: 'delete', reason: '單個字母' },
  'Yellow': { fix: 'Yellow!', reason: '樂隊名不完整' },
  'Avenged': { fix: 'Avenged Sevenfold', reason: '樂隊名不完整' },
  'Avril': { fix: 'Avril Lavigne', reason: '藝名不完整' },
  'Carly Rae Jepsen': { fix: 'Carly Rae Jepsen', reason: '正確，需補充資料' },
  'Christina Perri': { fix: 'Christina Perri', reason: '正確，需補充資料' },
  'Coldplay': { fix: 'Coldplay', reason: '正確，需補充資料' },
  'Jason Mraz': { fix: 'Jason Mraz', reason: '正確，需補充資料' },
  'John Lennon': { fix: 'John Lennon', reason: '正確，需補充資料' },
  'Olivia Ong': { fix: 'Olivia Ong', reason: '正確，需補充資料' },
  'Robbie Williams': { fix: 'Robbie Williams', reason: '正確，需補充資料' },
  'The Carpenters': { fix: 'Carpenters', reason: '統一名稱' },
  'Carpenters': { fix: 'Carpenters', reason: '正確，需補充資料' },
  '[Kermit結他教室] LV 1': { fix: 'delete', reason: '課程名稱' },
  '[12堂Ukulele': { fix: 'delete', reason: '課程名稱' },
  '[Karson X Kermit] 流行曲歌唱技巧': { fix: 'delete', reason: '課程名稱' },
  'Clown': { fix: 'delete', reason: '無法確定' },
  'Closer': { fix: 'delete', reason: '無法確定' },
};

async function main() {
  console.log('🧹 歌手資料清理工具');
  console.log('====================');
  console.log(`模式: ${WRITE_MODE ? '⚠️ 寫入模式' : '🔍 測試模式'}`);
  console.log('');
  
  const snapshot = await db.collection('artists').get();
  const artists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  console.log(`總歌手數: ${artists.length}\n`);
  
  // 1. 找出問題歌手
  const badArtists = [];
  const fixableArtists = [];
  
  for (const artist of artists) {
    const name = artist.name;
    
    // 檢查是否匹配已知錯誤模式
    if (KNOWN_MISPARSED[name]) {
      badArtists.push({ artist, action: KNOWN_MISPARSED[name] });
      continue;
    }
    
    // 檢查是否匹配bad patterns
    if (BAD_ARTIST_PATTERNS.some(p => p.test(name))) {
      badArtists.push({ artist, action: { fix: 'delete', reason: '匹配錯誤模式' } });
      continue;
    }
    
    // 檢查是否需要資料補充
    if (!artist.artistType || artist.artistType === 'unknown' || !artist.bio) {
      fixableArtists.push(artist);
    }
  }
  
  console.log(`問題歌手: ${badArtists.length} 個`);
  console.log(`需要補充資料: ${fixableArtists.length} 個\n`);
  
  // 2. 顯示問題歌手
  console.log('📋 問題歌手列表（前30個）：');
  badArtists.slice(0, 30).forEach(({ artist, action }) => {
    console.log(`  - ${artist.name} → ${action.fix} (${action.reason}, tabs: ${artist.tabCount || 0})`);
  });
  
  if (!WRITE_MODE) {
    console.log('\n💡 測試模式。要執行清理，加上 --write 參數');
    console.log('這將會：');
    console.log('1. 刪除/合併錯誤歌手條目');
    console.log('2. 將相關樂譜的歌手改為 Unknown 或正確歌手');
    console.log('3. 對有效歌手運行維基百科搜尋補充資料');
    return;
  }
  
  // 3. 執行修復
  console.log('\n🔧 開始修復...\n');
  
  let deletedCount = 0;
  let fixedCount = 0;
  
  for (const { artist, action } of badArtists) {
    console.log(`處理: ${artist.name} (${action.fix})`);
    
    if (action.fix === 'delete') {
      // 先更新相關樂譜的歌手為 Unknown
      const tabsSnapshot = await db.collection('tabs')
        .where('artistId', '==', artist.id)
        .get();
      
      console.log(`  找到 ${tabsSnapshot.size} 個相關樂譜`);
      
      for (const tabDoc of tabsSnapshot.docs) {
        await tabDoc.ref.update({
          artist: 'Unknown',
          artistId: 'unknown',
          updatedAt: new Date().toISOString()
        });
      }
      
      // 刪除歌手
      await db.collection('artists').doc(artist.id).delete();
      deletedCount++;
      console.log('  ✓ 已刪除');
      
    } else {
      // 重命名/合併歌手
      // 檢查目標歌手是否已存在
      const newId = action.fix.toLowerCase().replace(/\s+/g, '-');
      const existingDoc = await db.collection('artists').doc(newId).get();
      
      if (existingDoc.exists) {
        // 合併到現有歌手
        const targetArtist = existingDoc.data();
        console.log(`  合併到現有歌手: ${targetArtist.name}`);
        
        // 更新樂譜
        const tabsSnapshot = await db.collection('tabs')
          .where('artistId', '==', artist.id)
          .get();
        
        for (const tabDoc of tabsSnapshot.docs) {
          await tabDoc.ref.update({
            artist: targetArtist.name,
            artistId: newId,
            updatedAt: new Date().toISOString()
          });
        }
        
        // 更新目標歌手的 tabCount
        await existingDoc.ref.update({
          tabCount: (targetArtist.tabCount || 0) + (artist.tabCount || 0),
          updatedAt: new Date().toISOString()
        });
        
        // 刪除原歌手
        await db.collection('artists').doc(artist.id).delete();
        
      } else {
        // 重命名歌手
        console.log(`  重命名為: ${action.fix}`);
        
        // 創建新歌手
        await db.collection('artists').doc(newId).set({
          name: action.fix,
          normalizedName: newId,
          tabCount: artist.tabCount || 0,
          createdAt: new Date().toISOString()
        });
        
        // 更新樂譜
        const tabsSnapshot = await db.collection('tabs')
          .where('artistId', '==', artist.id)
          .get();
        
        for (const tabDoc of tabsSnapshot.docs) {
          await tabDoc.ref.update({
            artist: action.fix,
            artistId: newId,
            updatedAt: new Date().toISOString()
          });
        }
        
        // 刪除原歌手
        await db.collection('artists').doc(artist.id).delete();
      }
      
      fixedCount++;
      console.log('  ✓ 已修復');
    }
    
    // 延遲避免限制
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n✅ 完成！刪除: ${deletedCount}, 修復: ${fixedCount}`);
}

main().catch(console.error);

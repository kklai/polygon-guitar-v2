const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 檢查是否為歌曲標題
function isLikelySongTitle(title) {
  if (!title || title.trim().length === 0) return false;
  
  const nonSongPatterns = [
    /排行榜\s*20\d\d/i,
    /party.*room/i,
    /party/i,
    /租借.*服務/i,
    /用品.*分享/i,
    /團購/i,
    /大特價/i,
    /比賽.*報名/i,
    /常識.*測驗/i,
    /Quiz/i,
    /課程.*\$/i,
    /\$.*堂/i,
    /教學.*示範/i,
    /教學\]/i,
    /教學$/i,
    /初次做.*YOUTUBER/i,
    /歌曲目錄/i,
    /排行榜/i,
    /轉載.*文章/i,
    /木箱鼓的戰術/i,
    /kalimba.*教學/i,
    /cajon教學/i,
    /木箱鼓教學/i,
    /結他教學/i,
    /鋼琴教學/i,
    /樂器分享/i,
    /進階.*教學/i,
    /團購/i,
    /放榜/i,
    /學左一堂/i,
    /十大結他譜/i,
    /鼓譜/i,
    /drum.*score/i,
    /-Drum Score/i,
    /木箱鼓.*基礎/i,
    /打板.*教學/i,
    /鋼琴.*教學/i
  ];
  
  for (const pattern of nonSongPatterns) {
    if (pattern.test(title)) return false;
  }
  
  // 純歌手名
  if (/^[\u4e00-\u9fa5]{2,4}$/.test(title.trim())) return false;
  if (/^[A-Za-z\s]+$/.test(title.trim()) && title.trim().split(' ').length <= 2) return false;
  
  return true;
}

// 解析標題
function parseTitleFixed(title) {
  const cleanTitle = title.trim();
  
  // 格式 1: 歌手 - 歌名
  let match = cleanTitle.match(/^(.+?)\s+-\s+(.+)$/);
  if (match) {
    return { artist: match[1].trim(), title: match[2].trim() };
  }
  
  // 格式 2: 歌手 | 歌名
  match = cleanTitle.match(/^(.+?)\s*\|\s*(.+)$/);
  if (match) {
    return { artist: match[1].trim(), title: match[2].trim() };
  }
  
  // 格式 3: 歌手 歌名
  match = cleanTitle.match(/^([\u4e00-\u9fa5]{2,4}|[A-Za-z]+)\s+(.+)$/);
  if (match) {
    const possibleArtist = match[1].trim();
    const possibleTitle = match[2].trim();
    if (possibleTitle.length > 1 && !possibleTitle.match(/^[\u4e00-\u9fa5]{2,4}$/)) {
      return { artist: possibleArtist, title: possibleTitle };
    }
  }
  
  // 格式 4: 歌名 歌手（倒轉）
  match = cleanTitle.match(/^(.+?)\s+([\u4e00-\u9fa5]{2,4})$/);
  if (match && match[1].length > 2) {
    return { artist: match[2].trim(), title: match[1].trim() };
  }
  
  return null;
}

async function processUnknown() {
  const snapshot = await db.collection('tabs')
    .where('artist', '==', 'Unknown')
    .get();
  
  const toDelete = [];
  const toFix = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const title = data.title || '';
    
    if (!isLikelySongTitle(title)) {
      toDelete.push({ id: doc.id, title });
    } else {
      const parsed = parseTitleFixed(title);
      if (parsed) {
        toFix.push({ 
          id: doc.id, 
          title, 
          newArtist: parsed.artist, 
          newTitle: parsed.title 
        });
      } else {
        toFix.push({ 
          id: doc.id, 
          title, 
          newArtist: 'Unknown', 
          newTitle: title 
        });
      }
    }
  }
  
  console.log('=== 分析結果 ===');
  console.log('總 Unknown:', snapshot.size);
  console.log('非歌曲（將刪除）:', toDelete.length);
  console.log('是歌曲（將修復）:', toFix.length);
  
  console.log('\n=== 將刪除（前 15）===');
  toDelete.slice(0, 15).forEach((item, i) => {
    console.log((i+1).toString().padStart(3) + '. ' + item.title);
  });
  
  console.log('\n=== 將修復示例（前 15）===');
  toFix.slice(0, 15).forEach((item, i) => {
    console.log((i+1).toString().padStart(3) + '. 「' + item.title + '」→ 「' + item.newArtist + ' - ' + item.newTitle + '」');
  });
  
  // 執行刪除
  console.log('\n=== 開始刪除 ===');
  let deleteCount = 0;
  for (const item of toDelete) {
    try {
      await db.collection('tabs').doc(item.id).delete();
      deleteCount++;
    } catch (e) {
      console.log('刪除失敗:', item.title);
    }
  }
  console.log('✓ 刪除完成:', deleteCount);
  
  // 執行修復
  console.log('\n=== 開始修復 ===');
  let fixCount = 0;
  for (const item of toFix) {
    try {
      const artistId = item.newArtist.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
      await db.collection('tabs').doc(item.id).update({
        artist: item.newArtist,
        title: item.newTitle,
        artistId: artistId,
        updatedAt: new Date()
      });
      fixCount++;
    } catch (e) {
      console.log('修復失敗:', item.title);
    }
  }
  console.log('✓ 修復完成:', fixCount);
  
  console.log('\n=== 完成 ===');
  console.log('刪除:', deleteCount);
  console.log('修復:', fixCount);
}

processUnknown().catch(console.error);

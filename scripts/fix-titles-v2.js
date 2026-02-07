const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 更智能的標題解析
function parseTitleSmart(title) {
  const cleanTitle = title.trim();
  if (!cleanTitle) return null;
  
  // 已經有 "-" 分隔符
  if (cleanTitle.includes(' - ')) {
    const parts = cleanTitle.split(' - ');
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ') };
  }
  
  // 已經有 "|" 分隔符
  if (cleanTitle.includes('|')) {
    const parts = cleanTitle.split('|');
    return { artist: parts[0].trim(), title: parts.slice(1).join('|') };
  }
  
  // 中文歌手 + 歌名（空格分隔）
  // 例如: "洪卓立 陰陽路", "陳小春 失戀王"
  const chineseMatch = cleanTitle.match(/^([\u4e00-\u9fa5]{2,4})\s+(.+)$/);
  if (chineseMatch) {
    const artist = chineseMatch[1];
    const songTitle = chineseMatch[2].trim();
    // 確認第二部分唔係純中文（應該係歌名）
    if (songTitle.length > 0) {
      return { artist, title: songTitle };
    }
  }
  
  // 英文歌手名（1-2個單詞）+ 歌名
  // 例如: "Ed Sheeran Perfect", "Whitney Houston When You Believe"
  const englishMatch = cleanTitle.match(/^([A-Za-z\s\.]+?)\s+([A-Z][A-Za-z\s\-']+)$/);
  if (englishMatch) {
    const possibleArtist = englishMatch[1].trim();
    const possibleTitle = englishMatch[2].trim();
    // 檢查歌手名長度合理（1-3個詞）
    const artistWords = possibleArtist.split(/\s+/).length;
    if (artistWords <= 3 && possibleArtist.length > 1) {
      return { artist: possibleArtist, title: possibleTitle };
    }
  }
  
  // 歌名 + 中文歌手（倒轉格式）
  // 例如: "星光伴我心 鄭中基"
  const reverseMatch = cleanTitle.match(/^(.{2,}?)\s+([\u4e00-\u9fa5]{2,4})$/);
  if (reverseMatch && !reverseMatch[1].match(/^[\u4e00-\u9fa5]{2,4}$/)) {
    return { artist: reverseMatch[2], title: reverseMatch[1] };
  }
  
  return null;
}

async function fixTitles() {
  // 獲取所有需要修復的歌曲（artist 係 "A", "Of", "Whitney" 等明顯錯誤）
  const snapshot = await db.collection('tabs').get();
  
  const toFix = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const artist = data.artist;
    const title = data.title;
    
    // 檢查明顯錯誤的解析結果
    const needsFix = 
      artist === 'A' || 
      artist === 'Of' || 
      artist === 'Whitney' ||
      artist === 'Of Monsters' ||
      artist === 'THE' ||
      artist === 'MoMo' ||
      (artist === 'Unknown' && title && title.includes(' '));
    
    if (needsFix) {
      toFix.push({ id: doc.id, artist, title: data.originalTitle || title });
    }
  }
  
  console.log('找到', toFix.length, '首需要重新修復');
  
  // 重新解析
  for (const item of toFix) {
    const parsed = parseTitleSmart(item.title);
    if (parsed) {
      console.log('修復:', item.title, '→', parsed.artist, '-', parsed.title);
    }
  }
}

fixTitles().catch(console.error);

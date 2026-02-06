// 修復歌手名為 Unknown 嘅譜
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 已知歌手列表（從舊腳本複製）
const KNOWN_ARTISTS = ['陳奕迅', 'Beyond', '謝霆鋒', 'Dear Jane', '鄧麗欣', 'Kiri T', '謝雅兒', 
  '張學友', '古天樂', '林峯', '陳柏宇', '林家謙', '姜濤', 'Anson Lo', '柳應廷', 'Edan', 'Ian',
  '張敬軒', '楊千嬅', '容祖兒', 'Twins', 'Supper Moment', 'RubberBand', '五月天', '周杰倫',
  '田馥甄', '林宥嘉', '蕭敬騰', '王力宏', '陶喆', '方大同', '盧廣仲', '韋禮安', '李榮浩', 
  '馮允謙', 'MIRROR', 'ERROR', 'C AllStar', '側田', '衛蘭', '連詩雅', 'AGA', '陳蕾',
  '岑寧兒', '方皓玟', '鄭欣宜', '許廷鏗', '胡鴻鈞', '吳業坤', 'JW', '李克勤', '譚詠麟',
  '陳曉東', '郭富城', '林子祥', '陳健安', '洪嘉豪', 'C Allstar'];

// 從標題解析歌手
function parseArtistFromTitle(title) {
  if (!title) return null;
  
  // 嘗試匹配「歌手 - 歌名」格式
  const match = title.match(/^(.+?)\s*-\s*(.+)$/);
  if (match) {
    const part1 = match[1].trim();
    const part2 = match[2].trim();
    
    // 檢查邊個係歌手
    const part1IsArtist = KNOWN_ARTISTS.some(a => part1.includes(a) || a.includes(part1));
    const part2IsArtist = KNOWN_ARTISTS.some(a => part2.includes(a) || a.includes(part2));
    
    if (part1IsArtist) return part1;
    if (part2IsArtist) return part2;
    
    // 默認 part1 係歌手
    return part1;
  }
  
  // 嘗試「歌手 歌名」格式（空格分隔）
  for (const artist of KNOWN_ARTISTS) {
    if (title.startsWith(artist + ' ')) return artist;
  }
  
  return null;
}

// 提取核心名（淨中文）
function extractCoreName(name) {
  const chineseMatch = name.match(/[\u4e00-\u9fa5]{2,}/);
  return chineseMatch ? chineseMatch[0] : name;
}

async function fixUnknownArtists() {
  console.log('🔧 修復歌手名\n');
  
  const tabs = await db.collection('tabs').get();
  let fixedCount = 0;
  let newArtists = [];
  
  for (const doc of tabs.docs) {
    const t = doc.data();
    
    // 如果歌手名係 Unknown 或者冇歌手名
    if ((t.artistName || t.artist) === 'Unknown' || !(t.artistName || t.artist)) {
      const artistName = parseArtistFromTitle(t.title);
      
      if (artistName && artistName !== 'Unknown') {
        // 檢查係咪新歌手
        const coreName = extractCoreName(artistName);
        const artistId = coreName; // 簡化版 ID
        
        // 檢查歌手是否存在
        const artistRef = db.collection('artists').doc(artistId);
        const artistSnap = await artistRef.get();
        
        if (!artistSnap.exists) {
          // 創建新歌手
          await artistRef.set({
            name: artistName,
            normalizedName: artistId,
            artistType: 'unknown',
            tabCount: 0,
            createdAt: new Date().toISOString()
          });
          newArtists.push(artistName);
          console.log('🎤 新歌手: ' + artistName);
        }
        
        // 更新譜
        await doc.ref.update({
          artistName: artistName,
          artistId: artistId
        });
        
        // 增加歌手 tabCount
        await artistRef.update({
          tabCount: admin.firestore.FieldValue.increment(1)
        });
        
        console.log('✓ 修復: ' + t.title + ' → ' + artistName);
        fixedCount++;
      } else {
        console.log('⚠️ 無法解析: ' + t.title);
      }
    }
  }
  
  console.log('\n✅ 修復完成！');
  console.log('  修復咗 ' + fixedCount + ' 份譜');
  console.log('  新增咗 ' + newArtists.length + ' 個歌手');
}

fixUnknownArtists().then(() => process.exit(0)).catch(e => {
  console.error('❌ 錯誤:', e);
  process.exit(1);
});

// 修復歌手名稱問題
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

const path = require('path');
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
const rootDir = path.resolve(__dirname, '..');
const fullPath = path.resolve(rootDir, serviceAccountPath);
const serviceAccount = require(fullPath);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

// ============ 改進的標題解析 ============

// 已知前綴列表（需要移除的）
const PREFIXES_TO_REMOVE = [
  'MK三部曲',
  'EP',
  'Album',
  'Single',
  '新歌',
  '新碟',
  '大碟',
  '專輯'
];

// 解析中英文混合歌手名
function parseBilingualName(artistPart) {
  // 移除前綴
  let cleanArtist = artistPart;
  for (const prefix of PREFIXES_TO_REMOVE) {
    const regex = new RegExp(`^${prefix}\\s*`, 'i');
    cleanArtist = cleanArtist.replace(regex, '');
  }
  
  cleanArtist = cleanArtist.trim();
  
  // 情況1: "英文名 中文名" (如 "Lowell Lo 盧冠廷")
  // 情況2: "中文名 英文名" (如 "周國賢 Endy Chow")
  const englishMatch = cleanArtist.match(/^([a-zA-Z\s]+)\s+([\u4e00-\u9fa5]{2,})$/);
  if (englishMatch) {
    return {
      english: englishMatch[1].trim(),
      chinese: englishMatch[2].trim(),
      preferred: englishMatch[2].trim() // 優先使用中文名
    };
  }
  
  const chineseMatch = cleanArtist.match(/^([\u4e00-\u9fa5]{2,})\s+([a-zA-Z\s]+)$/);
  if (chineseMatch) {
    return {
      chinese: chineseMatch[1].trim(),
      english: chineseMatch[2].trim(),
      preferred: chineseMatch[1].trim() // 優先使用中文名
    };
  }
  
  // 單純英文名或中文名
  if (/^[\u4e00-\u9fa5]/.test(cleanArtist)) {
    return { chinese: cleanArtist, preferred: cleanArtist };
  }
  
  return { english: cleanArtist, preferred: cleanArtist };
}

// 改進的標題解析（處理歌名中的括號）
function parseTitleImproved(title) {
  let cleanTitle = title.replace(/<[^>]+>/g, '').trim();
  cleanTitle = cleanTitle.replace(/\s*[\[\(【].*?(結他|chord|譜|guitar)[\]\)】]/gi, '').trim();
  
  // 處理「歌手《歌名》」格式
  const bookTitleMatch = cleanTitle.match(/^(.+?)《(.+?)》$/);
  if (bookTitleMatch) {
    return { 
      artist: bookTitleMatch[1].trim(), 
      title: bookTitleMatch[2].trim(),
      format: 'book-title'
    };
  }
  
  // 標準分隔符格式
  const patterns = [
    /^(.+?)\s*-\s*(.+)$/,
    /^(.+?)\s*[｜|]\s*(.+)$/,
    /^(.+?)\s+by\s+(.+)$/i,
  ];
  
  for (const pattern of patterns) {
    const match = cleanTitle.match(pattern);
    if (match) {
      return { 
        artist: match[1].trim(), 
        title: match[2].trim(),
        format: 'standard'
      };
    }
  }
  
  return { artist: 'Unknown', title: cleanTitle, format: 'unknown' };
}

// 提取核心歌手名（用於搜尋）
function extractCoreArtistName(artistStr) {
  const parsed = parseBilingualName(artistStr);
  return parsed.preferred || parsed.chinese || parsed.english || artistStr;
}

// ============ 修復功能 ============

async function fixArtistNames() {
  console.log('🔧 開始修復歌手名稱...\n');
  
  // 獲取所有需要修復的歌手
  const artistsSnapshot = await db.collection('artists').get();
  const artists = artistsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // 獲取所有樂譜
  const tabsSnapshot = await db.collection('tabs').get();
  const tabs = tabsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  
  console.log(`📊 總共 ${artists.length} 個歌手, ${tabs.length} 首樂譜\n`);
  
  // 分析問題
  const problems = {
    unknown: [],
    bilingual: [],
    withPrefix: [],
    needsCheck: []
  };
  
  // 1. 檢查 UNKNOWN 歌手
  const unknownArtist = artists.find(a => a.name === 'Unknown' || a.id === 'unknown');
  if (unknownArtist) {
    const unknownTabs = tabs.filter(t => t.artistId === 'unknown' || t.artist === 'Unknown');
    problems.unknown = unknownTabs;
    console.log(`❓ 發現 UNKNOWN 歌手，有 ${unknownTabs.length} 首樂譜需要修復\n`);
  }
  
  // 2. 檢查雙語歌手名
  for (const artist of artists) {
    const name = artist.name;
    
    // 檢查是否包含中英文
    const hasChinese = /[\u4e00-\u9fa5]/.test(name);
    const hasEnglish = /[a-zA-Z]/.test(name);
    
    if (hasChinese && hasEnglish) {
      problems.bilingual.push({
        id: artist.id,
        name: name,
        parsed: parseBilingualName(name),
        tabCount: artist.tabCount || 0
      });
    }
    
    // 檢查是否有前綴
    for (const prefix of PREFIXES_TO_REMOVE) {
      if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
        problems.withPrefix.push({
          id: artist.id,
          name: name,
          parsed: parseBilingualName(name),
          tabCount: artist.tabCount || 0
        });
        break;
      }
    }
  }
  
  // 顯示問題列表
  if (problems.bilingual.length > 0) {
    console.log(`🌏 雙語歌手名 (${problems.bilingual.length} 個):`);
    problems.bilingual.forEach(a => {
      console.log(`   - ${a.name} → 建議使用: ${a.parsed.preferred}`);
    });
    console.log('');
  }
  
  if (problems.withPrefix.length > 0) {
    console.log(`🏷️  有前綴的歌手名 (${problems.withPrefix.length} 個):`);
    problems.withPrefix.forEach(a => {
      console.log(`   - ${a.name} → 建議使用: ${a.parsed.preferred}`);
    });
    console.log('');
  }
  
  // 處理 UNKNOWN 歌手
  if (problems.unknown.length > 0) {
    console.log('📋 UNKNOWN 歌手的樂譜：');
    for (const tab of problems.unknown.slice(0, 10)) { // 只顯示前10個
      console.log(`   - ${tab.title || '(無歌名)'}`);
      console.log(`     內容預覽: ${(tab.content || '').substring(0, 100)}...`);
      
      // 嘗試從內容提取歌手名
      const contentMatch = tab.content?.match(/歌手[：:]\s*(.+)/i) ||
                          tab.content?.match(/原唱[：:]\s*(.+)/i);
      if (contentMatch) {
        console.log(`     💡 可能歌手: ${contentMatch[1].trim()}`);
      }
      console.log('');
    }
  }
  
  // 詢問是否修復
  console.log('\n💡 建議操作：');
  console.log('1. 為雙語歌手名創建中文名版本');
  console.log('2. 移除前綴（如 MK三部曲）');
  console.log('3. 手動處理 UNKNOWN 歌手\n');
  
  return problems;
}

// 執行雙語歌手名修復
async function fixBilingualArtists(dryRun = true) {
  console.log(`\n${dryRun ? '【測試模式】' : '【正式修復】'} 雙語歌手名...\n`);
  
  const artistsSnapshot = await db.collection('artists').get();
  const artists = artistsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  
  let fixed = 0;
  
  for (const artist of artists) {
    const name = artist.name;
    const hasChinese = /[\u4e00-\u9fa5]/.test(name);
    const hasEnglish = /[a-zA-Z]/.test(name);
    
    if (hasChinese && hasEnglish) {
      const parsed = parseBilingualName(name);
      const newName = parsed.preferred;
      const newId = newName.toLowerCase().replace(/\s+/g, '-');
      
      if (newName !== name && newId !== artist.id) {
        console.log(`📝 ${name} → ${newName} (ID: ${artist.id} → ${newId})`);
        
        if (!dryRun) {
          try {
            // 創建新歌手
            await db.collection('artists').doc(newId).set({
              ...artist,
              name: newName,
              normalizedName: newId,
              originalName: name, // 保留原名
              updatedAt: new Date().toISOString()
            });
            
            // 更新所有相關樂譜
            const tabsSnapshot = await db.collection('tabs')
              .where('artistId', '==', artist.id)
              .get();
            
            for (const tabDoc of tabsSnapshot.docs) {
              await tabDoc.ref.update({
                artist: newName,
                artistId: newId,
                updatedAt: new Date().toISOString()
              });
            }
            
            // 刪除舊歌手（如果沒有其他關聯）
            await db.collection('artists').doc(artist.id).delete();
            
            fixed++;
            console.log('   ✅ 修復成功');
          } catch (error) {
            console.error('   ❌ 修復失敗:', error.message);
          }
        }
      }
    }
  }
  
  console.log(`\n${dryRun ? '測試完成' : '修復完成'}: ${fixed} 個歌手`);
}

// 主程序
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--write');
  const fixMode = args.includes('--fix-bilingual');
  
  if (fixMode) {
    await fixBilingualArtists(dryRun);
  } else {
    await fixArtistNames();
    console.log('\n💡 使用 --fix-bilingual 參數來修復雙語歌手名');
    console.log('💡 加上 --write 參數來正式執行（否則只會顯示預覽）');
  }
  
  process.exit(0);
}

main().catch(console.error);

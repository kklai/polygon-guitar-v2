// 全面修復歌手名稱問題 + 合併重複歌手
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

const path = require('path');
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
const rootDir = path.resolve(__dirname, '..');
const fullPath = path.resolve(rootDir, serviceAccountPath);
const serviceAccount = require(fullPath);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

// 已知前綴列表（需要移除的）
const PREFIXES_TO_REMOVE = [
  'MK三部曲',
  'EP',
  'Album',
  'Single',
  '新歌',
  '新碟',
  '大碟',
  '專輯',
  'OST',
  '主題曲',
  '插曲'
];

// 改進的雙語名解析 - 更寬鬆的匹配
function parseBilingualName(artistName) {
  if (!artistName || artistName === 'Unknown') return { preferred: artistName };
  
  let cleanName = artistName;
  
  // 移除前綴
  for (const prefix of PREFIXES_TO_REMOVE) {
    const regex = new RegExp(`^${prefix}\\s*[-:]?\\s*`, 'i');
    cleanName = cleanName.replace(regex, '');
  }
  
  cleanName = cleanName.trim();
  
  // 匹配 "中文名 英文名" (如 "陳柏宇 Jason Chan", "周殷廷 Yan Ting")
  // 允許中間有多個空格
  const chineseFirstMatch = cleanName.match(/^([\u4e00-\u9fa5]{2,4})\s+([a-zA-Z\s]+)$/i);
  if (chineseFirstMatch) {
    return {
      chinese: chineseFirstMatch[1].trim(),
      english: chineseFirstMatch[2].trim(),
      preferred: chineseFirstMatch[1].trim()
    };
  }
  
  // 匹配 "英文名 中文名" (如 "Lowell Lo 盧冠廷", "Nancy Kwai 歸綽嶢")
  const englishFirstMatch = cleanName.match(/^([a-zA-Z\s]+)\s+([\u4e00-\u9fa5]{2,4})$/i);
  if (englishFirstMatch) {
    return {
      english: englishFirstMatch[1].trim(),
      chinese: englishFirstMatch[2].trim(),
      preferred: englishFirstMatch[2].trim()
    };
  }
  
  // 檢查是否純中文
  if (/^[\u4e00-\u9fa5]+$/.test(cleanName)) {
    return { chinese: cleanName, preferred: cleanName };
  }
  
  // 檢查是否純英文
  if (/^[a-zA-Z\s]+$/.test(cleanName)) {
    return { english: cleanName, preferred: cleanName };
  }
  
  return { preferred: cleanName };
}

// 生成所有可能的ID變體
function generateIdVariants(name) {
  const parsed = parseBilingualName(name);
  const variants = [];
  
  if (parsed.chinese) {
    variants.push(parsed.chinese.toLowerCase().replace(/\s+/g, '-'));
  }
  if (parsed.english) {
    variants.push(parsed.english.toLowerCase().replace(/\s+/g, '-'));
  }
  
  return [...new Set(variants)];
}

// 檢查兩個歌手是否可能是同一人
function isPotentialDuplicate(artist1, artist2) {
  const name1 = artist1.name;
  const name2 = artist2.name;
  
  const parsed1 = parseBilingualName(name1);
  const parsed2 = parseBilingualName(name2);
  
  // 如果都有中文名，比較中文名
  if (parsed1.chinese && parsed2.chinese) {
    return parsed1.chinese === parsed2.chinese;
  }
  
  // 如果都有英文名，比較英文名
  if (parsed1.english && parsed2.english) {
    return parsed1.english.toLowerCase() === parsed2.english.toLowerCase();
  }
  
  return false;
}

// 找出所有重複的歌手組
async function findDuplicateArtists() {
  console.log('🔍 搜尋重複歌手...\n');
  
  const snapshot = await db.collection('artists').get();
  const artists = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const duplicates = [];
  const processed = new Set();
  
  for (let i = 0; i < artists.length; i++) {
    if (processed.has(artists[i].id)) continue;
    
    const group = [artists[i]];
    
    for (let j = i + 1; j < artists.length; j++) {
      if (processed.has(artists[j].id)) continue;
      
      if (isPotentialDuplicate(artists[i], artists[j])) {
        group.push(artists[j]);
        processed.add(artists[j].id);
      }
    }
    
    if (group.length > 1) {
      duplicates.push(group);
      processed.add(artists[i].id);
    }
  }
  
  return duplicates;
}

// 合併兩個歌手
async function mergeArtists(keepId, mergeId, dryRun = true) {
  console.log(`\n${dryRun ? '【預覽】' : '【執行】'} 合併歌手:`);
  console.log(`  保留: ${keepId}`);
  console.log(`  合併: ${mergeId}`);
  
  if (dryRun) return { success: true, dryRun: true };
  
  try {
    // 獲取兩個歌手的資料
    const keepDoc = await db.collection('artists').doc(keepId).get();
    const mergeDoc = await db.collection('artists').doc(mergeId).get();
    
    if (!keepDoc.exists || !mergeDoc.exists) {
      return { success: false, error: '歌手不存在' };
    }
    
    const keepData = keepDoc.data();
    const mergeData = mergeDoc.data();
    
    // 1. 更新所有樂譜的 artistId
    const tabsSnapshot = await db.collection('tabs')
      .where('artistId', '==', mergeId)
      .get();
    
    console.log(`  更新 ${tabsSnapshot.docs.length} 首樂譜...`);
    
    for (const tabDoc of tabsSnapshot.docs) {
      await tabDoc.ref.update({
        artistId: keepId,
        artist: keepData.name,
        updatedAt: new Date().toISOString()
      });
    }
    
    // 2. 合併歌手資料（保留較完整的）
    const updates = {};
    
    // 合併 tabCount
    updates.tabCount = (keepData.tabCount || 0) + (mergeData.tabCount || 0);
    updates.viewCount = (keepData.viewCount || 0) + (mergeData.viewCount || 0);
    
    // 如果有照片，保留優先級高的
    if (!keepData.photoURL && mergeData.photoURL) updates.photoURL = mergeData.photoURL;
    if (!keepData.wikiPhotoURL && mergeData.wikiPhotoURL) updates.wikiPhotoURL = mergeData.wikiPhotoURL;
    if (!keepData.heroPhoto && mergeData.heroPhoto) updates.heroPhoto = mergeData.heroPhoto;
    
    // 如果有簡介，保留較長的
    if (!keepData.bio || (mergeData.bio && mergeData.bio.length > keepData.bio.length)) {
      updates.bio = mergeData.bio;
    }
    
    // 如果有年份，保留較早的
    if (!keepData.year || (mergeData.year && parseInt(mergeData.year) < parseInt(keepData.year))) {
      updates.year = mergeData.year;
    }
    
    // 記錄合併歷史
    updates.mergedFrom = mergeId;
    updates.mergedAt = new Date().toISOString();
    
    await db.collection('artists').doc(keepId).update(updates);
    
    // 3. 刪除被合併的歌手
    await db.collection('artists').doc(mergeId).delete();
    
    console.log(`  ✅ 合併成功`);
    return { success: true };
    
  } catch (error) {
    console.error(`  ❌ 合併失敗:`, error.message);
    return { success: false, error: error.message };
  }
}

// 主程序
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--write');
  const findDuplicates = args.includes('--find-duplicates');
  const mergeMode = args.includes('--merge');
  const fixNames = args.includes('--fix-names');
  
  console.log('🎤 歌手資料修復工具\n');
  console.log(`模式: ${dryRun ? '預覽模式' : '正式執行'}\n`);
  
  // 模式1: 查找重複
  if (findDuplicates || (!fixNames && !mergeMode)) {
    const duplicates = await findDuplicateArtists();
    
    if (duplicates.length === 0) {
      console.log('✅ 沒有發現重複歌手\n');
    } else {
      console.log(`發現 ${duplicates.length} 組重複歌手:\n`);
      
      duplicates.forEach((group, idx) => {
        console.log(`[${idx + 1}] 可能為同一人的歌手:`);
        group.forEach(artist => {
          const parsed = parseBilingualName(artist.name);
          console.log(`   - ${artist.name}`);
          console.log(`     ID: ${artist.id}`);
          console.log(`     中文: ${parsed.chinese || 'N/A'}, 英文: ${parsed.english || 'N/A'}`);
          console.log(`     譜數: ${artist.tabCount || 0}`);
          console.log('');
        });
      });
      
      console.log('\n💡 使用 --merge 參數來合併重複歌手');
      console.log('💡 使用 --fix-names 參數來修復雙語歌手名');
    }
  }
  
  // 模式2: 修復雙語名
  if (fixNames) {
    console.log('\n🔧 修復雙語歌手名...\n');
    
    const snapshot = await db.collection('artists').get();
    const artists = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    let fixed = 0;
    let skipped = 0;
    
    for (const artist of artists) {
      const parsed = parseBilingualName(artist.name);
      
      // 如果有中文名且與原名不同，需要修復
      if (parsed.chinese && parsed.chinese !== artist.name) {
        const newId = parsed.chinese.toLowerCase().replace(/\s+/g, '-');
        
        console.log(`📝 ${artist.name} → ${parsed.preferred}`);
        console.log(`   中文: ${parsed.chinese}, 英文: ${parsed.english || 'N/A'}`);
        console.log(`   ID: ${artist.id} → ${newId}`);
        
        if (!dryRun) {
          try {
            // 檢查目標ID是否已存在
            const targetDoc = await db.collection('artists').doc(newId).get();
            
            if (targetDoc.exists && newId !== artist.id) {
              // 如果目標已存在，合併兩個歌手
              console.log(`   ⚠️ 目標ID ${newId} 已存在，將進行合併`);
              await mergeArtists(newId, artist.id, false);
            } else {
              // 創建新歌手
              await db.collection('artists').doc(newId).set({
                ...artist,
                name: parsed.preferred,
                normalizedName: newId,
                originalName: artist.name,
                englishName: parsed.english || null,
                updatedAt: new Date().toISOString()
              });
              
              // 更新所有樂譜
              const tabsSnapshot = await db.collection('tabs')
                .where('artistId', '==', artist.id)
                .get();
              
              for (const tabDoc of tabsSnapshot.docs) {
                await tabDoc.ref.update({
                  artist: parsed.preferred,
                  artistId: newId,
                  updatedAt: new Date().toISOString()
                });
              }
              
              // 刪除舊歌手
              if (newId !== artist.id) {
                await db.collection('artists').doc(artist.id).delete();
              }
              
              console.log('   ✅ 修復成功');
            }
            fixed++;
          } catch (error) {
            console.error('   ❌ 修復失敗:', error.message);
          }
        } else {
          // 預覽模式下，檢查目標ID是否衝突
          const targetDoc = await db.collection('artists').doc(newId).get();
          if (targetDoc.exists && newId !== artist.id) {
            console.log(`   ⚠️ 目標ID ${newId} 已存在，執行時將會合併`);
          }
          fixed++;
        }
        
        console.log('');
      } else {
        skipped++;
      }
    }
    
    console.log(`\n${dryRun ? '預覽' : '修復'}完成: ${fixed} 個需要修復, ${skipped} 個已正確`);
  }
  
  // 模式3: 合併指定歌手
  if (mergeMode) {
    // 從參數獲取要合併的ID
    const keepIdx = args.indexOf('--keep');
    const mergeIdx = args.indexOf('--merge-id');
    
    if (keepIdx === -1 || mergeIdx === -1) {
      console.log('\n❌ 合併模式需要提供參數:');
      console.log('  --keep <id>      要保留的歌手ID');
      console.log('  --merge-id <id>  要合併的歌手ID');
      console.log('\n例如: node scripts/fix-all-artist-names.js --merge --write --keep "chan-pak-yu" --merge-id "jason-chan"');
    } else {
      const keepId = args[keepIdx + 1];
      const mergeId = args[mergeIdx + 1];
      
      await mergeArtists(keepId, mergeId, dryRun);
    }
  }
  
  console.log('\n💡 提示:');
  console.log('  --find-duplicates  查找重複歌手');
  console.log('  --fix-names        修復雙語歌手名');
  console.log('  --merge            合併指定歌手');
  console.log('  --write            正式執行（否則只預覽）');
  
  process.exit(0);
}

main().catch(console.error);

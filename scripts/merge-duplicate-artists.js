// 合併重複歌手腳本
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

// 計算兩個字符串嘅相似度（簡單版）
function similarity(s1, s2) {
  s1 = s1.toLowerCase().replace(/\s+/g, '');
  s2 = s2.toLowerCase().replace(/\s+/g, '');
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // 計算共同字符
  const set1 = new Set(s1);
  const set2 = new Set(s2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  return intersection.size / Math.max(set1.size, set2.size);
}

// 提取核心名（淨中文）
function extractCoreName(name) {
  const chineseMatch = name.match(/[\u4e00-\u9fa5]{2,}/);
  return chineseMatch ? chineseMatch[0] : name;
}

async function mergeDuplicateArtists() {
  console.log('🔍 檢查重複歌手...\n');
  
  const snapshot = await db.collection('artists').get();
  const artists = [];
  
  snapshot.forEach(doc => {
    artists.push({ id: doc.id, ...doc.data() });
  });
  
  // 搵相似歌手
  const duplicates = [];
  
  for (let i = 0; i < artists.length; i++) {
    for (let j = i + 1; j < artists.length; j++) {
      const a1 = artists[i];
      const a2 = artists[j];
      
      const core1 = extractCoreName(a1.name);
      const core2 = extractCoreName(a2.name);
      
      // 如果核心名相同，或者相似度超過 0.8
      if (core1 === core2 || similarity(a1.name, a2.name) > 0.8) {
        duplicates.push({
          keep: a1,      // 保留第一個
          remove: a2,    // 刪除第二個
          reason: core1 === core2 ? '核心名相同' : '相似度高'
        });
      }
    }
  }
  
  if (duplicates.length === 0) {
    console.log('✅ 沒有發現重複歌手');
    return;
  }
  
  console.log(`⚠️ 發現 ${duplicates.length} 對重複歌手:\n`);
  
  for (const dup of duplicates) {
    console.log(`合併: "${dup.keep.name}" ← "${dup.remove.name}" (${dup.reason})`);
    
    // 1. 合併資料（保留最完整嘅）
    const mergedData = {
      name: dup.keep.name,
      normalizedName: dup.keep.normalizedName || dup.keep.id,
      // 如果 remove 有資料而 keep 冇，就用 remove 嘅
      ...(dup.keep.photoURL || dup.remove.photoURL ? { photoURL: dup.keep.photoURL || dup.remove.photoURL } : {}),
      ...(dup.keep.wikiPhotoURL || dup.remove.wikiPhotoURL ? { wikiPhotoURL: dup.keep.wikiPhotoURL || dup.remove.wikiPhotoURL } : {}),
      ...(dup.keep.bio || dup.remove.bio ? { bio: dup.keep.bio || dup.remove.bio } : {}),
      ...(dup.keep.year || dup.remove.year ? { year: dup.keep.year || dup.remove.year } : {}),
      ...(dup.keep.artistType || dup.remove.artistType ? { artistType: dup.keep.artistType || dup.remove.artistType } : {}),
      tabCount: (dup.keep.tabCount || 0) + (dup.remove.tabCount || 0),
      viewCount: (dup.keep.viewCount || 0) + (dup.remove.viewCount || 0),
      updatedAt: new Date().toISOString()
    };
    
    // 2. 更新保留嘅歌手
    await db.collection('artists').doc(dup.keep.id).update(mergedData);
    console.log(`  ✓ 更新 "${dup.keep.name}" 資料`);
    
    // 3. 更新所有相關歌曲
    const songsQuery = await db.collection('tabs')
      .where('artistId', '==', dup.remove.id)
      .get();
    
    let updatedSongs = 0;
    const batch = db.batch();
    
    songsQuery.forEach(doc => {
      batch.update(doc.ref, {
        artistId: dup.keep.id,
        artist: dup.keep.name
      });
      updatedSongs++;
    });
    
    if (updatedSongs > 0) {
      await batch.commit();
      console.log(`  ✓ 更新 ${updatedSongs} 首歌曲`);
    }
    
    // 4. 刪除重複歌手
    await db.collection('artists').doc(dup.remove.id).delete();
    console.log(`  ✓ 刪除 "${dup.remove.name}"\n`);
  }
  
  console.log('✅ 合併完成！');
}

mergeDuplicateArtists().catch(console.error);

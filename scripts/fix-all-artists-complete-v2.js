// 為所有無類型/無相歌手搜索維基百科資料（完整版，無數量限制）
const admin = require('firebase-admin');
const axios = require('axios');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const WRITE_MODE = process.argv.includes('--write');
const BATCH_SIZE = 50; // 每批處理數量（只是日誌分組用，不是限制）

// 生成搜索變體
function generateSearchVariants(name) {
  const variants = [name];
  
  // 1. 移除常見後綴
  const withoutEnglish = name.replace(/^[A-Za-z\s]+/, '').trim();
  if (withoutEnglish && withoutEnglish !== name) variants.push(withoutEnglish);
  
  // 2. 只保留英文部分
  const englishOnly = name.match(/^([A-Za-z\s]+)/)?.[1]?.trim();
  if (englishOnly && englishOnly !== name && englishOnly.length > 1) variants.push(englishOnly);
  
  // 3. 清理特殊字符
  const cleanName = name.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  if (cleanName && cleanName !== name && !variants.includes(cleanName)) variants.push(cleanName);
  
  return [...new Set(variants)];
}

// 搜索維基百科
async function searchWikipedia(name) {
  const headers = { 'User-Agent': 'PolygonGuitarBot/1.0 (kermit@example.com)' };
  const variants = generateSearchVariants(name);
  
  for (const variant of variants) {
    try {
      // 中文維基
      const zhResponse = await axios.get('https://zh.wikipedia.org/w/api.php', {
        headers, timeout: 10000,
        params: { action: 'query', list: 'search', srsearch: variant, format: 'json', origin: '*', srlimit: 3 }
      });
      
      if (zhResponse.data.query.search.length > 0) {
        const results = zhResponse.data.query.search;
        const exactMatch = results.find(r => r.title === variant || r.title.includes(variant) || variant.includes(r.title));
        const bestMatch = exactMatch || results[0];
        const details = await getWikiDetails(bestMatch.title, 'zh');
        if (details) return { ...details, matchedVariant: variant };
      }
    } catch (e) {}
    
    try {
      // 英文維基
      const enResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
        headers, timeout: 10000,
        params: { action: 'query', list: 'search', srsearch: variant, format: 'json', origin: '*', srlimit: 3 }
      });
      
      if (enResponse.data.query.search.length > 0) {
        const results = enResponse.data.query.search;
        const exactMatch = results.find(r => r.title.toLowerCase() === variant.toLowerCase());
        const bestMatch = exactMatch || results[0];
        const details = await getWikiDetails(bestMatch.title, 'en');
        if (details) return { ...details, matchedVariant: variant };
      }
    } catch (e) {}
  }
  
  return null;
}

// 獲取維基詳細資訊
async function getWikiDetails(title, lang) {
  try {
    const url = lang === 'zh' ? 'https://zh.wikipedia.org/w/api.php' : 'https://en.wikipedia.org/w/api.php';
    
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'PolygonGuitarBot/1.0 (kermit@example.com)' },
      timeout: 10000,
      params: {
        action: 'query', prop: 'extracts|pageimages', titles: title, format: 'json', origin: '*',
        exintro: true, explaintext: true, pithumbsize: 400
      }
    });
    
    const pages = response.data.query.pages;
    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];
    
    if (pageId === '-1') return null;
    
    const extract = page.extract || '';
    
    // 提取類型
    let artistType = 'unknown';
    if (lang === 'zh') {
      if (extract.includes('男歌手') || extract.includes('男藝人')) artistType = 'male';
      else if (extract.includes('女歌手') || extract.includes('女藝人')) artistType = 'female';
      else if (extract.includes('樂團') || extract.includes('組合') || extract.includes('樂隊')) artistType = 'group';
    } else {
      if (extract.match(/band|group|duo|trio|quartet/i)) artistType = 'group';
      else if (extract.match(/singer|musician|rapper/i)) {
        if (extract.match(/\bshe\b|\bher\b|female/i)) artistType = 'female';
        else if (extract.match(/\bhe\b|\bhis\b|male/i)) artistType = 'male';
      }
    }
    
    // 提取年份
    let birthYear = null, debutYear = null;
    if (lang === 'zh') {
      const birthMatch = extract.match(/(\d{4})年.*?出生/) || extract.match(/出生.*?(\d{4})/);
      if (birthMatch) birthYear = birthMatch[1];
      const debutMatch = extract.match(/(\d{4})年.*?出道/);
      if (debutMatch) debutYear = debutMatch[1];
    } else {
      const birthMatch = extract.match(/born[^\d]*(\d{4})/i);
      if (birthMatch) birthYear = birthMatch[1];
    }
    
    return {
      name: page.title,
      bio: extract.substring(0, 300) + (extract.length > 300 ? '...' : ''),
      artistType, birthYear, debutYear,
      wikiPhotoURL: page.thumbnail?.source || null,
      source: `wikipedia-${lang}`
    };
  } catch (error) {
    return null;
  }
}

// 主程序
async function main() {
  console.log('🔧 批量修復所有歌手維基資料 (v2 - 無限制版)');
  console.log('==========================================');
  console.log(`模式: ${WRITE_MODE ? '⚠️ 寫入模式' : '🔍 測試模式'}`);
  console.log('');
  
  const snapshot = await db.collection('artists').get();
  const allArtists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // 篩選需要修復的歌手（無類型 AND 無相）
  const needFix = allArtists.filter(a => {
    const hasNoType = !a.artistType || a.artistType === 'unknown';
    const hasNoPhoto = !a.wikiPhotoURL && !a.photoURL;
    return hasNoType && hasNoPhoto;
  });
  
  console.log(`📊 統計:`);
  console.log(`   總歌手: ${allArtists.length}`);
  console.log(`   需要修復: ${needFix.length} (無類型+無相)`);
  console.log(`   已有資料: ${allArtists.length - needFix.length}`);
  console.log('');
  
  if (needFix.length === 0) {
    console.log('✅ 所有歌手已有完整資料，無需處理');
    process.exit(0);
  }
  
  let successCount = 0;
  let failCount = 0;
  let hasPhotoCount = 0;
  let hasTypeCount = 0;
  const failed = [];
  
  // 處理所有需要修復的歌手
  for (let i = 0; i < needFix.length; i++) {
    const artist = needFix[i];
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(needFix.length / BATCH_SIZE);
    
    if (i % BATCH_SIZE === 0) {
      console.log(`\n📦 批次 ${batchNum}/${totalBatches} (處理第 ${i+1}-${Math.min(i+BATCH_SIZE, needFix.length)} 個)`);
      console.log('─'.repeat(50));
    }
    
    process.stdout.write(`[${i + 1}/${needFix.length}] ${artist.name}... `);
    
    const wikiData = await searchWikipedia(artist.name);
    
    if (wikiData) {
      const updates = [];
      if (wikiData.wikiPhotoURL) updates.push('📷');
      if (wikiData.artistType && wikiData.artistType !== 'unknown') updates.push(`🏷️${wikiData.artistType}`);
      if (wikiData.birthYear) updates.push(`📅${wikiData.birthYear}`);
      
      console.log(`✓ ${wikiData.name} ${updates.join(' ')}`);
      
      if (wikiData.wikiPhotoURL) hasPhotoCount++;
      if (wikiData.artistType && wikiData.artistType !== 'unknown') hasTypeCount++;
      
      if (WRITE_MODE) {
        const updateData = {
          wikiPhotoURL: wikiData.wikiPhotoURL || null,
          bio: wikiData.bio || artist.bio || '',
          updatedAt: new Date().toISOString()
        };
        
        if (wikiData.artistType && wikiData.artistType !== 'unknown') {
          updateData.artistType = wikiData.artistType;
        }
        if (wikiData.birthYear) updateData.birthYear = wikiData.birthYear;
        if (wikiData.debutYear) updateData.debutYear = wikiData.debutYear;
        
        try {
          await db.collection('artists').doc(artist.id).update(updateData);
        } catch (e) {
          console.log(`   ⚠️ 更新失敗: ${e.message}`);
          failCount++;
          failed.push(artist.name);
          continue;
        }
      }
      successCount++;
    } else {
      console.log(`✗ 未找到`);
      failed.push(artist.name);
      failCount++;
    }
    
    // 每個請求間隔 1.5 秒避免 API 限制
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📈 最終統計:');
  console.log(`   處理總數: ${needFix.length}`);
  console.log(`   ✅ 成功找到資料: ${successCount}`);
  console.log(`   📷 獲得相片: ${hasPhotoCount}`);
  console.log(`   🏷️ 獲得類型: ${hasTypeCount}`);
  console.log(`   ❌ 未找到: ${failCount}`);
  
  if (failed.length > 0) {
    console.log(`\n⚠️ 未找到的歌手 (${failed.length}個):`);
    failed.forEach((name, i) => console.log(`   ${i + 1}. ${name}`));
  }
  
  if (!WRITE_MODE) {
    console.log('\n💡 這是測試模式。要正式更新數據庫，請運行:');
    console.log('   node scripts/fix-all-artists-complete-v2.js --write');
  } else {
    console.log('\n✅ 已寫入數據庫');
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('❌ 錯誤:', err);
  process.exit(1);
});

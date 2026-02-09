// 為所有歌手搜索維基百科資料
const admin = require('firebase-admin');
const axios = require('axios');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const WRITE_MODE = process.argv.includes('--write');

// 生成搜索變體
function generateSearchVariants(name) {
  const variants = [name];
  
  // 1. 移除常見後綴（如 "劉卓軒" 從 "Hinry Lau 劉卓軒"）
  const withoutEnglish = name.replace(/^[A-Za-z\s]+/, '').trim();
  if (withoutEnglish && withoutEnglish !== name) {
    variants.push(withoutEnglish);
  }
  
  // 2. 只保留英文部分
  const englishOnly = name.match(/^([A-Za-z\s]+)/)?.[1]?.trim();
  if (englishOnly && englishOnly !== name) {
    variants.push(englishOnly);
  }
  
  // 3. 移除數字和特殊字符
  const cleanName = name.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  if (cleanName && cleanName !== name && !variants.includes(cleanName)) {
    variants.push(cleanName);
  }
  
  // 4. 簡體/繁體轉換（常見對照）
  const tradToSimp = {
    '劉': '刘', '張': '张', '陳': '陈', '黃': '黄', '楊': '杨',
    '謝': '谢', '鄧': '邓', '許': '许', '鄭': '郑', '韋': '韦',
    '盧': '卢', '蘇': '苏', '葉': '叶', '鄒': '邹', '羅': '罗',
    '蔣': '蒋', '龐': '庞', '趙': '赵', '孫': '孙', '馬': '马',
    '劉': '刘', '關': '关', '陸': '陆', '風': '风', '東': '东',
    '華': '華', '萬': '万', '響': '千', '堅': '坚', '樂': '乐',
    '隊': '队', '電': '电', '視': '视', '劇': '剧', '電': '电',
    '電': '电'
  };
  
  let simpName = name;
  Object.entries(tradToSimp).forEach(([trad, simp]) => {
    simpName = simpName.replace(new RegExp(trad, 'g'), simp);
  });
  if (simpName !== name && !variants.includes(simpName)) {
    variants.push(simpName);
  }
  
  // 5. 繁體版本
  const simpToTrad = Object.fromEntries(
    Object.entries(tradToSimp).map(([k, v]) => [v, k])
  );
  let tradName = name;
  Object.entries(simpToTrad).forEach(([simp, trad]) => {
    tradName = tradName.replace(new RegExp(simp, 'g'), trad);
  });
  if (tradName !== name && !variants.includes(tradName)) {
    variants.push(tradName);
  }
  
  return [...new Set(variants)]; // 去重
}

// 搜索維基百科（帶重試）
async function searchWikipediaWithRetry(name, retries = 3) {
  const variants = generateSearchVariants(name);
  
  for (const variant of variants) {
    for (let i = 0; i < retries; i++) {
      try {
        const result = await searchWikipedia(variant);
        if (result) {
          return { ...result, matchedName: variant };
        }
      } catch (error) {
        if (error.response?.status === 429) {
          // 速率限制，等待更長時間
          await new Promise(resolve => setTimeout(resolve, 5000 * (i + 1)));
        } else {
          break; // 其他錯誤，嘗試下一個變體
        }
      }
    }
  }
  
  return null;
}

// 搜索維基百科
async function searchWikipedia(name) {
  const headers = {
    'User-Agent': 'PolygonGuitarBot/1.0 (kermit@example.com)'
  };
  
  // 嘗試中文維基
  try {
    const zhResponse = await axios.get('https://zh.wikipedia.org/w/api.php', {
      headers,
      timeout: 10000,
      params: {
        action: 'query',
        list: 'search',
        srsearch: name,
        format: 'json',
        origin: '*',
        srlimit: 5
      }
    });
    
    if (zhResponse.data.query.search.length > 0) {
      // 找到最佳匹配（標題相似度）
      const results = zhResponse.data.query.search;
      const exactMatch = results.find(r => r.title === name);
      const bestMatch = exactMatch || results[0];
      
      const details = await getWikiDetails(bestMatch.title, 'zh');
      if (details) return details;
    }
  } catch (e) {
    // 繼續嘗試英文
  }
  
  // 嘗試英文維基
  try {
    const enResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
      headers,
      timeout: 10000,
      params: {
        action: 'query',
        list: 'search',
        srsearch: name,
        format: 'json',
        origin: '*',
        srlimit: 5
      }
    });
    
    if (enResponse.data.query.search.length > 0) {
      const results = enResponse.data.query.search;
      const exactMatch = results.find(r => r.title.toLowerCase() === name.toLowerCase());
      const bestMatch = exactMatch || results[0];
      
      const details = await getWikiDetails(bestMatch.title, 'en');
      if (details) return details;
    }
  } catch (e) {
    // 失敗
  }
  
  return null;
}

// 獲取維基詳細資訊
async function getWikiDetails(title, lang) {
  try {
    const url = lang === 'zh' 
      ? 'https://zh.wikipedia.org/w/api.php'
      : 'https://en.wikipedia.org/w/api.php';
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'PolygonGuitarBot/1.0 (kermit@example.com)'
      },
      timeout: 10000,
      params: {
        action: 'query',
        prop: 'extracts|pageimages',
        titles: title,
        format: 'json',
        origin: '*',
        exintro: true,
        explaintext: true,
        pithumbsize: 300
      }
    });
    
    const pages = response.data.query.pages;
    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];
    
    if (pageId === '-1') return null;
    
    const extract = page.extract || '';
    
    // 提取類型
    let artistType = 'unknown';
    
    // 中文判斷
    if (lang === 'zh') {
      if (extract.includes('男歌手') || extract.includes('男藝人') || extract.includes('男演員')) artistType = 'male';
      else if (extract.includes('女歌手') || extract.includes('女藝人') || extract.includes('女演員')) artistType = 'female';
      else if (extract.includes('樂團') || extract.includes('組合') || extract.includes('樂隊') || extract.includes('樂隊')) artistType = 'group';
    } 
    // 英文判斷
    else {
      if (extract.match(/singer|musician|rapper/i)) {
        if (extract.match(/\bshe\b|\bher\b|female|actress/i)) artistType = 'female';
        else if (extract.match(/\bhe\b|\bhis\b|male|actor\b/i)) artistType = 'male';
      }
      if (extract.match(/band|group|duo|trio|quartet/i)) artistType = 'group';
    }
    
    // 提取年份
    let birthYear = null;
    let debutYear = null;
    
    // 中文年份格式
    const yearMatch = extract.match(/(\d{4})年.*?出生/) || 
                      extract.match(/出生.*?(\d{4})/) ||
                      extract.match(/(\d{4})年.*?誕生/);
    if (yearMatch) birthYear = yearMatch[1];
    
    const debutMatch = extract.match(/(\d{4})年.*?出道/) || 
                       extract.match(/出道.*?(\d{4})/);
    if (debutMatch) debutYear = debutMatch[1];
    
    // 英文年份格式
    if (!birthYear && lang === 'en') {
      const enYearMatch = extract.match(/born[^\d]*(\d{4})/i) ||
                          extract.match(/\b(\d{4})\b.*?birth/i);
      if (enYearMatch) birthYear = enYearMatch[1];
    }
    
    return {
      name: page.title,
      bio: extract.substring(0, 400),
      artistType,
      birthYear,
      debutYear,
      wikiPhotoURL: page.thumbnail?.source || null,
      source: `wikipedia-${lang}`
    };
  } catch (error) {
    return null;
  }
}

// 主程序
async function main() {
  console.log('🔧 批量修復歌手維基資料');
  console.log('=======================');
  console.log(`模式: ${WRITE_MODE ? '⚠️ 寫入模式' : '🔍 測試模式'}`);
  console.log('');
  
  const snapshot = await db.collection('artists').get();
  const artists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // 篩選需要修復的歌手
  const needFix = artists.filter(a => 
    (!a.artistType || a.artistType === 'unknown') || 
    (!a.photoURL && !a.wikiPhotoURL && !a.photo)
  );
  
  console.log(`總歌手: ${artists.length}`);
  console.log(`需要修復: ${needFix.length}`);
  console.log('');
  
  let successCount = 0;
  let failCount = 0;
  const failed = [];
  
  for (let i = 0; i < needFix.length; i++) {
    const artist = needFix[i];
    console.log(`[${i + 1}/${needFix.length}] ${artist.name}`);
    
    const wikiData = await searchWikipediaWithRetry(artist.name);
    
    if (wikiData) {
      console.log(`  ✓ 匹配: ${wikiData.matchedName} → ${wikiData.name}`);
      console.log(`    類型: ${wikiData.artistType}, 年份: ${wikiData.birthYear || wikiData.debutYear || 'N/A'}`);
      
      if (WRITE_MODE) {
        const updates = {
          wikiPhotoURL: wikiData.wikiPhotoURL || null,
          bio: wikiData.bio || artist.bio || '',
          updatedAt: new Date().toISOString()
        };
        
        if (wikiData.artistType && wikiData.artistType !== 'unknown') {
          updates.artistType = wikiData.artistType;
        }
        if (wikiData.birthYear) updates.birthYear = wikiData.birthYear;
        if (wikiData.debutYear) updates.debutYear = wikiData.debutYear;
        
        try {
          await db.collection('artists').doc(artist.id).update(updates);
          console.log('  ✓ 已更新');
          successCount++;
        } catch (e) {
          console.log('  ✗ 更新失敗:', e.message);
          failCount++;
        }
      } else {
        successCount++;
      }
    } else {
      console.log(`  ✗ 未找到資料`);
      failed.push(artist.name);
      failCount++;
    }
    
    // 延遲避免限制（2秒）
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n📈 統計:');
  console.log(`成功: ${successCount}`);
  console.log(`失敗: ${failCount}`);
  
  if (failed.length > 0) {
    console.log(`\n⚠️ 未找到的歌手 (${failed.length}個):`);
    failed.slice(0, 20).forEach(name => console.log(`  - ${name}`));
    if (failed.length > 20) console.log(`  ... 還有 ${failed.length - 20} 個`);
  }
  
  if (!WRITE_MODE) {
    console.log('\n💡 測試模式完成。要正式更新，加上 --write 參數');
  }
}

main().catch(console.error);

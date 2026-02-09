// 修復歌手資料 - 自動搜尋維基百科並填充缺失資訊
const admin = require('firebase-admin');
const axios = require('axios');
const serviceAccount = require('./firebase-service-account.json');

// 初始化 Firebase
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 判斷是否為寫入模式
const WRITE_MODE = process.argv.includes('--write');

// 搜尋維基百科
async function searchWikipedia(artistName) {
  try {
    const headers = {
      'User-Agent': 'PolygonGuitarBot/1.0 (kermit@example.com)'
    };
    
    // 嘗試中文維基
    const zhResponse = await axios.get('https://zh.wikipedia.org/w/api.php', {
      headers,
      params: {
        action: 'query',
        list: 'search',
        srsearch: artistName,
        format: 'json',
        origin: '*',
        srlimit: 3
      }
    });
    
    if (zhResponse.data.query.search.length > 0) {
      const bestMatch = zhResponse.data.query.search[0];
      // 獲取詳細資訊
      const details = await getWikiDetails(bestMatch.title, 'zh');
      if (details) return details;
    }
    
    // 嘗試英文維基
    const enResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
      headers: {
        'User-Agent': 'PolygonGuitarBot/1.0 (kermit@example.com)'
      },
      params: {
        action: 'query',
        list: 'search',
        srsearch: artistName,
        format: 'json',
        origin: '*',
        srlimit: 3
      }
    });
    
    if (enResponse.data.query.search.length > 0) {
      const bestMatch = enResponse.data.query.search[0];
      const details = await getWikiDetails(bestMatch.title, 'en');
      if (details) return details;
    }
    
    return null;
  } catch (error) {
    console.error(`搜尋失敗 ${artistName}:`, error.message);
    return null;
  }
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
    
    // 提取職業和類型
    const extract = page.extract || '';
    let artistType = 'unknown';
    
    if (lang === 'zh') {
      if (extract.includes('男歌手') || extract.includes('男藝人')) artistType = 'male';
      else if (extract.includes('女歌手') || extract.includes('女藝人')) artistType = 'female';
      else if (extract.includes('樂團') || extract.includes('組合') || extract.includes('樂隊')) artistType = 'group';
    } else {
      if (extract.match(/singer|musician|artist/i)) {
        // 需要更多上下文判斷性別
        if (extract.match(/\bshe\b|\bher\b|female/i)) artistType = 'female';
        else if (extract.match(/\bhe\b|\bhis\b|male/i)) artistType = 'male';
      }
      if (extract.match(/band|group/i)) artistType = 'group';
    }
    
    // 提取年份
    let birthYear = null;
    let debutYear = null;
    
    const yearMatch = extract.match(/(\d{4})年.*?出生/) || extract.match(/出生.*?(\d{4})/);
    if (yearMatch) birthYear = yearMatch[1];
    
    const debutMatch = extract.match(/(\d{4})年.*?出道/) || extract.match(/出道.*?(\d{4})/);
    if (debutMatch) debutYear = debutMatch[1];
    
    return {
      name: page.title,
      bio: extract.substring(0, 300),
      artistType,
      birthYear,
      debutYear,
      wikiPhotoURL: page.thumbnail?.source || null,
      source: `wikipedia-${lang}`
    };
  } catch (error) {
    console.error(`獲取詳情失敗 ${title}:`, error.message);
    return null;
  }
}

// 主程序
async function main() {
  console.log('🔧 歌手資料修復工具');
  console.log('====================');
  console.log(`模式: ${WRITE_MODE ? '⚠️ 寫入模式' : '🔍 測試模式'}`);
  console.log('');
  
  try {
    // 獲取所有歌手
    const snapshot = await db.collection('artists').get();
    const artists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`📊 共 ${artists.length} 個歌手`);
    
    // 篩選需要修復的歌手（無類型或無簡介）
    const needFix = artists.filter(a => 
      (!a.artistType || a.artistType === 'unknown') || 
      !a.bio || 
      (!a.photoURL && !a.wikiPhotoURL)
    );
    
    console.log(`需要修復: ${needFix.length} 個歌手\n`);
    
    let fixedCount = 0;
    let failedCount = 0;
    const failed = [];
    
    for (const artist of needFix.slice(0, 100)) { // 先處理前100個
      console.log(`[${fixedCount + failedCount + 1}/${Math.min(100, needFix.length)}] ${artist.name}`);
      
      const wikiData = await searchWikipedia(artist.name);
      
      if (wikiData) {
        console.log(`  ✓ 找到維基資料: ${wikiData.name}`);
        console.log(`    類型: ${wikiData.artistType}, 年份: ${wikiData.birthYear || wikiData.debutYear || 'N/A'}`);
        
        if (WRITE_MODE) {
          const updates = {
            wikiPhotoURL: wikiData.wikiPhotoURL || null,
            bio: wikiData.bio || artist.bio || '',
            updatedAt: new Date().toISOString()
          };
          
          // 只有當值有效時才更新
          if (wikiData.artistType && wikiData.artistType !== 'unknown') {
            updates.artistType = wikiData.artistType;
          }
          if (wikiData.birthYear) {
            updates.birthYear = wikiData.birthYear;
          }
          if (wikiData.debutYear) {
            updates.debutYear = wikiData.debutYear;
          }
          
          await db.collection('artists').doc(artist.id).update(updates);
          console.log('  ✓ 已更新');
          
          // 延遲避免限制（維基 API 限制）
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        fixedCount++;
      } else {
        console.log(`  ✗ 未找到資料`);
        failed.push(artist.name);
        failedCount++;
      }
    }
    
    console.log('\n📈 統計:');
    console.log(`成功: ${fixedCount}`);
    console.log(`失敗: ${failedCount}`);
    
    if (failed.length > 0 && failed.length <= 20) {
      console.log('\n⚠️ 未找到的歌手:');
      failed.forEach(name => console.log(`  - ${name}`));
    }
    
    if (!WRITE_MODE) {
      console.log('\n💡 測試模式完成。要正式更新，加上 --write 參數');
    }
    
  } catch (error) {
    console.error('\n❌ 執行失敗:', error.message);
    process.exit(1);
  }
}

main();

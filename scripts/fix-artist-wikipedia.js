const admin = require('firebase-admin');
const axios = require('axios');
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 從 wikipedia.js 複製相關函數
function extractCoreName(artistName) {
  if (!artistName) return '';
  let name = artistName.replace(/\s*[\(（].*?[\)）]\s*/g, '');
  const chineseMatch = name.match(/[\u4e00-\u9fa5]{2,}/);
  if (chineseMatch) return chineseMatch[0];
  return name.trim().split(/\s+/)[0];
}

function generateNameVariants(artistName) {
  const variants = [artistName];
  const coreName = extractCoreName(artistName);
  if (coreName && coreName !== artistName) variants.push(coreName);
  return variants;
}

async function tryFetchArtist(artistName) {
  try {
    const response = await axios.get(
      `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artistName)}`,
      { 
        headers: { 
          'Accept-Language': 'zh-HK,zh-TW;q=0.9,zh-CN;q=0.8',
          'User-Agent': 'PolygonGuitar/1.0'
        },
        timeout: 5000
      }
    );
    
    if (response.status !== 200) return null;
    const data = response.data;
    
    if (data.extract && data.type !== 'disambiguation') {
      return {
        name: data.title,
        bio: data.extract,
        photoUrl: data.thumbnail?.source || null,
        originalImage: data.originalimage?.source || null,
        birthYear: extractYear(data.extract, 'birth'),
        debutYear: extractYear(data.extract, 'debut'),
        source: 'wikipedia'
      };
    }
    
    // 消歧義頁，試加後綴
    if (data.type === 'disambiguation' || !data.extract) {
      const suffixes = [' (歌手)', ' (藝人)', ' (樂隊)', ' (組合)'];
      for (const suffix of suffixes) {
        try {
          const r2 = await axios.get(
            `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artistName + suffix)}`,
            { 
              headers: { 
                'Accept-Language': 'zh-HK,zh-TW;q=0.9,zh-CN;q=0.8',
                'User-Agent': 'PolygonGuitar/1.0'
              },
              timeout: 5000
            }
          );
          if (r2.status === 200 && r2.data.extract) {
            return {
              name: r2.data.title,
              bio: r2.data.extract,
              photoUrl: r2.data.thumbnail?.source || null,
              originalImage: r2.data.originalimage?.source || null,
              birthYear: extractYear(r2.data.extract, 'birth'),
              debutYear: extractYear(r2.data.extract, 'debut'),
              source: 'wikipedia'
            };
          }
        } catch (e) {}
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

function extractYear(text, type) {
  if (!text) return null;
  
  if (type === 'birth') {
    // 匹配「1990年」或「（1990年）」
    const match = text.match(/(\d{4})年/);
    if (match) {
      const year = parseInt(match[1]);
      // 合理年份範圍
      if (year > 1900 && year < 2020) return year;
    }
  }
  
  if (type === 'debut') {
    const match = text.match(/(\d{4})年.*出道/);
    if (match) return parseInt(match[1]);
  }
  
  return null;
}

async function searchArtistFromWikipedia(artistName) {
  if (!artistName?.trim()) return null;
  const nameVariants = generateNameVariants(artistName);
  
  for (const name of nameVariants) {
    const data = await tryFetchArtist(name);
    if (data) return data;
  }
  return null;
}

async function fixArtists() {
  console.log('=== 開始修復歌手資料 ===\n');
  
  const snapshot = await db.collection('artists').get();
  const artists = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  
  console.log('總歌手數:', artists.length);
  
  // 只處理冇照片嘅歌手
  const needFix = artists.filter(a => !a.photoUrl && !a.bio);
  console.log('需要修復（冇照片+冇bio）:', needFix.length);
  
  let success = 0;
  let failed = 0;
  let skipped = 0;
  
  for (let i = 0; i < needFix.length; i++) {
    const artist = needFix[i];
    console.log(`\n[${i + 1}/${needFix.length}] ${artist.name}`);
    
    // 跳過非歌手名稱
    if (artist.name.match(/\[|\]|[教學]|[分享]|Cover|Rockschool|Party|排行榜/i)) {
      console.log('  ⏭️ 跳過（非歌手）');
      skipped++;
      continue;
    }
    
    const wikiData = await searchArtistFromWikipedia(artist.name);
    
    if (wikiData) {
      try {
        await db.collection('artists').doc(artist.id).update({
          photoUrl: wikiData.photoUrl,
          heroPhoto: wikiData.originalImage,
          bio: wikiData.bio,
          birthYear: wikiData.birthYear,
          debutYear: wikiData.debutYear,
          wikipediaUrl: `https://zh.wikipedia.org/wiki/${encodeURIComponent(wikiData.name)}`,
          updatedAt: new Date().toISOString()
        });
        console.log('  ✅ 成功');
        if (wikiData.photoUrl) console.log('     照片:', wikiData.photoUrl.substring(0, 50) + '...');
        if (wikiData.birthYear) console.log('     出生:', wikiData.birthYear);
        success++;
      } catch (e) {
        console.log('  ❌ 更新失敗:', e.message);
        failed++;
      }
    } else {
      console.log('  ❌ 維基百科搵唔到');
      failed++;
    }
    
    // 延遲避免被封
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n=== 修復完成 ===');
  console.log('成功:', success);
  console.log('失敗:', failed);
  console.log('跳過:', skipped);
}

fixArtists().catch(console.error);

// 為所有歌手重新獲取完整維基資料（包括出生年份和出道年份）
const admin = require('firebase-admin');
const axios = require('axios');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 搜索維基百科
async function searchWikipedia(artistName) {
  try {
    const response = await axios.get('https://zh.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        list: 'search',
        srsearch: artistName,
        format: 'json',
        origin: '*',
        srlimit: 3
      },
      headers: {
        'User-Agent': 'PolygonGuitarBot/1.0'
      }
    });
    
    const results = response.data?.query?.search || [];
    if (results.length === 0) return null;
    return results[0].title;
  } catch (e) {
    return null;
  }
}

// 獲取歌手詳細資料
async function getArtistDetails(pageTitle) {
  try {
    const response = await axios.get('https://zh.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        prop: 'revisions|pageimages',
        titles: pageTitle,
        format: 'json',
        origin: '*',
        rvprop: 'content',
        rvslots: 'main',
        piprop: 'thumbnail',
        pithumbsize: 400
      },
      headers: {
        'User-Agent': 'PolygonGuitarBot/1.0'
      }
    });
    
    const pages = response.data?.query?.pages || {};
    const page = Object.values(pages)[0];
    
    if (!page || page.missing) return null;
    
    const content = page.revisions?.[0]?.slots?.main?.['*'] || '';
    const photoUrl = page.thumbnail?.source || null;
    
    // 提取類型
    let artistType = 'unknown';
    if (content.includes('男歌手')) artistType = 'male';
    else if (content.includes('女歌手')) artistType = 'female';
    else if (content.includes('組合') || content.includes('樂隊')) artistType = 'group';
    
    // 提取出生年份 - 查找出生日期
    let birthYear = null;
    const birthPatterns = [
      /\|\s*出生日期\s*=\s*(\d{4})年/,
      /\|\s*出生\s*=\s*(\d{4})年/,
      /\{\{Birth date[^}]*(\d{4})/,
      /(\d{4})年\s*\d{1,2}月\s*\d{1,2}日.*出生/
    ];
    
    for (const pattern of birthPatterns) {
      const match = content.match(pattern);
      if (match) {
        birthYear = parseInt(match[1]);
        break;
      }
    }
    
    // 提取出道年份
    let debutYear = null;
    const debutPatterns = [
      /\|\s*出道日期\s*=\s*(\d{4})年/,
      /\|\s*出道\s*=\s*(\d{4})年/,
      /出道.*?(\d{4})年/
    ];
    
    for (const pattern of debutPatterns) {
      const match = content.match(pattern);
      if (match) {
        debutYear = parseInt(match[1]);
        break;
      }
    }
    
    return {
      artistType,
      birthYear,
      debutYear,
      wikiPhotoURL: photoUrl
    };
  } catch (e) {
    return null;
  }
}

async function fetchAll() {
  console.log('🌐 為所有歌手獲取完整維基資料\n');
  
  const artists = await db.collection('artists').get();
  let updatedCount = 0;
  
  for (const doc of artists.docs) {
    const artist = doc.data();
    
    console.log('🔍 ' + artist.name);
    
    const wikiTitle = await searchWikipedia(artist.name);
    if (!wikiTitle) {
      console.log('  ❌ 搵唔到');
      continue;
    }
    
    const details = await getArtistDetails(wikiTitle);
    if (!details) {
      console.log('  ❌ 獲取失敗');
      continue;
    }
    
    const updateData = {};
    
    if (details.artistType !== 'unknown') updateData.artistType = details.artistType;
    if (details.birthYear) updateData.birthYear = details.birthYear;
    if (details.debutYear) updateData.debutYear = details.debutYear;
    if (details.wikiPhotoURL) updateData.wikiPhotoURL = details.wikiPhotoURL;
    
    // 刪除舊嘅 year 欄位
    if (artist.year) {
      updateData.year = admin.firestore.FieldValue.delete();
    }
    
    if (Object.keys(updateData).length > 0) {
      await doc.ref.update(updateData);
      console.log('  ✓ 類型:' + details.artistType + ' 出生:' + (details.birthYear || '-') + ' 出道:' + (details.debutYear || '-'));
      updatedCount++;
    } else {
      console.log('  ⏭️ 無新資料');
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log('\n✅ 更新了 ' + updatedCount + ' 個歌手');
}

fetchAll().then(() => process.exit(0));

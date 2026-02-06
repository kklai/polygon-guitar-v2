// 修復歌手出生年份
const admin = require('firebase-admin');
const axios = require('axios');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function getBirthYear(pageTitle) {
  try {
    const response = await axios.get('https://zh.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        prop: 'revisions',
        titles: pageTitle,
        format: 'json',
        origin: '*',
        rvprop: 'content',
        rvslots: 'main'
      },
      headers: {
        'User-Agent': 'PolygonGuitarBot/1.0 (https://polygon-guitar-v2.vercel.app)'
      }
    });
    
    const pages = response.data?.query?.pages || {};
    const page = Object.values(pages)[0];
    
    if (!page || page.missing) return null;
    
    const content = page.revisions?.[0]?.slots?.main?.['*'] || '';
    
    // 提取出生年份
    const birthMatch = content.match(/\|\s*出生(?:日期)?\s*=\s*(\d{4})年/);
    if (birthMatch) return parseInt(birthMatch[1]);
    
    const bornMatch = content.match(/(\d{4})年(?:\s*\d{1,2}月)?\s*出生/);
    if (bornMatch) return parseInt(bornMatch[1]);
    
    return null;
  } catch (e) {
    return null;
  }
}

async function fixBirthYears() {
  console.log('📅 修復歌手出生年份\n');
  
  const artists = await db.collection('artists').get();
  let updatedCount = 0;
  
  for (const doc of artists.docs) {
    const artist = doc.data();
    
    if (!artist.wikiTitle) {
      console.log('⏭️  跳過: ' + artist.name + ' (無維基標題)');
      continue;
    }
    
    console.log('🔍 ' + artist.name + ' (現有年份: ' + (artist.year || '無') + ')');
    
    const birthYear = await getBirthYear(artist.wikiTitle);
    
    if (birthYear && birthYear !== artist.year) {
      await doc.ref.update({ year: birthYear });
      console.log('  ✓ 更新為出生年份: ' + birthYear);
      updatedCount++;
    } else if (!birthYear) {
      console.log('  ⚠️ 搵唔到出生年份');
    } else {
      console.log('  ⏭️  年份正確，無需更新');
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log('\n✅ 完成！更新了 ' + updatedCount + ' 個歌手');
}

fixBirthYears().then(() => process.exit(0));

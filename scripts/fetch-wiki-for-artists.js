// 自動為新歌手獲取維基百科資料（使用繁體中文）
const admin = require('firebase-admin');
const axios = require('axios');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 轉換為繁體中文（簡單轉換常見字）
function toTraditional(name) {
  const simplifed = {
    '学': '學', '东': '東', '伟': '偉', '杰': '傑', '强': '強',
    '张': '張', '陈': '陳', '刘': '劉', '黄': '黃', '邓': '鄧',
    '孙': '孫', '赵': '趙', '周': '周', '吴': '吳', '徐': '徐',
    '马': '馬', '朱': '朱', '胡': '胡', '林': '林', '郭': '郭',
    '何': '何', '高': '高', '罗': '羅', '郑': '鄭', '梁': '梁',
    '谢': '謝', '宋': '宋', '唐': '唐', '韩': '韓', '冯': '馮',
    '于': '於', '董': '董', '萧': '蕭', '程': '程', '曹': '曹',
    '袁': '袁', '傅': '傅', '沈': '瀋', '曾': '曾', '彭': '彭',
    '吕': '呂', '苏': '蘇', '卢': '盧', '蒋': '蔣', '蔡': '蔡',
    '贾': '賈', '丁': '丁', '魏': '魏', '薛': '薛', '叶': '葉',
    '阎': '閻', '余': '餘', '潘': '潘', '杜': '杜', '戴': '戴',
    '夏': '夏', '钟': '鍾', '汪': '汪', '田': '田', '任': '任',
    '姜': '姜', '范': '範', '方': '方', '石': '石', '姚': '姚',
    '谭': '譚', '廖': '廖', '邹': '鄒', '熊': '熊', '金': '金',
    '陆': '陸', '郝': '郝', '孔': '孔', '白': '白', '崔': '崔',
    '康': '康', '毛': '毛', '邱': '邱', '秦': '秦', '江': '江',
    '史': '史', '顾': '顧', '侯': '侯', '邵': '邵', '孟': '孟',
    '龙': '龍', '万': '萬', '段': '段', '雷': '雷', '钱': '錢',
    '汤': '湯', '尹': '尹', '黎': '黎', '易': '易', '常': '常',
    '武': '武', '乔': '喬', '贺': '賀', '兰': '蘭', '龚': '龔',
    '文': '文', '赖': '賴', '庞': '龐'
  };
  
  return name.split('').map(c => simplifed[c] || c).join('');
}

// 搜索維基百科（繁體中文）
async function searchWikipedia(artistName) {
  try {
    // 轉換為繁體中文搜索
    const traditionalName = toTraditional(artistName);
    
    const response = await axios.get('https://zh.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        list: 'search',
        srsearch: traditionalName,
        format: 'json',
        origin: '*',
        srlimit: 3
      },
      headers: {
        'User-Agent': 'PolygonGuitarBot/1.0 (https://polygon-guitar-v2.vercel.app)'
      }
    });
    
    const results = response.data?.query?.search || [];
    if (results.length === 0) return null;
    
    // 搵最匹配嘅結果
    const bestMatch = results.find(r => {
      const title = toTraditional(r.title);
      return title.includes(traditionalName) || traditionalName.includes(title);
    }) || results[0];
    
    return bestMatch.title;
  } catch (e) {
    console.error('搜索失敗:', e.message);
    return null;
  }
}

// 獲取歌手詳細資料
async function getArtistDetails(pageTitle) {
  try {
    // 獲取頁面內容
    const contentResponse = await axios.get('https://zh.wikipedia.org/w/api.php', {
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
    
    const pages = contentResponse.data?.query?.pages || {};
    const page = Object.values(pages)[0];
    
    if (!page || page.missing) return null;
    
    const content = page.revisions?.[0]?.slots?.main?.['*'] || '';
    
    // 獲取圖片
    const imageResponse = await axios.get('https://zh.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        prop: 'pageimages',
        titles: pageTitle,
        format: 'json',
        origin: '*',
        piprop: 'thumbnail',
        pithumbsize: 400
      },
      headers: {
        'User-Agent': 'PolygonGuitarBot/1.0 (https://polygon-guitar-v2.vercel.app)'
      }
    });
    
    const imagePages = imageResponse.data?.query?.pages || {};
    const imagePage = Object.values(imagePages)[0];
    const photoUrl = imagePage?.thumbnail?.source || null;
    
    // 提取類型
    let artistType = 'unknown';
    const typeKeywords = {
      '男歌手': 'male',
      '女歌手': 'female',
      '組合': 'group',
      '樂隊': 'group',
      '樂團': 'group'
    };
    
    for (const [keyword, type] of Object.entries(typeKeywords)) {
      if (content.includes(keyword)) {
        artistType = type;
        break;
      }
    }
    
    // 提取出生年份
    let birthYear = null;
    const birthMatch = content.match(/\|\s*出生日期\s*=\s*(\d{4})年/);
    if (birthMatch) birthYear = parseInt(birthMatch[1]);
    
    // 提取出道年份
    let debutYear = null;
    const debutMatch = content.match(/\|\s*出道日期\s*=\s*(\d{4})年/);
    if (debutMatch) debutYear = parseInt(debutMatch[1]);
    
    // 備用：搵「出道」關鍵字
    if (!debutYear) {
      const altDebut = content.match(/出道.*?(\d{4})年/);
      if (altDebut) debutYear = parseInt(altDebut[1]);
    }
    
    return {
      wikiTitle: pageTitle,
      bio: '香港歌手',
      wikiPhotoURL: photoUrl,
      artistType,
      birthYear,
      debutYear,
      wikiUrl: `https://zh.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`
    };
  } catch (e) {
    console.error('獲取詳情失敗:', e.message);
    return null;
  }
}

async function fetchWikiForArtists() {
  console.log('🌐 為歌手獲取維基百科資料（使用繁體中文）\n');
  
  const artistsSnap = await db.collection('artists').get();
  let updatedCount = 0;
  
  for (const doc of artistsSnap.docs) {
    const artist = doc.data();
    
    // 如果已有完整資料，跳過
    if (artist.wikiPhotoURL && artist.artistType !== 'unknown') {
      console.log('⏭️  跳過: ' + artist.name + ' (已有資料)');
      continue;
    }
    
    console.log('\n🔍 處理: ' + artist.name);
    
    // 搜索維基（使用繁體中文）
    const wikiTitle = await searchWikipedia(artist.name);
    if (!wikiTitle) {
      console.log('  ❌ 搵唔到維基頁面');
      continue;
    }
    
    console.log('  ✓ 搵到: ' + wikiTitle);
    
    // 獲取詳情
    const details = await getArtistDetails(wikiTitle);
    if (!details) {
      console.log('  ❌ 獲取詳情失敗');
      continue;
    }
    
    // 更新歌手資料
    const updateData = {
      wikiTitle: details.wikiTitle,
      wikiUrl: details.wikiUrl,
      updatedAt: new Date().toISOString()
    };
    
    if (details.wikiPhotoURL) updateData.wikiPhotoURL = details.wikiPhotoURL;
    if (details.birthYear) updateData.birthYear = details.birthYear;
    if (details.debutYear) updateData.debutYear = details.debutYear;
    
    // 如果類型係 unknown，用維基嘅類型
    if (artist.artistType === 'unknown' && details.artistType !== 'unknown') {
      updateData.artistType = details.artistType;
      console.log('  🏷️ 類型: ' + details.artistType);
    }
    
    if (details.birthYear) console.log('  📅 出生: ' + details.birthYear);
    if (details.debutYear) console.log('  🎤 出道: ' + details.debutYear);
    if (details.wikiPhotoURL) console.log('  🖼️  有圖片');
    
    await doc.ref.update(updateData);
    updatedCount++;
    
    // 延遲避免限制
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n✅ 完成！更新了 ' + updatedCount + ' 個歌手');
}

fetchWikiForArtists().then(() => process.exit(0)).catch(e => {
  console.error('❌ 錯誤:', e);
  process.exit(1);
});

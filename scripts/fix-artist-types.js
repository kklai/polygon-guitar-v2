// 修復冇類型嘅歌手
const admin = require('firebase-admin');
const axios = require('axios');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 簡繁轉換
function toTraditional(name) {
  const simplified = {
    '学': '學', '东': '東', '伟': '偉', '杰': '傑', '强': '強',
    '张': '張', '陈': '陳', '刘': '劉', '黄': '黃', '邓': '鄧',
    '孙': '孫', '赵': '趙', '吴': '吳', '徐': '徐',
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
  return name.split('').map(c => simplified[c] || c).join('');
}

async function searchWikipedia(artistName) {
  try {
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
        'User-Agent': 'PolygonGuitarBot/1.0'
      }
    });
    
    const results = response.data?.query?.search || [];
    if (results.length === 0) return null;
    
    const bestMatch = results.find(r => {
      const title = toTraditional(r.title);
      return title.includes(traditionalName) || traditionalName.includes(title);
    }) || results[0];
    
    return bestMatch.title;
  } catch (e) {
    return null;
  }
}

async function getArtistType(pageTitle) {
  try {
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
        'User-Agent': 'PolygonGuitarBot/1.0'
      }
    });
    
    const pages = contentResponse.data?.query?.pages || {};
    const page = Object.values(pages)[0];
    
    if (!page || page.missing) return 'unknown';
    
    const content = page.revisions?.[0]?.slots?.main?.['*'] || '';
    
    // 提取類型
    const typeKeywords = {
      '男歌手': 'male',
      '女歌手': 'female',
      '組合': 'group',
      '樂隊': 'group',
      '樂團': 'group'
    };
    
    for (const [keyword, type] of Object.entries(typeKeywords)) {
      if (content.includes(keyword)) {
        return type;
      }
    }
    
    return 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

async function fixArtistTypes() {
  console.log('🔧 修復冇類型嘅歌手\n');
  
  // 搵冇類型嘅歌手
  const allArtists = await db.collection('artists').get();
  const needFix = [];
  
  allArtists.forEach(doc => {
    const data = doc.data();
    const type = data.artistType;
    if (!type || type === 'unknown' || type === '') {
      needFix.push({ id: doc.id, name: data.name });
    }
  });
  
  console.log(`搵到 ${needFix.length} 個冇類型嘅歌手\n`);
  
  let updated = 0;
  let failed = 0;
  
  for (const artist of needFix) {
    try {
      // 跳過特殊類別
      if (['兒歌', 'Forward', '永倫籃球會', '忍者亂太郎'].includes(artist.name)) {
        await db.collection('artists').doc(artist.id).update({ artistType: 'other' });
        console.log(`✓ ${artist.name} → 其他 (other)`);
        updated++;
        continue;
      }
      
      // 搵維基
      const wikiTitle = await searchWikipedia(artist.name);
      if (!wikiTitle) {
        console.log(`⚠️  搵唔到: ${artist.name}`);
        failed++;
        continue;
      }
      
      // 攞類型
      const artistType = await getArtistType(wikiTitle);
      
      if (artistType !== 'unknown') {
        await db.collection('artists').doc(artist.id).update({ artistType });
        console.log(`✓ ${artist.name} → ${artistType}`);
        updated++;
      } else {
        console.log(`? ${artist.name} - 類型未知`);
        failed++;
      }
      
      // 延遲
      await new Promise(r => setTimeout(r, 300));
      
    } catch (e) {
      console.error(`❌ ${artist.name}: ${e.message}`);
      failed++;
    }
  }
  
  console.log(`\n✅ 完成！更新: ${updated}, 失敗: ${failed}`);
  process.exit(0);
}

fixArtistTypes().catch(console.error);

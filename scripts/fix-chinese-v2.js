const admin = require('firebase-admin');
const axios = require('axios');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const WRITE = process.argv.includes('--write');

function hasChinese(name) {
  return /[\u4e00-\u9fa5]/.test(name);
}

function extractChinese(name) {
  const chinese = name.match(/[\u4e00-\u9fa5]+/g);
  return chinese ? chinese.join('') : name;
}

// 嚴格匹配：wiki標題必須包含完整中文名
function isStrictMatch(chineseName, wikiTitle) {
  // 移除空格比較
  const cleanWiki = wikiTitle.replace(/\s+/g, '');
  const cleanName = chineseName.replace(/\s+/g, '');
  
  // 完全包含
  if (cleanWiki.includes(cleanName)) return true;
  if (cleanName.includes(cleanWiki) && cleanWiki.length >= 2) return true;
  
  return false;
}

async function searchWiki(chineseName) {
  const headers = { 'User-Agent': 'PolygonGuitarBot/1.0' };
  
  try {
    const zh = await axios.get('https://zh.wikipedia.org/w/api.php', {
      headers, timeout: 10000,
      params: { action: 'query', list: 'search', srsearch: chineseName, format: 'json', origin: '*', srlimit: 5 }
    });
    
    const results = zh.data.query.search;
    if (results.length === 0) return null;
    
    // 嚴格匹配
    for (const r of results) {
      if (isStrictMatch(chineseName, r.title)) {
        return await getDetails(r.title);
      }
    }
    
    // 如果沒有嚴格匹配，返回 null (不強行匹配)
    return null;
    
  } catch (e) { return null; }
}

async function getDetails(title) {
  try {
    const res = await axios.get('https://zh.wikipedia.org/w/api.php', {
      headers: { 'User-Agent': 'PolygonGuitarBot/1.0' },
      timeout: 10000,
      params: { action: 'query', prop: 'extracts|pageimages', titles: title, format: 'json', origin: '*', exintro: true, explaintext: true, pithumbsize: 400 }
    });
    
    const pages = res.data.query.pages;
    const page = pages[Object.keys(pages)[0]];
    if (page.missing) return null;
    
    const extract = page.extract || '';
    
    let type = 'unknown';
    if (extract.includes('男歌手') || extract.includes('男藝人')) type = 'male';
    else if (extract.includes('女歌手') || extract.includes('女藝人')) type = 'female';
    else if (extract.includes('樂團') || extract.includes('組合') || extract.includes('樂隊')) type = 'group';
    
    let birth = null, debut = null;
    const bm = extract.match(/(\d{4})年.*?出生/);
    if (bm) birth = bm[1];
    const dm = extract.match(/(\d{4})年.*?出道/);
    if (dm) debut = dm[1];
    
    return {
      name: page.title,
      type, birth, debut,
      photo: page.thumbnail?.source || null,
      bio: extract.substring(0, 200)
    };
  } catch (e) { return null; }
}

async function main() {
  console.log('處理中文名歌手 (v2 - 嚴格匹配)');
  console.log('===============================');
  console.log('Mode:', WRITE ? 'WRITE' : 'DRY RUN');
  console.log('');
  
  const snap = await db.collection('artists').get();
  const artists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const needFix = artists.filter(a => {
    const hasCN = hasChinese(a.name);
    const noType = !a.artistType || a.artistType === 'unknown';
    const noPhoto = !a.wikiPhotoURL && !a.photoURL;
    return hasCN && noType && noPhoto;
  });
  
  console.log(`總歌手: ${artists.length}`);
  console.log(`中文名待處理: ${needFix.length}`);
  console.log('');
  
  let success = 0, fail = 0;
  const failed = [];
  
  for (let i = 0; i < needFix.length; i++) {
    const a = needFix[i];
    const chineseName = extractChinese(a.name);
    
    console.log(`[${i+1}/${needFix.length}] ${a.name}`);
    console.log(`  搜尋: ${chineseName}`);
    
    const data = await searchWiki(chineseName);
    
    if (data && (data.type !== 'unknown' || data.photo)) {
      const tags = [];
      if (data.photo) tags.push('photo');
      if (data.type !== 'unknown') tags.push(data.type);
      if (data.birth) tags.push(data.birth);
      
      console.log(`  匹配: ${data.name} [${tags.join(', ')}]`);
      
      if (WRITE) {
        const upd = { 
          wikiPhotoURL: data.photo, 
          bio: data.bio || '', 
          updatedAt: new Date().toISOString() 
        };
        if (data.type !== 'unknown') upd.artistType = data.type;
        if (data.birth) upd.birthYear = data.birth;
        if (data.debut) upd.debutYear = data.debut;
        await db.collection('artists').doc(a.id).update(upd);
        console.log('  [已更新]');
      }
      success++;
    } else {
      console.log('  [未找到]');
      fail++;
      failed.push(a.name);
    }
    
    await new Promise(r => setTimeout(r, 800));
  }
  
  console.log('\n========== 結果 ==========');
  console.log(`成功: ${success}, 失敗: ${fail}`);
  
  if (failed.length > 0) {
    console.log('\n以下歌手需要手動處理:');
    failed.forEach((n, i) => console.log(`  ${i+1}. ${n}`));
  }
  
  if (!WRITE) {
    console.log('\n使用 --write 參數來應用更改');
  }
}

main().catch(console.error);

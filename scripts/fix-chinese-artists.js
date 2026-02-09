const admin = require('firebase-admin');
const axios = require('axios');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const WRITE = process.argv.includes('--write');

// 檢查是否包含中文
function hasChinese(name) {
  return /[\u4e00-\u9fa5]/.test(name);
}

// 提取中文部分
function extractChinese(name) {
  const chinese = name.match(/[\u4e00-\u9fa5]+/g);
  return chinese ? chinese.join('') : name;
}

async function searchWiki(name) {
  const headers = { 'User-Agent': 'PolygonGuitarBot/1.0' };
  const searchName = extractChinese(name) || name;
  
  try {
    const zh = await axios.get('https://zh.wikipedia.org/w/api.php', {
      headers, timeout: 10000,
      params: { action: 'query', list: 'search', srsearch: searchName, format: 'json', origin: '*', srlimit: 5 }
    });
    
    const results = zh.data.query.search;
    if (results.length === 0) return null;
    
    // 找最佳匹配
    for (const r of results) {
      const title = r.title;
      // 直接包含關係
      if (title.includes(searchName) || searchName.includes(title)) {
        return await getDetails(title);
      }
    }
    
    // 如果沒有精確匹配，取第一個（只要是歌手相關）
    return await getDetails(results[0].title);
    
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
    
    // 提取類型
    let type = 'unknown';
    if (extract.includes('男歌手') || extract.includes('男藝人')) type = 'male';
    else if (extract.includes('女歌手') || extract.includes('女藝人')) type = 'female';
    else if (extract.includes('樂團') || extract.includes('組合') || extract.includes('樂隊')) type = 'group';
    
    // 提取年份
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
  console.log('處理中文名歌手');
  console.log('==============');
  console.log('Mode:', WRITE ? 'WRITE' : 'DRY RUN');
  console.log('');
  
  const snap = await db.collection('artists').get();
  const artists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // 篩選：有中文名 + 無類型 + 無相
  const needFix = artists.filter(a => {
    const hasCN = hasChinese(a.name);
    const noType = !a.artistType || a.artistType === 'unknown';
    const noPhoto = !a.wikiPhotoURL && !a.photoURL;
    return hasCN && noType && noPhoto;
  });
  
  console.log(`總歌手: ${artists.length}`);
  console.log(`中文名待處理: ${needFix.length}`);
  console.log(`純英文名待處理: ${artists.filter(a => !hasChinese(a.name) && (!a.artistType || a.artistType === 'unknown') && !a.wikiPhotoURL).length} (跳過)`);
  console.log('');
  
  if (needFix.length === 0) {
    console.log('沒有需要處理的中文名歌手');
    process.exit(0);
  }
  
  let success = 0, fail = 0;
  const failed = [];
  
  for (let i = 0; i < needFix.length; i++) {
    const a = needFix[i];
    const searchName = extractChinese(a.name);
    
    console.log(`[${i+1}/${needFix.length}] ${a.name} (搜: ${searchName})`);
    
    const data = await searchWiki(a.name);
    
    if (data && (data.type !== 'unknown' || data.photo)) {
      const tags = [];
      if (data.photo) tags.push('photo');
      if (data.type !== 'unknown') tags.push(data.type);
      if (data.birth) tags.push(data.birth);
      
      console.log(`  -> ${data.name} [${tags.join(', ')}]`);
      
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
        console.log('  [UPDATED]');
      }
      success++;
    } else {
      console.log('  [NOT FOUND]');
      fail++;
      failed.push(a.name);
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n--- RESULT ---');
  console.log(`Success: ${success}, Failed: ${fail}`);
  
  if (failed.length > 0) {
    console.log('\nFailed (可能需要手動處理):');
    failed.forEach((n, i) => console.log(`  ${i+1}. ${n}`));
  }
  
  if (!WRITE) {
    console.log('\nRun with --write to apply changes');
  }
}

main().catch(console.error);

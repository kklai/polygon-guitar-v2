// 修復找不到的中文歌手（放寬匹配條件）
const admin = require('firebase-admin');
const axios = require('axios');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const WRITE = process.argv.includes('--write');

// 特定歌手修正（容易搵錯的）
const NAME_FIXES = {
  '方大同': '方大同',
  '何國榮': '何國榮',
  '周華健': '周華健',
  '周麗淇': '周勵淇', // 維基可能用這個名
  '林憶蓮': '林憶蓮',
  '林曉培': '林曉培',
  '林欣彤': '林欣彤',
  '林海峰': '林海峰',
  '林育群': '林育群',
  '梁漢文': '梁漢文',
  '梁詠琪': '梁詠琪',
  '梁靜茹': '梁靜茹',
  '楊丞琳': '楊丞琳',
  '楊千嬅': '楊千嬅',
  '薛之謙': '薛之謙',
  '陳勢安': '陳勢安',
};

function hasChinese(name) {
  return /[\u4e00-\u9fa5]/.test(name);
}

function extractChinese(name) {
  const chinese = name.match(/[\u4e00-\u9fa5]{2,}/g);
  return chinese ? chinese.join('') : name;
}

async function searchWikiFlexible(name) {
  const headers = { 'User-Agent': 'PolygonGuitarBot/1.0' };
  const searchName = NAME_FIXES[name] || extractChinese(name) || name;
  
  try {
    // 中文維基搜索
    const zh = await axios.get('https://zh.wikipedia.org/w/api.php', {
      headers, timeout: 10000,
      params: { 
        action: 'query', list: 'search', srsearch: searchName, 
        format: 'json', origin: '*', srlimit: 10 
      }
    });
    
    const results = zh.data.query.search;
    if (results.length === 0) return null;
    
    // 1. 先試完全匹配
    for (const r of results) {
      if (r.title === searchName) {
        return await getDetails(r.title);
      }
    }
    
    // 2. 試包含關係
    for (const r of results) {
      const t = r.title;
      // 標題包含搜索名，或搜索名包含標題
      if (t.includes(searchName) || searchName.includes(t)) {
        return await getDetails(r.title);
      }
    }
    
    // 3. 試相似度（Levenshtein 簡化版）
    for (const r of results) {
      const t = r.title;
      // 如果標題長度接近，且開頭相同
      if (Math.abs(t.length - searchName.length) <= 2 && 
          (t[0] === searchName[0] || t.includes(searchName.substring(0, 2)))) {
        return await getDetails(r.title);
      }
    }
    
    // 4. 如果以上都唔得，取第一個結果（只要不是消歧義）
    const first = results[0];
    if (!first.title.includes('消歧義') && !first.title.includes('disambiguation')) {
      return await getDetails(first.title);
    }
    
    return null;
  } catch (e) { 
    console.log('  錯誤:', e.message);
    return null; 
  }
}

async function getDetails(title) {
  try {
    const res = await axios.get('https://zh.wikipedia.org/w/api.php', {
      headers: { 'User-Agent': 'PolygonGuitarBot/1.0' },
      timeout: 10000,
      params: { 
        action: 'query', prop: 'extracts|pageimages', 
        titles: title, format: 'json', origin: '*', 
        exintro: true, explaintext: true, pithumbsize: 400 
      }
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
  console.log('修復找不到的中文歌手（放寬匹配）');
  console.log('================================');
  console.log('Mode:', WRITE ? 'WRITE' : 'DRY RUN');
  console.log('');
  
  const snap = await db.collection('artists').get();
  const artists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // 篩選：中文名 + 無類型 + 無相
  const needFix = artists.filter(a => {
    const hasCN = hasChinese(a.name);
    const noType = !a.artistType || a.artistType === 'unknown';
    const noPhoto = !a.wikiPhotoURL && !a.photoURL;
    return hasCN && noType && noPhoto;
  });
  
  console.log(`待處理: ${needFix.length} 個中文歌手`);
  console.log('');
  
  let success = 0, fail = 0;
  const failed = [];
  
  for (let i = 0; i < needFix.length; i++) {
    const a = needFix[i];
    const chineseName = extractChinese(a.name);
    
    console.log(`[${i+1}/${needFix.length}] ${a.name} (搜: ${chineseName})`);
    
    const data = await searchWikiFlexible(a.name);
    
    if (data && (data.type !== 'unknown' || data.photo)) {
      const tags = [];
      if (data.photo) tags.push('📷');
      if (data.type !== 'unknown') tags.push(data.type);
      if (data.birth) tags.push(data.birth);
      
      console.log(`  -> ${data.name} ${tags.join(' ')}`);
      
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
    console.log('\n未找到的歌手:');
    failed.forEach((n, i) => console.log(`  ${i+1}. ${n}`));
  }
  
  if (!WRITE) {
    console.log('\n使用 --write 參數來應用更改');
  }
}

main().catch(console.error);

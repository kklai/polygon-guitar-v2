const admin = require('firebase-admin');
const axios = require('axios');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const WRITE = process.argv.includes('--write');

function isEnglish(name) {
  return /^[A-Za-z0-9\s.&'-]+$/i.test(name);
}

function toTrad(text) {
  if (!text) return text;
  const map = {
    '国': '國', '义': '義', '韦': '韋', '麦': '麥', '亚': '亞',
    '会': '會', '来': '來', '历': '歷', '电': '電', '乐': '樂',
    '乐队': '樂隊', '歌手': '歌手', '音乐': '音樂', '美国': '美國',
    '英国': '英國', '创作': '創作', '发行': '發行', '专辑': '專輯'
  };
  return text.split('').map(c => map[c] || c).join('');
}

// Check if result is a person/band
function isValidArtist(snippet) {
  const s = snippet.toLowerCase();
  const musicTerms = ['singer', 'musician', 'band', 'artist', 'songwriter', 
                      'composer', 'rapper', 'vocalist', 'group', 'duo'];
  return musicTerms.some(t => s.includes(t));
}

async function searchEnWiki(name) {
  const headers = { 'User-Agent': 'PolygonGuitarBot/1.0' };
  
  try {
    const res = await axios.get('https://en.wikipedia.org/w/api.php', {
      headers, timeout: 10000,
      params: { 
        action: 'query', list: 'search', srsearch: name + ' singer', 
        format: 'json', origin: '*', srlimit: 5 
      }
    });
    
    const results = res.data.query.search;
    if (results.length === 0) return null;
    
    // Filter for music artists only
    const artistResults = results.filter(r => isValidArtist(r.snippet));
    if (artistResults.length === 0) return null;
    
    // Try exact match first
    for (const r of artistResults) {
      if (r.title.toLowerCase() === name.toLowerCase()) {
        return await getDetails(r.title);
      }
    }
    
    // Try starts with match
    for (const r of artistResults) {
      if (r.title.toLowerCase().startsWith(name.toLowerCase()) ||
          name.toLowerCase().startsWith(r.title.toLowerCase())) {
        return await getDetails(r.title);
      }
    }
    
    // Take first valid artist result
    return await getDetails(artistResults[0].title);
    
  } catch (e) { return null; }
}

async function getDetails(title) {
  try {
    const res = await axios.get('https://en.wikipedia.org/w/api.php', {
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
    
    // Extract type - more careful logic
    let type = 'unknown';
    const text = extract.toLowerCase();
    
    // Check for band/group first
    if (text.match(/\b(band|group|duo|trio|quartet|ensemble)\b/i)) {
      type = 'group';
    } else if (text.match(/\b(singer|musician|rapper|songwriter|vocalist)\b/i)) {
      // Check for gender clues
      const firstSentence = extract.split('.')[0].toLowerCase();
      if (firstSentence.match(/\bshe\b|her\b|\bfemale\b|actress/i)) {
        type = 'female';
      } else if (firstSentence.match(/\bhe\b|\bhis\b|\bmale\b|actor\b/i)) {
        type = 'male';
      }
    }
    
    // Extract year
    let birth = null;
    const bm = extract.match(/\(born\s+[^)]*(\d{4})/i) || 
               extract.match(/born\s+[^\d]*(\d{4})/i);
    if (bm) birth = bm[1];
    
    // Translate bio
    let bio = toTrad(extract.substring(0, 250));
    if (extract.length > 250) bio += '...';
    
    return {
      name: page.title,
      type, birth,
      photo: page.thumbnail?.source || null,
      bio: bio || '歌手'
    };
  } catch (e) { return null; }
}

async function main() {
  console.log('處理純英文名歌手 v2 (加強驗證)');
  console.log('==============================');
  console.log('Mode:', WRITE ? 'WRITE' : 'DRY RUN');
  console.log('');
  
  const snap = await db.collection('artists').get();
  const artists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const needFix = artists.filter(a => {
    const isEng = isEnglish(a.name);
    const noType = !a.artistType || a.artistType === 'unknown';
    const noPhoto = !a.wikiPhotoURL && !a.photoURL;
    return isEng && noType && noPhoto;
  });
  
  console.log(`總歌手: ${artists.length}`);
  console.log(`純英文名待處理: ${needFix.length}`);
  console.log('');
  
  let success = 0, fail = 0;
  const failed = [];
  
  for (let i = 0; i < needFix.length; i++) {
    const a = needFix[i];
    console.log(`[${i+1}/${needFix.length}] ${a.name}`);
    
    const data = await searchEnWiki(a.name);
    
    if (data && (data.type !== 'unknown' || data.photo)) {
      const tags = [];
      if (data.photo) tags.push('photo');
      if (data.type !== 'unknown') tags.push(data.type);
      if (data.birth) tags.push(data.birth);
      
      console.log(`  -> ${data.name} [${tags.join(', ')}]`);
      
      if (WRITE) {
        const upd = { 
          wikiPhotoURL: data.photo, 
          bio: data.bio, 
          updatedAt: new Date().toISOString() 
        };
        if (data.type !== 'unknown') upd.artistType = data.type;
        if (data.birth) upd.birthYear = data.birth;
        await db.collection('artists').doc(a.id).update(upd);
        console.log('  [已更新]');
      }
      success++;
    } else {
      console.log('  [未找到]');
      fail++;
      failed.push(a.name);
    }
    
    await new Promise(r => setTimeout(r, 1200));
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

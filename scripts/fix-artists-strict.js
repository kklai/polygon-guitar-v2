const admin = require('firebase-admin');
const axios = require('axios');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const WRITE = process.argv.includes('--write');
const TEST_ONLY = process.argv.includes('--test');

// Smart name matching
function isGoodMatch(artistName, wikiTitle) {
  const a = artistName.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
  const w = wikiTitle.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
  
  // Exact match
  if (a === w) return true;
  
  // Contains
  if (w.includes(a) || a.includes(w)) return true;
  
  // Similar (allow small differences)
  if (Math.abs(a.length - w.length) <= 2) {
    let diff = 0;
    const maxLen = Math.max(a.length, w.length);
    for (let i = 0; i < maxLen; i++) {
      if (a[i] !== w[i]) diff++;
    }
    if (diff <= 2) return true;
  }
  
  return false;
}

async function searchWiki(name) {
  const headers = { 'User-Agent': 'PolygonGuitarBot/1.0' };
  
  // Try Chinese wiki
  try {
    const zh = await axios.get('https://zh.wikipedia.org/w/api.php', {
      headers, timeout: 10000,
      params: { action: 'query', list: 'search', srsearch: name, format: 'json', origin: '*', srlimit: 5 }
    });
    
    for (const r of zh.data.query.search) {
      if (isGoodMatch(name, r.title)) {
        const details = await getDetails(r.title, 'zh');
        if (details) return details;
      }
    }
  } catch (e) {}
  
  // Try English wiki
  try {
    const en = await axios.get('https://en.wikipedia.org/w/api.php', {
      headers, timeout: 10000,
      params: { action: 'query', list: 'search', srsearch: name, format: 'json', origin: '*', srlimit: 5 }
    });
    
    for (const r of en.data.query.search) {
      if (isGoodMatch(name, r.title)) {
        const details = await getDetails(r.title, 'en');
        if (details) return details;
      }
    }
  } catch (e) {}
  
  return null;
}

async function getDetails(title, lang) {
  try {
    const url = lang === 'zh' ? 'https://zh.wikipedia.org/w/api.php' : 'https://en.wikipedia.org/w/api.php';
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'PolygonGuitarBot/1.0' },
      timeout: 10000,
      params: { action: 'query', prop: 'extracts|pageimages', titles: title, format: 'json', origin: '*', exintro: true, explaintext: true, pithumbsize: 400 }
    });
    
    const pages = res.data.query.pages;
    const page = pages[Object.keys(pages)[0]];
    if (page.missing) return null;
    
    const extract = page.extract || '';
    let type = 'unknown';
    
    if (lang === 'zh') {
      if (extract.includes('男歌手')) type = 'male';
      else if (extract.includes('女歌手')) type = 'female';
      else if (extract.includes('樂團') || extract.includes('組合') || extract.includes('樂隊')) type = 'group';
    } else {
      if (extract.match(/band|group|duo/i)) type = 'group';
      else if (extract.match(/singer/i)) {
        if (extract.match(/\bshe\b|female/i)) type = 'female';
        else if (extract.match(/\bhe\b|male/i)) type = 'male';
      }
    }
    
    let birth = null;
    const bm = extract.match(/(\d{4})年.*?出生/) || extract.match(/born[^\d]*(\d{4})/i);
    if (bm) birth = bm[1];
    
    return {
      name: page.title,
      type, birth,
      photo: page.thumbnail?.source || null,
      bio: extract.substring(0, 200)
    };
  } catch (e) { return null; }
}

async function main() {
  console.log('Smart Artist Wiki Fix (Strict Matching)');
  console.log('=====================================');
  console.log('Mode:', WRITE ? 'WRITE' : (TEST_ONLY ? 'TEST' : 'DRY RUN'));
  console.log('');
  
  const snap = await db.collection('artists').get();
  const artists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // Filter: no type AND no photo
  const needFix = artists.filter(a => {
    const noType = !a.artistType || a.artistType === 'unknown';
    const noPhoto = !a.wikiPhotoURL && !a.photoURL;
    return noType && noPhoto;
  });
  
  console.log(`Total: ${artists.length}, Need fix: ${needFix.length}`);
  console.log('');
  
  let success = 0, fail = 0, skipped = 0;
  const failed = [];
  
  for (let i = 0; i < needFix.length; i++) {
    const a = needFix[i];
    process.stdout.write(`[${i+1}/${needFix.length}] ${a.name}: `);
    
    const data = await searchWiki(a.name);
    
    if (data) {
      if (data.type === 'unknown' && !data.photo) {
        console.log(`SKIP (no useful data)`);
        skipped++;
        failed.push(a.name);
        continue;
      }
      
      const tags = [];
      if (data.photo) tags.push('photo');
      if (data.type !== 'unknown') tags.push(data.type);
      if (data.birth) tags.push(data.birth);
      
      console.log(`OK -> ${data.name} [${tags.join(', ')}]`);
      
      if (WRITE) {
        const upd = { wikiPhotoURL: data.photo, bio: data.bio || '', updatedAt: new Date().toISOString() };
        if (data.type !== 'unknown') upd.artistType = data.type;
        if (data.birth) upd.birthYear = data.birth;
        await db.collection('artists').doc(a.id).update(upd);
      }
      success++;
    } else {
      console.log('FAIL (no match)');
      fail++;
      failed.push(a.name);
    }
    
    await new Promise(r => setTimeout(r, 1500));
  }
  
  console.log('\n--- RESULT ---');
  console.log(`Success: ${success}, Failed: ${fail}, Skipped: ${skipped}`);
  
  if (failed.length > 0 && !TEST_ONLY) {
    console.log('\nFailed list (need manual fix):');
    failed.forEach((n, i) => console.log(`  ${i+1}. ${n}`));
  }
  
  if (!WRITE && !TEST_ONLY) {
    console.log('\nRun with --write to apply changes');
  }
}

main().catch(console.error);

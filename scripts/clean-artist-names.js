// 清理歌手名稱中的括號內容（如「王傑 (1962年)」→「王傑」）
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const WRITE = process.argv.includes('--write');

async function cleanNames() {
  console.log('清理歌手名稱括號內容');
  console.log('====================');
  console.log('Mode:', WRITE ? 'WRITE' : 'DRY RUN');
  console.log('');
  
  const snap = await db.collection('artists').get();
  let fixed = 0;
  const toFix = [];
  
  snap.docs.forEach(doc => {
    const a = doc.data();
    if (a.name && a.name.match(/[\(（].*?[\)）]/)) {
      const cleanName = a.name.replace(/\s*[\(（].*?[\)）]\s*/g, '');
      toFix.push({
        id: doc.id,
        oldName: a.name,
        newName: cleanName
      });
    }
  });
  
  console.log(`找到 ${toFix.length} 個需要清理的歌手：`);
  toFix.forEach((item, i) => {
    console.log(`${i + 1}. 「${item.oldName}」 → 「${item.newName}」`);
  });
  
  if (WRITE && toFix.length > 0) {
    console.log('\n開始更新...');
    for (const item of toFix) {
      await db.collection('artists').doc(item.id).update({
        name: item.newName,
        normalizedName: item.newName.toLowerCase().replace(/\s+/g, '-'),
        updatedAt: new Date().toISOString()
      });
      console.log(`✓ ${item.oldName} → ${item.newName}`);
    }
    console.log('\n完成！');
  } else if (toFix.length > 0) {
    console.log('\n加上 --write 參數來應用更改');
  } else {
    console.log('\n沒有需要清理的歌手');
  }
}

cleanNames().catch(console.error);

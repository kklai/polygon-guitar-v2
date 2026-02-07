// 清理 Fingerstyle 譜腳本
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const FINGERSTYLE_KEYWORDS = [
  'fingerstyle',
  '木結他獨奏',
  '結他獨奏',
  '[fingerstyle]'
];

function isFingerstyle(title, artist) {
  const t = (title || '').toLowerCase();
  const a = (artist || '').toLowerCase();
  
  return FINGERSTYLE_KEYWORDS.some(keyword => 
    t.includes(keyword) || a.includes(keyword)
  );
}

async function cleanupFingerstyle() {
  console.log('🔍 正在查找 Fingerstyle 譜...\n');
  
  const snapshot = await db.collection('tabs').get();
  const fingerstyleTabs = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    if (isFingerstyle(data.title, data.artist)) {
      fingerstyleTabs.push({
        id: doc.id,
        title: data.title,
        artist: data.artist
      });
    }
  });
  
  console.log(`找到 ${fingerstyleTabs.length} 個 Fingerstyle 譜\n`);
  
  if (fingerstyleTabs.length === 0) {
    console.log('✅ 沒有需要清理的 Fingerstyle 譜');
    return;
  }
  
  // 顯示前 10 個
  console.log('前 10 個將要刪除的譜：');
  fingerstyleTabs.slice(0, 10).forEach((tab, i) => {
    console.log(`  ${i + 1}. ${tab.artist} - ${tab.title}`);
  });
  
  if (fingerstyleTabs.length > 10) {
    console.log(`  ... 還有 ${fingerstyleTabs.length - 10} 個`);
  }
  
  console.log('\n⚠️  即將刪除以上譜（此操作不可恢復）');
  console.log('要執行刪除，請運行：node scripts/cleanup-fingerstyle.js --confirm');
  
  return fingerstyleTabs;
}

async function deleteFingerstyle() {
  const fingerstyleTabs = await cleanupFingerstyle();
  
  if (!fingerstyleTabs || fingerstyleTabs.length === 0) return;
  
  console.log('\n🗑️  開始刪除...\n');
  
  let deleted = 0;
  let failed = 0;
  
  for (const tab of fingerstyleTabs) {
    try {
      await db.collection('tabs').doc(tab.id).delete();
      console.log(`✅ 已刪除: ${tab.artist} - ${tab.title}`);
      deleted++;
    } catch (err) {
      console.error(`❌ 刪除失敗: ${tab.artist} - ${tab.title}`, err.message);
      failed++;
    }
  }
  
  console.log(`\n✅ 清理完成！`);
  console.log(`   成功刪除: ${deleted} 個`);
  console.log(`   失敗: ${failed} 個`);
}

// 主程序
const args = process.argv.slice(2);
const CONFIRM = args.includes('--confirm');

if (CONFIRM) {
  deleteFingerstyle().then(() => process.exit(0)).catch(err => {
    console.error('錯誤：', err);
    process.exit(1);
  });
} else {
  cleanupFingerstyle().then(() => process.exit(0)).catch(err => {
    console.error('錯誤：', err);
    process.exit(1);
  });
}

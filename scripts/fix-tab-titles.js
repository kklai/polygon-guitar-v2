// 清理譜標題（移除歌手名前綴）
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function fixTabTitles() {
  console.log('🔧 清理譜標題\n');
  
  const tabs = await db.collection('tabs').get();
  let fixedCount = 0;
  
  for (const doc of tabs.docs) {
    const t = doc.data();
    let title = t.title || '';
    let artistName = t.artistName || '';
    
    // 如果標題以歌手名開頭，移除它
    if (artistName && title.startsWith(artistName + ' ')) {
      const newTitle = title.substring(artistName.length).trim();
      console.log('修復: "' + title + '" → "' + newTitle + '"');
      await doc.ref.update({ title: newTitle });
      fixedCount++;
    }
    // 如果標題以歌手名開頭（冇空格）
    else if (artistName && title.startsWith(artistName)) {
      const newTitle = title.substring(artistName.length).trim();
      if (newTitle) {
        console.log('修復: "' + title + '" → "' + newTitle + '"');
        await doc.ref.update({ title: newTitle });
        fixedCount++;
      }
    }
  }
  
  console.log('\n✅ 修復完成！更新咗 ' + fixedCount + ' 份譜');
}

fixTabTitles().then(() => process.exit(0));

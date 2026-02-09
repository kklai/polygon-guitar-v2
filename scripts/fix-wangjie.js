// 修復「王傑 (1962年)」名稱問題
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function fixWangJie() {
  console.log('修復王傑名稱...');
  
  // 用 ID 直接搵
  const docId = 'wang-jie-1962';
  const docRef = db.collection('artists').doc(docId);
  let docSnap = await docRef.get();
  
  if (!docSnap.exists) {
    // 試其他可能嘅 ID
    const altIds = ['王傑-1962', '王傑-1962年', 'wang-jie', 'wangjie'];
    for (const id of altIds) {
      const snap = await db.collection('artists').doc(id).get();
      if (snap.exists && snap.data().name?.includes('王傑')) {
        docSnap = snap;
        break;
      }
    }
  }
  
  if (!docSnap.exists) {
    // 最後手段：搜索所有歌手
    const snap = await db.collection('artists').get();
    for (const doc of snap.docs) {
      const a = doc.data();
      if (a.name?.includes('王傑')) {
        console.log('找到王傑！');
        console.log('ID:', doc.id);
        console.log('名稱:', a.name);
        
        // 更新
        await doc.ref.update({
          name: '王傑',
          normalizedName: 'wang-jie',
          updatedAt: new Date().toISOString()
        });
        
        console.log('✓ 已修復為「王傑」');
        return;
      }
    }
    console.log('❌ 找不到王傑');
  } else {
    const a = docSnap.data();
    console.log('找到！ID:', docSnap.id);
    console.log('名稱:', a.name);
    
    await docSnap.ref.update({
      name: '王傑',
      normalizedName: 'wang-jie',
      updatedAt: new Date().toISOString()
    });
    
    console.log('✓ 已修復為「王傑」');
  }
}

fixWangJie().catch(console.error);

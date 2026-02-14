// 檢查特定譜的內容
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkTab() {
  const tabId = 'cRESdCBSfDnzs1bZ58KB';
  
  try {
    const tabRef = doc(db, 'tabs', tabId);
    const tabSnap = await getDoc(tabRef);
    
    if (tabSnap.exists()) {
      const data = tabSnap.data();
      console.log('=== 譜內容 ===');
      console.log('Title:', data.title);
      console.log('Artist:', data.artist);
      console.log('\n=== Content ===');
      console.log(data.content);
      console.log('\n=== Content (JSON 格式) ===');
      console.log(JSON.stringify(data.content));
    } else {
      console.log('譜不存在');
    }
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

checkTab();

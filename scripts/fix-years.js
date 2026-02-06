const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function fix() {
  const updates = [
    { id: '張學友', birthYear: 1961, debutYear: 1985 },
    { id: '郭富城', birthYear: 1965, debutYear: 1984 },
    { id: '陳奕迅', birthYear: 1974, debutYear: 1995 },
    { id: '鄧麗欣', birthYear: 1983, debutYear: 2002 },
    { id: '古天樂', birthYear: 1970, debutYear: 1993 },
    { id: '林子祥', birthYear: 1947, debutYear: 1976 },
    { id: '陳曉東', birthYear: 1975, debutYear: 1995 }
  ];
  
  for (const u of updates) {
    await db.collection('artists').doc(u.id).update({
      birthYear: u.birthYear,
      debutYear: u.debutYear
    });
    console.log('Fixed: ' + u.id);
  }
  console.log('Done');
}

fix().then(() => process.exit(0));

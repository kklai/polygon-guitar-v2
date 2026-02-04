#!/usr/bin/env node
/**
 * 測試版批量分析（首 10 篇）
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, query, limit } = require('firebase/firestore');

// Firebase 初始化
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 分析函數
const CHORD_DIFFICULTY = {
  easy: ['C', 'G', 'Am', 'F', 'D', 'Em', 'A', 'E', 'Dm'],
  medium: ['Bm', 'Cm', 'C#m', 'Fm', 'Gm', 'D7', 'G7', 'C7', 'E7', 'A7'],
  hard: ['F#m', 'G#m', 'Bbm', 'Bm7', 'Fmaj7', 'Cmaj7', 'Gmaj7', 'Am7', 'Dm7']
};

const BARRE_CHORDS = /Fmaj7|Bm|Bbm|Cm|C#m|C#|F#m|F#|G#m|Gm|Bbm|Bm7|C#7|F#7|B7/;

function analyzeDifficulty(content) {
  if (!content) return null;
  
  const chordMatches = content.match(/[A-G][#b]?(m|maj|7|sus|dim|aug|add)?[0-9]?(\/[A-G][#b]?)?/g) || [];
  const uniqueChords = [...new Set(chordMatches)];
  
  let barreCount = 0;
  uniqueChords.forEach(chord => {
    const baseChord = chord.split('/')[0];
    if (BARRE_CHORDS.test(baseChord)) barreCount++;
  });
  
  const hasFingerstyle = /譜例|指法|tab|----|e\||B\||G\||D\||A\||E\|/.test(content);
  const lineCount = content.split('\n').length;
  
  let difficulty = 'beginner';
  let levelName = '初階';
  
  if (barreCount > 5 || uniqueChords.length > 12) {
    difficulty = 'advanced';
    levelName = '進階';
  } else if (barreCount > 2 || uniqueChords.length > 8) {
    difficulty = 'intermediate';
    levelName = '中級';
  }
  
  return {
    level: difficulty,
    levelName: levelName,
    barreCount: barreCount,
    chordCount: uniqueChords.length,
    hasFingerstyle: hasFingerstyle,
    lineCount: lineCount,
    estimatedTime: difficulty === 'beginner' ? '1-3日' : difficulty === 'intermediate' ? '3-7日' : '1-2週'
  };
}

async function testAnalyze() {
  console.log('🧪 測試模式：分析首 10 篇結他譜\n');
  
  const tabsRef = collection(db, 'tabs');
  const q = query(tabsRef, limit(10));
  const snapshot = await getDocs(q);
  
  console.log(`找到 ${snapshot.size} 篇譜\n`);
  console.log('═══════════════════════════════════════════\n');
  
  let count = 0;
  for (const docSnap of snapshot.docs) {
    const tab = docSnap.data();
    count++;
    
    console.log(`[${count}] ${tab.title} - ${tab.artist}`);
    
    if (tab.autoAnalysis) {
      console.log('   ⏭️  已有分析數據');
      console.log(`      難度: ${tab.autoAnalysis.levelName}`);
      console.log(`      和弦: ${tab.autoAnalysis.chordCount}個`);
      console.log('');
      continue;
    }
    
    const analysis = analyzeDifficulty(tab.content);
    if (analysis) {
      console.log(`   🎸 分析結果:`);
      console.log(`      難度: ${analysis.levelName} (${analysis.level})`);
      console.log(`      和弦: ${analysis.chordCount}個`);
      console.log(`      橫按: ${analysis.barreCount}個`);
      console.log(`      指彈: ${analysis.hasFingerstyle ? '是' : '否'}`);
      console.log(`      預計: ${analysis.estimatedTime}掌握`);
      
      // 實際更新（測試模式都實際更新，但只更新 10 篇）
      try {
        await updateDoc(doc(db, 'tabs', docSnap.id), {
          autoAnalysis: analysis,
          updatedAt: new Date()
        });
        console.log('   ✅ 已更新到 Firestore');
      } catch (error) {
        console.log(`   ❌ 更新失敗: ${error.message}`);
      }
    }
    console.log('');
    
    // 避免寫入過快
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log('═══════════════════════════════════════════');
  console.log('\n✅ 測試完成！');
  console.log('如果結果正常，執行：');
  console.log('  node scripts/analyze-existing-tabs.js');
  console.log('');
}

testAnalyze().catch(err => {
  console.error('❌ 測試失敗:', err);
  process.exit(1);
});

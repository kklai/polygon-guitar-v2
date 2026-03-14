#!/usr/bin/env node
/**
 * 批量分析現有結他譜
 * 為所有現有譜面生成 autoAnalysis 數據
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, query, limit, startAfter } = require('firebase/firestore');

// Firebase 初始化
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 引入分析函數（簡化版）
const CHORD_DIFFICULTY = {
  easy: ['C', 'G', 'Am', 'F', 'D', 'Em', 'A', 'E', 'Dm'],
  medium: ['Bm', 'Cm', 'C#m', 'Fm', 'Gm', 'D7', 'G7', 'C7', 'E7', 'A7'],
  hard: ['F#m', 'G#m', 'Bbm', 'Bm7', 'Fmaj7', 'Cmaj7', 'Gmaj7', 'Am7', 'Dm7']
};

const BARRE_CHORDS = /Fmaj7|Bm|Bbm|Cm|C#m|C#|F#m|F#|G#m|Gm|Bbm|Bm7|C#7|F#7|B7/;

function analyzeDifficulty(content) {
  if (!content) return null;
  
  const chordMatches = content.match(/[A-G][#b]?(maj|mj|m|7|sus|dim|aug|add)?[0-9]?(\/[A-G][#b]?)?/g) || [];
  const uniqueChords = [...new Set(chordMatches)];
  
  let easyCount = 0, mediumCount = 0, hardCount = 0, barreCount = 0;
  
  uniqueChords.forEach(chord => {
    const baseChord = chord.split('/')[0];
    if (CHORD_DIFFICULTY.easy.includes(baseChord)) easyCount++;
    else if (CHORD_DIFFICULTY.medium.includes(baseChord)) mediumCount++;
    else if (CHORD_DIFFICULTY.hard.includes(baseChord)) hardCount++;
    if (BARRE_CHORDS.test(baseChord)) barreCount++;
  });
  
  const hasFingerstyle = /譜例|指法|tab|----|e\||B\||G\||D\||A\||E\|/.test(content);
  const lineCount = content.split('\n').length;
  
  let difficulty = 'beginner';
  let levelName = '初階';
  
  if (barreCount > 5 || hardCount > 3 || (uniqueChords.length > 12 && hasFingerstyle)) {
    difficulty = 'advanced';
    levelName = '進階';
  } else if (barreCount > 2 || mediumCount > 4 || uniqueChords.length > 8) {
    difficulty = 'intermediate';
    levelName = '中級';
  }
  
  const autoTags = [];
  if (barreCount === 0) autoTags.push('無Barre和弦');
  if (barreCount > 5) autoTags.push('大量橫按');
  if (uniqueChords.length <= 6) autoTags.push('和弦簡單');
  if (uniqueChords.length >= 12) autoTags.push('和弦豐富');
  if (hasFingerstyle) autoTags.push('指彈技巧');
  if (lineCount > 100) autoTags.push('內容詳盡');
  
  return {
    level: difficulty,
    levelName: levelName,
    barreCount: barreCount,
    chordCount: uniqueChords.length,
    chordBreakdown: { easy: easyCount, medium: mediumCount, hard: hardCount },
    hasFingerstyle: hasFingerstyle,
    lineCount: lineCount,
    autoTags: autoTags,
    estimatedTime: difficulty === 'beginner' ? '1-3日' : difficulty === 'intermediate' ? '3-7日' : '1-2週'
  };
}

// 主程式
async function analyzeAllTabs() {
  console.log('🎸 開始批量分析結他譜...\n');
  
  const tabsRef = collection(db, 'tabs');
  let processed = 0;
  let updated = 0;
  let errors = 0;
  
  // 分批處理
  let lastDoc = null;
  const batchSize = 100;
  
  while (true) {
    let q = query(tabsRef, limit(batchSize));
    if (lastDoc) {
      q = query(tabsRef, startAfter(lastDoc), limit(batchSize));
    }
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) break;
    
    console.log(`📦 處理第 ${processed + 1} - ${processed + snapshot.size} 篇...`);
    
    for (const docSnap of snapshot.docs) {
      const tab = docSnap.data();
      processed++;
      
      // 如果已有分析，跳過
      if (tab.autoAnalysis) {
        console.log(`  ⏭️  已分析: ${tab.title}`);
        continue;
      }
      
      try {
        const analysis = analyzeDifficulty(tab.content);
        if (analysis) {
          await updateDoc(doc(db, 'tabs', docSnap.id), {
            autoAnalysis: analysis,
            updatedAt: new Date()
          });
          updated++;
          console.log(`  ✅ ${tab.title} - ${analysis.levelName}`);
        }
      } catch (error) {
        errors++;
        console.error(`  ❌ ${tab.title}: ${error.message}`);
      }
      
      // 避免寫入過快
      await new Promise(r => setTimeout(r, 50));
    }
    
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    
    // 進度報告
    console.log(`\n📊 進度: ${processed} 已處理, ${updated} 已更新, ${errors} 錯誤\n`);
  }
  
  console.log('═══════════════════════════════════');
  console.log('✅ 分析完成！');
  console.log(`總數: ${processed}`);
  console.log(`更新: ${updated}`);
  console.log(`錯誤: ${errors}`);
  console.log('═══════════════════════════════════');
}

// 執行
analyzeAllTabs().catch(console.error);

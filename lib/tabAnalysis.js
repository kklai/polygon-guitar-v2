/**
 * 結他譜自動分析工具
 * 第一層：技術標籤（自動生成）
 */

// 常見和弦難度分類
const CHORD_DIFFICULTY = {
  easy: ['C', 'G', 'Am', 'F', 'D', 'Em', 'A', 'E', 'Dm'],
  medium: ['Bm', 'Cm', 'C#m', 'Fm', 'Gm', 'D7', 'G7', 'C7', 'E7', 'A7'],
  hard: ['F#m', 'G#m', 'Bbm', 'Bm7', 'Fmaj7', 'Cmaj7', 'Gmaj7', 'Am7', 'Dm7']
};

// Barre chord 檢測
// 所有需要橫按的和弦：B, C#, F#, G#, Ab, Bb, Db, Eb, Gb 及其變體
// 注意：F 可以用簡化按法（非 Barre），所以不列入
const BARRE_PATTERNS = [
  // F 系列（Fm, F7 係 Barre，但 F, Fmaj7 可以簡化按）
  /^F7$/, /^Fm$/, /^Fadd9$/, /^Fsus4$/,
  // B 系列
  /^B$/, /^Bm$/, /^B7$/, /^Bm7$/, /^Bmaj7$/, /^Bbm$/, /^Bb$/, /^Bbm7$/,
  // C# / Db 系列
  /^C#$/, /^C#m$/, /^C#7$/, /^C#maj7$/, /^C#m7$/, /^C#add9$/,
  /^Db$/, /^Dbm$/, /^Db7$/,
  // F# / Gb 系列
  /^F#$/, /^F#m$/, /^F#7$/, /^F#maj7$/, /^F#m7$/, /^F#add9$/,
  /^Gb$/, /^Gbm$/, /^Gb7$/,
  // G# / Ab 系列
  /^G#$/, /^G#m$/, /^G#7$/, /^G#m7$/,
  /^Ab$/, /^Abm$/, /^Ab7$/, /^Abmaj7$/, /^Abm7$/,
  // Bb / A# 系列
  /^Bb$/, /^Bbm$/, /^Bb7$/, /^Bbmaj7$/, /^Bbm7$/,
  /^A#$/, /^A#m$/,
  // Eb / D# 系列
  /^Eb$/, /^Ebm$/, /^Eb7$/, /^Ebmaj7$/, /^Ebm7$/,
  /^D#$/, /^D#m$/,
  // 常見 Barre 和弦進階形態
  /^Bm11$/, /^Bbm9$/, /^C#m9$/, /^F#m9$/, /^Abm9$/, /^Bbm9$/
];

/**
 * 分析譜面難度
 */
export function analyzeDifficulty(content) {
  if (!content) return null;
  
  // 提取所有和弦
  const chordMatches = content.match(/[A-G][#b]?(maj|mj|m|7|sus|dim|aug|add)?[0-9]?(\/[A-G][#b]?)?/g) || [];
  const uniqueChords = [...new Set(chordMatches)];
  
  // 計算各類和弦數量
  let easyCount = 0;
  let mediumCount = 0;
  let hardCount = 0;
  let barreCount = 0;
  
  uniqueChords.forEach(chord => {
    const baseChord = chord.split('/')[0]; // 處理 slash chord
    
    if (CHORD_DIFFICULTY.easy.includes(baseChord)) easyCount++;
    else if (CHORD_DIFFICULTY.medium.includes(baseChord)) mediumCount++;
    else if (CHORD_DIFFICULTY.hard.includes(baseChord)) hardCount++;
    
    // 檢查是否為 Barre 和弦
    const isBarre = BARRE_PATTERNS.some(pattern => pattern.test(baseChord));
    if (isBarre) barreCount++;
  });
  
  // 檢測是否有指彈元素
  const hasFingerstyle = /譜例|指法|tab|----|e\||B\||G\||D\||A\||E\|/.test(content);
  
  // 檢測節奏複雜度（換行數量作為簡單指標）
  const lineCount = content.split('\n').length;
  
  // 計算 Non-Barre 和弦數量
  const nonBarreCount = uniqueChords.length - barreCount;
  
  // ===== 新難度評估標準（基於 Non-Barre 和弦數量）=====
  // 1-4個 Non-Barre = BB級（最簡單）
  // 5-8個 Non-Barre = 新手級
  // 有 Barre 和弦 = 根據Barre數量再分級
  
  let difficulty = 'beginner';
  let levelName = '初階';
  
  // 如果有Barre和弦，先根據Barre數量判斷
  if (barreCount > 0) {
    if (barreCount >= 5 || hardCount > 3) {
      difficulty = 'advanced';
      levelName = '進階';
    } else if (barreCount >= 2 || mediumCount > 4) {
      difficulty = 'intermediate';
      levelName = '中級';
    } else {
      // 只有1個Barre，看Non-Barre數量
      if (nonBarreCount > 8) {
        difficulty = 'intermediate';
        levelName = '中級';
      } else {
        difficulty = 'beginner';
        levelName = '初階';
      }
    }
  } else {
    // 完全冇Barre，根據Non-Barre數量分級
    if (nonBarreCount <= 4) {
      difficulty = 'bb';
      levelName = 'BB級';
    } else if (nonBarreCount <= 8) {
      difficulty = 'beginner';
      levelName = '新手級';
    } else {
      difficulty = 'intermediate';
      levelName = '中級';
    }
  }
  
  // 生成自動標籤
  const autoTags = [];
  if (barreCount === 0) autoTags.push('無Barre和弦');
  if (barreCount > 5) autoTags.push('大量橫按');
  if (nonBarreCount <= 4) autoTags.push('超簡單-BB級');
  else if (nonBarreCount <= 8) autoTags.push('新手級');
  if (uniqueChords.length >= 12) autoTags.push('和弦豐富');
  if (hasFingerstyle) autoTags.push('指彈技巧');
  if (lineCount > 100) autoTags.push('內容詳盡');
  
  return {
    level: difficulty,
    levelName: levelName,
    barreCount: barreCount,
    nonBarreCount: nonBarreCount,
    chordCount: uniqueChords.length,
    chordBreakdown: { easy: easyCount, medium: mediumCount, hard: hardCount },
    hasFingerstyle: hasFingerstyle,
    lineCount: lineCount,
    autoTags: autoTags,
    estimatedTime: estimatePracticeTime(difficulty, lineCount)
  };
}

/**
 * 估計練習時間
 */
function estimatePracticeTime(difficulty, lineCount) {
  if (difficulty === 'bb') return '即日識';
  if (difficulty === 'beginner') return '1-3日';
  if (difficulty === 'intermediate') return '3-7日';
  return '1-2週';
}

/**
 * 分析 Key（從內容提取）
 */
export function analyzeKey(content) {
  if (!content) return 'C';
  
  // 查找 Key: X 或 Key：X
  const keyMatch = content.match(/Key\s*[:：]\s*([A-G][#b]?m?)/i);
  if (keyMatch) return keyMatch[1];
  
  // 查找 Capo 提示
  const capoMatch = content.match(/Capo\s*[:：]?\s*(\d)/i);
  if (capoMatch) return `Capo ${capoMatch[1]}`;
  
  return 'C'; // 預設
}

/**
 * 生成完整分析報告
 */
export function generateTabReport(content, manualTags = []) {
  const difficulty = analyzeDifficulty(content);
  const key = analyzeKey(content);
  
  return {
    autoAnalysis: difficulty,
    detectedKey: key,
    recommendedTags: [...difficulty.autoTags, ...manualTags],
    summary: generateSummary(difficulty, key, manualTags)
  };
}

function generateSummary(difficulty, key, manualTags) {
  const parts = [];
  
  parts.push(`${difficulty.levelName}`);
  parts.push(`${difficulty.chordCount}個和弦`);
  if (difficulty.barreCount > 0) {
    parts.push(`${difficulty.barreCount}個橫按`);
  } else {
    parts.push(`全開放和弦`);
  }
  parts.push(`預計${difficulty.estimatedTime}掌握`);
  
  if (manualTags.includes('原汁原味')) parts.push('原曲風格');
  if (manualTags.includes('簡單版')) parts.push('新手友好');
  
  return parts.join(' · ');
}

/**
 * 比較兩個版本嘅差異
 */
export function compareVersions(versionA, versionB) {
  return {
    difficulty: versionA.autoAnalysis?.level === versionB.autoAnalysis?.level 
      ? '相同難度' 
      : `${versionA.autoAnalysis?.levelName} vs ${versionB.autoAnalysis?.levelName}`,
    chordCount: versionA.autoAnalysis?.chordCount - versionB.autoAnalysis?.chordCount,
    barreCount: versionA.autoAnalysis?.barreCount - versionB.autoAnalysis?.barreCount,
    recommendation: generateRecommendation(versionA, versionB)
  };
}

function generateRecommendation(vA, vB) {
  // 簡單推薦邏輯
  if (vA.userVotes?.goodForBeginners > vB.userVotes?.goodForBeginners) {
    return '版本 A 更適合新手';
  }
  if (vA.userVotes?.soundsLikeOriginal > vB.userVotes?.soundsLikeOriginal) {
    return '版本 A 更接近原曲';
  }
  return '兩個版本各有特色';
}

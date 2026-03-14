import { getAllTabs, updateTab } from '@/lib/tabs'

// Barre 和弦定義（這些和弦通常需要用 Barre 技巧，但用戶可以轉 Key 避開）
const BARRE_CHORDS = ['B', 'Bm', 'Bb', 'Bbm', 'B7', 'Bm7', 'Bb7',
  'C#', 'C#m', 'C#7', 'C#m7', 'Db', 'Dbm',
  'F', 'Fm', 'F7', 'Fm7',
  'F#', 'F#m', 'F#7', 'F#m7', 'Gb', 'Gbm',
  'G#', 'G#m', 'G#7', 'G#m7', 'Ab', 'Abm'];
const BARRE_CHORDS_PATTERN = new RegExp('^(' + BARRE_CHORDS.join('|') + ')$');

function analyzeDifficulty(content) {
  if (!content) return null;
  
  // 提取所有和弦
  const chordPattern = /\b[A-G][#b]?(maj|mj|m|min|dim|aug|sus|add|m7|maj7|7|9|11|13)?[0-9]*(\/[A-G][#b]?)?\b/g;
  const allMatches = content.match(chordPattern) || [];
  
  // 過濾有效和弦並統計
  const validChordPattern = /^[A-G][#b]?(maj|mj|m|min|dim|aug|sus|add|m7|maj7|7|9|11|13)?[0-9]*$/;
  const allChords = allMatches.filter(chord => validChordPattern.test(chord));
  const uniqueChords = [...new Set(allChords)];
  
  // 識別 barre 和弦
  const barreChords = uniqueChords.filter(chord => BARRE_CHORDS_PATTERN.test(chord));
  const barreCount = barreChords.length;
  
  // 內容統計
  const lines = content.split('\n');
  const lineCount = lines.length;
  const charCount = content.length;
  
  // 檢測技巧
  const hasFingerstyle = /譜例|指法|tab|六線譜|e\||B\||G\||D\||A\||E\||-----/.test(content);
  const hasStrummingPattern = /↓|↑|D|U|下|上|掃弦/.test(content);
  const hasChorus = /副歌|Chorus|Pre-chorus/.test(content);
  const hasBridge = /橋段|Bridge/.test(content);
  
  // 判斷難度
  let difficulty = 'beginner';
  let levelName = '初階';
  
  if (barreCount > 5 || uniqueChords.length > 12 || (hasFingerstyle && uniqueChords.length > 8)) {
    difficulty = 'advanced';
    levelName = '進階';
  } else if (barreCount > 2 || uniqueChords.length > 8) {
    difficulty = 'intermediate';
    levelName = '中級';
  }
  
  // 生成標籤（專注於和弦數量而非 Barre）
  const autoTags = [];
  if (uniqueChords.length <= 5) autoTags.push('和弦簡單');
  else if (uniqueChords.length <= 9) autoTags.push('和弦適中');
  else autoTags.push('和弦豐富');
  
  if (hasFingerstyle) autoTags.push('指彈技巧');
  if (hasStrummingPattern) autoTags.push('掃弦節奏');
  if (lineCount > 100) autoTags.push('內容詳盡');
  
  return {
    level: difficulty,
    levelName: levelName,
    // 列出檢測到的 Barre 和弦供參考（但難度判斷主要基於和弦數量）
    barreChordsDetected: barreChords,
    chordCount: uniqueChords.length,
    allChords: allChords.slice(0, 50), // 只取前50個用於顯示
    uniqueChords: uniqueChords,
    hasFingerstyle: hasFingerstyle,
    hasStrummingPattern: hasStrummingPattern,
    hasChorus: hasChorus,
    hasBridge: hasBridge,
    lineCount: lineCount,
    charCount: charCount,
    autoTags: autoTags,
    estimatedTime: difficulty === 'beginner' ? '1-3日' : difficulty === 'intermediate' ? '3-7日' : '1-2週',
    contentPreview: content.substring(0, 500) + (content.length > 500 ? '...' : '')
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { limit = 10, dryRun = false, tabId = null } = req.body;
  
  try {
    // 如果指定了 tabId，只分析該譜
    if (tabId) {
      const tabs = await getAllTabs({ withContent: true });
      const tab = tabs.find(t => t.id === tabId);
      
      if (!tab) {
        return res.status(404).json({ error: 'Tab not found' });
      }
      
      const analysis = analyzeDifficulty(tab.content);
      
      if (!dryRun && analysis) {
        await updateTab(tab.id, { autoAnalysis: analysis });
      }
      
      return res.status(200).json({
        success: true,
        mode: dryRun ? 'dry-run' : 'live',
        tab: {
          id: tab.id,
          title: tab.title,
          artist: tab.artist
        },
        analysis
      });
    }
    
    // 批量分析
    console.log(`🎸 開始分析結他譜 (limit: ${limit}, dryRun: ${dryRun})`);
    
    const tabs = await getAllTabs({ withContent: true });
    const tabsToAnalyze = tabs.slice(0, limit);
    
    const results = {
      total: tabs.length,
      analyzed: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: []
    };
    
    for (const tab of tabsToAnalyze) {
      if (tab.autoAnalysis && !req.body.force) {
        results.skipped++;
        results.details.push({
          id: tab.id,
          title: tab.title,
          status: 'skipped',
          reason: '已有分析數據（加 force: true 強制重新分析）'
        });
        continue;
      }
      
      try {
        const analysis = analyzeDifficulty(tab.content);
        results.analyzed++;
        
        if (!dryRun && analysis) {
          await updateTab(tab.id, { autoAnalysis: analysis });
          results.updated++;
        }
        
        results.details.push({
          id: tab.id,
          title: tab.title,
          artist: tab.artist,
          status: dryRun ? 'analyzed' : 'updated',
          analysis: analysis
        });
      } catch (error) {
        results.errors++;
        results.details.push({
          id: tab.id,
          title: tab.title,
          status: 'error',
          error: error.message
        });
      }
    }
    
    res.status(200).json({
      success: true,
      mode: dryRun ? 'dry-run' : 'live',
      results
    });
    
  } catch (error) {
    console.error('分析失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

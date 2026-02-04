import { getAllTabs, updateTab } from '@/lib/tabs'

// 分析函數
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
    hasFingerstyle: hasFingerstyle,
    lineCount: lineCount,
    autoTags: autoTags,
    estimatedTime: difficulty === 'beginner' ? '1-3日' : difficulty === 'intermediate' ? '3-7日' : '1-2週'
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { limit = 10, dryRun = false } = req.body;
  
  try {
    console.log(`🎸 開始分析結他譜 (limit: ${limit}, dryRun: ${dryRun})`);
    
    // 獲取所有譜
    const tabs = await getAllTabs();
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
      // 如果已有分析，跳過
      if (tab.autoAnalysis) {
        results.skipped++;
        results.details.push({
          title: tab.title,
          status: 'skipped',
          reason: '已有分析數據'
        });
        continue;
      }
      
      try {
        const analysis = analyzeDifficulty(tab.content);
        results.analyzed++;
        
        if (!dryRun && analysis) {
          await updateTab(tab.id, {
            autoAnalysis: analysis
          });
          results.updated++;
        }
        
        results.details.push({
          title: tab.title,
          artist: tab.artist,
          status: dryRun ? 'analyzed' : 'updated',
          analysis: analysis
        });
      } catch (error) {
        results.errors++;
        results.details.push({
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

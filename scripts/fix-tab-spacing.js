#!/usr/bin/env node
/**
 * 結他譜空格修正工具
 * 將 copy 自其他來源的譜轉換為等寬字體 compatible 格式
 * 
 * 使用方法:
 * node scripts/fix-tab-spacing.js
 * 
 * 然後貼上你嘅譜，按 Ctrl+D (Mac) 或 Ctrl+Z (Windows) 結束輸入
 * 修正後的譜會輸出到 console
 */

const readline = require('readline');

// 等寬字體下，一個中文字 = 2個英文字符寬度
// 目標：讓和弦行同歌詞行對齊

function fixTabSpacing(input) {
  const lines = input.split('\n');
  const result = [];
  
  let chordLine = null;
  let chordLineIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';
    
    // 檢查呢行係咪和弦行（以 | 開頭或包含 |C, |F 等pattern）
    const isChordLine = /^\s*\|/.test(line) && /\|[A-G]/.test(line);
    const isNextLineChordLine = /^\s*\|/.test(nextLine) && /\|[A-G]/.test(nextLine);
    
    // 檢查係唔係標記行（Verse, Chorus 等）
    const isMarkerLine = /^(Verse|Chorus|Intro|Outro|Bridge|Pre-Chorus|Solo|Interlude|\[.*?\]|：|:.+)/i.test(line.trim());
    
    if (isMarkerLine) {
      // 標記行直接保留，但去除多餘空格
      result.push(line.trim());
      continue;
    }
    
    if (isChordLine) {
      // 儲存和弦行，等下一行歌詞一齊處理
      chordLine = line;
      chordLineIndex = result.length;
      result.push(line); // 暫時加入
      continue;
    }
    
    // 如果上一行係和弦行，而呢行係歌詞，就一齊處理對齊
    if (chordLine !== null && chordLineIndex === result.length - 1 && !isChordLine) {
      const fixed = alignChordAndLyric(chordLine, line);
      result[chordLineIndex] = fixed.chord;
      result.push(fixed.lyric);
      chordLine = null;
      chordLineIndex = -1;
    } else {
      // 普通行，去除行尾空格但保留縮排
      result.push(line);
    }
  }
  
  return result.join('\n');
}

function alignChordAndLyric(chordLine, lyricLine) {
  // 將所有全形空格轉半形
  chordLine = chordLine.replace(/　/g, ' ');
  lyricLine = lyricLine.replace(/　/g, ' ');
  
  // 將多個連續空格轉為單個空格
  chordLine = chordLine.replace(/ +/g, ' ');
  lyricLine = lyricLine.replace(/ +/g, ' ');
  
  // 找出一個 | 之後和弦的位置
  const chordMatches = [...chordLine.matchAll(/\|(\s*)([A-G][^\s|]*)/g)];
  
  if (chordMatches.length === 0) {
    return { chord: chordLine, lyric: lyricLine };
  }
  
  // 計算每個和弦應該對應歌詞嘅邊個位置
  // 簡單策略：讓和弦行同歌詞行從同一個位置開始
  const firstBarIndex = chordLine.indexOf('|');
  const lyricBarIndex = lyricLine.indexOf('|');
  
  // 如果歌詞行都有 |，對齊佢哋
  if (lyricBarIndex !== -1) {
    const chordPrefix = chordLine.substring(0, firstBarIndex);
    const lyricPrefix = lyricLine.substring(0, lyricBarIndex);
    
    // 如果空格數唔同，調整歌詞行
    if (chordPrefix.length !== lyricPrefix.length) {
      const newPrefix = ' '.repeat(Math.max(0, firstBarIndex));
      lyricLine = newPrefix + lyricLine.substring(lyricBarIndex + 1);
    }
  }
  
  return { chord: chordLine, lyric: lyricLine };
}

// 進階修正：統一用 | 做對齊基準
function advancedFix(input) {
  const lines = input.split('\n');
  const result = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // 去除全形空格
    line = line.replace(/　/g, ' ');
    
    // 將 tab 轉為 4 個空格
    line = line.replace(/\t/g, '    ');
    
    // 如果係和弦行，規範化格式
    if (/^\s*\|/.test(line) && /\|[A-G]/.test(line)) {
      // 確保 | 後面有空格
      line = line.replace(/\|([A-G])/g, '|$1');
    }
    
    result.push(line);
  }
  
  return result.join('\n');
}

// 主程式
function main() {
  console.log('=== 結他譜空格修正工具 ===');
  console.log('請貼上你嘅結他譜（支援多行），然後按 Ctrl+D (Mac) 或 Ctrl+Z (Windows) 結束:\n');
  
  let input = '';
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });
  
  rl.on('line', (line) => {
    input += line + '\n';
  });
  
  rl.on('close', () => {
    console.log('\n=== 修正後結果 ===\n');
    const fixed = advancedFix(input);
    console.log(fixed);
    console.log('\n=== 複製上面結果即可 ===');
  });
}

// 如果直接運行此腳本
if (require.main === module) {
  main();
}

module.exports = { fixTabSpacing, advancedFix };

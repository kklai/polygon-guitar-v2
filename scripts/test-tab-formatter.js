#!/usr/bin/env node
/**
 * 測試 tabFormatter 工具
 */

const { autoFixTabFormat, processTabContent } = require('../lib/tabFormatter.js');

// 測試用例：用戶提供的例子
const testInput = `Verse
         |C                         C7
人人話我笨　作歌點發達
         |F                             Fm
就算搵夠　買盒飯　唔慌多
     |C                         C7
而浪　漫　個名幾咁勁
         |F                  Fm
累我拖你入局　兩份去捱窮`;

console.log('=== 原始輸入 ===');
console.log(testInput);
console.log('\n=== 修正後輸出 ===');
const result = autoFixTabFormat(testInput);
console.log(result);

console.log('\n=== 驗證對齊 ===');
const lines = result.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('|C') || line.includes('|F')) {
    console.log(`行 ${i + 1}: ${line}`);
    if (i + 1 < lines.length && !lines[i + 1].includes('|')) {
      console.log(`行 ${i + 2}: ${lines[i + 1]}`);
      
      // 計算對齊
      const chordLine = line;
      const lyricLine = lines[i + 1];
      
      // 找到 | 位置
      const barIndex = chordLine.indexOf('|');
      const lyricPrefix = lyricLine.length - lyricLine.trimStart().length;
      
      console.log(`  -> | 位置: ${barIndex}, 歌詞縮排: ${lyricPrefix}`);
      console.log('');
      i++; // 跳過歌詞行
    }
  }
}

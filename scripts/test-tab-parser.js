// 測試譜內容解析器
const { 
  parseTabContent, 
  formatTabContent, 
  debugParse,
  isSectionMarkerLine,
  isChordLine,
  isLyricLine,
  isMixedLine 
} = require('../lib/tabParser');

// 測試案例：各種格式的譜內容
const testCases = [
  {
    name: "標準格式",
    content: `Intro
|C      G/B    |Am     F
(暗)如何(蠶)食了(光)

Verse
|C        |G        |Am       |F
(今天我)寒夜裡看雪飄過
|C        |G        |Am       |F
(懷著冷)卻了的心窩飄遠方

Chorus
|F  G  |Em Am  |Dm     G     |C
(海闊)天空(我)會想念你`
  },
  {
    name: "混合行格式",
    content: `Intro: |C G | Am F
Verse 1: |C| (今天我)寒夜裡看雪飄過
|G| (懷著冷)卻了的心窩
Chorus: |F G| (海闊)天空`
  },
  {
    name: "Blogger 原始格式（可能有問題）",
    content: `原調: F

Intro
|F| |Dm| |Gm| |Bb|

Verse 1
|F| (今天我)寒夜裡看雪飄過
|Dm| (懷著冷)卻了的心窩飄遠方
|Gm| (風雨裡)追趕霧裡分不清影蹤
|Bb| (天空海)闊你與我可會變

Pre-chorus
|C| (多少次)迎著冷眼與嘲笑
|F| (從沒有)放棄過心中的理想

Chorus
|F| |C/E| |Dm| |Bb|
(原諒我)這一生不羈放縱愛自由`
  },
  {
    name: "純和弦行",
    content: `Verse
| C | G | Am | F |
| C | G | Am | F |

Chorus  
| F | C | Dm | Bb |`
  },
  {
    name: "無格式標記",
    content: `今天我寒夜裡看雪飄過
懷著冷卻了的心窩飄遠方
風雨裡追趕霧裡分不清影蹤
天空海闊你與我可會變`
  }
];

console.log('🎸 譜內容解析器測試\n');
console.log('===================\n');

testCases.forEach((testCase, index) => {
  console.log(`\n📋 測試 ${index + 1}: ${testCase.name}`);
  console.log('─'.repeat(60));
  
  console.log('\n📝 原始內容：');
  console.log(testCase.content);
  
  console.log('\n🔍 解析結果：');
  const result = debugParse(testCase.content);
  
  console.log('\n✨ 格式化後：');
  const formatted = formatTabContent(testCase.content);
  console.log(formatted);
  
  console.log('\n' + '='.repeat(60));
});

// 單行測試
console.log('\n\n📌 單行測試\n');
console.log('===================\n');

const singleLineTests = [
  'Intro',
  'Verse 1',
  'Chorus:',
  'Pre-chorus',
  '|C      G/B    |Am     F',
  '|C| (今天我)寒夜裡看雪飄過',
  '(今天我)寒夜裡看雪飄過',
  '原調: F',
  'Capo: 3',
  '今天我寒夜裡看雪飄過',
  'Bridge (Guitar Solo)',
  'Outro: Fade out'
];

singleLineTests.forEach(line => {
  const isSection = isSectionMarkerLine(line);
  const isChord = isChordLine(line);
  const isLyric = isLyricLine(line);
  const isMixed = isMixedLine(line);
  
  let type = 'UNKNOWN';
  if (isSection) type = 'SECTION';
  else if (isMixed) type = 'MIXED';
  else if (isChord) type = 'CHORD';
  else if (isLyric) type = 'LYRIC';
  
  console.log(`${type.padEnd(10)} | ${line}`);
});

console.log('\n✅ 測試完成！');

// 從樂譜內容中提取元數據並清理
// 處理格式: 曲詞：李峻一 Key:Ab 4/4 Arranged By Kermit Tam
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

// 初始化 Firebase
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 判斷是否為寫入模式
const WRITE_MODE = process.argv.includes('--write');

// 提取元數據的正則表達式模式
const METADATA_PATTERNS = [
  // 格式1: 曲詞：李峻一 Key:Ab 4/4 Arranged By Kermit Tam
  /曲詞[：:]\s*([^\n]+?)\s+Key[：:]\s*([A-G][#b]?)\s*(?:4\/4)?\s*Arranged\s+By\s+([^\n]+)/i,
  // 格式2: 曲詞：陳少琪 Key:Bb 4/4 Arranged By Nicki Ng
  /曲詞[：:]\s*([^\n]+?)\s+Key[：:]\s*([A-G][#b]?)\s*4\/4\s*Arranged\s+By\s+([^\n]+)/i,
  // 格式3: 曲：黃家駒 詞：劉卓輝 Key:Am 4/4 Arranged By 李重光
  /曲[：:]\s*([^\s]+)\s+詞[：:]\s*([^\n]+?)\s+Key[：:]\s*([A-G][#b]?)\s*4\/4\s*Arranged\s+By\s+([^\n]+)/i,
  // 格式4: 曲: 王傑 詞: 陳少琪 Key: Bb 4/4 Arranged By Nicki Ng
  /曲[：:]\s*([^\s]+)\s+詞[：:]\s*([^\n]+?)\s+Key[：:]\s*([A-G][#b]?)\s*4\/4\s*Arranged\s+By\s+([^\n]+)/i,
];

// 從內容中提取並清理元數據
function extractAndClean(content) {
  if (!content) return null;
  
  const lines = content.split('\n');
  let firstContentLine = -1;
  let extracted = null;
  
  // 尋找第一個包含內容的行（跳過空白行）
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // 嘗試匹配元數據行
    for (const pattern of METADATA_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        // 根據模式確定提取的組
        if (pattern.source.includes('曲[：:]')) {
          // 分開的曲/詞模式
          extracted = {
            composer: match[1]?.trim() || '',
            lyricist: match[2]?.trim() || '',
            originalKey: match[3]?.trim() || '',
            arrangedBy: match[4]?.trim() || ''
          };
        } else {
          // 合併的曲詞模式（假設是同一人）
          extracted = {
            composer: match[1]?.trim() || '',
            lyricist: match[1]?.trim() || '', // 曲詞相同
            originalKey: match[2]?.trim() || '',
            arrangedBy: match[3]?.trim() || ''
          };
        }
        firstContentLine = i;
        break;
      }
    }
    
    if (extracted) break;
    
    // 如果不是元數據行，檢查是否是樂譜內容開始
    if (line.includes('|') || line.includes('(') || /^[A-G]/.test(line)) {
      break;
    }
  }
  
  if (!extracted || firstContentLine === -1) {
    return null;
  }
  
  // 清理 arrangedBy（移除多餘空格和後續內容）
  if (extracted.arrangedBy) {
    extracted.arrangedBy = extracted.arrangedBy
      .replace(/\s+/g, ' ')
      .replace(/(Key|Capo|曲|詞|>).*$/i, '')
      .trim();
    // 限制長度
    if (extracted.arrangedBy.length > 50) {
      extracted.arrangedBy = extracted.arrangedBy.substring(0, 50);
    }
  }
  
  // 清理作曲和填詞
  ['composer', 'lyricist'].forEach(field => {
    if (extracted[field]) {
      extracted[field] = extracted[field]
        .replace(/\s+/g, ' ')
        .replace(/(Key|原調|Capo|Arranged|編曲).*$/i, '')
        .trim();
    }
  });
  
  // 構建新內容（刪除元數據行）
  const newLines = [...lines];
  newLines.splice(firstContentLine, 1); // 刪除元數據行
  
  // 清理多餘空行
  const cleanedContent = newLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return {
    ...extracted,
    cleanedContent,
    originalLine: lines[firstContentLine].trim()
  };
}

// 主程序
async function main() {
  console.log('🎸 樂譜元數據提取工具');
  console.log('====================');
  console.log(`模式: ${WRITE_MODE ? '⚠️ 寫入模式' : '🔍 測試模式'}`);
  console.log('');
  
  try {
    // 獲取所有樂譜
    console.log('📄 獲取所有樂譜...');
    const snapshot = await db.collection('tabs').get();
    const tabs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`   ✓ 共 ${tabs.length} 份樂譜\n`);
    
    let processedCount = 0;
    let updatedCount = 0;
    const skipped = [];
    const samples = [];
    
    for (const tab of tabs) {
      const result = extractAndClean(tab.content);
      
      if (result) {
        processedCount++;
        
        // 檢查是否需要更新
        const needsUpdate = 
          !tab.composer || 
          !tab.lyricist || 
          !tab.arrangedBy || 
          tab.content !== result.cleanedContent;
        
        if (needsUpdate) {
          updatedCount++;
          
          // 保存樣本（前3個）
          if (samples.length < 3) {
            samples.push({
              title: tab.title,
              artist: tab.artist,
              originalLine: result.originalLine,
              extracted: {
                composer: result.composer,
                lyricist: result.lyricist,
                originalKey: result.originalKey,
                arrangedBy: result.arrangedBy
              },
              contentPreview: {
                before: tab.content?.substring(0, 200),
                after: result.cleanedContent?.substring(0, 200)
              }
            });
          }
          
          if (WRITE_MODE) {
            const updates = {
              content: result.cleanedContent,
              updatedAt: new Date().toISOString()
            };
            
            // 只有當字段為空時才更新（避免覆蓋已有數據）
            if (!tab.composer && result.composer) updates.composer = result.composer;
            if (!tab.lyricist && result.lyricist) updates.lyricist = result.lyricist;
            if (!tab.originalKey || tab.originalKey === 'C') updates.originalKey = result.originalKey;
            if (!tab.arrangedBy && !tab.uploaderPenName && result.arrangedBy) {
              updates.arrangedBy = result.arrangedBy;
            }
            
            await db.collection('tabs').doc(tab.id).update(updates);
            console.log(`  ✓ 更新: ${tab.artist} - ${tab.title}`);
            
            // 添加延遲避免觸發限制
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      } else {
        // 記錄沒有匹配到的樂譜（可選）
        if (tab.content && tab.content.includes('曲') && tab.content.includes('詞')) {
          skipped.push(`${tab.artist} - ${tab.title}`);
        }
      }
    }
    
    // 顯示樣本
    if (samples.length > 0) {
      console.log('\n📋 處理樣本（前3個）：');
      console.log('==================');
      samples.forEach((sample, i) => {
        console.log(`\n[${i + 1}] ${sample.artist} - ${sample.title}`);
        console.log(`原始行: ${sample.originalLine}`);
        console.log(`提取: 作曲=${sample.extracted.composer}, 填詞=${sample.extracted.lyricist}, Key=${sample.extracted.originalKey}, 編譜=${sample.extracted.arrangedBy}`);
        console.log('內容預覽（前100字符）：');
        console.log('---');
        console.log(sample.contentPreview.after);
        console.log('---');
      });
    }
    
    // 統計
    console.log('\n📈 統計：');
    console.log('=========');
    console.log(`總樂譜數: ${tabs.length}`);
    console.log(`匹配到元數據: ${processedCount}`);
    console.log(`需要更新: ${updatedCount}`);
    
    if (!WRITE_MODE) {
      console.log('\n💡 測試模式完成。要正式更新，加上 --write 參數');
      console.log('   命令: node scripts/extract-metadata-from-content.js --write');
    } else {
      console.log('\n✅ 更新完成！');
    }
    
    if (skipped.length > 0 && skipped.length <= 10) {
      console.log(`\n⚠️ 未能匹配的樂譜（${skipped.length}個）：`);
      skipped.forEach(s => console.log(`  - ${s}`));
    }
    
  } catch (error) {
    console.error('\n❌ 執行失敗:', error.message);
    process.exit(1);
  }
}

main();

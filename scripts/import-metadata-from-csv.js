/**
 * 從 CSV 導入歌曲資料
 * 補全 6 個欄位：作曲、填詞、編曲、監製、出品年份、BPM
 */

const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');
const fs = require('fs');
const path = require('path');

// 初始化 Firebase
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 解析命令行參數
const args = process.argv.slice(2);
const fileArg = args.find(arg => arg.startsWith('--file='));
const dryRun = args.includes('--dry-run');

if (!fileArg) {
  console.log('使用方法：');
  console.log('  node scripts/import-metadata-from-csv.js --file=metadata.csv');
  console.log('  node scripts/import-metadata-from-csv.js --file=metadata.csv --dry-run  (預覽模式)');
  process.exit(1);
}

const filename = fileArg.split('=')[1];

// 解析 CSV
function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // 處理引號內的逗號
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          current += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    // 移除引號
    const cleanValues = values.map(v => {
      if (v.startsWith('"') && v.endsWith('"')) {
        return v.slice(1, -1).replace(/""/g, '"');
      }
      return v;
    });
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cleanValues[index] || '';
    });
    
    results.push(row);
  }
  
  return results;
}

async function importFromCSV() {
  console.log('📥 CSV 資料導入工具');
  console.log('==================\n');
  
  // 檢查檔案
  if (!fs.existsSync(filename)) {
    console.error(`❌ 檔案不存在：${filename}`);
    process.exit(1);
  }
  
  console.log(`📄 讀取檔案：${filename}`);
  
  // 讀取並解析 CSV
  const content = fs.readFileSync(filename, 'utf-8');
  const rows = parseCSV(content);
  
  console.log(`📊 找到 ${rows.length} 行資料\n`);
  
  if (dryRun) {
    console.log('⚠️  預覽模式（不會寫入 Firebase）\n');
  }
  
  // 統計
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  
  // 處理每一行
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const songId = row.id;
    
    if (!songId) {
      console.log(`[${i + 1}/${rows.length}] ❌ 缺少 ID，跳過`);
      skipped++;
      continue;
    }
    
    console.log(`[${i + 1}/${rows.length}] 🎵 ${row.artist} - ${row.title}`);
    
    // 準備更新資料
    const updateData = {};
    
    if (row.composer && row.composer.trim()) {
      updateData.composer = row.composer.trim();
    }
    if (row.lyricist && row.lyricist.trim()) {
      updateData.lyricist = row.lyricist.trim();
    }
    if (row.arranger && row.arranger.trim()) {
      updateData.arranger = row.arranger.trim();
    }
    if (row.producer && row.producer.trim()) {
      updateData.producer = row.producer.trim();
    }
    if (row.year && row.year.trim()) {
      updateData.year = row.year.trim();
    }
    if (row.bpm && row.bpm.trim()) {
      const bpm = parseInt(row.bpm.trim());
      if (!isNaN(bpm) && bpm > 0) {
        updateData.bpm = bpm;
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      console.log('  ⏭️  無新資料，跳過');
      skipped++;
      continue;
    }
    
    console.log(`  📝 將更新：${Object.keys(updateData).join(', ')}`);
    
    if (dryRun) {
      console.log('  ⏸️  預覽模式，不寫入');
      updated++;
      continue;
    }
    
    // 更新 Firebase
    try {
      await db.collection('tabs').doc(songId).update(updateData);
      console.log('  ✅ 更新成功');
      updated++;
    } catch (error) {
      console.error(`  ❌ 更新失敗：${error.message}`);
      failed++;
    }
  }
  
  // 報告
  console.log('\n📊 導入報告');
  console.log('==========');
  console.log(`總計：${rows.length} 首`);
  console.log(`成功更新：${updated} 首`);
  console.log(`跳過：${skipped} 首`);
  console.log(`失敗：${failed} 首`);
  
  if (dryRun) {
    console.log('\n💡 這是預覽模式，實際未寫入資料庫');
    console.log('   確認無誤後，去掉 --dry-run 參數重新運行');
  }
  
  process.exit(0);
}

importFromCSV().catch(err => {
  console.error('錯誤：', err);
  process.exit(1);
});

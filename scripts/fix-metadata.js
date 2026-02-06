// 修復已導入 Blogger 譜的 metadata（作曲/填詞/編曲）
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

const path = require('path');
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
const rootDir = path.resolve(__dirname, '..');
const fullPath = path.resolve(rootDir, serviceAccountPath);
const serviceAccount = require(fullPath);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

// 解析命令行參數
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) || 10 : 10;

/**
 * 從內容第一行提取 metadata
 */
function extractMetadata(content) {
  if (!content) return {};
  
  const firstLine = content.split('\n')[0] || '';
  
  let composer = null;
  let lyricist = null;
  let arranger = null;
  
  // 曲：xxx / 詞：xxx / 編：xxx 格式（到下一個 / 或 Key 或 Capo 或行尾）
  const composerMatch = firstLine.match(/曲[：:]\s*([^\/\n]+?)(?=\s*[\/]|\s+Key[：:]|\s+Capo|$)/i);
  const lyricistMatch = firstLine.match(/詞[：:]\s*([^\/\n]+?)(?=\s*[\/]|\s+Key[：:]|\s+Capo|$)/i);
  const arrangerMatch = firstLine.match(/(編[曲:]?|編監[：:])\s*([^\/\n]+?)(?=\s*[\/]|\s+Key[：:]|\s+Capo|$)/i);
  
  if (composerMatch) composer = composerMatch[1].trim();
  if (lyricistMatch) lyricist = lyricistMatch[1].trim();
  if (arrangerMatch) arranger = arrangerMatch[2] ? arrangerMatch[2].trim() : arrangerMatch[1].trim();
  
  // 清理，移除多餘空格
  if (composer) composer = composer.replace(/\s+/g, ' ').trim();
  if (lyricist) lyricist = lyricist.replace(/\s+/g, ' ').trim();
  if (arranger) arranger = arranger.replace(/\s+/g, ' ').trim();
  
  return { composer, lyricist, arranger };
}

async function fixMetadata() {
  console.log('🎸 Blogger 譜 Metadata 修復工具\n');
  console.log('========================');
  console.log(`模式: ${DRY_RUN ? '🔍 測試模式（只預覽不修改）' : '⚠️ 寫入模式'}`);
  console.log(`限制: ${LIMIT} 首\n`);
  
  try {
    // 獲取所有 blogger 來源且沒有 composer 的譜
    console.log('📥 正在讀取譜資料...\n');
    const snapshot = await db.collection('tabs')
      .where('source', '==', 'blogger')
      .limit(LIMIT)
      .get();
    
    if (snapshot.empty) {
      console.log('❌ 沒有找到 blogger 來源的譜');
      return;
    }
    
    console.log(`📊 找到 ${snapshot.docs.length} 首譜\n`);
    
    let updated = 0;
    let unchanged = 0;
    let noMetadata = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const content = data.content || '';
      
      // 如果已經有 composer，跳過
      if (data.composer || data.lyricist) {
        unchanged++;
        continue;
      }
      
      // 提取 metadata
      const { composer, lyricist, arranger } = extractMetadata(content);
      
      if (!composer && !lyricist && !arranger) {
        noMetadata++;
        continue;
      }
      
      console.log(`\n[${updated + 1}] ${data.artist} - ${data.title}`);
      console.log('─'.repeat(60));
      console.log('📝 提取到的資料：');
      if (composer) console.log(`   作曲: ${composer}`);
      if (lyricist) console.log(`   填詞: ${lyricist}`);
      if (arranger) console.log(`   編曲: ${arranger}`);
      
      if (DRY_RUN) {
        console.log('   (測試模式，未寫入)');
      } else {
        // 更新 Firestore
        const updateData = {};
        if (composer) updateData.composer = composer;
        if (lyricist) updateData.lyricist = lyricist;
        if (arranger) updateData.arranger = arranger;
        
        await doc.ref.update(updateData);
        console.log('   ✅ 已更新');
        updated++;
      }
    }
    
    console.log('\n\n📊 處理結果');
    console.log('==========');
    console.log(`已更新: ${updated}`);
    console.log(`已有資料: ${unchanged}`);
    console.log(`無 metadata: ${noMetadata}`);
    console.log(`總計檢查: ${snapshot.docs.length}`);
    
    if (DRY_RUN) {
      console.log('\n💡 這是測試模式，沒有實際修改數據');
      console.log('   如需正式執行，移除 --dry-run 參數');
    }
    
  } catch (error) {
    console.error('\n❌ 執行失敗:', error.message);
    process.exit(1);
  }
}

// 顯示使用說明
function showHelp() {
  console.log(`
使用方法:
  node scripts/fix-metadata.js [選項]

選項:
  --dry-run    測試模式，只預覽不修改
  --limit=N    處理 N 首譜（默認 10）
  --help       顯示此幫助

示例:
  # 測試模式預覽
  node scripts/fix-metadata.js --dry-run --limit=5

  # 正式修復
  node scripts/fix-metadata.js --limit=20
`);
}

// 主程序
if (args.includes('--help')) {
  showHelp();
  process.exit(0);
}

fixMetadata();

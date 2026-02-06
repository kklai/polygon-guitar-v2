// 修復已導入 Blogger 譜的內容格式
// 使用譜內容解析器重新格式化和弦行、歌詞行和 Section Marker

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { formatTabContent, parseTabContent } = require('../lib/tabParser');
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
const SHOW_DETAILS = args.includes('--details');

async function fixTabContent() {
  console.log('🎸 Blogger 譜內容修復工具\n');
  console.log('========================');
  console.log(`模式: ${DRY_RUN ? '🔍 測試模式（只預覽不修改）' : '⚠️ 寫入模式'}`);
  console.log(`限制: ${LIMIT} 首\n`);
  
  try {
    // 獲取所有 blogger 來源的譜
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
    let errors = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const originalContent = data.content || '';
      
      console.log(`\n[${updated + unchanged + errors + 1}] ${data.artist} - ${data.title}`);
      console.log('─'.repeat(60));
      
      try {
        // 格式化內容
        const formattedContent = formatTabContent(originalContent);
        
        // 分析內容結構
        const { pairs } = parseTabContent(originalContent);
        
        // 統計內容類型
        const stats = {
          section: pairs.filter(p => p.type === 'section').length,
          pair: pairs.filter(p => p.type === 'pair').length,
          mixed: pairs.filter(p => p.type === 'mixed').length,
          chordOnly: pairs.filter(p => p.type === 'chord-only').length,
          lyricOnly: pairs.filter(p => p.type === 'lyric-only').length,
          empty: pairs.filter(p => p.type === 'empty').length
        };
        
        console.log('📈 內容分析:');
        console.log(`   Section Marker: ${stats.section}`);
        console.log(`   和弦+歌詞配對: ${stats.pair}`);
        console.log(`   混合行: ${stats.mixed}`);
        console.log(`   純和弦行: ${stats.chordOnly}`);
        console.log(`   純歌詞行: ${stats.lyricOnly}`);
        console.log(`   空行: ${stats.empty}`);
        
        // 檢查是否有變化
        const hasChanged = formattedContent !== originalContent;
        
        if (SHOW_DETAILS) {
          console.log('\n📝 原始內容預覽（前300字符）:');
          console.log(originalContent.substring(0, 300).replace(/\n/g, '\\n'));
          console.log('\n✨ 格式化後預覽（前300字符）:');
          console.log(formattedContent.substring(0, 300).replace(/\n/g, '\\n'));
        }
        
        if (!hasChanged) {
          console.log('\n✓ 內容無需修改');
          unchanged++;
          continue;
        }
        
        console.log(`\n🔄 內容有變化: ${originalContent.length} → ${formattedContent.length} 字符`);
        
        if (DRY_RUN) {
          console.log('   (測試模式，未寫入)');
        } else {
          // 更新 Firestore
          await doc.ref.update({
            content: formattedContent,
            updatedAt: new Date()
          });
          console.log('   ✅ 已更新');
          updated++;
        }
        
      } catch (error) {
        console.error(`\n   ❌ 處理失敗: ${error.message}`);
        errors++;
      }
    }
    
    console.log('\n\n📊 處理結果');
    console.log('==========');
    console.log(`已更新: ${updated}`);
    console.log(`無需修改: ${unchanged}`);
    console.log(`失敗: ${errors}`);
    console.log(`總計: ${updated + unchanged + errors}`);
    
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
  node scripts/fix-tab-content.js [選項]

選項:
  --dry-run    測試模式，只預覽不修改
  --limit=N    處理 N 首譜（默認 10）
  --details    顯示詳細內容對比
  --help       顯示此幫助

示例:
  # 測試模式預覽前 5 首
  node scripts/fix-tab-content.js --dry-run --limit=5

  # 正式修復前 20 首
  node scripts/fix-tab-content.js --limit=20

  # 顯示詳細內容對比
  node scripts/fix-tab-content.js --dry-run --details --limit=3
`);
}

// 主程序
if (args.includes('--help')) {
  showHelp();
  process.exit(0);
}

fixTabContent();

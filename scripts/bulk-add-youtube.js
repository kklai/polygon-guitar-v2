// 批量自動為舊譜添加 YouTube 連結
// 用法: node scripts/bulk-add-youtube.js [--limit=100] [--offset=0] [--dry-run]

const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  updateDoc,
  orderBy,
  limit,
  startAfter
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

// 解析命令行參數
const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const offsetArg = args.find(arg => arg.startsWith('--offset='));
const dryRun = args.includes('--dry-run');
const noYoutubeArg = args.find(arg => arg.startsWith('--no-youtube='));

const BATCH_LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : 100;
const OFFSET = offsetArg ? parseInt(offsetArg.split('=')[1]) : 0;
const ONLY_NO_YOUTUBE = args.includes('--only-no-youtube'); // 只處理冇 YouTube 嘅譜

console.log('========================================');
console.log('🎸 批量添加 YouTube 連結工具');
console.log('========================================');
console.log(`處理數量: ${BATCH_LIMIT}`);
console.log(`起始位置: ${OFFSET}`);
console.log(`測試模式: ${dryRun ? '是 (唔會寫入數據庫)' : '否'}`);
console.log(`只處理冇 YouTube: ${ONLY_NO_YOUTUBE ? '是' : '否'}`);
console.log('========================================\n');

// 搜尋 YouTube
async function searchYouTube(artist, title) {
  if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'your_youtube_api_key_here') {
    console.log('❌ YouTube API Key 未設定');
    return null;
  }

  try {
    const query = `${artist} ${title}`;
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
      `part=snippet&` +
      `q=${encodeURIComponent(query)}&` +
      `type=video&` +
      `maxResults=1&` + // 只取第一個結果
      `relevanceLanguage=zh-HK&` +
      `key=${YOUTUBE_API_KEY}`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 403) {
        if (errorData.error?.errors?.[0]?.reason === 'quotaExceeded') {
          throw new Error('API quota 已用完，請明日再試');
        }
      }
      throw new Error(`YouTube API 錯誤: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const videoId = data.items[0].id.videoId;
      const videoTitle = data.items[0].snippet.title;
      return {
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: videoTitle
      };
    }
    
    return null;
  } catch (error) {
    console.error('YouTube 搜尋錯誤:', error.message);
    return null;
  }
}

// 等待函數（避免觸發 API 限制）
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 主程序
async function main() {
  try {
    // 1. 獲取譜列表
    console.log('📋 正在獲取譜列表...');
    
    let tabsQuery;
    if (ONLY_NO_YOUTUBE) {
      // 只獲取冇 YouTube 嘅譜
      tabsQuery = query(
        collection(db, 'tabs'),
        where('youtubeUrl', '==', ''),
        limit(BATCH_LIMIT)
      );
    } else {
      // 獲取所有譜
      tabsQuery = query(
        collection(db, 'tabs'),
        orderBy('createdAt', 'desc'),
        limit(BATCH_LIMIT)
      );
    }
    
    const snapshot = await getDocs(tabsQuery);
    const tabs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    console.log(`✅ 獲取到 ${tabs.length} 份譜\n`);
    
    if (tabs.length === 0) {
      console.log('沒有需要處理的譜');
      process.exit(0);
    }

    // 2. 逐個處理
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    let quotaExceeded = false;
    
    const results = [];
    
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      const currentNum = i + 1;
      
      console.log(`\n[${currentNum}/${tabs.length}] ${tab.artist} - ${tab.title}`);
      
      // 檢查是否已有 YouTube
      if (tab.youtubeUrl && tab.youtubeUrl.trim() !== '') {
        console.log('  ⏭️  已存在 YouTube，跳過');
        skipCount++;
        continue;
      }
      
      if (quotaExceeded) {
        console.log('  ⏭️  API quota 已用完，跳過剩餘項目');
        skipCount++;
        continue;
      }
      
      // 搜尋 YouTube
      console.log('  🔍 搜尋 YouTube...');
      const youtubeResult = await searchYouTube(tab.artist, tab.title);
      
      if (!youtubeResult) {
        console.log('  ❌ 找不到 YouTube 結果');
        failCount++;
        results.push({
          id: tab.id,
          artist: tab.artist,
          title: tab.title,
          status: 'not_found',
          youtubeUrl: null
        });
        continue;
      }
      
      console.log(`  ✅ 找到: ${youtubeResult.title.substring(0, 50)}...`);
      
      // 更新數據庫
      if (!dryRun) {
        try {
          await updateDoc(doc(db, 'tabs', tab.id), {
            youtubeUrl: youtubeResult.url,
            youtubeVideoId: youtubeResult.videoId,
            updatedAt: new Date().toISOString()
          });
          console.log(`  💾 已更新數據庫`);
          successCount++;
        } catch (error) {
          console.log(`  ❌ 更新失敗: ${error.message}`);
          failCount++;
        }
      } else {
        console.log(`  💾 [測試模式] 將會更新: ${youtubeResult.url}`);
        successCount++;
      }
      
      results.push({
        id: tab.id,
        artist: tab.artist,
        title: tab.title,
        status: 'success',
        youtubeUrl: youtubeResult.url
      });
      
      // 等待一下避免 API 限制（每 100 個額外等待）
      if (i % 50 === 49) {
        console.log('\n⏳ 已處理 50 個，額外等待 5 秒...');
        await sleep(5000);
      } else {
        // 每次請求間隔 500ms
        await sleep(500);
      }
    }
    
    // 3. 輸出結果摘要
    console.log('\n========================================');
    console.log('📊 處理結果摘要');
    console.log('========================================');
    console.log(`✅ 成功: ${successCount}`);
    console.log(`⏭️  跳過 (已有): ${skipCount}`);
    console.log(`❌ 失敗/未找到: ${failCount}`);
    console.log('========================================\n');
    
    // 4. 保存結果到檔案
    const fs = require('fs');
    const outputFile = `youtube-batch-results-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(outputFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      dryRun,
      stats: {
        total: tabs.length,
        success: successCount,
        skipped: skipCount,
        failed: failCount
      },
      results
    }, null, 2));
    console.log(`💾 詳細結果已保存到: ${outputFile}`);
    
    if (dryRun) {
      console.log('\n💡 這是測試模式，實際數據庫未被修改。');
      console.log('💡 確認結果無誤後，去掉 --dry-run 再次運行。\n');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('程序錯誤:', error);
    process.exit(1);
  }
}

main();

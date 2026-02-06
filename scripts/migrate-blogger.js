// scripts/migrate-blogger.js
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

// Blogger 設定
const BLOG_ID = process.env.BLOGGER_BLOG_ID || '7655351322076661979';
const API_KEY = process.env.BLOGGER_API_KEY;
const BASE_URL = 'https://www.googleapis.com/blogger/v3/blogs';

// 解析命令行參數
const args = process.argv.slice(2);
const WRITE_MODE = args.includes('--write');
const ALL_POSTS = args.includes('--all');

// 支援 --limit 和 --offset 參數
const limitArg = args.find(arg => arg.startsWith('--limit='));
const offsetArg = args.find(arg => arg.startsWith('--offset='));
const LIMIT = ALL_POSTS ? 5000 : (limitArg ? parseInt(limitArg.split('=')[1]) : 50);
const OFFSET = offsetArg ? parseInt(offsetArg.split('=')[1]) : 0;

// 檢查 API Key
if (!API_KEY) {
  console.error('❌ 錯誤：請設置 BLOGGER_API_KEY 環境變數');
  process.exit(1);
}

// 常見歌手名（用於識別標題格式）
const KNOWN_ARTISTS = ['陳奕迅', 'Beyond', '謝霆鋒', 'Dear Jane', '鄧麗欣', 'Kiri T', '謝雅兒', 
  '張學友', '古天樂', '林峯', '陳柏宇', '林家謙', '姜濤', 'Anson Lo', '柳應廷', 'Edan', 'Ian',
  '張敬軒', '楊千嬅', '容祖兒', 'Twins', 'Supper Moment', 'RubberBand', '五月天', '周杰倫',
  '田馥甄', '林宥嘉', '蕭敬騰', '王力宏', '陶喆', '方大同', '盧廣仲', '韋禮安', '李榮浩', 
  '馮允謙', 'MIRROR', 'ERROR', 'C AllStar', '側田', '衛蘭', '連詩雅', 'AGA', '陳蕾',
  '岑寧兒', '方皓玟', '鄭欣宜', '許廷鏗', '胡鴻鈞', '吳業坤', 'JW', '李克勤', '譚詠麟'];

// 從標題解析歌曲信息
function parseTitle(title) {
  // 移除 HTML 標籤和 [結他chord譜] 等後綴
  let cleanTitle = title.replace(/<[^>]+>/g, '').trim();
  cleanTitle = cleanTitle.replace(/\s*[\[\(【].*?(結他|chord|譜| guitar|\))[\]\)】]/gi, '').trim();
  
  // 嘗試匹配 "歌手 - 歌名" 或 "歌名 - 歌手" 格式
  const patterns = [
    /^(.+?)\s*-\s*(.+)$/,           // "歌手 - 歌名"
    /^(.+?)\s*[｜|]\s*(.+)$/,        // "歌手 | 歌名"
    /^(.+?)\s+by\s+(.+)$/i,          // "歌名 by 歌手"
  ];
  
  for (const pattern of patterns) {
    const match = cleanTitle.match(pattern);
    if (match) {
      const part1 = match[1].trim();
      const part2 = match[2].trim();
      
      // 判斷哪邊是歌手（檢查是否匹配已知歌手）
      const part1IsArtist = KNOWN_ARTISTS.some(a => part1.includes(a));
      const part2IsArtist = KNOWN_ARTISTS.some(a => part2.includes(a));
      
      if (part1IsArtist && !part2IsArtist) return { artist: part1, title: part2 };
      if (part2IsArtist && !part1IsArtist) return { artist: part2, title: part1 };
      
      // 默認：part1 是歌手，part2 是歌名
      return { artist: part1, title: part2 };
    }
  }
  
  // 嘗試識別「歌手 歌名」格式（空格分隔，歌手在已知列表中）
  for (const artist of KNOWN_ARTISTS) {
    if (cleanTitle.startsWith(artist + ' ')) {
      const songTitle = cleanTitle.substring(artist.length).trim();
      return { artist, title: songTitle };
    }
    // 也可能格式是「歌名 歌手」
    if (cleanTitle.endsWith(' ' + artist)) {
      const songTitle = cleanTitle.substring(0, cleanTitle.length - artist.length).trim();
      return { artist, title: songTitle };
    }
  }
  
  // 嘗試匹配「歌手名 歌名」格式（常見歌手名在第一個空格前）
  const spaceMatch = cleanTitle.match(/^([\u4e00-\u9fa5]{2,4})\s+(.+)$/);
  if (spaceMatch) {
    const potentialArtist = spaceMatch[1];
    const potentialTitle = spaceMatch[2];
    // 如果歌名部分看起來不像歌手名（例如包含英文字母或數字）
    if (potentialTitle.match(/[a-zA-Z0-9]/) || potentialTitle.length > potentialArtist.length) {
      return { artist: potentialArtist, title: potentialTitle };
    }
  }
  
  // 無法解析，整個作為歌名
  return { artist: 'Unknown', title: cleanTitle };
}

// 引入譜內容解析器
const { formatTabContent } = require('../lib/tabParser');

// 從內容提取結他譜
function parseContent(content) {
  // 移除 HTML 標籤但保留換行
  let text = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
  
  // 嘗試提取調性
  let originalKey = 'C';
  const keyMatch = text.match(/原調[：:]\s*([A-G][#b]?)/i) || 
                   text.match(/Key[：:]\s*([A-G][#b]?)/i) ||
                   text.match(/調\s*([A-G][#b]?)\s*調/);
  if (keyMatch) {
    originalKey = keyMatch[1];
  }
  
  // 嘗試提取 Capo 信息
  let capo = null;
  const capoMatch = text.match(/Capo[：:]?\s*(\d+)/i) ||
                    text.match(/夾(\d+)/);
  if (capoMatch) {
    capo = parseInt(capoMatch[1]);
  }
  
  // 嘗試提取 YouTube 連結
  let youtubeUrl = '';
  const ytMatch = content.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/) ||
                  content.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (ytMatch) {
    youtubeUrl = `https://youtube.com/watch?v=${ytMatch[1]}`;
  }
  
  // 嘗試提取作曲/填詞資料（通常在內容第一行）
  let composer = null;
  let lyricist = null;
  let arranger = null;
  
  // 解析內容第一行（metadata 行）
  const firstLine = text.split('\n')[0] || '';
  
  // 曲：xxx / 詞：xxx / 編：xxx 格式（到下一個 / 或 Key 或 Capo 或行尾）
  const composerMatch = firstLine.match(/曲[：:]\s*([^\/\n]+?)(?=\s*[\/]|\s+Key[：:]|\s+Capo|$)/i);
  const lyricistMatch = firstLine.match(/詞[：:]\s*([^\/\n]+?)(?=\s*[\/]|\s+Key[：:]|\s+Capo|$)/i);
  const arrangerMatch = firstLine.match(/(編[曲:]?|編監[：:])\s*([^\/\n]+?)(?=\s*[\/]|\s+Key[：:]|\s+Capo|$)/i);
  
  if (composerMatch) composer = composerMatch[1].trim().replace(/\s+/g, ' ');
  if (lyricistMatch) lyricist = lyricistMatch[1].trim().replace(/\s+/g, ' ');
  if (arrangerMatch) arranger = arrangerMatch[2] ? arrangerMatch[2].trim().replace(/\s+/g, ' ') : arrangerMatch[1].trim().replace(/\s+/g, ' ');
  
  // 移除 metadata 行（如果它包含 Key/Capo 信息）
  let cleanedText = text;
  if (firstLine.includes('曲：') || firstLine.includes('詞：') || 
      firstLine.includes('Key:') || firstLine.includes('Capo') ||
      firstLine.match(/原調[：:]/i)) {
    cleanedText = text.split('\n').slice(1).join('\n').trim();
  }
  
  // 使用譜內容解析器格式化內容
  const formattedContent = formatTabContent(cleanedText);
  
  return {
    content: formattedContent,
    originalKey,
    capo,
    youtubeUrl,
    composer,
    lyricist,
    arranger
  };
}

// 獲取 Blogger 文章列表
async function fetchPosts(pageToken = null) {
  const url = `${BASE_URL}/${BLOG_ID}/posts`;
  const params = {
    key: API_KEY,
    maxResults: Math.min(LIMIT, 50), // Blogger API 最大 50
    fetchBodies: true,
    ...(pageToken && { pageToken })
  };
  
  try {
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    console.error('❌ 獲取文章失敗:', error.response?.data?.error?.message || error.message);
    throw error;
  }
}

// 獲取所有文章（處理分頁）
async function fetchAllPosts() {
  const allPosts = [];
  let pageToken = null;
  let pageCount = 0;
  
  do {
    console.log(`📄 獲取第 ${pageCount + 1} 頁文章...`);
    const data = await fetchPosts(pageToken);
    
    if (data.items) {
      allPosts.push(...data.items);
      console.log(`   ✓ 獲得 ${data.items.length} 篇文章`);
    }
    
    pageToken = data.nextPageToken;
    pageCount++;
    
    // 如果達到限制數量，停止
    if (allPosts.length >= LIMIT + OFFSET) {
      console.log(`   ⏹️ 達到限制數量 ${LIMIT + OFFSET}，停止獲取`);
      break;
    }
  } while (pageToken && pageCount < 20); // 最多 20 頁
  
  return allPosts;
}

// 初始化 Firebase Admin
function initFirebase() {
  const path = require('path');
  const { initializeApp, cert } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  
  // 檢查是否使用 service account 文件
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (serviceAccountPath) {
    // 解析相對於項目根目錄的路徑
    const rootDir = path.resolve(__dirname, '..');
    const fullPath = path.resolve(rootDir, serviceAccountPath);
    const serviceAccount = require(fullPath);
    const app = initializeApp({
      credential: cert(serviceAccount)
    });
    return getFirestore(app);
  } else {
    // 使用 Application Default Credentials (gcloud auth)
    const app = initializeApp();
    return getFirestore(app);
  }
}

// 生成 artistId
function generateArtistId(artistName) {
  if (!artistName || artistName === 'Unknown') return null;
  return artistName.toLowerCase().replace(/\s+/g, '-');
}

// 獲取或創建 Artist
async function getOrCreateArtist(db, artistName) {
  if (!artistName || artistName === 'Unknown') return null;
  
  const artistId = generateArtistId(artistName);
  const artistRef = db.collection('artists').doc(artistId);
  const artistSnap = await artistRef.get();
  
  if (!artistSnap.exists) {
    // 創建新歌手
    await artistRef.set({
      name: artistName,
      normalizedName: artistId,
      tabCount: 0,
      createdAt: new Date().toISOString()
    });
    console.log(`    🎤 創建新歌手: ${artistName}`);
  }
  
  return artistId;
}

// 主程序
async function main() {
  console.log('🎸 Blogger 結他譜遷移工具');
  console.log('========================');
  console.log(`模式: ${WRITE_MODE ? '⚠️ 寫入模式' : '🔍 測試模式（只分析不寫入）'}`);
  console.log(`限制: ${LIMIT} 篇文章`);
  console.log(`偏移: ${OFFSET}`);
  console.log('');
  
  try {
    // 獲取文章
    const posts = await fetchAllPosts();
    // 應用 offset
    const postsToProcess = posts.slice(OFFSET, OFFSET + LIMIT);
    console.log(`\n📊 總共獲得 ${posts.length} 篇文章`);
    console.log(`📍 處理範圍: ${OFFSET + 1} - ${Math.min(OFFSET + LIMIT, posts.length)} (${postsToProcess.length} 篇)\n`);
    
    // 分析每篇文章
    const parsedPosts = postsToProcess.map((post, index) => {
      const titleInfo = parseTitle(post.title);
      const contentInfo = parseContent(post.content);
      
      return {
        index: OFFSET + index + 1,
        id: post.id,
        published: post.published,
        ...titleInfo,
        ...contentInfo
      };
    });
    
    // 顯示結果
    console.log('📋 文章分析結果：');
    console.log('==================');
    
    parsedPosts.forEach(post => {
      console.log(`\n[${post.index}] ${post.title}`);
      console.log(`    歌手: ${post.artist}`);
      console.log(`    原調: ${post.originalKey}${post.capo ? ` (Capo ${post.capo})` : ''}`);
      console.log(`    YouTube: ${post.youtubeUrl || '無'}`);
      console.log(`    內容長度: ${post.content.length} 字符`);
      console.log(`    發布日期: ${new Date(post.published).toLocaleDateString('zh-HK')}`);
      
      // 顯示內容預覽（前 200 字符）
      const preview = post.content.substring(0, 200).replace(/\n/g, ' ');
      console.log(`    預覽: ${preview}...`);
    });
    
    // 統計
    console.log('\n\n📈 統計：');
    console.log('=========');
    console.log(`總文章數: ${parsedPosts.length}`);
    console.log(`有 YouTube: ${parsedPosts.filter(p => p.youtubeUrl).length}`);
    console.log(`有指定調性: ${parsedPosts.filter(p => p.originalKey !== 'C').length}`);
    console.log(`有 Capo: ${parsedPosts.filter(p => p.capo).length}`);
    
    // 歌手統計
    const artistCounts = {};
    parsedPosts.forEach(p => {
      artistCounts[p.artist] = (artistCounts[p.artist] || 0) + 1;
    });
    console.log(`\n歌手分佈（前 10）：`);
    Object.entries(artistCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([artist, count]) => {
        console.log(`  ${artist}: ${count} 首`);
      });
    
    // 寫入模式
    if (WRITE_MODE) {
      console.log('\n\n⚠️ 寫入模式 - 開始導入到 Firebase...');
      
      const db = initFirebase();
      const tabsRef = db.collection('tabs');
      
      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;
      
      for (const post of parsedPosts) {
        try {
          // 檢查是否已存在
          const existing = await tabsRef
            .where('title', '==', post.title)
            .where('artist', '==', post.artist)
            .limit(1)
            .get();
          
          if (!existing.empty) {
            console.log(`  ⏭️ 跳過已存在: ${post.artist} - ${post.title}`);
            skippedCount++;
            continue;
          }
          
          // 獲取或創建 Artist
          const artistId = await getOrCreateArtist(db, post.artist);
          
          // 創建文檔
          const tabData = {
            title: post.title,
            artist: post.artist,
            artistId: artistId,
            content: post.content,
            originalKey: post.originalKey,
            capo: post.capo,
            youtubeUrl: post.youtubeUrl,
            composer: post.composer,
            lyricist: post.lyricist,
            arranger: post.arranger,
            createdAt: new Date(post.published),
            updatedAt: new Date(),
            views: 0,
            likes: 0,
            likedBy: [],
            viewCount: 0,
            source: 'blogger'
          };
          
          const docRef = await tabsRef.add(tabData);
          
          // 增加歌手 tabCount
          if (artistId) {
            await db.collection('artists').doc(artistId).update({
              tabCount: require('firebase-admin/firestore').FieldValue.increment(1)
            });
          }
          
          console.log(`  ✓ 導入成功: ${post.artist} - ${post.title} (ID: ${docRef.id})`);
          successCount++;
          
          // 添加延遲避免觸發限制
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`  ❌ 導入失敗: ${post.artist} - ${post.title}:`, error.message);
          errorCount++;
        }
      }
      
      console.log('\n✅ 導入完成！');
      console.log(`   成功: ${successCount}`);
      console.log(`   跳過: ${skippedCount}`);
      console.log(`   失敗: ${errorCount}`);
    } else {
      console.log('\n\n💡 分批遷移命令示例：');
      console.log('    # 第一批：1-200');
      console.log('    node scripts/migrate-blogger.js --write --limit=200 --offset=0');
      console.log('    # 第二批：201-400');
      console.log('    node scripts/migrate-blogger.js --write --limit=200 --offset=200');
      console.log('    # 全部一次過（3000 份約需 5-10 分鐘）');
      console.log('    node scripts/migrate-blogger.js --write --all');
    }
    
  } catch (error) {
    console.error('\n❌ 執行失敗:', error.message);
    process.exit(1);
  }
}

main();

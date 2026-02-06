// Blogger 結他譜遷移工具 V2 - 改善格式保留
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

// Blogger 設定
const BLOG_ID = process.env.BLOGGER_BLOG_ID || '7655351322076661979';
const API_KEY = process.env.BLOGGER_API_KEY;
const BASE_URL = 'https://www.googleapis.com/blogger/v3/blogs';

// 檢查 API Key
if (!API_KEY) {
  console.error('❌ 錯誤：請設置 BLOGGER_API_KEY 環境變數');
  process.exit(1);
}

// 解析命令行參數
const args = process.argv.slice(2);
const WRITE_MODE = args.includes('--write');
const ALL_POSTS = args.includes('--all');
const USE_NEW_MARK = args.includes('--v2'); // 使用新標記 blogger-v2

// 支援 --limit 和 --offset 參數
const limitArg = args.find(arg => arg.startsWith('--limit='));
const offsetArg = args.find(arg => arg.startsWith('--offset='));
const LIMIT = ALL_POSTS ? 5000 : (limitArg ? parseInt(limitArg.split('=')[1]) : 50);
const OFFSET = offsetArg ? parseInt(offsetArg.split('=')[1]) : 0;

// ============ 改善嘅 HTML 處理 ============

// 改善嘅內容提取 - 更好保留格式
function parseContentV2(content) {
  if (!content) return { content: '', originalKey: 'C', capo: null, youtubeUrl: '' };
  
  let text = content;
  
  // Step 1: 處理常見 HTML 實體
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Step 2: 處理換行元素（重要：順序很重要）
  text = text
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '\n\n')  // 雙 br = 段落分隔
    .replace(/<br\s*\/?>/gi, '\n')                   // 單 br = 換行
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')          // p 之間 = 段落
    .replace(/<\/p>/gi, '\n\n')                      // p 結束 = 段落
    .replace(/<p[^>]*>/gi, '');                      // p 開始 = 移除
  
  // Step 3: 處理其他塊級元素
  text = text
    .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<blockquote[^>]*>/gi, '')
    .replace(/<\/pre>/gi, '\n')
    .replace(/<pre[^>]*>/gi, '');
  
  // Step 4: 處理行內元素（轉為空格或移除）
  text = text
    .replace(/<span[^>]*>\s*<\/span>/gi, '')         // 空 span 移除
    .replace(/<span[^>]*>(.+?)<\/span>/gi, '$1')     // 有內容嘅 span 保留內容
    .replace(/<font[^>]*>(.+?)<\/font>/gi, '$1')     // font 標籤
    .replace(/<b>(.+?)<\/b>/gi, '$1')                // b 標籤
    .replace(/<i>(.+?)<\/i>/gi, '$1')                // i 標籤
    .replace(/<u>(.+?)<\/u>/gi, '$1')                // u 標籤
    .replace(/<strong>(.+?)<\/strong>/gi, '$1')      // strong
    .replace(/<em>(.+?)<\/em>/gi, '$1');             // em
  
  // Step 5: 移除所有剩餘 HTML 標籤
  text = text.replace(/<[^>]+>/g, '');
  
  // Step 6: 清理多餘空白
  text = text
    .replace(/[ \t]+/g, ' ')          // 多個空格/Tab -> 單空格
    .replace(/^ +/gm, '')              // 行首空格移除
    .replace(/\n{3,}/g, '\n\n')        // 3+ 換行 -> 2 換行
    .trim();
  
  // Step 7: 嘗試提取調性
  let originalKey = 'C';
  const keyMatch = text.match(/原調[：:]\s*([A-G][#b]?)/i) || 
                   text.match(/Key[：:]\s*([A-G][#b]?)/i) ||
                   text.match(/調\s*([A-G][#b]?)\s*調/);
  if (keyMatch) {
    originalKey = keyMatch[1];
  }
  
  // Step 8: 嘗試提取 Capo
  let capo = null;
  const capoMatch = text.match(/Capo[：:]?\s*(\d+)/i) ||
                    text.match(/夾\s*(\d+)/) ||
                    text.match(/capo\s*(\d+)/i);
  if (capoMatch) {
    capo = parseInt(capoMatch[1]);
  }
  
  // Step 9: 提取 YouTube 連結
  let youtubeUrl = '';
  const ytMatch = content.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/) ||
                  content.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    youtubeUrl = `https://youtube.com/watch?v=${ytMatch[1]}`;
  }
  
  return {
    content: text,
    originalKey,
    capo,
    youtubeUrl
  };
}

// ============ 標題解析 ============

const KNOWN_ARTISTS = ['陳奕迅', 'Beyond', '謝霆鋒', 'Dear Jane', '鄧麗欣', 'Kiri T', '謝雅兒', 
  '張學友', '古天樂', '林峯', '陳柏宇', '林家謙', '姜濤', 'Anson Lo', '柳應廷', 'Edan', 'Ian',
  '張敬軒', '楊千嬅', '容祖兒', 'Twins', 'Supper Moment', 'RubberBand', '五月天', '周杰倫',
  '田馥甄', '林宥嘉', '蕭敬騰', '王力宏', '陶喆', '方大同', '盧廣仲', '韋禮安', '李榮浩', 
  '馮允謙', 'MIRROR', 'ERROR', 'C AllStar', '側田', '衛蘭', '連詩雅', 'AGA', '陳蕾',
  '岑寧兒', '方皓玟', '鄭欣宜', '許廷鏗', '胡鴻鈞', '吳業坤', 'JW', '李克勤', '譚詠麟'];

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

// ============ Blogger API ============

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
  } while (pageToken && pageCount < 20);
  
  return allPosts;
}

// ============ Firebase ============

function initFirebase() {
  const path = require('path');
  const { initializeApp, cert } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (serviceAccountPath) {
    const rootDir = path.resolve(__dirname, '..');
    const fullPath = path.resolve(rootDir, serviceAccountPath);
    const serviceAccount = require(fullPath);
    const app = initializeApp({
      credential: cert(serviceAccount)
    }, 'blogger-v2'); // 指定 app name 避免衝突
    return getFirestore(app);
  } else {
    const app = initializeApp({ name: 'blogger-v2' });
    return getFirestore(app);
  }
}

function generateArtistId(artistName) {
  if (!artistName || artistName === 'Unknown') return null;
  return artistName.toLowerCase().replace(/\s+/g, '-');
}

async function getOrCreateArtist(db, artistName) {
  if (!artistName || artistName === 'Unknown') return null;
  
  const artistId = generateArtistId(artistName);
  const artistRef = db.collection('artists').doc(artistId);
  const artistSnap = await artistRef.get();
  
  if (!artistSnap.exists) {
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

// ============ 主程序 ============

async function main() {
  console.log('🎸 Blogger 結他譜遷移工具 V2');
  console.log('========================');
  console.log(`模式: ${WRITE_MODE ? '⚠️ 寫入模式' : '🔍 測試模式（只分析不寫入）'}`);
  console.log(`標記: ${USE_NEW_MARK ? 'blogger-v2（新格式）' : 'blogger（舊格式）'}`);
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
      const contentInfo = parseContentV2(post.content);
      
      return {
        index: OFFSET + index + 1,
        id: post.id,
        published: post.published,
        ...titleInfo,
        ...contentInfo
      };
    });
    
    // 測試模式：顯示格式對比
    console.log('📋 格式對比（前 3 篇）：');
    console.log('==================');
    parsedPosts.slice(0, 3).forEach(post => {
      console.log(`\n[${post.index}] ${post.artist} - ${post.title}`);
      console.log(`原調: ${post.originalKey}${post.capo ? ` (Capo ${post.capo})` : ''}`);
      console.log(`內容長度: ${post.content.length} 字符`);
      console.log(`內容預覽（前 300 字符）：`);
      console.log('---');
      console.log(post.content.substring(0, 300));
      console.log('---');
      console.log('');
    });
    
    // 統計
    console.log('\n📈 統計：');
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
      const sourceMark = USE_NEW_MARK ? 'blogger-v2' : 'blogger';
      
      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;
      
      for (const post of parsedPosts) {
        try {
          // 檢查是否已存在（用 blogger ID + 標記區分）
          const existing = await tabsRef
            .where('bloggerId', '==', post.id)
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
            bloggerId: post.id, // 記錄 blogger ID
            createdAt: new Date(post.published),
            updatedAt: new Date(),
            views: 0,
            likes: 0,
            likedBy: [],
            viewCount: 0,
            source: sourceMark
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
      
      if (USE_NEW_MARK) {
        console.log('\n💡 新格式標記為 blogger-v2，可與舊格式區分');
      }
    } else {
      console.log('\n\n💡 測試模式完成。要正式導入，加上 --write 參數');
      console.log('   加上 --v2 使用新格式標記 blogger-v2');
    }
    
  } catch (error) {
    console.error('\n❌ 執行失敗:', error.message);
    process.exit(1);
  }
}

main();

// Blogger 結他譜遷移工具 V2 - 改善格式保留
const axios = require('axios');
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');
require('dotenv').config({ path: '.env.local' });

// 初始化 Firebase
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

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

// ============ 過濾規則：跳過教學文/測驗/鼓譜 ============

const SKIP_KEYWORDS = [
  '教學', '教學文', '課程', '測驗', '測試', '測考', 'Quiz', 'quiz', 'QUIZ',
  '常識', '問題', '題目', '練習', '考試', '小測', '測驗',
  'drum', 'DRUM', 'Drum', '鼓譜', '打鼓', '木箱鼓', 'cajon', 'Cajon', 'CAJON',
  'kalimba', 'Kalimba', 'KALIMBA', '卡林巴', '拇指琴',
  '鋼琴教學', '鋼琴', 'piano 教學', 'piano教學',
  '課程', '一堂', '學左', '學咗', '學了',
  '目錄', '列表', '分享', '團購', '放榜',
  '十大結他譜', '排行榜',
  'Rockschool', 'rockschool', 'ROCKSCHOOL',
  'Party', 'party', 'PARTY',
  'Cover', 'cover', 'COVER'
];

function shouldSkipPost(title) {
  if (!title || title.trim() === '') return true; // 跳過空標題
  const lowerTitle = title.toLowerCase();
  return SKIP_KEYWORDS.some(keyword => lowerTitle.includes(keyword.toLowerCase()));
}

// ============ 改善嘅 HTML 處理 ============

// 改善嘅內容提取 - 更好保留格式 + 提取詳細資訊
function parseContentV2(content) {
  if (!content) return { 
    content: '', 
    originalKey: 'C', 
    capo: null, 
    youtubeUrl: '',
    composer: '',
    lyricist: ''
  };
  
  // 先用原始內容提取資訊（未處理 HTML 前）
  const rawText = content
    .replace(/<[^>]+>/g, ' ')  // 移除 HTML，保留空格
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  
  // ========== 提取作曲 ==========
  let composer = '';
  const composerPatterns = [
    /曲[：:]\s*([^\n,，詞Key原調]+?)(?=\s*(?:詞|Key|原調|編曲|$))/i,
    /作曲[：:]\s*([^\n,，]+?)(?=\s*(?:詞|Key|原調|編曲|$))/i,
    /Composer[：:]\s*([^\n,，]+)/i,
    /Music[：:]\s*([^\n,，]+)/i,
    /曲\s*[:：]\s*([A-Za-z\s\u4e00-\u9fa5]+?)(?=\s+(?:詞|Key|原調|編曲|Arranged))/i,
    /曲\s*[:：]\s*([A-Za-z\s\u4e00-\u9fa5]+?)(?=\s|$)/i
  ];
  
  for (const pattern of composerPatterns) {
    const match = rawText.match(pattern);
    if (match && match[1] && match[1].trim().length > 1) {
      composer = match[1].trim().replace(/\s+/g, ' ');
      // 清理常見多餘文字
      composer = composer.replace(/(作)?詞.*$/, '').trim();
      if (composer && composer.length <= 50) break;
    }
  }
  
  // ========== 提取填詞 ==========
  let lyricist = '';
  const lyricistPatterns = [
    /詞[：:]\s*([^\n,，曲Key原調]+?)(?=\s*(?:曲|Key|原調|編曲|$))/i,
    /作詞[：:]\s*([^\n,，]+?)(?=\s*(?:曲|Key|原調|編曲|$))/i,
    /填詞[：:]\s*([^\n,，]+?)(?=\s*(?:曲|Key|原調|編曲|$))/i,
    /Lyricist[：:]\s*([^\n,，]+)/i,
    /Lyrics[：:]\s*([^\n,，]+)/i,
    /詞\s*[:：]\s*([A-Za-z\s\u4e00-\u9fa5]+?)(?=\s+(?:曲|Key|原調|編曲|Arranged))/i,
    /詞\s*[:：]\s*([A-Za-z\s\u4e00-\u9fa5]+?)(?=\s|$)/i
  ];
  
  for (const pattern of lyricistPatterns) {
    const match = rawText.match(pattern);
    if (match && match[1] && match[1].trim().length > 1) {
      lyricist = match[1].trim().replace(/\s+/g, ' ');
      // 清理常見多餘文字
      lyricist = lyricist.replace(/(作)?曲.*$/, '').trim();
      if (lyricist && lyricist.length <= 50) break;
    }
  }
  
  // ========== 提取 Key 同 Capo（支援多種格式）==========
  let originalKey = 'C';
  let capo = null;
  let playKey = null; // 樂譜實際彈奏嘅調（如果同原調不同）
  
  // 格式 1: Key: E Capo 4 > Play C / Key: E Capo 4 Play C
  // 意思：原調 E，夾 Capo 4，用 C 和弦彈
  const capoPlayMatch = rawText.match(/Key[\s:：]*([A-G][#b]?)[\s]*Capo[\s:：]*(\d+)(?:\s*[>\-]?\s*(?:Play|弹|彈)?\s*([A-G][#b]?m?))?/i);
  if (capoPlayMatch) {
    originalKey = capoPlayMatch[1];      // 原調（實際音高）
    capo = parseInt(capoPlayMatch[2]);   // Capo 位置
    playKey = capoPlayMatch[3] || null;  // 彈奏調（如果指定咗）
    console.log(`    🎵 檢測到 Capo 格式: 原調 ${originalKey}, Capo ${capo}${playKey ? ', 彈奏 ' + playKey : ''}`);
  } else {
    // 格式 2: 標準格式（分開提取）
    const keyPatterns = [
      /原調[：:]\s*([A-G][#b]?)/i,
      /Key[：:]\s*([A-G][#b]?)/i,
      /調\s*([A-G][#b]?)\s*調/,
      /Key\s*[:：]\s*([A-G][#b]?)/i,
      /調性[：:]\s*([A-G][#b]?)/i,
      /\b([A-G][#b]?)\s*major/i,
      /\b([A-G][#b]?)\s*minor/i
    ];
    
    for (const pattern of keyPatterns) {
      const match = rawText.match(pattern);
      if (match && match[1]) {
        originalKey = match[1];
        break;
      }
    }
    
    // 提取 Capo（標準格式）
    const capoPatterns = [
      /Capo[：:]?\s*(\d+)/i,
      /夾\s*(\d+)/,
      /capo\s*(\d+)/i,
      /轉調[：:]?\s*(\d+)/
    ];
    
    for (const pattern of capoPatterns) {
      const match = rawText.match(pattern);
      if (match) {
        capo = parseInt(match[1]);
        break;
      }
    }
  }
  
  // ========== 提取 YouTube ==========
  let youtubeUrl = '';
  const ytMatch = content.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/) ||
                  content.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    youtubeUrl = `https://youtube.com/watch?v=${ytMatch[1]}`;
  }
  
  // ========== 處理內容格式 ==========
  let text = content;
  
  // Step 1: 處理常見 HTML 實體
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Step 2: 處理換行元素
  text = text
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '');
  
  // Step 3: 處理其他塊級元素
  text = text
    .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<blockquote[^>]*>/gi, '')
    .replace(/<\/pre>/gi, '\n')
    .replace(/<pre[^>]*>/gi, '');
  
  // Step 4: 處理行內元素
  text = text
    .replace(/<span[^>]*>\s*<\/span>/gi, '')
    .replace(/<span[^>]*>(.+?)<\/span>/gi, '$1')
    .replace(/<font[^>]*>(.+?)<\/font>/gi, '$1')
    .replace(/<b>(.+?)<\/b>/gi, '$1')
    .replace(/<i>(.+?)<\/i>/gi, '$1')
    .replace(/<u>(.+?)<\/u>/gi, '$1')
    .replace(/<strong>(.+?)<\/strong>/gi, '$1')
    .replace(/<em>(.+?)<\/em>/gi, '$1');
  
  // Step 5: 移除所有剩餘 HTML 標籤
  text = text.replace(/<[^>]+>/g, '');
  
  // Step 6: 清理多餘空白
  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/^ +/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return {
    content: text,
    originalKey,
    capo,
    playKey,      // 樂譜實際彈奏嘅調（用於 Capo 格式）
    youtubeUrl,
    composer,
    lyricist
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
  // 支援中文（2-4字）
  const chineseMatch = cleanTitle.match(/^([\u4e00-\u9fa5]{2,4})\s+(.+)$/);
  if (chineseMatch) {
    const potentialArtist = chineseMatch[1];
    const potentialTitle = chineseMatch[2];
    // 如果歌名部分看起來不像歌手名（例如包含英文字母或數字）
    if (potentialTitle.match(/[a-zA-Z0-9]/) || potentialTitle.length > potentialArtist.length) {
      return { artist: potentialArtist, title: potentialTitle };
    }
  }
  
  // 支援英文/混合（如 "ButterWorks 各種經典老歌曲 Medley"）
  // 第一個詞係歌手名（英文或中英混合），剩低係歌名
  const mixedMatch = cleanTitle.match(/^([a-zA-Z][a-zA-Z0-9\s]*[a-zA-Z0-9]|[a-zA-Z])\s+(.+)$/);
  if (mixedMatch) {
    const potentialArtist = mixedMatch[1].trim();
    const potentialTitle = mixedMatch[2].trim();
    // 歌名應該比歌手名長，或者包含中文字
    if (potentialTitle.length > potentialArtist.length || potentialTitle.match(/[\u4e00-\u9fa5]/)) {
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

// Firebase 已經在頂部初始化，直接使用 db 變數

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
    
    // 過濾教學文/測驗/鼓譜
    const filteredPosts = postsToProcess.filter(post => !shouldSkipPost(post.title));
    const skippedPosts = postsToProcess.filter(post => shouldSkipPost(post.title));
    
    if (skippedPosts.length > 0) {
      console.log(`⏭️  跳過 ${skippedPosts.length} 篇非樂譜文章（教學/測驗/鼓譜等）`);
      skippedPosts.forEach(post => console.log(`    - ${post.title || '(空標題)'}`));
      console.log('');
    }
    
    // 分析每篇文章
    const parsedPosts = filteredPosts.map((post, index) => {
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
      let keyDisplay = `原調: ${post.originalKey}`;
      if (post.capo) keyDisplay += ` (Capo ${post.capo})`;
      if (post.playKey) keyDisplay += ` [彈奏: ${post.playKey}]`;
      console.log(keyDisplay);
      if (post.composer) console.log(`作曲: ${post.composer}`);
      if (post.lyricist) console.log(`填詞: ${post.lyricist}`);
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
    console.log(`有 PlayKey (Capo 格式): ${parsedPosts.filter(p => p.playKey).length}`);
    console.log(`有作曲資料: ${parsedPosts.filter(p => p.composer).length}`);
    console.log(`有填詞資料: ${parsedPosts.filter(p => p.lyricist).length}`);
    
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
      
      // db 已經在頂部初始化，直接使用
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
            playKey: post.playKey || null,  // 樂譜實際彈奏嘅調（Capo 格式用）
            composer: post.composer || '',
            lyricist: post.lyricist || '',
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

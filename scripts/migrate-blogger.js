#!/usr/bin/env node
// scripts/migrate-blogger.js - 智能結他譜遷移工具
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, query, where, getDocs, serverTimestamp } = require('firebase/firestore');

// ═══════════════════════════════════════════════════════════
// 配置區域
// ═══════════════════════════════════════════════════════════

// 第一層：標題關鍵字過濾（結他譜標記）
const GUITAR_TAB_KEYWORDS = [
  '[結他chord譜]', '[結他譜]', '[chord譜]',
  '結他chord譜', '吉他譜', '[tab]',
  '[結他tab譜]', '[guitar tab]', '[chords]'
];

// 第一層：標題關鍵字過濾（跳過教學/資訊）
const SKIP_KEYWORDS = [
  '[教學]', '教學', '教學文', '[教學文]',
  '[資訊]', '公告', '通知', '[公告]',
  '[器材]', '介紹', '心得', '[器材介紹]',
  '[理論]', '樂理', '教學影片', '[樂理]',
  '[新聞]', '新聞', '活動', '[活動]',
  '[影片]', 'video', 'cover', '[cover]'
];

// 設定
const BLOG_ID = process.env.BLOGGER_BLOG_ID || '7655351322076661979';
const API_KEY = process.env.BLOGGER_API_KEY;
const BASE_URL = 'https://www.googleapis.com/blogger/v3/blogs';

// ═══════════════════════════════════════════════════════════
// 智能過濾函數
// ═══════════════════════════════════════════════════════════

/**
 * 第一層：標題關鍵字過濾
 */
function filterByTitle(title) {
  const lowerTitle = title.toLowerCase();
  
  // 檢查是否為教學/資訊文章（優先跳過）
  for (const keyword of SKIP_KEYWORDS) {
    if (lowerTitle.includes(keyword.toLowerCase())) {
      return { 
        isTab: false, 
        reason: `標題包含跳過關鍵字: ${keyword}`,
        confidence: 'high'
      };
    }
  }
  
  // 檢查是否為結他譜
  for (const keyword of GUITAR_TAB_KEYWORDS) {
    if (lowerTitle.includes(keyword.toLowerCase())) {
      return { 
        isTab: true, 
        reason: `標題包含結他譜關鍵字: ${keyword}`,
        confidence: 'high'
      };
    }
  }
  
  // 標題不明確，需要進一步檢查
  return { 
    isTab: null, 
    reason: '標題無明確標記，需內容驗證',
    confidence: 'low'
  };
}

/**
 * 第二層：內容格式驗證
 */
function verifyContentFormat(content) {
  if (!content) return { isTab: false, reason: '無內容' };
  
  // 檢查有冇 |C| |G| |Am| 呢類和弦行
  const chordLinePattern = /\|[A-G][#b]?(m|maj|min|sus|dim|aug|add)?[0-9]?(\/[A-G][#b]?)?\|/;
  const hasChordLines = chordLinePattern.test(content);
  
  // 檢查有冇 "Key:" 或 "Capo:" 或 "Arranged by"
  const hasKeyInfo = /Key\s*[:：]\s*[A-G]/i.test(content);
  const hasCapoInfo = /Capo\s*[:：]?\s*\d/i.test(content);
  const hasArrangedBy = /Arranged\s+by/i.test(content);
  
  // 檢查常見和弦標記（如 C, Am, F, G）
  const commonChords = /\b(C|G|Am|F|Dm|Em|D|A|E|Bm)\b/g;
  const chordMatches = content.match(commonChords) || [];
  const hasCommonChords = chordMatches.length >= 3;
  
  // 檢查六線譜格式（數字 + 弦位）
  const tabPattern = /e\|[-\d]+\||B\|[-\d]+\||G\|[-\d]+\||D\|[-\d]+\||A\|[-\d]+\||E\|[-\d]+\|/i;
  const hasTabNotation = tabPattern.test(content);
  
  const indicators = [];
  if (hasChordLines) indicators.push('和弦行格式');
  if (hasKeyInfo) indicators.push('Key標記');
  if (hasCapoInfo) indicators.push('Capo標記');
  if (hasArrangedBy) indicators.push('Arranged by');
  if (hasCommonChords) indicators.push(`常用和弦(${chordMatches.length}個)`);
  if (hasTabNotation) indicators.push('六線譜');
  
  const isTab = indicators.length >= 2 || hasChordLines || hasTabNotation;
  
  return {
    isTab,
    reason: isTab ? `內容驗證通過: ${indicators.join(', ')}` : '內容缺少結他譜特徴',
    indicators,
    confidence: indicators.length >= 3 ? 'high' : (indicators.length >= 1 ? 'medium' : 'low')
  };
}

/**
 * 第三層：內容長度過濾
 */
function filterByLength(content) {
  if (!content) return { isValid: false, reason: '無內容' };
  
  const length = content.length;
  
  // 結他譜通常有一定長度
  if (length < 100) {
    return { isValid: false, reason: `內容太短(${length}字符)，可能係公告` };
  }
  
  // 檢查文字比例（教學文通常文字比例高）
  const cleanText = content.replace(/[\|\-\/\n\s\d]/g, '');
  const textRatio = cleanText.length / length;
  
  if (textRatio > 0.85 && length > 1000) {
    return { 
      isValid: false, 
      reason: `文字比例過高(${(textRatio*100).toFixed(1)}%)，可能係教學文` 
    };
  }
  
  return { isValid: true, length, textRatio: textRatio.toFixed(2) };
}

/**
 * 綜合過濾判斷
 */
function classifyPost(post) {
  const title = post.title || '';
  const content = parseTabContent(post.content || '');
  
  // 第一層：標題過濾
  const titleResult = filterByTitle(title);
  
  // 如果標題明確係結他譜，直接返回
  if (titleResult.isTab === true && titleResult.confidence === 'high') {
    return {
      category: 'tab',
      confidence: 'high',
      reason: titleResult.reason,
      title,
      contentPreview: content.substring(0, 200),
      postId: post.id
    };
  }
  
  // 如果標題明確要跳過，直接返回
  if (titleResult.isTab === false && titleResult.confidence === 'high') {
    return {
      category: 'skip',
      confidence: 'high',
      reason: titleResult.reason,
      title,
      postId: post.id
    };
  }
  
  // 第二層：內容驗證
  const contentResult = verifyContentFormat(content);
  
  // 第三層：長度過濾
  const lengthResult = filterByLength(content);
  
  // 綜合判斷
  if (!lengthResult.isValid) {
    return {
      category: 'skip',
      confidence: 'medium',
      reason: lengthResult.reason,
      title,
      contentPreview: content.substring(0, 200),
      postId: post.id
    };
  }
  
  // 如果內容驗證通過，標記為結他譜
  if (contentResult.isTab) {
    return {
      category: 'tab',
      confidence: contentResult.confidence,
      reason: `${titleResult.reason} + ${contentResult.reason}`,
      indicators: contentResult.indicators,
      title,
      contentPreview: content.substring(0, 200),
      length: lengthResult.length,
      textRatio: lengthResult.textRatio,
      postId: post.id
    };
  }
  
  // 不確定，標記為需人工審查
  return {
    category: 'review',
    confidence: 'low',
    reason: `標題: ${titleResult.reason}; 內容: ${contentResult.reason}`,
    title,
    contentPreview: content.substring(0, 200),
    length: lengthResult.length,
    postId: post.id
  };
}

// ═══════════════════════════════════════════════════════════
// 輔助函數
// ═══════════════════════════════════════════════════════════

function parseTabContent(htmlContent) {
  return htmlContent
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function parseTitle(title) {
  const separators = [' - ', ' – ', '-', '–'];
  for (const sep of separators) {
    const parts = title.split(sep);
    if (parts.length >= 2) {
      return {
        title: parts[0].trim(),
        artist: parts.slice(1).join(' - ').trim()
      };
    }
  }
  return { title: title.trim(), artist: '未知歌手' };
}

// ═══════════════════════════════════════════════════════════
// Blogger API 函數
// ═══════════════════════════════════════════════════════════

async function getPosts(maxResults = 50) {
  const posts = [];
  let nextPageToken = null;
  
  console.log('📥 正在從 Blogger 獲取文章...\n');
  
  do {
    try {
      const url = `${BASE_URL}/${BLOG_ID}/posts?key=${API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}&maxResults=${Math.min(maxResults - posts.length, 50)}`;
      const response = await axios.get(url);
      
      posts.push(...response.data.items);
      nextPageToken = response.data.nextPageToken;
      
      process.stdout.write(`\r  已獲取: ${posts.length} 篇${maxResults < Infinity ? ` / 目標: ${maxResults}` : ''}`);
      
      if (posts.length >= maxResults) break;
      if (nextPageToken) await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      console.error('\n❌ 獲取失敗:', error.message);
      break;
    }
  } while (nextPageToken && posts.length < maxResults);
  
  console.log('\n');
  return posts;
}

// ═══════════════════════════════════════════════════════════
// 主程式
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     🎸 Polygon Guitar - 智能結他譜遷移工具              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  if (!API_KEY) {
    console.error('❌ 請設置 BLOGGER_API_KEY 環境變量');
    process.exit(1);
  }
  
  // 解析命令行參數
  const args = process.argv.slice(2);
  const isAnalyze = args.includes('--analyze') || args.length === 0;
  const isMigrate = args.includes('--migrate');
  const isAll = args.includes('--all');
  const limit = isAll ? Infinity : (args.includes('--test') ? 50 : 100);
  
  // 獲取文章
  const posts = await getPosts(limit);
  console.log(`✅ 成功獲取 ${posts.length} 篇文章\n`);
  
  // 分類
  console.log('🔍 正在分析文章類型...\n');
  const categories = {
    tab: [],      // 結他譜
    skip: [],     // 跳過
    review: []    // 需審查
  };
  
  for (const post of posts) {
    const result = classifyPost(post);
    categories[result.category].push(result);
  }
  
  // 顯示結果
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                    📊 分析結果                          ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  總文章數: ${String(posts.length).padEnd(45)} ║`);
  console.log(`║  ✅ 結他譜: ${String(categories.tab.length).padEnd(45)} ║`);
  console.log(`║  ⏭️  跳過: ${String(categories.skip.length).padEnd(45)} ║`);
  console.log(`║  ❓ 待審查: ${String(categories.review.length).padEnd(45)} ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  // 顯示結他譜列表
  if (categories.tab.length > 0) {
    console.log('🎸 確認嘅結他譜列表（首 20 首）：\n');
    categories.tab.slice(0, 20).forEach((item, i) => {
      const { title: songTitle, artist } = parseTitle(item.title);
      console.log(`  ${String(i + 1).padStart(2)}. ${songTitle} - ${artist}`);
      console.log(`      原因: ${item.reason.substring(0, 50)}${item.reason.length > 50 ? '...' : ''}`);
    });
    if (categories.tab.length > 20) {
      console.log(`\n  ... 還有 ${categories.tab.length - 20} 首`);
    }
    console.log('');
  }
  
  // 顯示需審查列表
  if (categories.review.length > 0) {
    console.log('❓ 需人工審查嘅文章（首 10 篇）：\n');
    categories.review.slice(0, 10).forEach((item, i) => {
      console.log(`  ${String(i + 1).padStart(2)}. ${item.title}`);
      console.log(`      原因: ${item.reason}`);
      console.log(`      內容預覽: ${item.contentPreview?.substring(0, 80).replace(/\n/g, ' ')}...\n`);
    });
    console.log('');
  }
  
  // 匯出 CSV
  if (categories.review.length > 0) {
    const csvPath = path.join(__dirname, 'review-list.csv');
    const csvContent = [
      'No.,Title,Reason,Preview,Post ID',
      ...categories.review.map((item, i) => 
        `${i + 1},"${item.title.replace(/"/g, '""')}","${item.reason.replace(/"/g, '""')}","${(item.contentPreview || '').substring(0, 100).replace(/"/g, '""')}",${item.postId}`
      )
    ].join('\n');
    fs.writeFileSync(csvPath, csvContent);
    console.log(`📝 待審查清單已保存: ${csvPath}\n`);
  }
  
  // 詢問是否遷移
  if (isMigrate) {
    console.log('⚠️  即將開始正式遷移，會寫入 Firebase\n');
    // 這裡可以加入 Firebase 寫入邏輯
    console.log('⏳ 遷移功能開發中...');
  } else {
    console.log('💡 呢個係分析模式，未有寫入任何數據。');
    console.log('   執行以下命令開始正式遷移：');
    console.log(`   node scripts/migrate-blogger.js --migrate --all\n`);
  }
}

main().catch(console.error);

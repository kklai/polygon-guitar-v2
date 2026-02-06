// 導入100份譜腳本
const axios = require('axios');
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// Blogger 設定
const BLOG_ID = '7655351322076661979';
const API_KEY = 'AIzaSyDleK2PbbHmAgxllELy3E_AWWyP989y1WA';

// 解析標題
function parseTitle(title) {
  let cleanTitle = title.replace(/<[^>]+>/g, '').trim();
  cleanTitle = cleanTitle.replace(/\s*[\[\(【].*?(結他|chord|譜|guitar)[\]\)】]/gi, '').trim();
  
  const patterns = [
    /^(.+?)\s*-\s*(.+)$/,
    /^(.+?)\s*[｜|]\s*(.+)$/,
    /^(.+?)\s+by\s+(.+)$/i,
  ];
  
  for (const pattern of patterns) {
    const match = cleanTitle.match(pattern);
    if (match) {
      return { artist: match[1].trim(), title: match[2].trim() };
    }
  }
  
  return { artist: 'Unknown', title: cleanTitle };
}

// 解析內容
function parseContent(content) {
  let text = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  
  let originalKey = 'C';
  const keyMatch = text.match(/原調[：:]\s*([A-G][#b]?)/i) || 
                   text.match(/Key[：:]\s*([A-G][#b]?)/i);
  if (keyMatch) {
    originalKey = keyMatch[1];
  }
  
  let capo = null;
  const capoMatch = text.match(/Capo[：:]?\s*(\d+)/i);
  if (capoMatch) {
    capo = parseInt(capoMatch[1]);
  }
  
  return { content: text, originalKey, capo };
}

// 生成 artistId
function generateArtistId(name) {
  if (!name || name === 'Unknown') return null;
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
}

async function importTabs() {
  console.log('🎸 導入100份結他譜 (第31-130篇)\n');
  
  try {
    // 獲取文章
    const url = `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts`;
    const response = await axios.get(url, {
      params: { key: API_KEY, maxResults: 130, fetchBodies: true }
    });
    
    const posts = response.data.items || [];
    const postsToImport = posts.slice(30, 130); // 第31-130篇
    
    console.log(`✓ 獲得 ${posts.length} 篇文章，將導入第31-130篇 (${postsToImport.length}篇)\n`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const post of postsToImport) {
      try {
        const titleInfo = parseTitle(post.title);
        const contentInfo = parseContent(post.content);
        
        // 檢查係咪鼓譜/教學（跳過）
        if (post.title.toLowerCase().includes('drum') || 
            post.title.toLowerCase().includes('鼓譜') ||
            post.title.toLowerCase().includes('教學') ||
            post.title.includes('木箱鼓')) {
          console.log(`⏭️  跳過鼓譜/教學: ${titleInfo.title}`);
          skipCount++;
          continue;
        }
        
        // 檢查係咪已存在
        const existing = await db.collection('tabs')
          .where('title', '==', titleInfo.title)
          .where('artist', '==', titleInfo.artist)
          .limit(1)
          .get();
        
        if (!existing.empty) {
          console.log(`⏭️  跳過已存在: ${titleInfo.artist} - ${titleInfo.title}`);
          skipCount++;
          continue;
        }
        
        // 獲取或創建歌手
        const artistId = generateArtistId(titleInfo.artist);
        if (artistId && titleInfo.artist !== 'Unknown') {
          const artistRef = db.collection('artists').doc(artistId);
          const artistSnap = await artistRef.get();
          if (!artistSnap.exists) {
            await artistRef.set({
              name: titleInfo.artist,
              normalizedName: artistId,
              artistType: 'unknown',
              tabCount: 0,
              createdAt: new Date().toISOString()
            });
            console.log(`🎤 新歌手: ${titleInfo.artist}`);
          }
        }
        
        // 創建譜
        const tabData = {
          title: titleInfo.title,
          artist: titleInfo.artist,
          artistId: artistId,
          content: contentInfo.content,
          originalKey: contentInfo.originalKey,
          capo: contentInfo.capo,
          createdAt: new Date(post.published),
          updatedAt: new Date(),
          views: 0,
          likes: 0,
          viewCount: 0
        };
        
        await db.collection('tabs').add(tabData);
        
        // 更新歌手 tabCount
        if (artistId) {
          await db.collection('artists').doc(artistId).update({
            tabCount: admin.firestore.FieldValue.increment(1)
          });
        }
        
        console.log(`✓ 導入: ${titleInfo.artist} - ${titleInfo.title} (${contentInfo.originalKey})`);
        successCount++;
        
        // 延遲
        await new Promise(r => setTimeout(r, 100));
        
      } catch (err) {
        console.error(`❌ 失敗: ${post.title}: ${err.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n✅ 完成! 成功: ${successCount}, 跳過: ${skipCount}, 失敗: ${errorCount}`);
    
  } catch (error) {
    console.error('❌ 錯誤:', error.message);
  }
  
  process.exit(0);
}

importTabs();

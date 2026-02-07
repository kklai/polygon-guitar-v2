const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const BLOG_ID = process.env.BLOGGER_BLOG_ID || '7655351322076661979';
const API_KEY = process.env.BLOGGER_API_KEY;

async function checkTotal() {
  try {
    const response = await axios.get(
      `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}?key=${API_KEY}`
    );
    
    console.log('=== Blogger 部落格資訊 ===');
    console.log('名稱:', response.data.name);
    console.log('總文章數:', response.data.posts?.totalItems || '未知');
    console.log('URL:', response.data.url);
    
    // 獲取所有文章（分頁）
    let allPosts = [];
    let nextPageToken = null;
    let page = 1;
    
    console.log('\n=== 開始獲取所有文章 ===');
    
    do {
      const params = {
        key: API_KEY,
        maxResults: 100,
        fetchImages: false,
        fetchBodies: false  // 只獲取標題，快啲
      };
      
      if (nextPageToken) {
        params.pageToken = nextPageToken;
      }
      
      const postsRes = await axios.get(
        `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts`,
        { params }
      );
      
      const posts = postsRes.data.items || [];
      allPosts = allPosts.concat(posts);
      nextPageToken = postsRes.data.nextPageToken;
      
      console.log(`第 ${page} 頁: ${posts.length} 篇`);
      page++;
      
      // 顯示部分標題
      if (page <= 3) {
        posts.slice(0, 5).forEach((p, i) => {
          console.log(`  ${i+1}. ${p.title}`);
        });
      }
      
    } while (nextPageToken && page <= 50); // 最多 50 頁（5000 篇）
    
    console.log('\n=== 總計 ===');
    console.log('獲取文章數:', allPosts.length);
    
    // 檢查重複標題
    const titles = allPosts.map(p => p.title);
    const duplicates = titles.filter((item, index) => titles.indexOf(item) !== index);
    console.log('重複標題數:', [...new Set(duplicates)].length);
    
  } catch (error) {
    console.error('錯誤:', error.response?.data?.error?.message || error.message);
  }
}

checkTotal();

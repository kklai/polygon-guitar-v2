// 手動更新分類封面腳本
// 使用: node scripts/update-category-images.js

require('dotenv').config({ path: '.env.local' });

const API_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}/api/category/update-auto-images`
  : 'http://localhost:3000/api/category/update-auto-images';

const UPDATE_KEY = process.env.UPDATE_CATEGORY_KEY || 'dev-key';

async function updateCategoryImages() {
  console.log('🔄 更新歌手分類封面...\n');
  
  try {
    const response = await fetch(`${API_URL}?key=${UPDATE_KEY}`, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ 更新成功！');
      console.log('\n📊 結果:');
      
      for (const [type, info] of Object.entries(data.data)) {
        console.log(`\n  ${type === 'male' ? '男歌手' : type === 'female' ? '女歌手' : '組合'}:`);
        console.log(`    歌手: ${info.artistName}`);
        console.log(`    熱門分數: ${info.hotScore}`);
        console.log(`    圖片: ${info.image.substring(0, 60)}...`);
      }
    } else {
      console.error('❌ 更新失敗:', data.error);
    }
    
  } catch (error) {
    console.error('❌ 請求失敗:', error.message);
    console.log('\n💡 請確保:');
    console.log('   1. 本地開發伺服器已啟動 (npm run dev)');
    console.log('   2. 或已部署到 Vercel');
  }
}

updateCategoryImages();

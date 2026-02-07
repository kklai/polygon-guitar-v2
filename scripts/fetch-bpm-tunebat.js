/**
 * 使用 Tunebat 獲取歌曲 BPM（網頁版）
 * Tunebat: https://tunebat.com
 */

const axios = require('axios');
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');
const fs = require('fs');

// 初始化 Firebase
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 延遲函數
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 從 Tunebat 網頁搜尋 BPM
async function searchTunebat(artist, title) {
  try {
    console.log(`  🔍 搜尋: ${artist} - ${title}`);
    
    // 先用搜尋頁找歌曲 ID
    const searchQuery = encodeURIComponent(`${artist} ${title}`);
    const searchUrl = `https://tunebat.com/search?q=${searchQuery}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7'
      },
      timeout: 15000,
      maxRedirects: 5
    });
    
    const html = response.data;
    
    // 從 HTML 中提取 BPM
    // Tunebat 會在網頁中嵌入 JSON 數據
    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/);
    
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        
        // 找歌曲數據
        if (data.tracks && data.tracks.length > 0) {
          const track = data.tracks[0];
          
          return {
            bpm: track.tempo || null,
            key: track.key || null,
            camelot: track.camelot || null,
            year: track.albumYear || null,
            source: 'Tunebat'
          };
        }
      } catch (e) {
        // JSON 解析失敗，嘗試正則提取
      }
    }
    
    // 備用：正則提取 BPM
    const bpmMatch = html.match(/"tempo":\s*(\d+(?:\.\d+)?)/);
    const keyMatch = html.match(/"key":\s*"([^"]+)"/);
    const camelotMatch = html.match(/"camelot":\s*"([^"]+)"/);
    
    if (bpmMatch) {
      return {
        bpm: parseFloat(bpmMatch[1]),
        key: keyMatch ? keyMatch[1] : null,
        camelot: camelotMatch ? camelotMatch[1] : null,
        source: 'Tunebat'
      };
    }
    
    return null;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.log('  ⚠️  被限流，等待 10 秒...');
      await delay(10000);
    } else if (error.response && error.response.status === 404) {
      // 歌曲不存在
    } else {
      console.error(`  ❌ Tunebat 錯誤: ${error.message}`);
    }
    return null;
  }
}

// 處理單首歌曲
async function processSong(song) {
  // 如果已有 BPM，跳過
  if (song.bpm && song.bpm > 0) {
    console.log(`  ⏭️  已有 BPM (${song.bpm})，跳過`);
    return null;
  }
  
  const result = await searchTunebat(song.artist, song.title);
  
  if (result && result.bpm) {
    console.log(`  ✅ 找到 BPM: ${Math.round(result.bpm)}`);
    if (result.key) console.log(`     Key: ${result.key}`);
    if (result.camelot) console.log(`     Camelot: ${result.camelot}`);
    
    return {
      id: song.id,
      title: song.title,
      artist: song.artist,
      bpm: Math.round(result.bpm),
      key: result.key,
      camelot: result.camelot,
      year: result.year || song.year,
      source: 'Tunebat'
    };
  }
  
  console.log('  ❌ 未找到 BPM');
  return null;
}

// 主程序
async function main() {
  const args = process.argv.slice(2);
  const testMode = args.includes('--test');
  const dryRun = args.includes('--dry-run');
  
  console.log('🎵 Tunebat BPM 獲取工具');
  console.log('=====================\n');
  
  if (testMode) console.log('🧪 測試模式\n');
  if (dryRun) console.log('👁️  預覽模式（不會寫入資料庫）\n');
  
  // 讀取歌曲
  console.log('📖 讀取歌曲清單...');
  const snapshot = await db.collection('tabs').get();
  const songs = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    if (!data.bpm || data.bpm === 0) {
      songs.push({
        id: doc.id,
        title: data.title || '',
        artist: data.artist || data.artistName || '',
        bpm: data.bpm || null,
        year: data.year || null
      });
    }
  });
  
  console.log(`找到 ${songs.length} 首缺少 BPM 的歌曲\n`);
  
  if (songs.length === 0) {
    console.log('✅ 所有歌曲已有 BPM');
    process.exit(0);
  }
  
  // 限制數量
  const limit = testMode ? 5 : songs.length;
  const targetSongs = songs.slice(0, limit);
  
  console.log(`🚀 處理前 ${targetSongs.length} 首歌曲\n`);
  
  const results = [];
  let found = 0;
  let notFound = 0;
  
  for (let i = 0; i < targetSongs.length; i++) {
    const song = targetSongs[i];
    console.log(`[${i + 1}/${targetSongs.length}] ${song.artist} - ${song.title}`);
    
    const result = await processSong(song);
    
    if (result) {
      results.push(result);
      found++;
      
      // 更新 Firebase
      if (!dryRun) {
        try {
          await db.collection('tabs').doc(song.id).update({
            bpm: result.bpm,
            camelot: result.camelot || null,
            key: result.key || null,
            bpmSource: 'Tunebat',
            bpmUpdatedAt: new Date().toISOString()
          });
          console.log('  💾 已保存到資料庫');
        } catch (err) {
          console.error(`  ❌ 保存失敗: ${err.message}`);
        }
      }
    } else {
      notFound++;
    }
    
    // 延遲避免被封
    await delay(2000);
  }
  
  // 報告
  console.log('\n📊 處理報告');
  console.log('==========');
  console.log(`處理歌曲：${targetSongs.length} 首`);
  console.log(`找到 BPM：${found} 首 (${((found/targetSongs.length)*100).toFixed(1)}%)`);
  console.log(`未找到：${notFound} 首`);
  
  // 保存結果
  if (results.length > 0) {
    const filename = `tunebat-results-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`\n💾 結果已保存：${filename}`);
  }
  
  console.log('\n✅ 完成！');
  process.exit(0);
}

main().catch(err => {
  console.error('程序錯誤：', err);
  process.exit(1);
});

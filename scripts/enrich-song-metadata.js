/**
 * 歌曲資料自動補全工具 (簡化版)
 * 補全 6 個關鍵欄位：作曲、填詞、編曲、監製、出品年份、BPM
 * 
 * 使用方法:
 * node scripts/enrich-song-metadata.js --test    (測試模式，只處理10首)
 * node scripts/enrich-song-metadata.js           (正式模式，處理全部)
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

// 統計數據
const stats = {
  total: 0,
  success6: 0,
  success5: 0,
  success4: 0,
  failed: 0,
  byField: {
    composer: 0,
    lyricist: 0,
    arranger: 0,
    producer: 0,
    year: 0,
    bpm: 0
  }
};

// 延遲函數
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 從文本中提取資料（簡化版，不依賴 cheerio）
function extractFromHTML(html, artist, title) {
  const data = {};
  
  // 提取作曲
  const composerMatch = html.match(/作曲[:：]\s*([^<\n]+)/i);
  if (composerMatch) data.composer = composerMatch[1].trim();
  
  // 提取填詞
  const lyricistMatch = html.match(/(?:填詞|作词)[:：]\s*([^<\n]+)/i);
  if (lyricistMatch) data.lyricist = lyricistMatch[1].trim();
  
  // 提取編曲
  const arrangerMatch = html.match(/(?:編曲|编曲)[:：]\s*([^<\n]+)/i);
  if (arrangerMatch) data.arranger = arrangerMatch[1].trim();
  
  // 提取監製
  const producerMatch = html.match(/(?:監製|监制|製作人)[:：]\s*([^<\n]+)/i);
  if (producerMatch) data.producer = producerMatch[1].trim();
  
  // 提取年份
  const yearMatch = html.match(/(?:發行|发行|出版|年份)[:：]?\s*(\d{4})/i);
  if (yearMatch) data.year = yearMatch[1];
  
  // 如果沒有找到年份，從標題或其他地方找
  if (!data.year) {
    const anyYear = html.match(/(\d{4})/g);
    if (anyYear) {
      const validYear = anyYear.find(y => y >= '1980' && y <= '2026');
      if (validYear) data.year = validYear;
    }
  }
  
  return data;
}

// ===== 百度百科搜尋 =====
async function searchBaiduBaike(artist, title) {
  try {
    // 嘗試不同搜尋組合
    const queries = [
      `${artist} ${title}`,
      `${title} 歌曲`,
      title
    ];
    
    for (const query of queries) {
      const searchUrl = `https://baike.baidu.com/search?word=${encodeURIComponent(query)}`;
      
      try {
        const response = await axios.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
          },
          timeout: 15000,
          maxRedirects: 5
        });
        
        const html = response.data;
        
        // 檢查是否有直接跳轉到條目頁
        if (html.includes('basicInfo')) {
          const data = extractFromHTML(html, artist, title);
          if (data.composer || data.lyricist) {
            return { ...data, source: '百度百科' };
          }
        }
        
        // 提取搜尋結果的第一個鏈接
        const resultMatch = html.match(/href="(\/item\/[^"]+)"/);
        if (resultMatch) {
          const detailUrl = `https://baike.baidu.com${resultMatch[1]}`;
          await delay(1000);
          
          try {
            const detailResponse = await axios.get(detailUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              timeout: 15000
            });
            
            const detailData = extractFromHTML(detailResponse.data, artist, title);
            if (detailData.composer || detailData.lyricist) {
              return { ...detailData, source: '百度百科' };
            }
          } catch (e) {
            // 繼續嘗試下一個查詢
          }
        }
        
      } catch (e) {
        // 繼續嘗試下一個查詢
      }
      
      await delay(1000);
    }
    
    return null;
  } catch (error) {
    console.error('  ❌ 百度百科搜尋失敗:', error.message);
    return null;
  }
}

// ===== 處理單首歌曲 =====
async function enrichSong(song) {
  console.log(`\n🎵 [${song.index}] ${song.artist} - ${song.title}`);
  
  // 檢查是否已有完整資料
  const existingFields = ['composer', 'lyricist', 'arranger', 'producer', 'year', 'bpm']
    .filter(field => song[field] && String(song[field]).trim() !== '' && song[field] !== null);
  
  if (existingFields.length >= 6) {
    console.log('  ✅ 已有完整資料，跳過');
    stats.success6++;
    stats.total++;
    return null;
  }
  
  console.log(`  📋 現有資料: ${existingFields.length}/6 (${existingFields.join(', ') || '無'})`);
  
  const result = {
    songId: song.id,
    title: song.title,
    artist: song.artist,
    composer: song.composer || '',
    lyricist: song.lyricist || '',
    arranger: song.arranger || '',
    producer: song.producer || '',
    year: song.year || '',
    bpm: song.bpm || null,
    sources: {}
  };
  
  // 搜尋百度百科
  console.log('  🔍 搜尋百度百科...');
  const baiduData = await searchBaiduBaike(song.artist, song.title);
  
  if (baiduData) {
    console.log('  ✅ 找到百度百科資料');
    if (baiduData.composer && !result.composer) {
      result.composer = baiduData.composer;
      result.sources.composer = '百度百科';
    }
    if (baiduData.lyricist && !result.lyricist) {
      result.lyricist = baiduData.lyricist;
      result.sources.lyricist = '百度百科';
    }
    if (baiduData.arranger && !result.arranger) {
      result.arranger = baiduData.arranger;
      result.sources.arranger = '百度百科';
    }
    if (baiduData.producer && !result.producer) {
      result.producer = baiduData.producer;
      result.sources.producer = '百度百科';
    }
    if (baiduData.year && !result.year) {
      result.year = baiduData.year;
      result.sources.year = '百度百科';
    }
  } else {
    console.log('  ❌ 百度百科無資料');
  }
  
  // 統計
  const filledFields = ['composer', 'lyricist', 'arranger', 'producer', 'year', 'bpm']
    .filter(field => result[field] && String(result[field]).trim() !== '' && result[field] !== null).length;
  
  console.log(`  📊 成功補全 ${filledFields}/6 個欄位`);
  
  // 更新統計
  stats.total++;
  if (filledFields === 6) stats.success6++;
  else if (filledFields === 5) stats.success5++;
  else if (filledFields >= 4) stats.success4++;
  else stats.failed++;
  
  // 更新欄位統計
  if (result.composer) stats.byField.composer++;
  if (result.lyricist) stats.byField.lyricist++;
  if (result.arranger) stats.byField.arranger++;
  if (result.producer) stats.byField.producer++;
  if (result.year) stats.byField.year++;
  if (result.bpm) stats.byField.bpm++;
  
  return Object.keys(result.sources).length > 0 ? result : null;
}

// ===== 更新 Firebase =====
async function updateSong(songData) {
  try {
    const updateData = {};
    if (songData.composer) updateData.composer = songData.composer;
    if (songData.lyricist) updateData.lyricist = songData.lyricist;
    if (songData.arranger) updateData.arranger = songData.arranger;
    if (songData.producer) updateData.producer = songData.producer;
    if (songData.year) updateData.year = songData.year;
    if (songData.bpm) updateData.bpm = parseInt(songData.bpm);
    updateData.metadataUpdatedAt = new Date().toISOString();
    
    if (Object.keys(updateData).length > 0) {
      await db.collection('tabs').doc(songData.songId).update(updateData);
      console.log(`  💾 已更新到 Firebase`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`  ❌ 更新失敗:`, error.message);
    return false;
  }
}

// ===== 主程序 =====
async function main() {
  console.log('🎸 歌曲資料自動補全工具');
  console.log('======================\n');
  
  // 讀取所有歌曲
  console.log('📖 讀取歌曲清單...');
  const snapshot = await db.collection('tabs').get();
  const songs = [];
  
  snapshot.forEach((doc, index) => {
    const data = doc.data();
    songs.push({
      index: songs.length + 1,
      id: doc.id,
      title: data.title || '',
      artist: data.artist || data.artistName || '',
      composer: data.composer || '',
      lyricist: data.lyricist || '',
      arranger: data.arranger || '',
      producer: data.producer || '',
      year: data.year || '',
      bpm: data.bpm || null
    });
  });
  
  console.log(`找到 ${songs.length} 首歌曲\n`);
  
  // 處理模式
  const testMode = process.argv.includes('--test');
  const limit = testMode ? 10 : songs.length;
  
  console.log(`🚀 ${testMode ? '測試模式' : '正式模式'}：處理 ${limit} 首歌曲\n`);
  
  const results = [];
  for (let i = 0; i < limit; i++) {
    const song = songs[i];
    
    const enriched = await enrichSong(song);
    if (enriched) {
      results.push(enriched);
      
      // 如果不是測試模式，更新到 Firebase
      if (!testMode) {
        await updateSong(enriched);
      }
    }
    
    // 延遲避免被封
    await delay(2000);
  }
  
  // 生成報告
  console.log('\n\n' + '='.repeat(50));
  console.log('📊 處理報告');
  console.log('='.repeat(50));
  console.log(`總處理歌曲數：${stats.total} 首`);
  console.log(`成功補全 6 個欄位：${stats.success6} 首 (${((stats.success6/stats.total)*100).toFixed(1)}%)`);
  console.log(`成功 5 個欄位：${stats.success5} 首 (${((stats.success5/stats.total)*100).toFixed(1)}%)`);
  console.log(`成功 4 個或以下：${stats.success4} 首 (${((stats.success4/stats.total)*100).toFixed(1)}%)`);
  console.log(`完全無新資料：${stats.failed} 首 (${((stats.failed/stats.total)*100).toFixed(1)}%)`);
  
  console.log('\n📈 按欄位統計：');
  console.log(`  作曲：${stats.byField.composer} 首 (${((stats.byField.composer/stats.total)*100).toFixed(1)}%)`);
  console.log(`  填詞：${stats.byField.lyricist} 首 (${((stats.byField.lyricist/stats.total)*100).toFixed(1)}%)`);
  console.log(`  編曲：${stats.byField.arranger} 首 (${((stats.byField.arranger/stats.total)*100).toFixed(1)}%)`);
  console.log(`  監製：${stats.byField.producer} 首 (${((stats.byField.producer/stats.total)*100).toFixed(1)}%)`);
  console.log(`  年份：${stats.byField.year} 首 (${((stats.byField.year/stats.total)*100).toFixed(1)}%)`);
  console.log(`  BPM：${stats.byField.bpm} 首 (${((stats.byField.bpm/stats.total)*100).toFixed(1)}%)`);
  
  // 保存結果到文件
  if (results.length > 0) {
    const outputFile = `metadata-enrichment-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\n💾 詳細結果已保存到：${outputFile}`);
  }
  
  console.log('\n✅ 處理完成！');
  process.exit(0);
}

main().catch(err => {
  console.error('程序錯誤：', err);
  process.exit(1);
});

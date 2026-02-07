/**
 * 使用 Spotify API 獲取歌曲 BPM 及元數據
 * 
 * 使用方法:
 * node scripts/fetch-bpm-spotify.js --test      (測試模式，處理5首)
 * node scripts/fetch-bpm-spotify.js --dry-run   (預覽模式，不寫入)
 * node scripts/fetch-bpm-spotify.js             (正式模式)
 */

const axios = require('axios');
const qs = require('querystring');
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');
const fs = require('fs');
const path = require('path');

// 載入環境變數
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// 初始化 Firebase
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// Spotify 配置
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ 錯誤：請設置 SPOTIFY_CLIENT_ID 和 SPOTIFY_CLIENT_SECRET 環境變數');
  console.log('請參考 SPOTIFY_SETUP.md 進行設置');
  process.exit(1);
}

// 延遲函數
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 獲取 Spotify Access Token
async function getAccessToken() {
  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      qs.stringify({ grant_type: 'client_credentials' }),
      {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );
    
    return response.data.access_token;
  } catch (error) {
    console.error('❌ 獲取 Access Token 失敗:', error.response?.data || error.message);
    throw error;
  }
}

// 搜尋歌曲
async function searchTrack(accessToken, artist, title) {
  try {
    // 構建搜尋查詢
    const query = encodeURIComponent(`track:${title} artist:${artist}`);
    const url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=5`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      timeout: 10000
    });
    
    const tracks = response.data.tracks?.items;
    
    if (!tracks || tracks.length === 0) {
      // 嘗試寬鬆搜尋
      const looseQuery = encodeURIComponent(`${artist} ${title}`);
      const looseUrl = `https://api.spotify.com/v1/search?q=${looseQuery}&type=track&limit=5`;
      
      const looseResponse = await axios.get(looseUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 10000
      });
      
      return looseResponse.data.tracks?.items || [];
    }
    
    return tracks;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('  ⚠️  Token 過期，重新獲取...');
      throw new Error('TOKEN_EXPIRED');
    }
    console.error('  ❌ 搜尋失敗:', error.response?.data?.error?.message || error.message);
    return [];
  }
}

// 獲取音頻特徵
async function getAudioFeatures(accessToken, trackId) {
  try {
    const url = `https://api.spotify.com/v1/audio-features/${trackId}`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      timeout: 10000
    });
    
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('TOKEN_EXPIRED');
    }
    console.error('  ❌ 獲取音頻特徵失敗:', error.response?.data?.error?.message || error.message);
    return null;
  }
}

// Key 數字轉換為音名
function keyToName(key, mode) {
  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const keyName = keys[key] || 'Unknown';
  const modeName = mode === 1 ? 'Major' : 'Minor';
  return `${keyName} ${modeName}`;
}

// 處理單首歌曲
async function processSong(accessToken, song) {
  console.log(`\n🎵 ${song.artist} - ${song.title}`);
  
  // 搜尋歌曲
  const tracks = await searchTrack(accessToken, song.artist, song.title);
  
  if (!tracks || tracks.length === 0) {
    console.log('  ❌ Spotify 找不到此歌曲');
    return null;
  }
  
  // 選最匹配的歌曲（通常第一個）
  const track = tracks[0];
  
  console.log(`  ✅ 找到: ${track.artists.map(a => a.name).join(', ')} - ${track.name}`);
  console.log(`     專輯: ${track.album.name} (${track.album.release_date})`);
  
  // 獲取音頻特徵
  const features = await getAudioFeatures(accessToken, track.id);
  
  if (!features) {
    console.log('  ❌ 無法獲取音頻特徵');
    return null;
  }
  
  const result = {
    id: song.id,
    title: song.title,
    artist: song.artist,
    spotifyId: track.id,
    spotifyUrl: track.external_urls.spotify,
    previewUrl: track.preview_url,
    
    // 音頻特徵
    bpm: features.tempo ? Math.round(features.tempo) : null,
    key: features.key !== undefined && features.mode !== undefined 
      ? keyToName(features.key, features.mode) 
      : null,
    camelot: features.key !== undefined && features.mode !== undefined
      ? `${(features.key + 1).toString().padStart(2, '0')}${features.mode === 1 ? 'B' : 'A'}`
      : null,
    energy: features.energy,
    danceability: features.danceability,
    valence: features.valence,
    acousticness: features.acousticness,
    instrumentalness: features.instrumentalness,
    
    // 年份
    year: track.album.release_date?.substring(0, 4) || null,
    album: track.album.name,
    popularity: track.popularity,
    duration: track.duration_ms,
    
    source: 'Spotify'
  };
  
  console.log(`  📊 BPM: ${result.bpm || 'N/A'}`);
  if (result.key) console.log(`     Key: ${result.key}`);
  if (result.camelot) console.log(`     Camelot: ${result.camelot}`);
  if (result.year) console.log(`     Year: ${result.year}`);
  
  return result;
}

// 主程序
async function main() {
  const args = process.argv.slice(2);
  const testMode = args.includes('--test');
  const dryRun = args.includes('--dry-run');
  
  console.log('🎵 Spotify BPM 獲取工具');
  console.log('======================\n');
  
  if (testMode) console.log('🧪 測試模式\n');
  if (dryRun) console.log('👁️  預覽模式（不會寫入資料庫）\n');
  
  // 獲取 Access Token
  console.log('🔑 獲取 Spotify Access Token...');
  let accessToken;
  try {
    accessToken = await getAccessToken();
    console.log('✅ 獲取成功\n');
  } catch (err) {
    console.error('❌ 無法獲取 Access Token，請檢查 CLIENT_ID 和 CLIENT_SECRET');
    process.exit(1);
  }
  
  // 讀取歌曲
  console.log('📖 讀取歌曲清單...');
  const snapshot = await db.collection('tabs').get();
  const songs = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    // 只處理缺少 BPM 或資料的歌曲
    const needsUpdate = !data.bpm || !data.year || !data.key;
    if (needsUpdate) {
      songs.push({
        id: doc.id,
        title: data.title || '',
        artist: data.artist || data.artistName || '',
        bpm: data.bpm || null,
        year: data.year || null
      });
    }
  });
  
  console.log(`找到 ${songs.length} 首需要更新的歌曲\n`);
  
  if (songs.length === 0) {
    console.log('✅ 所有歌曲已有完整資料');
    process.exit(0);
  }
  
  // 限制數量
  const limit = testMode ? 5 : songs.length;
  const targetSongs = songs.slice(0, limit);
  
  console.log(`🚀 處理前 ${targetSongs.length} 首歌曲\n`);
  
  const results = [];
  let found = 0;
  let notFound = 0;
  let retryCount = 0;
  
  for (let i = 0; i < targetSongs.length; i++) {
    const song = targetSongs[i];
    
    try {
      const result = await processSong(accessToken, song);
      
      if (result && result.bpm) {
        results.push(result);
        found++;
        
        // 更新 Firebase
        if (!dryRun) {
          try {
            await db.collection('tabs').doc(song.id).update({
              bpm: result.bpm,
              key: result.key,
              camelot: result.camelot,
              spotifyId: result.spotifyId,
              spotifyUrl: result.spotifyUrl,
              year: result.year || song.year,
              energy: result.energy,
              danceability: result.danceability,
              valence: result.valence,
              acousticness: result.acousticness,
              metadataSource: 'Spotify',
              metadataUpdatedAt: new Date().toISOString()
            });
            console.log('  💾 已保存到資料庫');
          } catch (err) {
            console.error(`  ❌ 保存失敗: ${err.message}`);
          }
        }
      } else {
        notFound++;
      }
    } catch (err) {
      if (err.message === 'TOKEN_EXPIRED' && retryCount < 3) {
        console.log('  🔄 重新獲取 Token...');
        accessToken = await getAccessToken();
        i--; // 重試
        retryCount++;
        continue;
      }
      console.error(`  ❌ 處理失敗: ${err.message}`);
      notFound++;
    }
    
    retryCount = 0;
    
    // 延遲避免速率限制
    if (i < targetSongs.length - 1) {
      await delay(1500);
    }
  }
  
  // 報告
  console.log('\n' + '='.repeat(50));
  console.log('📊 處理報告');
  console.log('='.repeat(50));
  console.log(`處理歌曲：${targetSongs.length} 首`);
  console.log(`找到 BPM：${found} 首 (${((found/targetSongs.length)*100).toFixed(1)}%)`);
  console.log(`未找到：${notFound} 首 (${((notFound/targetSongs.length)*100).toFixed(1)}%)`);
  
  // 保存結果
  if (results.length > 0) {
    const filename = `spotify-results-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`\n💾 詳細結果已保存：${filename}`);
    
    // 顯示一些統計
    const bpms = results.filter(r => r.bpm).map(r => r.bpm);
    if (bpms.length > 0) {
      const avgBpm = bpms.reduce((a, b) => a + b, 0) / bpms.length;
      console.log(`\n📈 BPM 統計：`);
      console.log(`  平均：${avgBpm.toFixed(1)}`);
      console.log(`  最高：${Math.max(...bpms)}`);
      console.log(`  最低：${Math.min(...bpms)}`);
    }
  }
  
  console.log('\n✅ 完成！');
  process.exit(0);
}

main().catch(err => {
  console.error('程序錯誤：', err);
  process.exit(1);
});

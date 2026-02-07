/**
 * 生成歌曲資料補全模板（CSV 格式）
 * 方便手動填寫或使用 Excel 編輯
 */

const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');
const fs = require('fs');

// 初始化 Firebase
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function generateTemplate() {
  console.log('📄 生成歌曲資料補全模板...\n');
  
  // 讀取所有歌曲
  const snapshot = await db.collection('tabs').get();
  const songs = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    songs.push({
      id: doc.id,
      title: data.title || '',
      artist: data.artist || data.artistName || '',
      composer: data.composer || '',
      lyricist: data.lyricist || '',
      arranger: data.arranger || '',
      producer: data.producer || '',
      year: data.year || '',
      bpm: data.bpm || ''
    });
  });
  
  // 按缺失資料數量排序（優先顯示需要補全最多的）
  songs.sort((a, b) => {
    const aMissing = ['composer', 'lyricist', 'arranger', 'producer', 'year', 'bpm']
      .filter(field => !a[field] || String(a[field]).trim() === '').length;
    const bMissing = ['composer', 'lyricist', 'arranger', 'producer', 'year', 'bpm']
      .filter(field => !b[field] || String(b[field]).trim() === '').length;
    return bMissing - aMissing;
  });
  
  // 生成 CSV
  const csvHeader = 'id,title,artist,composer,lyricist,arranger,producer,year,bpm\n';
  const csvRows = songs.map(song => {
    return [
      song.id,
      `"${song.title.replace(/"/g, '""')}"`,
      `"${song.artist.replace(/"/g, '""')}"`,
      `"${song.composer.replace(/"/g, '""')}"`,
      `"${song.lyricist.replace(/"/g, '""')}"`,
      `"${song.arranger.replace(/"/g, '""')}"`,
      `"${song.producer.replace(/"/g, '""')}"`,
      song.year,
      song.bpm
    ].join(',');
  }).join('\n');
  
  const csvContent = csvHeader + csvRows;
  
  // 保存文件
  const filename = `metadata-template-${new Date().toISOString().split('T')[0]}.csv`;
  fs.writeFileSync(filename, csvContent);
  
  console.log(`✅ 模板已生成：${filename}`);
  console.log(`📊 總計 ${songs.length} 首歌曲`);
  console.log('\n📝 使用說明：');
  console.log('1. 用 Excel 或 Google Sheets 打開 CSV 檔案');
  console.log('2. 填寫空白欄位（composer, lyricist, arranger, producer, year, bpm）');
  console.log('3. 保存後運行：node scripts/import-metadata-from-csv.js --file=' + filename);
  console.log('\n💡 提示：');
  console.log('- 多人合作可用「 / 」分隔，如「林夕 / 黃偉文」');
  console.log('- 年份用 4 位數字，如「2023」');
  console.log('- BPM 用純數字，如「128」');
  
  // 生成一個熱門歌曲優先的模板
  const hotSongs = songs.slice(0, 50);
  const hotCsvContent = csvHeader + hotSongs.map(song => {
    return [
      song.id,
      `"${song.title.replace(/"/g, '""')}"`,
      `"${song.artist.replace(/"/g, '""')}"`,
      `"${song.composer.replace(/"/g, '""')}"`,
      `"${song.lyricist.replace(/"/g, '""')}"`,
      `"${song.arranger.replace(/"/g, '""')}"`,
      `"${song.producer.replace(/"/g, '""')}"`,
      song.year,
      song.bpm
    ].join(',');
  }).join('\n');
  
  const hotFilename = `metadata-template-hot50-${new Date().toISOString().split('T')[0]}.csv`;
  fs.writeFileSync(hotFilename, hotCsvContent);
  
  console.log(`\n🔥 熱門歌曲模板（前 50 首）：${hotFilename}`);
  
  process.exit(0);
}

generateTemplate().catch(err => {
  console.error('錯誤：', err);
  process.exit(1);
});

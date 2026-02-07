#!/usr/bin/env node
/**
 * Spotify API 快速設置腳本
 * 檢查並引導用戶完成設置
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('🎵 Spotify API 設置助手');
  console.log('======================\n');
  
  const envPath = path.join(__dirname, '../.env.local');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }
  
  // 檢查現有設置
  const hasClientId = envContent.includes('SPOTIFY_CLIENT_ID=') && 
                      envContent.match(/SPOTIFY_CLIENT_ID=[a-f0-9]{32}/);
  const hasClientSecret = envContent.includes('SPOTIFY_CLIENT_SECRET=') && 
                          envContent.match(/SPOTIFY_CLIENT_SECRET=[a-f0-9]{32}/);
  
  if (hasClientId && hasClientSecret) {
    console.log('✅ Spotify API 已設置完成！');
    console.log('可以運行：node scripts/fetch-bpm-spotify.js --test');
    rl.close();
    return;
  }
  
  console.log('⚠️  尚未設置 Spotify API\n');
  console.log('請按照以下步驟操作：\n');
  console.log('1. 打開 https://developer.spotify.com/dashboard/');
  console.log('2. 用 Spotify 帳號登入（或註冊新帳號）');
  console.log('3. 點擊「Create an App」');
  console.log('4. 填寫：');
  console.log('   - App name: Polygon Guitar Metadata');
  console.log('   - Description: 自動獲取歌曲 BPM');
  console.log('5. 勾選同意條款，點擊 Create');
  console.log('6. 複製 Client ID 和 Client Secret\n');
  
  const clientId = await question('請輸入 Client ID: ');
  const clientSecret = await question('請輸入 Client Secret: ');
  
  // 驗證輸入
  if (!clientId.match(/^[a-f0-9]{32}$/i)) {
    console.error('\n❌ Client ID 格式錯誤，應該是 32 位十六進制字符');
    rl.close();
    process.exit(1);
  }
  
  if (!clientSecret.match(/^[a-f0-9]{32}$/i)) {
    console.error('\n❌ Client Secret 格式錯誤，應該是 32 位十六進制字符');
    rl.close();
    process.exit(1);
  }
  
  // 更新 .env.local
  let newEnvContent = envContent;
  
  if (envContent.includes('SPOTIFY_CLIENT_ID=')) {
    newEnvContent = newEnvContent.replace(/SPOTIFY_CLIENT_ID=.*/g, `SPOTIFY_CLIENT_ID=${clientId}`);
  } else {
    newEnvContent += `\nSPOTIFY_CLIENT_ID=${clientId}`;
  }
  
  if (envContent.includes('SPOTIFY_CLIENT_SECRET=')) {
    newEnvContent = newEnvContent.replace(/SPOTIFY_CLIENT_SECRET=.*/g, `SPOTIFY_CLIENT_SECRET=${clientSecret}`);
  } else {
    newEnvContent += `\nSPOTIFY_CLIENT_SECRET=${clientSecret}`;
  }
  
  fs.writeFileSync(envPath, newEnvContent.trim() + '\n');
  
  console.log('\n✅ Spotify API 設置完成！');
  console.log('設置已保存到 .env.local');
  console.log('\n現在可以運行：');
  console.log('  node scripts/fetch-bpm-spotify.js --test    (測試模式)');
  console.log('  node scripts/fetch-bpm-spotify.js           (正式模式)');
  
  rl.close();
}

main().catch(err => {
  console.error('錯誤：', err);
  process.exit(1);
});

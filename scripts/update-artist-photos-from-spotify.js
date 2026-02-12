// 從 Spotify 更新歌手相片
// 用法：node scripts/update-artist-photos-from-spotify.js [batch-size] [start-index]
// 例如：node scripts/update-artist-photos-from-spotify.js 50 0 （更新頭50個）

const { initializeApp, cert, getApps } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

// Spotify API 配置
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '72f2aeeead5e4ebd986dbb890ae064bd'
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '1fdfbfde090841d2aad7769322bdda72'

// 初始化 Firebase Admin
function getAdminDb() {
  if (getApps().length === 0) {
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
    
    if (privateKey && process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || 'polygon-guitar-v2',
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: privateKey
        })
      })
    } else {
      initializeApp()
    }
  }
  return getFirestore()
}

// 獲取 Spotify Access Token
async function getSpotifyToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')
    },
    body: 'grant_type=client_credentials'
  })
  
  const data = await response.json()
  return data.access_token
}

// 搜索 Spotify 歌手
async function searchSpotifyArtist(artistName, token) {
  try {
    // 清理歌手名（移除括號內容等）
    const cleanName = artistName.replace(/\s*[\(\（].*?[\)\）]\s*/g, '').trim()
    
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(cleanName)}&type=artist&limit=1`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )
    
    const data = await response.json()
    const artist = data.artists?.items?.[0]
    
    if (!artist) return null
    
    // 檢查名稱相似度（避免搵錯）
    const spotifyName = artist.name.toLowerCase()
    const searchName = cleanName.toLowerCase()
    
    // 簡單匹配：包含或被包含
    if (spotifyName.includes(searchName) || searchName.includes(spotifyName)) {
      return {
        id: artist.id,
        name: artist.name,
        images: artist.images, // 大中小三個尺寸
        popularity: artist.popularity,
        genres: artist.genres
      }
    }
    
    return null
  } catch (error) {
    console.error(`搜索 ${artistName} 失敗:`, error)
    return null
  }
}

// 主要程序
async function main() {
  const args = process.argv.slice(2)
  const batchSize = parseInt(args[0]) || 50  // 默認50個
  const startIndex = parseInt(args[1]) || 0  // 默認從頭開始
  const sortBySongs = args[2] !== 'false'    // 默認按歌曲數排序
  
  console.log('========================================')
  console.log('Spotify 歌手相片更新程序')
  console.log('========================================')
  console.log(`批次大小: ${batchSize}`)
  console.log(`開始位置: ${startIndex}`)
  console.log(`排序方式: ${sortBySongs ? '按歌曲數（熱門優先）' : '按名字'}`)
  console.log('')
  
  const db = getAdminDb()
  
  // 獲取 Spotify Token
  console.log('獲取 Spotify Token...')
  const token = await getSpotifyToken()
  console.log('✅ Token 獲取成功\n')
  
  // 獲取所有歌手
  console.log('獲取歌手列表...')
  const artistsSnapshot = await db.collection('artists').get()
  let artists = artistsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
  
  console.log(`總共有 ${artists.length} 個歌手`)
  
  // 按歌曲數排序（如果啟用）
  if (sortBySongs) {
    artists.sort((a, b) => (b.songCount || b.tabCount || 0) - (a.songCount || a.tabCount || 0))
    console.log('已按歌曲數排序（熱門歌手優先）')
  }
  
  // 取批次
  const batchArtists = artists.slice(startIndex, startIndex + batchSize)
  console.log(`本次處理: ${batchArtists.length} 個歌手\n`)
  
  // 統計
  let success = 0
  let failed = 0
  let skipped = 0
  const results = []
  
  // 逐個處理
  for (let i = 0; i < batchArtists.length; i++) {
    const artist = batchArtists[i]
    const currentNum = startIndex + i + 1
    
    console.log(`[${currentNum}/${artists.length}] ${artist.name}`)
    
    // 檢查是否已有用戶上傳的相片
    if (artist.photoURL && !artist.photoURL.includes('spotify')) {
      console.log('  ⏭️  已有用戶上傳相片，跳過')
      skipped++
      continue
    }
    
    // 搜索 Spotify
    const spotifyArtist = await searchSpotifyArtist(artist.name, token)
    
    if (spotifyArtist && spotifyArtist.images.length > 0) {
      // 取最大尺寸嘅圖片
      const largestImage = spotifyArtist.images[0]
      
      // 更新 Firestore
      await db.collection('artists').doc(artist.id).update({
        spotifyId: spotifyArtist.id,
        spotifyPhotoURL: largestImage.url,
        // 如果有維基圖片，保留做後備
        wikiPhotoURL: artist.wikiPhotoURL || null,
        // 標記來源
        photoSource: 'spotify',
        updatedAt: new Date()
      })
      
      console.log(`  ✅ 更新成功 (${largestImage.width}x${largestImage.height})`)
      success++
      results.push({
        name: artist.name,
        status: 'success',
        imageUrl: largestImage.url
      })
    } else {
      console.log('  ❌ 找不到 Spotify 資料')
      failed++
      results.push({
        name: artist.name,
        status: 'failed'
      })
    }
    
    // 延遲避免 rate limit（每秒最多 2 個）
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  // 報告
  console.log('\n========================================')
  console.log('處理完成！')
  console.log('========================================')
  console.log(`✅ 成功: ${success}`)
  console.log(`❌ 失敗: ${failed}`)
  console.log(`⏭️ 跳過: ${skipped}`)
  console.log(`
下次更新指令:`)
  console.log(`node scripts/update-artist-photos-from-spotify.js ${batchSize} ${startIndex + batchSize}`)
}

main().catch(console.error)

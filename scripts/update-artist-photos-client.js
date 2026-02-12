// 從 Spotify 更新歌手相片（Client SDK 版本）
// 用法：先登入 Firebase，然後執行

const { initializeApp } = require('firebase/app')
const { 
  getAuth, 
  signInWithEmailAndPassword,
  onAuthStateChanged 
} = require('firebase/auth')
const { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  updateDoc,
  query,
  orderBy
} = require('firebase/firestore')

// Firebase Client 配置
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
}

// Spotify API 配置
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

// 初始化 Firebase
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

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
    
    const spotifyName = artist.name.toLowerCase()
    const searchName = cleanName.toLowerCase()
    
    if (spotifyName.includes(searchName) || searchName.includes(spotifyName)) {
      return {
        id: artist.id,
        name: artist.name,
        images: artist.images,
        popularity: artist.popularity
      }
    }
    
    return null
  } catch (error) {
    console.error(`搜索 ${artistName} 失敗:`, error)
    return null
  }
}

// 主要更新程序
async function updateArtistPhotos(batchSize = 100, startIndex = 0) {
  console.log('========================================')
  console.log('Spotify 歌手相片更新程序 (Client SDK)')
  console.log('========================================')
  console.log(`批次大小: ${batchSize}`)
  console.log(`開始位置: ${startIndex}`)
  console.log('')
  
  // 獲取 Spotify Token
  console.log('獲取 Spotify Token...')
  const token = await getSpotifyToken()
  console.log('✅ Token 獲取成功\n')
  
  // 獲取所有歌手
  console.log('獲取歌手列表...')
  const artistsQuery = query(collection(db, 'artists'), orderBy('name'))
  const artistsSnapshot = await getDocs(artistsQuery)
  let artists = artistsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
  
  console.log(`總共有 ${artists.length} 個歌手`)
  
  // 按歌曲數排序
  artists.sort((a, b) => (b.songCount || b.tabCount || 0) - (a.songCount || a.tabCount || 0))
  
  // 取批次
  const batchArtists = artists.slice(startIndex, startIndex + batchSize)
  console.log(`本次處理: ${batchArtists.length} 個歌手\n`)
  
  let success = 0
  let failed = 0
  let skipped = 0
  
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
      const largestImage = spotifyArtist.images[0]
      
      // 更新 Firestore
      await updateDoc(doc(db, 'artists', artist.id), {
        spotifyId: spotifyArtist.id,
        spotifyPhotoURL: largestImage.url,
        wikiPhotoURL: artist.wikiPhotoURL || null,
        photoSource: 'spotify',
        updatedAt: new Date()
      })
      
      console.log(`  ✅ 更新成功 (${largestImage.width}x${largestImage.height})`)
      success++
    } else {
      console.log('  ❌ 找不到 Spotify 資料')
      failed++
    }
    
    // 延遲避免 rate limit
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  console.log('\n========================================')
  console.log('處理完成！')
  console.log('========================================')
  console.log(`✅ 成功: ${success}`)
  console.log(`❌ 失敗: ${failed}`)
  console.log(`⏭️ 跳過: ${skipped}`)
}

// 登入並執行
async function main() {
  const email = process.env.ADMIN_EMAIL || 'kermit.tam@gmail.com'
  const password = process.env.ADMIN_PASSWORD
  
  if (!password) {
    console.error('請設置環境變數 ADMIN_PASSWORD')
    console.error('例如: ADMIN_PASSWORD=你的密碼 node scripts/update-artist-photos-client.js')
    process.exit(1)
  }
  
  console.log('登入中...')
  
  try {
    await signInWithEmailAndPassword(auth, email, password)
    console.log('✅ 登入成功\n')
    
    const batchSize = parseInt(process.argv[2]) || 100
    const startIndex = parseInt(process.argv[3]) || 0
    
    await updateArtistPhotos(batchSize, startIndex)
    process.exit(0)
  } catch (error) {
    console.error('登入失敗:', error.message)
    process.exit(1)
  }
}

main()

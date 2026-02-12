# Spotify API 設置指南

## 已配置資料

```bash
Client ID: 72f2aeeead5e4ebd986dbb890ae064bd
Client Secret: 1fdfbfde090841d2aad7769322bdda72
```

## 環境變數設置

將以下內容加入 `.env.local`：

```bash
SPOTIFY_CLIENT_ID=72f2aeeead5e4ebd986dbb890ae064bd
SPOTIFY_CLIENT_SECRET=1fdfbfde090841d2aad7769322bdda72
```

## 可用功能

### 1. 搜索歌曲

```javascript
import { searchSpotifyTrack, formatSpotifyTrack } from '@/lib/spotify'

// 搜索歌曲
const tracks = await searchSpotifyTrack('陳奕迅 十年', 5)

// 格式化結果
const formatted = tracks.map(formatSpotifyTrack)
// 返回：歌名、歌手、專輯、封面、發行日期、試聽連結等
```

### 2. 獲取專輯資料

```javascript
import { getSpotifyAlbum } from '@/lib/spotify'

const album = await getSpotifyAlbum('專輯ID')
// 返回：專輯名、發行日期、封面圖片、曲目列表等
```

### 3. 獲取歌手資料

```javascript
import { getSpotifyArtist, getSpotifyArtistTopTracks } from '@/lib/spotify'

const artist = await getSpotifyArtist('歌手ID')
const topTracks = await getSpotifyArtistTopTracks('歌手ID')
```

## 應用場景

### 上傳樂譜時自動填充資料

當用戶輸入歌名時，可以：
1. 自動搜索 Spotify 獲取歌曲資料
2. 填充專輯封面（高質素）
3. 填充發行年份
4. 填充歌手名稱
5. 提供 30 秒試聽

### 歌手頁面增強

- 顯示歌手熱門歌曲（來自 Spotify 數據）
- 顯示歌手專輯列表
- 顯示歌手相片（高質素）

## 注意事項

1. **Rate Limit**：Spotify API 有請求限制，建議添加緩存
2. **圖片版權**：Spotify 提供的圖片僅可用於顯示，不可下載存儲
3. **試聽限制**：preview_url 只提供 30 秒試聽

## 測試

創建測試頁面 `/pages/test-spotify.js`：

```javascript
import { searchSpotifyTrack, formatSpotifyTrack } from '@/lib/spotify'

export default function TestSpotify() {
  const handleSearch = async () => {
    const tracks = await searchSpotifyTrack('陳奕迅', 5)
    console.log(tracks.map(formatSpotifyTrack))
  }
  
  return <button onClick={handleSearch}>測試搜索</button>
}
```

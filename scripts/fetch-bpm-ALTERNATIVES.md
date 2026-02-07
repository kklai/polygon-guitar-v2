# BPM 獲取替代方案

## 問題
Tunebat、SongBPM 等網站都有嚴格嘅反爬蟲機制，無法直接抓取。

## 可行方案

### 方案 1: 使用 Spotify API（推薦）

Spotify 提供官方 API，可以獲取歌曲 BPM（tempo）。

#### 申請步驟
1. 到 https://developer.spotify.com/dashboard 創建開發者帳號
2. 創建 App，獲取 `Client ID` 和 `Client Secret`
3. 使用 API 獲取歌曲資料

#### 示例代碼
```javascript
const SpotifyWebApi = require('spotify-web-api-node');

const spotifyApi = new SpotifyWebApi({
  clientId: '你的_CLIENT_ID',
  clientSecret: '你的_CLIENT_SECRET'
});

// 搜尋歌曲
const data = await spotifyApi.searchTracks('track:稻香 artist:周杰倫');
const track = data.body.tracks.items[0];

// 獲取音頻特徵（包含 BPM）
const features = await spotifyApi.getAudioFeaturesForTrack(track.id);
console.log('BPM:', features.body.tempo);
```

#### 優缺點
- ✅ 官方 API，穩定可靠
- ✅ 有中文歌資料
- ❌ 簡體中文為主
- ❌ 部分香港本地歌可能冇

---

### 方案 2: 使用 GetSongBPM API

GetSongBPM 有官方 API：https://getsongbpm.com/api

#### 價格
- 免費版：每月 100 次請求
- 付費版：$5/月起，更多配額

#### 優缺點
- ✅ 專門提供 BPM 資料
- ✅ 有 API，合法使用
- ❌ 付費（但價格合理）
- ❌ 中文歌覆蓋率未知

---

### 方案 3: 手動批量導入（推薦短期）

使用已生成嘅 CSV 模板，手動從以下網站查詢 BPM：

1. **Tunebat**: https://tunebat.com (手動查詢)
2. **SongBPM**: https://songbpm.com (手動查詢)
3. **Musicstax**: https://musicstax.com (手動查詢)

然後填入 CSV，用導入腳本導入。

---

### 方案 4: 使用 MusicBrainz + AcousticBrainz

MusicBrainz 是開源音樂資料庫，AcousticBrainz 提供 BPM 等音頻特徵。

#### API 端點
```
https://musicbrainz.org/ws/2/recording/?query=recording:稻香+artist:周杰倫&fmt=json
```

#### 優缺點
- ✅ 開源免費
- ✅ 無嚴格限制
- ❌ 資料可能不完整
- ❌ 需要二次查詢 AcousticBrainz 獲取 BPM

---

## 建議

對於你嘅項目（以香港/中文歌為主），我建議：

### 短期（立即可行）
1. 手動查詢熱門 50 首嘅 BPM
2. 填入 CSV 導入

### 中期
1. 申請 Spotify API
2. 寫自動化腳本補全 BPM

### 長期
1. 用戶上傳譜時，可以選填 BPM
2. 累積用戶貢獻嘅資料

---

## 需要我實施哪個方案？

請告訴我，我可以：
1. 幫你申請 Spotify API 並寫腳本
2. 生成待查詢清單（Excel 格式）
3. 寫 MusicBrainz 查詢腳本

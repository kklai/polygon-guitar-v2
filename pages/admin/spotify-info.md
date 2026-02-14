# Spotify API 可以攞到嘅歌手資料

## 歌手資料 (Get Artist)

### 基本資料
- `name` - 歌手名
- `id` - Spotify ID
- `uri` - Spotify URI
- `href` - API endpoint

### 圖片
- `images` - 歌手相片（多個尺寸）
  - height, width, url

### 元數據
- `genres` - 音樂類型（如 "cantopop", "mandopop", "rock"）
- `popularity` - 人氣度 (0-100)
- `followers.total` - 粉絲數量

### 外部連結
- `external_urls.spotify` - Spotify 頁面連結

---

## 歌手熱門歌曲 (Get Artist's Top Tracks)

- `name` - 歌名
- `id` - 歌曲 ID
- `album.name` - 專輯名
- `album.images` - 專輯封面
- `preview_url` - 30秒試聽連結
- `duration_ms` - 歌曲長度
- `popularity` - 人氣度

---

## 歌曲詳情 (Get Track)

### 基本資料
- `name` - 歌名
- `id` - 歌曲 ID
- `duration_ms` - 歌曲長度（毫秒）
- `preview_url` - 試聽連結
- `popularity` - 人氣度 (0-100)

### 專輯資料
- `album.name` - 專輯名
- `album.release_date` - 發行日期（如 "2023-01-15" 或 "2023"）
- `album.images` - 專輯封面
- `album.total_tracks` - 專輯歌曲數量

### 音頻特徵 (Audio Features)
- `danceability` - 舞蹈性 (0-1)
- `energy` - 能量 (0-1)
- `key` - 調性 (0-11，C=0, C#=1...)
- `loudness` - 音量 (dB)
- `mode` - 模式 (0=minor, 1=major)
- `speechiness` - 語音性 (0-1)
- `acousticness` - 原聲性 (0-1)
- `instrumentalness` - 純音樂性 (0-1)
- `liveness` - 現場感 (0-1)
- `valence` - 情緒正向度 (0-1，愈高愈開心)
- `tempo` - BPM 節奏速度
- `time_signature` - 拍號 (如 4/4)

---

## 建議用途

### 歌手頁面可以顯示
- [x] 歌手相片（已實現）
- [ ] 音樂類型（genres）
- [ ] 人氣度（popularity）
- [ ] 粉絲數（followers）
- [ ] 熱門歌曲 Top 10
- [ ] Spotify 連結

### 譜頁面可以顯示
- [ ] 專輯封面
- [ ] 發行年份
- [ ] BPM（節奏速度）
- [ ] 調性（Key）
- [ ] 歌曲長度
- [ ] 試聽連結
- [ ] 情緒分析（valence）

### 後台管理
- [ ] 批量更新歌手類型
- [ ] 根據 BPM 分類歌曲
- [ ] 顯示歌手人氣排名

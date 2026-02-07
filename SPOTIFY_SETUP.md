# Spotify API 申請及設置指南

## 第一步：創建 Spotify 開發者帳號

1. 打開 https://developer.spotify.com/dashboard/
2. 點擊「Log in」用 Spotify 帳號登入（如果冇帳號，先註冊一個）
3. 登入後點擊「Create an App」

## 第二步：創建 App

1. 填寫 App 名稱：`Polygon Guitar Metadata`
2. 填寫描述：`自動獲取歌曲 BPM 及元數據`
3. 勾選「I understand and agree...」
4. 點擊「Create」

## 第三步：獲取憑證

創建成功後，你會見到：
- **Client ID**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` （32位字符）
- **Client Secret**: 點擊「Show Client Secret」顯示

**請立即複製呢兩個值！**

## 第四步：設置環境變數

### 本地開發

編輯 `.env.local` 檔案，添加：

```bash
SPOTIFY_CLIENT_ID=你的_client_id
SPOTIFY_CLIENT_SECRET=你的_client_secret
```

### Vercel 部署

在 Vercel Dashboard → Project Settings → Environment Variables，添加：

- `SPOTIFY_CLIENT_ID` = 你的 client id
- `SPOTIFY_CLIENT_SECRET` = 你的 client secret

## 第五步：測試

運行以下命令測試：

```bash
node scripts/fetch-bpm-spotify.js --test
```

## API 限制

- 免費配額：無限（但有速率限制）
- 速率限制：建議每秒不超過 1 個請求

## 支援的資料

Spotify 提供以下音頻特徵：
- **tempo**: BPM（每分鐘拍數）
- **key**: 調性（0-11，對應 C, C#, D 等）
- **mode**: 調式（0=小調, 1=大調）
- **energy**: 能量值（0-1）
- **danceability**: 舞曲性（0-1）
- **valence**: 情緒正向度（0-1）

## 注意事項

1. **中文歌覆蓋率**：Spotify 以國際歌曲為主，部分香港本地歌可能冇資料
2. **簡繁轉換**：Spotify 使用簡體中文，搜尋時會自動處理
3. **版本問題**：同一首歌可能有多個版本（專輯版、現場版等）

## 故障排除

### 401 Unauthorized
- 檢查 Client ID 和 Client Secret 是否正確
- 檢查環境變數是否已設置

### 404 Not Found
- 歌曲在 Spotify 資料庫中不存在
- 嘗試用不同歌名或歌手名搜尋

### 429 Too Many Requests
- 請求過於頻繁
- 增加請求間隔時間（建議 1-2 秒）

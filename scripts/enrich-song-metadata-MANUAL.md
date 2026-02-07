# 歌曲資料補全方案

## 現況統計

| 欄位 | 已有資料 | 覆蓋率 | 待補全 |
|------|----------|--------|--------|
| 作曲 | 143 首 | 44.8% | 176 首 |
| 填詞 | 175 首 | 54.9% | 144 首 |
| 編曲 | 0 首 | 0% | 319 首 |
| 監製 | 0 首 | 0% | 319 首 |
| 年份 | 0 首 | 0% | 319 首 |
| BPM | 1 首 | 0.3% | 318 首 |

**總計：319 首歌曲需要補全資料**

---

## 方案一：使用 KKBOX API（推薦）

### 步驟
1. 到 https://developer.kkbox.com/ 申請開發者帳號
2. 創建 App 獲取 `CLIENT_ID` 和 `CLIENT_SECRET`
3. 使用 KKBOX API 搜尋歌曲資料

### 優點
- 中文歌資料齊全
- 有作曲、填詞、編曲資料
- API 穩定

### 缺點
- 需要申請
- 無 BPM 資料

---

## 方案二：使用網易雲音樂 API

### 步驟
1. 使用開源項目如 `NeteaseCloudMusicApi`
2. 部署後端服務
3. 調用 API 獲取歌曲資料

### 優點
- 中文歌資料非常齊全
- 免費

### 缺點
- 需要部署服務
- 可能有法律風險

---

## 方案三：使用 Spotify API（國際歌曲）

### 步驟
1. 到 https://developer.spotify.com/ 申請開發者帳號
2. 獲取 `CLIENT_ID` 和 `CLIENT_SECRET`
3. 使用 Spotify Web API 搜尋

### 優點
- 國際歌曲資料齊全
- 有 BPM（Tempo）資料

### 缺點
- 中文歌資料較少
- 簡體中文為主

---

## 方案四：CSV 批量導入（手動整理）

如果你已有 Excel/CSV 檔案，可以使用以下腳本導入：

```bash
node scripts/import-metadata-from-csv.js --file=songs-metadata.csv
```

### CSV 格式要求
```csv
title,artist,composer,lyricist,arranger,producer,year,bpm
十年,陳奕迅,陳小霞,林夕,陳輝陽,陳小霞,2003,72
```

---

## 方案五：半自動輔助工具

我創建了一個輔助工具，可以：
1. 生成待補全歌曲清單（CSV）
2. 手動填寫後導入

### 使用方法

```bash
# 生成待補全清單
node scripts/generate-metadata-template.js

# 填寫後導入
node scripts/import-metadata-from-csv.js --file=metadata-filled.csv
```

---

## 建議實施順序

1. **短期**：手動補全熱門歌曲（前 50 首）
2. **中期**：申請 KKBOX API，自動補全中文歌
3. **長期**：申請 Spotify API，補全國際歌曲 BPM

---

## 需要協助嗎？

請告訴我你想使用哪個方案，我可以：
1. 幫你申請 API 並配置
2. 創建 CSV 模板供你填寫
3. 寫專門的導入腳本

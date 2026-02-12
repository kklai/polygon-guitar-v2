# Spotify 歌手相片更新指南

## 階段一：更新熱門歌手（先做呢個）

更新頭 100 個最多歌嘅歌手：

```bash
node scripts/update-artist-photos-from-spotify.js 100 0
```

## 階段二：之後分批更新

每日更新 30 個，直到完成：

```bash
# 第 2 日（第 101-130 個）
node scripts/update-artist-photos-from-spotify.js 30 100

# 第 3 日（第 131-160 個）
node scripts/update-artist-photos-from-spotify.js 30 130

# 如此類推...
```

## 參數說明

```bash
node scripts/update-artist-photos-from-spotify.js [批次大小] [開始位置]
```

| 參數 | 說明 | 例子 |
|------|------|------|
| 批次大小 | 每次更新幾多個歌手 | `50` = 50個 |
| 開始位置 | 從第幾個開始 | `0` = 從頭開始 |

## 運作原理

1. **按歌曲數排序**：最多歌嘅歌手優先更新
2. **保留用戶上傳**：已有用戶上傳相片的歌手會跳過
3. **智能匹配**：檢查歌手名稱相似度，避免搵錯人
4. **自動延遲**：每個請求隔 0.5 秒，避免 rate limit

## 更新後嘅資料結構

```javascript
{
  name: "陳奕迅",
  spotifyId: "...",
  spotifyPhotoURL: "https://...",  // Spotify 大圖
  wikiPhotoURL: "https://...",      // 維基後備（如有）
  photoSource: "spotify",
  updatedAt: timestamp
}
```

## 檢查進度

```bash
# 睇下已經有幾多個歌手有 Spotify 相片
node scripts/count-spotify-photos.js
```

## 注意事項

- 第一次跑建議用 `100` 個測試
- 如果見到 `429 Too Many Requests`，要等陣先再跑
- 用戶上傳嘅相片永遠優先，唔會被覆蓋

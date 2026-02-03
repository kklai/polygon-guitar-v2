# YouTube API 設定指南

## 問題：搜尋失敗，可能 API quota 已用完

如果你看到呢個錯誤，表示 YouTube Data API v3 未正確設定或 quota 已用完。

---

## 快速解決方法

### 方法 1：立即使用（無需 API Key）
當你撳「喺站內搜尋 YouTube」而 API Key 未設定時，系統會自動開新 tab 去 YouTube 搜尋。你可以手動複製連結返嚟貼。

### 方法 2：設定 YouTube API Key（推薦）

#### 步驟 1：建立 Google Cloud 專案
1. 去 [Google Cloud Console](https://console.cloud.google.com/)
2. 登入 Google 帳號
3. 撳「Select a project」→「New Project」
4. 輸入專案名稱（例如：Polygon Guitar）
5. 撳「Create」

#### 步驟 2：啟用 YouTube Data API v3
1. 去 [API Library](https://console.cloud.google.com/apis/library)
2. 搜尋「YouTube Data API v3」
3. 撳「Enable」

#### 步驟 3：建立 API Key
1. 去 [Credentials](https://console.cloud.google.com/apis/credentials)
2. 撳「Create Credentials」→「API Key」
3. 複製生成嘅 API Key

#### 步驟 4：填入專案
1. 打開 `polygon-guitar-v2/.env.local`
2. 找到 `NEXT_PUBLIC_YOUTUBE_API_KEY=`
3. 貼上你嘅 API Key：
   ```
   NEXT_PUBLIC_YOUTUBE_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxx
   ```
4. 儲存檔案
5. **重新啟動 dev server**（重要！）
   ```bash
   npm run dev
   ```

---

## 常見問題

### Q: 為甚麼會顯示「API quota 已用完」？
YouTube Data API 每日有 10,000 quota 限制：
- 搜尋一次消耗 100 quota
- 即每日最多搜尋 100 次

**解決方法：**
- 等待次日重置（香港時間下午 4 點）
- 或申請增加 quota（需要信用卡）

### Q: 如何檢查 quota 使用情況？
1. 去 [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Dashboard
3. 揀「YouTube Data API v3」
4. 睇「Quota」部分

### Q: API Key 洩露咗點算？
1. 去 [Credentials](https://console.cloud.google.com/apis/credentials)
2. 找到你嘅 API Key
3. 撳「Delete」刪除
4. 建立新嘅 API Key
5. 更新 `.env.local`

---

## 安全提示

⚠️ **切勿將 `.env.local` 上傳到 GitHub！**

`.gitignore` 應該已包含：
```
.env.local
.env
```

如果你意外上傳咗 API Key：
1. 立即去 Google Cloud Console 刪除該 API Key
2. 建立新嘅 API Key
3. 更新 `.env.local`

---

## 測試 API Key 是否有效

喺 browser console 執行：
```javascript
fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&type=video&maxResults=1&key=你的API_KEY`)
  .then(r => r.json())
  .then(data => console.log(data))
  .catch(e => console.error(e));
```

如果返回影片資料，表示 API Key 有效。

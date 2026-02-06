# Polygon Guitar V2 - 項目記憶檔案

> 最後更新：2026-02-07（今日新增後台管理工具）
> 
> 此檔案用於保存項目背景、技術規格、設計風格及開發偏好，方便每次啟動時快速恢復上下文。

---

## 專案概覽

| 項目 | 詳情 |
|------|------|
| 名稱 | Polygon Guitar v2 |
| 網域 | polygon.guitars（已申請，未連結）|
| 技術棧 | Next.js 14 + JavaScript + Tailwind CSS + Firebase (Firestore, Auth) + Cloudinary + Vercel |
| 目標 | 取代 Blogger (polygonguitar.blogspot.com)，遷移 3000-4000 份舊譜 |
| 本地開發 | `npm run dev` → http://localhost:3000 |

---

## 設計規格

### Spotify 深色模式風格

| 元素 | 顏色代碼 | 用途 |
|------|----------|------|
| 背景 | `#000000` | 頁面底色 |
| 卡片背景 | `#121212` | 卡片、容器 |
| 強調色 | `#FFD700` | 和弦、Key、按鈕 |
| 主要文字 | `#FFFFFF` | 標題、歌名 |
| 次要文字 | `#B3B3B3` | 說明、輔助文字 |
| 底部導航 | `#FFD700` bg + black text | 手機版導航欄 |

### 樂譜格式

```
|C      G/B    |Am     F
(暗)如何(蠶)食了(光)
```

- 使用等寬字體 `Sarasa Mono TC`
- 和弦對齊歌詞括號 `( )`
- 支援 Slash Chord（如 G/B）

---

## 技術架構

### 頁面結構 (Pages Router)

```
pages/
├── index.js              # 首頁（四區結構）
├── login.js              # Google 登入
├── library.js            # 樂譜庫
├── search.js             # 搜尋頁
├── artists/
│   ├── index.js          # 歌手列表
│   ├── [id].js           # 歌手詳情頁
│   └── [id]/edit.js      # 編輯歌手
├── tabs/
│   ├── new.js            # 上傳樂譜
│   ├── [id].js           # 樂譜顯示
│   └── [id]/edit.js      # 編輯樂譜
├── playlist/[id].js      # Playlist 頁
└── admin/                # 後台管理
    ├── index.js
    ├── artists.js        # 歌手管理
    ├── migrate.js        # 舊譜修復工具
    ├── import-tabs.js    # Blogger 導入
    ├── playlists.js      # Playlist 管理
    ├── logo.js           # Logo 上傳
    └── ...
```

### 主要元件

| 元件 | 功能 |
|------|------|
| `Layout.js` | 整體佈局 + 底部導航 |
| `Navbar.js` | 頂部導航欄 |
| `TabContent.js` | 樂譜顯示 + 轉調 + 自動滾動 |
| `TabCard.js` | 樂譜卡片 |
| `ArtistSongsList.js` | 歌手歌曲列表 |
| `ArtistAutoFill.js` | 自動搜尋維基建立歌手 |
| `YouTubeSearchModal.js` | YouTube 搜尋選擇 |
| `LikeButton.js` | 讚好功能 |
| `TabTagsSelector.js` | 三層標籤系統 |
| `TabVersionComparison.js` | 版本比較 |

### Firestore 資料結構

```javascript
// artists 集合
{
  name: string,           // 歌手名
  slug: string,           // URL 用（如 "beyond"）
  gender: 'male'|'female'|'group'|'other',
  photoURL: string,       // Cloudinary 用戶上傳
  wikiPhotoURL: string,   // 維基百科備份
  bio: string,            // 簡介
  songCount: number,      // 歌曲數量
  viewCount: number,      // 瀏覽次數
  isActive: boolean,
  createdAt: timestamp
}

// songs 集合
{
  title: string,
  artistName: string,
  artistSlug: string,
  artistId: string,       // 關聯 artists
  originalKey: string,    // 原調（如 "C"）
  content: string,        // 樂譜內容
  youtubeUrl: string,
  thumbnail: string,      // YouTube 縮圖
  uploadYear: number,     // 年份（分組用）
  viewCount: number,
  arrangedBy: string,     // 編曲者（區分版本）
  uploaderId: string,
  uploaderPenName: string,// 上傳者筆名
  likes: number,
  createdAt: timestamp,
  source: 'migrated'|'manual'
}

// playlists 集合
{
  title: string,
  description: string,
  source: 'auto'|'manual',
  autoType: 'monthly'|'weekly'|'trending',
  manualType: 'artist'|'theme'|'series',
  songIds: array,
  coverImage: string,
  isActive: boolean,
  displayOrder: number
}

// songVersions 集合（同歌多版本）
{
  songId: string,
  arrangedBy: string,
  versionType: 'original'|'simplified'|'advanced'|'live',
  content: string,
  uploaderId: string,
  createdAt: timestamp
}
```

### 轉調計算邏輯

```javascript
// Capo 計算公式
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const capo = (originalIndex - targetIndex + 12) % 12;

// 顯示邏輯
// Capo 0: 顯示 "原調: C"
// Capo 4: 顯示 "Key: E (Capo 4) Play C"
// 警告: Capo >= 9 時顯示高位警告
```

---

## 已完成功能 ✅

1. **Firebase 後端**
   - Firestore 資料庫
   - Google Authentication
   - 安全規則設定

2. **歌手管理**
   - 上傳歌手相片（Cloudinary 匿名上傳）
   - 自動搜尋維基百科建立歌手檔案
   - 歌手頁面（Hero 16:9 + 熱門歌曲 + 年份分組）

3. **樂譜系統**
   - 上傳樂譜（含 YouTube thumbnail 自動提取）
   - 樂譜顯示（等寬字體 + 和弦對齊）
   - 轉調系統（Capo 計算 + 高位警告）
   - 自動滾動、字體調整、複製功能

4. **互動功能**
   - 讚好系統（❤️）
   - 瀏覽次數統計
   - 三層標籤系統（難度/手動標記/用戶投票）

5. **Playlist 系統**
   - 自動數據區（本月熱門、本週新增）
   - 手動精選區

6. **首頁結構**
   - 歌手分類區
   - 熱門歌手區
   - Playlist 區
   - 教學區

7. **後台管理工具**（2026-02-07 新增）
   - **遷移樂譜管理** `/admin/migrated-tabs` - 查看/編輯/修復 Blogger 遷移的樂譜
   - **歌手管理 V2** `/admin/artists-v2` - 統一管理歌手資料、分類、批量設置
   - **合併重複歌手** `/admin/merge-artists` - 自動檢測並合併中英文重複歌手
   - 維基百科搜尋整合 - 編輯樂譜時可直接搜尋歌手中文名
   - 多選批量操作 - 支援批量設置歌手分類

---

## 待修復/進行中 🔄

### 高優先級

1. **歌手頁面手機版優化**
   - Key 圓形徽章縮細至 `w-6 h-6`（24px），強制單行顯示 12 個 Key
   - 選中 Key 改為「黑底黃字白邊」`bg-black text-[#FFD700] ring-2 ring-white`
   - 排名數字「1」縮細至 `w-5`（20px）
   - 縮圖縮細至 `w-10 h-10`（40px）
   - 加返歌手簡介「ⓘ」按鈕（手機 Modal，電腦直接顯示）

2. **底部導航顏色修復**
   - 手機版變返黃底 `#FFD700`

3. **Logo 上傳功能**
   - 替換左上角 guitar icon

### 中優先級

4. **Blogger 遷移**（進行中 - 已完成 100 份）
   - Blog ID: `7655351322076661979`
   - API Key: 已設置於環境變數 `BLOGGER_API_KEY`
   - 總量：約 3000-4000 篇文章
   - **已完成：第 1-100 篇**（透過 `import-100-tabs.js`）
   - 自動創建對應歌手檔案，標記 `source: 'blogger'`

5. **YouTube 搜尋內嵌**
   - 上傳時顯示 3 個結果揀選

---

## 待開發功能 📋

| 優先級 | 功能 | 說明 |
|--------|------|------|
| P1 | 結他教室 | 教學影片分類：初學/前奏/彈唱 |
| P1 | Band房目錄 | 港九新界練團室 |
| P2 | 樂器舖優惠 | 廣告位 |
| P2 | 用戶筆名系統 | Pen Name 顯示 |
| P3 | 評分留言 | 1-5 星 + 留言 |
| P3 | 域名連結 | polygon.guitars 正式上線 |

---

## 重要設定

### Firebase
- 專案：`polygon-guitar-v2`
- 地區：`asia-east2` (香港)
- 服務：Firestore、Authentication (Google)、Storage

### Cloudinary
- Cloud Name：`drld2cjpo`
- Preset：`artist_photos` (Unsigned)
- 用途：歌手相片上傳

### 環境變數
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=drld2cjpo
YOUTUBE_API_KEY=
BLOGGER_API_KEY=
```

---

## 開發偏好

### 編碼風格
- 使用 JavaScript（非 TypeScript）
- Tailwind CSS 優先
- 手機版優先設計（Mobile First）
- 深色模式為預設

### 響應式斷點
```css
/* 手機 */
< 768px

/* 桌面 */
>= 768px (md:)
```

### 常用 Tailwind 組合
```css
/* 卡片 */
bg-[#121212] rounded-xl border border-gray-800

/* 按鈕 - 主要 */
bg-[#FFD700] text-black hover:bg-yellow-400

/* 按鈕 - 次要 */
bg-[#282828] text-white hover:bg-[#3E3E3E]

/* 文字 */
text-white / text-[#B3B3B3] / text-[#FFD700]
```

---

## Blogger 遷移詳情

### 遷移進度
- **已完成**：100 份（第 1-100 篇）
- **剩餘**：約 3000-3900 份
- **狀態**：分批進行中

### 相關檔案

| 檔案 | 用途 |
|------|------|
| `scripts/migrate-blogger.js` | 主要遷移腳本，支援分批遷移 (`--limit`, `--offset`) |
| `scripts/import-30-tabs.js` | 最初測試用，導入前 30 篇 |
| `scripts/import-100-tabs.js` | 導入第 31-130 篇（已執行） |
| `scripts/fix-migrated-tabs.js` | 修復已導入但缺少 artistId 的 tabs |
| `scripts/fix-all-artist-names.js` | 修復雙語歌手名 + 合併重複歌手（命令列工具） |
| `pages/admin/import-tabs.js` | 後台手動導入頁面（單首/CSV 批量） |
| `pages/admin/migrated-tabs.js` | **遷移樂譜管理後台**（查看/編輯/刪除/修復問題、維基搜尋） |
| `pages/admin/artists-v2.js` | **歌手管理 V2**（統一管理、多選批量設置分類） |
| `pages/admin/merge-artists.js` | **合併重複歌手**（自動檢測中英文重複、手動合併） |

### 標題解析邏輯
```javascript
// 支援格式：
// "歌手 - 歌名"
// "歌手 | 歌名"  
// "歌名 by 歌手"
// "歌手 歌名"（已知歌手列表匹配）
```

### 內容提取
- 原調：匹配 `原調: X` / `Key: X`
- Capo：匹配 `Capo: X` / `夾X`
- YouTube：提取 `youtube.com/watch?v=` 或 `youtu.be/`
- HTML 轉換：`<br>` → `\n`, `</p>` → `\n\n`

### 分批遷移命令
```bash
# 測試模式（只分析不寫入）
node scripts/migrate-blogger.js --limit=50

# 第一批：1-200
node scripts/migrate-blogger.js --write --limit=200 --offset=0

# 第二批：201-400
node scripts/migrate-blogger.js --write --limit=200 --offset=200

# 全部一次過（約需 5-10 分鐘）
node scripts/migrate-blogger.js --write --all
```

### 遷移數據結構
```javascript
{
  title: string,        // 歌名
  artist: string,       // 歌手名
  artistId: string,     // 自動生成
  content: string,      // 純文本樂譜
  originalKey: string,  // 提取的原調（默認 C）
  capo: number,         // 提取的 Capo（可為 null）
  youtubeUrl: string,   // 提取的 YouTube 連結
  source: 'blogger',    // 標記來源
  createdAt: Date,      // 原發布日期
  views: 0, likes: 0, viewCount: 0
}
```

### 過濾規則
- 自動跳過：鼓譜（`drum`、`鼓譜`）、教學文（`教學`）、木箱鼓
- 重複檢測：以 `title` + `artist` 為唯一鍵

---

## 用戶流程

```
用戶上傳樂譜
    ↓
輸入歌手名
    ↓
自動搜尋維基百科
    ↓
建立歌手檔案（待審核）
    ↓
管理員後台確認
    ↓
樂譜正式顯示
```

---

## 關鍵決定記錄

| 日期 | 決定 | 原因 |
|------|------|------|
| 初期 | 唔用 Logo（遲啟上傳 PNG）| 簡化初期開發 |
| 初期 | 擱置 Imgur，改用 Cloudinary | 更穩定嘅匿名上傳 |
| 初期 | 簡單 Parser | 用戶輸入格式唔統一 |
| 初期 | 深色模式優先 | Spotify 風格，護眼 |
| 2026-02-07 | 新增後台管理工具 | 遷移樂譜管理、歌手管理 V2、合併重複歌手 |
| 2026-02-07 | 修復歌手改名問題 | 查詢函數支援多種 ID 變體，解決改名後睇唔到歌嘅問題 |
| 2026-02 | 改用 Pages Router | 簡化 Firebase 整合 |

---

## 今日工作摘要 (2026-02-07)

### 新增功能
1. **創建 AGENTS.md** - 項目記憶檔案系統
2. **遷移樂譜管理後台** `/admin/migrated-tabs`
   - 查看所有遷移樂譜及其來源分佈
   - 編輯樂譜內容、歌手、調性
   - 維基百科搜尋整合
   - 自動修復問題功能
3. **歌手管理 V2** `/admin/artists-v2`
   - 統一顯示所有歌手（32個）
   - 多選批量設置分類（男/女/組合）
   - 編輯歌手資料、照片、Hero
4. **合併重複歌手** `/admin/merge-artists`
   - 自動檢測中英文重複歌手
   - 一鍵合併轉移樂譜
   - 手動選擇合併模式

### Bug 修復
1. **歌手分類顯示** - `unknown` 同空字符串歸入「其他」分類
2. **歌手改名後查詢** - `getTabsByArtist` 支援多種 ID 變體查詢
3. **雙語歌手名解析** - 支援「中文名 英文名」格式

### 已知限制
- 歌手改名後，舊樂譜的 `artistId` 不會自動更新（已透過查詢函數兼容處理）
- UNKNOWN 歌手需要手動修復

---

## 備註

- 每個歌手可有多張樂譜
- 同一首歌可有多個版本（以 `arrangedBy` 區分）
- 歌手相片先用 Cloudinary，後備維基百科
- 舊譜遷移時標記 `source: 'blogger'`

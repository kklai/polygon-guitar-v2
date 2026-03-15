# 快取架構 Cache Architecture

> 最後更新：2026-03-14

本文件說明 Polygon Guitar v2 的完整快取架構，包括搜尋資料、首頁資料、樂譜列表及歌手頁面的快取層級與失效機制。

---

## 快取層級總覽

請求依序經過以下四層快取，命中任何一層即返回，不再往下讀取：

```
客戶端 localStorage
       ↓ miss
Vercel CDN (s-maxage)
       ↓ miss
伺服器 in-memory (serverless 函數內變數)
       ↓ miss
Firestore cache 文件 (cache/*)
       ↓ miss
Firestore 原始集合 (tabs, artists, playlists...)
```

---

## 1. 搜尋資料 Search Data (`cache/searchData`)

搜尋頁、歌手列表應該在 1 分鐘內看到更新資料。在「1 分鐘內看到更新」已足夠的前提下，保留 30／45 秒快取可以減少 Firestore 讀取、加快回應，又不會影響使用體驗。

| 快取層 | 位置 | TTL |
|--------|------|-----|
| Firestore | `cache/searchData` 單一文件 | 永不過期（見下方「何時會更新」） |
| 伺服器 in-memory | `_apiResponseCache` 變數 | 45 秒 |
| Vercel CDN | HTTP header | 30 秒 fresh + 30 秒 stale |
| 客戶端 localStorage | `searchPageData` | 45 秒 |

Firestore 快取沒有時間過期（TTL）。內容只會在下列操作發生時被寫入或修補，不會因為「放太久」而自動失效。

| 類型 | 觸發時機 | 呼叫端 |
|------|----------|--------|
| **增量修補** | 新增樂譜 | 上傳樂譜頁 `tabs/new.js`、`tabs/new-tablature.js` 儲存成功後 |
| | 編輯樂譜 | 樂譜編輯頁 `tabs/[id]/edit.js` 儲存成功後 |
| | 刪除樂譜 | 樂譜頁 `tabs/[id].js` 或編輯頁 `tabs/[id]/edit.js` 刪除成功後 |
| | 編輯歌手（名稱/相片等） | 歌手編輯頁 `artists/[id]/edit.js` 或後台 `admin/artists-v2.js` 儲存成功後 |
| | 新增歌手 | （若日後有流程呼叫） |
| **全量重建** | 手動重建 | 後台「首頁設置」→「清除快取」→「重建搜尋快取」 |
| | 儲存歌手排序 | 後台「排序 / Tier」`admin/artists-sort.js` 儲存後 |
| | 儲存歌手地區 | 後台「地區設定」`admin/artists-region.js` 單筆或批量儲存後 |

---

## 2. 首頁資料 Home Data (`cache/homePage`)

供首頁使用，包含分類歌手、熱門歌手、熱門歌曲、歌單等區塊資料。

| 快取層 | 位置 | TTL |
|--------|------|-----|
| Firestore | `cache/homePage` 單一文件 | 永不過期（寫入時更新） |
| 伺服器 in-memory | `_homeApiCache` 變數 | 45 秒 |
| Vercel CDN | HTTP header | 30 秒 fresh + 30 秒 stale |
| 客戶端 localStorage | `pg_home_cache_v2` | 45s |

---

## 3. 失效流程 Invalidation Flows

### 新增/更新樂譜

```
用戶保存樂譜
  ↓
createTab() / updateTab() 寫入 Firestore
  ↓
POST /api/patch-caches-on-new-tab (action: create/update)
  ├── 修補 cache/searchData（新增或更新 tabs 陣列中的項目）
  ├── 修補 cache/homePage（新增或更新 tabs 陣列中的項目）
  └── 刪除 cache/artistPage_{artistId}（下次訪問重建）
```

### 新增/更新歌手

```
用戶保存歌手
  ↓
updateDoc(artists/{id}) 寫入 Firestore
  ↓
POST /api/patch-caches-on-new-tab (action: create-artist/update-artist)
  ├── 修補 cache/searchData（新增或更新 artists 陣列中的項目）
  └── 刪除 cache/artistPage_{id}（下次訪問重建）
```

---

## 4. 注意事項

- **Firestore 快取文件大小限制**：單一文件最大 1MB。`patch-caches-on-new-tab` 會在修補前檢查大小，超過限制時跳過修補（需手動全量重建）。
- **artistId 為唯一識別**：搜尋資料和首頁資料中的 tab 只存 `artistId`（Firestore 文件 ID），歌手名從 `artists` 陣列解析。歌手改名後只需更新 `artists` 陣列，無需更新每筆 tab。
- **CDN 快取**：即使 Firestore 快取已更新，CDN 仍可能在 `s-maxage` 期間返回舊資料。搜尋/首頁/歌手頁 API 均為 30s fresh + 30s stale（延遲 &lt; 1 分鐘）。
- **伺服器 in-memory 快取**：serverless 函數冷啟動後 in-memory 快取會清空。同一函數實例內，搜尋資料的 in-memory 快取為 45 秒。

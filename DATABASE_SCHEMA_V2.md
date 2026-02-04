# Polygon Guitar V2 - 資料庫結構更新

## 多版本支持 + 三層標籤系統

### tabs 集合更新

```javascript
{
  // 基本資料（原有）
  id: "tab_id",
  title: "海闊天空",
  artist: "Beyond",
  artistId: "beyond",
  content: "F          C...",
  originalKey: "F",
  
  // ═══════════════════════════════════════════════════
  // 第一層：自動分析（技術標籤）
  // ═══════════════════════════════════════════════════
  autoAnalysis: {
    level: "intermediate",        // beginner / intermediate / advanced
    levelName: "中級",            // 顯示用中文
    barreCount: 3,                // 橫按和弦數量
    chordCount: 8,                // 獨特和弦數量
    chordBreakdown: {             // 和弦分類統計
      easy: 3,                    // 簡單和弦（C, G, Am等）
      medium: 3,                  // 中等和弦（Bm, Fmaj7等）
      hard: 2                     // 困難和弦（F#m, Bbm等）
    },
    hasFingerstyle: false,        // 是否有指彈技巧
    lineCount: 45,                // 譜面行數
    autoTags: [                   // 自動生成標籤
      "無Barre和弦",
      "和弦豐富",
      "指彈技巧"
    ],
    estimatedTime: "3-7日"        // 預計掌握時間
  },
  
  // ═══════════════════════════════════════════════════
  // 第二層：手動標籤（上傳者選擇）
  // ═══════════════════════════════════════════════════
  manualTags: {
    style: ["original", "simple"],  // 風格：原汁原味/簡單版/進階版/指彈版/Busking版
    audience: ["beginner"],          // 對象：初學者/中級/高手
    mood: ["emotional", "rock"]      // 情緒：輕快/抒情/搖滾/浪漫
  },
  
  // ═══════════════════════════════════════════════════
  // 第三層：用戶投票（社群驗證）
  // ═══════════════════════════════════════════════════
  userVotes: {
    soundsLikeOriginal: 45,       // 覺得似原曲
    goodForBeginners: 128,        // 適合新手
    greatForBusking: 23,          // 適合Busking
    beautifulArrangement: 15,     // 編配靚
    totalVotes: 211               // 總投票數
  },
  
  // 用戶投票記錄（防止重複投票）
  votedUsers: {
    "user_id_1": "goodForBeginners",
    "user_id_2": "soundsLikeOriginal"
  },
  
  // ═══════════════════════════════════════════════════
  // 衍生標籤（系統每日計算更新）
  // ═══════════════════════════════════════════════════
  computedTags: [
    "🏆 熱門",                     // 瀏覽 > 1000
    "🎸 新手首選",                 // goodForBeginners > 20
    "🎵 最似原曲",                 // soundsLikeOriginal > 15
    "🔥 本週熱門",                 // 最近瀏覽激增
    "✨ 編配出色"                  // beautifulArrangement > 10
  ],
  
  // 推薦分數（系統計算，用於排序）
  recommendationScore: 85.5,
  
  // 管理員標記
  isEditorPick: true,             // 編輯推薦
  editorNote: "最推薦嘅版本",      // 編輯備註
  
  // 原有欄位
  viewCount: 1200,
  likes: 45,
  createdBy: "user_id",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### songVersions 集合（新增）

用於管理同一首歌嘅多個版本關係：

```javascript
{
  // 歌曲識別（歌名+歌手組合）
  songKey: "海闊天空_beyond",      // 用於查詢
  
  // 基本資料
  title: "海闊天空",
  artist: "Beyond",
  artistId: "beyond",
  
  // 所有版本
  versions: [
    {
      tabId: "tab_id_1",
      createdAt: Timestamp,
      creatorName: "用戶A"
    },
    {
      tabId: "tab_id_2", 
      createdAt: Timestamp,
      creatorName: "用戶B"
    }
  ],
  
  // 版本統計
  versionCount: 5,
  
  // 最佳版本推薦（系統計算）
  bestVersions: {
    forBeginners: "tab_id_1",      // 最適合新手
    mostPopular: "tab_id_2",        // 最熱門
    mostOriginal: "tab_id_3",       // 最似原曲
    easiest: "tab_id_1",            // 最簡單
    hardest: "tab_id_4"             // 最進階
  },
  
  // 最後更新
  lastUpdated: Timestamp
}
```

### users 集合更新

```javascript
{
  uid: "user_id",
  displayName: "用戶名",
  email: "user@example.com",
  
  // 新增：用戶技能水平（自評）
  skillLevel: "intermediate",      // beginner / intermediate / advanced
  
  // 新增：用戶偏好（用於推薦）
  preferences: {
    preferredDifficulty: ["beginner", "intermediate"],
    preferredStyles: ["original", "simple"],
    favoriteArtists: ["beyond", "eason_chan"]
  },
  
  // 新增：投票記錄
  votes: {
    "tab_id_1": "goodForBeginners",
    "tab_id_2": "soundsLikeOriginal"
  },
  
  // 原有欄位
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## 索引建議

```javascript
// tabs 集合索引
tabs: {
  // 原有索引
  artistId: 1,
  createdAt: -1,
  
  // 新增索引（用於篩選同排序）
  "autoAnalysis.level": 1,
  "manualTags.style": 1,
  "manualTags.audience": 1,
  "userVotes.goodForBeginners": -1,
  "userVotes.soundsLikeOriginal": -1,
  recommendationScore: -1,
  isEditorPick: 1,
  computedTags: 1
}

// songVersions 集合索引
songVersions: {
  songKey: 1,                      // 唯一索引
  artistId: 1,
  "versions.tabId": 1
}
```

## 實施計劃

### Phase 1: 自動分析（立即做）
1. 為所有現有譜面運行 `analyzeDifficulty()`
2. 更新 Firestore 中嘅 `autoAnalysis` 欄位
3. 更新搜尋同排序功能

### Phase 2: 手動標籤（本週做）
1. 更新上傳表單，加入 `TabTagsSelector` 組件
2. 更新 `tabs` collection 結構
3. 測試標籤顯示

### Phase 3: 多版本顯示（下週做）
1. 創建 `songVersions` collection
2. 更新歌手頁面，顯示多版本
3. 實現版本比較功能

### Phase 4: 用戶投票（之後做）
1. 實現投票 API
2. 加入 `TabUserVotes` 組件
3. 實現每日標籤計算腳本
4. 加入推薦系統

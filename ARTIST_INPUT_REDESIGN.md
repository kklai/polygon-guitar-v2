# 歌手輸入系統重設計方案

## 問題分析

現有系統用「,」或「/」分隔多歌手，導致：
1. 自動 suggest 無法識別分隔後的歌手名
2. 用戶輸入體驗差（不清楚格式）
3. 無法明確定義歌手關係（合唱 vs Featuring）

## 新設計概念

### 核心原則
- **每個歌手獨立輸入欄位**，各自有完整自動 suggest
- **用「添加」機制**取代「分隔符」機制
- **明確定義歌手關係**：主唱、合唱、Featuring

---

## 資料結構更新

### Firestore songs collection

```javascript
{
  id: "song-123",
  title: "報復式浪漫",
  
  // 主要歌手（必填，單一）
  artist: "馮允謙",
  artistId: "jay-fung",
  artistSlug: "jay-fung",
  
  // 合作歌手陣列（可選，多個）
  collaborators: [
    {
      artistId: "on-chan",
      artistName: "陳健安",
      relation: "chorus",      // 'chorus' | 'featuring' | 'with'
      order: 1                 // 顯示順序
    },
    {
      artistId: "gareth-t",
      artistName: "Gareth.T",
      relation: "featuring",
      order: 2
    }
  ],
  
  // 顯示用完整歌手名（自動生成）
  displayArtists: "馮允謙 / 陳健安 / Gareth.T",
  
  // 現有欄位...
  chordLyrics: "...",
  capo: 0,
  key: "C"
}
```

### 關係類型定義

| 關係 | 顯示方式 | 例子 |
|------|----------|------|
| `primary` | 主要歌手（無前綴）| 陳奕迅 |
| `chorus` | 合唱 | 陳奕迅 / 楊千嬅 |
| `featuring` | Featuring | 陳奕迅 feat. Gareth.T |
| `with` | With | 陳奕迅 with 楊千嬅 |

---

## React 組件架構

```
components/
├── ArtistInput/
│   ├── ArtistInputManager.jsx      # 主控組件，管理多個歌手欄位
│   ├── SingleArtistInput.jsx       # 單個歌手輸入欄位（含 suggest）
│   ├── ArtistSuggestDropdown.jsx   # 自動 suggest 下拉選單
│   ├── CollaboratorList.jsx        # 已添加合作歌手列表
│   └── RelationSelector.jsx        # 關係類型選擇器
└── hooks/
    ├── useArtistSearch.js          # 歌手搜尋 hook
    └── useCollaborators.js         # 合作歌手管理 hook
```

---

## 組件詳細設計

### 1. ArtistInputManager（主控組件）

```javascript
interface ArtistInputManagerProps {
  primaryArtist: {
    id: string;
    name: string;
    photoURL?: string;
  };
  collaborators: Collaborator[];
  onPrimaryChange: (artist: Artist) => void;
  onCollaboratorsChange: (collaborators: Collaborator[]) => void;
}

// 使用示例
<ArtistInputManager
  primaryArtist={{ id: 'jay-fung', name: '馮允謙' }}
  collaborators={[
    { artistId: 'on-chan', artistName: '陳健安', relation: 'chorus', order: 1 }
  ]}
  onPrimaryChange={(artist) => setPrimaryArtist(artist)}
  onCollaboratorsChange={(list) => setCollaborators(list)}
/>
```

**UI 結構：**
```
┌─────────────────────────────────────┐
│ 主要歌手                            │
│ ┌───────────────────────────────┐   │
│ │ [歌手名輸入...]  [🔍 suggest]   │   │
│ └───────────────────────────────┘   │
│                                     │
│ 合作歌手                            │
│ ┌───────────────────────────────┐   │
│ │ 1. 陳健安 [合唱] [🗑️]         │   │
│ │ 2. [輸入新歌手...] [+ 添加]     │   │
│ └───────────────────────────────┘   │
│                                     │
│ [+ 添加合作歌手]                    │
└─────────────────────────────────────┘
```

### 2. SingleArtistInput（單個歌手輸入）

```javascript
interface SingleArtistInputProps {
  value: string;
  onChange: (value: string, artistData?: Artist) => void;
  onSelect: (artist: Artist) => void;
  placeholder?: string;
  autoFocus?: boolean;
  existingArtists: string[]; // 已選擇的歌手 ID，用於過濾
}

// Artist 對象
interface Artist {
  id: string;
  name: string;
  photoURL?: string;
  artistType?: 'male' | 'female' | 'group';
}
```

**功能：**
- 輸入時即時搜尋 Firestore artists collection
- 顯示下拉選單：歌手名 + 類型標籤 + 縮圖
- 支援新建歌手（如果搜尋無結果）
- 鍵盤導航（↑↓選擇，Enter確認，Esc關閉）

### 3. ArtistSuggestDropdown（自動 suggest）

```javascript
interface ArtistSuggestDropdownProps {
  query: string;
  onSelect: (artist: Artist) => void;
  onCreateNew?: (name: string) => void;
  excludeIds: string[]; // 排除已選擇的歌手
  maxResults?: number;
}
```

**搜尋邏輯：**
```javascript
async function searchArtists(query) {
  // 1. 精確匹配（ID）
  const exactId = query.toLowerCase().replace(/\s+/g, '-')
  const exactMatch = await getDoc(doc(db, 'artists', exactId))
  
  // 2. 名稱前綴匹配
  const prefixQuery = query(
    collection(db, 'artists'),
    where('name', '>=', query),
    where('name', '<=', query + '\uf8ff'),
    limit(5)
  )
  
  // 3. 正則匹配（本地過濾）
  const regexMatch = allArtists.filter(a => 
    a.name.toLowerCase().includes(query.toLowerCase())
  )
  
  // 合併結果，去重
  return [...exactMatch, ...prefixResults, ...regexMatch]
    .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
    .slice(0, 5)
}
```

### 4. CollaboratorList（合作歌手列表）

```javascript
interface CollaboratorListProps {
  collaborators: Collaborator[];
  onReorder: (newOrder: Collaborator[]) => void; // 拖曳排序
  onRelationChange: (index: number, relation: RelationType) => void;
  onRemove: (index: number) => void;
}

type RelationType = 'chorus' | 'featuring' | 'with';

const RELATION_OPTIONS = [
  { value: 'chorus', label: '合唱', display: '/' },
  { value: 'featuring', label: 'Featuring', display: 'feat.' },
  { value: 'with', label: 'With', display: 'with' }
];
```

---

## 用戶流程

### 流程 1：單一歌手
```
1. 用戶在「主要歌手」欄位輸入
2. 系統顯示 suggest 下拉選單
3. 用戶選擇現有歌手或創建新歌手
4. 完成
```

### 流程 2：添加合作歌手
```
1. 用戶點擊「+ 添加合作歌手」
2. 彈出新輸入欄位（專注狀態）
3. 用戶輸入歌手名，系統顯示 suggest
4. 用戶選擇歌手
5. 系統自動設置默認關係（合唱）
6. 用戶可修改關係類型
7. 點擊「確認」添加
```

### 流程 3：修改關係類型
```
1. 用戶點擊現有合作歌手的關係標籤
2. 彈出選擇器（合唱 / Featuring / With）
3. 用戶選擇新關係
4. 實時更新顯示
```

### 流程 4：刪除合作歌手
```
1. 用戶點擊合作歌手旁的 🗑️ 按鈕
2. 確認刪除（可選）
3. 從列表移除
```

---

## Firestore Rules 更新

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 歌手資料規則
    match /artists/{artistId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
        (resource.data.createdBy == request.auth.uid || 
         exists(/databases/$(database)/documents/users/$(request.auth.uid)));
    }
    
    // 歌曲規則
    match /songs/{songId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
        (resource.data.uploaderId == request.auth.uid ||
         request.auth.token.admin == true);
      allow delete: if request.auth != null && 
        (resource.data.uploaderId == request.auth.uid ||
         request.auth.token.admin == true);
    }
  }
}
```

---

## API 函數

```javascript
// lib/artistInput.js

/**
 * 搜尋歌手（用於 suggest）
 */
export async function searchArtistsForSuggest(query, excludeIds = [], limit = 5) {
  if (!query || query.length < 1) return []
  
  const results = []
  const seenIds = new Set(excludeIds)
  
  // 1. ID 精確匹配
  try {
    const exactId = query.toLowerCase().replace(/\s+/g, '-')
    if (!seenIds.has(exactId)) {
      const doc = await getDoc(doc(db, 'artists', exactId))
      if (doc.exists()) {
        results.push({ id: doc.id, ...doc.data() })
        seenIds.add(exactId)
      }
    }
  } catch (e) {}
  
  // 2. 名稱前綴搜尋
  try {
    const q = query(
      collection(db, 'artists'),
      where('name', '>=', query),
      where('name', '<=', query + '\uf8ff'),
      limit(limit * 2)
    )
    const snap = await getDocs(q)
    snap.docs.forEach(d => {
      if (!seenIds.has(d.id) && results.length < limit) {
        results.push({ id: d.id, ...d.data() })
        seenIds.add(d.id)
      }
    })
  } catch (e) {}
  
  return results
}

/**
 * 創建新歌手（當搜尋無結果時）
 */
export async function createNewArtist(name, userId) {
  const id = name.toLowerCase().replace(/\s+/g, '-')
  
  const artistData = {
    name,
    normalizedName: name.toLowerCase(),
    slug: id,
    createdAt: new Date().toISOString(),
    createdBy: userId,
    isActive: true,
    tabCount: 0
  }
  
  await setDoc(doc(db, 'artists', id), artistData)
  return { id, ...artistData }
}

/**
 * 生成顯示用歌手名
 */
export function generateDisplayArtists(primaryArtist, collaborators) {
  if (!collaborators || collaborators.length === 0) {
    return primaryArtist.name
  }
  
  const parts = [primaryArtist.name]
  
  collaborators
    .sort((a, b) => a.order - b.order)
    .forEach(c => {
      const separator = c.relation === 'featuring' ? ' feat. ' :
                       c.relation === 'with' ? ' with ' : ' / '
      parts.push(separator + c.artistName)
    })
  
  return parts.join('')
}
```

---

## 現有頁面修改

### 1. pages/tabs/new.js（上傳頁面）

替換現有歌手輸入欄位：

```javascript
// 舊代碼
<input 
  value={artistName}
  onChange={(e) => setArtistName(e.target.value)}
/>

// 新代碼
<ArtistInputManager
  primaryArtist={primaryArtist}
  collaborators={collaborators}
  onPrimaryChange={setPrimaryArtist}
  onCollaboratorsChange={setCollaborators}
/>
```

### 2. pages/tabs/[id]/edit.js（編輯頁面）

相同修改，但需要載入現有合作歌手：

```javascript
useEffect(() => {
  if (tab) {
    setPrimaryArtist({
      id: tab.artistId,
      name: tab.artist,
      photoURL: tab.artistPhotoURL
    })
    setCollaborators(tab.collaborators || [])
  }
}, [tab])
```

---

## 優化建議

### 性能優化
1. **Debounce 搜尋**：輸入後 200ms 才發送請求
2. **本地緩存**：已載入的歌手資料緩存在 Context
3. **虛擬列表**：如果歌手數量極大，使用虛擬列表

### UX 優化
1. **快捷鍵**：Tab 切換到下一個欄位，Shift+Tab 上一個
2. **自動完成**：輸入部分名稱後按 Enter 自動選擇第一個建議
3. **視覺反饋**：選擇歌手後顯示縮圖和類型標籤
4. **拖曳排序**：合作歌手列表支援拖曳改變順序

### 錯誤處理
1. **網絡錯誤**：搜尋失敗時顯示「離線模式，只可選擇已緩存歌手」
2. **重名處理**：如果有多個同名歌手，顯示額外資訊（如出道年份）區分
3. **無結果**：提供「創建新歌手」選項

---

## 實現順序

### Week 1: 基礎組件
- [ ] `useArtistSearch` hook
- [ ] `ArtistSuggestDropdown` 組件
- [ ] `SingleArtistInput` 組件

### Week 2: 整合組件
- [ ] `CollaboratorList` 組件
- [ ] `ArtistInputManager` 組件
- [ ] `RelationSelector` 組件

### Week 3: 整合到頁面
- [ ] 更新 `pages/tabs/new.js`
- [ ] 更新 `pages/tabs/[id]/edit.js`
- [ ] 更新 Firestore rules

### Week 4: 優化與測試
- [ ] 性能優化
- [ ] UX 測試
- [ ] Bug 修復

---

需要我開始實現哪個部分？建議先從 `useArtistSearch` hook 和 `ArtistSuggestDropdown` 開始。
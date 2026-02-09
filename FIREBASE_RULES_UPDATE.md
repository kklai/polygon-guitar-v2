# Firebase Rules 更新指南

## ⚠️ 重要：需要手動更新 Firebase Console

由於 Firestore Rules 必須通過 Firebase Console 或 CLI 部署，請在 Vercel 部署完成後，手動更新以下規則：

### 更新後的完整 Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 用戶資料
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // 樂譜 (tabs) 集合
    match /tabs/{tabId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && (
        request.auth.uid == resource.data.uploaderId || 
        request.auth.token.admin == true
      );
    }
    
    // 歌手 (artists) 集合
    match /artists/{artistId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null;
    }
    
    // 留言 (comments) 集合
    match /comments/{commentId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && (
        request.auth.uid == resource.data.userId ||
        request.auth.token.admin == true
      );
    }
    
    // 歌單 (playlists) 集合
    match /playlists/{playlistId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null;
    }
    
    // 設定 (settings) 集合 - 用於儲存 Logo 等網站設定
    match /settings/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // 譜求 (tabRequests) 集合
    match /tabRequests/{requestId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && (
        request.auth.uid == resource.data.userId ||
        request.auth.token.admin == true
      );
    }
    
    // 歌單項目 (playlistItems) 集合
    match /playlistItems/{itemId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null;
    }
  }
}
```

### 更新步驟

1. 登入 [Firebase Console](https://console.firebase.google.com/)
2. 選擇項目 `polygon-guitar-v2`
3. 進入 **Firestore Database** → **Rules**
4. 貼上以上規則
5. 點擊 **發布** (Publish)

### 更新的集合

| 集合 | 用途 |
|------|------|
| `settings` | 網站設定（Logo、網站名稱等） |
| `playlists` | 歌單資料 |
| `comments` | 樂譜留言 |
| `tabRequests` | 求譜請求 |
| `playlistItems` | 歌單項目 |

### 注意事項

- 所有集合都允許公開讀取 (`allow read: if true`)
- 寫入操作需要用戶登入 (`request.auth != null`)
- 管理員可以修改所有資料 (`request.auth.token.admin == true`)

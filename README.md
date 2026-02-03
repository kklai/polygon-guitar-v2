# Polygon Guitar v2

一個用 Next.js + Firebase 建立嘅結他譜分享平台。

## 功能

- 🔐 Facebook + Google 登入（Firebase Auth）
- 📝 簡單編輯器上傳譜（歌名、歌手、譜內容 textarea）
- 📋 首頁顯示所有譜列表（歌名、歌手）
- 👀 點擊入去睇譜詳情（文字顯示，保留換行格式）
- 🎤 按歌手自動分類（新歌手自動建立分類）
- ✏️ 上傳者可編輯自己嘅譜
- 👍 簡單讚好功能
- 📱 手機都睇到（Responsive）

## 技術棧

- **Frontend**: Next.js 14 + React 18 + Tailwind CSS
- **Backend**: Firebase (Authentication + Firestore)
- **Deployment**: 可部署到 Vercel / Firebase Hosting

## 安裝

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定 Firebase

1. 去 [Firebase Console](https://console.firebase.google.com/) 建立新項目
2. 啟用 **Authentication**:
   - 啟用 Google 登入提供者
   - 啟用 Facebook 登入提供者（需要 Facebook App ID 和 Secret）
3. 建立 **Firestore Database**:
   - 選擇原生模式
   - 選擇最接近你用戶嘅地區

### 3. 設定環境變數

複製 `.env.local.example` 為 `.env.local`，並填入你嘅 Firebase 設定：

```bash
cp .env.local.example .env.local
```

去 Firebase Console → 項目設定 → 一般 → 你的應用程式 → SDK 設定和配置，複製配置到 `.env.local`：

```
NEXT_PUBLIC_FIREBASE_API_KEY=你的_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=你的_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=你的_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=你的_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=你的_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=你的_app_id
```

### 4. 設定 Firestore Security Rules

去 Firebase Console → Firestore Database → 規則，貼上以下規則：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 所有人可以讀取 tabs 和 artists
    match /tabs/{tabId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.createdBy;
    }
    
    match /artists/{artistId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // 用戶資料 - 所有人可讀，只有自己可寫自己嘅資料
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 5. 設定 Facebook Login（可選）

如果你要用 Facebook 登入：

1. 去 [Facebook Developers](https://developers.facebook.com/) 建立 App
2. 加入 Facebook Login 產品
3. 複製 App ID 和 App Secret 到 Firebase Authentication → Facebook 提供者設定
4. 在 Facebook Login 設定加入你的網址到「有效的 OAuth 重新導向 URI」：
   - `https://你的_project_id.firebaseapp.com/__/auth/handler`

## 開發

```bash
npm run dev
```

開啟 http://localhost:3000

## 部署到 Vercel

```bash
npm install -g vercel
vercel
```

記得在 Vercel Dashboard 設定環境變數。

## 部署到 Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## 資料結構

### tabs 集合

```javascript
{
  title: "海闊天空",
  artist: "Beyond",
  artistId: "beyond",
  content: "e|----------------|...",
  createdBy: "user_uid",
  createdAt: "2024-01-15T10:00:00Z",
  updatedAt: "2024-01-15T10:00:00Z",
  likes: 10,
  likedBy: ["user_uid_1", "user_uid_2"]
}
```

### artists 集合

```javascript
{
  name: "Beyond",
  normalizedName: "beyond",
  tabCount: 5,
  createdAt: "2024-01-15T10:00:00Z"
}
```

### users 集合

```javascript
{
  uid: "user_uid",
  displayName: "用戶名稱",
  email: "user@example.com",
  photoURL: "https://...",
  provider: "google.com",
  createdAt: "2024-01-15T10:00:00Z",
  updatedAt: "2024-01-15T10:00:00Z"
}
```

## 貢獻

歡迎 Fork 和 Pull Request！

## 授權

MIT License

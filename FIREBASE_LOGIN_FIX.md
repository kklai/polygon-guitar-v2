# Firebase 登入問題修復指南

## 問題：本地 localhost 可以登入，部署到 vercel.app 後顯示「Google 登入失敗」

## 修復步驟

### 1. 檢查 Firebase Console 授權網域

前往 [Firebase Console](https://console.firebase.google.com/) → Authentication → Settings → Authorized domains

確保已添加以下網域：
```
localhost
polygon-guitar-v2.vercel.app
*.vercel.app  (如果適用)
```

### 2. 檢查 Vercel 環境變量

在 Vercel Dashboard → Project Settings → Environment Variables 確保以下變量已設置：

```
NEXT_PUBLIC_FIREBASE_API_KEY=你的_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=你的_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=你的_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=你的_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=你的_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=你的_app_id
```

**重要**：環境變量名稱必須以 `NEXT_PUBLIC_` 開頭，否則客戶端無法訪問。

### 3. 重新部署

在 Vercel 重新部署項目以應用新的環境變量。

### 4. 清除瀏覽器快取

用戶端需要：
1. 清除瀏覽器快取和 cookies
2. 或使用無痕模式測試

### 5. 檢查瀏覽器控制台錯誤

打開瀏覽器開發者工具，檢查 Console 是否有以下錯誤：
- `auth/unauthorized-domain` - 表示網域未授權
- `auth/api-key-not-valid` - 表示 API key 無效

### 6. 確保 Firebase 項目啟用 Google 登入

Firebase Console → Authentication → Sign-in method → Google → 啟用

### 7. 檢查 OAuth 重定向 URI

如果使用 Facebook 登入，確保在 Facebook Developers Console 添加了正確的重定向 URI：
```
https://你的_project_id.firebaseapp.com/__/auth/handler
```

## 當前配置檢查

請確認 `.env.local` 文件包含以下內容：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=polygon-guitar.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=polygon-guitar
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=polygon-guitar.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

## 緊急修復方案

如果問題仍然存在，可以暫時使用匿名登入或郵箱登入作為替代方案。

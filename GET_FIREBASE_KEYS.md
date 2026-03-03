# 如何獲取 Firebase 環境變數

## 🔑 找你的真實 API Keys

### 步驟：

1. **前往 Firebase Console**
   - https://console.firebase.google.com

2. **選擇項目**
   - 點擊 `polygon-guitar-v2`

3. **進入專案設定**
   - 點擊左上角的 ⚙️ **Project settings**
   - （在 Project Overview 旁邊）

4. **查看專案設定**
   - 你會看到 **Your apps** 部分
   - 有一個網頁應用程式（Firestore Database 圖標）
   - 點擊 **Firestore Database** 或網站應用

5. **複製設定**
   - 你會看到類似這樣的代碼：

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...這個就是",
  authDomain: "polygon-guitar-v2.firebaseapp.com",
  projectId: "polygon-guitar-v2",
  storageBucket: "polygon-guitar-v2.appspot.com",
  messagingSenderId: "123456789",  // 這個是
  appId: "1:123456789:web:abcdef"  // 這個是
};
```

---

## 📋 對照表

| 環境變數 | Firebase 中的名稱 | 示例 |
|---------|-----------------|------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` | `AIzaSyB...` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` | `polygon-guitar-v2.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` | `polygon-guitar-v2` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` | `polygon-guitar-v2.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` | `123456789012` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` | `1:123456789012:web:abc123def456` |

---

## 📝 給同事的完整 .env.local

把你從 Firebase Console 複製的值填入：

```bash
# Firebase 設定
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyB...（貼上你的 apiKey）
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=polygon-guitar-v2.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=polygon-guitar-v2
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=polygon-guitar-v2.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012（貼上你的 messagingSenderId）
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123（貼上你的 appId）

# YouTube API
YOUTUBE_API_KEY=（可選，沒有也能運行）

# Spotify API（已經公開，可以直接用）
SPOTIFY_CLIENT_ID=9b91df6e49184814a7c6cc6ae3bbaa4c
SPOTIFY_CLIENT_SECRET=b79930d64d274193959a8218e7064ddf

# Cloudinary（已經公開）
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=drld2cjpo
```

---

## ⚠️ 重要提醒

1. **不要將 .env.local 上傳到 GitHub！**
   - 檔案已在 .gitignore 中
   - 只通過私人方式分享給同事

2. **這些 Key 是公開的（Next.js 前綴）**
   - `NEXT_PUBLIC_` 表示前端會看到
   - 已經設置了 Firebase 安全規則限制域名

---

## 🆘 找不到？

如果在 Firebase Console 找不到：

1. 確認選對了項目（polygon-guitar-v2）
2. 確認在 Project settings → General 分頁
3. 向下捲動到 "Your apps" 部分

---

*最後更新：2026-03-03*

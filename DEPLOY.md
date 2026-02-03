# Polygon Guitar 部署指南

## 🚀 快速部署到 Vercel

### 方法一：命令行部署（最簡單）

```bash
# 1. 安裝 Vercel CLI
npm i -g vercel

# 2. 登入（會彈出瀏覽器）
vercel login

# 3. 部署（在項目目錄執行）
vercel
```

跟住指示：
- Set up and deploy? **Y**
- Link to existing project? **N**（第一次）
- Project name: **polygon-guitar-v2**（或你想要的名）
- Directory: **./**（直接 Enter）

完成後會俾你一個網址，例如 `https://polygon-guitar-v2.vercel.app`

### 方法二：GitHub + Vercel（推薦長期使用）

1. **Push 上 GitHub**
```bash
# 如果未 init
git init
git add .
git commit -m "Initial commit"

# 創建 GitHub repo 後
git remote add origin https://github.com/你的用戶名/polygon-guitar-v2.git
git push -u origin main
```

2. **Connect Vercel**
- 去 https://vercel.com
- Import Git Repository
- 選擇你的 GitHub repo
- Framework Preset 選 **Next.js**
- Deploy！

---

## 🔐 密碼保護設定

預設密碼係：`polygon2024`

想改密碼，編輯 `middleware.js`：
```javascript
const ACCESS_PASSWORD = '你想嘅密碼'
```

俾朋友睇嗰陣，send 呢個 link：
```
https://你的網址.com/?password=polygon2024
```

或者叫佢哋喺登入頁輸入密碼。

---

## 🔥 部署到 Firebase Hosting（如果你想用 Firebase）

```bash
# 1. 安裝 Firebase CLI
npm i -g firebase-tools

# 2. 登入
firebase login

# 3. 初始化（選 Hosting）
firebase init hosting

# 4. 建立生產版本
npm run build

# 5. 部署
firebase deploy
```

---

## 📋 部署前檢查清單

- [ ] `.env.local` 已設定 Firebase 設定
- [ ] Firebase Firestore 已開啟
- [ ] Firebase Authentication 已開啟（Google 登入）
- [ ] Cloudinary 上傳 preset 已設定

---

## 🌐 連接你的域名 polygon.guitars

### Vercel 設定

1. 去 Vercel Dashboard → 你的項目 → Settings → Domains
2. Add Domain：`polygon.guitars`
3. 跟指示設定 DNS（去你買域名嘅地方加一筆 CNAME）

### 預設暫時網址

Vercel 會俾你一個免費網址：
- `https://polygon-guitar-v2.vercel.app`

你可以先用呢個俾朋友睇，之後再連接 polygon.guitars。

---

## ❌ 移除密碼保護（正式公開時）

想公開網站，刪除或改名 `middleware.js`：

```bash
mv middleware.js middleware.js.bak
```

然後重新部署：
```bash
vercel --prod
```

---

## 🆘 常見問題

### Q: 部署後 Firebase 唔 work？
A: 檢查 `.env.local` 嘅設定是否正確，Vercel 要手動加 Environment Variables

### Q: 點加 Environment Variables 去 Vercel？
A: 
1. Vercel Dashboard → 項目 → Settings → Environment Variables
2. 或者命令行：`vercel env add`

### Q: 點更新已部署的網站？
A: 
```bash
vercel --prod
```

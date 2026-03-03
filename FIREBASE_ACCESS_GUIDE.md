# Firebase 控制台登入指南

## 🔐 Firebase Console 登入方式

Firebase 控制台網址：https://console.firebase.google.com

---

## 方法一：Google 帳號直接登入（推薦）

### 步驟：
1. 前往 https://console.firebase.google.com
2. 點擊 **Sign in with Google**
3. 用你的 Google 帳號登入（例如你的 Gmail）

### 添加同事訪問權限：

#### 1. 進入 Firebase Console
- 登入 https://console.firebase.google.com
- 選擇項目 `polygon-guitar-v2`

#### 2. 添加成員
```
Project Overview (齒輪圖標) → Project settings → Users and permissions → Add member
```

#### 3. 輸入同事資料
- **Email**: 同事的 Google 帳號（必須是 Gmail 或 Google Workspace）
- **Role**: 選擇權限級別

---

## 👥 權限級別說明

| 角色 | 可以做什麼 | 適合誰 |
|------|----------|--------|
| **Viewer** | 查看數據、讀取資料庫 | 只需要看數據的人 |
| **Editor** | 修改資料、部署、改設定 | 開發者（推薦） |
| **Owner** | 完全控制、可以刪除項目 | 只有你自己 |

**推薦給同事：Editor**

---

## 🔑 具體操作步驟

### 1. 進入 Project Settings
![步驟1] 點左側齒輪圖標 → Project settings

### 2. 管理用戶
![步驟2] 點 "Users and permissions" 分頁

### 3. 添加成員
![步驟3] 點 "Add member" 按鈕

### 4. 填寫資料
```
Email: 同事@gmail.com
Role: Editor
```

### 5. 發送邀請
同事會收到 Email，點擊接受即可

---

## 📁 項目結構說明

同事登入後會看到：

```
polygon-guitar-v2 (項目名稱)
├── Project Overview (概覽)
├── Build (開發功能)
│   ├── Authentication (用戶登入) ← 查看誰登入了
│   ├── Firestore Database (數據庫) ← 查看結他譜數據
│   ├── Storage (檔案存儲)
│   └── Hosting (網站托管)
├── Release & Monitor (監控)
│   └── Analytics (用量統計)
└── Project Settings (設定)
```

---

## 💡 常用功能

### 查看數據庫（Firestore）
```
Firestore Database → Data
```
可以看到 collections:
- `tabs` - 所有結他譜
- `artists` - 歌手資料
- `users` - 用戶資料
- `pageViews` - 瀏覽統計

### 查看登入用戶（Authentication）
```
Authentication → Users
```
可以看到所有用 Google 登入的用戶

### 查看用量（Analytics）
```
Analytics → Dashboard
```
可以看到每日 API 調用次數、流量等

---

## ⚠️ 重要提醒

### 給同事的注意事項：

1. **不要隨便刪除資料**
   - 刪除 Firestore 文件是永久的
   - 不確定可以先問你

2. **不要修改 Security Rules**
   - 除非非常清楚在做什麼
   - 改錯可能導致網站無法運作

3. **不要公開 API Keys**
   - 雖然已經限制域名，但仍要小心

---

## 🆘 常見問題

**Q: 同事沒有 Google 帳號怎麼辦？**
A: 必須創建一個 Gmail，Firebase 只支援 Google 帳號

**Q: 添加後同事收不到邀請郵件？**
A: 檢查垃圾郵件箱，或直接在 Firebase 複製邀請連結發給他

**Q: 如何移除同事權限？**
A: 在同一個 Users and permissions 頁面，點垃圾桶圖標移除

**Q: 同事可以看到 Firebase 費用嗎？**
A: 只有 Owner 可以看到付款資訊，Editor 看不到

---

## 📞 支援

Firebase 官方文件：https://firebase.google.com/docs

如果遇到問題：
1. 檢查是否選對了項目（polygon-guitar-v2）
2. 確認帳號有 Editor 權限
3. 清除瀏覽器緩存重試

---

*最後更新：2026-03-03*

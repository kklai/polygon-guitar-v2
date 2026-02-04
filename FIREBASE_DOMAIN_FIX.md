# Firebase OAuth 域名授權修復

## 錯誤信息
```
The current domain is not authorized for OAuth operations.
```

## 解決步驟

### 1. 前往 Firebase Console
訪問：https://console.firebase.google.com/

### 2. 選擇你的項目
選擇 `polygon-guitar` 項目

### 3. 進入 Authentication 設置
1. 左側選單點擊 **Authentication**
2. 點擊上方 **Settings** 標籤
3. 點擊 **Authorized domains** 子標籤

### 4. 添加授權域名
點擊 **Add domain**，輸入：
```
polygon-guitar-v2.vercel.app
```

### 5. 確認現有域名
確保以下域名已在列表中：
- `localhost` （本地開發）
- `polygon-guitar.firebaseapp.com` （Firebase 預設）
- `polygon-guitar-v2.vercel.app` （Vercel 部署）

### 6. 等待生效
保存後等待 5-10 分鐘讓設置生效。

---

## 快速檢查清單

- [ ] Firebase 項目：polygon-guitar
- [ ] Authentication -> Settings -> Authorized domains
- [ ] 已添加：polygon-guitar-v2.vercel.app
- [ ] 已保存並等待生效

---

## 備用方案（如果仍然無法登入）

如果添加域名後仍然無法登入，可以暫時使用匿名登入或郵箱密碼登入作為替代方案。

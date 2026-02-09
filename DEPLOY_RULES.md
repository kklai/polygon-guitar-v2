# Firebase Rules 自動部署指南

## 首次設置（只需要做一次）

### 1. 安裝 Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. 登入 Firebase

```bash
firebase login
```

會打開瀏覽器讓你登入 Google 帳號。

### 3. 驗證項目連結

```bash
firebase projects:list
```

應該看到 `polygon-guitar-v2` 項目。

---

## 部署 Rules（每次更新後）

### 簡單命令

```bash
firebase deploy --only firestore:rules
```

### 或者使用 npm script

```bash
npm run deploy:rules
```

---

## 文件說明

| 文件 | 用途 |
|------|------|
| `firestore.rules` | Firestore 安全規則（主要文件）|
| `firebase.json` | Firebase 項目配置 |
| `.firebaserc` | 項目 ID 配置 |
| `firestore.indexes.json` | 索引配置（暫時空置）|

---

## 修改 Rules 流程

1. 編輯 `firestore.rules` 文件
2. 本地測試（可選）：`firebase emulators:start`
3. 部署：`firebase deploy --only firestore:rules`
4. 完成！

---

## 驗證部署

部署後可以到 Firebase Console 查看：
https://console.firebase.google.com/project/polygon-guitar-v2/firestore/rules

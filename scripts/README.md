# Firebase Service Account 設置

---

## 出譜者名稱 Backfill（uploaderPenName）

將舊譜嘅 `arrangedBy` 抄入 `uploaderPenName`，令全站出譜者名稱統一。

**前置**：已設好 Firebase Service Account（見下面步驟 1–3）。

```bash
# 1. 先 dry-run 睇有幾多份會更新（唔會寫入）
node scripts/backfill-uploader-pen-name.js --dry-run

# 2. 正式執行（全部）
node scripts/backfill-uploader-pen-name.js

# 或分批（例如每次 500 份）
node scripts/backfill-uploader-pen-name.js --limit=500
```

---

## 步驟 1：下載 Service Account Key
1. 去 https://console.firebase.google.com/
2. 選擇你的項目
3. 點擊 ⚙️ (設定) → 項目設定
4. 選擇「服務帳戶」分頁
5. 點擊「產生新的私密金鑰」
6. 下載 JSON 檔案

## 步驟 2：放置金鑰檔案
將下載的 JSON 檔案放到：
```
scripts/firebase-service-account.json
```

## 步驟 3：更新 .env.local
```
FIREBASE_SERVICE_ACCOUNT=./scripts/firebase-service-account.json
```

## 步驟 4：執行遷移
```bash
# 測試 10 份
node scripts/migrate-blogger.js --limit=10

# 正式導入 10 份
node scripts/migrate-blogger.js --write --limit=10

# 批量導入（每批 200 份）
node scripts/migrate-blogger.js --write --limit=200 --offset=0
node scripts/migrate-blogger.js --write --limit=200 --offset=200
...
```

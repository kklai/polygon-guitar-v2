# Firebase Service Account 設定（詳細步驟）

用嚟俾本地腳本（例如一次過修正 slug）用 **Admin SDK** 寫入 Firestore。  
Service account JSON **只放喺自己電腦**，唔好 commit 上 Git。

---

## 一、下載 Service Account JSON

1. 打開 **[Firebase Console](https://console.firebase.google.com/)**，登入你嘅 Google 帳號。
2. 揀專案 **polygon-guitar-v2**（或你對應嘅專案名）。
3. 撳左上角 **⚙️ 齒輪** → **Project settings**（專案設定）。
4. 喺頂部 tab 揀 **Service accounts**。
5. 頁面會顯示「Firebase Admin SDK」區塊，下面有 **Generate new private key** 按鈕，撳 **Generate new private key**。
6. 彈出確認框，撳 **Generate key**。
7. 瀏覽器會下載一個 JSON 檔案，名類似：`polygon-guitar-v2-firebase-adminsdk-xxxxx-xxxxxxxxxx.json`。

---

## 二、擺入專案並改名

1. 打開你嘅專案資料夾（例如 `polygon-guitar-v2`）。
2. 入去 **`scripts`** 資料夾。
3. 將下載返嚟嘅 JSON **搬**（或複製）入去 `scripts`。
4. **改名**做：`firebase-service-account.json`  
   （方便 .env.local 用同一條路徑，唔使成日改。）

最終路徑應該係：

```
polygon-guitar-v2/
  scripts/
    firebase-service-account.json   ← 呢個檔案
    fix-all-slug-mismatch.js
    ...
```

---

## 三、確認唔會 commit 上 Git

專案嘅 **`.gitignore`** 已經包含呢行：

```
scripts/firebase-service-account.json
```

所以：

- Git **唔會**追蹤呢個檔案。
- `git status` 唔會顯示佢。
- 推上 GitHub 時唔會一齊推上去。

你可以自己打開專案根目錄嘅 `.gitignore` 睇，確認有上面呢行。

---

## 四、設定 .env.local

1. 喺專案根目錄打開（或建立） **`.env.local`**。
2. 加一行（路徑係相對專案根目錄）：

   ```
   FIREBASE_SERVICE_ACCOUNT=./scripts/firebase-service-account.json
   ```

3. 儲存檔案。

若果你把 JSON 擺喺第二度（例如專案根目錄），就改做對應路徑，例如：

- 放喺根目錄：`FIREBASE_SERVICE_ACCOUNT=./firebase-service-account.json`
- 放喺 `scripts/keys/`：`FIREBASE_SERVICE_ACCOUNT=./scripts/keys/firebase-service-account.json`

---

## 五、驗證（可選）

喺終端機執行：

```bash
node scripts/fix-all-slug-mismatch.js --write
```

若果設定正確，會開始更新 Firestore，而唔會出現「Missing or insufficient permissions」或「請喺 .env.local 設 FIREBASE_SERVICE_ACCOUNT」嘅錯誤。

---

## 安全提醒

- **唔好**將 `firebase-service-account.json` 或 `.env.local` commit 上 Git。
- **唔好**將 JSON 內容貼去公開地方或傳俾人。
- 若果唔小心 push 咗，要喺 Firebase Console 入面 **撤銷** 嗰個 service account 嘅 key，再重新 Generate 新 key，然後用新 JSON 取代本機檔案。

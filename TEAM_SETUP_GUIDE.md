# 團隊協作設置指南 - 方案一

> GitHub + Vercel 自動部署（完全免費）

---

## 🎯 方案特點

- ✅ **完全免費** - 不需要 Vercel Pro
- ✅ **自動部署** - Push 代碼後自動上線
- ✅ **簡單易用** - 同事只需會用 GitHub

---

## 📋 設置步驟

### 第一步：確認 Vercel 已連接 GitHub

1. 前往 https://vercel.com/dashboard
2. 點擊 **polygon-guitar-v2** 項目
3. 點擊 **Settings** → **Git**
4. 確認顯示：
   ```
   Connected to GitHub
   Repository: kermit-tam/polygon-guitar-v2
   ```

**如果未連接：**
- 點擊 "Connect to Git"
- 選擇你的 GitHub 倉庫
- 保持默認設置（Production Branch: main）

---

### 第二步：添加同事到 GitHub

1. 前往 https://github.com/kermit-tam/polygon-guitar-v2
2. 點擊 **Settings** → **Manage access** → **Invite a collaborator**
3. 輸入同事的 GitHub 用戶名或 Email
4. 選擇權限：**Write**
5. 點擊 **Add**

**同事會收到 Email，需要點擊接受邀請。**

---

### 第三步：分享環境變數給同事

**⚠️ 重要：不要將 .env.local 上傳到 GitHub！**

#### 安全分享方法：

**方法 A：WhatsApp / Signal（推薦）**
```
將 .env.local 檔案內容複製，通過加密通訊軟件發送
```

**方法 B：建立 .env.local.example**
```bash
# 在項目根目錄創建 .env.local.example（已存在）
# 這個檔案已包含所有需要的 Key 名稱（不含真實值）

# 給同事發送真實值的截圖或文字
```

**同事收到後：**
```bash
# 在項目根目錄創建 .env.local 檔案
# 貼上你給他的內容
```

---

### 第四步：同事首次設置

#### 1. 接受 GitHub 邀請
- 檢查 Email，點擊 "View invitation"
- 點擊 "Accept invitation"

#### 2. Clone 倉庫
```bash
git clone https://github.com/kermit-tam/polygon-guitar-v2.git
cd polygon-guitar-v2
```

#### 3. 安裝依賴
```bash
npm install
```

#### 4. 創建環境變數
```bash
# 創建 .env.local 檔案，貼上你給他的內容
cp .env.local.example .env.local
# 然後編輯 .env.local，填入真實的 API Keys
```

#### 5. 本地測試
```bash
npm run dev
# 打開 http://localhost:3000 確認能運行
```

---

## 🔄 日常工作流程

### 同事開發流程

```bash
# 1. 每次開始工作前先拉取最新代碼
git pull origin main

# 2. 修改代碼...

# 3. 查看更改
git status
git diff

# 4. 提交更改
git add .
git commit -m "描述這次修改"

# 5. 推送（這會自動觸發 Vercel 部署）
git push origin main

# 6. 等待約 30-60 秒，Vercel 自動部署完成
# 查看 https://polygon.guitars 確認更新
```

---

## ✅ 確認自動部署正常

### 測試方法：

1. **讓同事 Push 一個小更改**
   - 例如修改 README.md 加一個空格

2. **檢查 GitHub**
   - 前往 https://github.com/kermit-tam/polygon-guitar-v2
   - 確認看到最新的 commit

3. **檢查 Vercel**
   - 前往 https://vercel.com/dashboard
   - 點擊項目，查看 "Deployments"
   - 確認顯示最新的部署（狀態應該是 Ready）

4. **檢查網站**
   - 前往 https://polygon.guitars
   - 確認看到更改

---

## 🔐 安全注意事項

### 給同事的提醒：

| ❌ 不要做 | ✅ 應該做 |
|----------|----------|
| 將 .env.local 上傳到 GitHub | 確認 .env.local 在 .gitignore 中 |
| 隨便刪除 main 分支 | 創建分支進行大改動 |
| 推送未完成的功能 | 本地測試 OK 後再推送 |
| 修改 Firebase Security Rules | 先和你討論 |

### 確認 .gitignore 包含：
```
.env.local
.env*.local
node_modules/
.next/
```

---

## 🆘 常見問題

### Q: 同事 Push 後 Vercel 沒有自動部署？
**檢查：**
1. GitHub 上是否看到最新 commit？
2. Vercel Project → Settings → Git → 是否連接正確？
3. Git Branch 是否為 main？

### Q: 同事沒有 GitHub 帳號？
**解決：**
- 必須創建 GitHub 帳號（免費）
- GitHub 是唯一的代碼協作平台

### Q: 同事推送失敗？
**錯誤訊息：**
```
fatal: unable to access ... 403
```
**解決：**
- 確認你已添加他為 Collaborator
- 確認他已接受邀請

### Q: 如何查看誰推送了什麼？
**查看 GitHub：**
```
GitHub → Insights → Contributors
```

### Q: 推送了錯誤的代碼怎麼辦？
**回滾方法：**
```bash
# 查看歷史
git log --oneline

# 回滾到上一版本
git revert HEAD
git push origin main
```

---

## 📞 緊急聯繫

如果遇到問題：
1. 檢查 GitHub 和 Vercel 的狀態頁面
2. 查看 Vercel 部署日誌
3. 聯繫項目負責人

---

## 🎉 完成檢查清單

- [ ] 同事已接受 GitHub 邀請
- [ ] 同事已成功 Clone 倉庫
- [ ] 同事已安裝依賴 (`npm install`)
- [ ] 同事已創建 .env.local
- [ ] 同事本地測試成功 (`npm run dev`)
- [ ] 同事 Push 測試更改
- [ ] Vercel 自動部署成功
- [ ] 網站顯示最新更改

---

*設置完成後，同事每次 Push 都會自動部署到 polygon.guitars*

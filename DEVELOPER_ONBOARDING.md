# 開發者協作指南

> 如何添加同事共同開發 Polygon Guitar 項目

---

## 🎯 兩種協作方式

### 方式一：GitHub 協作者（推薦）
**適合**：需要直接修改代碼的開發者

**權限**：
- ✅ 直接推送代碼到 GitHub
- ✅ 創建分支和合併請求
- ✅ 部署到 Vercel

**添加方法**：
1. 前往 GitHub 倉庫頁面：`https://github.com/kermit-tam/polygon-guitar-v2`
2. 點擊 **Settings** → **Manage access** → **Invite a collaborator**
3. 輸入同事的 GitHub 用戶名或 email
4. 選擇權限級別（建議選 **Write**）

---

### 方式二：Fork + Pull Request
**適合**：外部貢獻者或臨時協作

**流程**：
1. 同事 Fork 你的倉庫到自己的 GitHub
2. 在他們的 Fork 上修改代碼
3. 發送 Pull Request 給你審核
4. 你確認後合併到主分支

---

## 👥 權限級別說明

| 權限 | 可以做的事 |
|------|-----------|
| **Read** | 查看代碼、拉取更新 |
| **Triage** | 管理 Issues、Pull Requests |
| **Write** | 推送代碼、創建分支、合併 PR（推薦） |
| **Maintain** | 管理倉庫設定、部署 |
| **Admin** | 完整控制權（包括刪除倉庫） |

**建議給開發同事**：**Write** 權限

---

## 🚀 同事加入後的工作流程

### 1. 首次設置
```bash
# Clone 倉庫
git clone https://github.com/kermit-tam/polygon-guitar-v2.git
cd polygon-guitar-v2

# 安裝依賴
npm install

# 創建本地環境變數文件
cp .env.local.example .env.local
# 然後填入 Firebase 等 API Keys

# 啟動開發伺服器
npm run dev
```

### 2. 日常開發流程
```bash
# 每次開始工作前先拉取最新代碼
git pull origin main

# 創建功能分支（可選但推薦）
git checkout -b feature/新功能名稱

# 修改代碼...

# 提交更改
git add .
git commit -m "描述更改內容"

# 推送
git push origin main
# 或推送到分支：git push origin feature/新功能名稱
```

### 3. 部署流程
```bash
# 確保所有更改已提交
git status

# 推送
git push origin main

# Vercel 會自動部署
# 查看部署狀態：vercel --version 確認已登入
```

---

## 🔐 需要給同事的資料

### 必需：
- [ ] GitHub 倉庫訪問權限（已添加協作者）
- [ ] `.env.local` 檔案內容（API Keys）

### 可選：
- [ ] Vercel 項目訪問權限（如需他們也能部署）
- [ ] Firebase Console 訪問權限（如需修改數據庫規則）
- [ ] Cloudinary 帳號（如需管理圖片）

---

## 📋 如何分享環境變數 (.env.local)

**⚠️ 重要：不要將 .env.local 上傳到 GitHub！**

安全分享方法：

### 方法 1：加密分享（推薦）
```bash
# 在你的電腦上將 .env.local 內容複製
# 使用安全的通訊方式發送：
# - Signal
# - WhatsApp（端到端加密）
# - 面對面傳輸
```

### 方法 2：1Password / Bitwarden
如果有使用密碼管理器，可以共享一個 Secure Note

### 方法 3：Firebase 邀請
讓同事創建自己的 Firebase 項目進行開發：
1. 前往 https://console.firebase.google.com
2. 創建新項目
3. 獲取自己的 API Keys
4. 使用測試環境而非生產環境

---

## 🛠️ 技術架構快速參考

```
技術棧：
- Next.js 16 (React)
- Firebase (Firestore + Auth)
- Tailwind CSS
- Cloudinary (圖片)

主要目錄：
/pages          - 頁面路由
/components     - 可重用組件
/lib            - 工具函數和 API
/public         - 靜態資源
/scripts        - 數據遷移腳本
```

---

## ⚠️ 注意事項

### 開發前必讀：
1. **先讀 AGENTS.md** - 了解項目背景和設計規範
2. **不要直接修改生產環境** - 重要更改先在本地測試
3. **保持代碼風格一致** - 使用現有的 JavaScript（非 TypeScript）
4. **中文界面** - 所有用戶界面使用繁體中文

### 危險操作（需要謹慎）：
- ❌ 不要隨便運行 `scripts/` 裡的遷移腳本
- ❌ 不要修改 Firebase Security Rules 除非你清楚在做什麼
- ❌ 不要刪除 `main` 分支
- ❌ 不要將 API Keys 提交到 Git

---

## 🆘 常見問題

**Q: 同事推送了代碼但沒有自動部署？**
A: 檢查 Vercel 項目的 Git 連接，可能需要將同事添加為 Vercel 團隊成員

**Q: 如何讓同事也能部署到 Vercel？**
A: 
1. 登入 https://vercel.com/dashboard
2. 選擇項目 → Settings → Members
3. 邀請同事的 GitHub 帳號

**Q: 同事修改後發現錯誤怎麼辦？**
A: 
1. 使用 `git revert` 回滾特定提交
2. 或手動修復後再次提交

**Q: 可以限制同事只能修改某些檔案嗎？**
A: GitHub 沒有內建的細粒度權限控制，需要通過 Code Review 流程控制

---

## 📞 聯繫方式

如有問題，請聯繫：
- 項目負責人：Kermit
- 或通過 GitHub Issues 討論

---

*最後更新：2026-03-03*

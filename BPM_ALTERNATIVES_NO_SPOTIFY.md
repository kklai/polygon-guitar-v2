# BPM 獲取替代方案（無需 Spotify API）

> ⚠️ Spotify API 要到 2月11號之後先可以申請，以下係暫時替代方案

---

## 方案 1: MusicBrainz + AcousticBrainz（免費開源）

MusicBrainz 係開源音樂百科，AcousticBrainz 提供 BPM 等音頻分析數據。

### 優點
- ✅ 完全免費
- ✅ 無需申請
- ✅ 無嚴格速率限制
- ✅ 開源社群維護

### 缺點
- ❌ 資料覆蓋率比 Spotify 低
- ❌ 中文歌資料較少
- ❌ BPM 資料可能缺失

### 使用方法
```bash
node scripts/fetch-bpm-musicbrainz.js --test
```

---

## 方案 2: 手動填寫 CSV（最可靠）

從 Tunebat、SongBPM 等網站手動查詢，填入 CSV 導入。

### 推薦查詢網站
1. **Tunebat**: https://tunebat.com
   - 資料齊全，有 Key + BPM
   - 中英文歌都有

2. **SongBPM**: https://songbpm.com
   - 專門 BPM 資料庫
   - 有歷史趨勢圖

3. **Musicstax**: https://musicstax.com
   - 界面美觀
   - 有詳細音頻分析

4. **GetSongBPM**: https://getsongbpm.com
   - 簡單易用
   - 有 API（付費）

### 使用方法

1. **生成待查詢清單**
   ```bash
   node scripts/generate-metadata-template.js
   ```

2. **手動查詢填寫**
   - 打開 `metadata-template-hot50-2026-02-07.csv`
   - 逐首去 Tunebat 查詢
   - 填入 BPM、Key、年份

3. **導入資料庫**
   ```bash
   node scripts/import-metadata-from-csv.js --file=填好的檔案.csv
   ```

---

## 方案 3: 用戶貢獻系統（長期方案）

在上傳譜的表單中加入 BPM 輸入欄位，讓用戶自行填寫。

### 修改建議
修改 `pages/tabs/new.js`，在表單中添加：
- BPM 輸入框（數字）
- Key 選擇器（下拉選單）
- 年份輸入框（數字）

### 優點
- ✅ 社群協作，資料會越來越齊全
- ✅ 毋須依賴第三方 API
- ✅ 更貼近實際使用需求

---

## 建議實施計劃

### 現在（2月11號之前）
1. 用 **MusicBrainz** 自動抓取（我能立即寫腳本）
2. 手動補全 **熱門 50 首** 的 BPM
3. 修改上傳表單，加入 BPM 輸入欄位

### 2月11號之後
1. 申請 Spotify API
2. 用 Spotify 大規模補全剩餘歌曲
3. 整合多個資料源，提高覆蓋率

---

## 你想先做邊個？

| 選項 | 內容 | 時間 |
|------|------|------|
| A | 寫 MusicBrainz 自動抓取腳本 | 10分鐘 |
| B | 生成熱門50首CSV，你手動查詢 | 已完成 |
| C | 修改上傳表單，加入BPM欄位 | 20分鐘 |
| D | 等2月11號申請Spotify | 3日後 |

請選擇你想先做嘅方案！

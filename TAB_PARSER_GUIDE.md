# 結他譜內容解析器使用指南

## 概述

為了解決 Blogger 舊譜遷移後譜內容格式不統一的問題，我們創建了一個智能譜內容解析器，能夠自動識別：

1. **Section Marker** - Intro, Verse, Chorus, Bridge 等段落標記
2. **和弦行** - 純和弦內容（如 `|C G | Am F |`）
3. **歌詞行** - 純歌詞內容
4. **混合行** - 和弦和歌詞在同一行（如 `|C| (今天我)寒夜裡看雪飄過`）

## 檔案結構

```
lib/
  tabParser.js          # 核心解析器模組

scripts/
  migrate-blogger.js    # 已更新，使用解析器格式化新導入的譜
  fix-tab-content.js    # 修復已導入譜的內容格式
  test-tab-parser.js    # 測試腳本

components/
  TabContent.js         # 已更新，支援更多 Section Marker
```

## 使用方式

### 1. 修復已導入的譜內容

```bash
# 測試模式（預覽效果，不會修改數據）
node scripts/fix-tab-content.js --dry-run --limit=5

# 正式修復
node scripts/fix-tab-content.js --limit=20

# 顯示詳細內容對比
node scripts/fix-tab-content.js --dry-run --details --limit=3

# 修復所有譜
node scripts/fix-tab-content.js
```

### 2. 導入新的 Blogger 譜

```bash
# 測試模式
node scripts/migrate-blogger.js --limit=10

# 寫入模式
node scripts/migrate-blogger.js --write --limit=50
```

現在新導入的譜會自動使用 `tabParser.js` 進行格式化。

### 3. 測試解析器

```bash
node scripts/test-tab-parser.js
```

## 支援的 Section Marker

### 英文標記
- Intro, Outro, Ending
- Verse, Verse 1/2/3/4
- Chorus, Chorus 1/2/3
- Prechorus, Pre-chorus, Pre Chorus 1/2
- Bridge, Middle 8
- Interlude, Instrumental
- Solo, Guitar Solo, Piano Solo
- Break, Music Break
- Hook, Refrain
- Fade out, Fadeout

### 中文標記
- 前奏, 尾奏, 結尾
- 主歌, 主歌一/二, 主歌1/2
- 副歌, 副歌一/二, 副歌1/2
- 導歌, 過門
- 橋段, 間奏
- 獨奏, 結他獨奏
- 休息, 停頓
- 漸弱, 淡出

## 譜內容格式範例

### 標準格式（推薦）
```
Intro
|C      G/B    |Am     F
(暗)如何(蠶)食了(光)

Verse
|C        |G        |Am       |F
(今天我)寒夜裡看雪飄過
|C        |G        |Am       |F
(懷著冷)卻了的心窩飄遠方

Chorus
|F  G  |Em Am  |Dm     G     |C
(海闊)天空(我)會想念你
```

### 混合行格式（也支援）
```
Intro: |C G | Am F
Verse 1: |C| (今天我)寒夜裡看雪飄過
|G| (懷著冷)卻了的心窩
Chorus: |F G| (海闊)天空
```

## 解析邏輯

### 1. Section Marker 識別
- 檢查行首是否匹配已知標記
- 支援後接 `:`, `：`, 或空格

### 2. 和弦行識別
- 包含 `|` 分隔符
- 包含 A-G 開頭的和弦符號
- 中文字符比例 < 10%

### 3. 歌詞行識別
- 中文字符比例 > 30%
- 或包含括號內的中文
- 或沒有和弦符號

### 4. 混合行識別
- 包含 `|` 和弦標記
- 包含 `(` `)` 包圍的中文歌詞

## 疑難排解

### 問題：Section Marker 沒有正確識別

**可能原因**：
1. 使用了不支援的標記名稱
2. 拼寫錯誤

**解決方法**：
- 檢查標記是否在支援列表中
- 修改 `lib/tabParser.js` 中的 `SECTION_MARKERS` 陣列

### 問題：和弦行被誤認為歌詞

**可能原因**：
1. 行中包含太多中文字符
2. 沒有使用 `|` 分隔符

**解決方法**：
- 確保和弦行中文字符 < 10%
- 使用 `|` 分隔和弦

### 問題：歌詞行被誤認為和弦

**可能原因**：
1. 歌詞中包含 A-G 字母（如英文歌詞）
2. 使用了 `|` 字符

**解決方法**：
- 確保歌詞行有足夠的中文字符
- 避免在歌詞中使用 `|`

## 擴展支援

如需添加新的 Section Marker，請修改以下檔案：

1. `lib/tabParser.js` - 後端解析器
2. `components/TabContent.js` - 前端顯示組件

兩個檔案的 `SECTION_MARKERS` 陣列需要保持一致。

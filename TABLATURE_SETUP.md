# 六線譜功能安裝指南

## 概述

此功能支援上傳並播放 Guitar Pro (.gp3/4/5/6/7)、MIDI、MusicXML 格式的六線譜。

## 安裝依賴

```bash
npm install @coderline/alphatab react-dropzone
```

## 功能特性

### 1. 支援格式

| 格式 | 說明 | 播放 |
|------|------|------|
| `.gp3/.gp4/.gp5` | Guitar Pro 3-5 | ✅ |
| `.gpx` | Guitar Pro 6/7 | ✅ |
| `.mid/.midi` | MIDI 文件 | ✅ |
| `.xml/.musicxml` | MusicXML | ✅ |
| `.txt` | ASCII Tab | 僅顯示 |

### 2. 播放器功能

- ▶️ 播放 / 暫停 / 停止
- ⏱️ 速度調整 (0.25x - 2x)
- 🔁 循環播放
- 📍 點擊定位
- 🎵 和弦圖顯示
- 🎼 五線譜 / 六線譜切換

### 3. 主題配色

已配置為 Spotify 深色模式風格：
- 背景：`#121212`
- 強調色：`#FFD700`（黃色）
- 譜線：`#333333`

## 音源檔案

需要下載 SoundFont 音源檔案供播放使用：

```bash
# 創建 public 目錄
mkdir -p public/soundfonts

# 下載結他音色（推薦）
# 選項 1: 使用 GeneralUser GS (輕量級)
curl -L -o public/soundfonts/guitar-acoustic.sf2 \
  "https://github.com/FluidSynth/fluidsynth/raw/master/sf2/VintageDreamsWaves-v2.sf2"

# 選項 2: 使用更小的專用結他音源
```

推薦音源：
1. **GeneralUser GS** (~30MB) - 通用音質好
2. **FluidR3** (~140MB) - 高品質
3. **Vintage Dreams Waves** (~5MB) - 輕量級

## 使用方式

### 在現有頁面嵌入

```jsx
import TablatureViewer from '@/components/TablatureViewer';

// 顯示已有文件
<TablatureViewer 
  fileUrl="/path/to/song.gp5"
  height={600}
  showControls={true}
/>
```

### 上傳新譜

```jsx
import TablatureUploader from '@/components/TablatureUploader';

<TablatureUploader
  onFileLoaded={(arrayBuffer, fileName) => {
    // 處理文件
  }}
  onError={(error) => console.error(error)}
/>
```

### 完整上傳頁面

訪問 `/tabs/new-tablature` 即可使用完整的上傳流程。

## 技術架構

### AlphaTab

- 開源庫：https://github.com/CoderLine/alphaTab
- 文檔：https://www.alphatab.net/docs/
- License: MPL-2.0（可商用）

### 渲染引擎

- SVG（預設）- 清晰可縮放
- Canvas - 高性能

### 瀏覽器支援

- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

## 資料庫結構

新增的 `tabs` collection 字段：

```javascript
{
  contentType: 'tablature',  // 'tablature' | 'text'
  fileUrl: 'https://...',    // 六線譜文件 URL
  fileType: 'gp5',           // 文件類型
  fileSize: 1024000,         // 文件大小（位元組）
  duration: 180,             // 時長（秒）
  tracks: [                  // 音軌資訊
    { name: 'Guitar 1', instrument: 'Acoustic Guitar' }
  ]
}
```

## 常見問題

### Q: 為什麼播放沒有聲音？

A: 請確保：
1. 已下載 SoundFont 音源檔案到 `public/soundfonts/`
2. 瀏覽器支援 Web Audio API
3. 頁面已獲取用戶互動（點擊）才能播放音訊

### Q: 支援哪些結他效果？

A: AlphaTab 支援：
- 標準調弦 / 特殊調弦
- 悶音 (Palm Mute)
- 推弦 (Bend)
- 滑弦 (Slide)
- 泛音 (Harmonics)
- 點弦 (Tapping)
- 等等...

### Q: 可以編輯譜嗎？

A: 目前只支援顯示和播放。如需編輯，建議使用：
- Guitar Pro
- TuxGuitar（免費）
- MuseScore（免費）

## 參考資源

- [TuxGuitar GitHub](https://github.com/helge17/tuxguitar)
- [Guitar Pro 格式規範](https://www.github.com/helge17/tuxguitar/tree/master/TuxGuitar-lib/src/org/herac/tuxguitar/io/gp)
- [AlphaTab 示例](https://www.alphatab.net/docs/showcase/)

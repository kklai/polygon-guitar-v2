# Guitar Pro 段落整合方案 - Polygon Guitar

## 1. Firestore Security Rules 更新

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 現有規則...
    
    // GP Segments 子集合規則
    match /songs/{songId}/gpSegments/{segmentId} {
      allow read: if true;
      allow create, update: if request.auth != null && 
        (request.auth.uid == resource.data.uploaderId || 
         request.auth.uid == get(/databases/$(database)/documents/songs/$(songId)).data.uploaderId);
      allow delete: if request.auth != null && 
        (request.auth.uid == resource.data.uploaderId || 
         request.auth.uid == get(/databases/$(database)/documents/songs/$(songId)).data.uploaderId);
    }
    
    // 或者用陣列方式儲存在 songs 文檔（推薦）
    match /songs/{songId} {
      allow update: if request.auth != null && 
        (request.auth.uid == resource.data.uploaderId || 
         request.auth.uid in get(/databases/$(database)/documents/users/admin).data.moderators);
    }
  }
}
```

## 2. Cloudinary Upload Preset 配置

建議創建專用 preset：`guitar_pro_segments`

```json
{
  "folder": "guitar-pro-segments",
  "allowed_formats": ["gp3", "gp4", "gp5", "gpx", "gp"],
  "max_file_size": 5242880,
  "resource_type": "raw",
  "unique_filename": true,
  "overwrite": false,
  "notification_url": null,
  "context": true,
  "tags": ["gp-segment"]
}
```

**注意**：Cloudinary 免費版對 raw 文件有限制，建議：
- 使用 `resource_type: "raw"` 儲存 GP 檔案
- 或考慮使用 Firebase Storage + Cloudinary 備份縮圖

## 3. React 組件架構

```
components/
├── GpSegment/
│   ├── GpSegmentUploader.jsx      # 上傳 + 小節選擇 UI
│   ├── GpSegmentPlayer.jsx        # 單個段落播放器
│   ├── GpSegmentList.jsx          # 段落列表管理
│   └── GpBarSelector.jsx          # 小節範圍選擇器
├── TabContent/
│   └── index.js                   # 整合 GP 段落渲染
└── hooks/
    ├── useGpSegmentUpload.js      # 上傳邏輯
    ├── useAlphaTabPlayer.js       # AlphaTab 播放器控制
    └── useCloudinaryDelete.js     # 刪除 GP 檔案
```

### 3.1 核心組件接口

```javascript
// GpSegmentUploader.jsx
interface GpSegmentUploaderProps {
  songId: string;
  onSegmentAdd: (segment: GpSegment) => void;
  existingSegments: GpSegment[];
  chordCount: number; // 用於計算插入位置
}

// GpSegmentPlayer.jsx
interface GpSegmentPlayerProps {
  segment: GpSegment;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
}
```

## 4. 資料結構（Firestore）

```javascript
// songs collection 擴展
{
  id: "song-123",
  title: "富士山下",
  artist: "陳奕迅",
  
  // 現有欄位
  chordLyrics: "|C ...",
  capo: 3,
  key: "C",
  
  // 新增：GP 段落陣列
  gpSegments: [
    {
      id: "seg-001",
      type: "intro",           // 'intro' | 'interlude' | 'outro' | 'solo' | 'bridge'
      cloudinaryUrl: "https://res.cloudinary.com/.../intro.gp5",
      cloudinaryPublicId: "guitar-pro-segments/abc123",
      startBar: 1,
      endBar: 4,
      insertAfterChord: 0,     // 0 = 開頭，1 = 第一個和弦後...
      duration: 8.5,           // 秒數（用於進度條）
      totalBars: 4,            // 總小節數
      createdAt: Timestamp,
      updatedAt: Timestamp
    }
  ],
  
  // 預留：第二階段 AlphaTex
  texContent: null,            // 將來用於 AlphaTex 文字輸入
  
  // 預留：第三階段視覺編輯器
  visualEditorData: null       // JSON 格式儲存視覺編輯器狀態
}
```

## 5. AlphaTab 初始化與播放控制

### 5.1 關鍵思路

```javascript
// useAlphaTabPlayer.js
export function useAlphaTabPlayer(containerRef, gpUrl) {
  const [api, setApi] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [totalBars, setTotalBars] = useState(0);
  
  useEffect(() => {
    if (!containerRef.current || !gpUrl) return;
    
    const initAlphaTab = async () => {
      const AlphaTab = await import('@coderline/alphatab');
      
      const settings = {
        core: {
          engine: 'svg',
          file: gpUrl,           // 直接載入 Cloudinary URL
          logLevel: 'warning'
        },
        display: {
          staveProfile: 'Tab',   // 只顯示六線譜
          scale: 0.8,            // 縮小適合嵌入
          width: 600,
          barsPerRow: 4,         // 每行小節數
          // 隱藏標題、頁碼等
          layoutMode: 'horizontal'
        },
        notation: {
          elements: {
            scoreTitle: false,
            scoreSubTitle: false,
            scoreArtist: false,
            scoreAlbum: false,
            guitarTuning: false,
            effectTempo: false  // 隱藏速度標記
          }
        },
        player: {
          enablePlayer: true,
          enableCursor: true,
          soundFont: 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2'
        }
      };
      
      const alphaTabApi = new AlphaTab.AlphaTabApi(containerRef.current, settings);
      
      // 載入完成後獲取總小節數
      alphaTabApi.scoreLoaded.on((score) => {
        setTotalBars(score.masterBars.length);
        setIsReady(true);
        
        // 如果只顯示部分小節，設置播放範圍
        if (startBar && endBar) {
          // AlphaTab 暫時不直接支援只顯示部分小節
          // 需要通過 CSS 隱藏或載入前裁剪
        }
      });
      
      setApi(alphaTabApi);
    };
    
    initAlphaTab();
    
    return () => {
      api?.destroy();
    };
  }, [gpUrl]);
  
  // 播放控制
  const play = useCallback(() => api?.play(), [api]);
  const pause = useCallback(() => api?.pause(), [api]);
  const stop = useCallback(() => api?.stop(), [api]);
  
  // 循環播放指定範圍
  const playRange = useCallback((startTick, endTick) => {
    // AlphaTab 支援設置播放範圍
    api?.tickCache?.startTick = startTick;
    api?.tickCache?.endTick = endTick;
    api?.play();
  }, [api]);
  
  return { api, isReady, totalBars, play, pause, stop, playRange };
}
```

### 5.2 播放範圍實現

AlphaTab 暫時不直接支援只渲染部分小節。兩種解決方案：

**方案 A：CSS 裁剪（推薦）**
```css
.gp-segment-player {
  overflow: hidden;
  height: 140px;
}

/* 通過 transform 移動顯示區域 */
.gp-segment-content {
  transform: translateX(calc(var(--start-bar) * -100px));
}
```

**方案 B：後端裁剪（需要服務器處理 GP 檔案）**
使用 `alphaTab.core` 在 Node.js 讀取 GP 檔案，裁剪後生成新檔案。

**方案 C：前端讀取後裁剪（複雜）**
```javascript
// 讀取完整檔案，但只渲染指定小節
alphaTabApi.scoreLoaded.on((score) => {
  const masterBars = score.masterBars;
  // 移除不需要的小節
  const barsToShow = masterBars.slice(startBar - 1, endBar);
  // 重新渲染（需要手動操作 score 對象）
});
```

## 6. 整合到 TabContent

```javascript
// TabContent.jsx 整合 GP 段落
export default function TabContent({ tab }) {
  const { chordLyrics, gpSegments = [] } = tab;
  
  // 將譜內容分割成段落
  const renderContentWithSegments = () => {
    const chords = parseChords(chordLyrics);
    const segments = [...gpSegments].sort((a, b) => a.insertAfterChord - b.insertAfterChord);
    
    const result = [];
    let lastIndex = 0;
    
    segments.forEach((segment) => {
      // 插入段落前的文字譜
      if (segment.insertAfterChord > lastIndex) {
        result.push(
          <ChordSection 
            key={`chords-${lastIndex}`}
            chords={chords.slice(lastIndex, segment.insertAfterChord)}
          />
        );
      }
      
      // 插入 GP 段落
      result.push(
        <GpSegmentPlayer 
          key={segment.id}
          segment={segment}
        />
      );
      
      lastIndex = segment.insertAfterChord;
    });
    
    // 剩餘文字譜
    if (lastIndex < chords.length) {
      result.push(
        <ChordSection 
          key={`chords-${lastIndex}`}
          chords={chords.slice(lastIndex)}
        />
      );
    }
    
    return result;
  };
  
  return (
    <div className="tab-content">
      {renderContentWithSegments()}
    </div>
  );
}
```

## 7. 潛在問題與解決方案

### 7.1 CORS 問題

**問題**：Cloudinary raw 檔案可能沒有 CORS header，AlphaTab 無法載入。

**解決方案**：
```javascript
// cloudinary 配置添加 CORS
// Upload preset 設置：
{
  "raw_convert": "aspose",
  "cors": {
    "enabled": true,
    "origins": ["https://polygon.guitars"]
  }
}

// 或使用代理
// 創建 /api/proxy-gp?url=... 路由
// 通過 Next.js API 轉發請求
```

### 7.2 檔案載入失敗

```javascript
// GpSegmentPlayer.jsx
const [loadError, setLoadError] = useState(null);
const [retryCount, setRetryCount] = useState(0);

useEffect(() => {
  if (!api) return;
  
  api.error.on((error) => {
    console.error('AlphaTab error:', error);
    setLoadError(error.message);
    
    // 自動重試
    if (retryCount < 3) {
      setTimeout(() => {
        setRetryCount(c => c + 1);
        api.load(gpUrl);
      }, 1000 * (retryCount + 1));
    }
  });
}, [api]);

// UI 顯示
if (loadError && retryCount >= 3) {
  return (
    <div className="gp-error">
      <p>無法載入 GP 檔案</p>
      <button onClick={() => window.open(gpUrl, '_blank')}>
        下載檔案
      </button>
    </div>
  );
}
```

### 7.3 記憶體洩漏

GP 檔案可能很大，需要及時釋放：

```javascript
useEffect(() => {
  return () => {
    // 組件卸載時徹底清理
    api?.destroy();
    // 清除 SoundFont 緩存
    if (api?.player) {
      api.player.destroy();
    }
  };
}, []);
```

### 7.4 多個播放器同時播放

```javascript
// 全局播放狀態管理
const [activePlayerId, setActivePlayerId] = useState(null);

// 播放一個時暫停其他
const handlePlay = (segmentId) => {
  if (activePlayerId && activePlayerId !== segmentId) {
    // 通知其他播放器暫停
    eventBus.emit('pause-player', activePlayerId);
  }
  setActivePlayerId(segmentId);
};
```

### 7.5 移動端性能

GP 檔案解析可能很慢，建議：

```javascript
// 懶加載 GP 播放器
const GpSegmentPlayer = lazy(() => import('./GpSegmentPlayer'));

// 只在進入視口時載入
import { useInView } from 'react-intersection-observer';

function LazyGpPlayer({ segment }) {
  const [ref, inView] = useInView({ triggerOnce: true, rootMargin: '200px' });
  
  return (
    <div ref={ref} style={{ minHeight: '140px' }}>
      {inView ? <GpSegmentPlayer segment={segment} /> : <Placeholder />}
    </div>
  );
}
```

## 8. 開發順序建議

### Week 1: 基礎設置
- [ ] 更新 Firestore Security Rules
- [ ] 創建 Cloudinary Upload Preset
- [ ] 創建 `GpSegmentUploader` 組件（只有上傳功能）
- [ ] 創建 `GpSegmentPlayer` 組件（簡單版本，顯示全部小節）

### Week 2: 播放控制
- [ ] 實現播放/暫停/停止
- [ ] 進度條顯示
- [ ] 循環播放

### Week 3: 小節選擇
- [ ] 研究 AlphaTab 部分小節渲染
- [ ] 實現 `GpBarSelector` 組件
- [ ] 儲存 segment 資料到 Firestore

### Week 4: 整合
- [ ] 整合到 `TabContent`
- [ ] 編輯頁面支援添加/刪除/修改段落
- [ ] 測試與 bug 修復

## 9. 參考資源

- AlphaTab Docs: https://www.alphatab.net/docs/
- AlphaTab API Reference: https://www.alphatab.net/docs/reference/api
- Cloudinary Raw Upload: https://cloudinary.com/documentation/upload_images#uploading_raw_files
- Guitar Pro File Format: https://www.github.com/olemb/guitarpro

---

需要我開始實現任何部分嗎？建議先從 Week 1 的 `GpSegmentUploader` 開始。
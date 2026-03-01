# Guitar Pro 整合實現指南

## 已完成部分

### 1. Firestore Security Rules ✅
文件：`firestore.rules`

```javascript
// 已在 songs 集合規則中允許創建和更新 GP 相關欄位
match /songs/{songId} {
  allow read: if true;
  allow create: if isAuthenticated();
  allow update: if isAuthenticated() && (
    resource.data.uploaderId == request.auth.uid || isAdmin()
  );
}
```

### 2. Cloudinary 上傳工具 ✅
文件：`lib/cloudinaryGp.js`

```javascript
// 使用方式
import { uploadGpFile } from '@/lib/cloudinaryGp'

const result = await uploadGpFile(file, songTitle)
// result: { url, publicId, originalFilename, fileSize, format }
```

### 3. GpSegmentUploader 組件 ✅
文件：`components/GpSegmentUploader.jsx`

**功能：**
- 上傳 GP 文件到 Cloudinary
- 用 AlphaTab 讀取總小節數
- 選擇段落類型（前奏/間奏/尾奏/Solo等）
- 選擇開始/結束小節
- 預覽所選範圍

**Props：**
```javascript
{
  songTitle: string,        // 用於生成文件名
  onSegmentAdd: function,   // (segment) => void
  existingSegments: array   // 已添加的段落列表
}
```

### 4. GpSegmentPlayer 組件 ✅
文件：`components/GpSegmentPlayer.jsx`

**功能：**
- 在 Tab 頁面嵌入顯示 GP 段落
- 支援播放/暫停
- 顯示段落類型標籤
- 循環播放指定小範圍

**Props：**
```javascript
{
  segment: object,      // GP 段落資料
  isPlaying: boolean,   // 播放狀態
  onPlay: function,
  onPause: function
}
```

---

## Cloudinary 配置步驟

### 1. 創建 Upload Preset
登入 Cloudinary Console → Settings → Upload → Upload Presets → Add upload preset

**配置：**
```json
{
  "name": "guitar_pro_segments",
  "folder": "guitar-pro-segments",
  "allowed_formats": ["gp3", "gp4", "gp5", "gpx", "gp"],
  "max_file_size": 5242880,
  "resource_type": "raw",
  "unique_filename": true,
  "overwrite": false
}
```

### 2. 檢查 CORS 設置
確保 Cloudinary 允許來自 `https://polygon.guitars` 的請求。

---

## 整合到上傳頁面

### tabs/new.js

```javascript
import { useState } from 'react'
import GpSegmentUploader from '@/components/GpSegmentUploader'

export default function NewTab() {
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    // ... 其他欄位
    gpSegments: []  // 新增：GP 段落陣列
  })

  // 添加 GP 段落
  const handleAddGpSegment = (segment) => {
    setFormData(prev => ({
      ...prev,
      gpSegments: [...prev.gpSegments, segment]
    }))
  }

  // 刪除 GP 段落
  const handleRemoveGpSegment = (segmentId) => {
    setFormData(prev => ({
      ...prev,
      gpSegments: prev.gpSegments.filter(s => s.id !== segmentId)
    }))
  }

  // 提交時包含 gpSegments
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const submitData = {
      ...formData,
      gpSegments: formData.gpSegments
    }
    
    await createTab(submitData, user.uid)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* ... 其他表單欄位 ... */}
      
      {/* GP 段落上傳 */}
      <div className="mt-6">
        <GpSegmentUploader
          songTitle={formData.title}
          onSegmentAdd={handleAddGpSegment}
          existingSegments={formData.gpSegments}
        />
      </div>
      
      {/* 已添加段落列表（如果需要自定義顯示） */}
      {formData.gpSegments.length > 0 && (
        <div className="mt-4 space-y-2">
          {formData.gpSegments.map((segment, index) => (
            <div key={segment.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
              <span>{segment.type} - 小節 {segment.startBar}-{segment.endBar}</span>
              <button 
                type="button"
                onClick={() => handleRemoveGpSegment(segment.id)}
              >
                刪除
              </button>
            </div>
          ))}
        </div>
      )}
    </form>
  )
}
```

---

## 整合到編輯頁面

### tabs/[id]/edit.js

```javascript
import { useState, useEffect } from 'react'
import GpSegmentUploader from '@/components/GpSegmentUploader'

export default function EditTab() {
  const [formData, setFormData] = useState({
    // ...
    gpSegments: []
  })

  // 載入時轉換舊資料
  useEffect(() => {
    const loadTab = async () => {
      const data = await getTab(id)
      
      setFormData({
        ...data,
        gpSegments: data.gpSegments || []
      })
    }
    
    loadTab()
  }, [id])

  const handleAddGpSegment = (segment) => {
    setFormData(prev => ({
      ...prev,
      gpSegments: [...prev.gpSegments, segment]
    }))
  }

  const handleRemoveGpSegment = (segmentId) => {
    setFormData(prev => ({
      ...prev,
      gpSegments: prev.gpSegments.filter(s => s.id !== segmentId)
    }))
  }

  const handleSubmit = async () => {
    await updateTab(id, {
      ...formData,
      gpSegments: formData.gpSegments
    }, user.uid)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* ... */}
      
      <GpSegmentUploader
        songTitle={formData.title}
        onSegmentAdd={handleAddGpSegment}
        existingSegments={formData.gpSegments}
      />
      
      {/* 已添加段落 */}
      {formData.gpSegments.map((segment, index) => (
        <div key={segment.id}>
          {segment.type} - 小節 {segment.startBar}-{segment.endBar}
          <button onClick={() => handleRemoveGpSegment(segment.id)}>
            刪除
          </button>
        </div>
      ))}
    </form>
  )
}
```

---

## 在 Tab 顯示頁面嵌入 GP 播放器

### tabs/[id].js

```javascript
import GpSegmentPlayer from '@/components/GpSegmentPlayer'

export default function TabPage({ tab }) {
  const [playingSegmentId, setPlayingSegmentId] = useState(null)

  const handlePlay = (segmentId) => {
    setPlayingSegmentId(segmentId)
  }

  const handlePause = () => {
    setPlayingSegmentId(null)
  }

  return (
    <div>
      {/* ... 原有內容 ... */}
      
      {/* GP 段落 */}
      {tab.gpSegments?.length > 0 && (
        <div className="mt-8 space-y-4">
          <h3 className="text-lg font-medium text-white">🎸 結他示範</h3>
          
          {tab.gpSegments.map(segment => (
            <GpSegmentPlayer
              key={segment.id}
              segment={segment}
              isPlaying={playingSegmentId === segment.id}
              onPlay={() => handlePlay(segment.id)}
              onPause={handlePause}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## 已知限制與未來改進

### 當前限制
1. **AlphaTab 部分小節渲染**：目前顯示完整譜面，未來可改進為只顯示選擇範圍
2. **播放範圍控制**：通過定時檢查實現，可能不夠精確
3. **多個播放器同時播放**：需要全局狀態管理

### 建議改進
1. 後端裁剪 GP 文件（只保留選擇的小節）
2. 添加段落拖曳排序
3. 支援段落內的循環播放
4. 添加速度調整（BPM）

---

## 測試檢查清單

- [ ] GP 文件上傳成功
- [ ] Cloudinary URL 正確返回
- [ ] AlphaTab 正確讀取總小節數
- [ ] 選擇小範圍後能預覽
- [ ] 保存後資料正確寫入 Firestore
- [ ] Tab 頁面正確顯示 GP 段落
- [ ] 播放控制正常
- [ ] 刪除段落後資料同步更新

---

需要我進一步整合到具體頁面嗎？或者先測試這些組件是否正常工作？
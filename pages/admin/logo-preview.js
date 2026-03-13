// 後台：歌單封面 + Logo + 文字 預覽測試
import { useState, useRef } from 'react'
import Layout from '@/components/Layout'
import { Upload, RefreshCw, Download, Type } from 'lucide-react'

// 六角星 SVG 組件
const StarLogo = ({ color = '#FFD700', size = 24 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 50 50" 
    fill={color}
    style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
  >
    <path 
      fillRule="evenodd" 
      d="M38.87,25.91l-2.07,3.59,2.02,3.41h-5.14l2.54-4.41h0l2.08-3.6h0l6.55-11.4h-11.91l2.05,3.57h3.72l-2.49,4.21-2.42-4.21h.02l-2.07-3.57h-.01L25.03,1.79l-6.14,10.68h4.22l1.82-3.14,2.45,4.16h-9.08l-13.31.02,6.08,10.57,2.08-3.6-1.98-3.41h5.09l-1.98,3.45h0l-2.64,4.58h0l-6.54,11.38h11.9l-2.05-3.55h-3.66l2.44-4.21,2.42,4.21h-.02l2.05,3.56h.01l6.74,11.7,6.15-10.68h-4.38v-.02l-1.87,3.16-2.4-4.16h22.57l-6.08-10.57-.05-.02ZM29.34,32.91h-9.03l-4.53-7.82,4.64-8.02h9.03l4.62,7.82-4.73,8.02Z"
    />
  </svg>
)

// 預設顏色選項
const COLOR_OPTIONS = [
  { name: '黃金', value: '#FFD700' },
  { name: '藍色', value: '#1fc3df' },
  { name: '橙粉', value: '#ff9b98' },
  { name: '白色', value: '#FFFFFF' },
  { name: '黑色', value: '#000000' },
  { name: '紅色', value: '#FF4444' },
  { name: '綠色', value: '#44FF88' },
  { name: '紫色', value: '#9944FF' },
]

// 字體選項
const FONT_OPTIONS = [
  { name: '系統默認', value: '-apple-system, BlinkMacSystemFont, sans-serif' },
  { name: '微軟正黑', value: '"Microsoft JhengHei", sans-serif' },
  { name: '思源黑體', value: '"Noto Sans TC", sans-serif' },
  { name: '蘋方', value: '"PingFang TC", sans-serif' },
  { name: '標楷體', value: '"DFKai-SB", serif' },
  { name: '新細明體', value: '"PMingLiU", serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
]

export default function LogoPreview() {
  const [image, setImage] = useState(null)
  const [logoColor, setLogoColor] = useState('#FFD700')
  const [logoSize, setLogoSize] = useState(28)
  const [position] = useState({ x: 8, y: 8 })
  
  // 文字設定
  const [text, setText] = useState('')
  const [textColor, setTextColor] = useState('#FFFFFF')
  const [textSize, setTextSize] = useState(14)
  const [textFont, setTextFont] = useState(FONT_OPTIONS[0].value)
  const [textBgColor, setTextBgColor] = useState('transparent')
  const [textPadding, setTextPadding] = useState(4)
  
  const fileInputRef = useRef(null)
  const canvasRef = useRef(null)

  // 處理圖片上傳
  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setImage(url)
    }
  }

  // 隨機顏色
  const randomColor = () => {
    const random = COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)]
    setLogoColor(random.value)
  }

  // 生成合成圖片
  const generateComposite = () => {
    if (!canvasRef.current || !image) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      canvas.width = 300
      canvas.height = 300
      
      // 繪製封面
      const size = Math.min(img.width, img.height)
      const sx = (img.width - size) / 2
      const sy = (img.height - size) / 2
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 300, 300)
      
      // 繪製 Logo
      const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${logoSize}" height="${logoSize}" viewBox="0 0 50 50" fill="${logoColor}"><path fill-rule="evenodd" d="M38.87,25.91l-2.07,3.59,2.02,3.41h-5.14l2.54-4.41h0l2.08-3.6h0l6.55-11.4h-11.91l2.05,3.57h3.72l-2.49,4.21-2.42-4.21h.02l-2.07-3.57h-.01L25.03,1.79l-6.14,10.68h4.22l1.82-3.14,2.45,4.16h-9.08l-13.31.02,6.08,10.57,2.08-3.6-1.98-3.41h5.09l-1.98,3.45h0l-2.64,4.58h0l-6.54,11.38h11.9l-2.05-3.55h-3.66l2.44-4.21,2.42,4.21h-.02l2.05,3.56h.01l6.74,11.7,6.15-10.68h-4.38v-.02l-1.87,3.16-2.4-4.16h22.57l-6.08-10.57-.05-.02ZM29.34,32.91h-9.03l-4.53-7.82,4.64-8.02h9.03l4.62,7.82-4.73,8.02Z"/></svg>`
      
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml' })
      const svgUrl = URL.createObjectURL(svgBlob)
      const logoImg = new Image()
      
      logoImg.onload = () => {
        ctx.drawImage(logoImg, position.x, position.y, logoSize, logoSize)
        URL.revokeObjectURL(svgUrl)
        
        // 繪製文字
        if (text) {
          ctx.font = `bold ${textSize * 2}px ${textFont}`
          ctx.textAlign = 'right'
          ctx.textBaseline = 'bottom'
          
          const textX = 300 - 16 // 右邊留 16px
          const textY = 300 - 16 // 底邊留 16px
          
          // 如果有背景色，先畫背景
          if (textBgColor !== 'transparent') {
            const metrics = ctx.measureText(text)
            const bgHeight = textSize * 2 + textPadding * 2
            ctx.fillStyle = textBgColor
            ctx.fillRect(
              textX - metrics.width - textPadding, 
              textY - bgHeight + textPadding,
              metrics.width + textPadding * 2,
              bgHeight
            )
          }
          
          // 畫文字
          ctx.fillStyle = textColor
          ctx.fillText(text, textX, textY)
        }
        
        // 下載
        const link = document.createElement('a')
        link.download = 'playlist-cover.png'
        link.href = canvas.toDataURL('image/png')
        link.click()
      }
      logoImg.src = svgUrl
    }
    img.src = image
  }

  return (
    <Layout>
      <div className="min-h-screen bg-black pb-24">
        {/* Header */}
        <div className="bg-[#121212] border-b border-neutral-800 px-6 py-4">
          <h1 className="text-2xl font-bold text-white">歌單封面設計器</h1>
          <p className="text-neutral-400 text-sm mt-1">測試 Logo 同文字喺歌單封面上嘅效果</p>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* 上傳區域 */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-neutral-700 rounded-xl p-8 text-center cursor-pointer hover:border-[#FFD700] hover:bg-[#121212] transition"
          >
            <Upload className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
            <p className="text-white font-medium">點擊上傳歌單封面</p>
            <p className="text-neutral-500 text-sm mt-1">支援 JPG、PNG、WebP</p>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {image && (
            <>
              {/* 控制面板 */}
              <div className="mt-8 grid md:grid-cols-2 gap-6">
                {/* Logo 設定 */}
                <div className="bg-[#121212] rounded-xl p-6">
                  <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                    <StarLogo color="#FFD700" size={20} />
                    Logo 設定
                  </h2>
                  
                  {/* Logo 顏色 */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-neutral-400 text-sm">顏色</label>
                      <button 
                        onClick={randomColor}
                        className="text-[#FFD700] text-sm flex items-center gap-1 hover:opacity-80"
                      >
                        <RefreshCw className="w-4 h-4" />
                        隨機
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => setLogoColor(color.value)}
                          className={`w-8 h-8 rounded-lg border-2 transition ${
                            logoColor === color.value 
                              ? 'border-white scale-110' 
                              : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Logo 大小 */}
                  <div className="mb-2">
                    <label className="text-neutral-400 text-sm block mb-2">大小: {logoSize}px</label>
                    <input 
                      type="range"
                      min="16"
                      max="48"
                      value={logoSize}
                      onChange={(e) => setLogoSize(Number(e.target.value))}
                      className="w-full accent-[#FFD700]"
                    />
                  </div>
                </div>

                {/* 文字設定 */}
                <div className="bg-[#121212] rounded-xl p-6">
                  <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                    <Type className="w-5 h-5 text-[#FFD700]" />
                    文字設定
                  </h2>
                  
                  {/* 文字內容 */}
                  <div className="mb-4">
                    <label className="text-neutral-400 text-sm block mb-2">內容</label>
                    <input
                      type="text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="輸入文字，例如：精選"
                      className="w-full bg-[#1a1a1a] text-white px-3 py-2 rounded-lg border border-neutral-700 outline-none"
                    />
                  </div>

                  {/* 字體 */}
                  <div className="mb-4">
                    <label className="text-neutral-400 text-sm block mb-2">字體</label>
                    <select
                      value={textFont}
                      onChange={(e) => setTextFont(e.target.value)}
                      className="w-full bg-[#1a1a1a] text-white px-3 py-2 rounded-lg border border-neutral-700 outline-none"
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font.value} value={font.value}>{font.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 文字大小 */}
                  <div className="mb-4">
                    <label className="text-neutral-400 text-sm block mb-2">大小: {textSize}px</label>
                    <input 
                      type="range"
                      min="10"
                      max="32"
                      value={textSize}
                      onChange={(e) => setTextSize(Number(e.target.value))}
                      className="w-full accent-[#FFD700]"
                    />
                  </div>

                  {/* 文字顏色 */}
                  <div className="mb-4">
                    <label className="text-neutral-400 text-sm block mb-2">文字顏色</label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => setTextColor(color.value)}
                          className={`w-8 h-8 rounded-lg border-2 transition ${
                            textColor === color.value 
                              ? 'border-white scale-110' 
                              : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* 背景顏色 */}
                  <div className="mb-2">
                    <label className="text-neutral-400 text-sm block mb-2">背景顏色</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setTextBgColor('transparent')}
                        className={`w-8 h-8 rounded-lg border-2 border-neutral-500 bg-[#121212] transition ${
                          textBgColor === 'transparent' ? 'ring-2 ring-white' : ''
                        }`}
                        title="透明"
                      />
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => setTextBgColor(color.value)}
                          className={`w-8 h-8 rounded-lg border-2 transition ${
                            textBgColor === color.value 
                              ? 'border-white scale-110' 
                              : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 預覽區域 */}
              <div className="mt-8">
                <h2 className="text-white font-bold mb-4">預覽效果</h2>
                
                <div className="flex flex-wrap gap-8">
                  {/* 手機版尺寸 */}
                  <div>
                    <p className="text-neutral-400 text-sm mb-2">手機版 (144x144)</p>
                    <div 
                      className="relative w-36 h-36 rounded-lg overflow-hidden bg-neutral-800"
                      style={{ 
                        backgroundImage: `url(${image})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    >
                      {/* Logo - 左上角 */}
                      <div className="absolute top-2 left-2">
                        <StarLogo color={logoColor} size={logoSize} />
                      </div>
                      
                      {/* 文字 - 右下角 */}
                      {text && (
                        <div 
                          className="absolute bottom-2 right-2 px-1"
                          style={{
                            color: textColor,
                            fontFamily: textFont,
                            fontSize: `${textSize}px`,
                            fontWeight: 'bold',
                            backgroundColor: textBgColor,
                            padding: `${textPadding}px`,
                            textShadow: textBgColor === 'transparent' ? '0 1px 3px rgba(0,0,0,0.8)' : 'none',
                            lineHeight: 1.2
                          }}
                        >
                          {text}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 桌面版尺寸 */}
                  <div>
                    <p className="text-neutral-400 text-sm mb-2">桌面版 (300x300)</p>
                    <div 
                      className="relative w-72 h-72 rounded-lg overflow-hidden bg-neutral-800"
                      style={{ 
                        backgroundImage: `url(${image})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    >
                      {/* Logo - 左上角 */}
                      <div className="absolute top-4 left-4">
                        <StarLogo color={logoColor} size={logoSize * 2} />
                      </div>
                      
                      {/* 文字 - 右下角 */}
                      {text && (
                        <div 
                          className="absolute bottom-4 right-4 px-2"
                          style={{
                            color: textColor,
                            fontFamily: textFont,
                            fontSize: `${textSize * 2}px`,
                            fontWeight: 'bold',
                            backgroundColor: textBgColor,
                            padding: `${textPadding * 2}px`,
                            textShadow: textBgColor === 'transparent' ? '0 1px 3px rgba(0,0,0,0.8)' : 'none',
                            lineHeight: 1.2
                          }}
                        >
                          {text}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 下載按鈕 */}
                <button
                  onClick={generateComposite}
                  className="mt-8 w-full bg-[#FFD700] text-black font-bold py-3 rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  下載合成後的封面
                </button>
              </div>

              {/* 隱藏 canvas */}
              <canvas ref={canvasRef} className="hidden" />
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}

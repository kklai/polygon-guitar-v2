import { useState } from 'react'
import { updateGlobalSettings } from '@/lib/tabs'
import { uploadToCloudinary, validateImageFile, formatFileSize } from '@/lib/cloudinary'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import Link from '@/components/Link'
import AdminGuard from '@/components/AdminGuard'

// Match hardcoded values used on the live site (no Firebase read on page load)
const LIVE_LOGO_URL = 'https://res.cloudinary.com/drld2cjpo/image/upload/v1771502138/artists/site_logo_1771502138235.png'
const LIVE_SITE_NAME = 'Polygon 結他譜'

function LogoSettings() {
  const { user } = useAuth()
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(LIVE_LOGO_URL)
  const [appIconPreview, setAppIconPreview] = useState(null)
  const [lastUploadedLogoUrl, setLastUploadedLogoUrl] = useState(null)
  const [lastUploadedAppIconUrl, setLastUploadedAppIconUrl] = useState(null)

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleFileSelect = async (file) => {
    if (!file) return

    const validation = validateImageFile(file)
    if (!validation.valid) {
      showMessage(validation.error, 'error')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => setPreviewUrl(reader.result)
    reader.readAsDataURL(file)

    setIsUploading(true)
    try {
      const result = await uploadToCloudinary(file, 'site-logo')
      await updateGlobalSettings({ logoUrl: result.url }, user?.uid)
      setPreviewUrl(result.url)
      setLastUploadedLogoUrl(result.url)
      showMessage(
        `Logo 上傳成功！${result.width}×${result.height} · ${formatFileSize(result.bytes)}`,
        'success'
      )
    } catch (error) {
      console.error('Upload error:', error)
      showMessage('上傳失敗：' + error.message, 'error')
      setPreviewUrl(lastUploadedLogoUrl || LIVE_LOGO_URL)
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveLogo = async () => {
    if (!confirm('確定要從資料庫移除 Logo 記錄嗎？（網站仍會顯示程式碼內的 hardcoded logo）')) return
    try {
      await updateGlobalSettings({ logoUrl: null }, user?.uid)
      setPreviewUrl(LIVE_LOGO_URL)
      setLastUploadedLogoUrl(null)
      showMessage('Logo 記錄已移除', 'success')
    } catch (error) {
      console.error('Remove error:', error)
      showMessage('移除失敗：' + error.message, 'error')
    }
  }

  const handleAppIconSelect = async (file) => {
    if (!file) return
    const validation = validateImageFile(file)
    if (!validation.valid) {
      showMessage(validation.error, 'error')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => setAppIconPreview(reader.result)
    reader.readAsDataURL(file)
    setIsUploading(true)
    try {
      const result = await uploadToCloudinary(file, 'app-icon')
      await updateGlobalSettings({ appIconUrl: result.url }, user?.uid)
      setAppIconPreview(result.url)
      setLastUploadedAppIconUrl(result.url)
      showMessage(`App Icon 上傳成功！${result.width}×${result.height}`, 'success')
    } catch (error) {
      console.error('Upload error:', error)
      showMessage('上傳失敗：' + error.message, 'error')
      setAppIconPreview(lastUploadedAppIconUrl)
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveAppIcon = async () => {
    if (!confirm('確定要從資料庫移除 App Icon 記錄嗎？')) return
    try {
      await updateGlobalSettings({ appIconUrl: null }, user?.uid)
      setAppIconPreview(null)
      setLastUploadedAppIconUrl(null)
      showMessage('App Icon 記錄已移除', 'success')
    } catch (error) {
      console.error('Remove error:', error)
      showMessage('移除失敗：' + error.message, 'error')
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">網站 Logo 設定</h1>
            <p className="text-[#B3B3B3] mt-1">上傳網站 Logo 圖片</p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
          >
            返回管理
          </Link>
        </div>

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-900/30 border border-green-700 text-green-400' 
              : 'bg-red-900/30 border border-red-700 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        {/* Logo Settings Card */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6">
          <h2 className="text-xl font-bold text-white mb-6">Logo 圖片</h2>

          {/* Preview Area */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-3">
              目前預覽（上傳後會更新）
            </label>
            <div className="bg-black rounded-lg p-8 flex items-center justify-center border border-gray-800">
              <img
                src={previewUrl}
                alt="Site Logo"
                className="max-h-32 max-w-full object-contain"
              />
            </div>
            <p className="text-gray-500 text-xs mt-2">網站實際顯示的 Logo 來自程式碼內 hardcoded 設定，見下方說明。</p>
          </div>

          {/* Upload Area */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-3">
              上傳新 Logo
            </label>
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
                isUploading 
                  ? 'border-[#FFD700] bg-[#FFD700]/5' 
                  : 'border-gray-700 hover:border-gray-500'
              }`}
            >
              {isUploading ? (
                <div className="space-y-3">
                  <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-[#FFD700]">上傳中...</p>
                </div>
              ) : (
                <>
                  <div className="text-4xl mb-3">☁️</div>
                  <p className="text-white mb-2">拖曳圖片到這裡，或點擊選擇檔案</p>
                  <p className="text-gray-500 text-sm mb-4">
                    支援 JPG、PNG、WEBP · 最大 5MB · 建議尺寸 200×50px
                  </p>
                  <label className="inline-block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileSelect(e.target.files[0])}
                      className="hidden"
                    />
                    <span className="px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition cursor-pointer">
                      選擇檔案
                    </span>
                  </label>
                </>
              )}
            </div>
          </div>

          {lastUploadedLogoUrl && (
            <div className="flex justify-end">
              <button
                onClick={handleRemoveLogo}
                className="px-4 py-2 text-red-400 border border-red-700 rounded-lg hover:bg-red-900/20 transition"
              >
                從資料庫移除 Logo 記錄
              </button>
            </div>
          )}

          {lastUploadedLogoUrl && (
            <div className="mt-4 p-4 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/30 text-[#FFD700] text-sm">
              <p className="font-medium mb-2">✓ 上傳完成。要讓網站顯示這個 Logo，請更新程式碼後重新部署：</p>
              <ul className="list-disc list-inside space-y-1 text-gray-300">
                <li><strong>components/Navbar.js</strong> — 將 <code className="bg-black/30 px-1 rounded">SITE_LOGO_URL</code> 改為：<br /><code className="block mt-1 break-all bg-black/50 p-2 rounded text-xs">{lastUploadedLogoUrl}</code></li>
                <li>儲存後執行 <code className="bg-black/30 px-1 rounded">vercel --prod</code> 或推送到 Git 觸發部署。</li>
              </ul>
            </div>
          )}
        </div>

        {/* App Icon Settings Card */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6">
          <h2 className="text-xl font-bold text-white mb-2">App Icon（手機桌面圖示）</h2>
          <p className="text-gray-400 text-sm mb-6">用戶將網站加入手機主屏幕時顯示的圖示</p>

          {/* Preview Area */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-3">
              目前 App Icon
            </label>
            <div className="flex items-center gap-6">
              <div className="bg-black rounded-lg p-4 flex items-center justify-center border border-gray-800">
                {appIconPreview ? (
                  <img 
                    src={appIconPreview} 
                    alt="App Icon"
                    className="w-24 h-24 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-24 h-24 bg-[#FFD700] rounded-lg flex items-center justify-center">
                    <span className="text-4xl font-bold text-black">P</span>
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-400">
                <p>預覽效果</p>
                <p className="text-xs mt-1">建議尺寸：512×512px</p>
                <p className="text-xs">建議格式：PNG（透明背景）</p>
              </div>
            </div>
          </div>

          {/* Upload Area */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-3">
              上傳新 App Icon
            </label>
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
                isUploading 
                  ? 'border-[#FFD700] bg-[#FFD700]/5' 
                  : 'border-gray-700 hover:border-gray-500'
              }`}
            >
              {isUploading ? (
                <div className="space-y-3">
                  <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-[#FFD700]">上傳中...</p>
                </div>
              ) : (
                <>
                  <div className="text-4xl mb-3">📱</div>
                  <p className="text-white mb-2">拖曳圖片到這裡，或點擊選擇檔案</p>
                  <p className="text-gray-500 text-sm mb-4">
                    支援 JPG、PNG、WEBP · 最大 5MB · 建議正方形 512×512px
                  </p>
                  <label className="inline-block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleAppIconSelect(e.target.files[0])}
                      className="hidden"
                    />
                    <span className="px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition cursor-pointer">
                      選擇檔案
                    </span>
                  </label>
                </>
              )}
            </div>
          </div>

          {(appIconPreview || lastUploadedAppIconUrl) && (
            <div className="flex justify-end">
              <button
                onClick={handleRemoveAppIcon}
                className="px-4 py-2 text-red-400 border border-red-700 rounded-lg hover:bg-red-900/20 transition"
              >
                從資料庫移除 App Icon 記錄
              </button>
            </div>
          )}

          {lastUploadedAppIconUrl && (
            <div className="mt-4 p-4 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/30 text-[#FFD700] text-sm">
              <p className="font-medium mb-2">✓ App Icon 已儲存。若要在 PWA 使用此圖示：</p>
              <p className="text-gray-300">請在 <strong>pages/api/manifest.json.js</strong> 的 <code className="bg-black/30 px-1 rounded">icons</code> 中加入此 URL，然後重新部署。</p>
              <code className="block mt-2 break-all bg-black/50 p-2 rounded text-xs">{lastUploadedAppIconUrl}</code>
            </div>
          )}
        </div>

        {/* Usage Info */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-bold text-white mb-4">使用說明</h3>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li>• <strong className="text-gray-300">Logo / 網站名稱</strong> 已改為 hardcoded，不會每次讀取 Firebase。上傳後請依上方黃色提示更新程式碼並重新部署。</li>
            <li>• <strong>Logo：</strong> 更新 <code className="bg-black/50 px-1 rounded">components/Navbar.js</code> 的 <code className="bg-black/50 px-1 rounded">SITE_LOGO_URL</code>、<code className="bg-black/50 px-1 rounded">SITE_NAME</code>。</li>
            <li>• <strong>App Icon / PWA 名稱：</strong> 更新 <code className="bg-black/50 px-1 rounded">pages/api/manifest.json.js</code> 的 <code className="bg-black/50 px-1 rounded">name</code>、<code className="bg-black/50 px-1 rounded">short_name</code>、<code className="bg-black/50 px-1 rounded">icons</code>。</li>
            <li>• 建議使用透明背景的 PNG 格式。</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

export default function LogoPage() {
  return (
    <AdminGuard>
      <LogoSettings />
    </AdminGuard>
  )
}

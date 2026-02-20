import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import Link from 'next/link'
import AdminGuard from '@/components/AdminGuard'
import { 
  getAllPlaylists, 
  getAutoPlaylists,
  refreshAllAutoPlaylists,
  deletePlaylist,
  updatePlaylist,
  AUTO_PLAYLIST_TYPES
} from '@/lib/playlists'
import { uploadToCloudinary } from '@/lib/cloudinary'

function PlaylistAdmin() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('auto') // 'auto' | 'manual'
  const [autoPlaylists, setAutoPlaylists] = useState([])
  const [manualPlaylists, setManualPlaylists] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadPlaylists()
  }, [])

  const loadPlaylists = async () => {
    try {
      setIsLoading(true)
      const allPlaylists = await getAllPlaylists()
      
      setAutoPlaylists(allPlaylists.filter(p => p.source === 'auto'))
      setManualPlaylists(allPlaylists.filter(p => p.source === 'manual'))
    } catch (error) {
      console.error('Error loading playlists:', error)
      showMessage('載入失敗：' + error.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }

  // 刷新自動歌單
  const handleRefreshAuto = async () => {
    setIsRefreshing(true)
    try {
      const results = await refreshAllAutoPlaylists()
      console.log('Refresh results:', results)
      
      const successCount = results.filter(r => r.action !== 'error').length
      showMessage(`✅ 成功刷新 ${successCount} 個自動歌單`)
      
      // 重新載入
      await loadPlaylists()
    } catch (error) {
      console.error('Refresh error:', error)
      showMessage('❌ 刷新失敗：' + error.message, 'error')
    } finally {
      setIsRefreshing(false)
    }
  }

  // 切換歌單啟用狀態
  const togglePlaylistActive = async (playlist) => {
    try {
      await updatePlaylist(playlist.id, {
        isActive: !playlist.isActive
      })
      
      showMessage(playlist.isActive ? '已隱藏歌單' : '已啟用歌單')
      await loadPlaylists()
    } catch (error) {
      showMessage('操作失敗：' + error.message, 'error')
    }
  }

  // 刪除手動歌單
  const handleDeleteManual = async (playlist) => {
    if (!confirm(`確定要刪除歌單「${playlist.title}」嗎？此操作不可恢復。`)) {
      return
    }
    
    try {
      await deletePlaylist(playlist.id)
      showMessage('✅ 歌單已刪除')
      await loadPlaylists()
    } catch (error) {
      showMessage('❌ 刪除失敗：' + error.message, 'error')
    }
  }

  // 上移排序
  const moveUp = async (playlist, index, list) => {
    if (index === 0) return
    
    const newList = [...list]
    const temp = newList[index]
    newList[index] = newList[index - 1]
    newList[index - 1] = temp
    
    // 更新 displayOrder
    const updates = newList.map((p, i) => ({ ...p, displayOrder: i }))
    
    try {
      const { updatePlaylistsOrder } = await import('@/lib/playlists')
      await updatePlaylistsOrder(updates)
      
      if (playlist.source === 'auto') {
        setAutoPlaylists(updates)
      } else {
        setManualPlaylists(updates)
      }
      
      showMessage('✅ 排序已更新')
    } catch (error) {
      showMessage('排序更新失敗：' + error.message, 'error')
    }
  }

  // 下移排序
  const moveDown = async (playlist, index, list) => {
    if (index === list.length - 1) return
    
    const newList = [...list]
    const temp = newList[index]
    newList[index] = newList[index + 1]
    newList[index + 1] = temp
    
    // 更新 displayOrder
    const updates = newList.map((p, i) => ({ ...p, displayOrder: i }))
    
    try {
      const { updatePlaylistsOrder } = await import('@/lib/playlists')
      await updatePlaylistsOrder(updates)
      
      if (playlist.source === 'auto') {
        setAutoPlaylists(updates)
      } else {
        setManualPlaylists(updates)
      }
      
      showMessage('✅ 排序已更新')
    } catch (error) {
      showMessage('排序更新失敗：' + error.message, 'error')
    }
  }

  // 上傳封面圖片
  const handleCoverUpload = async (playlist, file) => {
    if (!file) return
    
    setUploadingCover(playlist.id)
    try {
      // 上傳到 Cloudinary
      const imageUrl = await uploadToCloudinary(file, playlist.title, 'playlist_covers')
      
      // 更新播放列表
      await updatePlaylist(playlist.id, {
        coverImage: imageUrl,
        updatedAt: new Date().toISOString()
      })
      
      showMessage('✅ 封面上傳成功')
      await loadPlaylists()
    } catch (error) {
      console.error('Upload error:', error)
      showMessage('❌ 上傳失敗：' + error.message, 'error')
    } finally {
      setUploadingCover(null)
    }
  }

  // 格式化時間
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '從未更新'
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    const now = new Date()
    const diff = Math.floor((now - date) / 1000) // 秒
    
    if (diff < 60) return '剛剛'
    if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`
    if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`
    return date.toLocaleDateString('zh-HK')
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">歌單管理</h1>
            <p className="text-gray-500">
              管理自動數據歌單同精選手動歌單
            </p>
          </div>
          <Link
            href="/admin/artists"
            className="inline-flex items-center text-[#FFD700] hover:opacity-80 transition"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回歌手管理
          </Link>
        </div>

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-lg ${
            message.type === 'error' 
              ? 'bg-red-900/30 border border-red-700 text-red-400' 
              : 'bg-green-900/30 border border-green-700 text-green-400'
          }`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab('auto')}
            className={`px-6 py-3 font-medium transition ${
              activeTab === 'auto'
                ? 'text-[#FFD700] border-b-2 border-[#FFD700]'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            自動歌單（數據驅動）
            <span className="ml-2 text-xs bg-gray-800 px-2 py-0.5 rounded-full">
              {autoPlaylists.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-6 py-3 font-medium transition ${
              activeTab === 'manual'
                ? 'text-[#FFD700] border-b-2 border-[#FFD700]'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            精選手動（人工策劃）
            <span className="ml-2 text-xs bg-gray-800 px-2 py-0.5 rounded-full">
              {manualPlaylists.length}
            </span>
          </button>
        </div>

        {/* Auto Playlists Tab */}
        {activeTab === 'auto' && (
          <div className="space-y-6">
            {/* Refresh Button */}
            <div className="flex items-center justify-between p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
              <div>
                <h3 className="text-blue-400 font-medium">自動歌單數據刷新</h3>
                <p className="text-blue-200/70 text-sm mt-1">
                  系統會根據最新數據重新統計並更新歌單內容
                </p>
              </div>
              <button
                onClick={handleRefreshAuto}
                disabled={isRefreshing}
                className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
              >
                {isRefreshing ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    刷新中...
                  </span>
                ) : (
                  '立即刷新數據'
                )}
              </button>
            </div>

            {/* Auto Playlist Cards */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-32 bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {autoPlaylists.map((playlist, index) => (
                  <div
                    key={playlist.id}
                    className="p-4 bg-[#121212] rounded-lg border border-gray-800 hover:border-gray-700 transition"
                  >
                    <div className="flex items-start gap-4">
                      {/* Cover */}
                      <div className="relative w-20 h-20 rounded-lg bg-gray-800 overflow-hidden flex-shrink-0 group">
                        {playlist.coverImage ? (
                          <img
                            src={playlist.coverImage}
                            alt={playlist.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            📊
                          </div>
                        )}
                        
                        {/* Upload Overlay */}
                        <label className={`absolute inset-0 flex items-center justify-center bg-black/60 cursor-pointer transition ${playlist.coverImage ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                          {uploadingCover === playlist.id ? (
                            <svg className="w-6 h-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                          ) : (
                            <>
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-xs text-white ml-1">上傳</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingCover === playlist.id}
                            onChange={(e) => {
                              const file = e.target.files[0]
                              if (file) handleCoverUpload(playlist, file)
                            }}
                          />
                        </label>
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-medium truncate">{playlist.title}</h3>
                          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                            自動
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{playlist.description}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {playlist.songIds?.length || 0} 首歌曲
                        </p>
                        <p className="text-xs text-gray-700 mt-1">
                          更新於 {formatTimeAgo(playlist.lastUpdated)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => moveUp(playlist, index, autoPlaylists)}
                          disabled={index === 0}
                          className="p-2 text-gray-500 hover:text-white disabled:opacity-30 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveDown(playlist, index, autoPlaylists)}
                          disabled={index === autoPlaylists.length - 1}
                          className="p-2 text-gray-500 hover:text-white disabled:opacity-30 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className="text-sm text-gray-500">
                            {playlist.isActive ? '顯示' : '隱藏'}
                          </span>
                          <button
                            onClick={() => togglePlaylistActive(playlist)}
                            className={`w-10 h-5 rounded-full transition relative ${
                              playlist.isActive ? 'bg-[#FFD700]' : 'bg-gray-700'
                            }`}
                          >
                            <span className={`absolute top-1 w-3 h-3 rounded-full bg-white transition ${
                              playlist.isActive ? 'left-6' : 'left-1'
                            }`} />
                          </button>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Missing Auto Playlists */}
            {!isLoading && autoPlaylists.length < 4 && (
              <div className="p-6 bg-yellow-900/20 border border-yellow-800 rounded-lg text-center">
                <p className="text-yellow-400 mb-4">
                  缺少 {4 - autoPlaylists.length} 個自動歌單
                </p>
                <button
                  onClick={handleRefreshAuto}
                  disabled={isRefreshing}
                  className="px-6 py-2 bg-yellow-700 text-white rounded-lg hover:bg-yellow-600 transition disabled:opacity-50"
                >
                  {isRefreshing ? '創建中...' : '創建所有自動歌單'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Manual Playlists Tab */}
        {activeTab === 'manual' && (
          <div className="space-y-6">
            {/* Add Button */}
            <div className="flex justify-end">
              <Link
                href="/admin/playlists/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                新增精選歌單
              </Link>
            </div>

            {/* Manual Playlist Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-48 bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : manualPlaylists.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {manualPlaylists.map((playlist, index) => (
                  <div
                    key={playlist.id}
                    className="bg-[#121212] rounded-lg border border-gray-800 overflow-hidden hover:border-[#FFD700] transition group"
                  >
                    {/* Cover */}
                    <div className="relative aspect-square bg-gray-800">
                      {playlist.coverImage ? (
                        <img
                          src={playlist.coverImage}
                          alt={playlist.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-6xl">
                          ✨
                        </div>
                      )}
                      
                      {/* Status Badge */}
                      <div className="absolute top-2 right-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          playlist.isActive 
                            ? 'bg-green-900/80 text-green-400' 
                            : 'bg-gray-900/80 text-gray-400'
                        }`}>
                          {playlist.isActive ? '顯示中' : '隱藏'}
                        </span>
                      </div>
                      
                      {/* Type Badge */}
                      <div className="absolute top-2 left-2">
                        <span className="text-xs bg-[#FFD700] text-black px-2 py-1 rounded font-medium">
                          {playlist.manualType === 'artist' ? '歌手' :
                           playlist.manualType === 'theme' ? '主題' :
                           playlist.manualType === 'series' ? '系列' :
                           playlist.manualType === 'mood' ? '場景' : '精選'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Info */}
                    <div className="p-4">
                      <h3 className="text-white font-medium truncate group-hover:text-[#FFD700] transition">
                        {playlist.title}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{playlist.description}</p>
                      <p className="text-xs text-gray-600 mt-2">
                        {playlist.songIds?.length || 0} 首 • By {playlist.curatedBy || 'Polygon'}
                      </p>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center justify-between px-4 pb-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveUp(playlist, index, manualPlaylists)}
                          disabled={index === 0}
                          className="p-2 text-gray-500 hover:text-white disabled:opacity-30 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveDown(playlist, index, manualPlaylists)}
                          disabled={index === manualPlaylists.length - 1}
                          className="p-2 text-gray-500 hover:text-white disabled:opacity-30 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/playlists/edit/${playlist.id}`}
                          className="p-2 text-gray-500 hover:text-[#FFD700] transition"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleDeleteManual(playlist)}
                          className="p-2 text-gray-500 hover:text-red-500 transition"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-[#121212] rounded-xl border border-gray-800">
                <span className="text-6xl block mb-4">✨</span>
                <h3 className="text-xl text-white mb-2">暫時冇精選歌單</h3>
                <p className="text-gray-500 mb-6">建立你的第一個精選歌單</p>
                <Link
                  href="/admin/playlists/new"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  新增精選歌單
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

export default function PlaylistAdminPage() {
  return (
    <AdminGuard>
      <PlaylistAdmin />
    </AdminGuard>
  )
}

import { useState } from 'react'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { createTab } from '@/lib/tabs'
import { useAuth } from '@/contexts/AuthContext'

function ImportTabsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('single') // single | batch
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [results, setResults] = useState([])
  
  // 單首輸入表單
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    composer: '',
    lyricist: '',
    originalKey: 'C',
    content: '',
    youtubeUrl: ''
  })
  
  // 批量輸入（CSV 格式）
  const [batchData, setBatchData] = useState('')

  const handleSingleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title || !formData.artist || !formData.content) {
      alert('請填寫歌名、歌手和譜內容')
      return
    }
    
    setIsSubmitting(true)
    try {
      const newTab = await createTab(formData, user.uid)
      setResults(prev => [{
        type: 'success',
        title: formData.title,
        artist: formData.artist,
        id: newTab.id,
        message: '成功創建'
      }, ...prev])
      
      // 清空表單
      setFormData({
        title: '',
        artist: '',
        composer: '',
        lyricist: '',
        originalKey: 'C',
        content: '',
        youtubeUrl: ''
      })
    } catch (error) {
      setResults(prev => [{
        type: 'error',
        title: formData.title,
        artist: formData.artist,
        message: error.message
      }, ...prev])
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBatchSubmit = async () => {
    if (!batchData.trim()) {
      alert('請貼上 CSV 數據')
      return
    }
    
    setIsSubmitting(true)
    const lines = batchData.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim())
    const newResults = []
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      const data = {}
      headers.forEach((h, idx) => {
        data[h] = values[idx] || ''
      })
      
      try {
        if (data.title && data.artist && data.content) {
          const newTab = await createTab({
            ...data,
            originalKey: data.key || 'C'
          }, user.uid)
          newResults.push({
            type: 'success',
            title: data.title,
            artist: data.artist,
            id: newTab.id,
            message: '成功創建'
          })
        } else {
          newResults.push({
            type: 'error',
            title: data.title || `第${i}行`,
            artist: data.artist || '',
            message: '缺少必要欄位'
          })
        }
      } catch (error) {
        newResults.push({
          type: 'error',
          title: data.title || `第${i}行`,
          artist: data.artist || '',
          message: error.message
        })
      }
    }
    
    setResults(prev => [...newResults, ...prev])
    setIsSubmitting(false)
    setBatchData('')
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">🎸 導入結他譜</h1>
        
        {/* Tab 切換 */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('single')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'single' 
                ? 'bg-[#FFD700] text-black' 
                : 'bg-gray-800 text-white hover:bg-gray-700'
            }`}
          >
            逐首添加
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'batch' 
                ? 'bg-[#FFD700] text-black' 
                : 'bg-gray-800 text-white hover:bg-gray-700'
            }`}
          >
            批量導入 (CSV)
          </button>
        </div>

        {/* 單首輸入 */}
        {activeTab === 'single' && (
          <form onSubmit={handleSingleSubmit} className="bg-[#121212] rounded-xl p-6 border border-gray-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-1">歌名 *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white"
                  placeholder="例如：海闊天空"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1">歌手 *</label>
                <input
                  type="text"
                  value={formData.artist}
                  onChange={(e) => setFormData({...formData, artist: e.target.value})}
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white"
                  placeholder="例如：Beyond"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1">作曲</label>
                <input
                  type="text"
                  value={formData.composer}
                  onChange={(e) => setFormData({...formData, composer: e.target.value})}
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white"
                  placeholder="例如：黃家駒"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1">填詞</label>
                <input
                  type="text"
                  value={formData.lyricist}
                  onChange={(e) => setFormData({...formData, lyricist: e.target.value})}
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white"
                  placeholder="例如：黃家駒"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1">原調</label>
                <select
                  value={formData.originalKey}
                  onChange={(e) => setFormData({...formData, originalKey: e.target.value})}
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white"
                >
                  {['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'].map(key => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1">YouTube 連結</label>
                <input
                  type="url"
                  value={formData.youtubeUrl}
                  onChange={(e) => setFormData({...formData, youtubeUrl: e.target.value})}
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white"
                  placeholder="https://youtube.com/..."
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white mb-1">譜內容 *</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                rows={15}
                className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white font-mono text-sm"
                placeholder="在這裡貼上結他譜內容..."
              />
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#FFD700] text-black rounded-lg font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              {isSubmitting ? '導入中...' : '導入這首譜'}
            </button>
          </form>
        )}

        {/* 批量輸入 */}
        {activeTab === 'batch' && (
          <div className="bg-[#121212] rounded-xl p-6 border border-gray-800 space-y-4">
            <div className="bg-gray-900 p-4 rounded-lg text-sm text-gray-400">
              <p className="mb-2"><strong className="text-white">CSV 格式說明：</strong></p>
              <p>第一行：欄位名稱（必需：title, artist, content；可選：composer, lyricist, key, youtubeUrl）</p>
              <p>第二行起：每首譜的資料</p>
              <p className="mt-2 text-[#FFD700]">範例：</p>
              <pre className="bg-black p-2 rounded mt-1 font-mono text-xs">
{`title,artist,composer,lyricist,key,content
海闊天空,Beyond,黃家駒,黃家駒,F,|F| |Dm| |Gm| |Bb|\n(今天我) 寒夜裡看雪飄過
喜歡你,Beyond,黃家駒,黃家駒,C,|C| |G| |Am| |F|\n(細雨帶) 風輕輕吹過`}
              </pre>
            </div>
            
            <textarea
              value={batchData}
              onChange={(e) => setBatchData(e.target.value)}
              rows={15}
              className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg text-white font-mono text-sm"
              placeholder="貼上 CSV 數據..."
            />
            
            <button
              onClick={handleBatchSubmit}
              disabled={isSubmitting}
              className="w-full py-3 bg-[#FFD700] text-black rounded-lg font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              {isSubmitting ? '批量導入中...' : '開始批量導入'}
            </button>
          </div>
        )}

        {/* 結果顯示 */}
        {results.length > 0 && (
          <div className="mt-6 bg-[#121212] rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-bold text-white mb-4">導入結果</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.map((result, i) => (
                <div 
                  key={i}
                  className={`p-3 rounded-lg ${
                    result.type === 'success' 
                      ? 'bg-green-900/20 border border-green-800' 
                      : 'bg-red-900/20 border border-red-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">
                      {result.artist} - {result.title}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      result.type === 'success' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-red-600 text-white'
                    }`}>
                      {result.type === 'success' ? '成功' : '失敗'}
                    </span>
                  </div>
                  <p className={`text-sm mt-1 ${
                    result.type === 'success' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {result.message}
                    {result.id && (
                      <a 
                        href={`/tabs/${result.id}`} 
                        target="_blank"
                        className="ml-2 text-[#FFD700] hover:underline"
                      >
                        查看譜
                      </a>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default function ImportTabsPageWrapper() {
  return (
    <AdminGuard>
      <ImportTabsPage />
    </AdminGuard>
  )
}

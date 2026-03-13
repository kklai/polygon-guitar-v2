import { useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { navIcons as defaultNavIcons } from '@/lib/navIcons'

const CLOUD_NAME = 'drld2cjpo'
const UPLOAD_PRESET = 'artist_photos'

const NAV_ITEMS = [
  { id: 'home', label: '首頁' },
  { id: 'search', label: '搜尋' },
  { id: 'artists', label: '歌手' },
  { id: 'library', label: '收藏' },
  { id: 'hand', label: '求譜' },
  { id: 'upload', label: '上傳' },
]

async function uploadImage(file, itemId) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('folder', 'nav-icons')
  formData.append('public_id', `nav_${itemId}_${Date.now()}`)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || '上傳失敗')
  }

  const data = await res.json()
  return data.secure_url
}

function toConfigSnippet(icons) {
  const lines = Object.entries(icons)
    .map(([k, v]) => `  ${k}: ${v ? `'${v}'` : "''"}`)
  return `export const navIcons = {\n${lines.join(',\n')}\n}`
}

function NavIconsAdmin() {
  const router = useRouter()
  const [icons, setIcons] = useState({ ...defaultNavIcons })
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')
  const [copySnippet, setCopySnippet] = useState(null)
  const fileRefs = useRef({})

  const flash = (text) => {
    setMsg(text)
    setTimeout(() => setMsg(''), 3000)
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => flash('已複製到剪貼簿')).catch(() => flash('複製失敗'))
  }

  const handleUpload = async (itemId, file) => {
    if (!file || !file.type.startsWith('image/')) return alert('請上傳圖片檔案')
    if (file.size > 500 * 1024) return alert('圖片不能超過 500KB')

    setBusy(itemId)
    setCopySnippet(null)
    try {
      const url = await uploadImage(file, itemId)
      if (!url) throw new Error('無效 URL')

      const next = { ...icons, [itemId]: url }
      setIcons(next)
      const snippet = toConfigSnippet(next)
      setCopySnippet(snippet)
      flash(`✅ 上傳成功。請複製下方程式碼到 lib/navIcons.js 並部署。`)
    } catch (e) {
      console.error(e)
      alert('上傳失敗：' + e.message)
    }
    setBusy(null)
  }

  const handleClear = (itemId) => {
    if (!confirm('確定清除此圖標？')) return
    const next = { ...icons, [itemId]: '' }
    setIcons(next)
    setCopySnippet(toConfigSnippet(next))
    flash(`已清除 ${NAV_ITEMS.find(i => i.id === itemId)?.label}。請更新 lib/navIcons.js 並部署。`)
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">底部導航圖標設置</h1>
            <p className="text-neutral-500 mt-1">圖標存於程式碼 <code className="text-[#FFD700]">lib/navIcons.js</code>。上傳後複製程式碼到該檔案並部署即可生效。</p>
          </div>
          <button onClick={() => router.push('/admin')} className="text-neutral-400 hover:text-white">
            返回後台
          </button>
        </div>

        {copySnippet && (
          <div className="mb-6 p-4 bg-[#1a1a1a] rounded-lg border border-neutral-700">
            <p className="text-neutral-400 text-sm mb-2">複製到 lib/navIcons.js：</p>
            <pre className="text-xs text-neutral-300 overflow-x-auto whitespace-pre-wrap break-all mb-2">{copySnippet}</pre>
            <button
              type="button"
              onClick={() => copyToClipboard(copySnippet)}
              className="px-3 py-1.5 text-sm rounded-lg bg-[#FFD700] text-black font-medium hover:opacity-90"
            >
              複製
            </button>
          </div>
        )}

        {msg && (
          <div className="mb-6 p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-400 text-sm">
            {msg}
          </div>
        )}

        <div className="space-y-3">
          {NAV_ITEMS.map(item => {
            const url = icons[item.id]
            const isBusy = busy === item.id
            return (
              <div key={item.id} className="bg-[#121212] rounded-lg p-4 border border-neutral-800 flex items-center gap-4">
                <div className="w-14 h-14 bg-[#FFD700] rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {url ? (
                    <img src={url} alt={item.label} className="w-9 h-9 object-contain" />
                  ) : (
                    <span className="text-black text-xl font-bold">{item.label[0]}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium">{item.label}</h3>
                  <p className="text-neutral-500 text-xs truncate">
                    {url ? url : '未設置'}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    ref={el => fileRefs.current[item.id] = el}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      handleUpload(item.id, e.target.files[0])
                      e.target.value = ''
                    }}
                  />
                  <button
                    onClick={() => fileRefs.current[item.id]?.click()}
                    disabled={isBusy}
                    className="px-3 py-1.5 text-sm rounded-lg bg-[#FFD700] text-black font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {isBusy ? '上傳中...' : '上傳'}
                  </button>
                  {url && (
                    <button
                      onClick={() => handleClear(item.id)}
                      disabled={isBusy}
                      className="px-3 py-1.5 text-sm rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-50"
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Layout>
  )
}

export default function NavIconsPage() {
  return (
    <AdminGuard>
      <NavIconsAdmin />
    </AdminGuard>
  )
}

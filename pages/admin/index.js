import Head from 'next/head'
import Link from 'next/link'

export default function AdminIndex() {
  const adminLinks = [
    {
      href: '/admin/playlists',
      title: '歌單管理',
      description: '管理精選歌單、編輯歌單內容',
      icon: '🎵',
      color: 'bg-purple-600'
    },
    {
      href: '/admin/artists-v2',
      title: '歌手管理 V2',
      description: '統一管理歌手資料、分類和照片',
      icon: '🎤',
      color: 'bg-blue-600'
    },
    {
      href: '/admin/category-images',
      title: '分類封面管理',
      description: '自動更新首頁男歌手/女歌手/組合封面',
      icon: '🖼️',
      color: 'bg-green-600'
    },
    {
      href: '/admin/hero-photos',
      title: 'Hero 圖片管理',
      description: '管理首頁輪播圖片',
      icon: '📸',
      color: 'bg-pink-600'
    },
    {
      href: '/admin/import-tabs',
      title: '批量導入譜',
      description: '從 Blogger 導入結他譜',
      icon: '📥',
      color: 'bg-orange-600'
    },
    {
      href: '/admin/migrated-tabs',
      title: '遷移樂譜管理',
      description: '管理已遷移的樂譜，修復顯示問題',
      icon: '🔧',
      color: 'bg-amber-600'
    },
    {
      href: '/admin/merge-artists',
      title: '合併重複歌手',
      description: '檢測並合併中英文名的重複歌手檔案',
      icon: '🔀',
      color: 'bg-rose-600'
    },
    {
      href: '/admin/analyze',
      title: '數據分析',
      description: '分析結他譜數據、和弦統計',
      icon: '📊',
      color: 'bg-indigo-600'
    },
    {
      href: '/admin/migrate',
      title: '數據遷移',
      description: '執行數據庫遷移和修復',
      icon: '🔄',
      color: 'bg-teal-600'
    },
    {
      href: '/admin/logo',
      title: 'Logo 管理',
      description: '管理網站 Logo 和圖標',
      icon: '🎨',
      color: 'bg-red-600'
    }
  ]

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6">
      <Head>
        <title>管理員 | Polygon Guitar</title>
      </Head>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">管理員中心</h1>
          <Link
            href="/"
            className="text-slate-400 hover:text-white transition-colors"
          >
            ← 返回首頁
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group bg-slate-800 rounded-lg p-6 hover:bg-slate-700 transition-colors"
            >
              <div
                className={`w-12 h-12 ${link.color} rounded-lg flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}
              >
                {link.icon}
              </div>
              <h2 className="text-xl font-semibold mb-2">{link.title}</h2>
              <p className="text-slate-400 text-sm">{link.description}</p>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>Polygon Guitar v2 管理系統</p>
        </div>
      </div>
    </div>
  )
}

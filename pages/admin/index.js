import Head from 'next/head'
import Link from '@/components/Link'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ROLES, ROLE_LABELS, ROLE_COLORS, hasPermission } from '@/lib/roles'

export default function AdminIndex() {
  const { user, userRole } = useAuth()

  // 所有可用鏈接
  const allAdminLinks = [
    {
      href: '/admin/site-map',
      title: '🗺️ 網站地圖 & 說明書',
      description: '查看完整網站結構、術語表、使用指南（給非技術人員）',
      icon: '🗺️',
      color: 'bg-[#FFD700] text-black',
      roles: [ROLES.SUPER_ADMIN, ROLES.SCORE_CHECKER, ROLES.ART_DIRECTOR, ROLES.PLAYLIST_MAKER]
    },
    {
      href: '/admin/tech-stack',
      title: '🏗️ 技術架構說明書',
      description: 'Firebase/Vercel/Cloudinary/API 技術詳情、成本分析、擴展方案（給技術 Admin）',
      icon: '🏗️',
      color: 'bg-blue-500 text-white',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/profile-bio-settings',
      title: '📝 個人簡介設定',
      description: '修改生成用戶簡介的問題和句子，讓簡介更自然不生硬',
      icon: '📝',
      color: 'bg-pink-500 text-white',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/playlists',
      title: '歌單管理',
      description: '管理精選歌單、編輯歌單內容',
      icon: '',
      color: 'bg-purple-600',
      roles: [ROLES.SUPER_ADMIN, ROLES.PLAYLIST_MAKER]
    },
    {
      href: '/admin/playlist-covers',
      title: '歌單封面生成器',
      description: '用歌單入面嘅歌生成封面（單圖或 2x2 拼貼）',
      icon: '🖼️',
      color: 'bg-purple-500',
      roles: [ROLES.SUPER_ADMIN, ROLES.PLAYLIST_MAKER, ROLES.ART_DIRECTOR]
    },
    {
      href: '/admin/artists-v2',
      title: '歌手管理 V2',
      description: '統一管理歌手資料、分類和照片',
      icon: '',
      color: 'bg-blue-600',
      roles: [ROLES.SUPER_ADMIN, ROLES.SCORE_CHECKER, ROLES.ART_DIRECTOR]
    },
    {
      href: '/admin/artists-region',
      title: '歌手地區設定',
      description: '批次設定歌手所屬地區（香港、台灣、中國、外國）',
      icon: '',
      color: 'bg-cyan-600',
      roles: [ROLES.SUPER_ADMIN, ROLES.SCORE_CHECKER]
    },
    {
      href: '/admin/artists-sort',
      title: '歌手排序',
      description: '設定歌手 Tier 1/2/3/4/5，控制顯示次序',
      icon: '',
      color: 'bg-lime-600',
      roles: [ROLES.SUPER_ADMIN, ROLES.SCORE_CHECKER]
    },
    {
      href: '/admin/categorize-artists',
      title: '歌手分類整理',
      description: '快速將「其他」類別歌手分類到男/女/組合',
      icon: '',
      color: 'bg-teal-500',
      roles: [ROLES.SUPER_ADMIN, ROLES.SCORE_CHECKER]
    },
    {
      href: '/admin/category-images',
      title: '分類封面管理',
      description: '上傳圖片或選擇歌手作為首頁分類封面',
      icon: '',
      color: 'bg-green-600',
      roles: [ROLES.SUPER_ADMIN, ROLES.ART_DIRECTOR]
    },
    {
      href: '/admin/hero-photos',
      title: 'Hero 圖片管理',
      description: '管理首頁輪播圖片',
      icon: '',
      color: 'bg-pink-600',
      roles: [ROLES.SUPER_ADMIN, ROLES.ART_DIRECTOR]
    },
    {
      href: '/admin/quick-import',
      title: '⚡ 快速導入譜',
      description: '貼上 Chord Log 文字，自動解析並搜尋 YouTube/Spotify，一鍵跳轉上傳',
      icon: '⚡',
      color: 'bg-[#FFD700] text-black',
      roles: [ROLES.SUPER_ADMIN, ROLES.SCORE_CHECKER]
    },
    {
      href: '/admin/daily-uploads',
      title: '📊 每日上傳監控',
      description: '查看每日邊個用戶上傳咗乜譜，Google 帳戶、筆名、歌曲一覽',
      icon: '📊',
      color: 'bg-green-600 text-white',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/artist-report',
      title: '📈 歌手報表',
      description: 'Excel 式報表：每個歌手有幾多首歌、年份分佈、冇年份嘅歌',
      icon: '📈',
      color: 'bg-blue-600 text-white',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/import-tabs',
      title: '批量導入譜',
      description: '從 Blogger 導入結他譜',
      icon: '',
      color: 'bg-orange-600',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/migrated-tabs',
      title: '遷移樂譜管理',
      description: '管理已遷移的樂譜，修復顯示問題',
      icon: '',
      color: 'bg-amber-600',
      roles: [ROLES.SUPER_ADMIN, ROLES.SCORE_CHECKER]
    },
    {
      href: '/admin/merge-artists',
      title: '合併重複歌手',
      description: '檢測並合併中英文名的重複歌手檔案',
      icon: '',
      color: 'bg-rose-600',
      roles: [ROLES.SUPER_ADMIN, ROLES.SCORE_CHECKER]
    },
    {
      href: '/admin/analyze',
      title: '數據分析',
      description: '分析結他譜數據、和弦統計',
      icon: '',
      color: 'bg-indigo-600',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/migrate',
      title: '數據遷移',
      description: '執行數據庫遷移和修復',
      icon: '',
      color: 'bg-teal-600',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/logo',
      title: 'Logo & 圖標管理',
      description: '管理網站 Logo、App Icon 和圖標',
      icon: '🎨',
      color: 'bg-red-600',
      roles: [ROLES.SUPER_ADMIN, ROLES.ART_DIRECTOR]
    },
    {
      href: '/admin/bulk-youtube',
      title: '批量添加 YouTube',
      description: '自動為舊譜添加 YouTube 連結（3000+份）',
      icon: '',
      color: 'bg-red-700',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/spotify-manager',
      title: 'Spotify 管理',
      description: '管理歌手相片、歌曲資訊、批量更新 Spotify 資料',
      icon: '',
      color: 'bg-green-600',
      roles: [ROLES.SUPER_ADMIN, ROLES.ART_DIRECTOR]
    },
    {
      href: '/admin/update-track-info',
      title: '批量更新歌曲資訊',
      description: '從 Spotify 獲取 BPM、作曲、填詞、專輯封面等',
      icon: '',
      color: 'bg-emerald-600',
      roles: [ROLES.SUPER_ADMIN, ROLES.SCORE_CHECKER]
    },
    {
      href: '/admin/home-settings',
      title: '首頁設置',
      description: '管理熱門歌手、熱門歌曲、排序方式',
      icon: '',
      color: 'bg-orange-500',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/data-review',
      title: '數據審查',
      description: '找出可疑歌手/歌曲，批量刪除或標記',
      icon: '',
      color: 'bg-slate-600',
      roles: [ROLES.SUPER_ADMIN, ROLES.SCORE_CHECKER]
    },
    {
      href: '/admin/fix-artist',
      title: '歌手名修復',
      description: '快速修復錯誤的歌手名稱',
      icon: '',
      color: 'bg-violet-600',
      roles: [ROLES.SUPER_ADMIN, ROLES.SCORE_CHECKER]
    },
    {
      href: '/admin/analytics',
      title: '瀏覽統計',
      description: '查看全站頁面瀏覽統計',
      icon: '',
      color: 'bg-cyan-600',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/role-settings',
      title: '角色權限設置',
      description: '設置用戶角色權限（僅限超級管理員）',
      icon: '',
      color: 'bg-red-500',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/nav-icons',
      title: '導航圖標設置',
      description: '自定義底部導航欄圖標',
      icon: '',
      color: 'bg-neutral-600',
      roles: [ROLES.SUPER_ADMIN, ROLES.ART_DIRECTOR]
    },
    {
      href: '/admin/test-rating',
      title: '評分功能測試',
      description: '測試評分系統 API',
      icon: '',
      color: 'bg-orange-600',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/admins',
      title: '管理員設定',
      description: '設定用戶為管理員，管理權限',
      icon: '👥',
      color: 'bg-red-700 text-white',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/artists',
      title: '歌手管理（舊版）',
      description: '舊版歌手管理介面',
      icon: '',
      color: 'bg-neutral-600',
      roles: [ROLES.SUPER_ADMIN, ROLES.SCORE_CHECKER]
    },
    {
      href: '/admin/bulk-musicbrainz-year',
      title: '批量更新年份（MusicBrainz）',
      description: '從 MusicBrainz 數據庫批量獲取歌曲年份',
      icon: '',
      color: 'bg-indigo-500',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/bulk-update-year',
      title: '批量更新年份',
      description: '批量更新多首歌曲嘅年份資訊',
      icon: '',
      color: 'bg-indigo-600',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/logo-preview',
      title: 'Logo 預覽',
      description: '預覽 Logo 在不同背景下嘅效果',
      icon: '',
      color: 'bg-pink-500',
      roles: [ROLES.SUPER_ADMIN, ROLES.ART_DIRECTOR]
    },
    {
      href: '/admin/spotify-debug',
      title: 'Spotify 除錯',
      description: '檢查 Spotify API 連接狀態同環境變數',
      icon: '',
      color: 'bg-green-700',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/test-gp-display',
      title: 'GP 顯示測試',
      description: '測試 Guitar Pro 譜面顯示效果',
      icon: '',
      color: 'bg-purple-500',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/test-gp-player',
      title: 'GP 播放器測試',
      description: '測試 Guitar Pro 播放器功能',
      icon: '',
      color: 'bg-purple-600',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/test-gp-upload',
      title: 'GP 上傳測試',
      description: '測試 Guitar Pro 檔案上傳功能',
      icon: '',
      color: 'bg-purple-700',
      roles: [ROLES.SUPER_ADMIN]
    },
    {
      href: '/admin/update-spotify-photos',
      title: '更新 Spotify 相片',
      description: '批量更新歌手嘅 Spotify 專輯封面同相片',
      icon: '',
      color: 'bg-green-500',
      roles: [ROLES.SUPER_ADMIN, ROLES.ART_DIRECTOR]
    }
  ]

  // 根據用戶角色過濾鏈接
  const visibleLinks = allAdminLinks.filter(link => {
    if (user?.email === 'kermit.tam@gmail.com') return true
    return link.roles.includes(userRole)
  })

  // 獲取用戶角色顯示
  const getRoleDisplay = () => {
    if (user?.email === 'kermit.tam@gmail.com') {
      return { label: '超級管理員', color: 'bg-red-500' }
    }
    return { 
      label: ROLE_LABELS[userRole] || '管理員', 
      color: ROLE_COLORS[userRole] || 'bg-neutral-500' 
    }
  }

  const roleDisplay = getRoleDisplay()

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6">
      <Head>
        <title>管理員 | Polygon Guitar</title>
      </Head>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">管理員中心</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 ${roleDisplay.color} text-white text-xs font-bold rounded`}>
                {roleDisplay.label}
              </span>
              <span className="text-slate-400 text-sm">{user?.email}</span>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center text-slate-400 hover:text-white transition-colors"
            aria-label="返回首頁"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>

        {/* Role Info */}
        {userRole === ROLES.ART_DIRECTOR && (
          <div className="mb-6 p-4 bg-pink-900/20 border border-pink-700 rounded-lg">
            <p className="text-pink-400 text-sm">
              <span className="font-medium">Art Director</span> - 你可以管理 Logo、相片、封面等視覺內容
            </p>
          </div>
        )}
        {userRole === ROLES.SCORE_CHECKER && (
          <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
            <p className="text-blue-400 text-sm">
              <span className="font-medium">Score Checker</span> - 你可以編輯樂譜內容和歌手資料
            </p>
          </div>
        )}
        {userRole === ROLES.PLAYLIST_MAKER && (
          <div className="mb-6 p-4 bg-green-900/20 border border-green-700 rounded-lg">
            <p className="text-green-400 text-sm">
              <span className="font-medium">Playlist Maker</span> - 你可以創建和管理精選歌單
            </p>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {visibleLinks.map((link) => (
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

        {/* Empty State */}
        {visibleLinks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400">暫時沒有可用的管理功能</p>
            <p className="text-slate-500 text-sm mt-2">請聯繫超級管理員獲取權限</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>Polygon Guitar v2 管理系統</p>
        </div>
      </div>
    </div>
  )
}

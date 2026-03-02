// Polygon Guitar - 網站地圖 & 使用說明書
// 給非技術人員參考的完整網站結構指南

import Layout from '@/components/Layout'
import { useState } from 'react'
import { useRouter } from 'next/router'

export default function SiteMap() {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState('overview')

  // 導航項目
  const navItems = [
    { id: 'overview', label: '📋 網站概覽', icon: '📋' },
    { id: 'users', label: '👤 用戶相關', icon: '👤' },
    { id: 'artists', label: '🎤 歌手管理', icon: '🎤' },
    { id: 'tabs', label: '🎸 樂譜系統', icon: '🎸' },
    { id: 'library', label: '📚 收藏功能', icon: '📚' },
    { id: 'social', label: '💬 社交功能', icon: '💬' },
    { id: 'admin', label: '⚙️ 後台管理', icon: '⚙️' },
    { id: 'glossary', label: '📖 術語表', icon: '📖' },
  ]

  return (
    <Layout>
      <div className="min-h-screen bg-black pb-24">
        {/* Header */}
        <div className="bg-[#121212] border-b border-gray-800 px-4 py-4">
          <h1 className="text-2xl font-bold text-white">🗺️ 網站地圖 & 說明書</h1>
          <p className="text-gray-400 text-sm mt-1">給管理者的完整網站結構指南</p>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* 快速導航 */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`p-3 rounded-lg text-sm font-medium transition ${
                  activeSection === item.id
                    ? 'bg-[#FFD700] text-black'
                    : 'bg-[#1a1a1a] text-gray-300 hover:bg-[#282828]'
                }`}
              >
                <span className="block text-xl mb-1">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* 內容區域 */}
          <div className="space-y-6">
            {activeSection === 'overview' && <OverviewSection />}
            {activeSection === 'users' && <UsersSection />}
            {activeSection === 'artists' && <ArtistsSection />}
            {activeSection === 'tabs' && <TabsSection />}
            {activeSection === 'library' && <LibrarySection />}
            {activeSection === 'social' && <SocialSection />}
            {activeSection === 'admin' && <AdminSection />}
            {activeSection === 'glossary' && <GlossarySection />}
          </div>
        </div>
      </div>
    </Layout>
  )
}

// ===== 網站概覽 =====
function OverviewSection() {
  return (
    <div className="space-y-6">
      <SectionCard title="🎯 網站定位" icon="🎯">
        <p className="text-gray-300 leading-relaxed">
          <strong className="text-[#FFD700]">Polygon Guitar</strong> 是一個專門給香港廣東歌結他譜的平台。
          用戶可以上傳、瀏覽、收藏結他譜，並追蹤喜歡的編譜者。
        </p>
      </SectionCard>

      <SectionCard title="🏗️ 整體結構圖" icon="🏗️">
        <div className="bg-[#1a1a1a] p-4 rounded-lg overflow-x-auto">
          <pre className="text-gray-300 text-sm whitespace-pre">
{`
┌─────────────────────────────────────────────────────────────┐
│                    Polygon Guitar 網站架構                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🏠 前台 (用戶看到的頁面)                                      │
│  ├── 首頁 (/) - 熱門歌手、最新樂譜、歌單推薦                     │
│  ├── 搜尋 (/search) - 搜尋歌手、歌曲、樂譜                     │
│  ├── 歌手列表 (/artists) - 所有歌手分類瀏覽                    │
│  ├── 歌手頁 (/artists/[id]) - 歌手資料 + 所有歌曲              │
│  ├── 樂譜頁 (/tabs/[id]) - 顯示單份樂譜 + 轉調功能              │
│  ├── 收藏 (/library) - 我的歌單 + 喜愛歌曲                     │
│  ├── 上傳 (/tabs/new) - 上傳新樂譜                             │
│  ├── 求譜 (/tab-requests) - 用戶求譜 + 投票                    │
│  └── 個人主頁 (/profile/[id]) - 用戶資料 + 出譜列表             │
│                                                             │
│  ⚙️ 後台 (管理者專用)                                          │
│  └── /admin/... - 各種管理工具 (見下方詳細說明)                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
`}
          </pre>
        </div>
      </SectionCard>

      <SectionCard title="👥 用戶類型" icon="👥">
        <div className="grid md:grid-cols-3 gap-4">
          <UserTypeCard 
            title="訪客"
            desc="未登入的用戶"
            canDo={["瀏覽樂譜", "搜尋歌曲", "查看歌手", "註冊/登入"]}
            cantDo={["上傳樂譜", "收藏歌曲", "追蹤用戶", "求譜投票"]}
          />
          <UserTypeCard 
            title="一般用戶"
            desc="已登入的普通用戶"
            canDo={["所有訪客功能", "上傳樂譜", "收藏歌曲", "建立歌單", "追蹤用戶", "求譜投票"]}
            cantDo={["進入後台", "修改他人資料", "刪除系統內容"]}
          />
          <UserTypeCard 
            title="管理員"
            desc="你（網站擁有者）"
            canDo={["所有用戶功能", "進入後台管理", "編輯/刪除任何內容", "管理歌手資料", "查看統計數據"]}
            cantDo={[]}
            isAdmin
          />
        </div>
      </SectionCard>
    </div>
  )
}

// ===== 用戶相關 =====
function UsersSection() {
  return (
    <div className="space-y-6">
      <SectionCard title="👤 用戶系統說明" icon="👤">
        <p className="text-gray-300 mb-4">
          用戶透過 Google 帳號登入。每個用戶有以下資料：
        </p>
        
        <div className="bg-[#1a1a1a] p-4 rounded-lg">
          <h4 className="text-[#FFD700] font-medium mb-3">用戶資料欄位</h4>
          <ul className="space-y-2 text-gray-300 text-sm">
            <li><strong className="text-white">顯示名稱</strong> - 用戶自訂的名字（預設是 Google 名字）</li>
            <li><strong className="text-white">編譜筆名</strong> - 出譜時顯示的名稱（例如：結他小王子）</li>
            <li><strong className="text-white">頭像</strong> - 用戶上傳的照片或 Google 頭像</li>
            <li><strong className="text-white">個人簡介</strong> - 用戶自填的介紹文字</li>
            <li><strong className="text-white">音樂人檔案</strong> - 彈結他年資、風格、喜歡的 Key 等</li>
            <li><strong className="text-white">社交媒體</strong> - Facebook、IG、YouTube 等連結</li>
            <li><strong className="text-white">隱私設定</strong> - 是否公開主頁、顯示出譜/歌單</li>
          </ul>
        </div>
      </SectionCard>

      <SectionCard title="📍 個人主頁 (/profile/[id])" icon="📍">
        <p className="text-gray-300 mb-4">每個用戶都有自己的公開主頁，顯示：</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-white font-medium mb-2">📊 統計數據</h4>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• 出譜數目 - 用戶上傳了多少份譜</li>
              <li>• 總瀏覽量 - 所有譜的瀏覽次數總和</li>
              <li>• 粉絲數 - 有多少人追蹤這個用戶</li>
            </ul>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-white font-medium mb-2">🎵 內容顯示</h4>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• 熱門歌曲 - 瀏覽量最高的 5 首（有縮圖）</li>
              <li>• 所有歌曲 - 第 6 首起的列表（無縮圖）</li>
              <li>• 歌單 - 用戶建立的歌單</li>
              <li>• 社交媒體連結</li>
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="🔄 用戶流程圖" icon="🔄">
        <div className="bg-[#1a1a1a] p-4 rounded-lg">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <FlowStep>訪客瀏覽</FlowStep>
            <Arrow />
            <FlowStep>Google登入</FlowStep>
            <Arrow />
            <FlowStep>編輯個人資料</FlowStep>
            <Arrow />
            <FlowStep>上傳第一個譜</FlowStep>
            <Arrow />
            <FlowStep>獲得瀏覽/收藏</FlowStep>
            <Arrow />
            <FlowStep>建立粉絲群</FlowStep>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

// ===== 歌手管理 =====
function ArtistsSection() {
  return (
    <div className="space-y-6">
      <SectionCard title="🎤 歌手系統說明" icon="🎤">
        <p className="text-gray-300 mb-4">
          歌手是網站的核心分類。每首歌都必須屬於一個歌手。
        </p>

        <div className="bg-[#1a1a1a] p-4 rounded-lg mb-4">
          <h4 className="text-[#FFD700] font-medium mb-3">歌手資料包含</h4>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-white mb-1">基本資料</p>
              <ul className="text-gray-400 space-y-1">
                <li>• 歌手名稱</li>
                <li>• 類型（男/女/組合/其他）</li>
                <li>• 相片（用戶上傳或維基百科）</li>
                <li>• Hero 照片（歌手頁面大背景）</li>
                <li>• 簡介</li>
              </ul>
            </div>
            <div>
              <p className="text-white mb-1">Spotify 資料（自動獲取）</p>
              <ul className="text-gray-400 space-y-1">
                <li>• Spotify ID</li>
                <li>• 粉絲數</li>
                <li>• 人氣度 (0-100)</li>
                <li>• 音樂類型</li>
              </ul>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="📄 歌手頁面結構" icon="📄">
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-[#1a1a1a] to-[#282828] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">Hero 區域</h4>
            <p className="text-gray-400 text-sm">
              大背景圖片 + 歌手名稱 + 類型標籤 + Spotify 資料
            </p>
          </div>
          <div className="bg-gradient-to-r from-[#1a1a1a] to-[#282828] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">熱門歌曲</h4>
            <p className="text-gray-400 text-sm">
              前 5 首瀏覽量最高的歌曲，顯示 YouTube 縮圖 + 歌曲資訊
            </p>
          </div>
          <div className="bg-gradient-to-r from-[#1a1a1a] to-[#282828] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">所有歌曲（年份分組）</h4>
            <p className="text-gray-400 text-sm">
              按上傳年份分組（2021-2026、2016-2020 等），可排序
            </p>
          </div>
        </div>
      </SectionCard>

      <InfoBox type="tip" title="💡 小貼士">
        歌手頁面係網站最重要嘅流量入口之一。建議為每個歌手補齊相片同簡介，
        可以提升 SEO（搜尋引擎排名）。
      </InfoBox>
    </div>
  )
}

// ===== 樂譜系統 =====
function TabsSection() {
  return (
    <div className="space-y-6">
      <SectionCard title="🎸 樂譜 (Tab) 系統說明" icon="🎸">
        <p className="text-gray-300 mb-4">
          樂譜是網站的核心內容。一份樂譜包含歌詞、和弦、可能還有六線譜。
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">樂譜基本資料</h4>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• <strong className="text-white">歌名</strong> - 歌曲名稱</li>
              <li>• <strong className="text-white">歌手</strong> - 關聯的歌手</li>
              <li>• <strong className="text-white">原調</strong> - 歌曲原本的 Key</li>
              <li>• <strong className="text-white">Capo</strong> - 建議夾幾多格</li>
              <li>• <strong className="text-white">編譜者</strong> - 誰編這份譜</li>
              <li>• <strong className="text-white">上傳者</strong> - 誰上傳到網站</li>
            </ul>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">歌曲資料（Spotify）</h4>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• <strong className="text-white">作曲</strong> - 作曲人</li>
              <li>• <strong className="text-white">填詞</strong> - 填詞人</li>
              <li>• <strong className="text-white">專輯</strong> - 所屬專輯</li>
              <li>• <strong className="text-white">發行年份</strong> - 歌曲推出年份</li>
              <li>• <strong className="text-white">專輯封面</strong> - 顯示在樂譜頁</li>
              <li>• <strong className="text-white">BPM</strong> - 歌曲速度</li>
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="📝 樂譜內容格式" icon="📝">
        <div className="bg-[#1a1a1a] p-4 rounded-lg font-mono text-sm">
          <p className="text-gray-500 mb-2"># 簡譜格式範例</p>
          <div className="text-gray-300 space-y-1">
            <p>|C G/B |Am F |</p>
            <p>(這)是(一)首(簡)單(的)歌</p>
            <p></p>
            <p className="text-[#FFD700]">/v &lt;- 段落標記：主歌 (Verse)</p>
            <p>|C |G |Am |F |</p>
            <p>(主)歌(的)歌(詞)在(這)裡</p>
            <p></p>
            <p className="text-[#FFD700]">/c &lt;- 段落標記：副歌 (Chorus)</p>
            <p>|C |G |Am |F |</p>
            <p>(這)是(副)歌(部)分</p>
          </div>
        </div>
        
        <div className="mt-4 text-gray-400 text-sm">
          <p className="mb-2"><strong className="text-white">段落標記支援：</strong></p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <span className="bg-[#282828] px-2 py-1 rounded">/v = 主歌</span>
            <span className="bg-[#282828] px-2 py-1 rounded">/c = 副歌</span>
            <span className="bg-[#282828] px-2 py-1 rounded">/p = Pre-chorus</span>
            <span className="bg-[#282828] px-2 py-1 rounded">/b = Bridge</span>
            <span className="bg-[#282828] px-2 py-1 rounded">/i = Interlude</span>
            <span className="bg-[#282828] px-2 py-1 rounded">/o = Outro</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="⚙️ 樂譜頁功能" icon="⚙️">
        <div className="grid md:grid-cols-2 gap-4">
          <FeatureCard 
            title="轉調功能"
            desc="用戶可以轉換 Key，系統自動計算 Capo 位置。例如：原調 C 轉去 E，會顯示 'Capo 4'"
          />
          <FeatureCard 
            title="自動滾動"
            desc="樂譜可以自動向下滾動，方便彈奏時不需手動捲動"
          />
          <FeatureCard 
            title="字體調整"
            desc="可以放大或縮小字體，適合不同視力需求"
          />
          <FeatureCard 
            title="簡譜對齊"
            desc="數字簡譜會自動對齊歌詞，方便看譜"
          />
        </div>
      </SectionCard>
    </div>
  )
}

// ===== 收藏功能 =====
function LibrarySection() {
  return (
    <div className="space-y-6">
      <SectionCard title="📚 收藏系統說明" icon="📚">
        <p className="text-gray-300 mb-4">
          用戶可以收藏喜歡的樂譜，並建立自己的歌單。
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">❤️ 喜愛歌曲</h4>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• 點擊心形圖標收藏</li>
              <li>• 所有喜愛的歌曲會集中在這裡</li>
              <li>• 可以取消喜愛</li>
              <li>• 顯示在個人主頁（如果公開）</li>
            </ul>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">🎵 個人歌單</h4>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• 用戶可以創建多個歌單</li>
              <li>• 例如：「練習中」、「表演用」、「初學者」</li>
              <li>• 可以加入任何樂譜</li>
              <li>• 歌單可以分享給朋友</li>
            </ul>
          </div>
        </div>
      </SectionCard>

      <InfoBox type="note" title="📝 注意">
        喜愛歌曲和個人歌單係兩個獨立嘅系統。喜愛歌曲係「讚好」功能，
        歌單係「分類整理」功能。
      </InfoBox>
    </div>
  )
}

// ===== 社交功能 =====
function SocialSection() {
  return (
    <div className="space-y-6">
      <SectionCard title="💬 社交功能說明" icon="💬">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">👥 追蹤系統</h4>
            <p className="text-gray-400 text-sm">
              用戶可以追蹤喜歡的編譜者，被追蹤者會增加粉絲數。
              追蹤後可以在自己主頁看到對方的動態。
            </p>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">✋ 求譜功能</h4>
            <p className="text-gray-400 text-sm">
              用戶可以要求某首歌的結他譜，其他人可以投票支持。
              投票數愈高的求譜會優先顯示，吸引編譜者製作。
            </p>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">💬 留言系統</h4>
            <p className="text-gray-400 text-sm">
              用戶可以在樂譜頁面留言討論，分享彈奏心得或問問題。
              這需要登入後才能使用。
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="🔄 求譜流程" icon="🔄">
        <div className="bg-[#1a1a1a] p-4 rounded-lg">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <FlowStep>用戶提交求譜</FlowStep>
            <Arrow />
            <FlowStep>顯示在求譜區</FlowStep>
            <Arrow />
            <FlowStep>其他人投票</FlowStep>
            <Arrow />
            <FlowStep>編譜者看到</FlowStep>
            <Arrow />
            <FlowStep>製作樂譜</FlowStep>
            <Arrow />
            <FlowStep>上傳完成</FlowStep>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

// ===== 後台管理 =====
function AdminSection() {
  return (
    <div className="space-y-6">
      <SectionCard title="⚙️ 後台管理說明" icon="⚙️">
        <p className="text-gray-300 mb-4">
          後台係畀你（管理員）管理整個網站嘅地方。所有後台頁面都以 <code className="bg-[#282828] px-2 py-1 rounded">/admin/</code> 開頭。
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <AdminToolCard 
            title="🎤 歌手管理"
            tools={[
              { name: "歌手管理 V2", path: "/admin/artists-v2", desc: "查看所有歌手，批量設置類型" },
              { name: "合併重複歌手", path: "/admin/merge-artists", desc: "合併中英文重複的歌手" },
              { name: "歌手排序", path: "/admin/artists-sort", desc: "設置首頁歌手顯示順序" },
              { name: "分類封面", path: "/admin/category-images", desc: "設置男/女/組合分類封面" },
              { name: "Hero 照片", path: "/admin/hero-photos", desc: "批量上傳歌手 Hero 背景圖" },
            ]}
          />
          <AdminToolCard 
            title="🎸 樂譜管理"
            tools={[
              { name: "遷移樂譜管理", path: "/admin/migrated-tabs", desc: "管理從 Blogger 導入的舊譜" },
              { name: "導入樂譜", path: "/admin/import-tabs", desc: "從 Blogger 導入新樂譜" },
              { name: "樂譜分析", path: "/admin/analyze", desc: "分析樂譜質素和問題" },
              { name: "數據審查", path: "/admin/data-review", desc: "找出可疑/錯誤的資料" },
            ]}
          />
          <AdminToolCard 
            title="📊 數據統計"
            tools={[
              { name: "瀏覽統計", path: "/admin/analytics", desc: "全站瀏覽數據（類似 Google Analytics）" },
              { name: "歌手評分", path: "/admin/artists-score", desc: "給歌手評分影響排序" },
              { name: "歌手地區", path: "/admin/artists-region", desc: "設置歌手地區（香港/台灣/中國/國際）" },
            ]}
          />
          <AdminToolCard 
            title="⚙️ 網站設置"
            tools={[
              { name: "首頁設置", path: "/admin/home-settings", desc: "設置首頁顯示內容" },
              { name: "導航圖標", path: "/admin/nav-icons", desc: "自定義底部導航圖標" },
              { name: "管理員設置", path: "/admin/admins", desc: "添加/移除管理員" },
              { name: "Logo 上傳", path: "/admin/logo", desc: "上傳網站 Logo" },
            ]}
          />
          <AdminToolCard 
            title="🎵 Spotify 整合"
            tools={[
              { name: "Spotify 管理", path: "/admin/spotify-manager", desc: "批量更新歌手 Spotify 資料" },
              { name: "更新封面", path: "/admin/update-spotify-photos", desc: "更新歌手 Spotify 相片" },
              { name: "更新曲目", path: "/admin/update-track-info", desc: "更新歌曲 Spotify 資料" },
            ]}
          />
          <AdminToolCard 
            title="🛠️ 其他工具"
            tools={[
              { name: "批量 YouTube", path: "/admin/bulk-youtube", desc: "批量更新 YouTube 連結" },
              { name: "歌單管理", path: "/admin/playlists", desc: "管理精選歌單" },
              { name: "修復工具", path: "/admin/fix-artist", desc: "修復錯誤歌手名" },
            ]}
          />
        </div>
      </SectionCard>

      <InfoBox type="warning" title="⚠️ 重要提醒">
        後台功能非常強大，可以修改或刪除任何資料。請小心使用，
        特別係「合併歌手」同「刪除」功能，操作後無法自動復原。
      </InfoBox>
    </div>
  )
}

// ===== 術語表 =====
function GlossarySection() {
  return (
    <div className="space-y-6">
      <SectionCard title="📖 常用術語表" icon="📖">
        <p className="text-gray-300 mb-4">
          以下係網站開發同管理時常用嘅術語，方便你同 IT 人溝通：
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1a1a1a]">
                <th className="text-left p-3 text-[#FFD700]">術語</th>
                <th className="text-left p-3 text-[#FFD700]">解釋</th>
                <th className="text-left p-3 text-[#FFD700]">例子</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              <GlossaryRow 
                term="Tab / 樂譜"
                desc="結他譜，包含和弦、歌詞、可能還有六線譜"
                example="《十年》結他譜"
              />
              <GlossaryRow 
                term="Artist / 歌手"
                desc="歌曲的演唱者或創作者"
                example="陳奕迅、Beyond"
              />
              <GlossaryRow 
                term="Key / 調"
                desc="歌曲的音調，例如 C、G、Am"
                example="原調 C，Capo 2"
              />
              <GlossaryRow 
                term="Capo"
                desc="變調夾，夾在第幾格"
                example="Capo 3 = 夾第三格"
              />
              <GlossaryRow 
                term="Slug"
                desc="網址用的名稱，通常係小寫無空格"
                example="eason-chan、 beyond"
              />
              <GlossaryRow 
                term="Collection"
                desc="Firestore 資料庫的資料集合"
                example="tabs、artists、users"
              />
              <GlossaryRow 
                term="Document"
                desc="資料庫中的一筆記錄"
                example="一份樂譜、一個歌手資料"
              />
              <GlossaryRow 
                term="Field"
                desc="資料中的一個欄位"
                example="title、artist、viewCount"
              />
              <GlossaryRow 
                term="Index"
                desc="資料庫索引，加速搜尋"
                example="voteCount + createdAt"
              />
              <GlossaryRow 
                term="SEO"
                desc="搜尋引擎優化，讓 Google 更容易找到"
                example="設置正確的標題和描述"
              />
              <GlossaryRow 
                term="CDN"
                desc="內容傳遞網絡，加速圖片載入"
                example="Cloudinary 圖片服務"
              />
              <GlossaryRow 
                term="API"
                desc="程式接口，用來獲取外部資料"
                example="Spotify API、YouTube API"
              />
              <GlossaryRow 
                term="Deploy / 部署"
                desc="將更新發佈到正式網站"
                example="更新程式後 deploy 到 polygon.guitars"
              />
              <GlossaryRow 
                term="Cache"
                desc="暫存，加速重複載入"
                example="圖片 cache 後載入更快"
              />
              <GlossaryRow 
                term="Responsive"
                desc="響應式設計，適應不同螢幕大小"
                example="手機和電腦都顯示正常"
              />
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="💬 溝通用語建議" icon="💬">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-green-400 font-medium mb-2">✅ 建議的說法</h4>
            <ul className="text-gray-400 text-sm space-y-2">
              <li>「我想加個欄位『作曲』在樂譜資料」</li>
              <li>「歌手頁面要顯示多個 Spotify 粉絲數」</li>
              <li「在首頁加個區域顯示『本月熱門』」</li>
              <li>「修復歌手陳奕迅的 Hero 相片顯示問題」</li>
              <li>「幫我部署更新到正式網站」</li>
            </ul>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-red-400 font-medium mb-2">❌ 避免模糊的說法</h4>
            <ul className="text-gray-400 text-sm space-y-2">
              <li>「個 page 有問題」- 請講清楚哪個頁面</li>
              <li>「啲嘢唔見咗」- 請講清楚是什麼內容</li>
              <li>「改返好佢」- 請講清楚應該是什麼樣</li>
              <li>「加個功能」- 請詳細描述功能流程</li>
              <li>「啱啱更新咗」- 請提供時間和截圖</li>
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="📸 報告問題時請提供" icon="📸">
        <div className="bg-[#1a1a1a] p-4 rounded-lg">
          <ul className="text-gray-300 space-y-2">
            <li>1️⃣ <strong>截圖</strong> - 顯示問題的畫面（用手機影都得）</li>
            <li>2️⃣ <strong>網址</strong> - 完整的網址，例如 <code className="bg-[#282828] px-2 py-1 rounded">https://polygon.guitars/tabs/abc123</code></li>
            <li>3️⃣ <strong>操作步驟</strong> - 你做了什麼導致問題出現</li>
            <li>4️⃣ <strong>預期結果</strong> - 你期望看到什麼</li>
            <li>5️⃣ <strong>實際結果</strong> - 實際看到什麼</li>
            <li>6️⃣ <strong>裝置資訊</strong> - 手機還是電腦？什麼瀏覽器？</li>
          </ul>
        </div>
      </SectionCard>
    </div>
  )
}

// ===== 輔助組件 =====

function SectionCard({ title, icon, children }) {
  return (
    <div className="bg-[#121212] rounded-xl border border-gray-800 p-6">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span>{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  )
}

function UserTypeCard({ title, desc, canDo, cantDo, isAdmin }) {
  return (
    <div className={`p-4 rounded-lg ${isAdmin ? 'bg-[#FFD700]/10 border border-[#FFD700]/30' : 'bg-[#1a1a1a]'}`}>
      <h4 className={`font-bold mb-1 ${isAdmin ? 'text-[#FFD700]' : 'text-white'}`}>{title}</h4>
      <p className="text-gray-500 text-sm mb-3">{desc}</p>
      <div className="space-y-2">
        <p className="text-green-400 text-sm">✓ 可以做：</p>
        <ul className="text-gray-400 text-sm space-y-1">
          {canDo.map((item, i) => <li key={i}>• {item}</li>)}
        </ul>
        {cantDo.length > 0 && (
          <>
            <p className="text-red-400 text-sm mt-3">✗ 不可以做：</p>
            <ul className="text-gray-400 text-sm space-y-1">
              {cantDo.map((item, i) => <li key={i}>• {item}</li>)}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function FlowStep({ children }) {
  return (
    <span className="bg-[#282828] text-gray-300 px-3 py-2 rounded-lg text-sm whitespace-nowrap">
      {children}
    </span>
  )
}

function Arrow() {
  return <span className="text-gray-500">→</span>
}

function FeatureCard({ title, desc }) {
  return (
    <div className="bg-[#1a1a1a] p-4 rounded-lg">
      <h4 className="text-white font-medium mb-1">{title}</h4>
      <p className="text-gray-400 text-sm">{desc}</p>
    </div>
  )
}

function AdminToolCard({ title, tools }) {
  return (
    <div className="bg-[#1a1a1a] p-4 rounded-lg">
      <h4 className="text-[#FFD700] font-medium mb-3">{title}</h4>
      <ul className="space-y-2">
        {tools.map((tool, i) => (
          <li key={i} className="text-sm">
            <span className="text-white">{tool.name}</span>
            <span className="text-gray-500 text-xs block">{tool.desc}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function GlossaryRow({ term, desc, example }) {
  return (
    <tr className="hover:bg-[#1a1a1a]">
      <td className="p-3 text-white font-medium">{term}</td>
      <td className="p-3 text-gray-400">{desc}</td>
      <td className="p-3 text-gray-500 text-xs">{example}</td>
    </tr>
  )
}

function InfoBox({ type, title, children }) {
  const colors = {
    tip: 'bg-blue-900/20 border-blue-700 text-blue-400',
    note: 'bg-yellow-900/20 border-yellow-700 text-yellow-400',
    warning: 'bg-red-900/20 border-red-700 text-red-400',
  }
  
  return (
    <div className={`p-4 rounded-lg border ${colors[type]}`}>
      <h4 className="font-bold mb-2">{title}</h4>
      <p className="text-sm opacity-90">{children}</p>
    </div>
  )
}

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
    { id: 'homepage', label: '🏠 主頁結構', icon: '🏠' },
    { id: 'users', label: '👤 用戶相關', icon: '👤' },
    { id: 'artists', label: '🎤 歌手管理', icon: '🎤' },
    { id: 'tabs', label: '🎸 樂譜系統', icon: '🎸' },
    { id: 'library', label: '📚 收藏功能', icon: '📚' },
    { id: 'social', label: '💬 社交功能', icon: '💬' },
    { id: 'admin', label: '⚙️ 後台管理', icon: '⚙️' },
    { id: 'database', label: '🗄️ 資料庫結構', icon: '🗄️' },
    { id: 'security', label: '🔒 安全規則', icon: '🔒' },
    { id: 'glossary', label: '📖 術語表', icon: '📖' },
  ]

  return (
    <Layout>
      <div className="min-h-screen bg-black pb-24">
        {/* Header */}
        <div className="bg-[#121212] border-b border-neutral-800 px-4 py-4">
          <h1 className="text-2xl font-bold text-white">🗺️ 網站地圖 & 說明書</h1>
          <p className="text-neutral-400 text-sm mt-1">給管理者的完整網站結構指南（含資料庫與安全規則）</p>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* 快速導航 */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`p-3 rounded-lg text-sm font-medium transition ${
                  activeSection === item.id
                    ? 'bg-[#FFD700] text-black'
                    : 'bg-[#1a1a1a] text-neutral-300 hover:bg-[#282828]'
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
            {activeSection === 'homepage' && <HomepageSection />}
            {activeSection === 'users' && <UsersSection />}
            {activeSection === 'artists' && <ArtistsSection />}
            {activeSection === 'tabs' && <TabsSection />}
            {activeSection === 'library' && <LibrarySection />}
            {activeSection === 'social' && <SocialSection />}
            {activeSection === 'admin' && <AdminSection />}
            {activeSection === 'database' && <DatabaseSection />}
            {activeSection === 'security' && <SecuritySection />}
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
        <p className="text-neutral-300 leading-relaxed">
          <strong className="text-[#FFD700]">Polygon Guitar</strong> 是一個專門給香港廣東歌結他譜的平台。
          用戶可以上傳、瀏覽、收藏結他譜，並追蹤喜歡的編譜者。
        </p>
      </SectionCard>

      <SectionCard title="🏗️ 整體結構圖" icon="🏗️">
        <div className="bg-[#1a1a1a] p-4 rounded-lg overflow-x-auto">
          <pre className="text-neutral-300 text-sm whitespace-pre">
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

// ===== 主頁結構 =====
function HomepageSection() {
  return (
    <div className="space-y-6">
      <SectionCard title="🏠 首頁結構詳解" icon="🏠">
        <p className="text-neutral-300 mb-4">
          首頁是用戶進入網站的第一印象，由多個區域組成，每個區域都可以獨立配置。
        </p>

        <div className="space-y-4">
          <HomepageZone 
            title="1️⃣ 頂部黃色 Header"
            desc="顯示 POLYGON Logo 和副標題『香港廣東歌結他譜網』"
            editable="顏色固定為黃色 #FFD700，暫不支援修改"
          />
          <HomepageZone 
            title="2️⃣ 搜尋 Bar"
            desc="全局搜尋功能，可以搜尋歌手、歌曲"
            editable="位置固定，功能自動運作"
          />
          <HomepageZone 
            title="3️⃣ 歌手分類區"
            desc="正方形卡片顯示：男歌手（藍色標籤）、女歌手（粉紅色標籤）、組合（黃色標籤）"
            editable="卡片封面可在『分類封面管理』設置"
          />
          <HomepageZone 
            title="4️⃣ 熱門歌手區"
            desc="圓形大頭顯示，按瀏覽量/譜數/評分排序"
            editable="在『歌手排序』頁面設置顯示哪些歌手"
          />
          <HomepageZone 
            title="5️⃣ Playlist 推薦區"
            desc="顯示手動精選歌單（如『本週熱門』、『編輯推薦』）"
            editable="在『歌單管理』創建和設置顯示"
          />
          <HomepageZone 
            title="6️⃣ 最新上架"
            desc="最近上傳的樂譜列表"
            editable="自動顯示，按上傳時間排序"
          />
        </div>
      </SectionCard>

      <SectionCard title="⚙️ 首頁設置方式" icon="⚙️">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">歌手分類封面設置</h4>
            <p className="text-neutral-400 text-sm mb-2">
              前往：後台 → 分類封面管理
            </p>
            <ul className="text-neutral-400 text-sm space-y-1">
              <li>• 為男歌手/女歌手/組合上傳封面圖片</li>
              <li>• 或選擇代表性歌手作為封面</li>
              <li>• 卡片下方會顯示該類別前 5 位熱門歌手</li>
            </ul>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">熱門歌手設置</h4>
            <p className="text-neutral-400 text-sm mb-2">
              前往：後台 → 首頁設置
            </p>
            <ul className="text-neutral-400 text-sm space-y-1">
              <li>• 選擇排序方式（瀏覽量/譜數/評分/混合）</li>
              <li>• 手動揀選特定歌手優先顯示</li>
              <li>• 設置顯示數量（默認 12 個）</li>
            </ul>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">歌單推薦設置</h4>
            <p className="text-neutral-400 text-sm mb-2">
              前往：後台 → 歌單管理
            </p>
            <ul className="text-neutral-400 text-sm space-y-1">
              <li>• 創建精選歌單（自動/手動）</li>
              <li>• 選擇歌單類型（本月熱門/主題/歌手專輯）</li>
              <li>• 設置顯示順序和封面圖片</li>
            </ul>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">最新上架設置</h4>
            <p className="text-neutral-400 text-sm mb-2">
              自動生成，無需設置
            </p>
            <ul className="text-neutral-400 text-sm space-y-1">
              <li>• 自動顯示最近上傳的譜</li>
              <li>• 按 createdAt 時間排序</li>
              <li>• 顯示前 N 個（可在代碼修改）</li>
            </ul>
          </div>
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
        <p className="text-neutral-300 mb-4">
          用戶透過 Google 帳號登入。每個用戶有以下資料：
        </p>
        
        <div className="bg-[#1a1a1a] p-4 rounded-lg">
          <h4 className="text-[#FFD700] font-medium mb-3">用戶資料欄位</h4>
          <ul className="space-y-2 text-neutral-300 text-sm">
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
        <p className="text-neutral-300 mb-4">每個用戶都有自己的公開主頁，顯示：</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-white font-medium mb-2">📊 統計數據</h4>
            <ul className="text-neutral-400 text-sm space-y-1">
              <li>• 出譜數目 - 用戶上傳了多少份譜</li>
              <li>• 總瀏覽量 - 所有譜的瀏覽次數總和</li>
              <li>• 粉絲數 - 有多少人追蹤這個用戶</li>
            </ul>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-white font-medium mb-2">🎵 內容顯示</h4>
            <ul className="text-neutral-400 text-sm space-y-1">
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
        <p className="text-neutral-300 mb-4">
          歌手是網站的核心分類。每首歌都必須屬於一個歌手。
        </p>

        <div className="bg-[#1a1a1a] p-4 rounded-lg mb-4">
          <h4 className="text-[#FFD700] font-medium mb-3">歌手資料包含</h4>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-white mb-1">基本資料</p>
              <ul className="text-neutral-400 space-y-1">
                <li>• 歌手名稱</li>
                <li>• Slug（網址用，如 beyond、eason-chan）</li>
                <li>• 類型（男/女/組合/其他）</li>
                <li>• 地區（香港/台灣/中國/國際）</li>
                <li>• 相片（用戶上傳或維基百科）</li>
                <li>• Hero 照片（歌手頁面大背景）</li>
                <li>• 簡介</li>
                <li>• 出生年份、出道年份</li>
              </ul>
            </div>
            <div>
              <p className="text-white mb-1">Spotify 資料（自動獲取）</p>
              <ul className="text-neutral-400 space-y-1">
                <li>• Spotify ID</li>
                <li>• 粉絲數（spotifyFollowers）</li>
                <li>• 人氣度 0-100（spotifyPopularity）</li>
                <li>• 音樂類型（spotifyGenres）</li>
                <li>• 專輯封面（多尺寸）</li>
              </ul>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="📄 歌手分類系統" icon="📄">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">性別/類型分類</h4>
            <ul className="text-neutral-400 text-sm space-y-2">
              <li><span className="inline-block w-3 h-3 rounded-full bg-[#1fc3df] mr-2"></span>男歌手（male）</li>
              <li><span className="inline-block w-3 h-3 rounded-full bg-[#ff9b98] mr-2"></span>女歌手（female）</li>
              <li><span className="inline-block w-3 h-3 rounded-full bg-[#fed702] mr-2"></span>組合（group）</li>
              <li><span className="inline-block w-3 h-3 rounded-full bg-neutral-500 mr-2"></span>其他（other）</li>
            </ul>
            <p className="text-neutral-500 text-xs mt-3">
              在歌手管理 V2 頁面可以批量設置歌手類型
            </p>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">地區分類</h4>
            <ul className="text-neutral-400 text-sm space-y-2">
              <li>🇭🇰 香港（hongkong）</li>
              <li>🇹🇼 台灣（taiwan）</li>
              <li>🇨🇳 中國（china）</li>
              <li>🌍 國際（international）</li>
              <li>❓ 未分類（null）</li>
            </ul>
            <p className="text-neutral-500 text-xs mt-3">
              在歌手地區設定頁面批量設置地區
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="🎨 歌手頁面結構" icon="🎨">
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-[#1a1a1a] to-[#282828] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">Hero 區域</h4>
            <p className="text-neutral-400 text-sm">
              大背景圖片 + 歌手名稱 + 類型標籤 + Spotify 資料
            </p>
          </div>
          <div className="bg-gradient-to-r from-[#1a1a1a] to-[#282828] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">熱門歌曲</h4>
            <p className="text-neutral-400 text-sm">
              前 5 首瀏覽量最高的歌曲，顯示 YouTube 縮圖 + 歌曲資訊
            </p>
          </div>
          <div className="bg-gradient-to-r from-[#1a1a1a] to-[#282828] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">所有歌曲（年份分組）</h4>
            <p className="text-neutral-400 text-sm">
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
        <p className="text-neutral-300 mb-4">
          樂譜是網站的核心內容。一份樂譜包含歌詞、和弦、可能還有六線譜。
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">樂譜基本資料</h4>
            <ul className="text-neutral-400 text-sm space-y-1">
              <li>• <strong className="text-white">歌名</strong> - 歌曲名稱</li>
              <li>• <strong className="text-white">歌手</strong> - 關聯的歌手</li>
              <li>• <strong className="text-white">原調</strong> - 歌曲原本的 Key</li>
              <li>• <strong className="text-white">Capo</strong> - 建議夾幾多格</li>
              <li>• <strong className="text-white">編譜者</strong> - 誰編這份譜</li>
              <li>• <strong className="text-white">上傳者</strong> - 誰上傳到網站</li>
              <li>• <strong className="text-white">瀏覽數</strong> - viewCount</li>
              <li>• <strong className="text-white">讚好數</strong> - likes</li>
            </ul>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">歌曲資料（Spotify）</h4>
            <ul className="text-neutral-400 text-sm space-y-1">
              <li>• <strong className="text-white">作曲</strong> - 作曲人</li>
              <li>• <strong className="text-white">填詞</strong> - 填詞人</li>
              <li>• <strong className="text-white">專輯</strong> - 所屬專輯</li>
              <li>• <strong className="text-white">發行年份</strong> - 歌曲推出年份</li>
              <li>• <strong className="text-white">專輯封面</strong> - 顯示在樂譜頁</li>
              <li>• <strong className="text-white">BPM</strong> - 歌曲速度</li>
              <li>• <strong className="text-white">YouTube</strong> - 教學影片連結</li>
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="📝 樂譜內容格式" icon="📝">
        <div className="bg-[#1a1a1a] p-4 rounded-lg font-mono text-sm">
          <p className="text-neutral-500 mb-2"># 簡譜格式範例</p>
          <div className="text-neutral-300 space-y-1">
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
        
        <div className="mt-4 text-neutral-400 text-sm">
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
        <p className="text-neutral-300 mb-4">
          用戶可以收藏喜歡的樂譜，並建立自己的歌單。
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">❤️ 喜愛歌曲</h4>
            <ul className="text-neutral-400 text-sm space-y-1">
              <li>• 點擊心形圖標收藏</li>
              <li>• 所有喜愛的歌曲會集中在這裡</li>
              <li>• 可以取消喜愛</li>
              <li>• 顯示在個人主頁（如果公開）</li>
            </ul>
            <div className="mt-3 pt-3 border-t border-neutral-700">
              <p className="text-neutral-500 text-xs">
                資料儲存在：<code className="bg-[#282828] px-1 rounded">userLikedSongs</code> 集合
              </p>
            </div>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">🎵 個人歌單</h4>
            <ul className="text-neutral-400 text-sm space-y-1">
              <li>• 用戶可以創建多個歌單</li>
              <li>• 例如：「練習中」、「表演用」、「初學者」</li>
              <li>• 可以加入任何樂譜</li>
              <li>• 歌單可以分享給朋友</li>
            </ul>
            <div className="mt-3 pt-3 border-t border-neutral-700">
              <p className="text-neutral-500 text-xs">
                資料儲存在：<code className="bg-[#282828] px-1 rounded">userPlaylists</code> 集合
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="🎵 精選歌單 (Playlists)" icon="🎵">
        <p className="text-neutral-300 mb-4">
          除了用戶自建歌單，網站還有系統精選歌單，由管理員創建，顯示在首頁。
        </p>

        <div className="bg-[#1a1a1a] p-4 rounded-lg">
          <h4 className="text-[#FFD700] font-medium mb-3">歌單類型</h4>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-white mb-2">自動生成</p>
              <ul className="text-neutral-400 space-y-1">
                <li>• <strong>本月熱門</strong> - 自動計算瀏覽量最高</li>
                <li>• <strong>本週新增</strong> - 最近 7 天上傳的譜</li>
                <li>• <strong>趨勢上升</strong> - 瀏覽量急升的歌曲</li>
              </ul>
            </div>
            <div>
              <p className="text-white mb-2">手動精選</p>
              <ul className="text-neutral-400 space-y-1">
                <li>• <strong>歌手專輯</strong> - 某歌手精選歌曲</li>
                <li>• <strong>主題歌單</strong> - 如「畢業歌」、「情歌」</li>
                <li>• <strong>難度分類</strong> - 如「新手入門」</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-700">
            <p className="text-neutral-500 text-xs">
              資料儲存在：<code className="bg-[#282828] px-1 rounded">playlists</code> 集合（系統歌單）
              <br/>
              管理位置：後台 → 歌單管理
            </p>
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
            <p className="text-neutral-400 text-sm">
              用戶可以追蹤喜歡的編譜者，被追蹤者會增加粉絲數。
              追蹤後可以在自己主頁看到對方的動態。
            </p>
            <p className="text-neutral-500 text-xs mt-2">
              儲存在 users/{'{userId}'}/followers 子集合
            </p>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">✋ 求譜功能</h4>
            <p className="text-neutral-400 text-sm">
              用戶可以要求某首歌的結他譜，其他人可以投票支持。
              投票數愈高的求譜會優先顯示，吸引編譜者製作。
            </p>
            <p className="text-neutral-500 text-xs mt-2">
              儲存在 tabRequests 集合
            </p>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-[#FFD700] font-medium mb-2">💬 留言系統</h4>
            <p className="text-neutral-400 text-sm">
              用戶可以在樂譜頁面留言討論，分享彈奏心得或問問題。
              這需要登入後才能使用。
            </p>
            <p className="text-neutral-500 text-xs mt-2">
              儲存在 comments 集合
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
        <p className="text-neutral-300 mb-4">
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

// ===== 資料庫結構 =====
function DatabaseSection() {
  return (
    <div className="space-y-6">
      <SectionCard title="🗄️ Firestore 資料庫結構" icon="🗄️">
        <p className="text-neutral-300 mb-4">
          網站使用 <strong className="text-[#FFD700]">Firebase Firestore</strong> 作為資料庫。
          以下係所有 Collection（資料集合）的結構說明：
        </p>

        <div className="space-y-4">
          {/* tabs 集合 */}
          <CollectionCard 
            name="tabs"
            desc="儲存所有樂譜資料"
            fields={[
              { name: "title", type: "string", desc: "歌名" },
              { name: "artist", type: "string", desc: "歌手名" },
              { name: "artistId", type: "string", desc: "歌手 ID（關聯 artists）" },
              { name: "content", type: "string", desc: "樂譜內容（和弦+歌詞）" },
              { name: "originalKey", type: "string", desc: "原調（如 C、G）" },
              { name: "capo", type: "number", desc: "Capo 位置" },
              { name: "thumbnail", type: "string", desc: "YouTube 縮圖 URL" },
              { name: "youtubeUrl", type: "string", desc: "YouTube 影片連結" },
              { name: "uploaderId", type: "string", desc: "上傳者 ID" },
              { name: "uploaderPenName", type: "string", desc: "上傳者筆名" },
              { name: "viewCount", type: "number", desc: "瀏覽次數" },
              { name: "likes", type: "number", desc: "讚好數" },
              { name: "createdAt", type: "timestamp", desc: "創建時間" },
              { name: "updatedAt", type: "timestamp", desc: "更新時間" },
            ]}
          />

          {/* artists 集合 */}
          <CollectionCard 
            name="artists"
            desc="儲存所有歌手資料"
            fields={[
              { name: "name", type: "string", desc: "歌手名稱" },
              { name: "slug", type: "string", desc: "網址用名稱（如 beyond）" },
              { name: "gender", type: "string", desc: "類型：male/female/group/other" },
              { name: "region", type: "string", desc: "地區：hongkong/taiwan/china/international" },
              { name: "photoURL", type: "string", desc: "歌手相片 URL" },
              { name: "heroPhotoURL", type: "string", desc: "Hero 背景圖 URL" },
              { name: "bio", type: "string", desc: "歌手簡介" },
              { name: "spotifyId", type: "string", desc: "Spotify ID" },
              { name: "spotifyFollowers", type: "number", desc: "Spotify 粉絲數" },
              { name: "songCount", type: "number", desc: "歌曲數量（自動計算）" },
              { name: "viewCount", type: "number", desc: "總瀏覽量" },
              { name: "createdAt", type: "timestamp", desc: "創建時間" },
            ]}
          />

          {/* users 集合 */}
          <CollectionCard 
            name="users"
            desc="儲存用戶資料"
            fields={[
              { name: "displayName", type: "string", desc: "顯示名稱" },
              { name: "penName", type: "string", desc: "編譜筆名" },
              { name: "email", type: "string", desc: "電郵地址" },
              { name: "photoURL", type: "string", desc: "頭像 URL" },
              { name: "bio", type: "string", desc: "個人簡介" },
              { name: "socialMedia", type: "object", desc: "社交媒體連結 {facebook, instagram...}" },
              { name: "followerCount", type: "number", desc: "粉絲數" },
              { name: "isPublicProfile", type: "boolean", desc: "是否公開主頁" },
              { name: "createdAt", type: "timestamp", desc: "創建時間" },
            ]}
          />

          {/* playlists 集合 */}
          <CollectionCard 
            name="playlists"
            desc="儲存系統精選歌單"
            fields={[
              { name: "title", type: "string", desc: "歌單名稱" },
              { name: "description", type: "string", desc: "歌單描述" },
              { name: "songIds", type: "array", desc: "歌曲 ID 列表" },
              { name: "coverImage", type: "string", desc: "封面圖片 URL" },
              { name: "source", type: "string", desc: "來源：auto/manual" },
              { name: "autoType", type: "string", desc: "自動類型：monthly/weekly/trending" },
              { name: "manualType", type: "string", desc: "手動類型：artist/theme/series" },
              { name: "isActive", type: "boolean", desc: "是否啟用" },
              { name: "displayOrder", type: "number", desc: "顯示順序" },
              { name: "createdBy", type: "string", desc: "創建者 ID" },
              { name: "createdAt", type: "timestamp", desc: "創建時間" },
            ]}
          />

          {/* userPlaylists 集合 */}
          <CollectionCard 
            name="userPlaylists"
            desc="儲存用戶自建歌單"
            fields={[
              { name: "userId", type: "string", desc: "用戶 ID" },
              { name: "title", type: "string", desc: "歌單名稱" },
              { name: "songIds", type: "array", desc: "歌曲 ID 列表" },
              { name: "coverImage", type: "string", desc: "封面圖片 URL" },
              { name: "createdAt", type: "timestamp", desc: "創建時間" },
            ]}
          />

          {/* userLikedSongs 集合 */}
          <CollectionCard 
            name="userLikedSongs"
            desc="儲存用戶喜愛的歌曲"
            fields={[
              { name: "userId", type: "string", desc: "用戶 ID" },
              { name: "songId", type: "string", desc: "歌曲 ID" },
              { name: "createdAt", type: "timestamp", desc: "收藏時間" },
            ]}
            note="文件 ID 格式：{userId}_{songId}"
          />

          {/* tabRequests 集合 */}
          <CollectionCard 
            name="tabRequests"
            desc="儲存求譜請求"
            fields={[
              { name: "title", type: "string", desc: "歌曲名稱" },
              { name: "artist", type: "string", desc: "歌手名稱" },
              { name: "requesterId", type: "string", desc: "請求者 ID" },
              { name: "voteCount", type: "number", desc: "投票數" },
              { name: "voters", type: "array", desc: "投票者 ID 列表" },
              { name: "status", type: "string", desc: "狀態：pending/fulfilled" },
              { name: "fulfilledBy", type: "string", desc: "完成者 ID" },
              { name: "createdAt", type: "timestamp", desc: "創建時間" },
            ]}
          />

          {/* comments 集合 */}
          <CollectionCard 
            name="comments"
            desc="儲存樂譜留言"
            fields={[
              { name: "tabId", type: "string", desc: "樂譜 ID" },
              { name: "userId", type: "string", desc: "用戶 ID" },
              { name: "content", type: "string", desc: "留言內容" },
              { name: "createdAt", type: "timestamp", desc: "創建時間" },
            ]}
          />

          {/* pageViews 集合 */}
          <CollectionCard 
            name="pageViews"
            desc="儲存頁面瀏覽記錄（統計用）"
            fields={[
              { name: "pageType", type: "string", desc: "頁面類型：tab/artist/home..." },
              { name: "pageId", type: "string", desc: "頁面 ID" },
              { name: "userId", type: "string", desc: "用戶 ID（可能為空）" },
              { name: "timestamp", type: "timestamp", desc: "瀏覽時間" },
            ]}
          />
        </div>
      </SectionCard>

      <InfoBox type="tip" title="💡 查看資料庫">
        你可以登入 Firebase Console（console.firebase.google.com）→ Firestore Database
        直接查看和編輯所有資料。請小心操作，誤刪無法復原。
      </InfoBox>
    </div>
  )
}

// ===== 安全規則 =====
function SecuritySection() {
  return (
    <div className="space-y-6">
      <SectionCard title="🔒 Firebase 安全規則說明" icon="🔒">
        <p className="text-neutral-300 mb-4">
          安全規則控制「誰可以讀寫什麼資料」。這是防止未授權訪問的重要保護。
        </p>

        <div className="bg-[#1a1a1a] p-4 rounded-lg mb-4">
          <h4 className="text-[#FFD700] font-medium mb-2">規則基本邏輯</h4>
          <div className="space-y-2 text-neutral-400 text-sm">
            <p><strong className="text-white">allow read:</strong> 誰可以讀取資料</p>
            <p><strong className="text-white">allow create:</strong> 誰可以新增資料</p>
            <p><strong className="text-white">allow update:</strong> 誰可以修改資料</p>
            <p><strong className="text-white">allow delete:</strong> 誰可以刪除資料</p>
          </div>
        </div>

        <div className="space-y-4">
          <RuleCard 
            collection="tabs（樂譜）"
            rules={[
              { action: "讀取", condition: "任何人", level: "public" },
              { action: "新增", condition: "已登入用戶", level: "user" },
              { action: "修改", condition: "管理員 或 上傳者 或 更新 rating/viewCount", level: "mixed" },
              { action: "刪除", condition: "管理員 或 上傳者", level: "mixed" },
            ]}
          />
          <RuleCard 
            collection="artists（歌手）"
            rules={[
              { action: "讀取", condition: "任何人", level: "public" },
              { action: "新增", condition: "已登入用戶", level: "user" },
              { action: "修改", condition: "管理員 或 創建者", level: "mixed" },
              { action: "刪除", condition: "僅管理員", level: "admin" },
            ]}
          />
          <RuleCard 
            collection="users（用戶）"
            rules={[
              { action: "讀取", condition: "任何人", level: "public" },
              { action: "寫入", condition: "本人 或 管理員", level: "private" },
            ]}
          />
          <RuleCard 
            collection="userLikedSongs（喜愛歌曲）"
            rules={[
              { action: "讀取", condition: "本人", level: "private" },
              { action: "新增", condition: "本人", level: "private" },
              { action: "刪除", condition: "本人", level: "private" },
            ]}
          />
          <RuleCard 
            collection="comments（留言）"
            rules={[
              { action: "讀取", condition: "任何人", level: "public" },
              { action: "新增", condition: "已登入用戶", level: "user" },
              { action: "刪除", condition: "本人 或 管理員", level: "mixed" },
            ]}
          />
          <RuleCard 
            collection="settings（系統設置）"
            rules={[
              { action: "讀取", condition: "任何人", level: "public" },
              { action: "寫入", condition: "僅管理員", level: "admin" },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard title="👑 管理員權限" icon="👑">
        <div className="bg-[#1a1a1a] p-4 rounded-lg">
          <p className="text-neutral-300 mb-3">
            目前管理員由電郵地址識別：
          </p>
          <ul className="text-neutral-400 text-sm space-y-1">
            <li>• kermit.tam@gmail.com</li>
            <li>• showroomchan@gmail.com</li>
          </ul>
          <p className="text-neutral-500 text-xs mt-3">
            管理員擁有所有資料的讀寫權限，可以修改或刪除任何內容。
          </p>
        </div>
      </SectionCard>

      <SectionCard title="⚠️ 常見安全問題" icon="⚠️">
        <div className="space-y-3">
          <div className="bg-red-900/20 border border-red-700/50 p-4 rounded-lg">
            <h4 className="text-red-400 font-medium mb-2">Q: 為什麼 viewCount 允許任何人更新？</h4>
            <p className="text-neutral-400 text-sm">
              A: 因為瀏覽計數需要每次頁面載入都更新。為了讓未登入用戶也計數，
              規則允許任何人更新 viewCount 欄位，但不能修改其他內容。
            </p>
          </div>
          <div className="bg-red-900/20 border border-red-700/50 p-4 rounded-lg">
            <h4 className="text-red-400 font-medium mb-2">Q: 如果用戶刪除自己的帳號，相關資料會怎樣？</h4>
            <p className="text-neutral-400 text-sm">
              A: 目前不會自動刪除。用戶上傳的樂譜會保留（因為有其他用戶收藏），
              但會顯示為「未知用戶」。喜愛歌曲和歌單會保留在資料庫中。
            </p>
          </div>
          <div className="bg-red-900/20 border border-red-700/50 p-4 rounded-lg">
            <h4 className="text-red-400 font-medium mb-2">Q: 如何防止用戶不斷投票？</h4>
            <p className="text-neutral-400 text-sm">
              A: tabRequests 的 voters 陣列會記錄已投票的用戶 ID，
              每個用戶只能投一次（由客戶端和規則雙重檢查）。
            </p>
          </div>
        </div>
      </SectionCard>

      <InfoBox type="warning" title="🔧 修改規則須知">
        安全規則儲存在 firestore.rules 檔案中。修改後需要部署才會生效。
        錯誤的規則可能導致資料外洩或功能失效，建議修改前先備份。
      </InfoBox>
    </div>
  )
}

// ===== 術語表 =====
function GlossarySection() {
  return (
    <div className="space-y-6">
      <SectionCard title="📖 常用術語表" icon="📖">
        <p className="text-neutral-300 mb-4">
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
            <tbody className="divide-y divide-neutral-800">
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
            <ul className="text-neutral-400 text-sm space-y-2">
              <li>「我想加個欄位『作曲』在樂譜資料」</li>
              <li>「歌手頁面要顯示多個 Spotify 粉絲數」</li>
              <li>「在首頁加個區域顯示『本月熱門』」</li>
              <li>「修復歌手陳奕迅的 Hero 相片顯示問題」</li>
              <li>「幫我部署更新到正式網站」</li>
            </ul>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-lg">
            <h4 className="text-red-400 font-medium mb-2">❌ 避免模糊的說法</h4>
            <ul className="text-neutral-400 text-sm space-y-2">
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
          <ul className="text-neutral-300 space-y-2">
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
    <div className="bg-[#121212] rounded-xl border border-neutral-800 p-6">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span>{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  )
}

function HomepageZone({ title, desc, editable }) {
  return (
    <div className="bg-[#1a1a1a] p-4 rounded-lg border-l-4 border-[#FFD700]">
      <h4 className="text-white font-medium mb-1">{title}</h4>
      <p className="text-neutral-400 text-sm mb-2">{desc}</p>
      <p className="text-[#FFD700] text-xs">{editable}</p>
    </div>
  )
}

function UserTypeCard({ title, desc, canDo, cantDo, isAdmin }) {
  return (
    <div className={`p-4 rounded-lg ${isAdmin ? 'bg-[#FFD700]/10 border border-[#FFD700]/30' : 'bg-[#1a1a1a]'}`}>
      <h4 className={`font-bold mb-1 ${isAdmin ? 'text-[#FFD700]' : 'text-white'}`}>{title}</h4>
      <p className="text-neutral-500 text-sm mb-3">{desc}</p>
      <div className="space-y-2">
        <p className="text-green-400 text-sm">✓ 可以做：</p>
        <ul className="text-neutral-400 text-sm space-y-1">
          {canDo.map((item, i) => <li key={i}>• {item}</li>)}
        </ul>
        {cantDo.length > 0 && (
          <>
            <p className="text-red-400 text-sm mt-3">✗ 不可以做：</p>
            <ul className="text-neutral-400 text-sm space-y-1">
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
    <span className="bg-[#282828] text-neutral-300 px-3 py-2 rounded-lg text-sm whitespace-nowrap">
      {children}
    </span>
  )
}

function Arrow() {
  return <span className="text-neutral-500">→</span>
}

function FeatureCard({ title, desc }) {
  return (
    <div className="bg-[#1a1a1a] p-4 rounded-lg">
      <h4 className="text-white font-medium mb-1">{title}</h4>
      <p className="text-neutral-400 text-sm">{desc}</p>
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
            <span className="text-neutral-500 text-xs block">{tool.desc}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CollectionCard({ name, desc, fields, note }) {
  return (
    <div className="bg-[#1a1a1a] p-4 rounded-lg border border-neutral-800">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[#FFD700] font-mono font-bold">{name}</h4>
        <span className="text-neutral-500 text-xs">{desc}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <tbody className="divide-y divide-neutral-800">
            {fields.map((field, i) => (
              <tr key={i}>
                <td className="py-1.5 text-white font-mono w-1/3">{field.name}</td>
                <td className="py-1.5 text-neutral-500 w-1/6">{field.type}</td>
                <td className="py-1.5 text-neutral-400">{field.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && (
        <p className="text-neutral-500 text-xs mt-2 italic">{note}</p>
      )}
    </div>
  )
}

function RuleCard({ collection, rules }) {
  const levelColors = {
    public: 'text-green-400',
    user: 'text-blue-400',
    private: 'text-yellow-400',
    mixed: 'text-orange-400',
    admin: 'text-red-400',
  }

  return (
    <div className="bg-[#1a1a1a] p-4 rounded-lg border border-neutral-800">
      <h4 className="text-white font-mono font-bold mb-3">{collection}</h4>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {rules.map((rule, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-neutral-500">{rule.action}:</span>
            <span className={levelColors[rule.level]}>{rule.condition}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function GlossaryRow({ term, desc, example }) {
  return (
    <tr className="hover:bg-[#1a1a1a]">
      <td className="p-3 text-white font-medium">{term}</td>
      <td className="p-3 text-neutral-400">{desc}</td>
      <td className="p-3 text-neutral-500 text-xs">{example}</td>
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

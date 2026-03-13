import { useState } from 'react'
import Layout from '@/components/Layout'
import { 
  Database, Server, Cloud, Code, FileCode, Music, 
  Search, CreditCard, TrendingUp, Shield, Settings,
  ChevronDown, ChevronUp, DollarSign, Users, BarChart3
} from 'lucide-react'

// Tech Stack Card Component
function TechCard({ icon: Icon, title, subtitle, description, details, color }) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div className="bg-[#121212] rounded-xl border border-neutral-800 overflow-hidden">
      <div 
        className="p-4 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
            <Icon size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-lg">{title}</h3>
                <p className="text-[#FFD700] text-sm">{subtitle}</p>
              </div>
              {isOpen ? <ChevronUp className="text-neutral-400" /> : <ChevronDown className="text-neutral-400" />}
            </div>
            <p className="text-neutral-400 text-sm mt-2">{description}</p>
          </div>
        </div>
      </div>
      
      {isOpen && (
        <div className="px-4 pb-4 border-t border-neutral-800 pt-4">
          <div className="space-y-3">
            {details.map((detail, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FFD700] mt-2 flex-shrink-0" />
                <p className="text-neutral-300 text-sm leading-relaxed">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Cost Estimation Card
function CostCard({ tier, price, users, features, recommended }) {
  return (
    <div className={`rounded-xl border p-4 ${recommended ? 'border-[#FFD700] bg-[#FFD700]/5' : 'border-neutral-800 bg-[#121212]'}`}>
      {recommended && (
        <div className="text-[#FFD700] text-xs font-bold mb-2">💡 建議方案</div>
      )}
      <h4 className="text-white font-bold">{tier}</h4>
      <div className="text-2xl font-bold text-white mt-1">{price}</div>
      <p className="text-neutral-400 text-sm mt-1">{users}</p>
      <div className="mt-3 space-y-1">
        {features.map((f, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-neutral-300">
            <div className="w-1 h-1 rounded-full bg-green-500" />
            {f}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TechStack() {
  const [activeTab, setActiveTab] = useState('overview')

  const techStack = [
    {
      icon: Server,
      title: 'Vercel',
      subtitle: '前端托管 + Serverless 函數',
      color: 'bg-white text-black',
      description: '網站的「出租單位」，負責顯示網頁和處理用戶請求',
      details: [
        'Next.js 16 框架 - 現代 React 技術，支援 Server-Side Rendering (SSR)',
        '自動部署 - 每次 Git push 自動更新網站（約 30-60 秒）',
        'Serverless Functions - API 路由（/api/*）在需要時才運行，慳錢',
        'CDN 加速 - 全球節點，香港用戶訪問快',
        '目前用量：Hobby Plan（免費版）- 每月 100GB 流量，足夠 10,000+ 用戶',
        '自訂域名：polygon.guitars 已配置 SSL 自動續期'
      ]
    },
    {
      icon: Database,
      title: 'Firebase',
      subtitle: '後端數據庫 + 用戶認證',
      color: 'bg-orange-500 text-white',
      description: '網站的「倉庫」，儲存所有結他譜、歌手資料、用戶帳號',
      details: [
        'Firestore Database - NoSQL 文檔數據庫，儲存 tabs、artists、users 等 collection',
        'Authentication - Google 登入，無需自己處理密碼安全',
        'Security Rules - 控制誰可以讀寫什麼數據（已配置）',
        '地區：asia-east2（香港）- 亞洲用戶訪問快',
        '目前用量：Spark Plan（免費版）- 每日 50,000 次讀取，20,000 次寫入',
        '實時監控：Firebase Console 可看到所有 API 調用和錯誤日誌'
      ]
    },
    {
      icon: Cloud,
      title: 'Cloudinary',
      subtitle: '圖片存儲與處理',
      color: 'bg-blue-500 text-white',
      description: '網站的「相簿」，儲存歌手相、樂譜圖片、Guitar Pro 預覽',
      details: [
        '自動縮圖 - 上傳大圖自動生成多種尺寸（640px, 300px, 64px）',
        '格式轉換 - 自動轉為 WebP 格式，加快載入',
        'CDN 分發 - 全球加速圖片載入',
        '目前用量：免費版 - 25GB 存儲，25GB 月流量',
        '用途：歌手照片、Guitar Pro 預覽圖、專輯封面',
        '上傳方式：Anonymous Upload（無需登入）- 用戶直接從瀏覽器上傳'
      ]
    },
    {
      icon: FileCode,
      title: 'JavaScript / Next.js',
      subtitle: '程式語言與框架',
      color: 'bg-yellow-500 text-black',
      description: '網站的「建築材料」，用 JS 寫成，不是 TypeScript',
      details: [
        'Next.js 16.1.6 - React 框架，支援 Pages Router（本項目使用）',
        '為何不用 TypeScript？ - 開發速度快，不需要編譯，適合快速迭代',
        'Tailwind CSS - 原子化 CSS，快速設計 UI',
        '主要結構：pages/（頁面）、components/（元件）、lib/（工具函數）、public/（靜態檔案）',
        'API 路由：pages/api/ 內的檔案自動成為 /api/* 端點',
        '環境變數：.env.local 儲存 API Keys（不上傳 Git）'
      ]
    }
  ]

  const apis = [
    {
      name: 'Spotify API',
      purpose: '搜尋歌曲、獲取專輯封面、歌手資訊',
      endpoint: '/api/spotify/*',
      quota: '無官方限制，但建議禮貌使用',
      status: '使用中 - 求譜、上傳樂譜時搜尋',
      cost: '免費'
    },
    {
      name: 'YouTube Data API',
      purpose: '搜尋 YouTube 影片、獲取縮圖',
      endpoint: '/api/youtube/*',
      quota: '每日 100 次搜尋（配額限制）',
      status: '使用中 - 每日配額約 100 次，超額會自動降級',
      cost: '免費（配額 10,000 units/日）'
    },
    {
      name: 'Wikipedia API',
      purpose: '自動獲取歌手資料、相片',
      endpoint: '/api/wikipedia/*',
      quota: '無限制（公開 API）',
      status: '使用中 - 創建歌手時自動填充資料',
      cost: '免費'
    },
    {
      name: 'Cloudinary API',
      purpose: '圖片上傳、轉換',
      endpoint: '直接調用（Client-side）',
      quota: '25GB 存儲 / 月',
      status: '使用中 - 歌手照片上傳',
      cost: '免費版足夠'
    }
  ]

  const collections = [
    { name: 'tabs', desc: '結他譜資料（3,246 份）', fields: 'title, artist, content, originalKey, youtubeUrl, viewCount, likes' },
    { name: 'artists', desc: '歌手資料（487 個）', fields: 'name, slug, gender, photoURL, bio, songCount, viewCount' },
    { name: 'users', desc: '用戶資料', fields: 'displayName, email, photoURL, penName, socialLinks' },
    { name: 'playlists', desc: '歌單', fields: 'title, description, songIds, coverImage, source' },
    { name: 'tabRequests', desc: '求譜請求', fields: 'songTitle, artistName, userId, voteCount, status' },
    { name: 'comments', desc: '樂譜留言', fields: 'tabId, userId, content, createdAt' },
    { name: 'pageViews', desc: '瀏覽統計', fields: 'pageType, path, pageTitle, timestamp, sessionId' }
  ]

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8 pb-24">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">網站技術架構說明書</h1>
          <p className="text-neutral-400">Polygon Guitar 技術棧、成本分析及擴展方案</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: '概覽', icon: BarChart3 },
            { id: 'tech', label: '技術詳情', icon: Code },
            { id: 'database', label: '數據庫結構', icon: Database },
            { id: 'api', label: 'API 列表', icon: Search },
            { id: 'guitarpro', label: 'Guitar Pro', icon: Music },
            { id: 'cost', label: '成本分析', icon: DollarSign },
            { id: 'scaling', label: '擴展方案', icon: TrendingUp }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id 
                  ? 'bg-[#FFD700] text-black font-bold' 
                  : 'bg-[#282828] text-white hover:bg-[#3E3E3E]'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-[#121212] rounded-xl p-6 border border-neutral-800">
              <h2 className="text-xl font-bold text-white mb-4">🎯 一句話總結</h2>
              <p className="text-neutral-300 leading-relaxed">
                這是一個用 <span className="text-[#FFD700]">Next.js</span> 寫的結他譜分享網站，
                數據存在 <span className="text-[#FFD700]">Firebase</span>，
                圖片存在 <span className="text-[#FFD700]">Cloudinary</span>，
                托管在 <span className="text-[#FFD700]">Vercel</span>。
                目前全部使用免費方案，可支持約 <span className="text-[#FFD700] font-bold">10,000 活躍用戶</span>。
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-[#121212] rounded-xl p-5 border border-neutral-800">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <Database className="text-[#FFD700]" size={20} />
                  當前數據量
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-neutral-300">
                    <span>結他譜</span>
                    <span className="text-[#FFD700] font-bold">3,246 份</span>
                  </div>
                  <div className="flex justify-between text-neutral-300">
                    <span>歌手</span>
                    <span className="text-[#FFD700] font-bold">487 位</span>
                  </div>
                  <div className="flex justify-between text-neutral-300">
                    <span>用戶</span>
                    <span className="text-[#FFD700] font-bold">約 200 人</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#121212] rounded-xl p-5 border border-neutral-800">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <DollarSign className="text-green-500" size={20} />
                  目前月費
                </h3>
                <div className="text-3xl font-bold text-white">$0</div>
                <p className="text-neutral-400 text-sm mt-2">
                  全部使用免費方案
                </p>
                <p className="text-neutral-500 text-xs mt-1">
                  估計可支持至 10,000 用戶才需要升級
                </p>
              </div>
            </div>

            <div className="bg-[#121212] rounded-xl p-6 border border-neutral-800">
              <h3 className="text-white font-bold mb-4">🏗️ 架構圖</h3>
              <div className="bg-[#1a1a1a] rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre className="text-neutral-300">
{`用戶瀏覽器
     │
     ▼
┌─────────────────────────────────────┐
│  Vercel (CDN + 伺服器)              │  ← 免費，自動擴展
│  - Next.js 網站                     │
│  - API Routes (/api/*)              │
└─────────────────────────────────────┘
     │                    │
     ▼                    ▼
┌──────────┐      ┌──────────────────┐
│ Cloudinary│      │  Firebase        │  ← 免費額度
│ (圖片)   │      │  - Firestore DB  │
└──────────┘      │  - Authentication│
                  │  - Hosting       │
                  └──────────────────┘
                          │
     ┌────────────────────┼────────────────────┐
     ▼                    ▼                    ▼
Spotify API         YouTube API        Wikipedia API
(免費)              (免費 100次/日)      (免費)`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Tech Stack Tab */}
        {activeTab === 'tech' && (
          <div className="space-y-4">
            <p className="text-neutral-400 text-sm mb-4">點擊卡片查看詳細說明</p>
            {techStack.map((tech, idx) => (
              <TechCard key={idx} {...tech} />
            ))}
          </div>
        )}

        {/* Database Tab */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            <div className="bg-[#121212] rounded-xl p-6 border border-neutral-800">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <Database className="text-[#FFD700]" size={20} />
                Firestore Collections（資料表）
              </h3>
              <div className="space-y-3">
                {collections.map((col, idx) => (
                  <div key={idx} className="bg-[#1a1a1a] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <code className="text-[#FFD700] font-bold text-lg">{col.name}</code>
                      <span className="text-neutral-500 text-xs">{col.desc}</span>
                    </div>
                    <p className="text-neutral-400 text-xs">{col.fields}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#121212] rounded-xl p-6 border border-neutral-800">
              <h3 className="text-white font-bold mb-4">🔗 資料關係圖</h3>
              <div className="bg-[#1a1a1a] rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre className="text-neutral-300">
{`artists (歌手)
   │
   ├── songs (歌曲) ──► tabs (結他譜) ◄── users (上傳者)
   │                       │
   │                       ├── comments (留言)
   │                       └── likes (讚好)
   │
   ├── playlists (歌單) ◄── users (創建者)
   │
   └── tabRequests (求譜) ◄── users (請求者)`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* API Tab */}
        {activeTab === 'api' && (
          <div className="space-y-4">
            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 mb-4">
              <p className="text-yellow-200 text-sm">
                <strong>⚠️ API 配額警告：</strong>YouTube API 每日只有 100 次搜尋配額，
                用完會自動轉用 Spotify 或手動輸入模式。
              </p>
            </div>
            
            {apis.map((api, idx) => (
              <div key={idx} className="bg-[#121212] rounded-xl p-5 border border-neutral-800">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-white font-bold text-lg">{api.name}</h4>
                    <p className="text-neutral-400 text-sm">{api.purpose}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${api.cost === '免費' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                    {api.cost}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-neutral-500">端點：</span>
                    <code className="text-[#FFD700]">{api.endpoint}</code>
                  </div>
                  <div>
                    <span className="text-neutral-500">配額：</span>
                    <span className="text-neutral-300">{api.quota}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-neutral-500">狀態：</span>
                    <span className="text-neutral-300">{api.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Guitar Pro Tab */}
        {activeTab === 'guitarpro' && (
          <div className="space-y-6">
            <div className="bg-[#121212] rounded-xl p-6 border border-neutral-800">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <Music className="text-[#FFD700]" size={20} />
                Guitar Pro 整合
              </h3>
              <div className="space-y-4 text-neutral-300">
                <div className="bg-[#1a1a1a] rounded-lg p-4">
                  <h4 className="text-white font-bold mb-2">目前支援</h4>
                  <ul className="space-y-2 text-sm">
                    <li>✅ 上傳 .gp3, .gp4, .gp5, .gpx 檔案</li>
                    <li>✅ 自動生成樂譜預覽圖（PNG）</li>
                    <li>✅ 在線播放（使用 alphaTab 庫）</li>
                    <li>✅ 下載原始檔案</li>
                  </ul>
                </div>

                <div className="bg-[#1a1a1a] rounded-lg p-4">
                  <h4 className="text-white font-bold mb-2">技術實現</h4>
                  <ul className="space-y-2 text-sm">
                    <li><strong>alphaTab</strong> - 開源 JavaScript 庫，在瀏覽器渲染 Guitar Pro 檔案</li>
                    <li><strong>Web Audio API</strong> - 用於音頻播放，無需後端伺服器</li>
                    <li><strong>檔案存儲</strong> - 原檔案存於 Cloudinary，預覽圖自動生成</li>
                  </ul>
                </div>

                <div className="bg-[#1a1a1a] rounded-lg p-4">
                  <h4 className="text-white font-bold mb-2">限制</h4>
                  <ul className="space-y-2 text-sm text-neutral-400">
                    <li>• 大檔案（&gt;5MB）可能需要較長時間加載</li>
                    <li>• 手機瀏覽器播放可能會有延遲</li>
                    <li>• 不支援舊版 .ptb (PowerTab) 格式</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cost Tab */}
        {activeTab === 'cost' && (
          <div className="space-y-6">
            <div className="bg-[#121212] rounded-xl p-6 border border-neutral-800">
              <h3 className="text-white font-bold mb-4">💰 目前成本（$0/月）</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-[#1a1a1a] rounded-lg p-4">
                  <h4 className="text-neutral-400 text-sm mb-2">Vercel Hobby Plan</h4>
                  <div className="text-white font-bold">免費</div>
                  <p className="text-neutral-500 text-xs mt-1">100GB 流量/月</p>
                </div>
                <div className="bg-[#1a1a1a] rounded-lg p-4">
                  <h4 className="text-neutral-400 text-sm mb-2">Firebase Spark Plan</h4>
                  <div className="text-white font-bold">免費</div>
                  <p className="text-neutral-500 text-xs mt-1">50K 讀取/日</p>
                </div>
                <div className="bg-[#1a1a1a] rounded-lg p-4">
                  <h4 className="text-neutral-400 text-sm mb-2">Cloudinary Free</h4>
                  <div className="text-white font-bold">免費</div>
                  <p className="text-neutral-500 text-xs mt-1">25GB 存儲 + 25GB 流量</p>
                </div>
                <div className="bg-[#1a1a1a] rounded-lg p-4">
                  <h4 className="text-neutral-400 text-sm mb-2">API 費用</h4>
                  <div className="text-white font-bold">免費</div>
                  <p className="text-neutral-500 text-xs mt-1">Spotify/YouTube/Wiki</p>
                </div>
              </div>
            </div>

            <div className="bg-[#121212] rounded-xl p-6 border border-neutral-800">
              <h3 className="text-white font-bold mb-4">📊 付費升級方案對比</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <CostCard
                  tier="現階段"
                  price="$0/月"
                  users="~10,000 用戶"
                  features={['100GB 流量', '50K 讀取/日', '25GB 存儲', '基礎支援']}
                />
                <CostCard
                  tier="成長期"
                  price="~$50/月"
                  users="~50,000 用戶"
                  features={['Vercel Pro ($20)', 'Firebase Blaze ($20-30)', 'Cloudinary Plus ($25)', '優先支援']}
                  recommended
                />
                <CostCard
                  tier="大規模"
                  price="~$200/月"
                  users="~200,000 用戶"
                  features={['Vercel Pro', 'Firebase + CDN', '專屬數據庫', '24/7 監控']}
                />
              </div>
            </div>
          </div>
        )}

        {/* Scaling Tab */}
        {activeTab === 'scaling' && (
          <div className="space-y-6">
            <div className="bg-[#121212] rounded-xl p-6 border border-neutral-800">
              <h3 className="text-white font-bold mb-4">🚀 擴展時間線</h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-20 text-right text-[#FFD700] font-bold">現階段</div>
                  <div className="flex-1 pb-4 border-l-2 border-neutral-700 pl-4">
                    <h4 className="text-white font-bold">0 - 10,000 用戶</h4>
                    <p className="text-neutral-400 text-sm">全部免費方案足夠，無需任何升級</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-20 text-right text-[#FFD700] font-bold">第1階段</div>
                  <div className="flex-1 pb-4 border-l-2 border-neutral-700 pl-4">
                    <h4 className="text-white font-bold">10,000 - 50,000 用戶</h4>
                    <ul className="text-neutral-400 text-sm space-y-1 mt-2">
                      <li>• Vercel Pro ($20) - 1TB 流量 + 團隊功能</li>
                      <li>• Firebase Blaze Pay-as-you-go - 約 $20-30/月</li>
                      <li>• Cloudinary Plus ($25) - 225GB 存儲</li>
                    </ul>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-20 text-right text-[#FFD700] font-bold">第2階段</div>
                  <div className="flex-1 pb-4 border-l-2 border-neutral-700 pl-4">
                    <h4 className="text-white font-bold">50,000+ 用戶</h4>
                    <ul className="text-neutral-400 text-sm space-y-1 mt-2">
                      <li>• 考慮自建伺服器（DigitalOcean/AWS）- 更便宜的數據庫</li>
                      <li>• CDN 加速（CloudFlare Pro $20）</li>
                      <li>• 數據庫讀寫分離</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#121212] rounded-xl p-6 border border-neutral-800">
              <h3 className="text-white font-bold mb-4">⚠️ 瓶頸預警指標</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
                  <h4 className="text-yellow-200 font-bold mb-2">🟡 YouTube API 配額</h4>
                  <p className="text-yellow-200/80 text-sm">
                    每日 100 次搜尋，用戶多時會超額。<br/>
                    解決：申請額外配額或改用 Spotify-only
                  </p>
                </div>
                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                  <h4 className="text-red-200 font-bold mb-2">🔴 Firebase 讀取上限</h4>
                  <p className="text-red-200/80 text-sm">
                    每日 50,000 次讀取，超額會被拒絕。<br/>
                    解決：啟用快取、升級 Blaze Plan
                  </p>
                </div>
                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                  <h4 className="text-blue-200 font-bold mb-2">🔵 Cloudinary 流量</h4>
                  <p className="text-blue-200/80 text-sm">
                    25GB/月圖片流量，大量圖片會超額。<br/>
                    解決：降級圖片質量或升級 Plus
                  </p>
                </div>
                <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-4">
                  <h4 className="text-purple-200 font-bold mb-2">🟣 Vercel 函數超時</h4>
                  <p className="text-purple-200/80 text-sm">
                    Hobby Plan 10秒超時，複雜操作會失敗。<br/>
                    解決：升級 Pro（60秒）或優化代碼
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#121212] rounded-xl p-6 border border-neutral-800">
              <h3 className="text-white font-bold mb-4">🛠️ 維護指南（給 Admin）</h3>
              <div className="space-y-3 text-sm text-neutral-300">
                <div className="flex gap-3">
                  <Settings className="text-[#FFD700] flex-shrink-0" size={18} />
                  <div>
                    <strong className="text-white">Firebase Console</strong>
                    <p className="text-neutral-400">monitor usage, check database, view logs</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Shield className="text-[#FFD700] flex-shrink-0" size={18} />
                  <div>
                    <strong className="text-white">Vercel Dashboard</strong>
                    <p className="text-neutral-400">view deployments, check errors, monitor traffic</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Cloud className="text-[#FFD700] flex-shrink-0" size={18} />
                  <div>
                    <strong className="text-white">Cloudinary Console</strong>
                    <p className="text-neutral-400">manage images, check storage usage</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

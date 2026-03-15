import Head from 'next/head'
import Link from '@/components/Link'
import { ArrowLeft } from 'lucide-react'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-white mb-3 border-b border-neutral-800 pb-2">{title}</h2>
      {children}
    </div>
  )
}

function CacheTable({ rows }) {
  return (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[#B3B3B3] border-b border-neutral-800">
            <th className="py-2 pr-3 font-medium">快取層</th>
            <th className="py-2 pr-3 font-medium">位置</th>
            <th className="py-2 font-medium">TTL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-neutral-800/50">
              <td className="py-2 pr-3 text-[#FFD700] whitespace-nowrap">{r.layer}</td>
              <td className="py-2 pr-3 text-white font-mono text-xs">{r.location}</td>
              <td className="py-2 text-[#B3B3B3] whitespace-nowrap">{r.ttl}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Code({ children }) {
  return <code className="bg-neutral-800 text-[#FFD700] px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
}

function FlowDiagram({ steps }) {
  return (
    <div className="bg-neutral-900 rounded-lg p-4 mb-4 font-mono text-xs leading-relaxed text-[#B3B3B3]">
      {steps.map((step, i) => (
        <div key={i}>
          <span className="text-white">{step.text}</span>
          {step.children && (
            <div className="ml-2">
              {step.children.map((child, j) => (
                <div key={j} className="text-[#B3B3B3]">
                  {child.connector} <span className="text-white">{child.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function CacheDocs() {
  return (
    <AdminGuard>
      <Layout>
        <Head><title>快取架構 | 後台</title></Head>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/admin" className="text-[#B3B3B3] hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
            <h1 className="text-xl font-bold">快取架構 Cache Architecture</h1>
          </div>

          {/* Overview */}
          <Section title="快取層級總覽">
            <p className="text-[#B3B3B3] text-sm mb-3">請求依序經過以下快取層，命中任何一層即返回：</p>
            <div className="bg-neutral-900 rounded-lg p-4 mb-4 font-mono text-xs leading-loose text-center">
              <div className="text-white">客戶端 localStorage</div>
              <div className="text-[#B3B3B3]">↓ miss</div>
              <div className="text-white">Vercel CDN (s-maxage)</div>
              <div className="text-[#B3B3B3]">↓ miss</div>
              <div className="text-white">伺服器 in-memory</div>
              <div className="text-[#B3B3B3]">↓ miss</div>
              <div className="text-white">Firestore cache 文件 (cache/*)</div>
              <div className="text-[#B3B3B3]">↓ miss</div>
              <div className="text-[#FFD700]">Firestore 原始集合 (tabs, artists...)</div>
            </div>
          </Section>

          {/* Search Data */}
          <Section title="1. 搜尋資料 Search Data">
            <p className="text-[#B3B3B3] text-sm mb-3">
              搜尋頁、歌手列表應該在 1 分鐘內看到更新資料。在「1 分鐘內看到更新」已足夠的前提下，保留 30／45 秒快取可以減少 Firestore 讀取、加快回應，又不會影響使用體驗。
            </p>
            <CacheTable rows={[
              { layer: 'Firestore', location: 'cache/searchData', ttl: '永不過期' },
              { layer: '伺服器 in-memory', location: '_apiResponseCache', ttl: '45 秒' },
              { layer: 'Vercel CDN', location: 'HTTP header', ttl: '30 秒 fresh + 30 秒 stale' },
              { layer: '客戶端 localStorage', location: 'searchPageData', ttl: '45 秒' },
            ]} />
            <p className="text-sm text-[#B3B3B3] mb-2">
              Firestore 快取沒有時間過期，只會在下列操作發生時被寫入或修補。
            </p>
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[#B3B3B3] border-b border-neutral-800">
                    <th className="py-1.5 pr-2 font-medium">類型</th>
                    <th className="py-1.5 font-medium">觸發時機</th>
                  </tr>
                </thead>
                <tbody className="text-[#B3B3B3]">
                  <tr className="border-b border-neutral-800/50"><td className="py-1.5 pr-2 text-[#FFD700]">增量</td><td className="py-1.5">新增樂譜（tabs/new、new-tablature 儲存後）</td></tr>
                  <tr className="border-b border-neutral-800/50"><td className="py-1.5 pr-2 text-[#FFD700]">增量</td><td className="py-1.5">編輯樂譜（tabs/[id]/edit 儲存後）</td></tr>
                  <tr className="border-b border-neutral-800/50"><td className="py-1.5 pr-2 text-[#FFD700]">增量</td><td className="py-1.5">刪除樂譜（樂譜頁或編輯頁刪除後）</td></tr>
                  <tr className="border-b border-neutral-800/50"><td className="py-1.5 pr-2 text-[#FFD700]">增量</td><td className="py-1.5">編輯歌手（artists/[id]/edit 或 artists-v2 儲存後）</td></tr>
                  <tr className="border-b border-neutral-800/50"><td className="py-1.5 pr-2 text-[#FFD700]">全量</td><td className="py-1.5">首頁設置 → 重建搜尋快取</td></tr>
                  <tr className="border-b border-neutral-800/50"><td className="py-1.5 pr-2 text-[#FFD700]">全量</td><td className="py-1.5">排序/Tier 或 地區設定 儲存後</td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Home Data */}
          <Section title="2. 首頁資料 Home Data">
            <p className="text-[#B3B3B3] text-sm mb-3">
              供首頁使用，包含分類歌手、熱門歌手、熱門歌曲、歌單等區塊資料。
            </p>
            <CacheTable rows={[
              { layer: 'Firestore', location: 'cache/homePage', ttl: '永不過期' },
              { layer: '伺服器 in-memory', location: '_homeApiCache', ttl: '45 秒' },
              { layer: 'Vercel CDN', location: 'HTTP header', ttl: '30 秒 fresh + 30 秒 stale' },
              { layer: '客戶端 localStorage', location: 'pg_home_cache_v2', ttl: '45s' },
            ]} />
          </Section>

          {/* Invalidation Flows */}
          <Section title="3. 失效流程 Invalidation Flows">
            <h3 className="text-white font-medium text-sm mb-2">新增/更新樂譜</h3>
            <FlowDiagram steps={[
              { text: '用戶保存樂譜' },
              { text: '  ↓ createTab() / updateTab()' },
              { text: '  ↓ POST /api/patch-caches-on-new-tab', children: [
                { connector: '├──', text: '修補 cache/searchData' },
                { connector: '├──', text: '修補 cache/homePage' },
                { connector: '└──', text: '刪除 cache/artistPage_{artistId}' },
              ]},
            ]} />

            <h3 className="text-white font-medium text-sm mb-2">新增/更新歌手</h3>
            <FlowDiagram steps={[
              { text: '用戶保存歌手' },
              { text: '  ↓ updateDoc(artists/{id})' },
              { text: '  ↓ POST /api/patch-caches-on-new-tab (update-artist)', children: [
                { connector: '├──', text: '修補 cache/searchData artists 陣列' },
                { connector: '└──', text: '刪除 cache/artistPage_{id}' },
              ]},
            ]} />

          </Section>

          {/* Notes */}
          <Section title="4. 注意事項">
            <ul className="text-sm text-[#B3B3B3] space-y-2 list-disc pl-5">
              <li><span className="text-white">Firestore 文件大小限制：</span>單一文件最大 1MB。<Code>patch-caches-on-new-tab</Code> 修補前會檢查大小，超過限制時跳過（需手動全量重建）。</li>
              <li><span className="text-white">artistId 為唯一識別：</span>搜尋和首頁資料中的 tab 只存 <Code>artistId</Code>（Firestore 文件 ID），歌手名從 <Code>artists</Code> 陣列解析。歌手改名後只需更新 artists 陣列。</li>
              <li><span className="text-white">CDN 延遲：</span>即使 Firestore 快取已更新，CDN 仍可能在 s-maxage 期間返回舊資料。搜尋/首頁/歌手頁均 30+30 秒（延遲 &lt; 1 分鐘）。</li>
              <li><span className="text-white">冷啟動：</span>serverless 函數冷啟動後 in-memory 快取會清空，需重新從 Firestore cache 文件讀取。</li>
            </ul>
          </Section>

          <p className="text-center text-neutral-600 text-xs mt-4 mb-8">
            詳細原始碼請參考 <Code>docs/caching.md</Code>
          </p>
        </div>
      </Layout>
    </AdminGuard>
  )
}

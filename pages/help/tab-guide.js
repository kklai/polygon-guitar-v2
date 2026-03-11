import Layout from '@/components/Layout'
import Link from '@/components/Link'

export default function TabGuide() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            🎸 如何出一份靚譜
          </h1>
          <p className="text-gray-400">
            完整教學：由格式到資料填寫，讓你的譜更專業
          </p>
        </div>

        {/* Quick Start */}
        <div className="bg-[#121212] rounded-xl border border-[#FFD700]/30 p-6 mb-6">
          <h2 className="text-lg font-bold text-[#FFD700] mb-4">🚀 快速開始</h2>
          <div className="space-y-3 text-gray-300">
            <p>1. <Link href="/tabs/new" className="text-[#FFD700] hover:underline">點擊這裡出譜</Link></p>
            <p>2. 確保你已登入（支援 Google 帳號）</p>
            <p>3. 填好歌名、歌手、原調</p>
            <p>4. 貼上譜內容，系統會自動對齊</p>
            <p>5. 填寫作曲、填詞、編譜者資料</p>
            <p>6. 提交！</p>
          </div>
        </div>

        {/* Section Markers */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">🏷️ 段落標記（Section Markers）</h2>
          <p className="text-gray-400 mb-4">
            用段落標記可以清楚分開歌曲不同部分。支援完整英文名稱或縮寫：
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div className="bg-black rounded-lg p-3">
              <code className="text-[#FFD700]">/v</code>
              <span className="text-gray-400 ml-2">→ Verse（主歌）</span>
            </div>
            <div className="bg-black rounded-lg p-3">
              <code className="text-[#FFD700]">/c</code>
              <span className="text-gray-400 ml-2">→ Chorus（副歌）</span>
            </div>
            <div className="bg-black rounded-lg p-3">
              <code className="text-[#FFD700]">/p</code>
              <span className="text-gray-400 ml-2">→ Pre-chorus</span>
            </div>
            <div className="bg-black rounded-lg p-3">
              <code className="text-[#FFD700]">/b</code>
              <span className="text-gray-400 ml-2">→ Bridge（橋段）</span>
            </div>
            <div className="bg-black rounded-lg p-3">
              <code className="text-[#FFD700]">/i</code>
              <span className="text-gray-400 ml-2">→ Intro（前奏）</span>
            </div>
            <div className="bg-black rounded-lg p-3">
              <code className="text-[#FFD700]">/o</code>
              <span className="text-gray-400 ml-2">→ Outro（尾奏）</span>
            </div>
          </div>
          
          <p className="text-sm text-gray-500">
            也支援 /v1, /v2, /c1, /c2 等帶數字版本
          </p>
        </div>

        {/* Comment/Note */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">💬 加入旁白/提示</h2>
          <p className="text-gray-400 mb-4">
            想加入彈奏提示或旁白？用 <code className="text-[#FFD700] bg-black px-2 py-1 rounded">//</code> 開頭：
          </p>
          
          <div className="bg-black rounded-lg p-4 font-mono text-sm">
            <p className="text-gray-500">/v</p>
            <p className="text-gray-300">|C      G/B    |Am     F</p>
            <p className="text-gray-300">(這裡)可以(加)入旁白</p>
            <p className="text-gray-400 italic text-xs mt-2">// 這行會顯示為斜體細字</p>
          </div>
        </div>

        {/* Tab Format */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">📝 譜的格式</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-[#FFD700] font-medium mb-2">基本格式</h3>
              <div className="bg-black rounded-lg p-4 font-mono text-sm text-gray-300">
                <p>|C      G/B    |Am     F</p>
                <p>(暗)如何(蠶)食了(光)</p>
              </div>
            </div>

            <div>
              <h3 className="text-[#FFD700] font-medium mb-2">Capo 表示法</h3>
              <p className="text-gray-400 text-sm mb-2">
                只需填寫 Capo 格數，系統會自動計算彈奏調性：
              </p>
              <ul className="text-gray-400 text-sm list-disc list-inside space-y-1">
                <li>原調：C</li>
                <li>Capo：4</li>
                <li>系統自動顯示「Key: E (Capo 4) Play C」</li>
              </ul>
            </div>

            <div>
              <h3 className="text-[#FFD700] font-medium mb-2">空行處理</h3>
              <p className="text-gray-400 text-sm">
                輸入空行會保留為真正的空行，用於分隔不同段落。
              </p>
            </div>
          </div>
        </div>

        {/* Important Fields */}
        <div className="bg-[#1a1a2e] rounded-xl border border-[#FFD700]/30 p-6 mb-6">
          <h2 className="text-lg font-bold text-[#FFD700] mb-4">⭐ 重要：請填寫這些資料</h2>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎵</span>
              <div>
                <h3 className="text-white font-medium">作曲 & 填詞</h3>
                <p className="text-gray-400 text-sm">
                  尊重音樂創作人，請務必填寫。不確定的話可以查 Wikipedia 或 Spotify。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-2xl">✏️</span>
              <div>
                <h3 className="text-white font-medium">編譜者筆名</h3>
                <p className="text-gray-400 text-sm">
                  這是辨識你作品的方式！建議先到 
                  <Link href="/profile/edit" className="text-[#FFD700] hover:underline">個人資料</Link>
                  設定固定筆名，出譜時會自動帶入。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-2xl">📅</span>
              <div>
                <h3 className="text-white font-medium">歌曲年份</h3>
                <p className="text-gray-400 text-sm">
                  有助於分類和了解歌曲背景。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-2xl">🎬</span>
              <div>
                <h3 className="text-white font-medium">YouTube 連結</h3>
                <p className="text-gray-400 text-sm">
                  提供參考影片，方便其他人學習。系統會自動提取縮圖。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pen Name Setup */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">✏️ 設定你的編譜者筆名</h2>
          
          <div className="space-y-4 text-gray-300">
            <p>
              我們建議設定一個固定的編譜者筆名，這樣：
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>所有你的譜都會統一顯示「編譜：xxx」</li>
              <li>其他用戶可以辨識你的作品</li>
              <li>建立個人品牌</li>
            </ul>
            
            <div className="bg-[#1a1a2e] rounded-lg p-4 mt-4">
              <p className="text-[#FFD700] font-medium mb-2">設定方法：</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-400">
                <li>前往 <Link href="/profile/edit" className="text-[#FFD700] hover:underline">個人資料設定</Link></li>
                <li>找到「編譜者筆名」欄位</li>
                <li>輸入你想使用的名稱（如：結他小王子、Kermit Guitar）</li>
                <li>保存！之後出譜會自動帶入</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">💡 進階技巧</h2>
          
          <div className="space-y-3 text-gray-300">
            <div className="flex items-start gap-2">
              <span className="text-[#FFD700]">•</span>
              <p>從其他網站複製譜時，選擇「Arial」字體模式可以保留原有格式</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#FFD700]">•</span>
              <p>使用「自動修正對齊」功能可以修復貼上來的譜</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#FFD700]">•</span>
              <p>出譜後可以用「編輯」功能修改任何資料</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#FFD700]">•</span>
              <p>歌手相片會自動從 Wikipedia 獲取，你也可以手動上傳</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-8">
          <Link
            href="/tabs/new"
            className="inline-block px-8 py-4 bg-[#FFD700] text-black rounded-xl font-bold text-lg hover:opacity-90 transition"
          >
            🎸 開始出譜
          </Link>
          <p className="text-gray-500 mt-4">
            有任何問題？聯絡我們
          </p>
        </div>
      </div>
    </Layout>
  )
}

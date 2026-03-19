import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { GuitarTabEditor } from '../../components/TabEditor/GuitarTabEditor';
import Layout from '../../components/Layout';

/**
 * 六線譜編輯器頁面
 * CSS 像真六線譜 + 聲音播放
 */
export default function SixLineEditorPage() {
  const [tabData, setTabData] = useState(null);
  
  return (
    <Layout>
      <div className="min-h-screen bg-black">
        {/* Header */}
        <div className="bg-[#121212] border-b border-neutral-800">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white">六線譜編輯器</h1>
                <p className="text-sm text-neutral-400">點擊弦上位置輸入音符，數字鍵 0-9 輸入品數</p>
              </div>
              <button onClick={() => window.history.back()}
                className="p-2 bg-[#282828] hover:bg-[#3E3E3E] text-white rounded"
                aria-label="返回">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* 編輯器 */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          <GuitarTabEditor onChange={setTabData} />
          
          {/* 幫助 */}
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <div className="bg-[#121212] rounded-xl border border-neutral-800 p-4">
              <h2 className="text-sm font-bold text-white mb-3">⌨️ 快捷鍵</h2>
              <div className="space-y-1 text-xs text-neutral-400">
                <div className="flex justify-between"><span>數字 0-9</span><span className="text-white">輸入品數</span></div>
                <div className="flex justify-between"><span>連續兩個數字</span><span className="text-white">兩位數品數 (10-24)</span></div>
                <div className="flex justify-between"><span>+ / -</span><span className="text-white">切換時值</span></div>
                <div className="flex justify-between"><span>方向鍵</span><span className="text-white">移動位置</span></div>
                <div className="flex justify-between"><span>Delete</span><span className="text-white">刪除音符</span></div>
                <div className="flex justify-between"><span>Space</span><span className="text-white">播放/停止</span></div>
              </div>
            </div>
            
            <div className="bg-[#121212] rounded-xl border border-neutral-800 p-4">
              <h2 className="text-sm font-bold text-white mb-3">使用說明</h2>
              <ul className="text-xs text-neutral-400 space-y-1">
                <li>• 點擊六條弦上嘅位置選中拍子</li>
                <li>• 用數字鍵輸入品數（0-9）</li>
                <li>• 音符會顯示喺對應嘅弦上面</li>
                <li>• 切換時值會改變符尾（♪ ♬）</li>
                <li>• 輸入時會即時發聲（結他聲）</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

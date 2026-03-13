import { useEffect, useRef } from 'react';

/**
 * 簡化版六線譜顯示組件
 * 用於文字譜中嵌入簡單六線譜片段
 * 不播放，僅顯示 ASCII 格式
 */
export default function TablatureViewerSimple({ lines = [] }) {
  if (!lines || lines.length === 0) return null;

  return (
    <div className="bg-[#0a0a0a] rounded-lg p-4 overflow-x-auto font-mono text-sm">
      <div className="text-neutral-300 whitespace-pre">
        {lines.map((line, i) => (
          <div key={i} className="leading-tight">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

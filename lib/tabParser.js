/**
 * 簡單樂譜格式整理器
 * 1. 全型空格 → 半型
 * 2. 多個空格 → 單一個
 * 3. Tab → 空格
 * 4. 保留換行
 * 5. 清理多餘空行
 */

export function cleanTabContent(content) {
  if (!content) return ''
  
  return content
    // 全型空格、Tab、換行符號統一
    .replace(/\t/g, ' ')           // Tab → 空格
    .replace(/　/g, ' ')           // 全型空格 → 半型
    .replace(/ +/g, ' ')           // 多個空格 → 單一個
    .replace(/ +\n/g, '\n')        // 行尾空格清除
    .replace(/\n +/g, '\n')        // 行首空格清除
    .replace(/\n{3,}/g, '\n\n')    // 3個以上換行 → 2個（保留段落）
    .trim()                        // 頭尾空白清除
}

/**
 * 檢查是否為和弦行
 */
export function isChordLine(line) {
  if (!line || line.trim() === '') return false
  
  const trimmed = line.trim()
  
  // 簡單判斷：包含常見和弦符號，且冇明顯中文
  const hasChord = /\b[A-G][#b]?(maj|mj|m|min|dim|aug|sus|add)?\d*(\/[A-G][#b]?)?\b/.test(trimmed)
  const chineseCount = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length
  const totalChars = trimmed.replace(/\s/g, '').length
  
  // 有和弦符號，且中文字佔比低於30%
  return hasChord && (chineseCount / totalChars < 0.3)
}

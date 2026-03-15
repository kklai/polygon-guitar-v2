/**
 * 從譜內容或貼上文字解析作曲／填詞／編曲／監製
 * 支援：作曲/曲、作詞/填詞/詞、編曲/編、監製/監；[：:] = 全形：或半形:
 * @param {string} text
 * @returns {{ composer: string, lyricist: string, arranger: string, producer: string } | null}
 */
export function parseCreditBlock(text) {
  if (!text || typeof text !== 'string') return null
  const t = text.trim()
  const composer = t.match(/(?:作曲|曲)[：:]\s*([^\n]+)/)?.[1]?.trim() || ''
  const lyricist = t.match(/(?:作詞|填詞|詞)[：:]\s*([^\n]+)/)?.[1]?.trim() || ''
  const arrangerRaw = t.match(/(?:編曲|編)[：:]\s*([^\n]+)/)?.[1]?.trim() || ''
  const arranger = arrangerRaw.replace(/\s*監(?:製)?[：:].*$/, '').trim()
  const producer = t.match(/(?:監製|監)[：:]\s*([^\n]+)/)?.[1]?.trim() || ''
  if (!composer && !lyricist && !arranger && !producer) return null
  return { composer, lyricist, arranger, producer }
}

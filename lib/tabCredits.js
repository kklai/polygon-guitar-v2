/**
 * 從譜內容或貼上文字解析作曲／填詞／編曲／監製
 * 作曲／填詞／編曲／監製 每個都支援多個值，合併時用 /
 * 支援兩種格式：
 * 1) 中文關鍵字：作曲/曲、作詞/填詞/詞、編曲/編、監製/監；[：:] = 全形：或半形:
 * 2) 英文角色（名在上、角色在下）：Composer / Lyricist / Arranger / Producer
 * @param {string} text
 * @returns {{ composer: string, lyricist: string, arranger: string, producer: string } | null}
 */
function matchAllCredits(t, keywordRegex) {
  const matches = [...t.matchAll(keywordRegex)]
  return matches.map(m => m[1].trim()).filter(Boolean).join('/')
}

export function parseCreditBlock(text) {
  if (!text || typeof text !== 'string') return null
  const t = text.trim()
  let composer = ''
  let lyricist = ''
  let arranger = ''
  let producer = ''

  // 格式一：作曲：xxx 作詞：xxx 編曲：xxx 監製：xxx（可重複多個，全部用 / 合併）
  const composerRe = /(?:作曲|曲)[：:]\s*([^\n]+?)(?=\s*(?:作詞|填詞|詞|編曲|編|監製|監)[：:]|\s*$|\n)/g
  const lyricistRe = /(?:作詞|填詞|詞)[：:]\s*([^\n]+?)(?=\s*(?:作曲|曲|編曲|編|監製|監)[：:]|\s*$|\n)/g
  const arrangerRe = /(?:編曲|編)[：:]\s*([^\n]+?)(?=\s*(?:作曲|曲|作詞|填詞|詞|監製|監)[：:]|\s*$|\n)/g
  const producerRe = /(?:監製|監)[：:]\s*([^\n]+?)(?=\s*(?:作曲|曲|作詞|填詞|詞|編曲|編)[：:]|\s*$|\n)/g
  composer = matchAllCredits(t, composerRe)
  lyricist = matchAllCredits(t, lyricistRe)
  const arrangerParts = [...t.matchAll(arrangerRe)].map(m => m[1].trim().replace(/\s*監(?:製)?[：:].*$/, '').trim()).filter(Boolean)
  arranger = arrangerParts.join('/')
  producer = matchAllCredits(t, producerRe)

  // 格式二：名在上、英文角色在下（如 Spotify 複製）；每個角色可出現多次，用 / 合併
  const roleLine = /^(Composer|Lyricist|Arranger|Producer|Production\s*&\s*Engineering)$/i
  const lines = t.split(/\r?\n/).map(l => l.trim())
  const composers = []
  const lyricists = []
  const arrangers = []
  const producers = []
  for (let i = 0; i < lines.length; i++) {
    if (!roleLine.test(lines[i])) continue
    const role = lines[i].toLowerCase()
    const prev = lines[i - 1]?.trim()
    const name = prev && prev !== 'Production & Engineering' ? prev : ''
    if (!name) continue
    if (role === 'composer') composers.push(name)
    else if (role === 'lyricist') lyricists.push(name)
    else if (role === 'arranger') arrangers.push(name)
    else if (role === 'producer') producers.push(name)
  }
  if (composers.length) composer = composer ? composer + '/' + composers.join('/') : composers.join('/')
  if (lyricists.length) lyricist = lyricist ? lyricist + '/' + lyricists.join('/') : lyricists.join('/')
  if (arrangers.length) arranger = arranger ? arranger + '/' + arrangers.join('/') : arrangers.join('/')
  if (producers.length) producer = producer ? producer + '/' + producers.join('/') : producers.join('/')

  if (!composer && !lyricist && !arranger && !producer) return null
  return { composer, lyricist, arranger, producer }
}

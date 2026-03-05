import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { Search, Loader2, Music, Youtube, ExternalLink, Copy, Check, Type } from 'lucide-react'

// 簡體轉繁體對照表（常用字）
const SIMPLIFIED_TO_TRADITIONAL = {
  '爱': '愛', '儿': '兒', '发': '發', '发': '髮', '风': '風', '个': '個', '国': '國',
  '过': '過', '话': '話', '会': '會', '几': '幾', '间': '間', '见': '見', '经': '經',
  '觉': '覺', '开': '開', '来': '來', '里': '裡', '两': '兩', '吗': '嗎', '买': '買',
  '卖': '賣', '们': '們', '难': '難', '气': '氣', '请': '請', '让': '讓', '认': '認',
  '说': '說', '识': '識', '时': '時', '实': '實', '书': '書', '数': '數', '岁': '歲',
  '听': '聽', '为': '為', '问': '問', '无': '無', '兴': '興', '学': '學', '样': '樣',
  '应': '應', '这': '這', '种': '種', '总': '總', '从': '從', '办': '辦', '笔': '筆',
  '长': '長', '场': '場', '车': '車', '称': '稱', '处': '處', '传': '傳', '达': '達',
  '带': '帶', '单': '單', '当': '當', '党': '黨', '东': '東', '动': '動', '对': '對',
  '队': '隊', '观': '觀', '关': '關', '还': '還', '后': '後', '华': '華', '画': '畫',
  '回': '回', '汇': '匯', '机': '機', '级': '級', '计': '計', '记': '記', '纪': '紀',
  '夹': '夾', '坚': '堅', '间': '間', '将': '將', '奖': '獎', '讲': '講', '胶': '膠',
  '阶': '階', '节': '節', '结': '結', '紧': '緊', '进': '進', '尽': '盡', '劲': '勁',
  '旧': '舊', '举': '舉', '剧': '劇', '据': '據', '决': '決', '绝': '絕', '军': '軍',
  '开': '開', '壳': '殼', '克': '剋', '况': '況', '扩': '擴', '兰': '蘭', '览': '覽',
  '乐': '樂', '类': '類', '离': '離', '里': '裏', '礼': '禮', '历': '歷', '联': '聯',
  '炼': '煉', '练': '練', '粮': '糧', '凉': '涼', '了': '了', '龄': '齡', '龙': '龍',
  '楼': '樓', '录': '錄', '陆': '陸', '乱': '亂', '吗': '嗎', '迈': '邁', '满': '滿',
  '慢': '慢', '漫': '漫', '忙': '忙', '猫': '貓', '毛': '毛', '贸': '貿', '门': '門',
  '梦': '夢', '面': '麵', '庙': '廟', '灭': '滅', '亩': '畝', '幕': '幕', '纳': '納',
  '难': '難', '鸟': '鳥', '宁': '寧', '农': '農', '诺': '諾', '盘': '盤', '赔': '賠',
  '评': '評', '朴': '樸', '齐': '齊', '气': '氣', '钱': '錢', '强': '強', '乔': '喬',
  '亲': '親', '轻': '輕', '穷': '窮', '区': '區', '确': '確', '让': '讓', '热': '熱',
  '认': '認', '荣': '榮', '软': '軟', '洒': '灑', '伞': '傘', '丧': '喪', '扫': '掃',
  '涩': '澀', '杀': '殺', '晒': '曬', '闪': '閃', '伤': '傷', '赏': '賞', '烧': '燒',
  '绍': '紹', '舍': '捨', '设': '設', '声': '聲', '胜': '勝', '绳': '繩', '湿': '濕',
  '师': '師', '诗': '詩', '时': '時', '识': '識', '实': '實', '势': '勢', '视': '視',
  '试': '試', '饰': '飾', '适': '適', '释': '釋', '寿': '壽', '兽': '獸', '书': '書',
  '术': '術', '树': '樹', '帅': '帥', '双': '雙', '谁': '誰', '顺': '順', '说': '說',
  '丝': '絲', '饲': '飼', '松': '鬆', '苏': '蘇', '虽': '雖', '随': '隨', '岁': '歲',
  '孙': '孫', '损': '損', '缩': '縮', '所': '所', '锁': '鎖', '它': '它', '台': '臺',
  '态': '態', '坛': '壇', '贪': '貪', '谈': '談', '汤': '湯', '烫': '燙', '涛': '濤',
  '讨': '討', '腾': '騰', '题': '題', '体': '體', '条': '條', '铁': '鐵', '听': '聽',
  '厅': '廳', '头': '頭', '图': '圖', '团': '團', '推': '推', '托': '託', '脱': '脫',
  '瓦': '瓦', '弯': '彎', '万': '萬', '网': '網', '往': '往', '忘': '忘', '望': '望',
  '为': '為', '卫': '衛', '伟': '偉', '伪': '偽', '文': '文', '闻': '聞', '问': '問',
  '窝': '窩', '我': '我', '无': '無', '吴': '吳', '五': '五', '武': '武', '务': '務',
  '误': '誤', '夕': '夕', '西': '西', '吸': '吸', '希': '希', '息': '息', '习': '習',
  '喜': '喜', '系': '係', '细': '細', '戏': '戲', '吓': '嚇', '下': '下', '夏': '夏',
  '先': '先', '鲜': '鮮', '闲': '閒', '显': '顯', '险': '險', '现': '現', '献': '獻',
  '线': '線', '县': '縣', '乡': '鄉', '相': '相', '响': '響', '项': '項', '向': '向',
  '象': '象', '像': '像', '晓': '曉', '小': '小', '效': '效', '校': '校', '些': '些',
  '写': '寫', '谢': '謝', '心': '心', '新': '新', '信': '信', '兴': '興', '星': '星',
  '行': '行', '型': '型', '形': '形', '姓': '姓', '凶': '兇', '兄': '兄', '雄': '雄',
  '休': '休', '修': '修', '须': '須', '许': '許', '叙': '敘', '绪': '緒', '续': '續',
  '选': '選', '悬': '懸', '学': '學', '雪': '雪', '血': '血', '寻': '尋', '训': '訓',
  '讯': '訊', '压': '壓', '亚': '亞', '讶': '訝', '严': '嚴', '言': '言', '岩': '岩',
  '研': '研', '盐': '鹽', '颜': '顏', '眼': '眼', '演': '演', '厌': '厭', '阳': '陽',
  '杨': '楊', '养': '養', '样': '樣', '阳': '陽', '腰': '腰', '摇': '搖', '药': '藥',
  '要': '要', '爷': '爺', '野': '野', '业': '業', '叶': '葉', '页': '頁', '夜': '夜',
  '一': '一', '衣': '衣', '医': '醫', '依': '依', '宜': '宜', '移': '移', '遗': '遺',
  '疑': '疑', '已': '已', '以': '以', '艺': '藝', '忆': '憶', '议': '議', '亦': '亦',
  '异': '異', '役': '役', '译': '譯', '易': '易', '疫': '疫', '益': '益', '谊': '誼',
  '意': '意', '义': '義', '亿': '億', '忆': '憶', '艺': '藝', '议': '議', '异': '異',
  '阴': '陰', '音': '音', '银': '銀', '引': '引', '饮': '飲', '隐': '隱', '印': '印',
  '应': '應', '英': '英', '婴': '嬰', '鹰': '鷹', '营': '營', '蝇': '蠅', '赢': '贏',
  '影': '影', '映': '映', '硬': '硬', '哟': '喲', '拥': '擁', '佣': '傭', '痈': '癰',
  '咏': '詠', '泳': '泳', '勇': '勇', '涌': '湧', '用': '用', '优': '優', '忧': '憂',
  '幽': '幽', '尤': '尤', '邮': '郵', '犹': '猶', '游': '遊', '友': '友', '有': '有',
  '又': '又', '右': '右', '幼': '幼', '诱': '誘', '于': '於', '予': '予', '余': '餘',
  '鱼': '魚', '娱': '娛', '渔': '漁', '愉': '愉', '愚': '愚', '榆': '榆', '与': '與',
  '予': '予', '屿': '嶼', '宇': '宇', '羽': '羽', '雨': '雨', '语': '語', '玉': '玉',
  '预': '預', '欲': '慾', '喻': '喻', '寓': '寓', '御': '禦', '遇': '遇', '愈': '癒',
  '誉': '譽', '豫': '豫', '冤': '冤', '元': '元', '园': '園', '员': '員', '原': '原',
  '圆': '圓', '袁': '袁', '缘': '緣', '远': '遠', '怨': '怨', '院': '院', '愿': '願',
  '曰': '曰', '约': '約', '月': '月', '岳': '嶽', '悦': '悅', '阅': '閱', '跃': '躍',
  '越': '越', '云': '雲', '匀': '勻', '允': '允', '运': '運', '酝': '醖', '晕': '暈',
  '韵': '韻', '蕴': '蘊', '杂': '雜', '灾': '災', '载': '載', '攒': '攢', '暂': '暫',
  '赞': '贊', '赃': '贓', '脏': '髒', '葬': '葬', '遭': '遭', '糟': '糟', '凿': '鑿',
  '早': '早', '枣': '棗', '澡': '澡', '藻': '藻', '灶': '竈', '皂': '皂', '造': '造',
  '噪': '噪', '燥': '燥', '躁': '躁', '则': '則', '择': '擇', '泽': '澤', '责': '責',
  '贼': '賊', '怎': '怎', '增': '增', '憎': '憎', '赠': '贈', '扎': '紮', '渣': '渣',
  '札': '札', '轧': '軋', '闸': '閘', '炸': '炸', '诈': '詐', '榨': '榨', '债': '債',
  '寨': '寨', '展': '展', '盏': '盞', '崭': '嶄', '占': '佔', '战': '戰', '站': '站',
  '绽': '綻', '章': '章', '张': '張', '涨': '漲', '帐': '帳', '账': '賬', '胀': '脹',
  '障': '障', '招': '招', '找': '找', '召': '召', '照': '照', '罩': '罩', '兆': '兆',
  '遮': '遮', '折': '摺', '哲': '哲', '辙': '轍', '者': '者', '这': '這', '浙': '浙',
  '针': '針', '珍': '珍', '真': '真', '诊': '診', '枕': '枕', '阵': '陣', '振': '振',
  '镇': '鎮', '震': '震', '睁': '睜', '争': '爭', '征': '徵', '睁': '睜', '筝': '箏',
  '蒸': '蒸', '整': '整', '正': '正', '证': '證', '郑': '鄭', '政': '政', '症': '症',
  '之': '之', '支': '支', '只': '隻', '芝': '芝', '枝': '枝', '知': '知', '织': '織',
  '肢': '肢', '脂': '脂', '蜘': '蜘', '执': '執', '直': '直', '值': '值', '职': '職',
  '植': '植', '殖': '殖', '止': '止', '旨': '旨', '址': '址', '指': '指', '纸': '紙',
  '志': '誌', '制': '製', '治': '治', '质': '質', '致': '緻', '秩': '秩', '智': '智',
  '置': '置', '稚': '稚', '中': '中', '忠': '忠', '终': '終', '钟': '鐘', '肿': '腫',
  '种': '種', '仲': '仲', '众': '眾', '舟': '舟', '州': '州', '周': '周', '洲': '洲',
  '粥': '粥', '轴': '軸', '肘': '肘', '帚': '帚', '皱': '皺', '昼': '晝', '骤': '驟',
  '朱': '朱', '株': '株', '诸': '諸', '猪': '豬', '竹': '竹', '烛': '燭', '逐': '逐',
  '主': '主', '煮': '煮', '嘱': '囑', '住': '住', '助': '助', '注': '註', '驻': '駐',
  '柱': '柱', '祝': '祝', '著': '著', '筑': '築', '铸': '鑄', '抓': '抓', '专': '專',
  '砖': '磚', '转': '轉', '赚': '賺', '庄': '莊', '桩': '樁', '装': '裝', '妆': '妝',
  '壮': '壯', '状': '狀', '撞': '撞', '追': '追', '准': '準', '捉': '捉', '桌': '桌',
  '卓': '卓', '茁': '茁', '着': '著', '仔': '仔', '兹': '茲', '咨': '諮', '资': '資',
  '姿': '姿', '滋': '滋', '紫': '紫', '仔': '仔', '子': '子', '字': '字', '自': '自',
  '宗': '宗', '棕': '棕', '踪': '蹤', '总': '總', '纵': '縱', '走': '走', '奏': '奏',
  '租': '租', '足': '足', '族': '族', '阻': '阻', '组': '組', '祖': '祖', '钻': '鑽',
  '嘴': '嘴', '最': '最', '罪': '罪', '醉': '醉', '尊': '尊', '遵': '遵', '昨': '昨',
  '左': '左', '佐': '佐', '作': '作', '坐': '坐', '座': '座', '做': '做', '詹': '詹',
  '鸿': '鴻', '庞': '龐', '庞': '龐', '隽': '雋'
}

// 簡體轉繁體函數
const toTraditional = (text) => {
  if (!text) return text
  return text.split('').map(char => SIMPLIFIED_TO_TRADITIONAL[char] || char).join('')
}

export default function QuickImport() {
  const router = useRouter()
  const { user, isAdmin } = useAuth()
  const [rawText, setRawText] = useState('')
  const [parsedData, setParsedData] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [youtubeResults, setYoutubeResults] = useState([])
  const [spotifyResult, setSpotifyResult] = useState(null)
  const [selectedYoutube, setSelectedYoutube] = useState(null)
  const [error, setError] = useState('')
  const [displayFont, setDisplayFont] = useState('mono') // 'mono' 或 'arial'

  // 解析原始文字
  const parseRawText = (text) => {
    if (!text.trim()) return null

    // 保留原始空格，但分割成行
    const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.trim())
    
    // 提取標題和歌手
    let title = ''
    let artists = []
    let composer = ''
    let lyricist = ''
    let originalKey = 'C'
    let capo = '0'
    let bpm = ''
    let contentLines = []
    let foundContentStart = false
    
    // UI 關鍵詞過濾列表
    const uiKeywords = [
      'CHORD LOG', '跟隨', '收藏列印', '列印Chord表', 'Chord表',
      'Beats字體', '雙頁並排', '回報問題', '標籤', '跟隨中',
      'Apple Music', '在 Apple Music', '聆聽', 'Key', 'CAPO'
    ]
    
    // 檢查是否為 UI 行
    const isUILine = (line) => {
      // 檢查關鍵詞（但排除可能是歌名的情況）
      for (const kw of uiKeywords) {
        if (line.includes(kw)) {
          // 對於 Key，如果它是行首且後面跟著音符，則是 UI
          if (kw === 'Key' && line.match(/^Key/i)) return true
          if (kw !== 'Key') return true
        }
      }
      
      // 檢查 Key 行（包含音符字母序列）
      if (line.match(/^Key\s+[A-G#b]+/i)) return true
      if (line.match(/\(預設\)/)) return true
      
      // 檢查 CAPO 行
      if (line.match(/^CAPO\s*\d*/i)) return true
      
      // 檢查純數字（瀏覽數）
      if (line.match(/^\d{3,}$/)) return true
      
      // 檢查純標記行
      if (line.length < 20 && ['Intro', 'Verse', 'Chorus', 'Bridge', 'Outro'].includes(line)) return true
      
      return false
    }

    // 第一遍：提取元數據（作曲、填詞、BPM）
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lowerLine = line.toLowerCase()
      
      // 提取作曲（支持同一行有作曲和填詞）
      if (lowerLine.includes('曲：') || lowerLine.includes('作曲：')) {
        // 提取曲：後面的內容，直到遇到詞/词：或行尾
        const match = line.match(/曲[：:]\s*([^詞词]*?)(?:[詞词][：:]|$)/)
        if (match) {
          composer = match[1].trim()
        } else {
          composer = line.replace(/.*曲[：:]/, '').trim()
        }
      }

      // 提取填詞（支持同一行有作曲和填詞）
      if (lowerLine.includes('詞：') || lowerLine.includes('词：') || lowerLine.includes('填詞：') || lowerLine.includes('作詞：')) {
        // 提取詞：後面的內容，直到遇到曲：或行尾
        const match = line.match(/[詞词][：:]\s*([^曲]*?)(?:曲[：:]|$)/)
        if (match) {
          lyricist = match[1].trim()
        } else {
          lyricist = line.replace(/.*[詞词][：:]/, '').trim()
        }
      }

      // 提取 BPM
      const bpmMatch = line.match(/Bpm\s*(\d+)/i)
      if (bpmMatch && !bpm) {
        bpm = bpmMatch[1]
      }
    }

    // 從 Key 行提取預設調性
    // 格式可能是 "Key\nCDb(預設)DEbEFF#GAbABbB" 或者 "Key CDb(預設)DEbEFF#GAbABbB"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.match(/^Key$/i) || line.match(/^Key\s/)) {
        // 檢查本行或下一行是否有 (預設)
        const checkLine = line.includes('(預設)') ? line : (lines[i + 1] || '')
        const defaultKeyMatch = checkLine.match(/([A-G][#b]?)\(預設\)/)
        if (defaultKeyMatch) {
          originalKey = defaultKeyMatch[1]
        }
      }
    }
    // 後備：直接搵任何包含 (預設) 嘅行
    if (originalKey === 'C') {
      for (const line of lines) {
        const match = line.match(/([A-G][#b]?)\(預設\)/)
        if (match) {
          originalKey = match[1]
          break
        }
      }
    }

    // 從 CAPO 行提取 Capo
    for (const line of lines) {
      if (line.match(/^CAPO/i)) {
        // 格式可能是 "CAPO 0 (Db)1 (C)..." 或者 "CAPO\n0 (Db)..."
        const capoMatch = line.match(/CAPO\s*(\d+)/i)
        if (capoMatch) {
          capo = capoMatch[1]
        }
      }
    }

    // 第二遍：提取標題和譜內容
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmedLine = line.trim()

      // 跳過 UI 行和已處理的字段
      if (isUILine(trimmedLine)) continue
      if (trimmedLine.includes('曲：') || trimmedLine.includes('詞：') || trimmedLine.includes('词：')) continue
      if (trimmedLine.match(/Bpm\s*\d+/i)) continue
      if (trimmedLine.includes('標籤')) continue
      if (trimmedLine.match(/^Key/i)) continue // 任何以 Key 開頭的行
      if (trimmedLine.match(/^CAPO/i)) continue // 任何以 CAPO 開頭的行
      if (trimmedLine.match(/\(預設\)/)) continue // 包含預設標記的行
      if (trimmedLine.match(/^[A-G][#b]?\(預設\)/)) continue // 例如 "Db(預設)"
      if (trimmedLine.match(/^[A-G][#b]?[A-G#b]+$/)) continue // 純音符序列如 "CDbDEbEFF#GAbABbB"
      
      // 檢測譜內容開始（包含 | 符號）
      if (trimmedLine.includes('|')) {
        foundContentStart = true
      }
      
      // 收集譜內容（保留原始空格）
      if (foundContentStart) {
        contentLines.push(line) // 使用原始行保留空格
      } else if (!title && trimmedLine.length < 60 && !trimmedLine.match(/^[A-G][#b]?[A-G#b]+$/)) {
        // 嘗試提取標題和歌手
        // 格式 1: "歌名 - 歌手" 或 "歌手 - 歌名"
        const separatorMatch = trimmedLine.match(/^(.+?)\s*[-–—]\s*(.+)$/) ||
                               trimmedLine.match(/^(.+?)\s*by\s*(.+)$/i) ||
                               trimmedLine.match(/^(.+?)\s*[|｜]\s*(.+)$/)
        
        if (separatorMatch) {
          const part1 = separatorMatch[1].trim()
          const part2 = separatorMatch[2].trim()
          
          // 判斷哪個是歌手（通常包含 &、+，或者已知歌手名）
          const knownArtists = ['薛之謙', '陳奕迅', '周杰倫', '五月天', '林俊傑', '鄧紫棋', '張學友', 'Gareth.T', 'MC 張天賦', '張天賦']
          const isPart1Artist = knownArtists.some(a => part1.includes(a)) || part1.includes('&') || part1.includes('、')
          const isPart2Artist = knownArtists.some(a => part2.includes(a)) || part2.includes('&') || part2.includes('、')
          
          if (isPart1Artist && !isPart2Artist) {
            artists = part1.split(/[&+、,]/).map(a => a.trim()).filter(a => a)
            title = part2
          } else if (isPart2Artist && !isPart1Artist) {
            artists = part2.split(/[&+、,]/).map(a => a.trim()).filter(a => a)
            title = part1
          } else {
            // 都像是或都不像，取較短的是歌名
            if (part1.length <= part2.length) {
              title = part1
              artists = [part2]
            } else {
              title = part2
              artists = [part1]
            }
          }
        } else {
          // 格式 2: 沒有分隔符，如 "租購薛之謙曲：董嘉鸿"
          // 先移除曲詞部分（支持簡繁）
          const cleanLine = trimmedLine.replace(/[曲詞词][:：].*$/, '').trim()
          
          if (cleanLine.length >= 2) {
            // 嘗試識別已知歌手
            const knownArtists = ['薛之謙', '陳奕迅', '周杰倫', '五月天', '林俊傑', '鄧紫棋', '張學友', 'Gareth.T', 'MC 張天賦', '張天賦', '楊千嬅', '容祖兒']
            let foundArtist = null
            let artistIndex = -1
            
            for (const artistName of knownArtists) {
              const idx = cleanLine.indexOf(artistName)
              if (idx !== -1) {
                foundArtist = artistName
                artistIndex = idx
                break
              }
            }
            
            if (foundArtist) {
              if (artistIndex === 0) {
                // 歌手在前
                title = cleanLine.substring(foundArtist.length).trim()
                artists = [foundArtist]
              } else {
                // 歌手在後
                title = cleanLine.substring(0, artistIndex).trim()
                artists = [foundArtist]
              }
            } else if (cleanLine.length <= 6) {
              // 短文字，可能是純歌名，但要排除 UI 關鍵詞
              const uiWords = ['Key', 'CAPO', 'Intro', 'Verse', 'Chorus', 'Bridge', 'Outro', '標籤']
              if (!uiWords.includes(cleanLine)) {
                title = cleanLine
              }
            } else {
              // 未知格式，嘗試前 2-4 字為歌名
              title = cleanLine.substring(0, Math.min(4, cleanLine.length))
              const possibleArtist = cleanLine.substring(Math.min(4, cleanLine.length)).trim()
              if (possibleArtist.length >= 2) {
                artists = [possibleArtist]
              }
            }
          }
        }
      }
    }

    // 第三遍：從 "聆聽" 行驗證
    for (const line of lines) {
      if (line.includes('聆聽') && line.includes('-')) {
        const match = line.match(/(.+?)\s*-\s*(.+)/)
        if (match) {
          const left = match[1].replace(/聆聽/, '').replace(/"/g, '').trim()
          const right = match[2].replace(/"/g, '').trim()
          
          // 如果一邊匹配當前標題，另一邊就是歌手
          if (right === title || right.includes(title)) {
            if (!artists.length || artists[0] === '未知歌手') {
              artists = [left]
            }
          } else if (left === title || left.includes(title)) {
            if (!artists.length || artists[0] === '未知歌手') {
              artists = [right]
            }
          }
        }
      }
    }

    // 清理內容
    let content = contentLines.join('\n')

    // 簡體轉繁體
    return {
      title: toTraditional(title || '未知歌名'),
      artists: (artists.length > 0 ? artists : ['未知歌手']).map(a => toTraditional(a)),
      composer: toTraditional(composer),
      lyricist: toTraditional(lyricist),
      originalKey,
      capo,
      bpm,
      content: toTraditional(content),
      uploaderPenName: 'CHORD LOG'
    }
  }

  // 當文字改變時自動解析
  useEffect(() => {
    const data = parseRawText(rawText)
    setParsedData(data)
  }, [rawText])

  // 搜尋 YouTube
  const searchYouTube = async () => {
    if (!parsedData?.title) return
    setIsSearching(true)
    setError('')
    
    try {
      const query = `${parsedData.artists.join(' ')} ${parsedData.title}`
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      
      if (data.videos && data.videos.length > 0) {
        setYoutubeResults(data.videos.slice(0, 5))
      } else {
        setYoutubeResults([])
      }
    } catch (err) {
      setError('YouTube 搜尋失敗')
      console.error(err)
    } finally {
      setIsSearching(false)
    }
  }

  // 搜尋 Spotify
  const searchSpotify = async () => {
    if (!parsedData?.title) return
    setIsSearching(true)
    setError('')
    
    try {
      const query = `${parsedData.artists.join(' ')} ${parsedData.title}`
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}&type=track&limit=5`)
      const data = await res.json()
      
      if (data.tracks?.items && data.tracks.items.length > 0) {
        // 找最匹配的歌曲
        const track = data.tracks.items[0]
        setSpotifyResult({
          id: track.id,
          name: track.name,
          artist: track.artists.map(a => a.name).join(', '),
          album: track.album.name,
          albumImage: track.album.images[0]?.url || '',
          previewUrl: track.preview_url
        })
      } else {
        setSpotifyResult(null)
      }
    } catch (err) {
      setError('Spotify 搜尋失敗')
      console.error(err)
    } finally {
      setIsSearching(false)
    }
  }

  // 一鍵搜尋
  const searchAll = async () => {
    await searchYouTube()
    await searchSpotify()
  }

  // 跳轉到上傳頁面
  const goToUpload = () => {
    if (!parsedData) return
    
    const artistString = parsedData.artists.join(' & ')
    
    // 先儲存 content 到 sessionStorage，避免 URL 太長
    sessionStorage.setItem('quickImportContent', parsedData.content)
    
    const params = new URLSearchParams({
      title: parsedData.title,
      artist: artistString,
      originalKey: parsedData.originalKey,
      capo: parsedData.capo,
      composer: parsedData.composer,
      lyricist: parsedData.lyricist,
      bpm: parsedData.bpm,
      uploaderPenName: parsedData.uploaderPenName,
      displayFont: displayFont, // 字體選擇
      fromQuickImport: 'true',
      ...(selectedYoutube && { youtube: `https://youtube.com/watch?v=${selectedYoutube.id}` }),
      ...(spotifyResult && { albumImage: spotifyResult.albumImage })
    })
    
    router.push(`/tabs/new?${params.toString()}`)
  }

  // 複製跳轉連結
  const copyLink = () => {
    if (!parsedData) return
    
    const artistString = parsedData.artists.join(' & ')
    
    // 儲存 content 到 sessionStorage
    sessionStorage.setItem('quickImportContent', parsedData.content)
    
    const params = new URLSearchParams({
      title: parsedData.title,
      artist: artistString,
      originalKey: parsedData.originalKey,
      capo: parsedData.capo,
      composer: parsedData.composer,
      lyricist: parsedData.lyricist,
      bpm: parsedData.bpm,
      uploaderPenName: parsedData.uploaderPenName,
      displayFont: displayFont, // 字體選擇
      fromQuickImport: 'true',
      ...(selectedYoutube && { youtube: `https://youtube.com/watch?v=${selectedYoutube.id}` }),
      ...(spotifyResult && { albumImage: spotifyResult.albumImage })
    })
    
    const url = `${window.location.origin}/tabs/new?${params.toString()}`
    navigator.clipboard.writeText(url)
    alert('連結已複製！')
  }

  if (!user || !isAdmin) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-8">
          <div className="bg-[#121212] rounded-xl p-8 text-center">
            <p className="text-gray-400">請以管理員身份登入</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Music className="w-6 h-6 text-[#FFD700]" />
          快速導入工具
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左側：輸入區 */}
          <div className="space-y-4">
            <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                貼上原始譜文字
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="貼上從網站複製的譜文字..."
                className="w-full h-96 bg-[#1a1a1a] text-white rounded-lg p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#FFD700] whitespace-pre"
                style={{ whiteSpace: 'pre' }}
              />
              
              {/* 字體選擇 */}
              <div className="mt-4 flex items-center gap-3">
                <Type className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-400">譜面字體：</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDisplayFont('mono')}
                    className={`px-3 py-1.5 rounded-lg text-sm transition ${
                      displayFont === 'mono'
                        ? 'bg-[#FFD700] text-black font-medium'
                        : 'bg-[#282828] text-gray-300 hover:bg-[#3E3E3E]'
                    }`}
                  >
                    等寬字體
                  </button>
                  <button
                    onClick={() => setDisplayFont('arial')}
                    className={`px-3 py-1.5 rounded-lg text-sm transition ${
                      displayFont === 'arial'
                        ? 'bg-[#FFD700] text-black font-medium'
                        : 'bg-[#282828] text-gray-300 hover:bg-[#3E3E3E]'
                    }`}
                  >
                    Arial
                  </button>
                </div>
              </div>
            </div>

            {/* 搜尋按鈕 */}
            <button
              onClick={searchAll}
              disabled={isSearching || !parsedData?.title}
              className="w-full flex items-center justify-center gap-2 bg-[#FFD700] text-black py-3 rounded-lg font-medium hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              {isSearching ? '搜尋中...' : '自動搜尋 YouTube + Spotify'}
            </button>

            {error && (
              <div className="bg-red-900/30 text-red-400 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>

          {/* 右側：解析結果 */}
          <div className="space-y-4">
            {parsedData && (
              <>
                {/* 解析的資料 */}
                <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
                  <h2 className="text-lg font-medium text-white mb-4">解析結果</h2>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">歌名</span>
                      <span className="text-white font-medium">{parsedData.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">歌手</span>
                      <span className="text-white">{parsedData.artists.join(' & ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">作曲</span>
                      <span className="text-white">{parsedData.composer || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">填詞</span>
                      <span className="text-white">{parsedData.lyricist || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">原調</span>
                      <span className="text-[#FFD700]">{parsedData.originalKey}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Capo</span>
                      <span className="text-white">{parsedData.capo}</span>
                    </div>
                    {parsedData.bpm && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">BPM</span>
                        <span className="text-white">{parsedData.bpm}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">上傳者</span>
                      <span className="text-white">{parsedData.uploaderPenName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">譜內容行數</span>
                      <span className="text-white">{parsedData.content.split('\n').length} 行</span>
                    </div>
                  </div>
                </div>

                {/* YouTube 結果 */}
                {youtubeResults.length > 0 && (
                  <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
                    <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                      <Youtube className="w-4 h-4 text-red-500" />
                      YouTube 搜尋結果
                    </h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {youtubeResults.map((video) => (
                        <button
                          key={video.id}
                          onClick={() => setSelectedYoutube(selectedYoutube?.id === video.id ? null : video)}
                          className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition ${
                            selectedYoutube?.id === video.id 
                              ? 'bg-red-500/20 border border-red-500/50' 
                              : 'bg-[#1a1a1a] hover:bg-[#252525]'
                          }`}
                        >
                          <img 
                            src={video.thumbnail} 
                            alt={video.title}
                            className="w-20 h-14 object-cover rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm truncate">{video.title}</p>
                            <p className="text-gray-500 text-xs">{video.channelTitle}</p>
                          </div>
                          {selectedYoutube?.id === video.id && (
                            <Check className="w-5 h-5 text-red-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Spotify 結果 */}
                {spotifyResult && (
                  <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
                    <h3 className="text-sm font-medium text-[#1DB954] mb-3">Spotify 搜尋結果</h3>
                    <div className="flex items-center gap-3">
                      {spotifyResult.albumImage && (
                        <img 
                          src={spotifyResult.albumImage} 
                          alt={spotifyResult.album}
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{spotifyResult.name}</p>
                        <p className="text-gray-400 text-sm truncate">{spotifyResult.artist}</p>
                        <p className="text-gray-500 text-xs truncate">{spotifyResult.album}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 操作按鈕 */}
                <div className="flex gap-3">
                  <button
                    onClick={goToUpload}
                    disabled={!parsedData.title}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#FFD700] text-black py-3 rounded-lg font-medium hover:bg-yellow-400 disabled:opacity-50"
                  >
                    <ExternalLink className="w-5 h-5" />
                    前往上傳頁面
                  </button>
                  <button
                    onClick={copyLink}
                    disabled={!parsedData.title}
                    className="px-4 flex items-center justify-center gap-2 bg-[#282828] text-white py-3 rounded-lg hover:bg-[#3E3E3E] disabled:opacity-50"
                    title="複製連結"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>

                {/* 譜內容預覽 */}
                <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">譜內容預覽</h3>
                  <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto bg-[#1a1a1a] p-3 rounded">
                    {parsedData.content.slice(0, 1000)}
                    {parsedData.content.length > 1000 && '...'}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

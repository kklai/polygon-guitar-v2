import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { Save, RotateCcw, Plus, Trash2, AlertCircle, Copy, Eye } from 'lucide-react'

// 多風格默認配置
const DEFAULT_CONFIG = {
  // 風格定義
  styles: [
    { 
      id: 'normal', 
      name: '普通', 
      desc: '輕鬆自然的語氣',
      prefix: '「',
      suffix: '。」',
      connector: '，'
    },
    { 
      id: 'humor', 
      name: '幽默', 
      desc: '輕鬆有趣，帶點俏皮',
      prefix: '「',
      suffix: '～」',
      connector: '，'
    },
    { 
      id: 'serious', 
      name: '認真', 
      desc: '專業嚴謹的語氣',
      prefix: '【',
      suffix: '】',
      connector: '；'
    },
    { 
      id: 'sincere', 
      name: '誠懇', 
      desc: '溫暖真摯的感覺',
      prefix: '「',
      suffix: '。請多指教！」',
      connector: '，'
    },
    { 
      id: 'teacher', 
      name: '老師', 
      desc: '教學導師的語氣',
      prefix: '【教學理念】',
      suffix: '歡迎一起交流學習！',
      connector: '；'
    }
  ],
  
  // 問題與選項（每個選項可有多風格句子）
  questions: [
    {
      id: 'experience',
      label: '結他年資',
      question: '你彈結他多久了？',
      required: false,
      options: [
        { 
          value: 'beginner', 
          label: '初學者（少於1年）',
          sentences: {
            normal: '初學結他',
            humor: '結他界新鮮人，還在跟弦線搏鬥中',
            serious: '結他學習初期',
            sincere: '剛開始學結他，充滿熱情',
            teacher: '初學階段，正在建立基礎'
          }
        },
        { 
          value: '1-2', 
          label: '1-2年',
          sentences: {
            normal: '彈結他1-2年',
            humor: '彈了一年多，F和弦還在奮鬥',
            serious: '具備一至兩年結他演奏經驗',
            sincere: '學結他一段時間了，越彈越有興趣',
            teacher: '學習一至兩年，已掌握基礎技巧'
          }
        },
        { 
          value: '3-5', 
          label: '3-5年',
          sentences: {
            normal: '彈結他3-5年',
            humor: '彈了幾年，終於敢在人前表演',
            serious: '擁有三至五年結他演奏經驗',
            sincere: '彈了幾年結他，成了生活的一部分',
            teacher: '具備三至五年經驗，技巧漸趨成熟'
          }
        },
        { 
          value: '6-10', 
          label: '6-10年',
          sentences: {
            normal: '有6-10年結他經驗',
            humor: '彈了七八年，手指已經有繭了',
            serious: '具備六至十年專業結他經驗',
            sincere: '彈結他很多年了，是一輩子的興趣',
            teacher: '累積六至十年經驗，可指導初學者'
          }
        },
        { 
          value: '10+', 
          label: '10年以上',
          sentences: {
            normal: '彈結他超過10年',
            humor: '彈了十幾年，結他就像老朋友',
            serious: '擁有超過十年豐富演奏經驗',
            sincere: '結他陪伴了我十幾年，是生命中重要的一部分',
            teacher: '超過十年演奏及教學經驗'
          }
        },
        { 
          value: 'pro', 
          label: '專業演奏',
          sentences: {
            normal: '專業結他手',
            humor: '靠結他混飯吃，歡迎約 gig',
            serious: '專業結他演奏者',
            sincere: '以結他為專業，熱愛音樂事業',
            teacher: '專業結他演奏家及導師'
          }
        }
      ]
    },
    {
      id: 'style',
      label: '彈奏風格',
      question: '你喜歡什麼風格？',
      required: false,
      options: [
        { 
          value: 'sing-play', 
          label: '自彈自唱',
          sentences: {
            normal: '鍾意自彈自唱',
            humor: '一個人一把結他就能開演唱會',
            serious: '專精自彈自唱技巧',
            sincere: '喜歡邊彈邊唱，用音樂表達心情',
            teacher: '專長自彈自唱教學'
          }
        },
        { 
          value: 'accompaniment', 
          label: '伴奏',
          sentences: {
            normal: '主力伴奏',
            humor: '做慣綠葉，襯托別人的花',
            serious: '專注伴奏技巧',
            sincere: '喜歡為別人伴奏，一起創造音樂',
            teacher: '專精伴奏技巧，懂得襯托歌手'
          }
        },
        { 
          value: 'fingerstyle', 
          label: '指彈',
          sentences: {
            normal: '鍾意指彈',
            humor: '一個人要當四個人用',
            serious: '專攻指彈技巧',
            sincere: '迷上了指彈，一個結他就是一個樂隊',
            teacher: '專長指彈教學，訓練左右手協調'
          }
        },
        { 
          value: 'lead', 
          label: '主音結他',
          sentences: {
            normal: '玩主音結他',
            humor: '愛出風頭，喜歡 solo',
            serious: '主音結他手',
            sincere: '熱愛主音結他，享受 solo 的感覺',
            teacher: '專精主音結他，教授 solo 技巧'
          }
        },
        { 
          value: 'all', 
          label: '全部都有',
          sentences: {
            normal: '什麼風格都玩',
            humor: '什麼都玩，什麼都不精',
            serious: '全能型結他手',
            sincere: '各種風格都喜歡，不停嘗試新事物',
            teacher: '全面教學，涵蓋各種風格'
          }
        }
      ]
    },
    {
      id: 'location',
      label: '練習地點',
      question: '平時在哪裡練習？',
      required: false,
      options: [
        { 
          value: 'home', 
          label: '家中',
          sentences: {
            normal: '平時喺屋企練習',
            humor: '屋企就是我的演唱會舞台',
            serious: '主要於家中練習',
            sincere: '喜歡在家裡靜靜地練習',
            teacher: '提供上門教學或居家練習指導'
          }
        },
        { 
          value: 'studio', 
          label: 'Band房/練習室',
          sentences: {
            normal: '喺Band房練習',
            humor: 'Band房是我的第二個家',
            serious: '於專業練習室練習',
            sincere: '喜歡在 Band房 和朋友一起夾歌',
            teacher: '設有專業練習室供學生使用'
          }
        },
        { 
          value: 'park', 
          label: '公園/街頭',
          sentences: {
            normal: '鍾意喺街頭彈結他',
            humor: '街頭藝人，有時會開 hat',
            serious: '熱衷街頭表演',
            sincere: '喜歡在街頭分享音樂，帶給路人快樂',
            teacher: '鼓勵學生勇敢表演，累積舞台經驗'
          }
        },
        { 
          value: 'church', 
          label: '教會',
          sentences: {
            normal: '喺教會彈結他',
            humor: '為主彈奏，榮耀歸主',
            serious: '於教會事奉敬拜',
            sincere: '在教會彈結他，用音樂敬拜',
            teacher: '專注敬拜音樂教學'
          }
        },
        { 
          value: 'online', 
          label: '線上直播',
          sentences: {
            normal: '會做線上直播',
            humor: '網紅結他手，歡迎 follow',
            serious: '活躍於線上音樂平台',
            sincere: '喜歡在網上分享音樂，認識志同道合的朋友',
            teacher: '提供線上教學，不受地域限制'
          }
        }
      ]
    },
    {
      id: 'chords',
      label: '喜愛和弦',
      question: '最愛用什麼和弦？',
      required: false,
      options: [
        { 
          value: 'open', 
          label: '開放和弦',
          sentences: {
            normal: '最愛用開放和弦',
            humor: 'C G D Am Em 走天涯',
            serious: '擅長開放和弦應用',
            sincere: '簡單的開放和弦就能彈出好聽的歌',
            teacher: '從基礎開放和弦開始穩扎穩打'
          }
        },
        { 
          value: 'barre', 
          label: 'Barre 和弦',
          sentences: {
            normal: '最愛用Barre Chord',
            humor: 'F和弦？No problem！',
            serious: '精通Barre和弦技巧',
            sincere: '克服了F和弦，什麼都不怕了',
            teacher: '專攻Barre和弦，幫你突破瓶頸'
          }
        },
        { 
          value: 'jazz', 
          label: 'Jazz 和弦',
          sentences: {
            normal: '鍾意用Jazz和弦',
            humor: '普通和弦太無聊，要加9th才夠味',
            serious: '專研爵士和弦理論',
            sincere: '喜歡探索複雜的Jazz和弦，豐富音樂色彩',
            teacher: '深入講解Jazz和弦與應用'
          }
        },
        { 
          value: 'all', 
          label: '全部和弦',
          sentences: {
            normal: '什麼和弦都用',
            humor: '小孩子才做選擇，我全部都要',
            serious: '全面掌握各類和弦',
            sincere: '每種和弦都有它的美，都值得學習',
            teacher: '系統性教授各類和弦運用'
          }
        }
      ]
    }
  ],
  
  // 推薦風格
  recommendedStyle: 'normal'
}

function BioSettingsAdmin() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [activeTab, setActiveTab] = useState('questions') // questions, styles, preview
  
  // 預覽用
  const [previewStyle, setPreviewStyle] = useState('normal')
  const [previewAnswers, setPreviewAnswers] = useState({
    experience: '10+',
    style: 'sing-play',
    location: 'home',
    chords: 'jazz'
  })

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const docRef = doc(db, 'settings', 'profileBio')
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        setConfig({ ...DEFAULT_CONFIG, ...docSnap.data() })
      }
    } catch (error) {
      console.error('Error loading config:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveConfig = async () => {
    setIsSaving(true)
    try {
      await setDoc(doc(db, 'settings', 'profileBio'), config)
      setMessage({ type: 'success', text: '設定已儲存！' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: '儲存失敗：' + error.message })
    } finally {
      setIsSaving(false)
    }
  }

  const resetToDefault = () => {
    if (confirm('確定要重置為默認設定嗎？')) {
      setConfig(DEFAULT_CONFIG)
    }
  }

  // 生成預覽句子
  const generatePreview = () => {
    const style = config.styles.find(s => s.id === previewStyle) || config.styles[0]
    const parts = []
    
    config.questions.forEach(q => {
      const answer = previewAnswers[q.id]
      if (answer) {
        const option = q.options.find(o => o.value === answer)
        if (option && option.sentences[previewStyle]) {
          parts.push(option.sentences[previewStyle])
        }
      }
    })
    
    if (parts.length === 0) return '（還沒有選擇任何選項）'
    
    return style.prefix + parts.join(style.connector) + style.suffix
  }

  // 更新風格
  const updateStyle = (styleId, field, value) => {
    setConfig({
      ...config,
      styles: config.styles.map(s => 
        s.id === styleId ? { ...s, [field]: value } : s
      )
    })
  }

  // 更新句子
  const updateSentence = (questionId, optionValue, styleId, value) => {
    setConfig({
      ...config,
      questions: config.questions.map(q => {
        if (q.id !== questionId) return q
        return {
          ...q,
          options: q.options.map(o => {
            if (o.value !== optionValue) return o
            return {
              ...o,
              sentences: { ...o.sentences, [styleId]: value }
            }
          })
        }
      })
    })
  }

  // 添加選項
  const addOption = (questionId) => {
    const newValue = `custom-${Date.now()}`
    setConfig({
      ...config,
      questions: config.questions.map(q => {
        if (q.id !== questionId) return q
        return {
          ...q,
          options: [...q.options, {
            value: newValue,
            label: '新選項',
            sentences: Object.fromEntries(config.styles.map(s => [s.id, '描述句子']))
          }]
        }
      })
    })
  }

  // 刪除選項
  const removeOption = (questionId, optionValue) => {
    setConfig({
      ...config,
      questions: config.questions.map(q => {
        if (q.id !== questionId) return q
        return {
          ...q,
          options: q.options.filter(o => o.value !== optionValue)
        }
      })
    })
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full mx-auto"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">個人簡介設定</h1>
            <p className="text-gray-400 text-sm">設計問答流程，創作多種風格的簡介模板</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetToDefault}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2"
            >
              <RotateCcw size={16} />
              重置
            </button>
            <button
              onClick={saveConfig}
              disabled={isSaving}
              className="px-4 py-2 bg-[#FFD700] text-black rounded-lg hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={16} />
              {isSaving ? '儲存中...' : '儲存'}
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            message.type === 'success' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
          }`}>
            <AlertCircle size={18} />
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-800">
          {[
            { id: 'questions', label: '問題設計', icon: '📝' },
            { id: 'styles', label: '風格設定', icon: '🎨' },
            { id: 'preview', label: '效果預覽', icon: '👁️' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 flex items-center gap-2 border-b-2 transition ${
                activeTab === tab.id 
                  ? 'border-[#FFD700] text-[#FFD700]' 
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Questions Tab */}
        {activeTab === 'questions' && (
          <div className="space-y-6">
            {config.questions.map((q, qIdx) => (
              <div key={q.id} className="bg-[#121212] rounded-xl border border-gray-800 overflow-hidden">
                <div className="p-4 border-b border-gray-800 bg-gray-800/30">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{['🎸', '🎵', '📍', '🎼'][qIdx]}</span>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={q.label}
                        onChange={(e) => {
                          const newQuestions = [...config.questions]
                          newQuestions[qIdx].label = e.target.value
                          setConfig({ ...config, questions: newQuestions })
                        }}
                        className="bg-transparent text-white font-bold text-lg w-full outline-none"
                      />
                      <input
                        type="text"
                        value={q.question}
                        onChange={(e) => {
                          const newQuestions = [...config.questions]
                          newQuestions[qIdx].question = e.target.value
                          setConfig({ ...config, questions: newQuestions })
                        }}
                        className="bg-transparent text-gray-400 text-sm w-full outline-none mt-1"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="space-y-2">
                    {q.options.map(opt => (
                      <div key={opt.value} className="bg-black/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="text"
                            value={opt.label}
                            onChange={(e) => {
                              const newQuestions = [...config.questions]
                              const qIndex = newQuestions.findIndex(nq => nq.id === q.id)
                              const oIndex = newQuestions[qIndex].options.findIndex(o => o.value === opt.value)
                              newQuestions[qIndex].options[oIndex].label = e.target.value
                              setConfig({ ...config, questions: newQuestions })
                            }}
                            className="flex-1 bg-gray-800 text-white rounded px-3 py-2 text-sm"
                          />
                          <button
                            onClick={() => removeOption(q.id, opt.value)}
                            className="p-2 text-red-400 hover:bg-red-900/30 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        
                        {/* 各風格的句子 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {config.styles.map(style => (
                            <div key={style.id} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 whitespace-nowrap">{style.name}</span>
                              <input
                                type="text"
                                value={opt.sentences[style.id] || ''}
                                onChange={(e) => updateSentence(q.id, opt.value, style.id, e.target.value)}
                                className="flex-1 bg-gray-900 text-yellow-400 rounded px-2 py-1 text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <button
                    onClick={() => addOption(q.id)}
                    className="mt-3 w-full py-2 border border-dashed border-gray-600 text-gray-400 rounded-lg hover:border-[#FFD700] hover:text-[#FFD700] flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    添加選項
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Styles Tab */}
        {activeTab === 'styles' && (
          <div className="space-y-4">
            {config.styles.map(style => (
              <div key={style.id} className="bg-[#121212] rounded-xl border border-gray-800 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="text"
                        value={style.name}
                        onChange={(e) => updateStyle(style.id, 'name', e.target.value)}
                        className="bg-gray-800 text-white font-bold rounded px-3 py-2"
                      />
                      <input
                        type="text"
                        value={style.desc}
                        onChange={(e) => updateStyle(style.id, 'desc', e.target.value)}
                        className="flex-1 bg-gray-800 text-gray-400 text-sm rounded px-3 py-2"
                      />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-gray-500 text-xs">開頭</label>
                        <input
                          type="text"
                          value={style.prefix}
                          onChange={(e) => updateStyle(style.id, 'prefix', e.target.value)}
                          className="w-full mt-1 bg-black text-white rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="text-gray-500 text-xs">連接符</label>
                        <input
                          type="text"
                          value={style.connector}
                          onChange={(e) => updateStyle(style.id, 'connector', e.target.value)}
                          className="w-full mt-1 bg-black text-white rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="text-gray-500 text-xs">結尾</label>
                        <input
                          type="text"
                          value={style.suffix}
                          onChange={(e) => updateStyle(style.id, 'suffix', e.target.value)}
                          className="w-full mt-1 bg-black text-white rounded px-3 py-2"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preview Tab */}
        {activeTab === 'preview' && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* 選擇區 */}
            <div className="bg-[#121212] rounded-xl border border-gray-800 p-4">
              <h3 className="text-white font-bold mb-4">選擇風格與答案</h3>
              
              <div className="mb-4">
                <label className="text-gray-400 text-sm">選擇風格</label>
                <select
                  value={previewStyle}
                  onChange={(e) => setPreviewStyle(e.target.value)}
                  className="w-full mt-1 bg-gray-800 text-white rounded-lg px-3 py-2"
                >
                  {config.styles.map(s => (
                    <option key={s.id} value={s.id}>{s.name} - {s.desc}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-3">
                {config.questions.map(q => (
                  <div key={q.id}>
                    <label className="text-gray-400 text-sm">{q.question}</label>
                    <select
                      value={previewAnswers[q.id] || ''}
                      onChange={(e) => setPreviewAnswers({ ...previewAnswers, [q.id]: e.target.value })}
                      className="w-full mt-1 bg-gray-800 text-white rounded-lg px-3 py-2"
                    >
                      <option value="">（不選擇）</option>
                      {q.options.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            
            {/* 預覽結果 */}
            <div className="bg-[#121212] rounded-xl border border-gray-800 p-4">
              <h3 className="text-white font-bold mb-4">生成結果</h3>
              
              <div className="bg-black rounded-lg p-4 mb-4">
                <p className="text-gray-500 text-xs mb-2">預覽：</p>
                <p className="text-white text-lg leading-relaxed">{generatePreview()}</p>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(generatePreview())}
                  className="flex-1 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 flex items-center justify-center gap-2"
                >
                  <Copy size={16} />
                  複製文字
                </button>
              </div>
              
              <p className="text-gray-500 text-xs mt-4">
                💡 用戶可以選擇只回答部分問題，系統會自動組合。<br/>
                生成的句子可以複製後自行修改。
              </p>
            </div>
          </div>
        )}

        {/* 說明 */}
        <div className="mt-6 bg-blue-900/20 border border-blue-700/50 rounded-xl p-4">
          <h4 className="text-blue-300 font-bold mb-2">💡 設計建議</h4>
          <ul className="text-blue-200/80 text-sm space-y-1 list-disc list-inside">
            <li>每個選項建議為不同風格設計不同語氣，例如「幽默」風格可以用輕鬆俏皮的句子</li>
            <li>問題設為選填，用戶不需要回答所有問題</li>
            <li>用戶在編輯頁面可以即時預覽，並複製後自行修改</li>
            <li>推薦保留「普通」風格作為預設選項</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

export default function BioSettingsGuard() {
  return (
    <AdminGuard>
      <BioSettingsAdmin />
    </AdminGuard>
  )
}

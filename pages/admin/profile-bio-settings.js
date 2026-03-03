import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import AdminGuard from '@/components/AdminGuard'
import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { Save, RotateCcw, Plus, Trash2, AlertCircle } from 'lucide-react'

// 默認配置
const DEFAULT_CONFIG = {
  experience: {
    label: '結他年資',
    question: '你彈結他多久了？',
    options: [
      { value: 'beginner', label: '初學者（少於1年）', sentence: '初學結他' },
      { value: '1-2', label: '1-2年', sentence: '彈結他1-2年' },
      { value: '3-5', label: '3-5年', sentence: '彈結他3-5年' },
      { value: '6-10', label: '6-10年', sentence: '有6-10年結他經驗' },
      { value: '10+', label: '10年以上', sentence: '彈結他超過10年' },
      { value: 'pro', label: '專業演奏', sentence: '專業結他手' }
    ]
  },
  style: {
    label: '彈奏風格',
    question: '你喜歡什麼風格？',
    options: [
      { value: 'sing-play', label: '自彈自唱', sentence: '鍾意自彈自唱' },
      { value: 'accompaniment', label: '伴奏', sentence: '主力伴奏' },
      { value: 'fingerstyle', label: '指彈', sentence: '鍾意指彈' },
      { value: 'lead', label: '主音結他', sentence: '玩主音結他' },
      { value: 'all', label: '全部都有', sentence: '什麼風格都玩' }
    ]
  },
  location: {
    label: '練習地點',
    question: '平時在哪裡練習？',
    options: [
      { value: 'home', label: '家中', sentence: '平時喺屋企練習' },
      { value: 'studio', label: 'Band房/練習室', sentence: '喺Band房練習' },
      { value: 'school', label: '學校', sentence: '喺學校練習' },
      { value: 'park', label: '公園/街頭', sentence: '鍾意喺街頭彈結他' },
      { value: 'cafe', label: '咖啡廳', sentence: '喺咖啡廳彈結他' },
      { value: 'church', label: '教會', sentence: '喺教會彈結他' },
      { value: 'online', label: '線上直播', sentence: '會做線上直播' }
    ]
  },
  chords: {
    label: '喜愛和弦',
    question: '最愛用什麼和弦？',
    options: [
      { value: 'open', label: '開放和弦', sentence: '最愛用開放和弦' },
      { value: 'barre', label: 'Barre 和弦', sentence: '最愛用Barre Chord' },
      { value: 'jazz', label: 'Jazz 和弦', sentence: '鍾意用Jazz和弦' },
      { value: 'power', label: 'Power Chords', sentence: '愛用Power Chords' },
      { value: 'sus', label: 'Sus4 / Add9', sentence: '鍾意用Sus4同Add9' },
      { value: 'all', label: '全部和弦', sentence: '什麼和弦都用' }
    ]
  },
  // 句子模板
  templates: {
    single: '{content}。',
    double: '{content1}，{content2}。',
    triple: '{content1}，{content2}，{content3}。',
    quadruple: '{content1}，{content2}，{content3}，{content4}。',
    prefix: '「',
    suffix: '。」'
  },
  // 連接詞
  connectors: ['，', '，鍾意', '，平時', '，最愛']
}

function BioSettingsAdmin() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [preview, setPreview] = useState({
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

  // 更新選項標籤
  const updateOptionLabel = (category, index, field, value) => {
    const newConfig = { ...config }
    newConfig[category].options[index][field] = value
    setConfig(newConfig)
  }

  // 添加選項
  const addOption = (category) => {
    const newConfig = { ...config }
    newConfig[category].options.push({
      value: `custom-${Date.now()}`,
      label: '新選項',
      sentence: '描述句子'
    })
    setConfig(newConfig)
  }

  // 刪除選項
  const removeOption = (category, index) => {
    const newConfig = { ...config }
    newConfig[category].options.splice(index, 1)
    setConfig(newConfig)
  }

  // 更新問題
  const updateQuestion = (category, value) => {
    const newConfig = { ...config }
    newConfig[category].question = value
    setConfig(newConfig)
  }

  // 更新模板
  const updateTemplate = (field, value) => {
    const newConfig = { ...config }
    newConfig.templates[field] = value
    setConfig(newConfig)
  }

  // 生成預覽句子
  const generatePreview = () => {
    const parts = []
    
    const exp = config.experience.options.find(o => o.value === preview.experience)
    if (exp) parts.push(exp.sentence)
    
    const sty = config.style.options.find(o => o.value === preview.style)
    if (sty) parts.push(sty.sentence)
    
    const loc = config.location.options.find(o => o.value === preview.location)
    if (loc) parts.push(loc.sentence)
    
    const cho = config.chords.options.find(o => o.value === preview.chords)
    if (cho) parts.push(cho.sentence)
    
    if (parts.length === 0) return ''
    
    return config.templates.prefix + parts.join('，') + config.templates.suffix
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
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">個人簡介設定</h1>
            <p className="text-gray-400 text-sm">修改生成用戶簡介的問題和句子</p>
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

        {/* 預覽區 */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">🔍 即時預覽</h2>
          
          {/* 預覽選項 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { key: 'experience', label: '年資', options: config.experience.options },
              { key: 'style', label: '風格', options: config.style.options },
              { key: 'location', label: '地點', options: config.location.options },
              { key: 'chords', label: '和弦', options: config.chords.options }
            ].map(({ key, label, options }) => (
              <div key={key}>
                <label className="text-gray-400 text-xs">{label}</label>
                <select
                  value={preview[key]}
                  onChange={(e) => setPreview({ ...preview, [key]: e.target.value })}
                  className="w-full mt-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
                >
                  {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          
          {/* 預覽句子 */}
          <div className="bg-black rounded-lg p-4">
            <p className="text-gray-400 text-xs mb-1">生成結果：</p>
            <p className="text-white text-lg">{generatePreview()}</p>
          </div>
        </div>

        {/* 問題設定 */}
        <div className="space-y-6">
          {[
            { key: 'experience', title: '🎸 結他年資', desc: '用戶彈結他的年資問題' },
            { key: 'style', title: '🎵 彈奏風格', desc: '用戶喜歡的彈奏風格' },
            { key: 'location', title: '📍 練習地點', desc: '用戶平時在哪裡練習' },
            { key: 'chords', title: '🎼 喜愛和弦', desc: '用戶最愛用的和弦類型' }
          ].map(({ key, title, desc }) => (
            <div key={key} className="bg-[#121212] rounded-xl border border-gray-800 overflow-hidden">
              <div className="p-4 border-b border-gray-800 bg-gray-800/30">
                <h3 className="text-white font-bold">{title}</h3>
                <p className="text-gray-400 text-sm">{desc}</p>
              </div>
              
              <div className="p-4">
                {/* 問題 */}
                <div className="mb-4">
                  <label className="text-gray-400 text-sm block mb-2">問題</label>
                  <input
                    type="text"
                    value={config[key].question}
                    onChange={(e) => updateQuestion(key, e.target.value)}
                    className="w-full bg-gray-800 text-white rounded-lg px-4 py-2"
                  />
                </div>
                
                {/* 選項列表 */}
                <div className="space-y-2">
                  <label className="text-gray-400 text-sm block">選項與生成句子</label>
                  {config[key].options.map((option, idx) => (
                    <div key={option.value} className="flex gap-2 items-start bg-black/30 rounded-lg p-3">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={option.label}
                          onChange={(e) => updateOptionLabel(key, idx, 'label', e.target.value)}
                          className="bg-gray-800 text-white rounded px-3 py-2 text-sm"
                          placeholder="顯示標籤"
                        />
                        <input
                          type="text"
                          value={option.sentence}
                          onChange={(e) => updateOptionLabel(key, idx, 'sentence', e.target.value)}
                          className="bg-gray-800 text-yellow-400 rounded px-3 py-2 text-sm"
                          placeholder="生成句子"
                        />
                      </div>
                      <button
                        onClick={() => removeOption(key, idx)}
                        className="p-2 text-red-400 hover:bg-red-900/30 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* 添加選項 */}
                <button
                  onClick={() => addOption(key)}
                  className="mt-3 w-full py-2 border border-dashed border-gray-600 text-gray-400 rounded-lg hover:border-[#FFD700] hover:text-[#FFD700] flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  添加選項
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 句子模板設定 */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mt-6">
          <h3 className="text-white font-bold mb-4">📝 句子模板</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-sm block mb-2">開頭符號</label>
              <input
                type="text"
                value={config.templates.prefix}
                onChange={(e) => updateTemplate('prefix', e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-2">結尾符號</label>
              <input
                type="text"
                value={config.templates.suffix}
                onChange={(e) => updateTemplate('suffix', e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2"
              />
            </div>
          </div>
          
          <p className="text-gray-500 text-xs mt-4">
            💡 提示：系統會將用戶選擇的選項句子用「，」連接，然後加上開頭和結尾符號。
          </p>
        </div>

        {/* 說明 */}
        <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4 mt-6">
          <h4 className="text-blue-300 font-bold mb-2">💡 使用說明</h4>
          <ul className="text-blue-200/80 text-sm space-y-1 list-disc list-inside">
            <li>修改問題和選項後，用戶在編輯資料頁面會看到新的選項</li>
            <li>「生成句子」會顯示在個人主頁，建議用口語化表達</li>
            <li>可添加自訂選項，但注意 value 不能重複</li>
            <li>開頭/結尾符號可改為其他樣式，例如「【】」或「『』」</li>
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

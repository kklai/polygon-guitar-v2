import { useState } from 'react'

/**
 * 第二層：上傳者手動標籤選擇器
 */

const STYLE_TAGS = [
  { id: 'original', label: '原汁原味', desc: '跟足原曲編配', icon: '' },
  { id: 'simple', label: '簡單版', desc: '初學者適用，和弦簡化', icon: '' },
  { id: 'advanced', label: '進階版', desc: '加花/轉調/技巧', icon: '' },
  { id: 'fingerstyle', label: '指彈版', desc: 'Fingerstyle 獨奏', icon: '' },
  { id: 'busking', label: 'Busking版', desc: '容易帶動氣氛', icon: '' },
  { id: 'solo', label: '獨奏版', desc: 'Solo arrangement', icon: '' },
  { id: 'duet', label: '合唱版', desc: '適合彈唱', icon: '' },
]

const AUDIENCE_TAGS = [
  { id: 'beginner', label: '初學者', desc: '學琴少於3個月', color: 'bg-green-600' },
  { id: 'intermediate', label: '中級', desc: '已有基礎', color: 'bg-yellow-600' },
  { id: 'advanced', label: '高手', desc: '挑戰技巧', color: 'bg-red-600' },
]

const MOOD_TAGS = [
  { id: 'happy', label: '輕快', icon: '' },
  { id: 'emotional', label: '抒情', icon: '' },
  { id: 'rock', label: '搖滾', icon: '' },
  { id: 'romantic', label: '浪漫', icon: '' },
  { id: 'sad', label: '傷感', icon: '' },
]

export default function TabTagsSelector({ value = {}, onChange }) {
  const { style = [], audience = [], mood = [] } = value

  const toggleTag = (category, tagId) => {
    const current = value[category] || []
    const updated = current.includes(tagId)
      ? current.filter(id => id !== tagId)
      : [...current, tagId]
    
    onChange({ ...value, [category]: updated })
  }

  return (
    <div className="space-y-6">
      {/* 風格類型 */}
      <div>
        <label className="block text-white font-medium mb-3">
          風格類型（可多選）
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STYLE_TAGS.map(tag => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag('style', tag.id)}
              className={`p-3 rounded-lg border-2 text-left transition ${
                style.includes(tag.id)
                  ? 'border-[#FFD700] bg-[#FFD700]/10'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-xl">{tag.icon}</span>
                <div>
                  <div className={`font-medium ${style.includes(tag.id) ? 'text-[#FFD700]' : 'text-white'}`}>
                    {tag.label}
                  </div>
                  <div className="text-xs text-gray-400">{tag.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 適合對象 */}
      <div>
        <label className="block text-white font-medium mb-3">
          適合對象（建議選一個最適合嘅）
        </label>
        <div className="flex flex-wrap gap-3">
          {AUDIENCE_TAGS.map(tag => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag('audience', tag.id)}
              className={`px-4 py-2 rounded-full border-2 transition ${
                audience.includes(tag.id)
                  ? `border-[#FFD700] ${tag.color} text-white`
                  : 'border-gray-700 text-gray-300 hover:border-gray-600'
              }`}
            >
              <span className="font-medium">{tag.label}</span>
              <span className="text-xs ml-2 opacity-80">{tag.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 情緒/氣氛 */}
      <div>
        <label className="block text-white font-medium mb-3">
          情緒/氣氛（可選）
        </label>
        <div className="flex flex-wrap gap-2">
          {MOOD_TAGS.map(tag => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag('mood', tag.id)}
              className={`px-3 py-2 rounded-lg border transition ${
                mood.includes(tag.id)
                  ? 'border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]'
                  : 'border-gray-700 text-gray-300 hover:border-gray-600'
              }`}
            >
              <span className="mr-1">{tag.icon}</span>
              <span>{tag.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 已選摘要 */}
      {(style.length > 0 || audience.length > 0 || mood.length > 0) && (
        <div className="p-4 bg-gray-900 rounded-lg">
          <div className="text-sm text-gray-400 mb-2">已選標籤：</div>
          <div className="flex flex-wrap gap-2">
            {style.map(id => {
              const tag = STYLE_TAGS.find(t => t.id === id)
              return (
                <span key={id} className="px-2 py-1 bg-[#FFD700]/20 text-[#FFD700] rounded text-sm">
                  {tag?.label}
                </span>
              )
            })}
            {audience.map(id => {
              const tag = AUDIENCE_TAGS.find(t => t.id === id)
              return (
                <span key={id} className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded text-sm">
                  {tag?.label}
                </span>
              )
            })}
            {mood.map(id => {
              const tag = MOOD_TAGS.find(t => t.id === id)
              return (
                <span key={id} className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded text-sm">
                  {tag?.label}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

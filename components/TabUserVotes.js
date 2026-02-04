import { useState } from 'react'

/**
 * 第三層：用戶投票系統
 */

const VOTE_OPTIONS = [
  { 
    id: 'soundsLikeOriginal', 
    label: '最似原曲', 
    icon: '🎵', 
    desc: '呢個版本還原度高',
    color: 'bg-blue-600'
  },
  { 
    id: 'goodForBeginners', 
    label: '啱新手', 
    icon: '🎸', 
    desc: '初學者都彈到',
    color: 'bg-green-600'
  },
  { 
    id: 'greatForBusking', 
    label: '啱Busking', 
    icon: '🔥', 
    desc: '氣氛好，帶動全場',
    color: 'bg-orange-600'
  },
  { 
    id: 'beautifulArrangement', 
    label: '編配靚', 
    icon: '✨', 
    desc: '個人風格獨特',
    color: 'bg-purple-600'
  },
]

export default function TabUserVotes({ tabId, votes = {}, userVote, onVote }) {
  const [hasVoted, setHasVoted] = useState(!!userVote)
  const [selectedVote, setSelectedVote] = useState(userVote)
  const [showThankYou, setShowThankYou] = useState(false)

  const handleVote = async (voteType) => {
    try {
      await onVote(tabId, voteType)
      setSelectedVote(voteType)
      setHasVoted(true)
      setShowThankYou(true)
      setTimeout(() => setShowThankYou(false), 3000)
    } catch (error) {
      console.error('投票失敗:', error)
    }
  }

  const totalVotes = Object.values(votes).reduce((sum, count) => sum + count, 0)

  return (
    <div className="bg-[#121212] rounded-xl border border-gray-800 p-4">
      <h3 className="text-white font-bold mb-4 flex items-center gap-2">
        👍 用戶評價
        {totalVotes > 0 && (
          <span className="text-sm font-normal text-gray-400">
            ({totalVotes} 人投票)
          </span>
        )}
      </h3>

      {/* 投票按鈕 */}
      {!hasVoted ? (
        <div className="grid grid-cols-2 gap-3">
          {VOTE_OPTIONS.map(option => (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-left transition group"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{option.icon}</span>
                <span className="text-white font-medium group-hover:text-[#FFD700]">
                  {option.label}
                </span>
              </div>
              <p className="text-xs text-gray-400">{option.desc}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-4">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-green-400 font-medium">多謝你嘅投票！</p>
          <p className="text-gray-400 text-sm mt-1">
            你揀咗：{VOTE_OPTIONS.find(o => o.id === selectedVote)?.label}
          </p>
          <button
            onClick={() => setHasVoted(false)}
            className="text-gray-500 text-xs mt-3 hover:text-gray-300 underline"
          >
            重新投票
          </button>
        </div>
      )}

      {/* 投票結果統計 */}
      {totalVotes > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <div className="space-y-2">
            {VOTE_OPTIONS.map(option => {
              const count = votes[option.id] || 0
              const percentage = totalVotes > 0 ? (count / totalVotes * 100) : 0
              
              return (
                <div key={option.id} className="flex items-center gap-2">
                  <span className="text-lg w-6">{option.icon}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>{option.label}</span>
                      <span>{count} 票 ({percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${option.color} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 感謝訊息 */}
      {showThankYou && (
        <div className="mt-4 p-3 bg-green-900/30 border border-green-700 rounded-lg text-center">
          <p className="text-green-400 text-sm">🎉 投票成功！你嘅意見幫到其他結他手揀選</p>
        </div>
      )}

      {/* 動態標籤 */}
      {totalVotes >= 10 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {votes.soundsLikeOriginal >= 10 && (
            <span className="px-2 py-1 bg-blue-900/50 text-blue-300 text-xs rounded-full">
              🏆 最似原曲
            </span>
          )}
          {votes.goodForBeginners >= 10 && (
            <span className="px-2 py-1 bg-green-900/50 text-green-300 text-xs rounded-full">
              🎸 新手首選
            </span>
          )}
          {votes.greatForBusking >= 5 && (
            <span className="px-2 py-1 bg-orange-900/50 text-orange-300 text-xs rounded-full">
              🔥 Busking之選
            </span>
          )}
          {votes.beautifulArrangement >= 5 && (
            <span className="px-2 py-1 bg-purple-900/50 text-purple-300 text-xs rounded-full">
              ✨ 編配出色
            </span>
          )}
        </div>
      )}
    </div>
  )
}

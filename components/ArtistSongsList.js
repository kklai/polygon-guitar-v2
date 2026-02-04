import Link from 'next/link'

// 解析譜內容中的 keys
function parseKeys(content) {
  if (!content) return []
  
  const keys = new Set()
  const lines = content.split('\n')
  
  lines.forEach(line => {
    // 匹配 [Key: X] 或 Key: X 格式
    const match = line.match(/\[?Key:\s*([A-G][#b]?m?)\]?/i)
    if (match) {
      keys.add(match[1])
    }
  })
  
  return Array.from(keys)
}

// 取得歌曲縮圖
function getSongThumbnail(tab) {
  // 優先使用歌曲自己的縮圖
  if (tab.thumbnail) return tab.thumbnail
  if (tab.coverImage) return tab.coverImage
  
  // 其次使用歌手圖片
  if (tab.artistPhoto) return tab.artistPhoto
  
  // 預設 fallback
  return null
}

export default function ArtistSongsList({ songs, artistPhoto }) {
  if (!songs || songs.length === 0) return null

  return (
    <div className="bg-[#121212] rounded-xl border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-lg font-bold text-white">熱門歌曲</h3>
      </div>
      
      <div className="divide-y divide-gray-800">
        {songs.map((song, index) => {
          const keys = parseKeys(song.content)
          const thumbnail = getSongThumbnail(song) || artistPhoto
          const rank = index + 1
          
          return (
            <Link
              key={song.id}
              href={`/tabs/${song.id}`}
              className="flex items-center gap-3 p-3 hover:bg-gray-800/50 transition group"
            >
              {/* 排名數字 - 縮細版 */}
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                <span className={`
                  text-xs font-bold
                  ${rank === 1 ? 'text-[#FFD700]' : 
                    rank === 2 ? 'text-gray-300' : 
                    rank === 3 ? 'text-amber-600' : 'text-gray-500'}
                `}>
                  {rank}
                </span>
              </div>

              {/* 歌曲縮圖 */}
              <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-800">
                {thumbnail ? (
                  <img 
                    src={thumbnail} 
                    alt={song.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#FFD700]/20 to-orange-500/20">
                    <span className="text-lg">🎵</span>
                  </div>
                )}
              </div>

              {/* 歌曲資訊 */}
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-medium truncate group-hover:text-[#FFD700] transition">
                  {song.title}
                </h4>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                  <span>{(song.viewCount || 0).toLocaleString()} 瀏覽</span>
                  {song.likes > 0 && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                        </svg>
                        {song.likes}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Key 徽章 - 單行滾動 */}
              {keys.length > 0 && (
                <div className="flex-shrink-0 flex gap-1 overflow-x-auto scrollbar-hide max-w-[120px]">
                  {keys.slice(0, 3).map((key, i) => (
                    <span 
                      key={i}
                      className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-[#FFD700]"
                    >
                      {key}
                    </span>
                  ))}
                  {keys.length > 3 && (
                    <span className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-400">
                      +{keys.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* 箭頭 */}
              <div className="flex-shrink-0 text-gray-600 group-hover:text-[#FFD700] transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

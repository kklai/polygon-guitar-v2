/**
 * 簡潔版多歌手輸入組件
 * 
 * 設計：
 * - 主要歌手欄位，右邊有 "+" 按鈕
 * - 撳 "+" 新增歌手欄位
 * - 新增的欄位右邊有關係選擇（合唱/Feat.）
 * - 每個欄位都有獨立 suggest
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { collection, query, where, getDocs, doc, getDoc, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// 關係類型選項
const RELATION_OPTIONS = [
  { value: 'slash', label: '/', separator: ' / ' },      // 簡單分隔
  { value: 'feat', label: 'feat.', separator: ' feat. ' },
  { value: 'with', label: 'with', separator: ' with ' }
]

// 單個歌手欄位組件
function ArtistFieldRow({ 
  index,
  artist,
  onChange,
  onRemove,
  canRemove,
  excludeIds = []
}) {
  const [inputValue, setInputValue] = useState(artist?.name || '')
  const [suggestions, setSuggestions] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isConfirmed, setIsConfirmed] = useState(!!artist?.id) // 是否已確認選擇
  const dropdownRef = useRef(null)

  // 同步外部變化
  useEffect(() => {
    setInputValue(artist?.name || '')
    setIsConfirmed(!!artist?.id)
  }, [artist?.name, artist?.id])

  // 點擊外部關閉下拉
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 搜尋歌手
  const searchArtists = useCallback(async (queryText) => {
    const trimmed = typeof queryText === 'string' ? queryText.trim() : ''
    if (!trimmed) {
      setSuggestions([])
      return
    }

    setIsLoading(true)
    try {
      const results = []
      const seenIds = new Set(excludeIds)
      const lowerQuery = trimmed.toLowerCase()

      // 1. 精確 ID 匹配
      const exactId = lowerQuery.replace(/\s+/g, '-')
      if (!seenIds.has(exactId)) {
        try {
          const docSnap = await getDoc(doc(db, 'artists', exactId))
          if (docSnap.exists()) {
            results.push({ id: docSnap.id, ...docSnap.data() })
            seenIds.add(exactId)
          }
        } catch (e) {}
      }

      // 2. 名稱前綴搜尋
      try {
        const q = query(
          collection(db, 'artists'),
          where('normalizedName', '>=', lowerQuery),
          where('normalizedName', '<=', lowerQuery + '\uf8ff'),
          limit(5)
        )
        const snap = await getDocs(q)
        snap.docs.forEach(d => {
          if (!seenIds.has(d.id) && results.length < 5) {
            results.push({ id: d.id, ...d.data() })
            seenIds.add(d.id)
          }
        })
      } catch (e) {}

      // 3. 包含搜尋（按 name 包含查詢）。結果不足 5 個時必做；查詢很短（<=2 字）時也做，以便搵到「歌手名有陳但 normalizedName 唔係陳開頭」嘅歌手（如 陳奕迅）
      const shouldRunContains = results.length < 5 || trimmed.length <= 2
      if (shouldRunContains) {
        try {
          const allSnap = await getDocs(collection(db, 'artists'))
          const normalizedQuery = lowerQuery.trim()
          const containsMatches = []
          allSnap.docs.forEach(d => {
            if (seenIds.has(d.id)) return
            const data = d.data()
            const name = (data.name || '').toLowerCase().trim()
            const nameContainsQuery = name && name.includes(normalizedQuery)
            const queryContainsName = name && normalizedQuery.includes(name)
            if (nameContainsQuery || queryContainsName) {
              containsMatches.push({ id: d.id, ...data })
            }
          })
          containsMatches.sort((a, b) => (b.tabCount || b.songCount || 0) - (a.tabCount || a.songCount || 0))
          if (trimmed.length <= 2) {
            // 短查詢：合併前綴結果 + 包含結果（按 name 搵到嘅全部合併），之後會再按譜數取頭 5
            const mergedIds = new Set(results.map(r => r.id))
            for (const item of containsMatches) {
              if (!mergedIds.has(item.id)) {
                results.push(item)
                mergedIds.add(item.id)
              }
            }
          } else {
            for (const item of containsMatches) {
              if (results.length >= 5) break
              if (!seenIds.has(item.id)) {
                results.push(item)
                seenIds.add(item.id)
              }
            }
          }
        } catch (e) {}
      }

      // 最終排序：精確 match 排第一，其餘按譜數多寡，最多顯示 5 個
      const exactMatch = results.find(r => r.id === exactId)
      const rest = exactMatch ? results.filter(r => r.id !== exactId) : results
      rest.sort((a, b) => (b.tabCount || b.songCount || 0) - (a.tabCount || a.songCount || 0))
      const topRest = rest.slice(0, exactMatch ? 4 : 5)
      const final = exactMatch ? [exactMatch, ...topRest] : topRest
      setSuggestions(final)
      setShowDropdown(final.length > 0)
      setSelectedIndex(-1)
    } catch (err) {
      console.error('搜尋歌手失敗:', err)
    } finally {
      setIsLoading(false)
    }
  }, [excludeIds])

  // Debounce 搜尋 - 只有未確認時才搜尋
  useEffect(() => {
    if (isConfirmed) return // 已確認的歌手不搜尋
    
    const timer = setTimeout(() => {
      searchArtists(inputValue)
    }, 200)
    return () => clearTimeout(timer)
  }, [inputValue, searchArtists, isConfirmed])

  // 處理輸入變化
  const handleInputChange = (e) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setIsConfirmed(false) // 修改文字時重置確認狀態
    onChange(index, { 
      ...artist, 
      name: newValue, 
      id: null,  // 清除已選擇的 ID
      isNew: true 
    })
  }

  // 選擇歌手
  const handleSelectArtist = (selectedArtist) => {
    setInputValue(selectedArtist.name)
    setShowDropdown(false)
    onChange(index, {
      ...artist,
      name: selectedArtist.name,
      id: selectedArtist.id,
      photo: selectedArtist.photoURL || selectedArtist.wikiPhotoURL,
      isNew: false
    })
  }

  // 鍵盤導航
  const handleKeyDown = (e) => {
    if (!showDropdown) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) {
          handleSelectArtist(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        setShowDropdown(false)
        break
    }
  }

  // 改變關係
  const handleRelationChange = (e) => {
    const newRelation = e.target.value
    onChange(index, { ...artist, relation: newRelation })
  }

  // 獲取類型標籤顏色
  const getTypeColor = (type) => {
    switch (type) {
      case 'male': return 'bg-blue-500/20 text-blue-300'
      case 'female': return 'bg-pink-500/20 text-pink-300'
      case 'group': return 'bg-yellow-500/20 text-yellow-300'
      default: return 'bg-gray-500/20 text-gray-300'
    }
  }

  // 獲取類型標籤文字
  const getTypeLabel = (type) => {
    switch (type) {
      case 'male': return '男歌手'
      case 'female': return '女歌手'
      case 'group': return '組合'
      default: return ''
    }
  }

  const isFirst = index === 0

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-2">
        {/* 如果是第一個，顯示 "主唱" 標籤 */}
        {isFirst && (
          <span className="text-xs text-gray-500 w-10 flex-shrink-0">主唱</span>
        )}
        
        {/* 如果不是第一個，顯示關係選擇 */}
        {!isFirst && (
          <select
            value={artist.relation || 'slash'}
            onChange={handleRelationChange}
            className="w-20 flex-shrink-0 px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm outline-none"
          >
            {RELATION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}

        {/* 如果是第一個，顯示主唱標籤 */}
        {isFirst && (
          <span className="text-xs text-gray-500 w-10 flex-shrink-0">主唱</span>
        )}

        {/* 輸入欄位 */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => !isConfirmed && inputValue && suggestions.length > 0 && setShowDropdown(true)}
            placeholder={isFirst ? "例如：陳奕迅" : "例如：楊千嬅"}
            className={`w-full px-4 py-2 bg-[#282828] border-0 rounded-full text-white placeholder-[#666] outline-none ${
              artist.id ? 'ring-2 ring-green-500/50' : ''
            }`}
          />
          
          {/* 已選擇標記 + 歌手類型 */}
          {artist.id && (
            <div className="absolute right-3 top-2 flex items-center gap-2">
              {artist.artistType && (
                <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(artist.artistType)}`}>
                  {getTypeLabel(artist.artistType)}
                </span>
              )}
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          
          {/* Loading */}
          {isLoading && !artist.id && (
            <div className="absolute right-3 top-2.5">
              <svg className="w-5 h-5 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          )}
        </div>

        {/* 刪除按鈕（如果不是第一個） */}
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-gray-500 hover:text-red-400 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Suggest 下拉選單 */}
      {showDropdown && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, idx) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => handleSelectArtist(suggestion)}
              className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-800 transition text-left ${
                idx === selectedIndex ? 'bg-gray-800' : ''
              }`}
            >
              {/* 歌手圖片 */}
              <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
                {suggestion.photoURL || suggestion.wikiPhotoURL ? (
                  <img 
                    src={suggestion.photoURL || suggestion.wikiPhotoURL} 
                    alt={suggestion.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">🎤</div>
                )}
              </div>
              
              {/* 歌手資訊 */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{suggestion.name}</p>
                <div className="flex items-center gap-2">
                  {suggestion.artistType && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${getTypeColor(suggestion.artistType)}`}>
                      {suggestion.artistType === 'male' ? '男歌手' : 
                       suggestion.artistType === 'female' ? '女歌手' : '組合'}
                    </span>
                  )}
                  {suggestion.tabCount > 0 && (
                    <span className="text-xs text-gray-500">{suggestion.tabCount} 個譜</span>
                  )}
                </div>
              </div>
            </button>
          ))}
          
          {/* 創建新歌手 */}
          <button
            type="button"
            onClick={() => {
              setShowDropdown(false)
              onChange(index, { 
                ...artist, 
                name: inputValue, 
                id: null, 
                isNew: true 
              })
            }}
            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-800 transition text-left border-t border-gray-700"
          >
            <div className="w-10 h-10 rounded-full bg-[#FFD700]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[#FFD700] text-lg">+</span>
            </div>
            <div>
              <p className="text-[#FFD700] font-medium">創建新歌手「{inputValue}」</p>
              <p className="text-xs text-gray-500">如果這位歌手不在資料庫中</p>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}

// 主組件
export default function ArtistInputSimple({ value, onChange }) {
  // value 格式: { artists: [{ name, id, relation, isNew }], displayName: '' }
  const [artists, setArtists] = useState(value?.artists || [{ name: '', id: null, relation: null }])

  // 同步外部變化
  useEffect(() => {
    if (value?.artists) {
      setArtists(value.artists)
    }
  }, [value])

  // 通知父組件
  const notifyChange = useCallback((newArtists) => {
    const displayName = generateDisplayName(newArtists)
    onChange({
      artists: newArtists,
      displayName,
      primaryArtist: newArtists[0],
      collaborators: newArtists.slice(1)
    })
  }, [onChange])

  // 生成顯示名稱
  const generateDisplayName = (artistList) => {
    if (!artistList || artistList.length === 0) return ''
    
    const parts = [artistList[0].name]
    
    for (let i = 1; i < artistList.length; i++) {
      const artist = artistList[i]
      const relation = artist.relation || 'slash'
      const option = RELATION_OPTIONS.find(o => o.value === relation)
      parts.push((option?.separator || ' / ') + artist.name)
    }
    
    return parts.join('')
  }

  // 更新歌手
  const handleUpdateArtist = (index, updatedArtist) => {
    const newArtists = artists.map((a, i) => i === index ? updatedArtist : a)
    setArtists(newArtists)
    notifyChange(newArtists)
  }

  // 添加歌手
  const handleAddArtist = () => {
    const newArtists = [...artists, { name: '', id: null, relation: 'slash', isNew: true }]
    setArtists(newArtists)
    notifyChange(newArtists)
  }

  // 刪除歌手
  const handleRemoveArtist = (index) => {
    const newArtists = artists.filter((_, i) => i !== index)
    setArtists(newArtists)
    notifyChange(newArtists)
  }

  // 獲取已使用的歌手 ID
  const usedIds = artists.map(a => a.id).filter(Boolean)

  return (
    <div className="space-y-3">
      {/* 標籤 */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-white">
          歌手 <span className="text-[#FFD700]">*</span>
        </label>
        <span className="text-xs text-gray-500">
          {artists.length} 位歌手
        </span>
      </div>

      {/* 歌手欄位列表 */}
      <div className="space-y-2">
        {artists.map((artist, index) => (
          <ArtistFieldRow
            key={index}
            index={index}
            artist={artist}
            onChange={handleUpdateArtist}
            onRemove={handleRemoveArtist}
            canRemove={artists.length > 1}
            excludeIds={usedIds.filter(id => id !== artist.id)}
          />
        ))}
      </div>

      {/* 添加按 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleAddArtist}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>添加歌手</span>
        </button>
        
        <span className="text-xs text-gray-500">
          支援合唱 / Featuring
        </span>
      </div>

      {/* 預覽顯示 */}
      {artists[0]?.name && (
        <div className="p-3 bg-gray-900/50 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">顯示效果：</p>
          <p className="text-white font-medium">
            {generateDisplayName(artists)}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * 多歌手輸入組件 - 用於 tabs/new.js 和 tabs/edit.js
 * 
 * 新設計：
 * - 主要歌手（單一，必填）
 * - 合作歌手（多個，可選）
 * - 每個歌手獨立 suggest
 * - 明確定義關係（合唱/Featuring）
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { collection, query, where, getDocs, doc, getDoc, limit } from '@/lib/firestore-tracked'
import { db } from '@/lib/firebase'

// 關係類型選項
const RELATION_OPTIONS = [
  { value: 'chorus', label: '合唱', separator: ' / ' },
  { value: 'featuring', label: 'Featuring', separator: ' feat. ' },
  { value: 'with', label: 'With', separator: ' with ' }
]

// 單個歌手輸入欄位（含 suggest）
function SingleArtistField({ 
  value, 
  onChange, 
  onSelect, 
  placeholder = '輸入歌手名...',
  label,
  excludeIds = [],
  autoFocus = false
}) {
  const [inputValue, setInputValue] = useState(value?.name || '')
  const [suggestions, setSuggestions] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

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
    if (!queryText || queryText.length < 1) {
      setSuggestions([])
      return
    }

    setIsLoading(true)
    try {
      const results = []
      const seenIds = new Set(excludeIds)
      const lowerQuery = queryText.toLowerCase()

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

      // 3. 包含搜尋（本地）
      if (results.length < 5) {
        try {
          const allSnap = await getDocs(collection(db, 'artists'))
          allSnap.docs.forEach(d => {
            if (!seenIds.has(d.id) && results.length < 5) {
              const data = d.data()
              if (data.name?.toLowerCase().includes(lowerQuery)) {
                results.push({ id: d.id, ...data })
                seenIds.add(d.id)
              }
            }
          })
        } catch (e) {}
      }

      setSuggestions(results)
      setShowDropdown(results.length > 0)
      setSelectedIndex(-1)
    } catch (err) {
      console.error('搜尋歌手失敗:', err)
    } finally {
      setIsLoading(false)
    }
  }, [excludeIds])

  // Debounce 搜尋
  useEffect(() => {
    const timer = setTimeout(() => {
      searchArtists(inputValue)
    }, 200)
    return () => clearTimeout(timer)
  }, [inputValue, searchArtists])

  // 處理輸入變化
  const handleInputChange = (e) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange({ name: newValue, id: null }) // 清除已選擇的 ID
  }

  // 選擇歌手
  const handleSelectArtist = (artist) => {
    setInputValue(artist.name)
    setShowDropdown(false)
    onSelect(artist)
  }

  // 鍵盤導航
  const handleKeyDown = (e) => {
    if (!showDropdown) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
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

  // 獲取類型標籤顏色
  const getTypeColor = (type) => {
    switch (type) {
      case 'male': return 'bg-blue-500/20 text-blue-300'
      case 'female': return 'bg-pink-500/20 text-pink-300'
      case 'group': return 'bg-yellow-500/20 text-yellow-300'
      default: return 'bg-gray-500/20 text-gray-300'
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-white mb-1">
          {label}
        </label>
      )}
      
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue && suggestions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full px-4 py-2 bg-[#282828] border-0 rounded-full text-white placeholder-[#666] outline-none"
        />
        
        {isLoading && (
          <div className="absolute right-3 top-2.5">
            <svg className="w-5 h-5 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}
      </div>

      {/* Suggest 下拉選單 */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {suggestions.map((artist, index) => (
            <button
              key={artist.id}
              type="button"
              onClick={() => handleSelectArtist(artist)}
              className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-800 transition text-left ${
                index === selectedIndex ? 'bg-gray-800' : ''
              }`}
            >
              {/* 歌手圖片 */}
              <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
                {artist.photoURL || artist.wikiPhotoURL ? (
                  <img 
                    src={artist.photoURL || artist.wikiPhotoURL} 
                    alt={artist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">🎤</div>
                )}
              </div>
              
              {/* 歌手資訊 */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{artist.name}</p>
                <div className="flex items-center gap-2">
                  {artist.artistType && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${getTypeColor(artist.artistType)}`}>
                      {artist.artistType === 'male' ? '男歌手' : 
                       artist.artistType === 'female' ? '女歌手' : '組合'}
                    </span>
                  )}
                  {artist.tabCount > 0 && (
                    <span className="text-xs text-gray-500">{artist.tabCount} 個譜</span>
                  )}
                </div>
              </div>
              
              {/* 選中標記 */}
              {index === selectedIndex && (
                <svg className="w-5 h-5 text-[#FFD700]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
          
          {/* 創建新歌手選項 */}
          <button
            type="button"
            onClick={() => {
              setShowDropdown(false)
              onSelect({ name: inputValue, id: null, isNew: true })
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

// 合作歌手項目
function CollaboratorItem({ 
  collaborator, 
  index, 
  onUpdate, 
  onRemove,
  existingArtistIds 
}) {
  const [isEditing, setIsEditing] = useState(!collaborator.artistId && !collaborator.isNew)

  const handleSelectArtist = (artist) => {
    onUpdate(index, {
      ...collaborator,
      artistId: artist.id,
      artistName: artist.name,
      artistPhoto: artist.photoURL || artist.wikiPhotoURL,
      isNew: artist.isNew || false
    })
    setIsEditing(false)
  }

  return (
    <div className="flex items-start gap-3 p-3 bg-[#1a1a1a] border border-gray-800 rounded-lg">
      {/* 歌手圖片 */}
      <div className="w-12 h-12 rounded-full bg-gray-800 overflow-hidden flex-shrink-0">
        {collaborator.artistPhoto ? (
          <img 
            src={collaborator.artistPhoto} 
            alt={collaborator.artistName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl">🎤</div>
        )}
      </div>
      
      {/* 歌手資訊 */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <SingleArtistField
            value={{ name: collaborator.artistName }}
            onChange={(v) => onUpdate(index, { ...collaborator, artistName: v.name })}
            onSelect={handleSelectArtist}
            excludeIds={existingArtistIds}
            placeholder="搜尋合作歌手..."
            autoFocus
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">{collaborator.artistName}</span>
            {collaborator.isNew && (
              <span className="text-xs px-1.5 py-0.5 bg-[#FFD700]/20 text-[#FFD700] rounded">
                新歌手
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-gray-500 hover:text-white transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        )}
        
        {/* 關係選擇 */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-gray-500">關係：</span>
          <div className="flex gap-1">
            {RELATION_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => onUpdate(index, { ...collaborator, relation: option.value })}
                className={`px-2 py-1 text-xs rounded transition ${
                  collaborator.relation === option.value
                    ? 'bg-[#FFD700] text-black'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* 刪除按鈕 */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="text-gray-500 hover:text-red-400 transition p-1"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}

// 主組件：多歌手輸入管理器
export default function MultiArtistInput({ 
  primaryArtist, 
  collaborators = [], 
  onChange 
}) {
  const [localPrimary, setLocalPrimary] = useState(primaryArtist || { name: '', id: null })
  const [localCollaborators, setLocalCollaborators] = useState(collaborators)

  // 同步外部變化
  useEffect(() => {
    setLocalPrimary(primaryArtist || { name: '', id: null })
  }, [primaryArtist])

  useEffect(() => {
    setLocalCollaborators(collaborators)
  }, [collaborators])

  // 通知父組件
  const notifyChange = useCallback((primary, collabs) => {
    onChange({
      primaryArtist: primary,
      collaborators: collabs,
      // 生成顯示用字串
      displayString: generateDisplayString(primary, collabs)
    })
  }, [onChange])

  // 處理主要歌手變化
  const handlePrimaryChange = (artist) => {
    setLocalPrimary(artist)
    notifyChange(artist, localCollaborators)
  }

  // 添加合作歌手
  const handleAddCollaborator = () => {
    const newCollaborator = {
      artistId: null,
      artistName: '',
      artistPhoto: null,
      relation: 'chorus',
      order: localCollaborators.length
    }
    const newCollabs = [...localCollaborators, newCollaborator]
    setLocalCollaborators(newCollabs)
    notifyChange(localPrimary, newCollabs)
  }

  // 更新合作歌手
  const handleUpdateCollaborator = (index, updated) => {
    const newCollabs = localCollaborators.map((c, i) => i === index ? updated : c)
    setLocalCollaborators(newCollabs)
    notifyChange(localPrimary, newCollabs)
  }

  // 刪除合作歌手
  const handleRemoveCollaborator = (index) => {
    const newCollabs = localCollaborators.filter((_, i) => i !== index)
      .map((c, i) => ({ ...c, order: i })) // 重新排序
    setLocalCollaborators(newCollabs)
    notifyChange(localPrimary, newCollabs)
  }

  // 獲取已使用的歌手 ID（用於排除）
  const existingArtistIds = [
    localPrimary?.id,
    ...localCollaborators.map(c => c.artistId)
  ].filter(Boolean)

  // 生成顯示字串
  function generateDisplayString(primary, collabs) {
    if (!primary?.name) return ''
    if (!collabs || collabs.length === 0) return primary.name
    
    const parts = [primary.name]
    collabs.forEach(c => {
      const option = RELATION_OPTIONS.find(o => o.value === c.relation)
      parts.push((option?.separator || ' / ') + c.artistName)
    })
    return parts.join('')
  }

  return (
    <div className="space-y-4">
      {/* 主要歌手 */}
      <div>
        <label className="block text-sm font-medium text-white mb-1">
          主要歌手 <span className="text-[#FFD700]">*</span>
        </label>
        <SingleArtistField
          value={localPrimary}
          onChange={(v) => setLocalPrimary(v)}
          onSelect={handlePrimaryChange}
          placeholder="例如：陳奕迅"
          excludeIds={[]}
        />
      </div>

      {/* 合作歌手列表 */}
      {localCollaborators.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white">
            合作歌手
          </label>
          {localCollaborators.map((collab, index) => (
            <CollaboratorItem
              key={index}
              collaborator={collab}
              index={index}
              onUpdate={handleUpdateCollaborator}
              onRemove={handleRemoveCollaborator}
              existingArtistIds={existingArtistIds}
            />
          ))}
        </div>
      )}

      {/* 添加合作歌手按 */}
      <button
        type="button"
        onClick={handleAddCollaborator}
        className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-white hover:border-gray-400 transition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>添加合作歌手</span>
      </button>

      {/* 預覽顯示 */}
      {localPrimary?.name && (
        <div className="p-3 bg-gray-900/50 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">顯示效果：</p>
          <p className="text-white font-medium">
            {generateDisplayString(localPrimary, localCollaborators)}
          </p>
        </div>
      )}
    </div>
  )
}

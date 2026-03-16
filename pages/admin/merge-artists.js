import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from '@/components/Link'
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  updateDoc,
  deleteDoc,
  where
} from '@/lib/firestore-tracked'
import { db } from '@/lib/firebase'
import AdminGuard from '@/components/AdminGuard'
import Layout from '@/components/Layout'
import { ArrowLeft, RefreshCw, Mic } from 'lucide-react'
import { isArtistMatch, generateMergeSuggestions, parseBilingualNameImproved } from '@/lib/artistNameMatcher'

export default function MergeArtistsPage() {
  const [artists, setArtists] = useState([])
  const [duplicates, setDuplicates] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [manualMode, setManualMode] = useState(false)
  const [manualSelection, setManualSelection] = useState({ keep: null, merge: null })

  const fetchArtists = async () => {
    setLoading(true)
    try {
      const snapshot = await getDocs(collection(db, 'artists'))
      const artistsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      setArtists(artistsData)
      findDuplicates(artistsData)
    } catch (error) {
      console.error('獲取歌手失敗:', error)
      showMessage('獲取歌手失敗: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchArtists()
  }, [])

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }

  // 使用智能算法找出重複組
  const findDuplicates = (artistsData) => {
    const suggestions = generateMergeSuggestions(artistsData);
    
    // 轉換為舊格式兼容
    const groups = suggestions.map(s => ({
      artists: s.allArtists,
      primary: s.primary,
      matches: s.matches,
      confidence: s.confidence
    }));
    
    setDuplicates(groups);
  }

  // 合併歌手
  const mergeArtists = async (keepArtist, mergeArtist) => {
    if (!confirm(`確定要將「${mergeArtist.name}」合併到「${keepArtist.name}」嗎？\n\n這會:\n1. 將「${mergeArtist.name}」的 ${mergeArtist.tabCount || 0} 首譜轉移到「${keepArtist.name}」\n2. 刪除「${mergeArtist.name}」的歌手檔案\n\n此操作不可恢復。`)) {
      return
    }

    setProcessing(true)
    try {
      // 1. 更新所有樂譜
      const tabsSnapshot = await getDocs(
        query(collection(db, 'tabs'), where('artistId', '==', mergeArtist.id))
      )
      
      let updatedTabs = 0
      for (const tabDoc of tabsSnapshot.docs) {
        await updateDoc(tabDoc.ref, {
          artistId: keepArtist.id,
          updatedAt: new Date().toISOString()
        })
        updatedTabs++
      }

      // 2. 合併歌手資料
      const keepRef = doc(db, 'artists', keepArtist.id)
      const updates = {
        tabCount: (keepArtist.tabCount || 0) + (mergeArtist.tabCount || 0),
        viewCount: (keepArtist.viewCount || 0) + (mergeArtist.viewCount || 0),
        updatedAt: new Date().toISOString()
      }
      
      // 合併照片（保留優先級高的）
      if (!keepArtist.photoURL && mergeArtist.photoURL) updates.photoURL = mergeArtist.photoURL
      if (!keepArtist.wikiPhotoURL && mergeArtist.wikiPhotoURL) updates.wikiPhotoURL = mergeArtist.wikiPhotoURL
      if (!keepArtist.heroPhoto && mergeArtist.heroPhoto) updates.heroPhoto = mergeArtist.heroPhoto
      
      // 合併簡介（保留較長的）
      if (mergeArtist.bio && (!keepArtist.bio || mergeArtist.bio.length > keepArtist.bio.length)) {
        updates.bio = mergeArtist.bio
      }
      
      // 記錄合併歷史
      updates.mergedArtists = [...(keepArtist.mergedArtists || []), {
        name: mergeArtist.name,
        id: mergeArtist.id,
        mergedAt: new Date().toISOString()
      }]
      
      await updateDoc(keepRef, updates)

      // 3. 刪除被合併的歌手
      await deleteDoc(doc(db, 'artists', mergeArtist.id))

      showMessage(`✅ 合併成功！更新了 ${updatedTabs} 首樂譜`)
      
      // 重新載入
      setSelectedGroup(null)
      setManualSelection({ keep: null, merge: null })
      fetchArtists()
      
    } catch (error) {
      console.error('合併失敗:', error)
      showMessage('合併失敗: ' + error.message, 'error')
    } finally {
      setProcessing(false)
    }
  }

  // 獲取歌手照片
  const getPhoto = (artist) => {
    return artist.photoURL || artist.wikiPhotoURL || artist.photo || null
  }

  // 獲取歌手類型標籤
  const getArtistTypeLabel = (artistType) => {
    switch (artistType) {
      case 'male': return { text: '男歌手', color: 'bg-blue-600/30 text-blue-400 border-blue-500/30' }
      case 'female': return { text: '女歌手', color: 'bg-pink-600/30 text-pink-400 border-pink-500/30' }
      case 'group': return { text: '組合', color: 'bg-yellow-600/30 text-yellow-400 border-yellow-500/30' }
      default: return { text: '其他', color: 'bg-neutral-600/30 text-neutral-400 border-neutral-500/30' }
    }
  }

  return (
    <AdminGuard>
      <Layout>
        <Head>
          <title>合併重複歌手 | Polygon Guitar</title>
        </Head>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* 標題 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">合併重複歌手</h1>
              <p className="text-[#B3B3B3] text-sm mt-1">
                自動檢測並合併重複的歌手檔案
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center text-[#B3B3B3] hover:text-white transition-colors"
              aria-label="返回管理員中心"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>

          {/* 提示訊息 */}
          {message && (
            <div className={`mb-4 p-4 rounded-lg ${
              message.type === 'error' 
                ? 'bg-red-900/50 text-red-200 border border-red-700' 
                : 'bg-green-900/50 text-green-200 border border-green-700'
            }`}>
              {message.text}
            </div>
          )}

          {/* 統計 */}
          <div className="bg-[#121212] rounded-lg p-4 border border-neutral-800 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">{artists.length}</div>
                <div className="text-[#B3B3B3] text-sm">總歌手數</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">{duplicates.length}</div>
                <div className="text-[#B3B3B3] text-sm">發現重複組</div>
              </div>
              <button
                onClick={() => setManualMode(!manualMode)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  manualMode 
                    ? 'bg-[#FFD700] text-black' 
                    : 'bg-[#282828] hover:bg-[#3E3E3E] text-white'
                }`}
              >
                {manualMode ? '返回自動檢測' : '手動合併模式'}
              </button>
              <button
                onClick={fetchArtists}
                disabled={loading}
                className="bg-[#282828] hover:bg-[#3E3E3E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? '載入中...' : <><RefreshCw className="w-4 h-4 inline-block mr-1 align-middle" /> 刷新</>}
              </button>
            </div>
          </div>

          {/* 手動合併模式 */}
          {manualMode && (
            <div className="bg-[#121212] rounded-lg border border-neutral-800 p-6 mb-6">
              <h2 className="text-lg font-bold text-white mb-4">手動選擇合併</h2>
              <p className="text-[#B3B3B3] text-sm mb-4">
                選擇兩個要合併的歌手，第一個會被保留，第二個會被合併到第一個
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[#B3B3B3] text-sm mb-2">保留（主歌手）</label>
                  <select
                    value={manualSelection.keep || ''}
                    onChange={(e) => setManualSelection({...manualSelection, keep: e.target.value})}
                    className="w-full bg-[#0A0A0A] text-white border border-neutral-700 rounded-lg px-4 py-2"
                  >
                    <option value="">選擇歌手...</option>
                    {artists.sort((a, b) => a.name.localeCompare(b.name)).map(artist => {
                      const type = getArtistTypeLabel(artist.artistType)
                      return (
                        <option key={artist.id} value={artist.id}>
                          {artist.name} [{type.text}] ({artist.tabCount || 0}首)
                        </option>
                      )
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-[#B3B3B3] text-sm mb-2">合併（將被刪除）</label>
                  <select
                    value={manualSelection.merge || ''}
                    onChange={(e) => setManualSelection({...manualSelection, merge: e.target.value})}
                    className="w-full bg-[#0A0A0A] text-white border border-neutral-700 rounded-lg px-4 py-2"
                  >
                    <option value="">選擇歌手...</option>
                    {artists
                      .filter(a => a.id !== manualSelection.keep)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(artist => {
                        const type = getArtistTypeLabel(artist.artistType)
                        return (
                          <option key={artist.id} value={artist.id}>
                            {artist.name} [{type.text}] ({artist.tabCount || 0}首)
                          </option>
                        )
                      })}
                  </select>
                </div>
              </div>
              
              {manualSelection.keep && manualSelection.merge && (
                <button
                  onClick={() => {
                    const keep = artists.find(a => a.id === manualSelection.keep)
                    const merge = artists.find(a => a.id === manualSelection.merge)
                    if (keep && merge) mergeArtists(keep, merge)
                  }}
                  disabled={processing}
                  className="bg-red-600 hover:bg-red-500 disabled:bg-neutral-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  {processing ? '處理中...' : '執行合併'}
                </button>
              )}
            </div>
          )}

          {/* 重複組列表 */}
          {!manualMode && (
            <>
              {loading ? (
                <div className="text-center py-12 text-[#B3B3B3]">載入中...</div>
              ) : duplicates.length === 0 ? (
                <div className="text-center py-12 bg-[#121212] rounded-lg border border-neutral-800">
                  <span className="text-4xl mb-4 block">✅</span>
                  <h3 className="text-lg font-medium text-white mb-2">
                    沒有發現重複歌手
                  </h3>
                  <p className="text-[#B3B3B3]">
                    所有歌手檔案都是唯一的
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {duplicates.map((group, groupIdx) => (
                    <div key={groupIdx} className="bg-[#121212] rounded-lg border border-yellow-800/30 p-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-yellow-400">
                          可能重複組 {groupIdx + 1} / {duplicates.length}
                        </h3>
                        <span className="text-sm text-neutral-500">
                          匹配度: {Math.round(group.confidence * 100)}%
                        </span>
                      </div>
                      
                      {/* 顯示匹配原因 */}
                      {group.matches && group.matches.length > 0 && (
                        <div className="mb-4 text-sm">
                          <span className="text-neutral-400">匹配原因: </span>
                          <span className="text-yellow-400">
                            {group.matches.map(m => {
                              const reasons = {
                                'exact': '完全一樣',
                                'chinese_exact': '中文名相同',
                                'chinese_traditional_simplified': '簡繁轉換',
                                'chinese_similar': '中文名相似',
                                'english_similar': '英文名相似',
                                'english_partial': '英文名部分匹配',
                                'full_name_similar': '整體名稱相似',
                                'common_variant': '常見變體'
                              };
                              return reasons[m.reason] || m.reason;
                            }).join(', ')}
                          </span>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {group.artists ? group.artists.map(artist => {
                          const parsed = parseBilingualNameImproved(artist.name)
                          const isPrimary = group.primary && artist.id === group.primary.id
                          return (
                            <div 
                              key={artist.id}
                              className={`bg-[#1a1a1a] rounded-lg p-4 border ${
                                isPrimary
                                  ? 'border-green-500 ring-2 ring-green-500/20' 
                                  : 'border-neutral-800'
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-lg bg-[#0A0A0A] flex items-center justify-center overflow-hidden">
                                  {getPhoto(artist) ? (
                                    <img 
                                      src={getPhoto(artist)} 
                                      alt={artist.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Mic className="w-8 h-8 text-neutral-500" strokeWidth={1.5} />
                                  )}
                                </div>
                                
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-white font-medium">{artist.name}</h4>
                                    {(() => {
                                      const type = getArtistTypeLabel(artist.artistType)
                                      return (
                                        <span className={`text-xs px-2 py-0.5 rounded border ${type.color}`}>
                                          {type.text}
                                        </span>
                                      )
                                    })()}
                                    {isPrimary && (
                                      <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded">
                                        建議保留
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-neutral-500 text-xs">ID: {artist.id}</p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {parsed.chinese && (
                                      <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded">
                                        中文: {parsed.chinese}
                                      </span>
                                    )}
                                    {parsed.english && (
                                      <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">
                                        英文: {parsed.english}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[#B3B3B3] text-sm mt-2">
                                    譜數: {artist.tabCount || 0}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        }) : null}
                      </div>
                      
                      {/* 合併選項 */}
                      <div className="bg-[#1a1a1a] rounded-lg p-4 border border-neutral-800">
                        <p className="text-[#B3B3B3] text-sm mb-3">
                          選擇要保留的歌手（另一個會被合併並刪除）：
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {group.artists && group.artists.map(artist => (
                            <button
                              key={artist.id}
                              onClick={() => {
                                const other = group.artists.find(a => a.id !== artist.id)
                                if (other) mergeArtists(artist, other)
                              }}
                              disabled={processing}
                              className="bg-[#FFD700] hover:bg-yellow-400 disabled:bg-neutral-700 text-black px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                              保留「{artist.name}」
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Layout>
    </AdminGuard>
  )
}

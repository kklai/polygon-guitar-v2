import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { collection, query, getDocs, orderBy } from 'firebase/firestore'

export default function ArtistReport() {
  const router = useRouter()
  const { user, isAdmin } = useAuth()
  const [artists, setArtists] = useState([])
  const [tabs, setTabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterGender, setFilterGender] = useState('all') // all, male, female, group, other
  const [filterNoYear, setFilterNoYear] = useState(false)

  useEffect(() => {
    if (isAdmin) {
      loadData()
    }
  }, [isAdmin])

  const loadData = async () => {
    setLoading(true)
    try {
      // 獲取所有歌手
      const artistsSnapshot = await getDocs(query(collection(db, 'artists'), orderBy('name')))
      const artistsData = artistsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      // 獲取所有譜
      const tabsSnapshot = await getDocs(collection(db, 'tabs'))
      const tabsData = tabsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      setArtists(artistsData)
      setTabs(tabsData)
    } catch (error) {
      console.error('載入失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  // 計算歌手統計
  const getArtistStats = () => {
    return artists.map(artist => {
      const artistTabs = tabs.filter(tab => {
        // 匹配歌手名（支持多歌手）
        if (tab.artist === artist.name) return true
        if (tab.collaborators?.includes(artist.name)) return true
        if (tab.artists?.some(a => a.name === artist.name)) return true
        return false
      })
      
      const yearGroups = {}
      let noYearCount = 0
      
      artistTabs.forEach(tab => {
        const year = tab.songYear || tab.uploadYear
        if (year) {
          const range = getYearRange(year)
          yearGroups[range] = (yearGroups[range] || 0) + 1
        } else {
          noYearCount++
        }
      })
      
      return {
        ...artist,
        songCount: artistTabs.length,
        yearGroups,
        noYearCount,
        tabs: artistTabs
      }
    }).filter(a => a.songCount > 0) // 只顯示有歌嘅歌手
  }

  const getYearRange = (year) => {
    const y = parseInt(year)
    if (y >= 2021) return '2021-2026'
    if (y >= 2016) return '2016-2020'
    if (y >= 2011) return '2011-2015'
    if (y >= 2006) return '2006-2010'
    if (y >= 2000) return '2000-2005'
    if (y >= 1995) return '1995-1999'
    if (y >= 1990) return '1990-1994'
    if (y >= 1980) return '1980-1989'
    return '1979或更早'
  }

  const getGenderLabel = (gender) => {
    const labels = {
      male: '男',
      female: '女', 
      group: '組合',
      other: '其他'
    }
    return labels[gender] || '未知'
  }

  const getGenderColor = (gender) => {
    const colors = {
      male: 'bg-blue-500/20 text-blue-400',
      female: 'bg-pink-500/20 text-pink-400',
      group: 'bg-yellow-500/20 text-[#FFD700]',
      other: 'bg-gray-500/20 text-gray-400'
    }
    return colors[gender] || 'bg-gray-500/20 text-gray-400'
  }

  const stats = getArtistStats()
  
  // 過濾
  const filteredStats = stats.filter(artist => {
    if (filterGender !== 'all' && artist.gender !== filterGender) return false
    if (filterNoYear && artist.noYearCount === 0) return false
    return true
  })

  // 排序：先按性別，再按歌曲數量
  filteredStats.sort((a, b) => {
    const genderOrder = { male: 0, female: 1, group: 2, other: 3, '': 4 }
    if (genderOrder[a.gender] !== genderOrder[b.gender]) {
      return genderOrder[a.gender] - genderOrder[b.gender]
    }
    return b.songCount - a.songCount
  })

  // 計算總數
  const totalStats = {
    artists: stats.length,
    songs: stats.reduce((sum, a) => sum + a.songCount, 0),
    noYearSongs: stats.reduce((sum, a) => sum + a.noYearCount, 0)
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto p-8">
          <div className="bg-[#121212] rounded-xl p-8 text-center">
            <p className="text-gray-400">請以管理員身份登入</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <h1 className="text-2xl font-bold text-white mb-6">歌手報表</h1>
        
        {/* 統計概覽 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <div className="text-gray-400 text-sm">有譜歌手總數</div>
            <div className="text-3xl font-bold text-white">{totalStats.artists}</div>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <div className="text-gray-400 text-sm">譜總數</div>
            <div className="text-3xl font-bold text-[#FFD700]">{totalStats.songs}</div>
          </div>
          <div className="bg-[#121212] rounded-xl p-4 border border-gray-800">
            <div className="text-gray-400 text-sm">冇年份嘅譜</div>
            <div className="text-3xl font-bold text-red-400">{totalStats.noYearSongs}</div>
          </div>
        </div>

        {/* 過濾器 */}
        <div className="bg-[#121212] rounded-xl p-4 border border-gray-800 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-gray-400">性別：</label>
              <select
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
                className="bg-[#1a1a1a] text-white px-3 py-2 rounded-lg border border-gray-700"
              >
                <option value="all">全部</option>
                <option value="male">男歌手</option>
                <option value="female">女歌手</option>
                <option value="group">組合</option>
                <option value="other">其他</option>
              </select>
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterNoYear}
                onChange={(e) => setFilterNoYear(e.target.checked)}
                className="w-4 h-4 accent-[#FFD700]"
              />
              <span className="text-gray-400">只顯示有冇年份歌曲嘅歌手</span>
            </label>
            
            <button
              onClick={loadData}
              className="px-4 py-2 bg-[#282828] text-white rounded-lg hover:bg-[#3E3E3E]"
            >
              刷新數據
            </button>
          </div>
        </div>

        {/* 報表表格 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-[#121212] rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#1a1a1a]">
                <tr>
                  <th className="px-3 py-3 text-left text-gray-400 font-medium">歌手</th>
                  <th className="px-3 py-3 text-left text-gray-400 font-medium">性別</th>
                  <th className="px-3 py-3 text-center text-gray-400 font-medium">總數</th>
                  <th className="px-3 py-3 text-center text-gray-400 font-medium text-red-400">冇年份</th>
                  <th className="px-3 py-3 text-center text-gray-400 font-medium">2021+</th>
                  <th className="px-3 py-3 text-center text-gray-400 font-medium">2016-20</th>
                  <th className="px-3 py-3 text-center text-gray-400 font-medium">2011-15</th>
                  <th className="px-3 py-3 text-center text-gray-400 font-medium">2006-10</th>
                  <th className="px-3 py-3 text-center text-gray-400 font-medium">2000-05</th>
                  <th className="px-3 py-3 text-center text-gray-400 font-medium">1990s</th>
                  <th className="px-3 py-3 text-center text-gray-400 font-medium">更早</th>
                  <th className="px-3 py-3 text-left text-gray-400 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredStats.map((artist) => (
                  <tr key={artist.id} className="hover:bg-[#1a1a1a]">
                    <td className="px-3 py-3">
                      <div className="text-white font-medium">{artist.name}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${getGenderColor(artist.gender)}`}>
                        {getGenderLabel(artist.gender)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-white font-bold">
                      {artist.songCount}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {artist.noYearCount > 0 ? (
                        <span className="text-red-400 font-bold">{artist.noYearCount}</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-400">
                      {artist.yearGroups['2021-2026'] || '-'}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-400">
                      {artist.yearGroups['2016-2020'] || '-'}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-400">
                      {artist.yearGroups['2011-2015'] || '-'}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-400">
                      {artist.yearGroups['2006-2010'] || '-'}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-400">
                      {artist.yearGroups['2000-2005'] || '-'}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-400">
                      {artist.yearGroups['1995-1999'] || artist.yearGroups['1990-1994'] || '-'}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-400">
                      {artist.yearGroups['1980-1989'] || artist.yearGroups['1979或更早'] || '-'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/artists/${artist.id}`)}
                          className="text-blue-400 hover:text-blue-300 text-xs"
                        >
                          歌手頁
                        </button>
                        <button
                          onClick={() => router.push(`/artists/${artist.id}/edit`)}
                          className="text-[#FFD700] hover:text-yellow-300 text-xs"
                        >
                          編輯
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredStats.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                沒有符合條件的歌手
              </div>
            )}
          </div>
        )}

        {/* 冇年份歌曲詳情 */}
        {filterNoYear && filteredStats.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-white mb-4">冇年份歌曲詳情</h2>
            <div className="bg-[#121212] rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#1a1a1a]">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">歌手</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">歌曲名稱</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredStats.map(artist => 
                    artist.tabs
                      .filter(tab => !tab.songYear && !tab.uploadYear)
                      .map(tab => (
                        <tr key={tab.id} className="hover:bg-[#1a1a1a]">
                          <td className="px-4 py-3 text-gray-400">{artist.name}</td>
                          <td className="px-4 py-3 text-white">{tab.title}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => router.push(`/tabs/${tab.id}/edit`)}
                              className="text-[#FFD700] hover:text-yellow-300"
                            >
                              編輯加年份
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

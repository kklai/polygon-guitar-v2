import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPopularArtists, getHotTabs, getRecentTabs, getCategoryImages, getTabsByIds } from '@/lib/tabs'
import { getAllActivePlaylists } from '@/lib/playlists'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import Link from 'next/link'
import Head from 'next/head'
import { siteConfig, generateBreadcrumbSchema } from '@/lib/seo'
import RecentItems from '@/components/RecentItems'
import { SongCard, PlaylistCard, ArtistAvatar } from '@/components/LazyImage'

// Prefetch: fire Firestore queries at module-load time (before component mount/render)
let _prefetchPromise = null
let _prefetchTime = 0

function prefetchHomeData() {
  if (typeof window === 'undefined') return null
  const now = Date.now()
  if (_prefetchPromise && now - _prefetchTime < 30000) return _prefetchPromise
  _prefetchTime = now
  _prefetchPromise = Promise.all([
    getDoc(doc(db, 'settings', 'home')),
    getPopularArtists(30),
    getAllActivePlaylists(),
    getRecentTabs(10),
    getHotTabs(22)
  ])
  return _prefetchPromise
}

prefetchHomeData()

// Stale-while-revalidate: cache processed homepage state
const HOMEPAGE_CACHE_KEY = 'pg_home_v1'
const HOMEPAGE_CACHE_TTL = 10 * 60 * 1000

function slimTabForCache(tab) {
  if (!tab) return tab
  return {
    id: tab.id, title: tab.title, artistName: tab.artistName,
    artistId: tab.artistId, artist: tab.artist,
    thumbnail: tab.thumbnail, albumImage: tab.albumImage,
    youtubeUrl: tab.youtubeUrl, youtubeVideoId: tab.youtubeVideoId,
    viewCount: tab.viewCount, createdAt: tab.createdAt
  }
}

function slimArtistForCache(a) {
  if (!a) return a
  return {
    id: a.id, name: a.name, normalizedName: a.normalizedName,
    photoURL: a.photoURL, wikiPhotoURL: a.wikiPhotoURL, photo: a.photo,
    viewCount: a.viewCount, songCount: a.songCount, tabCount: a.tabCount,
    artistType: a.artistType, gender: a.gender, adminScore: a.adminScore
  }
}

function slimTabs(items) {
  return Array.isArray(items) ? items.map(slimTabForCache) : []
}

function slimArtists(items) {
  return Array.isArray(items) ? items.map(slimArtistForCache) : []
}

function saveHomepageCache(data) {
  try {
    const payload = JSON.stringify(data, (key, value) => {
      if (value && typeof value === 'object' && typeof value.toDate === 'function') {
        return value.toDate().getTime()
      }
      return value
    })
    try {
      localStorage.setItem(HOMEPAGE_CACHE_KEY, payload)
    } catch (quotaErr) {
      localStorage.removeItem(HOMEPAGE_CACHE_KEY)
      localStorage.setItem(HOMEPAGE_CACHE_KEY, payload)
    }
    console.log('[Cache] Saved homepage cache:', Math.round(payload.length / 1024), 'KB')
  } catch (e) {
    console.error('[Cache] Failed to save:', e.name, e.message)
  }
}

function loadHomepageCache() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(HOMEPAGE_CACHE_KEY)
    if (!raw) {
      console.log('[Cache] No cache found')
      return null
    }
    const data = JSON.parse(raw)
    if (Date.now() - data._ts > HOMEPAGE_CACHE_TTL) {
      console.log('[Cache] Cache expired, age:', Math.round((Date.now() - data._ts) / 1000), 's')
      localStorage.removeItem(HOMEPAGE_CACHE_KEY)
      return null
    }
    console.log('[Cache] Cache hit, age:', Math.round((Date.now() - data._ts) / 1000), 's')
    return data
  } catch (e) {
    console.error('[Cache] Failed to load:', e.name, e.message)
    return null
  }
}

const _homepageCache = loadHomepageCache()

// 歌手分類預設資料
const DEFAULT_CATEGORIES = [
  {
    id: 'male',
    name: '男歌手',
    image: 'https://images.unsplash.com/photo-1516280440614-6697288d5d38?w=600&h=400&fit=crop',
    color: 'from-blue-900/80 to-black/80'
  },
  {
    id: 'female',
    name: '女歌手',
    image: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=600&h=400&fit=crop',
    color: 'from-pink-900/80 to-black/80'
  },
  {
    id: 'group',
    name: '組合',
    image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&h=400&fit=crop',
    color: 'from-purple-900/80 to-black/80'
  }
]

// 裁剪維基百科圖片URL（顯示頭部區域）
function getCroppedWikiImage(url) {
  if (!url) return url
  
  // 維基百科圖片通過添加參數來裁剪
  // /thumb/ 路徑的圖片可以修改尺寸
  if (url.includes('/thumb/')) {
    // 將現有尺寸改為正方形頭像尺寸（例如 200x200）
    // 維基圖片格式: .../thumb/.../檔名/寬度px-檔名
    // 改為: .../thumb/.../檔名/200px-檔名
    return url.replace(/\/\d+px-/, '/200px-')
  }
  
  return url
}

// 靜態備用自動歌單（當 Firestore 冇數據時使用）
const FALLBACK_AUTO_PLAYLISTS = [
  {
    id: 'trending',
    title: '24小時熱門',
    source: 'auto',
    coverImage: null,
    songIds: []
  },
  {
    id: 'weekly',
    title: '7日熱門',
    source: 'auto',
    coverImage: null,
    songIds: []
  },
  {
    id: 'monthly',
    title: '本月熱門',
    source: 'auto',
    coverImage: null,
    songIds: []
  },
  {
    id: 'last-month',
    title: '上月熱門',
    source: 'auto',
    coverImage: null,
    songIds: []
  },
  {
    id: '2025',
    title: '2025年熱門',
    source: 'auto',
    coverImage: null,
    songIds: []
  },
  {
    id: '2024',
    title: '2024年熱門',
    source: 'auto',
    coverImage: null,
    songIds: []
  }
]

// 靜態備用手動歌單
const FALLBACK_MANUAL_PLAYLISTS = [
  {
    id: 'featured-1',
    title: '陳奕迅結他精選',
    description: '香港樂壇天王的經典結他譜',
    source: 'manual',
    manualType: 'artist',
    curatedBy: 'Polygon',
    coverImage: null,
    songIds: []
  },
  {
    id: 'featured-2',
    title: '夭心夭肺 Vol.1',
    description: '慘情歌系列精選',
    source: 'manual',
    manualType: 'series',
    curatedBy: 'Polygon',
    coverImage: null,
    songIds: []
  },
  {
    id: 'featured-3',
    title: '新手入門系列',
    description: '適合初學者的簡單譜',
    source: 'manual',
    manualType: 'theme',
    curatedBy: 'Polygon',
    coverImage: null,
    songIds: []
  }
]

// 自訂歌單區域 — 直接 fetch 歌單所有歌
function CustomPlaylistSection({ title, songIds, artistPhotoMap, onSongClick }) {
  const [songs, setSongs] = useState([])

  useEffect(() => {
    if (songIds?.length > 0) {
      getTabsByIds(songIds).then(setSongs)
    }
  }, [songIds?.join(',')])

  if (songs.length === 0) return null

  return (
    <section style={{ marginBottom: 25 }}>
      <h2 className="font-bold text-white pr-6 pb-2 pt-0" style={{ fontSize: '1.375rem', paddingLeft: '1rem' }}>{title}</h2>
      <div className="flex overflow-x-auto scrollbar-hide pr-6 py-2 -my-2" style={{ gap: 14, paddingLeft: '1rem' }}>
        {songs.map((song) => (
          <SongCard
            key={song.id}
            song={song}
            artistPhoto={artistPhotoMap[song.artistId] || artistPhotoMap[song.artist]}
            onClick={() => onSongClick(song.id)}
          />
        ))}
      </div>
    </section>
  )
}

// 時間格式化
const formatTimeAgo = (timestamp) => {
  if (!timestamp) return ''
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  const now = new Date()
  const diff = Math.floor((now - date) / 1000)
  
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`
  return date.toLocaleDateString('zh-HK')
}

// 用於延遲加載非可視區域的 Hook
function useLazySection(sectionId, isEnabled = true) {
  const [isVisible, setIsVisible] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!isEnabled || hasLoaded) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          setHasLoaded(true)
          observer.disconnect()
        }
      },
      { rootMargin: '100px' } // 提前 100px 開始加載
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [isEnabled, hasLoaded])

  return { ref, isVisible, hasLoaded }
}

export default function Home() {
  const router = useRouter()
  const { user, isAdmin } = useAuth()
  const [artists, setArtists] = useState([])
  const [latestSongs, setLatestSongs] = useState([])
  const [hotTabs, setHotTabs] = useState([])
  const [allSongs, setAllSongs] = useState([])
  const [hotArtists, setHotArtists] = useState({
    male: [],
    female: [],
    group: [],
    all: []
  })
  const [artistPhotoMap, setArtistPhotoMap] = useState({})
  const [autoPlaylists, setAutoPlaylists] = useState([])
  const [manualPlaylists, setManualPlaylists] = useState([])
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingPhase, setLoadingPhase] = useState('static')
  const [totalViewCount, setTotalViewCount] = useState(0)
  
  // 首頁設置
  const [homeSettings, setHomeSettings] = useState({
    manualSelection: { male: [], female: [], group: [] },
    useManualSelection: { male: false, female: false, group: false },
    hotArtistSortBy: 'viewCount',
    displayCount: 20,
    sectionOrder: [
      { id: 'categories', enabled: true },
      { id: 'recent', enabled: true },
      { id: 'hotTabs', enabled: true },
      { id: 'hotArtists', enabled: true },
      { id: 'autoPlaylists', enabled: true },
      { id: 'latest', enabled: true },
      { id: 'manualPlaylists', enabled: true }
    ]
  })
  const [recentItems, setRecentItems] = useState([])

  // 渲染單個區域
  const renderSection = (section) => {
    const sectionLabels = {
      categories: '歌手分類',
      recent: '最近瀏覽',
      hotTabs: '熱門結他譜',
      hotArtists: '熱門歌手',
      autoPlaylists: '熱門歌單',
      latest: '最新上架',
      manualPlaylists: '推薦歌單'
    }
    
    const getSectionLabel = (section) => {
      return section.customLabel || sectionLabels[section.id] || section.id
    }
    
    switch (section.id) {
      case 'categories':
        return (
          <section key={section.id} className="pt-2" style={{ marginBottom: 25 }}>
            <div className="flex overflow-x-auto scrollbar-hide pr-6 gap-3" style={{ paddingLeft: '1rem' }}>
              {(loadingPhase === 'static' ? DEFAULT_CATEGORIES : categories).map((category) => (
                <div
                  key={category.id}
                  onClick={() => handleCategoryClick(category.id)}
                  className="flex-shrink-0 flex flex-col cursor-pointer"
                >
                  <div className="relative w-36 h-36 rounded-lg overflow-hidden bg-gray-800">
                    {loadingPhase === 'static' ? (
                      // Phase 1: 骨架屏
                      <>
                        <div className="absolute inset-0 bg-gray-800 animate-pulse" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl opacity-50">🎵</span>
                        </div>
                      </>
                    ) : (
                      // Phase 2+: 實際圖片
                      <img
                        src={category.image}
                        alt={category.name}
                        className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none select-none"
                        draggable="false"
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    <div className="absolute bottom-2 right-0 w-1/2">
                      <span className={`text-black text-[106%] font-bold px-2 py-[0.2px] rounded-none block text-center whitespace-nowrap leading-tight tracking-[0.1em] ${
                        category.id === 'male' ? 'bg-[#1fc3df]' :
                        category.id === 'female' ? 'bg-[#ff9b98]' :
                        'bg-[#fed702]'
                      }`}>
                        {category.name}
                      </span>
                    </div>
                  </div>
                  <div className="w-36 mt-2 px-1">
                    <p className="text-xs text-gray-400 text-left line-clamp-2" style={{ lineHeight: 1.3 }}>
                      {loadingPhase !== 'static' && hotArtists[category.id]?.slice(0, 5).map(a => a.name).join(' · ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )

      case 'recent':
        if (recentItems.length === 0) return null
        return <RecentItems key={section.id} items={recentItems} title={getSectionLabel(section)} />

      case 'hotTabs':
        if (hotTabs.length === 0) {
          return (
            <section key={section.id} style={{ marginBottom: 25 }}>
              <h2 className="font-bold text-white pr-6 pb-2 pt-0" style={{ fontSize: '1.375rem', paddingLeft: '1rem' }}>{getSectionLabel(section)}</h2>
              <div className="flex overflow-x-auto scrollbar-hide pr-6 py-2 -my-2" style={{ gap: 14, paddingLeft: '1rem' }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-36">
                    <div className="w-36 h-36 bg-gray-800 rounded-lg animate-pulse mb-2" />
                    <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse mb-1" />
                    <div className="h-3 bg-gray-800 rounded w-1/2 animate-pulse" />
                  </div>
                ))}
              </div>
            </section>
          )
        }
        return (
          <section key={section.id} style={{ marginBottom: 25 }}>
            <h2 className="font-bold text-white pr-6 pb-2 pt-0" style={{ fontSize: '1.375rem', paddingLeft: '1rem' }}>{getSectionLabel(section)}</h2>
            <div className="flex overflow-x-auto scrollbar-hide pr-6 py-2 -my-2" style={{ gap: 14, paddingLeft: '1rem' }}>
              {hotTabs.map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                  artistPhoto={artistPhotoMap[song.artistId] || artistPhotoMap[song.artist]}
                  onClick={() => handleSongClick(song.id)}
                />
              ))}
            </div>
          </section>
        )

      case 'hotArtists':
        if (!hotArtists.all?.length) {
          return (
            <section key={section.id} style={{ marginBottom: 25 }}>
              <h2 className="font-bold text-white pr-6 pb-2 pt-0" style={{ fontSize: '1.375rem', paddingLeft: '1rem' }}>{getSectionLabel(section)}</h2>
              <div className="flex overflow-x-auto scrollbar-hide pr-6 py-2 -my-2" style={{ gap: 14, paddingLeft: '1rem' }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-36">
                    <div className="w-36 h-36 bg-gray-800 rounded-full animate-pulse mb-2" />
                    <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse" />
                  </div>
                ))}
              </div>
            </section>
          )
        }
        return (
          <section key={section.id} style={{ marginBottom: 25 }}>
            <h2 className="font-bold text-white pr-6 pb-2 pt-0" style={{ fontSize: '1.375rem', paddingLeft: '1rem' }}>{getSectionLabel(section)}</h2>
            <div className="flex overflow-x-auto scrollbar-hide pr-6 py-2 -my-2" style={{ gap: 14, paddingLeft: '1rem' }}>
              {hotArtists.all.map((artist) => (
                <ArtistAvatar
                    key={artist.id}
                    artist={artist}
                    onClick={() => handleArtistClick(artist)}
                  />
              ))}
            </div>
          </section>
        )

      case 'autoPlaylists':
        if (autoPlaylists.length === 0) {
          return (
            <section key={section.id} style={{ marginBottom: 25 }}>
              <h2 className="font-bold text-white pr-6 pb-2 pt-0" style={{ fontSize: '1.375rem', paddingLeft: '1rem' }}>{getSectionLabel(section)}</h2>
              <div className="flex overflow-x-auto scrollbar-hide pr-6 py-2 -my-2" style={{ gap: 14, paddingLeft: '1rem' }}>
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-36">
                    <div className="w-36 h-36 bg-gray-800 rounded-lg animate-pulse mb-2" />
                    <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse" />
                  </div>
                ))}
              </div>
            </section>
          )
        }
        return (
          <section key={section.id} style={{ marginBottom: 25 }}>
            <h2 className="font-bold text-white pr-6 pb-2 pt-0" style={{ fontSize: '1.375rem', paddingLeft: '1rem' }}>{getSectionLabel(section)}</h2>
            <div className="flex overflow-x-auto scrollbar-hide pr-6 py-2 -my-2" style={{ gap: 14, paddingLeft: '1rem' }}>
              {autoPlaylists.map((playlist) => (
                <PlaylistCard
                  key={playlist.id}
                  playlist={playlist}
                  onClick={() => handlePlaylistClick(playlist.id)}
                />
              ))}
            </div>
          </section>
        )

      case 'latest':
        if (latestSongs.length === 0) {
          return (
            <section key={section.id} style={{ marginBottom: 25 }}>
              <h2 className="font-bold text-white pr-6 pb-2 pt-0" style={{ fontSize: '1.375rem', paddingLeft: '1rem' }}>{getSectionLabel(section)}</h2>
              <div className="flex overflow-x-auto scrollbar-hide pr-6 py-2 -my-2" style={{ gap: 14, paddingLeft: '1rem' }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-36">
                    <div className="w-36 h-36 bg-gray-800 rounded-lg animate-pulse mb-2" />
                    <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse mb-1" />
                    <div className="h-3 bg-gray-800 rounded w-1/2 animate-pulse" />
                  </div>
                ))}
              </div>
            </section>
          )
        }
        return (
          <section key={section.id} style={{ marginBottom: 25 }}>
            <h2 className="font-bold text-white pr-6 pb-2 pt-0" style={{ fontSize: '1.375rem', paddingLeft: '1rem' }}>{getSectionLabel(section)}</h2>
            <div className="flex overflow-x-auto scrollbar-hide pr-6 py-2 -my-2" style={{ gap: 14, paddingLeft: '1rem' }}>
              {latestSongs.map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                  artistPhoto={artistPhotoMap[song.artistId] || artistPhotoMap[song.artist]}
                  onClick={() => handleSongClick(song.id)}
                />
              ))}
            </div>
          </section>
        )

      case 'manualPlaylists':
        if (manualPlaylists.length === 0) {
          return (
            <section key={section.id} style={{ marginBottom: 25 }}>
              <h2 className="font-bold text-white pr-6 pb-2 pt-0" style={{ fontSize: '1.375rem', paddingLeft: '1rem' }}>{getSectionLabel(section)}</h2>
              <div className="flex overflow-x-auto scrollbar-hide pr-6 py-2 -my-2" style={{ gap: 14, paddingLeft: '1rem' }}>
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-36">
                    <div className="w-36 h-36 bg-gray-800 rounded-lg animate-pulse mb-2" />
                    <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse" />
                  </div>
                ))}
              </div>
            </section>
          )
        }
        return (
          <section key={section.id} style={{ marginBottom: 25 }}>
            <h2 className="font-bold text-white pr-6 pb-2 pt-0" style={{ fontSize: '1.375rem', paddingLeft: '1rem' }}>{getSectionLabel(section)}</h2>
            <div className="flex overflow-x-auto scrollbar-hide pr-6 py-2 -my-2" style={{ gap: 14, paddingLeft: '1rem' }}>
              {manualPlaylists.map((playlist) => (
                <PlaylistCard
                  key={playlist.id}
                  playlist={playlist}
                  onClick={() => handlePlaylistClick(playlist.id)}
                />
              ))}
            </div>
          </section>
        )

      default:
        // 在 static 階段，自定義區域顯示骨架屏
        if (loadingPhase === 'static') {
          return (
            <section key={section.id} style={{ marginBottom: 25 }}>
              <h2 className="font-bold text-white pr-6 pb-2 pt-0" style={{ fontSize: '1.375rem', paddingLeft: '1rem' }}>{section.title || '載入中...'}</h2>
              <div className="flex overflow-x-auto scrollbar-hide pr-6 py-2 -my-2" style={{ gap: 14, paddingLeft: '1rem' }}>
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-36">
                    <div className="w-36 h-36 bg-gray-800 rounded-lg animate-pulse mb-2" />
                    <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse mb-1" />
                    <div className="h-3 bg-gray-800 rounded w-1/2 animate-pulse" />
                  </div>
                ))}
              </div>
            </section>
          )
        }
        
        // 處理自定義歌單區域
        const customSection = (homeSettings.customPlaylistSections || []).find(s => s.id === section.id)
        
        if (!customSection) {
          return null
        }
        
        // 單歌單區域
        if (customSection.type === 'customPlaylist' && customSection.playlistId) {
          const playlist = manualPlaylists.find(p => p.id === customSection.playlistId) || 
                          autoPlaylists.find(p => p.id === customSection.playlistId)
          
          if (!playlist || !playlist.songIds || playlist.songIds.length === 0) {
            return null
          }
          
          return (
            <CustomPlaylistSection
              key={section.id}
              title={section.title || customSection.title}
              songIds={playlist.songIds}
              artistPhotoMap={artistPhotoMap}
              onSongClick={handleSongClick}
            />
          )
        }
        
        // 多歌單區域
        if (customSection.type === 'playlistGroup' && customSection.playlistIds) {
          const playlists = customSection.playlistIds
            .map(id => manualPlaylists.find(p => p.id === id) || autoPlaylists.find(p => p.id === id))
            .filter(Boolean)
          
          if (playlists.length === 0) {
            return null
          }
          
          return (
            <section key={section.id} style={{ marginBottom: 25 }}>
              <h2 className="font-bold text-white pr-6 pb-2 pt-0" style={{ fontSize: '1.375rem', paddingLeft: '1rem' }}>{section.title || customSection.title}</h2>
              <div className="flex overflow-x-auto scrollbar-hide pr-6 py-2 -my-2" style={{ gap: 14, paddingLeft: '1rem' }}>
                {playlists.map((playlist) => (
                  <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    onClick={() => handlePlaylistClick(playlist.id)}
                  />
                ))}
              </div>
            </section>
          )
        }
        
        return null
    }
  }

  // 分階段載入
  useEffect(() => {
    // Load recent views from localStorage immediately (no Firestore needed)
    try {
      const saved = localStorage.getItem('recentViews')
      if (saved) setRecentItems(JSON.parse(saved).slice(0, 10))
    } catch (e) {}

    // Apply cached data instantly (before Firestore queries return)
    if (_homepageCache) {
      const c = _homepageCache
      if (c.homeSettings) setHomeSettings(prev => ({ ...prev, ...c.homeSettings }))
      setArtists(c.artists || [])
      setLatestSongs(c.latestSongs || [])
      setHotTabs(c.hotTabs || [])
      setAllSongs(c.allSongs || [])
      setHotArtists(c.hotArtists || { male: [], female: [], group: [], all: [] })
      setArtistPhotoMap(c.artistPhotoMap || {})
      setAutoPlaylists(c.autoPlaylists || [])
      setManualPlaylists(c.manualPlaylists || [])
      if (c.categories) setCategories(c.categories)
      setTotalViewCount(c.totalViewCount || 0)
      setLoadingPhase('public')
    }
    
    // Fetch fresh data in background
    loadPublicData().then(() => {
      setLoadingPhase('public')
      loadUserData().then(() => {
        setLoadingPhase('complete')
      })
    })
  }, [])

  // Phase 2: 載入公開資料（不需要登入）
  const loadPublicData = async () => {
    const startTime = performance.now();
    if (_homepageCache) console.log('[Performance] Cache hit — showing cached data instantly');
    
    try {
      // Phase A: Reuse module-level prefetch (queries started before component mounted)
      const [
        settingsDoc,
        popularArtistsData,
        playlistsData,
        recentTabsData,
        defaultHotTabsData
      ] = await prefetchHomeData();
      
      const settings = settingsDoc.exists() ? settingsDoc.data() : {};
      setHomeSettings(prev => ({ ...prev, ...settings }));
      
      const autoPlaylistsData = playlistsData.auto || [];
      const manualPlaylistsData = playlistsData.manual || [];
      
      // Progressive render: set non-dependent state immediately
      setLatestSongs(recentTabsData || []);
      setAutoPlaylists(autoPlaylistsData.length > 0 ? autoPlaylistsData : FALLBACK_AUTO_PLAYLISTS);
      setManualPlaylists(manualPlaylistsData.length > 0 ? manualPlaylistsData : FALLBACK_MANUAL_PLAYLISTS);
      
      console.log('[Performance] Phase A (parallel):', Math.round(performance.now() - startTime), 'ms');

      // Phase B: Process settings-dependent data in parallel
      const hotTabsPromise = (async () => {
        const targetCount = Math.min(settings.hotTabs?.displayCount || 12, 100);
        
        if (settings.hotTabs?.useManual && settings.hotTabs?.manualSelection?.length > 0) {
          const manualIds = settings.hotTabs.manualSelection
            .map(t => typeof t === 'object' && t !== null ? t.id : t)
            .filter(id => typeof id === 'string' && id.trim() !== '')
            .slice(0, 30);
          
          const manualTabs = manualIds.length > 0 ? await getTabsByIds(manualIds) : [];
          
          if (manualTabs.length < targetCount) {
            const manualIdsSet = new Set(manualIds);
            const autoFill = defaultHotTabsData
              .filter(t => !manualIdsSet.has(t.id))
              .slice(0, targetCount - manualTabs.length);
            return [...manualTabs, ...autoFill];
          }
          return manualTabs.slice(0, targetCount);
        }
        return defaultHotTabsData.slice(0, targetCount);
      })();

      const customSongsPromise = (async () => {
        const customSections = settings.customPlaylistSections || [];
        const customSongIds = new Set();
        customSections.forEach(section => {
          if (section.type === 'customPlaylist' && section.playlistId) {
            const playlist = autoPlaylistsData.find(p => p.id === section.playlistId) ||
                            manualPlaylistsData.find(p => p.id === section.playlistId);
            if (playlist?.songIds) {
              playlist.songIds.forEach(id => customSongIds.add(id));
            }
          }
        });
        
        const knownIds = new Set([
          ...defaultHotTabsData.map(t => t.id),
          ...recentTabsData.map(t => t.id)
        ]);
        const missingSongIds = Array.from(customSongIds).filter(id => !knownIds.has(id));
        
        if (missingSongIds.length > 0) {
          return await getTabsByIds(missingSongIds.slice(0, 50));
        }
        return [];
      })();

      const artistsPromise = (async () => {
        let popularArtists = popularArtistsData || [];
        
        const rawManualSelection = Array.isArray(settings.manualSelection) 
          ? settings.manualSelection 
          : [
              ...(settings.manualSelection?.male || []),
              ...(settings.manualSelection?.female || []),
              ...(settings.manualSelection?.group || [])
            ];
        
        const manualArtistIds = rawManualSelection
          .map(item => typeof item === 'object' && item !== null ? item.id : item)
          .filter(id => typeof id === 'string' && id.trim() !== '');
        
        if (manualArtistIds.length > 0) {
          const existingArtistIds = new Set(popularArtists.map(a => a.id));
          const missingIds = manualArtistIds.filter(id => !existingArtistIds.has(id));
          
          if (missingIds.length > 0) {
            const batchSize = 10;
            const allMissing = [];
            for (let i = 0; i < missingIds.length; i += batchSize) {
              const batch = missingIds.slice(i, i + batchSize);
              const q = query(
                collection(db, 'artists'),
                where('__name__', 'in', batch)
              );
              const snapshot = await getDocs(q);
              snapshot.docs.forEach(d => {
                const data = d.data();
                allMissing.push({
                  id: d.id, ...data,
                  photo: data.photoURL || data.wikiPhotoURL || data.photo || null,
                  tabCount: data.songCount || data.tabCount || 0
                });
              });
            }
            popularArtists = [...popularArtists, ...allMissing];
          }
        }
        return popularArtists;
      })();

      const [hotTabsData, customSongs, popularArtists] = await Promise.all([
        hotTabsPromise, customSongsPromise, artistsPromise
      ]);
      
      setHotTabs(hotTabsData);
      setAllSongs(customSongs);
      
      console.log('[Performance] Phase B (parallel):', Math.round(performance.now() - startTime), 'ms');
      
      // 建立照片 lookup
      const photoMap = {};
      popularArtists.forEach(artist => {
        photoMap[artist.id] = artist.photoURL || artist.wikiPhotoURL || artist.photo || null;
        if (artist.name) photoMap[artist.name] = artist.photoURL || artist.wikiPhotoURL || artist.photo || null;
      });
      setArtistPhotoMap(photoMap);
      setTotalViewCount(popularArtists.reduce((sum, a) => sum + (a.viewCount || 0), 0));
      
      // 排序歌手
      const displayCount = settings.displayCount || 20
      const sortBy = settings.hotArtistSortBy || 'viewCount'
      
      const sortArtists = (artists) => {
        return [...artists].sort((a, b) => {
          if (sortBy === 'tabCount') {
            return (b.songCount || b.tabCount || 0) - (a.songCount || a.tabCount || 0)
          } else if (sortBy === 'adminScore') {
            return (b.adminScore || 0) - (a.adminScore || 0)
          } else if (sortBy === 'mixed') {
            const scoreA = (a.viewCount || 0) * 0.5 +
                          (a.songCount || a.tabCount || 0) * 30 +
                          (a.adminScore || 0) * 200
            const scoreB = (b.viewCount || 0) * 0.5 +
                          (b.songCount || b.tabCount || 0) * 30 +
                          (b.adminScore || 0) * 200
            return scoreB - scoreA
          } else {
            const viewsA = a.viewCount || 0
            const viewsB = b.viewCount || 0
            if (viewsB !== viewsA) return viewsB - viewsA
            const scoreA = a.adminScore || 0
            const scoreB = b.adminScore || 0
            if (scoreB !== scoreA) return scoreB - scoreA
            return (b.songCount || b.tabCount || 0) - (a.songCount || a.tabCount || 0)
          }
        })
      }

      const sortedArtists = sortArtists(popularArtists)
      
      const getHotArtists = () => {
        let manualIds = []
        if (Array.isArray(settings.manualSelection)) {
          manualIds = settings.manualSelection
        } else if (typeof settings.manualSelection === 'object' && settings.manualSelection) {
          manualIds = [
            ...(settings.manualSelection?.male || []),
            ...(settings.manualSelection?.female || []),
            ...(settings.manualSelection?.group || [])
          ]
        }
        
        const hasManualSelection = Array.isArray(settings.manualSelection) 
          ? manualIds.length > 0 
          : (settings.useManualSelection?.male || settings.useManualSelection?.female || settings.useManualSelection?.group)

        if (hasManualSelection && manualIds.length > 0) {
          const manualArtists = manualIds
            .map(id => popularArtists.find(a => a.id === id))
            .filter(Boolean)

          const manualIdsSet = new Set(manualIds)
          const autoFill = sortedArtists
            .filter(a => !manualIdsSet.has(a.id))
            .slice(0, displayCount - manualArtists.length)

          return [...manualArtists, ...autoFill].slice(0, displayCount)
        } else {
          return sortedArtists.slice(0, displayCount)
        }
      }
      
      const artistPageSort = (artists) => [...artists].sort((a, b) => {
        const scoreA = a.adminScore || a.totalViewCount || a.viewCount || a.tabCount || 0
        const scoreB = b.adminScore || b.totalViewCount || b.viewCount || b.tabCount || 0
        return scoreB - scoreA
      })
      
      const hotArtistsData = {
        all: getHotArtists(),
        male: artistPageSort(popularArtists.filter(a => (a.artistType || a.gender) === 'male')).slice(0, 5),
        female: artistPageSort(popularArtists.filter(a => (a.artistType || a.gender) === 'female')).slice(0, 5),
        group: artistPageSort(popularArtists.filter(a => (a.artistType || a.gender) === 'group')).slice(0, 5)
      };
      const artistsSlice = sortedArtists.slice(0, 10);
      
      setHotArtists(hotArtistsData);
      setArtists(artistsSlice);
      
      // Save to sessionStorage for instant load on next visit
      saveHomepageCache({
        _ts: Date.now(),
        homeSettings: { sectionOrder: settings.sectionOrder, hotArtistSortBy: settings.hotArtistSortBy, displayCount: settings.displayCount, manualSelection: settings.manualSelection, useManualSelection: settings.useManualSelection },
        hotTabs: slimTabs(hotTabsData),
        latestSongs: slimTabs(recentTabsData),
        autoPlaylists: (autoPlaylistsData || []).map(p => ({ id: p.id, title: p.title, description: p.description, coverImage: p.coverImage, songIds: p.songIds, source: p.source, displayOrder: p.displayOrder })),
        manualPlaylists: (manualPlaylistsData || []).map(p => ({ id: p.id, title: p.title, description: p.description, coverImage: p.coverImage, songIds: p.songIds, source: p.source, displayOrder: p.displayOrder, manualType: p.manualType })),
        allSongs: slimTabs(customSongs),
        hotArtists: {
          all: slimArtists(hotArtistsData.all),
          male: slimArtists(hotArtistsData.male),
          female: slimArtists(hotArtistsData.female),
          group: slimArtists(hotArtistsData.group)
        },
        artists: slimArtists(artistsSlice),
        artistPhotoMap: photoMap,
        totalViewCount: popularArtists.reduce((sum, a) => sum + (a.viewCount || 0), 0)
      });
      
      // 延遲載入分類圖片（非關鍵數據）
      setTimeout(async () => {
        try {
          const categoryImages = await getCategoryImages();
          if (!categoryImages) return;
          
          const artistMap = new Map(popularArtists.map(a => [a.id, a]));
          
          const updatedCategories = DEFAULT_CATEGORIES.map(cat => {
            const catData = categoryImages[cat.id];
            let imageUrl = cat.image;
            
            if (catData?.artistId && artistMap.has(catData.artistId)) {
              const artist = artistMap.get(catData.artistId);
              imageUrl = artist.photoURL || artist.wikiPhotoURL || artist.photo || catData.image || cat.image;
            } else if (catData?.image) {
              imageUrl = catData.image;
            }
            
            if (imageUrl?.includes('wikipedia.org')) {
              imageUrl = getCroppedWikiImage(imageUrl);
            }
            
            return { ...cat, image: imageUrl };
          });
          
          setCategories(updatedCategories);
        } catch (e) {
          console.error('Error loading category images:', e);
        }
      }, 100);
      
    } catch (error) {
      console.error('Error loading public data:', error);
    }
  };
  
  // Phase 3: 載入需要登入的資料
  const loadUserData = async () => {
    try {
      // 載入最近瀏覽（從 localStorage）
      const saved = typeof window !== 'undefined' ? localStorage.getItem('recentViews') : null;
      let items = saved ? JSON.parse(saved).slice(0, 10) : [];
      setRecentItems(items);
      
      // 如果有登入用戶，可以載入個人化資料
      // 例如：喜愛歌曲、推薦等
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  // 獲取歌曲/歌單縮圖
  const getThumbnail = (item, artistPhoto = null) => {
    // 如果是歌單且有封面
    if (item.coverImage) {
      return item.coverImage
    }
    // 如果是歌曲：優先順序 自訂封面 > Spotify 專輯相 > YouTube > 歌手相
    // 1. 用戶自訂封面（coverImage）
    if (item.coverImage) {
      return item.coverImage
    }
    // 2. Spotify 專輯封面
    if (item.albumImage) {
      return item.albumImage
    }
    // 3. YouTube 縮圖
    if (item.youtubeVideoId) {
      return `https://img.youtube.com/vi/${item.youtubeVideoId}/mqdefault.jpg`
    }
    if (item.youtubeUrl) {
      const match = item.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)
      if (match) {
        return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`
      }
    }
    // 4. 如果提供了歌手照片，用作 fallback
    if (artistPhoto) {
      return artistPhoto
    }
    return null
  }

  // 處理分類點擊
  const handleCategoryClick = (categoryId) => {
    router.push(`/artists?category=${categoryId}`)
  }

  // 處理歌手點擊（使用 artist.id 確保連結不變）
  const handleArtistClick = (artist) => {
    router.push(`/artists/${artist.id}`)
  }

  // 處理歌曲點擊
  const handleSongClick = (songId) => {
    router.push(`/tabs/${songId}`)
  }

  // 處理歌單點擊
  const handlePlaylistClick = (playlistId) => {
    router.push(`/playlist/${playlistId}`)
  }

  // 初始靜態載入（Phase 1）- 立即顯示骨架屏
  if (loadingPhase === 'static') {
    return (
      <Layout>
        <div className="min-h-screen bg-black pb-24">
          {/* 分類骨架屏 - 可點擊 */}
          <section className="pt-2" style={{ marginBottom: 25 }}>
            <div className="flex overflow-x-auto scrollbar-hide pr-6 gap-3" style={{ paddingLeft: '1rem' }}>
              {DEFAULT_CATEGORIES.map((category) => (
                <div
                  key={category.id}
                  className="flex-shrink-0 flex flex-col cursor-pointer"
                >
                  <div className="relative w-36 h-36 rounded-lg overflow-hidden bg-gray-800 animate-pulse">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl opacity-50">🎵</span>
                    </div>
                    <div className="absolute bottom-2 right-0 w-1/2">
                      <span className={`text-black text-[106%] font-bold px-2 py-[0.2px] rounded-none block text-center whitespace-nowrap leading-tight tracking-[0.1em] ${
                        category.id === 'male' ? 'bg-[#1fc3df]' :
                        category.id === 'female' ? 'bg-[#ff9b98]' :
                        'bg-[#fed702]'
                      }`}>
                        {category.name}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          
          {/* 熱門譜骨架屏 */}
          <section style={{ marginBottom: 25 }}>
            <h2 className="font-bold text-white pr-6 pb-2 pt-0" style={{ fontSize: '1.375rem', paddingLeft: '1rem' }}>熱門結他譜</h2>
            <div className="flex overflow-x-auto scrollbar-hide pr-6 py-2 -my-2" style={{ gap: 14, paddingLeft: '1rem' }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-36">
                  <div className="w-36 h-36 bg-gray-800 rounded-lg animate-pulse mb-2" />
                  <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse mb-1" />
                  <div className="h-3 bg-gray-800 rounded w-1/2 animate-pulse" />
                </div>
              ))}
            </div>
          </section>
          
          {/* 熱門歌手骨架屏 */}
          <section style={{ marginBottom: 25 }}>
            <h2 className="font-bold text-white pr-6 pb-2 pt-0" style={{ fontSize: '1.375rem', paddingLeft: '1rem' }}>熱門歌手</h2>
            <div className="flex overflow-x-auto scrollbar-hide pr-6 py-2 -my-2" style={{ gap: 14, paddingLeft: '1rem' }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-36">
                  <div className="w-36 h-36 bg-gray-800 rounded-full animate-pulse mb-2" />
                  <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </Layout>
    )
  }

  // SEO 配置
  const seoTitle = siteConfig.name
  const seoDescription = siteConfig.description
  const seoUrl = siteConfig.url
  
  // 結構化數據 - 網站主頁
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteConfig.url}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  }
  
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: '首頁', url: siteConfig.url }
  ])

  return (
    <>
      <Head>
        {/* 基本 Meta */}
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={seoUrl} />
        
        {/* Open Graph */}
        <meta property="og:url" content={seoUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:image" content={`${siteConfig.url}/og-image.jpg`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Polygon Guitar - 香港最大結他譜庫" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content={`${siteConfig.url}/og-image.jpg`} />
        
        {/* 結構化數據 JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([websiteSchema, breadcrumbSchema])
          }}
        />
      </Head>
      <Layout fullWidth>
        <div className="min-h-screen bg-black pb-24">
        {/* Admin 快捷按鈕（右上角） */}
        {isAdmin && (
          <div className="pr-6 pb-2 flex justify-end gap-2" style={{ paddingLeft: '1rem' }}>
            <button
              onClick={() => router.push('/admin/playlists')}
              className="px-3 py-2 bg-[#282828] text-[#FFD700] border border-[#FFD700] rounded-full font-medium hover:bg-[#3E3E3E] transition text-sm"
            >
              管理歌單
            </button>
            <button
              onClick={() => router.push('/admin/home-settings')}
              className="px-3 py-2 bg-[#282828] text-[#FFD700] border border-[#FFD700] rounded-full font-medium hover:bg-[#3E3E3E] transition text-sm"
            >
              首頁設置
            </button>
          </div>
        )}

        {/* 根據 sectionOrder 動態渲染各區域 */}
        {(homeSettings.sectionOrder || [
          { id: 'categories', enabled: true },
          { id: 'recent', enabled: true },
          { id: 'hotTabs', enabled: true },
          { id: 'hotArtists', enabled: true },
          { id: 'autoPlaylists', enabled: true },
          { id: 'latest', enabled: true },
          { id: 'manualPlaylists', enabled: true }
        ])
          .filter(section => section.enabled !== false)
          .map(section => renderSection(section))}

        {/* 底部 Spacer */}
        <div className="h-8" />
        
      </div>

      {/* Custom Styles for scrollbar-hide */}
      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </Layout>
    </>
  )
}

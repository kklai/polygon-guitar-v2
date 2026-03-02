import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPopularArtists, getHotTabs, getRecentTabs, getCategoryImages, getTabsByIds, getAllTabs } from '@/lib/tabs'
import { getAutoPlaylists, getManualPlaylists } from '@/lib/playlists'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import Link from 'next/link'
import Head from 'next/head'
import { siteConfig, generateBreadcrumbSchema } from '@/lib/seo'
import RecentItems from '@/components/RecentItems'
import { SongCard, PlaylistCard, ArtistAvatar } from '@/components/LazyImage'

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
  const [hotTabs, setHotTabs] = useState([]) // 最近一個月熱門譜
  const [allSongs, setAllSongs] = useState([]) // 用於歌單歌曲查找
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
  const [loadingPhase, setLoadingPhase] = useState('static') // 'static' | 'public' | 'user' | 'complete'
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
          <section key={section.id} className="mb-6 pt-2">
            <div className="flex overflow-x-auto scrollbar-hide px-6 gap-3">
              {(loadingPhase === 'static' ? DEFAULT_CATEGORIES : categories).map((category) => (
                <div
                  key={category.id}
                  onClick={() => handleCategoryClick(category.id)}
                  className="flex-shrink-0 flex flex-col cursor-pointer"
                >
                  <div className="relative w-36 h-36 rounded-[4px] overflow-hidden bg-gray-800">
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
                    <p className="text-xs text-gray-400 truncate text-left leading-relaxed">
                      {loadingPhase !== 'static' && hotArtists[category.id]?.slice(0, 5).map(a => a.name).join(' · ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )

      case 'recent':
        // recent 區域在用戶資料載入後才顯示
        if (loadingPhase === 'static' || loadingPhase === 'public') {
          return null; // 不顯示骨架屏，直接隱藏
        }
        return <RecentItems key={section.id} items={recentItems} title={getSectionLabel(section)} />

      case 'hotTabs':
        if (loadingPhase === 'static') {
          return (
            <section key={section.id} className="mb-10">
              <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">{getSectionLabel(section)}</h2>
              <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-36">
                    <div className="w-36 h-36 bg-gray-800 rounded-lg animate-pulse mb-3" />
                    <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse mb-1" />
                    <div className="h-3 bg-gray-800 rounded w-1/2 animate-pulse" />
                  </div>
                ))}
              </div>
            </section>
          )
        }
        return hotTabs.length > 0 && (
          <section key={section.id} className="mb-10">
            <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">{getSectionLabel(section)}</h2>
            <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
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
        if (loadingPhase === 'static') {
          return (
            <section key={section.id} className="mb-10">
              <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">{getSectionLabel(section)}</h2>
              <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 flex flex-col items-center">
                    <div className="w-24 h-24 md:w-32 md:h-32 bg-gray-800 rounded-full animate-pulse mb-3" />
                    <div className="h-4 bg-gray-800 rounded w-20 animate-pulse" />
                  </div>
                ))}
              </div>
            </section>
          )
        }
        return hotArtists.all?.length > 0 && (
          <section key={section.id} className="mb-10">
            <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">{getSectionLabel(section)}</h2>
            <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
              {hotArtists.all.map((artist) => (
                <div key={artist.id} className="flex-shrink-0">
                  <ArtistAvatar
                    artist={artist}
                    onClick={() => handleArtistClick(artist)}
                  />
                </div>
              ))}
            </div>
          </section>
        )

      case 'autoPlaylists':
        if (loadingPhase === 'static') {
          return (
            <section key={section.id} className="mb-10">
              <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">{getSectionLabel(section)}</h2>
              <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-40">
                    <div className="w-40 h-40 bg-gray-800 rounded-lg animate-pulse mb-3" />
                    <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse" />
                  </div>
                ))}
              </div>
            </section>
          )
        }
        return autoPlaylists.length > 0 && (
          <section key={section.id} className="mb-10">
            <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">{getSectionLabel(section)}</h2>
            <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
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
        if (loadingPhase === 'static') {
          return (
            <section key={section.id} className="mb-10">
              <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">{getSectionLabel(section)}</h2>
              <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-36">
                    <div className="w-36 h-36 bg-gray-800 rounded-lg animate-pulse mb-3" />
                    <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse mb-1" />
                    <div className="h-3 bg-gray-800 rounded w-1/2 animate-pulse" />
                  </div>
                ))}
              </div>
            </section>
          )
        }
        return latestSongs.length > 0 && (
          <section key={section.id} className="mb-10">
            <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">{getSectionLabel(section)}</h2>
            <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
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
        if (loadingPhase === 'static') {
          return (
            <section key={section.id} className="mb-10">
              <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">{getSectionLabel(section)}</h2>
              <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-40">
                    <div className="w-40 h-40 bg-gray-800 rounded-lg animate-pulse mb-3" />
                    <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse" />
                  </div>
                ))}
              </div>
            </section>
          )
        }
        return manualPlaylists.length > 0 && (
          <section key={section.id} className="mb-10">
            <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">{getSectionLabel(section)}</h2>
            <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
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
            <section key={section.id} className="mb-10">
              <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">{section.title || '載入中...'}</h2>
              <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-36">
                    <div className="w-36 h-36 bg-gray-800 rounded-lg animate-pulse mb-3" />
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
          
          const sectionSongs = playlist.songIds
            .map(id => latestSongs.find(s => s.id === id) || 
                        hotTabs.find(s => s.id === id) ||
                        allSongs.find(s => s.id === id))
            .filter(Boolean)
          
          if (sectionSongs.length === 0) {
            return null
          }
          
          return (
            <section key={section.id} className="mb-10">
              <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">{section.title || customSection.title}</h2>
              <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
                {sectionSongs.map((song) => (
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
            <section key={section.id} className="mb-10">
              <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">{section.title || customSection.title}</h2>
              <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
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
    // Phase 1: 立即顯示靜態內容
    setLoadingPhase('static')
    
    // Phase 2: 載入公開資料（不需要登入）
    loadPublicData().then(() => {
      setLoadingPhase('public')
      
      // Phase 3: 載入需要登入的資料
      loadUserData().then(() => {
        setLoadingPhase('complete')
      })
    })
  }, [])

  // 緩存設定（避免重複獲取）
  const CACHE_DURATION = 5 * 60 * 1000; // 5分鐘緩存
  
  // Phase 2: 載入公開資料（不需要登入）
  const loadPublicData = async () => {
    const startTime = performance.now();
    
    try {
      // 並行載入：設置、熱門歌手、歌單、最新歌曲
      const [
        settingsDoc,
        popularArtistsData,
        autoPlaylistsData,
        manualPlaylistsData,
        recentTabsData
      ] = await Promise.all([
        getDoc(doc(db, 'settings', 'home')),
        getPopularArtists(30),
        getAutoPlaylists(),
        getManualPlaylists(),
        getRecentTabs(10)
      ]);
      
      const settings = settingsDoc.exists() ? settingsDoc.data() : {};
      setHomeSettings(prev => ({ ...prev, ...settings }));
      
      console.log('[Performance] Core public data loaded:', Math.round(performance.now() - startTime), 'ms');

      // 處理熱門樂譜
      let hotTabsData = [];
      const targetCount = Math.min(settings.hotTabs?.displayCount || 12, 100);
      
      if (settings.hotTabs?.useManual && settings.hotTabs?.manualSelection?.length > 0) {
        const manualIds = settings.hotTabs.manualSelection
          .map(t => typeof t === 'object' && t !== null ? t.id : t)
          .filter(id => typeof id === 'string' && id.trim() !== '')
          .slice(0, 30);
        
        const manualTabs = manualIds.length > 0 ? await getTabsByIds(manualIds) : [];
        
        if (manualTabs.length < targetCount) {
          const manualIdsSet = new Set(manualIds);
          const [hotTabs] = await Promise.all([getHotTabs(targetCount + 10)]);
          const autoFill = hotTabs.filter(t => !manualIdsSet.has(t.id)).slice(0, targetCount - manualTabs.length);
          hotTabsData = [...manualTabs, ...autoFill];
        } else {
          hotTabsData = manualTabs.slice(0, targetCount);
        }
      } else {
        hotTabsData = await getHotTabs(targetCount);
      }
      
      setHotTabs(hotTabsData);
      setLatestSongs(recentTabsData || []);
      setAutoPlaylists(autoPlaylistsData?.length > 0 ? autoPlaylistsData : FALLBACK_AUTO_PLAYLISTS);
      setManualPlaylists(manualPlaylistsData?.length > 0 ? manualPlaylistsData : FALLBACK_MANUAL_PLAYLISTS);
      
      // 加載自定義歌單區域的歌曲
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
      
      const existingIds = new Set([
        ...hotTabsData.map(t => t.id),
        ...recentTabsData.map(t => t.id)
      ]);
      const missingSongIds = Array.from(customSongIds).filter(id => !existingIds.has(id));
      
      let customSongs = [];
      if (missingSongIds.length > 0) {
        customSongs = await getTabsByIds(missingSongIds.slice(0, 50));
      }
      setAllSongs(customSongs);
      
      // 處理歌手數據
      let popularArtists = popularArtistsData || [];
      
      const rawManualSelection = Array.isArray(settings.manualSelection) 
        ? settings.manualSelection 
        : [
            ...(settings.manualSelection?.male || []),
            ...(settings.manualSelection?.female || []),
            ...(settings.manualSelection?.group || [])
          ];
      
      const manualIds = rawManualSelection
        .map(item => typeof item === 'object' && item !== null ? item.id : item)
        .filter(id => typeof id === 'string' && id.trim() !== '');
      
      if (manualIds.length > 0) {
        const existingIds = new Set(popularArtists.map(a => a.id));
        const missingIds = manualIds.filter(id => !existingIds.has(id));
        
        if (missingIds.length > 0) {
          const missingArtists = await Promise.all(
            missingIds.map(id => 
              getDoc(doc(db, 'artists', id)).then(doc => {
                if (!doc.exists()) return null;
                const data = doc.data();
                return { id: doc.id, ...data, photo: data.photoURL || data.wikiPhotoURL || data.photo || null, tabCount: data.songCount || data.tabCount || 0 };
              }).catch(() => null)
            )
          );
          popularArtists = [...popularArtists, ...missingArtists.filter(Boolean)];
        }
      }
      
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
      
      setHotArtists({
        all: getHotArtists(),
        male: sortedArtists.filter(a => (a.artistType || a.gender) === 'male').slice(0, 5),
        female: sortedArtists.filter(a => (a.artistType || a.gender) === 'female').slice(0, 5),
        group: sortedArtists.filter(a => (a.artistType || a.gender) === 'group').slice(0, 5)
      });
      
      setArtists(sortedArtists.slice(0, 10));
      
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
          <section className="mb-6 pt-2">
            <div className="flex overflow-x-auto scrollbar-hide px-6 gap-3">
              {DEFAULT_CATEGORIES.map((category) => (
                <div
                  key={category.id}
                  className="flex-shrink-0 flex flex-col cursor-pointer"
                >
                  <div className="relative w-36 h-36 rounded-[4px] overflow-hidden bg-gray-800 animate-pulse">
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
          <section className="mb-10">
            <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">熱門結他譜</h2>
            <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-36">
                  <div className="w-36 h-36 bg-gray-800 rounded-lg animate-pulse mb-3" />
                  <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse mb-1" />
                  <div className="h-3 bg-gray-800 rounded w-1/2 animate-pulse" />
                </div>
              ))}
            </div>
          </section>
          
          {/* 熱門歌手骨架屏 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-white px-6 pb-2 pt-0">熱門歌手</h2>
            <div className="flex overflow-x-auto scrollbar-hide px-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex-shrink-0 flex flex-col items-center">
                  <div className="w-24 h-24 md:w-32 md:h-32 bg-gray-800 rounded-full animate-pulse mb-3" />
                  <div className="h-4 bg-gray-800 rounded w-20 animate-pulse" />
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
        {/* Admin 設置按鈕（右上角） */}
        {isAdmin && (
          <div className="px-6 pb-2 flex justify-end">
            <button
              onClick={() => router.push('/admin/home-settings')}
              className="px-3 py-2 bg-[#FFD700] text-black rounded-full font-medium hover:opacity-90 transition text-sm"
              title="首頁設置"
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
        
        {/* Admin Notice - 如果係管理員，顯示歌單管理提示 */}
        {isAdmin && (
          <div className="px-6 pb-24">
            <div className="p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-400 font-medium">管理員提示</p>
                  <p className="text-yellow-200/70 text-sm mt-1">
                    如果歌單未有數據，請到管理後台創建
                  </p>
                </div>
                <Link
                  href="/admin/playlists"
                  className="px-4 py-2 bg-yellow-700 text-white rounded-lg hover:bg-yellow-600 transition text-sm"
                >
                  管理歌單
                </Link>
              </div>
            </div>
          </div>
        )}
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

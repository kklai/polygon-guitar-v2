// 角色權限定義
export const ROLES = {
  SUPER_ADMIN: 'super_admin',    // 你 - 所有權限
  ART_DIRECTOR: 'art_director',  // 視覺設計 - Logo、相片、封面
  SCORE_CHECKER: 'score_checker', // 樂譜編輯 - 編輯樂譜、歌手資料
  PLAYLIST_MAKER: 'playlist_maker' // 歌單製作 - 創建歌單
}

// 角色顯示名稱
export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: '超級管理員',
  [ROLES.ART_DIRECTOR]: 'Art Director',
  [ROLES.SCORE_CHECKER]: 'Score Checker',
  [ROLES.PLAYLIST_MAKER]: 'Playlist Maker'
}

// 角色顏色
export const ROLE_COLORS = {
  [ROLES.SUPER_ADMIN]: 'bg-red-500',
  [ROLES.ART_DIRECTOR]: 'bg-pink-500',
  [ROLES.SCORE_CHECKER]: 'bg-blue-500',
  [ROLES.PLAYLIST_MAKER]: 'bg-green-500'
}

// 每個角色可訪問的頁面
export const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [
    '/admin',
    '/admin/admins',
    '/admin/role-settings',
    '/admin/playlists',
    '/admin/artists-v2',
    '/admin/artists-region',
    '/admin/artists-score',
    '/admin/category-images',
    '/admin/hero-photos',
    '/admin/import-tabs',
    '/admin/migrated-tabs',
    '/admin/merge-artists',
    '/admin/analyze',
    '/admin/migrate',
    '/admin/logo',
    '/admin/bulk-youtube',
    '/admin/spotify-manager',
    '/admin/home-settings',
    '/admin/data-review',
    '/admin/fix-artist',
    '/admin/analytics',
    '/admin/category-covers'
  ],
  [ROLES.ART_DIRECTOR]: [
    '/admin',
    '/admin/logo',
    '/admin/category-covers',
    '/admin/hero-photos',
    '/admin/artists-v2',  // 只限編輯歌手照片
    '/admin/spotify-manager'  // 歌手相片
  ],
  [ROLES.SCORE_CHECKER]: [
    '/admin',
    '/admin/migrated-tabs',
    '/admin/artists-v2',  // 編輯歌手資料
    '/admin/fix-artist',
    '/admin/data-review',
    '/admin/merge-artists'
  ],
  [ROLES.PLAYLIST_MAKER]: [
    '/admin',
    '/admin/playlists',
    '/admin/playlists/new',
    '/admin/playlists/edit'  // 動態路由會另外處理
  ]
}

// 檢查用戶是否有權限訪問某頁面
export function hasPermission(user, pathname) {
  if (!user) return false
  
  // 超級管理員（你的email）永遠有權限
  if (user.email === 'kermit.tam@gmail.com') return true
  
  // 獲取用戶角色
  const userRole = user.role || (user.isAdmin ? ROLES.SUPER_ADMIN : null)
  if (!userRole) return false
  
  // 超級管理員有所有權限
  if (userRole === ROLES.SUPER_ADMIN) return true
  
  // 檢查該角色是否有此頁面權限
  const allowedPages = ROLE_PERMISSIONS[userRole] || []
  
  // 精確匹配
  if (allowedPages.includes(pathname)) return true
  
  // 處理動態路由（如 /admin/playlists/edit/[id]）
  return allowedPages.some(page => {
    // 如果 allowedPages 包含開頭部分就匹配
    if (page.endsWith('/edit') && pathname.startsWith(page)) return true
    if (page.endsWith('/new') && pathname.startsWith(page)) return true
    return pathname.startsWith(page + '/')
  })
}

// 獲取用戶角色標籤
export function getRoleLabel(role) {
  return ROLE_LABELS[role] || '用戶'
}

// 獲取用戶角色顏色
export function getRoleColor(role) {
  return ROLE_COLORS[role] || 'bg-gray-500'
}

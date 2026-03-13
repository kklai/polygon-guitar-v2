// Skeleton loading component
export default function Skeleton({ className = '', circle = false }) {
  return (
    <div
      className={`
        animate-pulse bg-[#282828] 
        ${circle ? 'rounded-full' : 'rounded'}
        ${className}
      `}
    />
  )
}

// 預設的骨架屏樣式
export function TabCardSkeleton() {
  return (
    <div className="bg-[#121212] rounded-lg shadow-md overflow-hidden border border-neutral-800">
      {/* 封面骨架 */}
      <div className="w-full aspect-square bg-[#282828] animate-pulse" />
      
      <div className="p-4 space-y-3">
        {/* 歌名骨架 */}
        <Skeleton className="h-6 w-3/4" />
        
        {/* 歌手骨架 */}
        <Skeleton className="h-5 w-20 rounded-full" />
        
        {/* 分隔線 */}
        <div className="border-t border-neutral-800 my-3" />
        
        {/* 資料骨架 */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </div>
  )
}

export function ArtistCardSkeleton() {
  return (
    <div className="flex flex-col items-center">
      <Skeleton circle className="w-24 h-24 md:w-32 md:h-32 mb-3" />
      <Skeleton className="h-4 w-20" />
    </div>
  )
}

export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="w-12 h-12 rounded" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

import dynamic from 'next/dynamic'
import Layout from '@/components/Layout'
import { getSearchData } from '@/lib/searchData'

// 輕量 shell 先出，再動態載入歌手頁內容 → 導航即時
const ArtistsPageContent = dynamic(
  () => import('@/components/ArtistsPageContent'),
  {
    loading: () => (
      <div className="min-h-[60vh] flex items-center justify-center text-[#B3B3B3]">
        載入中...
      </div>
    )
  }
)

export default function ArtistsPage(props) {
  return (
    <Layout fullWidth>
      <ArtistsPageContent {...props} />
    </Layout>
  )
}

export async function getStaticProps() {
  try {
    console.log('[Artists] getStaticProps: loading...')
    const data = await getSearchData()
    const initialArtists = data?.artists ?? []
    console.log('[Artists] getStaticProps: done (%d artists)', initialArtists.length)
    return { props: { initialArtists }, revalidate: 300 }
  } catch (e) {
    console.error('[Artists] getStaticProps:', e?.message)
    return { props: { initialArtists: [] }, revalidate: 60 }
  }
}

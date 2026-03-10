import dynamic from 'next/dynamic'
import Layout from '@/components/Layout'

// No getStaticProps: shell + data load on client so nav is instant (no server wait on Firestore).
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

export default function ArtistsPage() {
  return (
    <Layout fullWidth>
      <ArtistsPageContent initialArtists={[]} />
    </Layout>
  )
}

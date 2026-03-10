import dynamic from 'next/dynamic'
import Layout from '@/components/Layout'

// No getStaticProps: shell + data load on client so nav is instant (no server wait on Firestore).
const HomePageContent = dynamic(
  () => import('@/components/HomePageContent'),
  {
    loading: () => (
      <div className="min-h-[60vh] flex items-center justify-center text-[#B3B3B3]">
        載入中...
      </div>
    )
  }
)

export default function Home() {
  return (
    <Layout fullWidth>
      <HomePageContent initialHomeSettings={{}} initialHomeData={null} />
    </Layout>
  )
}

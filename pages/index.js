import dynamic from 'next/dynamic'
import Layout from '@/components/Layout'

// 輕量 shell 先出，再動態載入首頁內容 → 導航即時
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

export default function Home(props) {
  return (
    <Layout fullWidth>
      <HomePageContent {...props} />
    </Layout>
  )
}

// Firestore doc may contain non-JSON values (e.g. Timestamp); serialize so props pass to client
function serializeHomeSettings(data) {
  if (!data || typeof data !== 'object') return {}
  return JSON.parse(JSON.stringify(data, (_, v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v)))
}

export async function getStaticProps() {
  try {
    const { getHomeData } = await import('@/lib/homeData')
    const initialHomeData = await getHomeData()
    return {
      props: {
        initialHomeSettings: initialHomeData.homeSettings || {},
        initialHomeData
      },
      revalidate: 300
    }
  } catch (e) {
    console.error('[Home] getStaticProps:', e?.message)
    return {
      props: {
        initialHomeSettings: {},
        initialHomeData: null
      },
      revalidate: 60
    }
  }
}

/**
 * Analytics page disabled — always 404 to avoid Firestore read cost.
 * Previously at /admin/analytics (hidden from menu).
 */

export async function getServerSideProps() {
  return { notFound: true }
}

export default function AnalyticsDisabled() {
  return null
}

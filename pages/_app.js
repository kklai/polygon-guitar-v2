import '@/styles/globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import Head from 'next/head'

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </Head>
      <Component {...pageProps} />
    </AuthProvider>
  )
}

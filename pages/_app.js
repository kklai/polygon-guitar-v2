import '@/styles/globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import Head from 'next/head'
import { siteConfig } from '@/lib/seo'

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Head>
        {/* 預設 Meta Tags */}
        <title>Polygon Guitar - 香港最大結他譜庫 | 3000+ 結他譜</title>
        <meta name="description" content={siteConfig.description} />
        <meta name="keywords" content="結他譜, guitar tabs, chords, 廣東歌結他譜, 粵語歌chords, 國語歌結他譜, 香港結他譜, hk guitar tabs, cantopop chords, 轉調, capo, 結他教學" />
        <meta name="author" content="Polygon Guitar" />
        <meta name="theme-color" content="#000000" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        
        {/* Open Graph 預設 */}
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="zh_HK" />
        <meta property="og:url" content={siteConfig.url} />
        <meta property="og:site_name" content={siteConfig.name} />
        <meta property="og:image" content={`${siteConfig.url}/og-image.jpg`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Polygon Guitar - 香港最大結他譜庫" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:handle" content={siteConfig.twitter} />
        <meta name="twitter:site" content={siteConfig.twitter} />
        
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="manifest" href="/site.webmanifest" />
      </Head>
      <Component {...pageProps} />
    </AuthProvider>
  )
}

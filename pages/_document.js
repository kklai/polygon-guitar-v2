import { Html, Head, Main, NextScript } from 'next/document'

// 返回上一頁時若有 scroll 要還原，先顯示黑 overlay 避免 refresh 閃黑畫面（iOS app mode）
const restoreOverlayScript = `
(function(){
  try {
    var key = 'pg_scroll';
    var path = window.location.pathname + window.location.search;
    var raw = sessionStorage.getItem(key);
    if (!raw) return;
    var data = JSON.parse(raw);
    if (typeof data[path] === 'number' && data[path] > 0) {
      document.documentElement.classList.add('pg-restoring');
    }
  } catch(e){}
})();
`

const restoreOverlayStyles = `
#pg-restore-overlay{position:fixed;inset:0;background:#000;z-index:99999;opacity:0;pointer-events:none;transition:opacity .35s ease-out}
html.pg-restoring #pg-restore-overlay{opacity:1}
`

export default function Document() {
  return (
    <Html lang="zh-HK">
      <Head>
        <meta name="description" content="結他譜分享平台" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;700&family=Source+Code+Pro:wght@300;400;700&family=Noto+Music&display=swap" rel="stylesheet" />
      </Head>
      <body>
        <style dangerouslySetInnerHTML={{ __html: restoreOverlayStyles }} />
        <script dangerouslySetInnerHTML={{ __html: restoreOverlayScript }} />
        <div id="pg-restore-overlay" aria-hidden="true" />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}

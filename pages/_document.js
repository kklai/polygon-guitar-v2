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
        <link rel="icon" href="/favicon.ico" />
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

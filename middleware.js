import { NextResponse } from 'next/server'

// 簡單密碼保護 - 朋友專用
const ACCESS_PASSWORD = 'polygon2024'
const COOKIE_NAME = 'polygon_access'

export function middleware(request) {
  const { pathname } = request.nextUrl
  
  // 排除登入頁面和 Firebase 認證路徑
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/__/auth') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') // 靜態文件
  ) {
    return NextResponse.next()
  }
  
  // 檢查是否已登入（有 cookie）
  const cookie = request.cookies.get(COOKIE_NAME)
  
  if (cookie?.value === 'granted') {
    return NextResponse.next()
  }
  
  // 檢查是否提交密碼
  const { searchParams } = new URL(request.url)
  const password = searchParams.get('password')
  
  if (password === ACCESS_PASSWORD) {
    // 設置 cookie（7天有效）
    const response = NextResponse.next()
    response.cookies.set(COOKIE_NAME, 'granted', {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    })
    return response
  }
  
  // 顯示密碼輸入頁面
  return new NextResponse(
    `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Polygon Guitar - 即將推出</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .container {
          text-align: center;
          padding: 2rem;
        }
        .logo {
          font-size: 2.5rem;
          font-weight: bold;
          margin-bottom: 1rem;
        }
        .logo span { color: #FFD700; }
        .logo span:last-child { color: #fff; }
        .subtitle {
          color: #B3B3B3;
          margin-bottom: 2rem;
          font-size: 1.1rem;
        }
        .password-form {
          background: #121212;
          padding: 2rem;
          border-radius: 16px;
          border: 1px solid #333;
          max-width: 360px;
          margin: 0 auto;
        }
        .lock-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        h2 {
          color: #fff;
          font-size: 1.25rem;
          margin-bottom: 0.5rem;
        }
        p {
          color: #888;
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
        }
        .input-group {
          display: flex;
          gap: 0.5rem;
        }
        input {
          flex: 1;
          padding: 0.75rem 1rem;
          background: #000;
          border: 1px solid #333;
          border-radius: 8px;
          color: #fff;
          font-size: 1rem;
          outline: none;
        }
        input:focus {
          border-color: #FFD700;
        }
        button {
          padding: 0.75rem 1.5rem;
          background: #FFD700;
          color: #000;
          border: none;
          border-radius: 8px;
          font-weight: bold;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        button:hover {
          opacity: 0.9;
        }
        .error {
          color: #ff4444;
          font-size: 0.875rem;
          margin-top: 0.75rem;
        }
        .coming-soon {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid #222;
        }
        .coming-soon p {
          color: #666;
          font-size: 0.8rem;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <span>Polygon</span> <span>結他譜</span>
        </div>
        <div class="subtitle">香港結他譜平台</div>
        
        <div class="password-form">
          <div class="lock-icon">🔒</div>
          <h2>朋友搶先體驗</h2>
          <p>輸入密碼即可進入網站</p>
          
          <form action="" method="GET">
            <div class="input-group">
              <input 
                type="password" 
                name="password" 
                placeholder="輸入密碼..."
                autofocus
              />
              <button type="submit">進入</button>
            </div>
            ${password && password !== ACCESS_PASSWORD ? '<div class="error">密碼錯誤，請重試</div>' : ''}
          </form>
        </div>
        
        <div class="coming-soon">
          <p>正式公開即將推出 • polygon.guitars</p>
        </div>
      </div>
    </body>
    </html>`,
    {
      status: 200,
      headers: {
        'content-type': 'text/html;charset=UTF-8',
      },
    }
  )
}

@echo off
chcp 65001 >nul
REM 自動添加 Google Search Console 驗證 TXT 記錄到 polygon.guitars

echo ==========================================
echo Google Search Console DNS 驗證腳本
echo ==========================================
echo.

REM 檢查是否已安裝 Vercel CLI
vercel --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未找到 Vercel CLI
    echo 正在安裝...
    call npm install -g vercel
    
    vercel --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ 安裝失敗，請手動安裝: npm install -g vercel
        pause
        exit /b 1
    )
    echo ✅ Vercel CLI 安裝完成
)

REM 檢查是否已登入
echo 檢查 Vercel 登入狀態...
vercel whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  未登入 Vercel，請先登入...
    call vercel login
)

REM Google Search Console 驗證碼
set VERIFICATION_CODE=google-site-verification=FWJGFbJ-cgJs2lzQmZeHHxiQFQ4ysjZr9EpCRrRjyew
set DOMAIN=polygon.guitars

echo.
echo 正在添加 TXT 記錄...
echo 網域: %DOMAIN%
echo 記錄類型: TXT
echo 值: %VERIFICATION_CODE%
echo.

REM 添加 DNS 記錄
call vercel dns add %DOMAIN% @ TXT "%VERIFICATION_CODE%"

if %errorlevel% equ 0 (
    echo.
    echo ✅ DNS 記錄添加成功！
    echo.
    echo ==========================================
    echo 下一步:
    echo ==========================================
    echo 1. 等 5-10 分鐘讓 DNS 生效
    echo 2. 返去 Google Search Console 點擊「驗證」
    echo.
    echo 驗證連結: https://search.google.com/search-console
    echo ==========================================
) else (
    echo.
    echo ❌ 添加失敗
    echo 請檢查:
    echo - 你是否擁有 polygon.guitars 的管理權限
    echo - 網絡連線是否正常
)

echo.
pause

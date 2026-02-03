import { useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'

export default function Login() {
  const router = useRouter()
  const { signInWithGoogle, signInWithFacebook, isAuthenticated } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  // Redirect if already logged in
  if (isAuthenticated) {
    router.push('/')
    return null
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await signInWithGoogle()
      router.push('/')
    } catch (error) {
      console.error('Google sign in error:', error)
      alert('Google 登入失敗，請重試')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFacebookSignIn = async () => {
    setIsLoading(true)
    try {
      await signInWithFacebook()
      router.push('/')
    } catch (error) {
      console.error('Facebook sign in error:', error)
      if (error.code === 'auth/account-exists-with-different-credential') {
        alert('此電郵已用其他方式登入，請使用相同方式')
      } else {
        alert('Facebook 登入失敗，請重試')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-[#121212] rounded-xl shadow-lg p-8 w-full max-w-md border border-gray-800">
          <div className="text-center mb-8">
            <span className="text-5xl mb-4 block">🎸</span>
            <h1 className="text-2xl font-bold text-white mb-2">
              歡迎來到 Polygon Guitar
            </h1>
            <p className="text-[#B3B3B3]">
              登入以分享和收藏結他譜
            </p>
          </div>

          <div className="space-y-4">
            {/* Google Sign In */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-3 bg-[#121212] border-2 border-gray-800 text-white py-3 px-4 rounded-lg font-medium hover:border-[#FFD700] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>使用 Google 登入</span>
            </button>

            {/* Facebook Sign In */}
            <button
              onClick={handleFacebookSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-3 bg-[#1877F2] text-white py-3 px-4 rounded-lg font-medium hover:bg-[#166fe5] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>使用 Facebook 登入</span>
            </button>
          </div>

          <p className="text-center text-sm text-[#B3B3B3] mt-6">
            登入即表示你同意我們的服務條款
          </p>
        </div>
      </div>
    </Layout>
  )
}

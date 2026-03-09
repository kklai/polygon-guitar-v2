import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { searchTabs } from '@/lib/tabs'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/router'

export default function CurrentlyPracticing() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [currentPracticing, setCurrentPracticing] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
      return
    }
    
    if (user) {
      loadCurrentPracticing()
    }
  }, [user, authLoading, router])

  const loadCurrentPracticing = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (userDoc.exists() && userDoc.data().currentlyPracticing) {
        const tabDoc = await getDoc(doc(db, 'songs', userDoc.data().currentlyPracticing))
        if (tabDoc.exists()) {
          setCurrentPracticing({ id: tabDoc.id, ...tabDoc.data() })
        }
      }
    } catch (error) {
      console.error('Error loading:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async (term) => {
    setSearchTerm(term)
    if (term.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const results = await searchTabs(term)
      setSearchResults(results.slice(0, 10))
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const setPracticing = async (tabId) => {
    try {
      const userRef = doc(db, 'users', user.uid)
      await updateDoc(userRef, {
        currentlyPracticing: tabId,
        updatedAt: new Date().toISOString()
      })
      
      // Reload
      await loadCurrentPracticing()
      setSearchTerm('')
      setSearchResults([])
    } catch (error) {
      console.error('Error setting:', error)
    }
  }

  const clearPracticing = async () => {
    try {
      const userRef = doc(db, 'users', user.uid)
      await updateDoc(userRef, {
        currentlyPracticing: null,
        updatedAt: new Date().toISOString()
      })
      setCurrentPracticing(null)
    } catch (error) {
      console.error('Error clearing:', error)
    }
  }

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full"></div>
        </div>
      </Layout>
    )
  }

  if (!user) return null

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">正在練習</h1>
            <p className="text-gray-400 text-sm">告訴大家你正在練習什麼歌</p>
          </div>
          <Link
            href={`/profile/${user.uid}`}
            className="inline-flex items-center text-[#FFD700] hover:opacity-80"
            aria-label="返回個人頁面"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>

        {/* Current Status */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-medium text-white mb-4">目前狀態</h2>
          
          {currentPracticing ? (
            <div className="flex items-center gap-4 p-4 bg-gray-900 rounded-lg">
              {currentPracticing.thumbnail && (
                <img 
                  src={currentPracticing.thumbnail} 
                  alt={currentPracticing.title}
                  className="w-20 h-14 rounded object-cover"
                />
              )}
              <div className="flex-1">
                <p className="text-white font-medium">{currentPracticing.title}</p>
                <p className="text-sm text-gray-400">{currentPracticing.artist}</p>
              </div>
              <button
                onClick={clearPracticing}
                className="px-3 py-1.5 text-red-400 border border-red-700 rounded hover:bg-red-900/20 transition text-sm"
              >
                清除
              </button>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <p>暫時沒有標記正在練習的歌曲</p>
              <p className="text-sm mt-2">在下方搜尋並選擇一首歌</p>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="bg-[#121212] rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-medium text-white mb-4">搜尋歌曲</h2>
          
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="搜尋歌名或歌手..."
              className="w-full px-4 py-3 bg-[#282828] border-0 rounded-full text-white placeholder-[#666] outline-none"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin w-5 h-5 border-2 border-[#FFD700] border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-gray-400 mb-2">搜尋結果：</p>
              {searchResults.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setPracticing(tab.id)}
                  className="w-full flex items-center gap-3 p-3 bg-gray-900 rounded-lg hover:bg-gray-800 transition text-left"
                >
                  {tab.thumbnail && (
                    <img 
                      src={tab.thumbnail} 
                      alt={tab.title}
                      className="w-12 h-9 rounded object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-white text-sm">{tab.title}</p>
                    <p className="text-xs text-gray-400">{tab.artist}</p>
                  </div>
                  <span className="text-[#FFD700] text-sm">選擇</span>
                </button>
              ))}
            </div>
          )}

          {searchTerm.length >= 2 && searchResults.length === 0 && !isSearching && (
            <p className="mt-4 text-center text-gray-500">
              找不到符合的歌曲
            </p>
          )}
        </div>
      </div>
    </Layout>
  )
}

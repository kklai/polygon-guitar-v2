import { createContext, useContext, useEffect, useState } from 'react'
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth'
import { auth, googleProvider, db } from '@/lib/firebase'
import { doc, setDoc, getDoc } from '@/lib/firestore-tracked'

const AuthContext = createContext()

const VIEW_AS_STORAGE_KEY = 'pg_admin_view_as' // 'admin' | 'user' | 'guest'

function getStoredViewAs() {
  if (typeof window === 'undefined') return 'admin'
  try {
    const v = localStorage.getItem(VIEW_AS_STORAGE_KEY)
    if (v === 'guest' || v === 'user' || v === 'admin') return v
  } catch (_) {}
  return 'admin'
}

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewAsMode, setViewAsModeState] = useState('admin')

  // Handle redirect result on mount
  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          await createOrUpdateUser(result.user)
        }
      })
      .catch((error) => {
        console.error('Redirect result error:', error)
      })
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Get additional user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists()) {
          setUser({ ...user, ...userDoc.data() })
        } else {
          setUser(user)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const createOrUpdateUser = async (firebaseUser) => {
    const userRef = doc(db, 'users', firebaseUser.uid)
    const userData = {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName,
      email: firebaseUser.email,
      photoURL: firebaseUser.photoURL,
      provider: firebaseUser.providerData[0]?.providerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    const userDoc = await getDoc(userRef)
    if (!userDoc.exists()) {
      await setDoc(userRef, userData)
    } else {
      await setDoc(userRef, { 
        ...userData, 
        createdAt: userDoc.data().createdAt 
      }, { merge: true })
    }
  }

  const signInWithGoogle = async () => {
    try {
      // Try popup first, fallback to redirect on mobile
      const result = await signInWithPopup(auth, googleProvider)
      await createOrUpdateUser(result.user)
      return result.user
    } catch (error) {
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
        await signInWithRedirect(auth, googleProvider)
      } else {
        throw error
      }
    }
  }

  const logout = async () => {
    await signOut(auth)
    setUser(null)
  }

  // 管理員檢查 - 從 Firestore user 資料讀取
  const realIsAdmin = user?.isAdmin === true || user?.email === 'kermit.tam@gmail.com' || !!user?.role

  // Admin 可切換「以誰身份瀏覽」：admin（正常）、user（一般登入用戶）、guest（未登入）
  const effectiveViewAs = realIsAdmin ? viewAsMode : 'admin'
  const effectiveUser = effectiveViewAs === 'guest' ? null : user
  const isAdmin = effectiveViewAs === 'admin'

  const setViewAsMode = (mode) => {
    if (mode !== 'admin' && mode !== 'user' && mode !== 'guest') return
    setViewAsModeState(mode)
    try { localStorage.setItem(VIEW_AS_STORAGE_KEY, mode) } catch (_) {}
  }

  // 登入後若為 admin，從 localStorage 還原 viewAs
  useEffect(() => {
    if (realIsAdmin && user) setViewAsModeState(getStoredViewAs())
  }, [realIsAdmin, !!user])

  // 獲取用戶角色（以 effective 身份計）
  const userRole = effectiveUser?.role || (effectiveUser?.email === 'kermit.tam@gmail.com' ? 'super_admin' : null)

  const value = {
    user: effectiveUser,
    loading,
    signInWithGoogle,
    logout,
    isAuthenticated: !!effectiveUser,
    isAdmin,
    userRole,
    // Admin 專用：實際身份與切換「以誰身份瀏覽」
    realUser: user,
    realIsAdmin: !!realIsAdmin,
    viewAsMode: effectiveViewAs,
    setViewAsMode
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

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

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

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
  const isAdmin = user?.isAdmin === true || user?.email === 'kermit.tam@gmail.com' || !!user?.role
  
  // 獲取用戶角色
  const userRole = user?.role || (user?.email === 'kermit.tam@gmail.com' ? 'super_admin' : null)

  const value = {
    user,
    loading,
    signInWithGoogle,
    logout,
    isAuthenticated: !!user,
    isAdmin,
    userRole
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

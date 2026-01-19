'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'
import { User } from './types'

interface AuthContextType {
  user: User | null
  loading: boolean
  companyId: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  companyId: null,
  signOut: async () => {}
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user && isMounted) {
          const userData = await fetchUserData(session.user.id)
          if (isMounted) {
            setUser(userData)
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event)
      
      if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setUser(null)
          setLoading(false)
        }
      }
      // לא מטפלים ב-SIGNED_IN כאן כי הלוגין עושה redirect
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const fetchUserData = async (authUserId: string): Promise<User | null> => {
    console.log('fetchUserData started for:', authUserId)
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .single()

      console.log('fetchUserData result:', { data, error })

      if (error) {
        console.error('Error fetching user data:', error)
        return null
      }
      
      return data as User
    } catch (err) {
      console.error('Fetch user error:', err)
      return null
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      companyId: user?.company_id || null,
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
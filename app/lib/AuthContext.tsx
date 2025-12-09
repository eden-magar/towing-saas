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
    // בדיקת משתמש קיים
    checkUser()

    // האזנה לשינויים באימות
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event)
      if (event === 'SIGNED_IN' && session?.user) {
        await fetchUserData(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkUser = async () => {
    try {
      console.log('Checking existing session...')
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Session:', session ? 'exists' : 'none')
      if (session?.user) {
        await fetchUserData(session.user.id)
      }
    } catch (error) {
      console.error('Error checking user:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserData = async (authUserId: string) => {
    console.log('Fetching user data for:', authUserId)
    console.log('Starting query at:', new Date().toISOString())
    
    try {
      // Add timeout to detect hanging queries
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout - possible RLS issue')), 10000)
      )
      
      const queryPromise = supabase
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .single()

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any

      console.log('Query completed at:', new Date().toISOString())
      console.log('User data result:', { data, error })

      if (error) {
        console.error('Error fetching user data:', error)
        setUser(null)
      } else {
        console.log('Setting user:', data)
        setUser(data as User)
      }
    } catch (err) {
      console.error('Fetch user error:', err)
      setUser(null)
    }
    
    setLoading(false)
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
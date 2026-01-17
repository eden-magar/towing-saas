'use client'

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
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
  const fetchingRef = useRef(false)

  useEffect(() => {
    checkUser()

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
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await fetchUserData(session.user.id)
      } else {
        setLoading(false)
      }
    } catch (error) {
      console.error('Error checking user:', error)
      setLoading(false)
    }
  }

  const fetchUserData = async (authUserId: string) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .single()

      if (error) {
        console.error('Error fetching user data:', error)
        setUser(null)
      } else {
        setUser(data as User)
      }
    } catch (err) {
      console.error('Fetch user error:', err)
      setUser(null)
    } finally {
      fetchingRef.current = false
      setLoading(false)
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
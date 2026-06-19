'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { syncSupabaseRealtimeAuth } from './realtime-auth'
import { User } from './types'

interface AuthContextType {
  user: User | null
  loading: boolean
  companyId: string | null
  realtimeAuthReady: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  companyId: null,
  realtimeAuthReady: false,
  signOut: async () => {}
})

const REALTIME_AUTH_EVENTS: AuthChangeEvent[] = [
  'INITIAL_SESSION',
  'SIGNED_IN',
  'TOKEN_REFRESHED',
]

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [realtimeAuthReady, setRealtimeAuthReady] = useState(false)

  useEffect(() => {
    let isMounted = true

    const handleAuthChange = async (event: AuthChangeEvent, session: Session | null) => {
      console.log('Auth state changed:', event)

      try {
        if (event === 'SIGNED_OUT') {
          await syncSupabaseRealtimeAuth(null)
          if (isMounted) {
            setRealtimeAuthReady(false)
            setUser(null)
            setLoading(false)
          }
          return
        }

        if (REALTIME_AUTH_EVENTS.includes(event)) {
          const authOk = await syncSupabaseRealtimeAuth(session)
          if (isMounted) {
            setRealtimeAuthReady(authOk && !!session?.access_token)
          }
        }

        if (event === 'TOKEN_REFRESHED') {
          return
        }

        if (session?.user && isMounted) {
          const userData = await fetchUserData(session.user.id)
          if (isMounted) {
            setUser(userData)
          }
        } else if (event === 'INITIAL_SESSION' && isMounted) {
          setUser(null)
        }
      } catch (error) {
        console.error('Error in auth state handler:', error)
      } finally {
        if (event === 'INITIAL_SESSION' && isMounted) {
          setLoading(false)
        }
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      void handleAuthChange(event, session)
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
    setRealtimeAuthReady(false)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      companyId: user?.company_id || null,
      realtimeAuthReady,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

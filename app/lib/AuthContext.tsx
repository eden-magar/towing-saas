'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { clearSyncedRealtimeAuthToken, isRealtimeAccessTokenSynced, syncSupabaseRealtimeAuth } from './realtime-auth'
import { User } from './types'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  companyId: string | null
  realtimeAuthReady: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  companyId: null,
  realtimeAuthReady: false,
  signOut: async () => {}
})

async function fetchUserProfile(authUserId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUserId)
    .single()

  if (error) {
    console.error('Error fetching user profile:', error)
    return null
  }

  return data as User
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authInitialized, setAuthInitialized] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [realtimeAuthReady, setRealtimeAuthReady] = useState(false)

  // 1) Supabase auth listener — synchronous only (no supabase.from / getSession here).
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setAuthInitialized(true)

      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setProfileLoaded(true)
        return
      }

      setSession(nextSession)
      if (!nextSession?.user?.id) {
        setUser(null)
        setProfileLoaded(true)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // 2) App profile row — separate from auth callback (avoids SIGNED_IN feedback loop).
  useEffect(() => {
    if (!authInitialized) return

    const authUserId = session?.user?.id ?? null
    if (!authUserId) {
      setUser(null)
      setProfileLoaded(true)
      return
    }

    let cancelled = false
    setProfileLoaded(false)

    void (async () => {
      const profile = await fetchUserProfile(authUserId)
      if (cancelled) return
      setUser(profile)
      setProfileLoaded(true)
    })()

    return () => {
      cancelled = true
    }
  }, [authInitialized, session?.user?.id])

  // 3) Realtime JWT — isolated; must not mutate session, user, or loading.
  useEffect(() => {
    const accessToken = session?.access_token ?? null

    if (!accessToken) {
      clearSyncedRealtimeAuthToken()
      setRealtimeAuthReady(false)
      return
    }

    if (isRealtimeAccessTokenSynced(accessToken)) {
      setRealtimeAuthReady(true)
      return
    }

    let active = true
    const tokenAtStart = accessToken

    void (async () => {
      const ok = await syncSupabaseRealtimeAuth(session)
      if (!active) return

      const { data: { session: current } } = await supabase.auth.getSession()
      if (current?.access_token !== tokenAtStart) return

      setRealtimeAuthReady(ok)
    })()

    return () => {
      active = false
    }
  }, [session?.access_token])

  const loading = !authInitialized || !profileLoaded

  const signOut = async () => {
    clearSyncedRealtimeAuthToken()
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setProfileLoaded(true)
    setRealtimeAuthReady(false)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      companyId: user?.company_id ?? null,
      realtimeAuthReady,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

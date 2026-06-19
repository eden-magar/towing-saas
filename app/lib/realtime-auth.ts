import type { Session } from '@supabase/supabase-js'

import { supabase } from './supabase'

/** Sync JWT to the Realtime websocket so RLS-protected postgres_changes are delivered. */
export async function syncSupabaseRealtimeAuth(session?: Session | null): Promise<boolean> {
  try {
    const accessToken =
      session?.access_token ??
      (await supabase.auth.getSession()).data.session?.access_token ??
      null

    if (accessToken) {
      await supabase.realtime.setAuth(accessToken)
      return true
    }

    await supabase.realtime.setAuth(null)
    return false
  } catch (error) {
    console.error('[realtime-auth] failed to sync auth:', error)
    return false
  }
}

export function logRealtimeSubscribeStatus(channelName: string) {
  return (status: string, err?: Error) => {
    if (err) {
      console.log('[realtime]', channelName, status, err.message)
      return
    }
    console.log('[realtime]', channelName, status)
  }
}

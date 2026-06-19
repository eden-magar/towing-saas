import type { RealtimeChannel, Session } from '@supabase/supabase-js'

import { supabase } from './supabase'

/** Avoid reconnecting the Realtime socket when the JWT has not changed. */
let lastSyncedAccessToken: string | null | undefined = undefined

/** Sync JWT to the Realtime websocket so RLS-protected postgres_changes are delivered. */
export async function syncSupabaseRealtimeAuth(
  session?: Session | null,
  options?: { force?: boolean }
): Promise<boolean> {
  try {
    const accessToken =
      session?.access_token ??
      (await supabase.auth.getSession()).data.session?.access_token ??
      null

    if (!options?.force && accessToken === lastSyncedAccessToken) {
      return !!accessToken
    }

    lastSyncedAccessToken = accessToken

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

/** Call immediately before .subscribe() — skips setAuth if token already synced. */
export async function ensureRealtimeAuthBeforeSubscribe(_channelName: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return false
  }
  return syncSupabaseRealtimeAuth(session)
}

export function clearSyncedRealtimeAuthToken() {
  lastSyncedAccessToken = undefined
}

/** True when Realtime already has this JWT (survives effect cleanup / Strict Mode races). */
export function isRealtimeAccessTokenSynced(accessToken: string | null | undefined): boolean {
  return !!accessToken && accessToken === lastSyncedAccessToken
}

export function subscribeRealtimeChannel(
  channel: RealtimeChannel,
  channelName: string
): RealtimeChannel {
  return channel.subscribe((status, err) => {
    if (err) {
      console.error('[realtime]', channelName, status, err.message)
      return
    }
    if (status === 'SUBSCRIBED') {
      console.log('[realtime]', channelName, status)
    }
  })
}

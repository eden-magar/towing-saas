import { supabase } from '../../supabase'

/** Fire-and-forget legacy calendar sync for a tow (same request as useTowSave create path). */
export async function syncTowToLegacyCalendar(towId: string): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return
    const res = await fetch('/api/integrations/legacy-calendar/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tow_id: towId }),
    })
    if (!res.ok) {
      console.warn('[legacy-calendar-sync] sync request failed', res.status)
    }
  } catch (err) {
    console.warn('[legacy-calendar-sync] sync request failed', err)
  }
}

/** Fire-and-forget legacy calendar sync for an event (same request as EventTowSection create path). */
export async function syncEventToLegacyCalendar(eventId: string): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return
    const res = await fetch('/api/integrations/legacy-calendar/sync-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ event_id: eventId }),
    })
    if (!res.ok) {
      console.warn('[legacy-calendar-sync-event] sync request failed', res.status)
    }
  } catch (err) {
    console.warn('[legacy-calendar-sync-event] sync request failed', err)
  }
}

import { supabase } from '../supabase'
import type { TowChangeLog } from '../types'

export type TowChangeEntry = {
  field_name: string
  old_value: string | null
  new_value: string | null
}

const TOW_STATUS_HEBREW: Record<string, string> = {
  quote: 'הצעת מחיר',
  pending: 'ממתין לשיבוץ',
  assigned: 'שובץ נהג',
  in_progress: 'בביצוע',
  completed: 'הושלם',
  cancelled: 'בוטל',
  cancelled_charged: 'בוטל בחיוב',
}

export function hebrewTowStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null
  return TOW_STATUS_HEBREW[status] ?? status
}

export function formatLogDateTime(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function resolveActingUserId(): Promise<string | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error) {
      console.warn('[resolveActingUserId]', error.message)
      return null
    }
    return user?.id ?? null
  } catch (err) {
    console.warn('[resolveActingUserId]', err)
    return null
  }
}

/** Insert primitive — throws on DB error. Prefer logTowAction for mutation-safe logging. */
export async function saveTowChangeLogs(
  towId: string,
  changedBy: string | null,
  changes: TowChangeEntry[]
) {
  if (changes.length === 0) return
  const { error } = await supabase.from('tow_change_log').insert(
    changes.map((c) => ({
      tow_id: towId,
      changed_by: changedBy,
      field_name: c.field_name,
      old_value: c.old_value,
      new_value: c.new_value,
    }))
  )
  if (error) throw error
}

/**
 * Resolve actor (unless passed) and write change-log rows.
 * Never throws — logging failures are warned only.
 */
export async function logTowAction(
  towId: string,
  entries: TowChangeEntry[],
  actingUserId?: string | null
): Promise<void> {
  if (entries.length === 0) return
  try {
    let changedBy = actingUserId
    if (changedBy === undefined) {
      changedBy = await resolveActingUserId()
    }
    if (changedBy == null) {
      console.warn('[logTowAction] no acting user for tow', towId)
    }
    await saveTowChangeLogs(towId, changedBy, entries)
  } catch (err) {
    console.warn('[logTowAction] failed for tow', towId, err)
  }
}

export async function getTowChangeLogs(towId: string): Promise<TowChangeLog[]> {
  const { data, error } = await supabase
    .from('tow_change_log')
    .select(`
      *,
      user:users!tow_change_log_changed_by_fkey (
        full_name
      )
    `)
    .eq('tow_id', towId)
    .order('changed_at', { ascending: false })
  if (error) throw error
  return (data || []) as TowChangeLog[]
}

export async function getDriverDisplayName(
  driverId: string | null | undefined
): Promise<string | null> {
  if (!driverId) return null
  const { data, error } = await supabase
    .from('drivers')
    .select('user:users(full_name)')
    .eq('id', driverId)
    .maybeSingle()
  if (error || !data) return driverId
  const raw = data.user as { full_name: string } | { full_name: string }[] | null
  const user = Array.isArray(raw) ? raw[0] : raw
  return user?.full_name?.trim() || driverId
}

export function stringifyLogValue(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(', ')
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

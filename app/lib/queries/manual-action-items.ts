import { supabase } from '../supabase'
import { resolveActingUserId } from './tow-change-log'

export type ManualActionSeverity = 'high' | 'medium' | 'low'

export type ManualActionItem = {
  id: string
  type: string
  severity: string
  status: string
  message: string
  tow_id: string | null
  related_entity: string | null
  created_at: string
}

export type LogManualActionItemInput = {
  type: string
  message: string
  severity?: ManualActionSeverity
  towId?: string | null
  relatedEntity?: string | null
  details?: Record<string, unknown> | null
  companyId?: string
}

/** Same session path as logTowAction (auth user -> public.users), then company_id. */
async function resolveCompanyIdFromSession(): Promise<string | null> {
  try {
    const userId = await resolveActingUserId()
    if (!userId) return null
    const { data, error } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error('[logManualActionItem] company lookup failed', error)
      return null
    }
    return data?.company_id ?? null
  } catch (err) {
    console.error('[logManualActionItem] company lookup failed', err)
    return null
  }
}

/**
 * Writer for the manual-attention queue (`manual_action_items`).
 * Deliberately never throws - safe to call from already-failing / swallowed paths.
 */
export async function logManualActionItem(
  input: LogManualActionItemInput
): Promise<void> {
  try {
    const companyId = input.companyId ?? (await resolveCompanyIdFromSession())
    if (!companyId) {
      console.error(
        '[logManualActionItem] no company_id; skipping insert',
        input.type
      )
      return
    }

    const { error } = await supabase.from('manual_action_items').insert({
      company_id: companyId,
      type: input.type,
      message: input.message,
      severity: input.severity ?? 'high',
      tow_id: input.towId ?? null,
      related_entity: input.relatedEntity ?? null,
      details: input.details ?? null,
    })

    if (error) {
      console.error('[logManualActionItem] insert failed', input.type, error)
    }
  } catch (err) {
    console.error('[logManualActionItem] failed', input.type, err)
  }
}

export async function getOpenManualActionItems(
  companyId: string
): Promise<ManualActionItem[]> {
  const { data, error } = await supabase
    .from('manual_action_items')
    .select('id, type, severity, status, message, tow_id, related_entity, created_at')
    .eq('company_id', companyId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching open manual action items:', error)
    return []
  }

  return (data || []) as ManualActionItem[]
}

/** Open manual-attention items for a single tow (dispatcher tow detail). */
export async function getOpenManualActionItemsForTow(
  towId: string
): Promise<ManualActionItem[]> {
  const { data, error } = await supabase
    .from('manual_action_items')
    .select('id, type, severity, status, message, tow_id, related_entity, created_at')
    .eq('tow_id', towId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching open manual action items for tow:', error)
    return []
  }

  return (data || []) as ManualActionItem[]
}

export async function resolveManualActionItem(
  id: string
): Promise<{ ok: boolean }> {
  try {
    const resolvedBy = await resolveActingUserId()
    const { error } = await supabase
      .from('manual_action_items')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy,
      })
      .eq('id', id)

    if (error) {
      console.error('[resolveManualActionItem] failed', id, error)
      return { ok: false }
    }
    return { ok: true }
  } catch (err) {
    console.error('[resolveManualActionItem] failed', id, err)
    return { ok: false }
  }
}

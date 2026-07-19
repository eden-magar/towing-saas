import { supabase } from '../supabase'
import { resolveActingUserId } from './tow-change-log'

export type ManualActionSeverity = 'high' | 'medium' | 'low'

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

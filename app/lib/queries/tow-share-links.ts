import { supabase } from '../supabase'
import { getCompanySettings } from './settings'

export type TowShareLink = {
  token: string
  tow_id: string
  company_id: string
  created_by: string | null
  created_at: string
  expires_at: string
  revoked_at: string | null
}

export type TowShareLinkListItem = TowShareLink & {
  is_valid: boolean
}

const SHARE_LINK_EXPIRY_MIN_DAYS = 1
const SHARE_LINK_EXPIRY_MAX_DAYS = 90
const SHARE_LINK_EXPIRY_DEFAULT_DAYS = 7

/** 24 random bytes → 48-char hex (~192 bits). No new deps. */
function generateShareToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function clampExpiryDays(value: number | null | undefined): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return SHARE_LINK_EXPIRY_DEFAULT_DAYS
  return Math.min(
    SHARE_LINK_EXPIRY_MAX_DAYS,
    Math.max(SHARE_LINK_EXPIRY_MIN_DAYS, n)
  )
}

function isLinkValid(link: Pick<TowShareLink, 'revoked_at' | 'expires_at'>): boolean {
  if (link.revoked_at) return false
  return new Date(link.expires_at).getTime() > Date.now()
}

/**
 * Create a new share link for a tow. Caller must be authenticated company staff
 * for the tow's company (RLS + explicit company check).
 */
export async function createTowShareLink(
  towId: string
): Promise<{ token: string; expires_at: string }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('יש להתחבר כדי ליצור קישור שיתוף')
  }

  const { data: tow, error: towError } = await supabase
    .from('tows')
    .select('id, company_id')
    .eq('id', towId)
    .maybeSingle()

  if (towError) {
    console.error('[tow-share-links] tow load failed', towError)
    throw towError
  }
  if (!tow?.company_id) {
    throw new Error('הגרירה לא נמצאה')
  }

  const { data: me, error: meError } = await supabase
    .from('users')
    .select('id, company_id, role, is_active')
    .eq('id', user.id)
    .single()

  if (meError || !me?.is_active) {
    throw new Error('אין הרשאה ליצור קישור שיתוף')
  }
  if (me.role !== 'super_admin' && me.company_id !== tow.company_id) {
    throw new Error('הגרירה לא נמצאה')
  }
  if (
    me.role !== 'super_admin' &&
    me.role !== 'company_admin' &&
    me.role !== 'dispatcher'
  ) {
    throw new Error('אין הרשאה ליצור קישור שיתוף')
  }

  const settings = await getCompanySettings(tow.company_id)
  const expiryDays = clampExpiryDays(settings?.share_link_default_expiry_days)
  const expiresAt = new Date(
    Date.now() + expiryDays * 24 * 60 * 60 * 1000
  ).toISOString()

  const token = generateShareToken()

  const { data: inserted, error: insertError } = await supabase
    .from('tow_share_links')
    .insert({
      token,
      tow_id: tow.id,
      company_id: tow.company_id,
      created_by: me.id,
      expires_at: expiresAt,
    })
    .select('token, expires_at')
    .single()

  if (insertError || !inserted) {
    console.error('[tow-share-links] insert failed', insertError)
    throw insertError ?? new Error('שגיאה ביצירת קישור שיתוף')
  }

  return {
    token: inserted.token as string,
    expires_at: inserted.expires_at as string,
  }
}

/** Soft-revoke a share link in the caller's company (sets revoked_at). */
export async function revokeTowShareLink(token: string): Promise<void> {
  const trimmed = token.trim()
  if (!trimmed) throw new Error('token required')

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('יש להתחבר כדי לבטל קישור שיתוף')
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('tow_share_links')
    .update({ revoked_at: now })
    .eq('token', trimmed)
    .is('revoked_at', null)
    .select('token')
    .maybeSingle()

  if (error) {
    console.error('[tow-share-links] revoke failed', error)
    throw error
  }
  if (!data) {
    throw new Error('הקישור לא נמצא או כבר בוטל')
  }
}

/** List share links for a tow (newest first) with is_valid derived client-side. */
export async function listTowShareLinks(
  towId: string
): Promise<TowShareLinkListItem[]> {
  const { data, error } = await supabase
    .from('tow_share_links')
    .select(
      'token, tow_id, company_id, created_by, created_at, expires_at, revoked_at'
    )
    .eq('tow_id', towId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[tow-share-links] list failed', error)
    throw error
  }

  return ((data ?? []) as TowShareLink[]).map((link) => ({
    ...link,
    is_valid: isLinkValid(link),
  }))
}

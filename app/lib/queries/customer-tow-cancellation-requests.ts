import { supabase } from '../supabase'
import { updateTowStatus } from './tows'
import { logManualActionItem } from './manual-action-items'
import { logTowAction } from './tow-change-log'

export type CustomerCancellationRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'

export type CustomerTowCancellationRequest = {
  id: string
  company_id: string
  customer_id: string
  tow_id: string
  requested_by_user_id: string
  reason_note: string | null
  status: CustomerCancellationRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  staff_note: string | null
  created_at: string
  updated_at: string
}

/** Substring from prevent_assign_while_cancel_pending() RAISE EXCEPTION. */
export const PENDING_CANCEL_ASSIGN_BLOCK_MARKER = 'יש בקשת ביטול ממתינה מהלקוח'

/**
 * Detect the assignment-block trigger specifically.
 * Matches the Hebrew marker (stable) and optionally Postgres check_violation (23514).
 * Does not treat every assign failure as a cancel block.
 */
export function isPendingCancelAssignBlockError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown }
  const parts = [e.message, e.details, e.hint]
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
  if (!parts.includes(PENDING_CANCEL_ASSIGN_BLOCK_MARKER)) return false
  if (typeof e.code === 'string' && e.code !== '' && e.code !== '23514') {
    // Still accept if the marker is present — PostgREST sometimes remaps codes.
  }
  return true
}

export async function isPortalOriginTow(
  towId: string,
  customerId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('customer_tow_requests')
    .select('id')
    .eq('converted_tow_id', towId)
    .eq('customer_id', customerId)
    .eq('status', 'converted')
    .maybeSingle()

  if (error) {
    console.error('Error checking portal-origin tow:', error)
    return false
  }
  return !!data
}

export async function createCustomerTowCancellationRequest(input: {
  companyId: string
  customerId: string
  towId: string
  requestedByUserId: string
  reasonNote?: string | null
}): Promise<CustomerTowCancellationRequest> {
  const note = input.reasonNote?.trim() || null
  const { data, error } = await supabase
    .from('customer_tow_cancellation_requests')
    .insert({
      company_id: input.companyId,
      customer_id: input.customerId,
      tow_id: input.towId,
      requested_by_user_id: input.requestedByUserId,
      reason_note: note,
      status: 'pending',
    })
    .select('*')
    .single()

  if (error) throw error
  return data as CustomerTowCancellationRequest
}

/** Customer withdraw: pending → cancelled. */
export async function withdrawCustomerTowCancellationRequest(
  requestId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('customer_tow_cancellation_requests')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')

  if (error) throw error
  return true
}

export async function getPendingCancellationRequestForTow(
  towId: string
): Promise<CustomerTowCancellationRequest | null> {
  const { data, error } = await supabase
    .from('customer_tow_cancellation_requests')
    .select('*')
    .eq('tow_id', towId)
    .eq('status', 'pending')
    .maybeSingle()

  if (error) {
    console.error('Error fetching pending cancellation request:', error)
    return null
  }
  return (data as CustomerTowCancellationRequest) || null
}

export async function getCancellationRequestsForTow(
  towId: string
): Promise<CustomerTowCancellationRequest[]> {
  const { data, error } = await supabase
    .from('customer_tow_cancellation_requests')
    .select('*')
    .eq('tow_id', towId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching cancellation requests for tow:', error)
    return []
  }
  return (data as CustomerTowCancellationRequest[]) || []
}

export async function getLatestCancellationRequestForTow(
  towId: string
): Promise<CustomerTowCancellationRequest | null> {
  const { data, error } = await supabase
    .from('customer_tow_cancellation_requests')
    .select('*')
    .eq('tow_id', towId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching latest cancellation request:', error)
    return null
  }
  return (data as CustomerTowCancellationRequest) || null
}

export async function countPendingCancellationRequests(
  companyId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('customer_tow_cancellation_requests')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'pending')

  if (error) {
    console.error('Error counting pending cancellation requests:', error)
    return 0
  }
  return count || 0
}

export type PendingCancellationRequestRow = CustomerTowCancellationRequest & {
  requesterName: string | null
  tow: CancellationRequestTow | null
}

export type CancellationRequestTow = {
  id: string
  order_number: string | null
  final_price: number | null
  price_mode?: string | null
  price_breakdown?: {
    base_price?: number
    distance_price?: number
  } | null
  customer: { id: string; name: string } | null
}

export async function getPendingCancellationRequests(
  companyId: string
): Promise<PendingCancellationRequestRow[]> {
  const { data, error } = await supabase
    .from('customer_tow_cancellation_requests')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching pending cancellation requests:', error)
    return []
  }
  if (!data || data.length === 0) return []

  const requesterIds = [...new Set(data.map((r) => r.requested_by_user_id).filter(Boolean))]
  const towIds = data.map((r) => r.tow_id).filter(Boolean)

  const [{ data: users }, { data: tows }] = await Promise.all([
    supabase.from('users').select('id, full_name').in('id', requesterIds.length ? requesterIds : ['none']),
    supabase
      .from('tows')
      .select('id, order_number, final_price, price_mode, price_breakdown, customer:customers(id, name)')
      .in('id', towIds.length ? towIds : ['none']),
  ])

  return data.map((request) => {
    const tow = tows?.find((t) => t.id === request.tow_id) || null
    const customerRaw = tow?.customer as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null
      | undefined
    const customer = Array.isArray(customerRaw) ? customerRaw[0] ?? null : customerRaw ?? null

    return {
      ...(request as CustomerTowCancellationRequest),
      requesterName: users?.find((u) => u.id === request.requested_by_user_id)?.full_name || null,
      tow: tow
        ? {
            id: tow.id,
            order_number: tow.order_number,
            final_price: tow.final_price != null ? Number(tow.final_price) : null,
            price_mode: (tow as { price_mode?: string | null }).price_mode ?? null,
            price_breakdown: (tow as { price_breakdown?: CancellationRequestTow['price_breakdown'] }).price_breakdown ?? null,
            customer,
          }
        : null,
    }
  })
}

export async function rejectCustomerTowCancellationRequest(
  requestId: string,
  reviewerId: string,
  staffNote?: string | null
): Promise<boolean> {
  const { error } = await supabase
    .from('customer_tow_cancellation_requests')
    .update({
      status: 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      staff_note: staffNote?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')

  if (error) {
    console.error('Error rejecting cancellation request:', error)
    return false
  }
  return true
}

/**
 * Approve: cancel the tow, then mark the request approved.
 * Staff pick cancelled vs cancelled_charged (+ optional fee) — same semantics as staff cancel modal.
 * Never writes cancellation_details from the customer note.
 */
export async function approveCustomerTowCancellationRequest(
  requestId: string,
  reviewerId: string,
  options?: {
    charge?: boolean
    cancellationFee?: number
    staffNote?: string | null
  }
): Promise<boolean> {
  const { data: request, error: fetchError } = await supabase
    .from('customer_tow_cancellation_requests')
    .select('*')
    .eq('id', requestId)
    .eq('status', 'pending')
    .single()

  if (fetchError || !request) {
    console.error('Error fetching cancellation request:', fetchError)
    return false
  }

  const charge = !!options?.charge && (options.cancellationFee ?? 0) > 0
  const cancelStatus = charge ? ('cancelled_charged' as const) : ('cancelled' as const)
  const customerNote = request.reason_note?.trim() || undefined

  try {
    await updateTowStatus(
      request.tow_id,
      cancelStatus,
      'ביטול על ידי הלקוח',
      undefined, // never set cancellation_details from customer text
      customerNote,
      charge ? options?.cancellationFee : undefined,
      reviewerId
    )
  } catch (err) {
    console.error('Error cancelling tow on cancellation approve:', err)
    return false
  }

  const { error: updateError } = await supabase
    .from('customer_tow_cancellation_requests')
    .update({
      status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      staff_note: options?.staffNote?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')

  if (updateError) {
    console.error('Tow cancelled but request approve update failed:', updateError)
    const { data: towMeta } = await supabase
      .from('tows')
      .select('order_number')
      .eq('id', request.tow_id)
      .maybeSingle()
    const orderLabel = towMeta?.order_number
      ? String(towMeta.order_number)
      : request.tow_id
    await logManualActionItem({
      type: 'cancellation_approve_request_update_failed',
      severity: 'high',
      message: `גרירה ${orderLabel} בוטלה אך עדכון בקשת הביטול נכשל — נדרש סימון ידני של הבקשה כמאושרת`,
      towId: request.tow_id,
      relatedEntity: orderLabel,
      details: {
        error: updateError.message,
        requestId,
        source: 'approveCustomerTowCancellationRequest',
      },
    })
    return false
  }

  await logTowAction(
    request.tow_id,
    [
      {
        field_name: 'אישור בקשת ביטול לקוח',
        old_value: null,
        new_value: charge ? 'בוטל בחיוב' : 'בוטל',
      },
    ],
    reviewerId
  )

  return true
}

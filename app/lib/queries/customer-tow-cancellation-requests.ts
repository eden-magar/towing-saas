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
  /** Path A target: converted, unassigned portal tow. XOR with customer_tow_request_id. */
  tow_id: string | null
  /** Path B target: pending portal order (no tow yet). XOR with tow_id. */
  customer_tow_request_id: string | null
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

/** Substring from prevent_convert_while_cancel_pending() RAISE EXCEPTION. */
export const PENDING_CANCEL_CONVERT_BLOCK_MARKER = 'לא ניתן להמיר לגרירה'

function errorTextBlob(err: unknown): string {
  if (!err || typeof err !== 'object') {
    return typeof err === 'string' ? err : ''
  }
  const e = err as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown }
  return [e.message, e.details, e.hint]
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
}

/**
 * Detect the assignment-block trigger specifically.
 * Matches the Hebrew marker (stable) and optionally Postgres check_violation (23514).
 * Does not treat every assign failure as a cancel block.
 */
export function isPendingCancelAssignBlockError(err: unknown): boolean {
  return errorTextBlob(err).includes(PENDING_CANCEL_ASSIGN_BLOCK_MARKER)
}

/**
 * Detect the convert-block trigger specifically (Path B withdrawal during convert).
 * Matches the Hebrew marker from prevent_convert_while_cancel_pending().
 */
export function isPendingCancelConvertBlockError(err: unknown): boolean {
  return errorTextBlob(err).includes(PENDING_CANCEL_CONVERT_BLOCK_MARKER)
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

/**
 * Portal withdrawal of a pending order (Path B — no tow yet).
 * INSERTs a cancellation request linked to the ORDER; staff must approve before
 * the order is dismissed. The order stays in the staff "בקשות נכנסות" queue,
 * marked as having a pending withdrawal, until a rep approves or rejects.
 */
export async function requestPendingCustomerTowRequestCancellation(input: {
  companyId: string
  customerId: string
  customerTowRequestId: string
  requestedByUserId: string
  reasonNote?: string | null
}): Promise<CustomerTowCancellationRequest> {
  const note = input.reasonNote?.trim() || null
  const { data, error } = await supabase
    .from('customer_tow_cancellation_requests')
    .insert({
      company_id: input.companyId,
      customer_id: input.customerId,
      tow_id: null,
      customer_tow_request_id: input.customerTowRequestId,
      requested_by_user_id: input.requestedByUserId,
      reason_note: note,
      status: 'pending',
    })
    .select('*')
    .single()

  if (error) throw error
  return data as CustomerTowCancellationRequest
}

/** Pending withdrawal for a specific portal order (Path B), if any. */
export async function getPendingCancellationRequestForRequest(
  customerTowRequestId: string
): Promise<CustomerTowCancellationRequest | null> {
  const { data, error } = await supabase
    .from('customer_tow_cancellation_requests')
    .select('*')
    .eq('customer_tow_request_id', customerTowRequestId)
    .eq('status', 'pending')
    .maybeSingle()

  if (error) {
    console.error('Error fetching pending request cancellation:', error)
    return null
  }
  return (data as CustomerTowCancellationRequest) || null
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

/** Latest cancellation row for a portal order (Path B), any status. */
export async function getLatestCancellationRequestForRequest(
  customerTowRequestId: string
): Promise<CustomerTowCancellationRequest | null> {
  const { data, error } = await supabase
    .from('customer_tow_cancellation_requests')
    .select('*')
    .eq('customer_tow_request_id', customerTowRequestId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching latest request cancellation:', error)
    return null
  }
  return (data as CustomerTowCancellationRequest) || null
}

/**
 * Pending Path-B cancellation request ids for a set of portal orders.
 * Used by the portal home list to show "ממתינה לאישור ביטול" without N+1.
 */
export async function getPendingCancellationRequestIdsForOrders(
  requestIds: string[]
): Promise<Set<string>> {
  if (requestIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('customer_tow_cancellation_requests')
    .select('customer_tow_request_id')
    .in('customer_tow_request_id', requestIds)
    .eq('status', 'pending')

  if (error) {
    console.error('Error fetching pending order cancellation ids:', error)
    return new Set()
  }
  return new Set(
    (data ?? [])
      .map((r) => r.customer_tow_request_id)
      .filter((v): v is string => !!v)
  )
}

/**
 * Pending Path-A cancellation tow ids for the current page of portal tows.
 */
export async function getPendingCancellationTowIds(
  towIds: string[]
): Promise<Set<string>> {
  if (towIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('customer_tow_cancellation_requests')
    .select('tow_id')
    .in('tow_id', towIds)
    .eq('status', 'pending')

  if (error) {
    console.error('Error fetching pending tow cancellation ids:', error)
    return new Set()
  }
  return new Set(
    (data ?? []).map((r) => r.tow_id).filter((v): v is string => !!v)
  )
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

export type CancellationRequestOrder = {
  id: string
  customer_order_number: string | null
  tow_type: string | null
  scheduled_at: string | null
  customer: { id: string; name: string } | null
}

export type PendingCancellationRequestRow = CustomerTowCancellationRequest & {
  requesterName: string | null
  /** Path A target (tow-linked); null for Path B. */
  tow: CancellationRequestTow | null
  /** Path B target (pending order); null for Path A. */
  order: CancellationRequestOrder | null
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
  const towIds = data.map((r) => r.tow_id).filter((v): v is string => !!v)
  const orderIds = data
    .map((r) => r.customer_tow_request_id)
    .filter((v): v is string => !!v)

  const [{ data: users }, { data: tows }, { data: orders }] = await Promise.all([
    supabase.from('users').select('id, full_name').in('id', requesterIds.length ? requesterIds : ['none']),
    supabase
      .from('tows')
      .select('id, order_number, final_price, price_mode, price_breakdown, customer:customers(id, name)')
      .in('id', towIds.length ? towIds : ['none']),
    supabase
      .from('customer_tow_requests')
      .select('id, customer_order_number, tow_type, scheduled_at, customer:customers(id, name)')
      .in('id', orderIds.length ? orderIds : ['none']),
  ])

  const pickCustomer = (raw: unknown): { id: string; name: string } | null => {
    if (Array.isArray(raw)) return (raw[0] as { id: string; name: string }) ?? null
    return (raw as { id: string; name: string } | null) ?? null
  }

  return data.map((request) => {
    const tow = request.tow_id ? tows?.find((t) => t.id === request.tow_id) || null : null
    const order = request.customer_tow_request_id
      ? orders?.find((o) => o.id === request.customer_tow_request_id) || null
      : null

    return {
      ...(request as CustomerTowCancellationRequest),
      requesterName: users?.find((u) => u.id === request.requested_by_user_id)?.full_name || null,
      tow: tow
        ? {
            id: tow.id,
            order_number: tow.order_number,
            final_price: tow.final_price != null ? Number(tow.final_price) : null,
            price_mode: (tow as { price_mode?: string | null }).price_mode ?? null,
            price_breakdown:
              (tow as { price_breakdown?: CancellationRequestTow['price_breakdown'] })
                .price_breakdown ?? null,
            customer: pickCustomer(tow.customer),
          }
        : null,
      order: order
        ? {
            id: order.id,
            customer_order_number: order.customer_order_number ?? null,
            tow_type: (order as { tow_type?: string | null }).tow_type ?? null,
            scheduled_at: (order as { scheduled_at?: string | null }).scheduled_at ?? null,
            customer: pickCustomer(order.customer),
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
 * Find the pending customer cancellation for a tow and reject it.
 * Shared reject step for the "reject-and-assign" escape (tow detail + calendar
 * surfaces). Callers re-run their own assign afterward — this only handles the
 * find-pending → reject part so the detection/reject logic is not duplicated.
 * Returns false when no pending request exists or the reject failed.
 */
export async function rejectPendingCancellationForTow(
  towId: string,
  reviewerId: string
): Promise<boolean> {
  const pending = await getPendingCancellationRequestForTow(towId)
  if (!pending) return false
  return rejectCustomerTowCancellationRequest(pending.id, reviewerId)
}

/**
 * Approve: cancel the tow, then mark the request approved.
 * Staff pick cancelled vs cancelled_charged (+ optional fee) — same as staff cancel modal.
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

  // Path B: pending order, no tow. Approve = dismiss the order (no charge).
  if (request.customer_tow_request_id && !request.tow_id) {
    const nowIso = new Date().toISOString()
    const { data: dismissed, error: dismissError } = await supabase
      .from('customer_tow_requests')
      .update({ status: 'dismissed', updated_at: nowIso })
      .eq('id', request.customer_tow_request_id)
      .eq('status', 'pending')
      .is('converted_tow_id', null)
      .select('id')
      .maybeSingle()

    if (dismissError || !dismissed) {
      console.error('Error dismissing order on cancellation approve:', dismissError)
      return false
    }

    const { error: rowError } = await supabase
      .from('customer_tow_cancellation_requests')
      .update({
        status: 'approved',
        reviewed_by: reviewerId,
        reviewed_at: nowIso,
        staff_note: options?.staffNote?.trim() || null,
        updated_at: nowIso,
      })
      .eq('id', requestId)
      .eq('status', 'pending')

    if (rowError) {
      console.error('Order dismissed but request approve update failed:', rowError)
      await logManualActionItem({
        type: 'cancellation_approve_request_update_failed',
        severity: 'high',
        message:
          'הזמנת פורטל בוטלה אך עדכון בקשת הביטול נכשל — נדרש סימון ידני של הבקשה כמאושרת',
        relatedEntity: request.customer_tow_request_id,
        details: {
          error: rowError.message,
          requestId,
          customerTowRequestId: request.customer_tow_request_id,
          source: 'approveCustomerTowCancellationRequest:pathB',
        },
      })
      return false
    }

    return true
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

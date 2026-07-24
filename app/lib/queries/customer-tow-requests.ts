import { supabase } from '../supabase'
import { canSubmitOrdersViaPortal } from '../utils/portal-settings'
import { canSubmitPortalOrders } from '../utils/portal-roles'
import { getPortalMembershipRole } from './customer-portal-contacts'
import {
  isPendingCancelConvertBlockError,
  type CustomerTowCancellationRequest,
} from './customer-tow-cancellation-requests'
import { logManualActionItem } from './manual-action-items'
import { updateTowStatus } from './tows'
import type {
  CreateCustomerTowRequestInput,
  CreateCustomerTowRequestPointInput,
  CreateCustomerTowRequestPointVehicleInput,
  CreateCustomerTowRequestVehicleInput,
  CreateFullCustomerTowRequestInput,
  CustomerPortalRequestListItem,
  CustomerTowRequest,
  CustomerTowRequestFull,
  CustomerTowRequestPoint,
  CustomerTowRequestPointVehicle,
  CustomerTowRequestVehicle,
  CustomerTowRequestWithDetails,
} from '../types'

/** Mark failed because customer withdrew (prevent_convert_while_cancel_pending). */
export const PORTAL_CONVERT_WITHDRAWAL_BLOCK_MESSAGE =
  'הלקוח משך את ההזמנה (בקשת ביטול ממתינה) — הגרירה לא נוצרה.'

/** Mark failed for any other reason; orphan tow was cancelled as compensation. */
export const PORTAL_CONVERT_LINK_FAILED_MESSAGE =
  'קישור הבקשה לגרירה נכשל — הגרירה שבוטלה. נסו שוב.'

function requireTrimmed(value: string, fieldLabel: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`${fieldLabel} הוא שדה חובה`)
  }
  return trimmed
}

async function assertCustomerCanSubmitOrders(customerId: string): Promise<void> {
  const { data, error } = await supabase
    .from('customers')
    .select('portal_settings')
    .eq('id', customerId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching customer portal settings:', error)
    throw error
  }

  if (!data || !canSubmitOrdersViaPortal((data.portal_settings as Record<string, boolean> | null) ?? {})) {
    throw new Error('ללקוח זה אין הרשאה להזמין גרירות דרך הפורטל')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('אין הרשאה להזמין גרירות דרך הפורטל')
  }
  const role = await getPortalMembershipRole(user.id, customerId)
  if (!canSubmitPortalOrders(role)) {
    throw new Error('אין הרשאה להזמין גרירות דרך הפורטל')
  }
}

async function assertCustomerInCompany(companyId: string, customerId: string): Promise<void> {
  const { data, error } = await supabase.rpc('assert_customer_in_company', {
    p_company_id: companyId,
    p_customer_id: customerId,
  })

  if (error) {
    console.error('Error verifying customer company link:', error)
    throw error
  }

  if (!data) {
    throw new Error('הלקוח לא משויך לחברה')
  }
}

export async function createCustomerTowRequest(
  input: CreateCustomerTowRequestInput
): Promise<CustomerTowRequest> {
  await assertCustomerInCompany(input.companyId, input.customerId)
  await assertCustomerCanSubmitOrders(input.customerId)

  const row = {
    company_id: input.companyId,
    customer_id: input.customerId,
    submitted_by_user_id: input.submittedByUserId,
    order_number: requireTrimmed(input.orderNumber, 'מספר הזמנה'),
    scheduled_at: input.scheduledAt,
    department: requireTrimmed(input.department, 'מחלקה'),
    orderer: requireTrimmed(input.orderer, 'מזמין'),
    plate_number: requireTrimmed(input.plateNumber, 'מספר רישוי'),
    defect_description: requireTrimmed(input.defectDescription, 'תיאור תקלה'),
    pickup_address: requireTrimmed(input.pickupAddress, 'כתובת איסוף'),
    pickup_lat: input.pickupLat ?? null,
    pickup_lng: input.pickupLng ?? null,
    dropoff_address: requireTrimmed(input.dropoffAddress, 'כתובת יעד'),
    dropoff_lat: input.dropoffLat ?? null,
    dropoff_lng: input.dropoffLng ?? null,
    pickup_contact_name: requireTrimmed(input.pickupContactName, 'שם איש קשר באיסוף'),
    pickup_contact_phone: requireTrimmed(input.pickupContactPhone, 'טלפון איש קשר באיסוף'),
    dropoff_contact_name: requireTrimmed(input.dropoffContactName, 'שם איש קשר ביעד'),
    dropoff_contact_phone: requireTrimmed(input.dropoffContactPhone, 'טלפון איש קשר ביעד'),
    notes: input.notes?.trim() || null,
    status: 'pending' as const,
  }

  const { data, error } = await supabase
    .from('customer_tow_requests')
    .insert(row)
    .select('*')
    .single()

  if (error) {
    console.error('Error creating customer tow request:', error)
    throw error
  }

  return data as CustomerTowRequest
}

export async function getCustomerTowRequests(
  customerId: string
): Promise<CustomerPortalRequestListItem[]> {
  const { data, error } = await supabase
    .from('customer_tow_requests')
    .select(
      `
      id,
      tow_type,
      customer_order_number,
      scheduled_at,
      status,
      created_at,
      vehicles:customer_tow_request_vehicles (
        plate_number,
        is_working,
        order_index
      ),
      points:customer_tow_request_points (
        point_order,
        point_type,
        address
      )
    `
    )
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching customer tow requests:', error)
    throw error
  }

  return ((data ?? []) as CustomerPortalRequestListItem[]).map((row) => ({
    ...row,
    vehicles: [...(row.vehicles ?? [])].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
    ),
    points: [...(row.points ?? [])].sort(
      (a, b) => (a.point_order ?? 0) - (b.point_order ?? 0)
    ),
  }))
}

export async function getPendingCustomerTowRequests(
  companyId: string
): Promise<CustomerTowRequestWithDetails[]> {
  const { data, error } = await supabase
    .from('customer_tow_requests')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching pending customer tow requests:', error)
    throw error
  }

  if (!data || data.length === 0) return []

  const customerIds = [...new Set(data.map((row) => row.customer_id))]
  const submitterIds = [...new Set(data.map((row) => row.submitted_by_user_id))]

  const [{ data: customers }, { data: submitters }] = await Promise.all([
    supabase.from('customers').select('id, name').in('id', customerIds),
    supabase.from('users').select('id, full_name, email').in('id', submitterIds),
  ])

  return data.map((row) => ({
    ...(row as CustomerTowRequest),
    customer: customers?.find((c) => c.id === row.customer_id) ?? null,
    submitted_by: submitters?.find((u) => u.id === row.submitted_by_user_id) ?? null,
  }))
}

export async function markCustomerTowRequestConverted(
  companyId: string,
  requestId: string,
  towId: string
): Promise<CustomerTowRequest> {
  const { data, error } = await supabase
    .from('customer_tow_requests')
    .update({
      status: 'converted',
      converted_tow_id: towId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .select('*')
    .single()

  if (error) {
    console.error('Error marking customer tow request as converted:', error)
    throw error
  }

  if (!data) {
    throw new Error('בקשת הגרירה לא נמצאה או כבר טופלה')
  }

  return data as CustomerTowRequest
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  return String(err ?? 'unknown')
}

/**
 * After createTow: link the portal order, or cancel the just-created tow so it
 * cannot be dispatched / billed as an orphan. Throws a hard Error for the UI
 * (never a dismissible warning). No-op concerns stay with the caller — only
 * invoke when fromRequestId is set.
 */
export async function linkConvertedTowOrCompensate(params: {
  companyId: string
  requestId: string
  towId: string
}): Promise<void> {
  const { companyId, requestId, towId } = params

  try {
    await markCustomerTowRequestConverted(companyId, requestId, towId)
    return
  } catch (convertErr) {
    console.error(
      '[linkConvertedTowOrCompensate] mark converted failed:',
      convertErr
    )

    // Rare: PostgREST error after the UPDATE committed.
    const { data: request } = await supabase
      .from('customer_tow_requests')
      .select('id, status, converted_tow_id')
      .eq('id', requestId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (request?.status === 'converted' && request.converted_tow_id === towId) {
      return
    }

    const isWithdrawal = isPendingCancelConvertBlockError(convertErr)
    const cancelReason = isWithdrawal
      ? 'הלקוח משך את הזמנת הפורטל לפני השלמת ההמרה'
      : 'קישור לבקשת פורטל נכשל לאחר יצירת הגרירה'

    try {
      await updateTowStatus(towId, 'cancelled', cancelReason)
    } catch (cancelErr) {
      console.error(
        '[linkConvertedTowOrCompensate] compensate cancel failed:',
        cancelErr
      )
      await logManualActionItem({
        type: 'portal_convert_link_failed',
        severity: 'high',
        companyId,
        towId,
        relatedEntity: requestId,
        message:
          'גרירה נוצרה אך לא קושרה לבקשת פורטל, וביטול הפיצוי נכשל — נדרש טיפול ידני',
        details: {
          requestId,
          convertError: errMessage(convertErr),
          cancelError: errMessage(cancelErr),
          isWithdrawal,
          source: 'linkConvertedTowOrCompensate',
        },
      })
      throw new Error(
        isWithdrawal
          ? PORTAL_CONVERT_WITHDRAWAL_BLOCK_MESSAGE
          : 'קישור הבקשה לגרירה נכשל והגרירה שנוצרה לא בוטלה אוטומטית — בדקו ברשימת הגרירות.'
      )
    }

    throw new Error(
      isWithdrawal
        ? PORTAL_CONVERT_WITHDRAWAL_BLOCK_MESSAGE
        : PORTAL_CONVERT_LINK_FAILED_MESSAGE
    )
  }
}

export async function dismissCustomerTowRequest(
  companyId: string,
  requestId: string
): Promise<CustomerTowRequest> {
  const { data, error } = await supabase
    .from('customer_tow_requests')
    .update({
      status: 'dismissed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .select('*')
    .single()

  if (error) {
    console.error('Error dismissing customer tow request:', error)
    throw error
  }

  if (!data) {
    throw new Error('בקשת הגרירה לא נמצאה או כבר טופלה')
  }

  return data as CustomerTowRequest
}

function optionalTrim(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function resolveVehicleIndex(
  vehicles: CreateCustomerTowRequestVehicleInput[],
  link: Pick<CreateCustomerTowRequestPointVehicleInput, 'vehicleIndex' | 'vehicleTempId'>
): number {
  if (link.vehicleIndex !== undefined) {
    if (link.vehicleIndex < 0 || link.vehicleIndex >= vehicles.length) {
      throw new Error(`קישור רכב: אינדקס ${link.vehicleIndex} לא קיים`)
    }
    return link.vehicleIndex
  }

  if (link.vehicleTempId) {
    const index = vehicles.findIndex((v) => v.tempId === link.vehicleTempId)
    if (index < 0) {
      throw new Error(`קישור רכב: מזהה זמני ${link.vehicleTempId} לא נמצא`)
    }
    return index
  }

  throw new Error('קישור רכב: חובה לציין vehicleIndex או vehicleTempId')
}

function resolvePointIndex(
  points: CreateCustomerTowRequestPointInput[],
  link: Pick<CreateCustomerTowRequestPointVehicleInput, 'pointIndex' | 'pointTempId'>
): number {
  if (link.pointIndex !== undefined) {
    if (link.pointIndex < 0 || link.pointIndex >= points.length) {
      throw new Error(`קישור נקודה: אינדקס ${link.pointIndex} לא קיים`)
    }
    return link.pointIndex
  }

  if (link.pointTempId) {
    const index = points.findIndex((p) => p.tempId === link.pointTempId)
    if (index < 0) {
      throw new Error(`קישור נקודה: מזהה זמני ${link.pointTempId} לא נמצא`)
    }
    return index
  }

  throw new Error('קישור נקודה: חובה לציין pointIndex או pointTempId')
}

export async function createFullCustomerTowRequest(
  input: CreateFullCustomerTowRequestInput
): Promise<string> {
  await assertCustomerInCompany(input.companyId, input.customerId)
  await assertCustomerCanSubmitOrders(input.customerId)

  if (input.vehicles.length === 0) {
    throw new Error('חובה לכלול לפחות רכב אחד')
  }

  if (input.points.length === 0) {
    throw new Error('חובה לכלול לפחות נקודה אחת')
  }

  const payload = {
    company_id: input.companyId,
    customer_id: input.customerId,
    submitted_by_user_id: input.submittedByUserId,
    tow_type: input.towType,
    customer_order_number: optionalTrim(input.customerOrderNumber ?? null),
    scheduled_at: input.scheduledAt,
    scheduled_end_at: input.scheduledEndAt ?? null,
    start_from_base: input.startFromBase ?? false,
    dropoff_to_storage: input.dropoffToStorage ?? false,
    department: optionalTrim(input.department ?? null),
    orderer: optionalTrim(input.orderer ?? null),
    orderer_phone: optionalTrim(input.ordererPhone ?? null),
    notes: optionalTrim(input.notes ?? null),
    vehicles: input.vehicles.map((v, i) => ({
      plate_number: requireTrimmed(v.plateNumber, 'מספר רישוי'),
      vehicle_type: v.vehicleType ?? null,
      manufacturer: optionalTrim(v.manufacturer ?? null),
      model: optionalTrim(v.model ?? null),
      year: v.year ?? null,
      color: optionalTrim(v.color ?? null),
      chassis: optionalTrim(v.chassis ?? null),
      total_weight:
        v.totalWeight != null && Number.isFinite(Number(v.totalWeight))
          ? Number(v.totalWeight)
          : null,
      vehicle_code: optionalTrim(v.vehicleCode ?? null),
      stored_vehicle_id: optionalTrim(v.storedVehicleId ?? null),
      is_working: v.isWorking ?? true,
      tow_reason: optionalTrim(v.towReason ?? null),
      notes: optionalTrim(v.notes ?? null),
      order_index: v.orderIndex ?? i,
    })),
    points: input.points.map((p) => ({
      point_order: p.pointOrder,
      point_type: p.pointType,
      address: optionalTrim(p.address ?? null),
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      contact_name: optionalTrim(p.contactName ?? null),
      contact_phone: optionalTrim(p.contactPhone ?? null),
      recipient_name: optionalTrim(p.recipientName ?? null),
      recipient_phone: optionalTrim(p.recipientPhone ?? null),
      notes: optionalTrim(p.notes ?? null),
      order_notes: optionalTrim(p.orderNotes ?? null),
      is_storage: p.isStorage ?? false,
      stop_subtype: optionalTrim(p.stopSubtype ?? null),
    })),
    point_vehicles: input.pointVehicles.map((link) => ({
      point_index: resolvePointIndex(input.points, link),
      vehicle_index: resolveVehicleIndex(input.vehicles, link),
      action: link.action,
    })),
  }

  const { data, error } = await supabase.rpc('create_full_customer_tow_request', { payload })

  if (error) {
    console.error('Error creating full customer tow request:', error)
    throw error
  }

  if (!data) {
    throw new Error('יצירת בקשת גרירה נכשלה')
  }

  return data as string
}

export async function getFullCustomerTowRequest(
  requestId: string
): Promise<CustomerTowRequestFull | null> {
  const { data: request, error: requestError } = await supabase
    .from('customer_tow_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()

  if (requestError) {
    console.error('Error fetching customer tow request:', requestError)
    throw requestError
  }

  if (!request) return null

  const [
    { data: vehicles, error: vehiclesError },
    { data: points, error: pointsError },
    { data: pointVehicles, error: pointVehiclesError },
  ] = await Promise.all([
    supabase
      .from('customer_tow_request_vehicles')
      .select('*')
      .eq('request_id', requestId)
      .order('order_index', { ascending: true }),
    supabase
      .from('customer_tow_request_points')
      .select('*')
      .eq('request_id', requestId)
      .order('point_order', { ascending: true }),
    supabase
      .from('customer_tow_request_point_vehicles')
      .select('*')
      .eq('request_id', requestId),
  ])

  if (vehiclesError) {
    console.error('Error fetching customer tow request vehicles:', vehiclesError)
    throw vehiclesError
  }

  if (pointsError) {
    console.error('Error fetching customer tow request points:', pointsError)
    throw pointsError
  }

  if (pointVehiclesError) {
    console.error('Error fetching customer tow request point vehicles:', pointVehiclesError)
    throw pointVehiclesError
  }

  return {
    request: request as CustomerTowRequest,
    vehicles: (vehicles ?? []) as CustomerTowRequestVehicle[],
    points: (points ?? []) as CustomerTowRequestPoint[],
    pointVehicles: (pointVehicles ?? []) as CustomerTowRequestPointVehicle[],
  }
}

/** Cancellation row with display names for the staff customer-card modal. */
export type StaffPortalOrderCancellation = CustomerTowCancellationRequest & {
  requesterName: string | null
  reviewerName: string | null
}

/** One portal order for the staff customer card — all statuses. */
export type StaffCustomerPortalOrder = {
  request: CustomerTowRequest
  vehicles: CustomerTowRequestVehicle[]
  points: CustomerTowRequestPoint[]
  cancellations: StaffPortalOrderCancellation[]
  /** When converted: tow order_number for the link label. */
  convertedTowOrderNumber: string | null
}

/**
 * Staff: every portal order for a customer in this company, with vehicles,
 * points, and the full cancellation history (requester + reviewer names).
 * Relies on existing company-staff SELECT RLS — no new policies.
 */
export async function getStaffCustomerPortalOrders(
  companyId: string,
  customerId: string
): Promise<StaffCustomerPortalOrder[]> {
  const { data: requests, error } = await supabase
    .from('customer_tow_requests')
    .select('*')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching staff customer portal orders:', error)
    throw error
  }
  if (!requests || requests.length === 0) return []

  const requestIds = requests.map((r) => r.id)
  const convertedTowIds = requests
    .map((r) => r.converted_tow_id)
    .filter((v): v is string => !!v)

  const [
    { data: vehicles },
    { data: points },
    { data: cancellations },
    { data: tows },
  ] = await Promise.all([
    supabase
      .from('customer_tow_request_vehicles')
      .select('*')
      .in('request_id', requestIds)
      .order('order_index', { ascending: true }),
    supabase
      .from('customer_tow_request_points')
      .select('*')
      .in('request_id', requestIds)
      .order('point_order', { ascending: true }),
    supabase
      .from('customer_tow_cancellation_requests')
      .select('*')
      .in('customer_tow_request_id', requestIds)
      .order('created_at', { ascending: false }),
    convertedTowIds.length
      ? supabase
          .from('tows')
          .select('id, order_number')
          .in('id', convertedTowIds)
      : Promise.resolve({ data: [] as { id: string; order_number: string | null }[] }),
  ])

  const userIds = new Set<string>()
  for (const c of cancellations ?? []) {
    if (c.requested_by_user_id) userIds.add(c.requested_by_user_id)
    if (c.reviewed_by) userIds.add(c.reviewed_by)
  }

  const { data: users } =
    userIds.size > 0
      ? await supabase
          .from('users')
          .select('id, full_name')
          .in('id', [...userIds])
      : { data: [] as { id: string; full_name: string | null }[] }

  const nameById = new Map(
    (users ?? []).map((u) => [u.id, u.full_name ?? null] as const)
  )
  const towNumberById = new Map(
    (tows ?? []).map((t) => [t.id, t.order_number ?? null] as const)
  )

  return requests.map((row) => {
    const id = row.id as string
    const cancels = (cancellations ?? []).filter(
      (c) => c.customer_tow_request_id === id
    ) as CustomerTowCancellationRequest[]

    return {
      request: row as CustomerTowRequest,
      vehicles: ((vehicles ?? []) as CustomerTowRequestVehicle[]).filter(
        (v) => v.request_id === id
      ),
      points: ((points ?? []) as CustomerTowRequestPoint[]).filter(
        (p) => p.request_id === id
      ),
      cancellations: cancels.map((c) => ({
        ...c,
        requesterName: nameById.get(c.requested_by_user_id) ?? null,
        reviewerName: c.reviewed_by
          ? nameById.get(c.reviewed_by) ?? null
          : null,
      })),
      convertedTowOrderNumber: row.converted_tow_id
        ? towNumberById.get(row.converted_tow_id) ?? null
        : null,
    }
  })
}

import { supabase } from '../supabase'
import { canSubmitOrdersViaPortal } from '../utils/portal-settings'
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

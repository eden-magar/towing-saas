import { supabase } from '../supabase'
import type { EventPriceResult } from '../utils/event-pricing'
import { syncEventToLegacyCalendar } from '../integrations/legacy-calendar/client-sync'

const EVENT_WITH_RELATIONS_SELECT = `
  *,
  customer:customers (
    id,
    name,
    phone,
    email,
    address
  ),
  driver:drivers (
    id,
    user:users (
      full_name,
      phone
    )
  )
`

export interface EventCustomer {
  id: string
  name: string
  phone: string | null
  email?: string | null
  address?: string | null
}

export interface EventDriverUser {
  full_name: string
  phone: string | null
}

export interface EventDriver {
  id: string
  user: EventDriverUser | null
}

export interface EventWithDetails {
  id: string
  customer_id: string
  company_id: string
  driver_id: string | null
  location_address: string | null
  location_lat: number | null
  location_lng: number | null
  contact_name: string | null
  contact_phone: string | null
  details: string | null
  status: string
  driver_status: string | null
  driver_received_at: string | null
  driver_departed_at: string | null
  driver_arrived_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  cancellation_details: string | null
  cancellation_customer_note: string | null
  completed_at: string | null
  completed_by: string | null
  list_price: number | null
  manual_price: number | null
  final_price: number | null
  price_breakdown: EventPriceResult | null
  order_number: string | null
  event_group_id?: string | null
  instance_label?: string | null
  event_date: string | null
  start_time: string | null
  end_time: string | null
  created_by: string
  created_at: string
  updated_at: string
  customer: EventCustomer | null
  driver: EventDriver | null
}

const DRIVER_ACTIVE_EVENT_SELECT = `
  id,
  driver_id,
  status,
  location_address,
  event_date,
  start_time,
  end_time,
  order_number,
  customer:customers (
    id,
    name,
    phone
  )
`

export interface DriverActiveEvent {
  id: string
  driver_id: string | null
  status: string
  location_address: string | null
  event_date: string | null
  start_time: string | null
  end_time: string | null
  order_number: string | null
  customer: EventCustomer | null
}

const CALENDAR_WEEK_EVENT_SELECT = `
  id,
  driver_id,
  status,
  event_date,
  start_time,
  end_time,
  location_address,
  customer:customers (
    id,
    name
  )
`

export interface CalendarWeekEvent {
  id: string
  driver_id: string | null
  status: string
  event_date: string
  start_time: string | null
  end_time: string | null
  location_address: string | null
  customer: Pick<EventCustomer, 'id' | 'name'> | null
}

const EVENT_LIST_SELECT = `
  id,
  status,
  driver_id,
  event_date,
  created_at,
  order_number,
  final_price,
  location_address,
  customer:customers (
    id,
    name,
    phone,
    email,
    address
  ),
  driver:drivers (
    id,
    user:users (
      full_name
    )
  )
`

export interface EventListDriver {
  id: string
  user: { full_name: string } | null
}

export interface EventListItem {
  id: string
  status: string
  driver_id: string | null
  event_date: string | null
  created_at: string
  order_number: string | null
  final_price: number | null
  location_address: string | null
  customer: EventCustomer | null
  driver: EventListDriver | null
}

export interface GetEventsOptions {
  /** ISO date string. If null, no date filter. Default: 90 days ago. */
  since?: string | null
  /** Max rows. If null, no limit. Default: 100. */
  limit?: number | null
}

export async function getEvents(
  companyId: string,
  options: GetEventsOptions = {}
): Promise<EventListItem[]> {
  const defaultSince = new Date()
  defaultSince.setDate(defaultSince.getDate() - 90)
  const sinceIso =
    options.since === null
      ? null
      : (options.since ?? defaultSince.toISOString())
  const limitValue =
    options.limit === null ? null : (options.limit ?? 100)

  let query = supabase
    .from('events')
    .select(EVENT_LIST_SELECT)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (sinceIso) {
    query = query.gte('created_at', sinceIso)
  }
  if (limitValue !== null) {
    query = query.limit(limitValue)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching events:', JSON.stringify(error, null, 2))
    throw error
  }

  return (data ?? []) as unknown as EventListItem[]
}

/**
 * Events in 'quote' status (price proposals not yet confirmed).
 * Used by the dashboard quotes panel alongside getQuoteTows.
 * Ordered oldest first so stale quotes are visible at the top.
 */
export async function getQuoteEvents(companyId: string): Promise<EventListItem[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_LIST_SELECT)
    .eq('company_id', companyId)
    .eq('status', 'quote')
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error('Error fetching quote events:', JSON.stringify(error, null, 2))
    return []
  }

  return (data ?? []) as unknown as EventListItem[]
}

/**
 * Approved events with no driver assigned yet.
 * Used by the dashboard "ממתינות לשיבוץ" panel alongside getPendingUnassignedTows.
 * Ordered oldest first so stale items are visible at the top.
 */
export async function getPendingUnassignedEvents(companyId: string): Promise<EventListItem[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_LIST_SELECT)
    .eq('company_id', companyId)
    .eq('status', 'approved')
    .is('driver_id', null)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error('Error fetching pending unassigned events:', JSON.stringify(error, null, 2))
    return []
  }

  return (data ?? []) as unknown as EventListItem[]
}

function formatLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Events in the same 7-day window as getWeekTows (Sunday through Saturday). */
export async function getWeekEvents(
  companyId: string,
  weekStart: Date
): Promise<CalendarWeekEvent[]> {
  const startOfWeek = new Date(weekStart)
  startOfWeek.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(endOfWeek.getDate() + 6)

  const startDateStr = formatLocalDateString(startOfWeek)
  const endDateStr = formatLocalDateString(endOfWeek)

  const { data, error } = await supabase
    .from('events')
    .select(CALENDAR_WEEK_EVENT_SELECT)
    .eq('company_id', companyId)
    .neq('status', 'cancelled')
    .gte('event_date', startDateStr)
    .lte('event_date', endDateStr)
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) {
    console.error('Error fetching calendar week events:', JSON.stringify(error, null, 2))
    throw error
  }

  return (data ?? []) as unknown as CalendarWeekEvent[]
}

/** Events on a single calendar day (event_date = YYYY-MM-DD). */
export async function getDayEvents(
  companyId: string,
  date: Date
): Promise<CalendarWeekEvent[]> {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  const dateStr = formatLocalDateString(day)

  const { data, error } = await supabase
    .from('events')
    .select(CALENDAR_WEEK_EVENT_SELECT)
    .eq('company_id', companyId)
    .neq('status', 'cancelled')
    .eq('event_date', dateStr)
    .order('start_time', { ascending: true })

  if (error) {
    console.error('Error fetching calendar day events:', JSON.stringify(error, null, 2))
    throw error
  }

  return (data ?? []) as unknown as CalendarWeekEvent[]
}

export async function getDriverActiveEvents(
  driverId: string
): Promise<DriverActiveEvent[]> {
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('events')
    .select(DRIVER_ACTIVE_EVENT_SELECT)
    .eq('driver_id', driverId)
    .neq('status', 'cancelled')
    .neq('status', 'completed')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) {
    console.error('Error fetching driver active events:', JSON.stringify(error, null, 2))
    throw error
  }

  return (data ?? []) as unknown as DriverActiveEvent[]
}

export async function getEvent(eventId: string): Promise<EventWithDetails | null> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_WITH_RELATIONS_SELECT)
    .eq('id', eventId)
    .single()

  if (error) {
    console.error('Error fetching event:', JSON.stringify(error, null, 2))
    throw error
  }

  if (!data) return null

  return data as EventWithDetails
}

/** Assigned-driver fetch — explicit driver_id filter in addition to RLS. */
export async function getDriverEvent(
  eventId: string,
  driverId: string
): Promise<EventWithDetails | null> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_WITH_RELATIONS_SELECT)
    .eq('id', eventId)
    .eq('driver_id', driverId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching driver event:', JSON.stringify(error, null, 2))
    throw error
  }

  if (!data) return null

  return data as EventWithDetails
}

export interface CreateEventInput {
  companyId: string
  createdBy: string
  customerId: string
  driverId?: string | null
  locationAddress: string
  locationLat?: number | null
  locationLng?: number | null
  contactName?: string | null
  contactPhone?: string | null
  details?: string | null
  eventDate: string
  startTime: string
  endTime: string
  manualPrice?: number | null
  finalPrice?: number | null
  priceBreakdown?: EventPriceResult | null
  status?: string
  eventGroupId?: string | null
  instanceLabel?: string | null
}

export async function createEvent(input: CreateEventInput): Promise<{ id: string }> {
  const eventId = crypto.randomUUID()

  const { error } = await supabase.from('events').insert({
    id: eventId,
    company_id: input.companyId,
    created_by: input.createdBy,
    customer_id: input.customerId,
    driver_id: input.driverId ?? null,
    location_address: input.locationAddress,
    location_lat: input.locationLat ?? null,
    location_lng: input.locationLng ?? null,
    contact_name: input.contactName ?? null,
    contact_phone: input.contactPhone ?? null,
    details: input.details ?? null,
    event_date: input.eventDate,
    start_time: input.startTime,
    end_time: input.endTime,
    list_price: null,
    manual_price: input.manualPrice ?? null,
    final_price: input.finalPrice ?? null,
    price_breakdown: input.priceBreakdown ?? null,
    status: input.status ?? 'draft',
    event_group_id: input.eventGroupId ?? null,
    instance_label: input.instanceLabel ?? null,
  })

  if (error) {
    console.error('Error creating event:', JSON.stringify(error, null, 2))
    throw error
  }

  return { id: eventId }
}

export interface UpdateEventInput {
  customerId?: string
  locationAddress?: string
  locationLat?: number | null
  locationLng?: number | null
  contactName?: string | null
  contactPhone?: string | null
  details?: string | null
  eventDate?: string
  startTime?: string
  endTime?: string
}

export async function updateEvent(
  eventId: string,
  input: UpdateEventInput
): Promise<EventWithDetails> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.customerId !== undefined) {
    payload.customer_id = input.customerId
  }
  if (input.locationAddress !== undefined) {
    payload.location_address = input.locationAddress
  }
  if (input.locationLat !== undefined) {
    payload.location_lat = input.locationLat
  }
  if (input.locationLng !== undefined) {
    payload.location_lng = input.locationLng
  }
  if (input.contactName !== undefined) {
    payload.contact_name = input.contactName
  }
  if (input.contactPhone !== undefined) {
    payload.contact_phone = input.contactPhone
  }
  if (input.details !== undefined) {
    payload.details = input.details
  }
  if (input.eventDate !== undefined) {
    payload.event_date = input.eventDate
  }
  if (input.startTime !== undefined) {
    payload.start_time = input.startTime
  }
  if (input.endTime !== undefined) {
    payload.end_time = input.endTime
  }

  const { data, error } = await supabase
    .from('events')
    .update(payload)
    .eq('id', eventId)
    .select(EVENT_WITH_RELATIONS_SELECT)
    .single()

  if (error) {
    console.error('Error updating event:', JSON.stringify(error, null, 2))
    throw error
  }

  if (!data) {
    throw new Error('Event not found')
  }

  const updated = data as EventWithDetails

  if (updated.status === 'approved') {
    await syncEventToLegacyCalendar(eventId)
  }

  return updated
}

export interface EventGroupMember {
  id: string
  instance_label: string | null
  event_date: string | null
  order_number: string | null
}

export async function getEventsByGroupId(groupId: string): Promise<EventGroupMember[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, instance_label, event_date, order_number')
    .eq('event_group_id', groupId)
    .order('instance_label', { ascending: true })

  if (error) {
    console.error('Error fetching events by group:', JSON.stringify(error, null, 2))
    throw error
  }

  return (data ?? []) as EventGroupMember[]
}

export interface SpawnEventInstanceRow {
  eventDate: string
  startTime: string
  endTime: string
}

function maxInstanceLabelCode(labels: (string | null | undefined)[]): number {
  let max = 64
  for (const label of labels) {
    if (!label || label.length !== 1) continue
    const code = label.charCodeAt(0)
    if (code >= 65 && code <= 90 && code > max) max = code
  }
  return max
}

export async function spawnEventInstances(
  sourceEvent: EventWithDetails,
  rows: SpawnEventInstanceRow[],
  currentUserId: string
): Promise<{ id: string; instanceLabel: string }[]> {
  if (rows.length === 0) return []

  let groupId = sourceEvent.event_group_id ?? null

  if (!groupId) {
    groupId = crypto.randomUUID()
    const { error: backfillError } = await supabase
      .from('events')
      .update({ event_group_id: groupId, instance_label: 'A' })
      .eq('id', sourceEvent.id)

    if (backfillError) {
      console.error('Error backfilling event group on source:', JSON.stringify(backfillError, null, 2))
      throw backfillError
    }
  }

  const siblings = await getEventsByGroupId(groupId)
  let nextLabelCode = Math.max(maxInstanceLabelCode(siblings.map((s) => s.instance_label)), 65) + 1

  const created: { id: string; instanceLabel: string }[] = []

  for (const row of rows) {
    const instanceLabel = String.fromCharCode(nextLabelCode)
    nextLabelCode += 1

    const result = await createEvent({
      companyId: sourceEvent.company_id,
      createdBy: currentUserId,
      customerId: sourceEvent.customer_id,
      driverId: sourceEvent.driver_id ?? null,
      locationAddress: sourceEvent.location_address ?? '',
      locationLat: sourceEvent.location_lat,
      locationLng: sourceEvent.location_lng,
      contactName: sourceEvent.contact_name,
      contactPhone: sourceEvent.contact_phone,
      details: sourceEvent.details,
      eventDate: row.eventDate,
      startTime: row.startTime,
      endTime: row.endTime,
      manualPrice: sourceEvent.manual_price,
      finalPrice: sourceEvent.final_price,
      priceBreakdown: sourceEvent.price_breakdown,
      status: sourceEvent.status,
      eventGroupId: groupId,
      instanceLabel,
    })

    if (sourceEvent.status === 'approved') {
      void syncEventToLegacyCalendar(result.id)
    }

    created.push({ id: result.id, instanceLabel })
  }

  return created
}

export interface UpdateEventPriceFields {
  manualPrice: number | null
  finalPrice: number | null
  priceBreakdown: EventPriceResult | null
}

export type EventDriverTimestampField =
  | 'driver_received_at'
  | 'driver_departed_at'
  | 'driver_arrived_at'

const EVENT_DRIVER_TIMESTAMP_FIELDS: EventDriverTimestampField[] = [
  'driver_received_at',
  'driver_departed_at',
  'driver_arrived_at',
]

export type EventDriverProgressStatus = 'received' | 'departed' | 'arrived'

export async function updateEventDriverStatus(
  eventId: string,
  driverStatus: EventDriverProgressStatus,
  timestampField: EventDriverTimestampField
): Promise<void> {
  if (!EVENT_DRIVER_TIMESTAMP_FIELDS.includes(timestampField)) {
    throw new Error(`Invalid event driver timestamp field: ${timestampField}`)
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('events')
    .update({
      driver_status: driverStatus,
      [timestampField]: now,
    })
    .eq('id', eventId)

  if (error) {
    console.error('Error updating event driver status:', JSON.stringify(error, null, 2))
    throw error
  }
}

/** Assign or change the driver on an existing event. Does not change status or sync external calendars. */
export async function assignEventDriver(
  eventId: string,
  driverId: string
): Promise<{ id: string; driver_id: string }> {
  const { data, error } = await supabase
    .from('events')
    .update({ driver_id: driverId })
    .eq('id', eventId)
    .select('id, driver_id')
    .single()

  if (error) {
    console.error('Error assigning event driver:', JSON.stringify(error, null, 2))
    throw error
  }

  return data as { id: string; driver_id: string }
}

export async function completeEvent(
  eventId: string,
  completedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: completedBy,
    })
    .eq('id', eventId)

  if (error) {
    console.error('Error completing event:', JSON.stringify(error, null, 2))
    throw error
  }
}

export async function cancelEvent(
  eventId: string,
  reason: string,
  details: string | null,
  cancellationCustomerNote?: string | null
): Promise<void> {
  const updates: Record<string, unknown> = {
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
    cancellation_reason: reason,
    cancellation_details: details,
  }
  if (cancellationCustomerNote !== undefined) {
    updates.cancellation_customer_note = cancellationCustomerNote
  }

  const { error } = await supabase.from('events').update(updates).eq('id', eventId)

  if (error) {
    console.error('Error cancelling event:', JSON.stringify(error, null, 2))
    throw error
  }
}

export type ApproveEventQuoteResult =
  | { approved: true }
  | { approved: false; reason: 'not_quote' | 'not_found' }

/**
 * Promote a saved quote event to approved and sync to legacy Google Calendar.
 * No-op when status is not 'quote'.
 */
export async function approveEventQuote(eventId: string): Promise<ApproveEventQuoteResult> {
  const { data: existing, error: fetchError } = await supabase
    .from('events')
    .select('status')
    .eq('id', eventId)
    .maybeSingle()

  if (fetchError) {
    console.error('Error fetching event for quote approval:', JSON.stringify(fetchError, null, 2))
    throw fetchError
  }

  if (!existing) {
    return { approved: false, reason: 'not_found' }
  }

  if (existing.status !== 'quote') {
    return { approved: false, reason: 'not_quote' }
  }

  const { data: updated, error: updateError } = await supabase
    .from('events')
    .update({ status: 'approved' })
    .eq('id', eventId)
    .eq('status', 'quote')
    .select('id')
    .maybeSingle()

  if (updateError) {
    console.error('Error approving event quote:', JSON.stringify(updateError, null, 2))
    throw updateError
  }

  if (!updated) {
    return { approved: false, reason: 'not_quote' }
  }

  await syncEventToLegacyCalendar(eventId)

  return { approved: true }
}

export async function updateEventPrice(
  eventId: string,
  fields: UpdateEventPriceFields
): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({
      manual_price: fields.manualPrice,
      final_price: fields.finalPrice,
      price_breakdown: fields.priceBreakdown,
    })
    .eq('id', eventId)

  if (error) {
    console.error('Error updating event price:', JSON.stringify(error, null, 2))
    throw error
  }
}

export interface SaveEventChangeLogInput {
  eventId: string
  companyId: string
  changedBy: string
  fieldName: string
  oldValue: string | null
  newValue: string | null
}

export async function saveEventChangeLog(input: SaveEventChangeLogInput): Promise<void> {
  const { error } = await supabase.from('event_change_log').insert({
    event_id: input.eventId,
    company_id: input.companyId,
    changed_by: input.changedBy,
    field_name: input.fieldName,
    old_value: input.oldValue,
    new_value: input.newValue,
  })

  if (error) {
    console.error('Error saving event change log:', JSON.stringify(error, null, 2))
    throw error
  }
}

export interface EventChangeLogEntry {
  id: string
  event_id: string
  company_id: string
  changed_by: string
  field_name: string
  old_value: string | null
  new_value: string | null
  changed_at: string
  user: { full_name: string } | null
}

export type EventVehicleDetails = Record<string, unknown> | null

export interface EventVehicle {
  id: string
  event_id: string
  company_id: string
  plate_number: string
  vehicle_details: EventVehicleDetails
  notes: string | null
  pickup_location_address: string | null
  pickup_location_lat: number | null
  pickup_location_lng: number | null
  dropoff_location_address: string | null
  dropoff_location_lat: number | null
  dropoff_location_lng: number | null
  order_index: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface AddEventVehicleInput {
  eventId: string
  companyId: string
  plateNumber: string
  vehicleDetails: EventVehicleDetails
  notes: string | null
  createdBy: string
}

export async function getEventVehicles(eventId: string): Promise<EventVehicle[]> {
  const { data, error } = await supabase
    .from('event_vehicles')
    .select('*')
    .eq('event_id', eventId)
    .order('order_index', { ascending: true })

  if (error) {
    console.error('Error fetching event vehicles:', JSON.stringify(error, null, 2))
    throw error
  }

  return (data ?? []) as EventVehicle[]
}

export async function addEventVehicle(input: AddEventVehicleInput): Promise<EventVehicle> {
  const { count, error: countError } = await supabase
    .from('event_vehicles')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', input.eventId)

  if (countError) {
    console.error('Error counting event vehicles:', JSON.stringify(countError, null, 2))
    throw countError
  }

  const vehicleId = crypto.randomUUID()
  const { data, error } = await supabase
    .from('event_vehicles')
    .insert({
      id: vehicleId,
      event_id: input.eventId,
      company_id: input.companyId,
      plate_number: input.plateNumber,
      vehicle_details: input.vehicleDetails,
      notes: input.notes,
      order_index: count ?? 0,
      created_by: input.createdBy,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding event vehicle:', JSON.stringify(error, null, 2))
    throw error
  }

  return data as EventVehicle
}

export interface EventVehiclePhoto {
  id: string
  event_id: string
  event_vehicle_id: string
  image_path: string
  phase: 'before' | 'after'
  created_at: string
}

export async function getEventVehiclePhotos(eventId: string): Promise<EventVehiclePhoto[]> {
  const { data, error } = await supabase
    .from('event_vehicle_photos')
    .select('id, event_id, event_vehicle_id, image_path, phase, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching event vehicle photos:', JSON.stringify(error, null, 2))
    return []
  }

  return (data ?? []) as EventVehiclePhoto[]
}

export async function getEventChangeLog(eventId: string): Promise<EventChangeLogEntry[]> {
  const { data: rows, error } = await supabase
    .from('event_change_log')
    .select('id, event_id, company_id, field_name, old_value, new_value, changed_by, changed_at')
    .eq('event_id', eventId)
    .order('changed_at', { ascending: false })

  if (error) {
    console.error('Error fetching event change log:', JSON.stringify(error, null, 2))
    throw error
  }

  const logs = rows ?? []
  const changedByIds = [...new Set(logs.map((row) => row.changed_by).filter(Boolean))]

  let nameByUserId = new Map<string, string>()
  if (changedByIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', changedByIds)

    if (usersError) {
      console.error('Error fetching event change log users:', JSON.stringify(usersError, null, 2))
      throw usersError
    }

    nameByUserId = new Map(
      (users ?? []).map((u) => [u.id, u.full_name as string])
    )
  }

  return logs.map((row) => {
    const fullName = nameByUserId.get(row.changed_by) ?? null
    return {
      id: row.id,
      event_id: row.event_id,
      company_id: row.company_id,
      changed_by: row.changed_by,
      field_name: row.field_name,
      old_value: row.old_value,
      new_value: row.new_value,
      changed_at: row.changed_at,
      user: fullName != null ? { full_name: fullName } : null,
    }
  })
}

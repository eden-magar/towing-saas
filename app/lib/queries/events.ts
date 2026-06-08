import { supabase } from '../supabase'
import type { EventPriceResult } from '../utils/event-pricing'

const EVENT_WITH_RELATIONS_SELECT = `
  *,
  customer:customers (
    id,
    name,
    phone
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
  cancelled_at: string | null
  cancellation_reason: string | null
  cancellation_details: string | null
  completed_at: string | null
  completed_by: string | null
  list_price: number | null
  manual_price: number | null
  final_price: number | null
  price_breakdown: EventPriceResult | null
  order_number: string | null
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
  event_date,
  created_at,
  order_number,
  final_price,
  location_address,
  customer:customers (
    id,
    name,
    phone
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
  })

  if (error) {
    console.error('Error creating event:', JSON.stringify(error, null, 2))
    throw error
  }

  return { id: eventId }
}

export interface UpdateEventPriceFields {
  manualPrice: number | null
  finalPrice: number | null
  priceBreakdown: EventPriceResult | null
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
  details: string | null
): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
      cancellation_details: details,
    })
    .eq('id', eventId)

  if (error) {
    console.error('Error cancelling event:', JSON.stringify(error, null, 2))
    throw error
  }
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

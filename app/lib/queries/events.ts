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

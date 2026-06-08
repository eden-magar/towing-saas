import { supabase } from '../supabase'

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
  contactName?: string | null
  contactPhone?: string | null
  details?: string | null
  eventDate: string
  startTime: string
  endTime: string
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
    location_lat: null,
    location_lng: null,
    contact_name: input.contactName ?? null,
    contact_phone: input.contactPhone ?? null,
    details: input.details ?? null,
    event_date: input.eventDate,
    start_time: input.startTime,
    end_time: input.endTime,
  })

  if (error) {
    console.error('Error creating event:', JSON.stringify(error, null, 2))
    throw error
  }

  return { id: eventId }
}

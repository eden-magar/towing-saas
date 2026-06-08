export type LegacySpecialEventLocationPinDrop = {
  address: string
  physicalAddress: string
  isGoogleAddress: true
  isPinDropped: true
  lat: number
  lng: number
}

export type LegacySpecialEventLocationStandard = {
  address: string
  physicalAddress: string
  isGoogleAddress: false
  originalText: string
  hasChanged: boolean
}

export type LegacySpecialEventLocation =
  | LegacySpecialEventLocationPinDrop
  | LegacySpecialEventLocationStandard
  | ''

/** Payload shape consumed by Apps Script when `type` is `special_event`. */
export type LegacySpecialEventPayload = {
  type: 'special_event'
  clientName: string
  clientPhone: string
  executionDate: string
  executionTime: string
  endTime: string
  location: LegacySpecialEventLocation
  contactName: string
  contactPhone: string
  driverName: string
  details: string
  totalPrice: number | string
  orderNumber: string
}

export type EventForLegacyMapping = {
  location_address: string | null
  location_lat: number | null
  location_lng: number | null
  contact_name: string | null
  contact_phone: string | null
  event_date: string | null
  start_time: string | null
  end_time: string | null
  details: string | null
  final_price: number | null
  order_number: string | null
  customer: { name: string; phone: string | null } | null
  driver: { user: { full_name: string } | null } | null
}

function formatEventTime(time: string | null | undefined): string {
  if (!time) return ''
  const match = time.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return time
  const hours = match[1].padStart(2, '0')
  return `${hours}:${match[2]}`
}

function buildEventLocation(event: EventForLegacyMapping): LegacySpecialEventLocation {
  const address = event.location_address?.trim() ?? ''
  if (!address) return ''

  if (event.location_lat != null && event.location_lng != null) {
    return {
      address,
      physicalAddress: address,
      isGoogleAddress: true,
      isPinDropped: true,
      lat: event.location_lat,
      lng: event.location_lng,
    }
  }

  return {
    address,
    physicalAddress: address,
    isGoogleAddress: false,
    originalText: '',
    hasChanged: false,
  }
}

export function mapEventToSpecialEventPayload(
  event: EventForLegacyMapping
): LegacySpecialEventPayload {
  return {
    type: 'special_event',
    clientName: event.customer?.name ?? '',
    clientPhone: event.customer?.phone ?? '',
    executionDate: event.event_date ?? '',
    executionTime: formatEventTime(event.start_time),
    endTime: formatEventTime(event.end_time),
    location: buildEventLocation(event),
    contactName: event.contact_name ?? '',
    contactPhone: event.contact_phone ?? '',
    driverName: event.driver?.user?.full_name ?? '',
    details: event.details ?? '',
    totalPrice: event.final_price ?? '',
    orderNumber: event.order_number ?? '',
  }
}

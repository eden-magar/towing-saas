/** Customer slice used for driver-facing contact resolution */
export type DriverContactCustomer = {
  name: string
  phone: string | null
  customer_type?: 'private' | 'business' | 'insurance' | 'fleet' | null
} | null

export type DriverContactPoint = {
  contact_name: string | null
  contact_phone: string | null
} | null | undefined

/**
 * Point contact first; private customer phone only when no point phone.
 */
export function resolveDriverContact(
  point: DriverContactPoint,
  customer: DriverContactCustomer
): {
  displayName: string
  phone: string | null
  canCall: boolean
} {
  const pointPhone = point?.contact_phone?.trim()
  if (pointPhone) {
    return {
      displayName: point?.contact_name?.trim() || 'איש קשר',
      phone: pointPhone,
      canCall: true,
    }
  }

  if (customer?.customer_type === 'private' && customer.phone?.trim()) {
    return {
      displayName:
        customer.name?.trim() || point?.contact_name?.trim() || 'איש קשר',
      phone: customer.phone.trim(),
      canCall: true,
    }
  }

  if (point?.contact_name?.trim()) {
    return {
      displayName: point.contact_name.trim(),
      phone: null,
      canCall: false,
    }
  }

  return {
    displayName: 'אין איש קשר זמין',
    phone: null,
    canCall: false,
  }
}

import { supabase } from '../supabase'
import type { CustomerAddress, CustomerPortalAddress, CustomerPortalAddressInput } from '../types'
import {
  canEditPortalContacts,
  getPortalMembershipRole,
  type PortalCustomerUserRole,
} from './customer-portal-contacts'

export { getPortalMembershipRole, canEditPortalContacts, type PortalCustomerUserRole }

export const PORTAL_ADDRESS_COORDS_REQUIRED_MESSAGE =
  'אין קואורדינטות לכתובת. בחרו מההצעות, הניחו סיכה על המפה, או הדביקו קישור מ-Google Maps / Waze.'

/** ~50m — absorbs Places / pin / link spread without merging neighbouring places. */
export const PORTAL_ADDRESS_MATCH_TOLERANCE_METERS = 50

/** Same normalization as the DB unique index: lower(btrim(label)). */
export function normalizePortalAddressLabel(label: string): string {
  return label.trim().toLowerCase()
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === '23505'
}

function duplicateLabelMessage(existingLabel: string): string {
  return `כתובת עם התווית "${existingLabel}" כבר שמורה`
}

function assertCoordsForWrite(lat: number | null | undefined, lng: number | null | undefined): {
  lat: number
  lng: number
} {
  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    (lat === 0 && lng === 0)
  ) {
    throw new Error(PORTAL_ADDRESS_COORDS_REQUIRED_MESSAGE)
  }
  return { lat, lng }
}

/** Map portal rows to the staff CustomerAddress shape AddressInput expects. */
export function portalAddressesAsCustomerAddresses(
  rows: CustomerPortalAddress[]
): CustomerAddress[] {
  return rows.map((row) => ({
    ...row,
    notes: null,
  }))
}

export function findNearbyPortalAddress(
  lat: number | null | undefined,
  lng: number | null | undefined,
  addresses: CustomerPortalAddress[],
  toleranceMeters: number = PORTAL_ADDRESS_MATCH_TOLERANCE_METERS
): CustomerPortalAddress | undefined {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return undefined
  }

  let best: CustomerPortalAddress | undefined
  let bestDist = Infinity

  for (const row of addresses) {
    const d = haversineMeters(lat, lng, row.lat, row.lng)
    if (d <= toleranceMeters && d < bestDist) {
      best = row
      bestDist = d
    }
  }

  return best
}

export function shouldOfferSavePortalAddress(
  lat: number | null | undefined,
  lng: number | null | undefined,
  addressText: string,
  addresses: CustomerPortalAddress[],
  canEdit: boolean
): boolean {
  return Boolean(
    canEdit &&
      addressText.trim() &&
      lat != null &&
      lng != null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      !(lat === 0 && lng === 0) &&
      !findNearbyPortalAddress(lat, lng, addresses)
  )
}

async function findByNormalizedLabel(
  companyId: string,
  customerId: string,
  label: string,
  excludeId?: string
): Promise<CustomerPortalAddress | null> {
  const key = normalizePortalAddressLabel(label)
  if (!key) return null

  const { data, error } = await supabase
    .from('customer_portal_addresses')
    .select('*')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)

  if (error) {
    console.error('Error looking up portal address by label:', error)
    throw error
  }

  const rows = (data ?? []) as CustomerPortalAddress[]
  return (
    rows.find(
      (row) =>
        normalizePortalAddressLabel(row.label) === key &&
        (!excludeId || row.id !== excludeId)
    ) ?? null
  )
}

export async function listCustomerPortalAddresses(
  customerId: string
): Promise<CustomerPortalAddress[]> {
  const { data, error } = await supabase
    .from('customer_portal_addresses')
    .select('*')
    .eq('customer_id', customerId)
    .order('label', { ascending: true })

  if (error) {
    console.error('Error listing portal addresses:', error)
    throw error
  }

  return (data ?? []) as CustomerPortalAddress[]
}

export async function createCustomerPortalAddress(
  companyId: string,
  customerId: string,
  userId: string,
  input: CustomerPortalAddressInput
): Promise<CustomerPortalAddress> {
  const label = input.label.trim()
  if (!label) {
    throw new Error('תווית כתובת היא שדה חובה')
  }

  const address = input.address.trim()
  if (!address) {
    throw new Error('כתובת היא שדה חובה')
  }

  const { lat, lng } = assertCoordsForWrite(input.lat, input.lng)
  const place_id = input.place_id?.trim() || null

  const existingByLabel = await findByNormalizedLabel(companyId, customerId, label)
  if (existingByLabel) {
    throw new Error(duplicateLabelMessage(existingByLabel.label))
  }

  const { data, error } = await supabase
    .from('customer_portal_addresses')
    .insert({
      company_id: companyId,
      customer_id: customerId,
      label,
      address,
      lat,
      lng,
      place_id,
      created_by_user_id: userId,
    })
    .select('*')
    .single()

  if (error) {
    if (isUniqueViolation(error)) {
      const raced = await findByNormalizedLabel(companyId, customerId, label)
      throw new Error(duplicateLabelMessage(raced?.label ?? label))
    }
    console.error('Error creating portal address:', error)
    throw error
  }

  return data as CustomerPortalAddress
}

export async function updateCustomerPortalAddress(
  companyId: string,
  customerId: string,
  addressId: string,
  input: Partial<CustomerPortalAddressInput>
): Promise<CustomerPortalAddress> {
  const updates: Record<string, string | number | null> = {
    updated_at: new Date().toISOString(),
  }

  if (input.label !== undefined) {
    const label = input.label.trim()
    if (!label) {
      throw new Error('תווית כתובת היא שדה חובה')
    }
    updates.label = label
  }

  if (input.address !== undefined) {
    const address = input.address.trim()
    if (!address) {
      throw new Error('כתובת היא שדה חובה')
    }
    updates.address = address
  }

  if (input.lat !== undefined || input.lng !== undefined) {
    const { data: existing, error: fetchError } = await supabase
      .from('customer_portal_addresses')
      .select('lat, lng')
      .eq('id', addressId)
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .maybeSingle()

    if (fetchError) {
      console.error('Error fetching portal address for coord update:', fetchError)
      throw fetchError
    }
    if (!existing) {
      throw new Error('הכתובת לא נמצאה')
    }

    const nextLat = input.lat !== undefined ? input.lat : existing.lat
    const nextLng = input.lng !== undefined ? input.lng : existing.lng
    const coords = assertCoordsForWrite(nextLat, nextLng)
    updates.lat = coords.lat
    updates.lng = coords.lng
  }

  if (input.place_id !== undefined) {
    updates.place_id = input.place_id?.trim() || null
  }

  if (input.label !== undefined) {
    const conflict = await findByNormalizedLabel(
      companyId,
      customerId,
      input.label,
      addressId
    )
    if (conflict) {
      throw new Error(duplicateLabelMessage(conflict.label))
    }
  }

  const { data, error } = await supabase
    .from('customer_portal_addresses')
    .update(updates)
    .eq('id', addressId)
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .select('*')
    .single()

  if (error) {
    if (isUniqueViolation(error) && input.label !== undefined) {
      const raced = await findByNormalizedLabel(
        companyId,
        customerId,
        input.label,
        addressId
      )
      throw new Error(duplicateLabelMessage(raced?.label ?? input.label.trim()))
    }
    console.error('Error updating portal address:', error)
    throw error
  }

  return data as CustomerPortalAddress
}

export async function deleteCustomerPortalAddress(
  companyId: string,
  customerId: string,
  addressId: string
): Promise<void> {
  const { error } = await supabase
    .from('customer_portal_addresses')
    .delete()
    .eq('id', addressId)
    .eq('company_id', companyId)
    .eq('customer_id', customerId)

  if (error) {
    console.error('Error deleting portal address:', error)
    throw error
  }
}

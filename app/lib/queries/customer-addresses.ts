import { supabase } from '../supabase'
import type { CustomerAddress, CustomerAddressInput } from '../types'

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function assertCustomerInCompany(companyId: string, customerId: string): Promise<void> {
  const { data, error } = await supabase
    .from('customer_company')
    .select('id')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('Error verifying customer company link:', error)
    throw error
  }

  if (!data) {
    throw new Error('הלקוח לא משויך לחברה')
  }
}

async function assertUniqueLabel(
  companyId: string,
  customerId: string,
  label: string,
  excludeAddressId?: string
): Promise<void> {
  let query = supabase
    .from('customer_addresses')
    .select('id')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .eq('label', label)

  if (excludeAddressId) {
    query = query.neq('id', excludeAddressId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    console.error('Error checking duplicate address label:', error)
    throw error
  }

  if (data) {
    throw new Error('כתובת עם תווית זו כבר קיימת ללקוח זה')
  }
}

export async function getCustomerAddresses(
  companyId: string,
  customerId: string
): Promise<CustomerAddress[]> {
  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .order('label', { ascending: true })

  if (error) {
    console.error('Error fetching customer addresses:', error)
    throw error
  }

  return (data ?? []) as CustomerAddress[]
}

export function findMatchingCustomerAddress(
  address: string,
  addresses: CustomerAddress[]
): CustomerAddress | undefined {
  const trimmed = address.trim()
  if (!trimmed) return undefined

  return addresses.find((row) => row.address.trim() === trimmed)
}

export interface PendingCustomerAddress {
  label: string
  address: string
  place_id?: string | null
  lat?: number | null
  lng?: number | null
  notes?: string | null
}

/** Build a pending row only when both label and address are non-empty. */
export function pendingAddressFromFields(
  label: string,
  address: string,
  meta?: {
    placeId?: string | null
    lat?: number | null
    lng?: number | null
    notes?: string | null
  }
): PendingCustomerAddress | null {
  const trimmedLabel = label.trim()
  const trimmedAddress = address.trim()
  if (!trimmedLabel || !trimmedAddress) return null
  return {
    label: trimmedLabel,
    address: trimmedAddress,
    place_id: meta?.placeId ?? null,
    lat: meta?.lat ?? null,
    lng: meta?.lng ?? null,
    notes: meta?.notes ?? null,
  }
}

export async function insertPendingCustomerAddresses(
  companyId: string,
  customerId: string,
  pending: PendingCustomerAddress[]
): Promise<void> {
  const seenKeys = new Set<string>()

  for (const item of pending) {
    const label = item.label.trim()
    const address = item.address.trim()
    if (!label || !address) continue

    const key = label.toLowerCase()
    if (seenKeys.has(key)) continue
    seenKeys.add(key)

    try {
      await insertCustomerAddress(companyId, customerId, {
        label,
        address,
        place_id: item.place_id,
        lat: item.lat,
        lng: item.lng,
        notes: item.notes,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (!message.includes('תווית')) {
        console.error('Error saving customer address:', err)
      }
    }
  }
}

export async function insertCustomerAddress(
  companyId: string,
  customerId: string,
  input: CustomerAddressInput
): Promise<CustomerAddress> {
  const label = input.label.trim()
  if (!label) {
    throw new Error('תווית כתובת היא שדה חובה')
  }

  const address = input.address.trim()
  if (!address) {
    throw new Error('כתובת היא שדה חובה')
  }

  const place_id = normalizeOptionalText(input.place_id)
  const notes = normalizeOptionalText(input.notes)
  const lat = input.lat ?? null
  const lng = input.lng ?? null

  await assertCustomerInCompany(companyId, customerId)
  await assertUniqueLabel(companyId, customerId, label)

  const { data, error } = await supabase
    .from('customer_addresses')
    .insert({
      company_id: companyId,
      customer_id: customerId,
      label,
      address,
      place_id,
      lat,
      lng,
      notes,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Error inserting customer address:', error)
    throw error
  }

  return data as CustomerAddress
}

export async function updateCustomerAddress(
  companyId: string,
  addressId: string,
  input: Partial<CustomerAddressInput>
): Promise<CustomerAddress> {
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

  if (input.place_id !== undefined) {
    updates.place_id = normalizeOptionalText(input.place_id)
  }

  if (input.notes !== undefined) {
    updates.notes = normalizeOptionalText(input.notes)
  }

  if (input.lat !== undefined) {
    updates.lat = input.lat ?? null
  }

  if (input.lng !== undefined) {
    updates.lng = input.lng ?? null
  }

  const { data: existing, error: fetchError } = await supabase
    .from('customer_addresses')
    .select('id, customer_id, label')
    .eq('id', addressId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (fetchError) {
    console.error('Error fetching customer address for update:', fetchError)
    throw fetchError
  }

  if (!existing) {
    throw new Error('הכתובת לא נמצאה')
  }

  const nextLabel =
    input.label !== undefined ? (updates.label as string) : existing.label
  await assertUniqueLabel(companyId, existing.customer_id, nextLabel, addressId)

  const { data, error } = await supabase
    .from('customer_addresses')
    .update(updates)
    .eq('id', addressId)
    .eq('company_id', companyId)
    .select('*')
    .single()

  if (error) {
    console.error('Error updating customer address:', error)
    throw error
  }

  return data as CustomerAddress
}

export async function deleteCustomerAddress(
  companyId: string,
  addressId: string
): Promise<void> {
  const { error } = await supabase
    .from('customer_addresses')
    .delete()
    .eq('id', addressId)
    .eq('company_id', companyId)

  if (error) {
    console.error('Error deleting customer address:', error)
    throw error
  }
}

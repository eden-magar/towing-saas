import { supabase } from '../supabase'
import { normalizePhone } from '../utils/phone'
import type { CustomerPortalContact, CustomerPortalContactInput, CustomerUserRole } from '../types'
import { canEditPortalOrgData, isCustomerUserRole } from '../utils/portal-roles'

export type PortalCustomerUserRole = CustomerUserRole

/** Role for THIS customer_id (matches portal_user_may_* membership checks). */
export async function getPortalMembershipRole(
  userId: string,
  customerId: string
): Promise<PortalCustomerUserRole | null> {
  const { data, error } = await supabase
    .from('customer_users')
    .select('role')
    .eq('user_id', userId)
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('Error fetching portal membership role:', error)
    throw error
  }

  const role = data?.role
  if (isCustomerUserRole(role)) {
    return role
  }
  return null
}

export function canEditPortalContacts(role: PortalCustomerUserRole | null | undefined): boolean {
  return canEditPortalOrgData(role)
}

/** Persistable phone: normalize; empty → NULL (never store ''). */
function toStoredPhone(phone: string | null | undefined): string | null {
  const normalized = normalizePhone(phone ?? '')
  return normalized.length > 0 ? normalized : null
}

function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === '23505'
}

async function findByPhone(
  companyId: string,
  customerId: string,
  phone: string,
  excludeId?: string
): Promise<CustomerPortalContact | null> {
  let query = supabase
    .from('customer_portal_contacts')
    .select('*')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .eq('phone', phone)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    console.error('Error looking up portal contact by phone:', error)
    throw error
  }
  return (data as CustomerPortalContact | null) ?? null
}

function duplicatePhoneMessage(existingName: string): string {
  return `מספר הטלפון כבר שמור עבור "${existingName}"`
}

const AMBIGUOUS_COMPLETION_MESSAGE =
  'קיימים כמה אנשי קשר עם אותו שם ללא טלפון. השלימו או ערכו אותם במסך אנשי הקשר (/customer/contacts).'

export type CreatePortalContactResult =
  | { status: 'created'; contact: CustomerPortalContact }
  | { status: 'completion_available'; contact: CustomerPortalContact }

export function findMatchingPortalContact(
  name: string,
  phone: string,
  contacts: CustomerPortalContact[]
): CustomerPortalContact | undefined {
  const trimmedName = name.trim()
  if (!trimmedName) return undefined

  const trimmedPhone = toStoredPhone(phone)

  return contacts.find((contact) => {
    if (contact.name.trim() !== trimmedName) return false
    return toStoredPhone(contact.phone) === trimmedPhone
  })
}

export function shouldOfferSavePortalContact(
  name: string,
  phone: string,
  contacts: CustomerPortalContact[],
  canEdit: boolean
): boolean {
  return Boolean(
    canEdit &&
      name.trim() &&
      toStoredPhone(phone) &&
      !findMatchingPortalContact(name, phone, contacts)
  )
}

export async function listCustomerPortalContacts(
  customerId: string
): Promise<CustomerPortalContact[]> {
  const { data, error } = await supabase
    .from('customer_portal_contacts')
    .select('*')
    .eq('customer_id', customerId)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error listing portal contacts:', error)
    throw error
  }

  return (data ?? []) as CustomerPortalContact[]
}

export async function createCustomerPortalContact(
  companyId: string,
  customerId: string,
  userId: string,
  input: CustomerPortalContactInput
): Promise<CreatePortalContactResult> {
  const name = input.name.trim()
  if (!name) {
    throw new Error('שם איש קשר הוא שדה חובה')
  }

  const phone = toStoredPhone(input.phone)
  const role_or_title = input.role_or_title?.trim() || null

  if (phone) {
    const existingByPhone = await findByPhone(companyId, customerId, phone)
    if (existingByPhone) {
      throw new Error(duplicatePhoneMessage(existingByPhone.name))
    }
  }

  const { data: nameOnlyMatches, error: nameOnlyError } = await supabase
    .from('customer_portal_contacts')
    .select('*')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .eq('name', name)
    .is('phone', null)

  if (nameOnlyError) {
    console.error('Error checking name-only portal contacts:', nameOnlyError)
    throw nameOnlyError
  }

  const completionCandidates = (nameOnlyMatches ?? []) as CustomerPortalContact[]
  if (phone && completionCandidates.length === 1) {
    return { status: 'completion_available', contact: completionCandidates[0] }
  }
  if (phone && completionCandidates.length > 1) {
    throw new Error(AMBIGUOUS_COMPLETION_MESSAGE)
  }

  const { data, error } = await supabase
    .from('customer_portal_contacts')
    .insert({
      company_id: companyId,
      customer_id: customerId,
      name,
      phone,
      role_or_title,
      created_by_user_id: userId,
    })
    .select('*')
    .single()

  if (error) {
    if (isUniqueViolation(error) && phone) {
      const raced = await findByPhone(companyId, customerId, phone)
      throw new Error(duplicatePhoneMessage(raced?.name ?? 'איש קשר קיים'))
    }
    console.error('Error creating portal contact:', error)
    throw error
  }

  return { status: 'created', contact: data as CustomerPortalContact }
}

export async function updateCustomerPortalContact(
  companyId: string,
  customerId: string,
  contactId: string,
  input: Partial<CustomerPortalContactInput>
): Promise<CustomerPortalContact> {
  const updates: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  }

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) {
      throw new Error('שם איש קשר הוא שדה חובה')
    }
    updates.name = name
  }

  if (input.phone !== undefined) {
    updates.phone = toStoredPhone(input.phone)
  }

  if (input.role_or_title !== undefined) {
    updates.role_or_title = input.role_or_title?.trim() || null
  }

  const { data: existing, error: fetchError } = await supabase
    .from('customer_portal_contacts')
    .select('id, company_id, customer_id, phone')
    .eq('id', contactId)
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .maybeSingle()

  if (fetchError) {
    console.error('Error fetching portal contact for update:', fetchError)
    throw fetchError
  }

  if (!existing) {
    throw new Error('איש הקשר לא נמצא')
  }

  const nextPhone =
    input.phone !== undefined ? (updates.phone as string | null) : existing.phone

  if (nextPhone) {
    const conflict = await findByPhone(companyId, customerId, nextPhone, contactId)
    if (conflict) {
      throw new Error(duplicatePhoneMessage(conflict.name))
    }
  }

  const { data, error } = await supabase
    .from('customer_portal_contacts')
    .update(updates)
    .eq('id', contactId)
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .select('*')
    .single()

  if (error) {
    if (isUniqueViolation(error) && nextPhone) {
      const raced = await findByPhone(companyId, customerId, nextPhone, contactId)
      throw new Error(duplicatePhoneMessage(raced?.name ?? 'איש קשר קיים'))
    }
    console.error('Error updating portal contact:', error)
    throw error
  }

  return data as CustomerPortalContact
}

/**
 * Complete a name-only contact by setting phone (and optional title).
 * Used when create returns completion_available and the user confirms.
 */
export async function completeCustomerPortalContactPhone(
  companyId: string,
  customerId: string,
  contactId: string,
  phone: string,
  roleOrTitle?: string | null
): Promise<CustomerPortalContact> {
  const input: Partial<CustomerPortalContactInput> = { phone }
  if (roleOrTitle !== undefined) {
    input.role_or_title = roleOrTitle
  }
  return updateCustomerPortalContact(companyId, customerId, contactId, input)
}

export async function deleteCustomerPortalContact(
  companyId: string,
  customerId: string,
  contactId: string
): Promise<void> {
  const { error } = await supabase
    .from('customer_portal_contacts')
    .delete()
    .eq('id', contactId)
    .eq('company_id', companyId)
    .eq('customer_id', customerId)

  if (error) {
    console.error('Error deleting portal contact:', error)
    throw error
  }
}

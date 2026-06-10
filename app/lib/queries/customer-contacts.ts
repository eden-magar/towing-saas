import { supabase } from '../supabase'
import type { CustomerContact, CustomerContactInput } from '../types'

function normalizePhone(phone: string | null | undefined): string | null {
  const trimmed = phone?.trim()
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

async function assertUniquePhone(
  companyId: string,
  customerId: string,
  phone: string | null,
  excludeContactId?: string
): Promise<void> {
  if (!phone) return

  let query = supabase
    .from('customer_contacts')
    .select('id')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .eq('phone', phone)

  if (excludeContactId) {
    query = query.neq('id', excludeContactId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    console.error('Error checking duplicate contact phone:', error)
    throw error
  }

  if (data) {
    throw new Error('איש קשר עם מספר טלפון זה כבר קיים ללקוח זה')
  }
}

export async function getCustomerContacts(
  companyId: string,
  customerId: string
): Promise<CustomerContact[]> {
  const { data, error } = await supabase
    .from('customer_contacts')
    .select('*')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching customer contacts:', error)
    throw error
  }

  return (data ?? []) as CustomerContact[]
}

export async function insertCustomerContact(
  companyId: string,
  customerId: string,
  input: CustomerContactInput
): Promise<CustomerContact> {
  const name = input.name.trim()
  if (!name) {
    throw new Error('שם איש קשר הוא שדה חובה')
  }

  const phone = normalizePhone(input.phone)
  const role_or_title = input.role_or_title?.trim() || null
  const notes = input.notes?.trim() || null

  await assertCustomerInCompany(companyId, customerId)
  await assertUniquePhone(companyId, customerId, phone)

  const { data, error } = await supabase
    .from('customer_contacts')
    .insert({
      company_id: companyId,
      customer_id: customerId,
      name,
      phone,
      role_or_title,
      notes,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Error inserting customer contact:', error)
    throw error
  }

  return data as CustomerContact
}

export async function updateCustomerContact(
  companyId: string,
  contactId: string,
  input: Partial<CustomerContactInput>
): Promise<CustomerContact> {
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
    updates.phone = normalizePhone(input.phone)
  }

  if (input.role_or_title !== undefined) {
    updates.role_or_title = input.role_or_title?.trim() || null
  }

  if (input.notes !== undefined) {
    updates.notes = input.notes?.trim() || null
  }

  const { data: existing, error: fetchError } = await supabase
    .from('customer_contacts')
    .select('id, customer_id, phone')
    .eq('id', contactId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (fetchError) {
    console.error('Error fetching customer contact for update:', fetchError)
    throw fetchError
  }

  if (!existing) {
    throw new Error('איש הקשר לא נמצא')
  }

  const nextPhone = input.phone !== undefined ? updates.phone as string | null : existing.phone
  await assertUniquePhone(companyId, existing.customer_id, nextPhone, contactId)

  const { data, error } = await supabase
    .from('customer_contacts')
    .update(updates)
    .eq('id', contactId)
    .eq('company_id', companyId)
    .select('*')
    .single()

  if (error) {
    console.error('Error updating customer contact:', error)
    throw error
  }

  return data as CustomerContact
}

export async function deleteCustomerContact(
  companyId: string,
  contactId: string
): Promise<void> {
  const { error } = await supabase
    .from('customer_contacts')
    .delete()
    .eq('id', contactId)
    .eq('company_id', companyId)

  if (error) {
    console.error('Error deleting customer contact:', error)
    throw error
  }
}

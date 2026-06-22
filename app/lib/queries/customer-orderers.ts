import { supabase } from '../supabase'
import type { CustomerOrderer, CustomerOrdererInput } from '../types'

function normalizeDepartment(department: string | null | undefined): string | null {
  const trimmed = department?.trim()
  return trimmed ? trimmed : null
}

function ordererDedupeKey(department: string | null, name: string): string {
  return `${department ?? ''}|${name}`
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

async function assertUniqueDepartmentName(
  companyId: string,
  customerId: string,
  department: string | null,
  name: string,
  excludeOrdererId?: string
): Promise<void> {
  let query = supabase
    .from('customer_orderers')
    .select('id, department, name')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)

  if (excludeOrdererId) {
    query = query.neq('id', excludeOrdererId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error checking duplicate customer orderer:', error)
    throw error
  }

  const targetKey = ordererDedupeKey(department, name)
  const duplicate = (data ?? []).some(
    (row) => ordererDedupeKey(normalizeDepartment(row.department), row.name.trim()) === targetKey
  )

  if (duplicate) {
    throw new Error('מזמין עם שם ומחלקה אלה כבר קיים ללקוח זה')
  }
}

export async function getCustomerOrderers(
  companyId: string,
  customerId: string
): Promise<CustomerOrderer[]> {
  const { data, error } = await supabase
    .from('customer_orderers')
    .select('*')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching customer orderers:', error)
    throw error
  }

  return (data ?? []) as CustomerOrderer[]
}

export function findMatchingCustomerOrderer(
  department: string,
  name: string,
  orderers: CustomerOrderer[]
): CustomerOrderer | undefined {
  const trimmedName = name.trim()
  if (!trimmedName) return undefined

  const trimmedDepartment = normalizeDepartment(department)

  return orderers.find((orderer) => {
    if (orderer.name.trim() !== trimmedName) return false
    return normalizeDepartment(orderer.department) === trimmedDepartment
  })
}

export interface PendingCustomerOrderer {
  department?: string | null
  name: string
}

export async function insertPendingCustomerOrderers(
  companyId: string,
  customerId: string,
  pending: PendingCustomerOrderer[]
): Promise<void> {
  const seenKeys = new Set<string>()

  for (const item of pending) {
    const name = item.name.trim()
    if (!name) continue

    const department = normalizeDepartment(item.department)
    const key = ordererDedupeKey(department, name)
    if (seenKeys.has(key)) continue
    seenKeys.add(key)

    try {
      await insertCustomerOrderer(companyId, customerId, { department, name })
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (!message.includes('כבר קיים')) {
        console.error('Error saving customer orderer:', err)
      }
    }
  }
}

export async function insertCustomerOrderer(
  companyId: string,
  customerId: string,
  input: CustomerOrdererInput
): Promise<CustomerOrderer> {
  const name = input.name.trim()
  if (!name) {
    throw new Error('שם מזמין הוא שדה חובה')
  }

  const department = normalizeDepartment(input.department)

  await assertCustomerInCompany(companyId, customerId)
  await assertUniqueDepartmentName(companyId, customerId, department, name)

  const { data, error } = await supabase
    .from('customer_orderers')
    .insert({
      company_id: companyId,
      customer_id: customerId,
      department,
      name,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Error inserting customer orderer:', error)
    throw error
  }

  return data as CustomerOrderer
}

export async function updateCustomerOrderer(
  companyId: string,
  ordererId: string,
  input: Partial<CustomerOrdererInput>
): Promise<CustomerOrderer> {
  const updates: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  }

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) {
      throw new Error('שם מזמין הוא שדה חובה')
    }
    updates.name = name
  }

  if (input.department !== undefined) {
    updates.department = normalizeDepartment(input.department)
  }

  const { data: existing, error: fetchError } = await supabase
    .from('customer_orderers')
    .select('id, customer_id, department, name')
    .eq('id', ordererId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (fetchError) {
    console.error('Error fetching customer orderer for update:', fetchError)
    throw fetchError
  }

  if (!existing) {
    throw new Error('המזמין לא נמצא')
  }

  const nextDepartment =
    input.department !== undefined ? (updates.department as string | null) : normalizeDepartment(existing.department)
  const nextName = input.name !== undefined ? (updates.name as string) : existing.name.trim()
  await assertUniqueDepartmentName(companyId, existing.customer_id, nextDepartment, nextName, ordererId)

  const { data, error } = await supabase
    .from('customer_orderers')
    .update(updates)
    .eq('id', ordererId)
    .eq('company_id', companyId)
    .select('*')
    .single()

  if (error) {
    console.error('Error updating customer orderer:', error)
    throw error
  }

  return data as CustomerOrderer
}

export async function deleteCustomerOrderer(
  companyId: string,
  ordererId: string
): Promise<void> {
  const { error } = await supabase
    .from('customer_orderers')
    .delete()
    .eq('id', ordererId)
    .eq('company_id', companyId)

  if (error) {
    console.error('Error deleting customer orderer:', error)
    throw error
  }
}

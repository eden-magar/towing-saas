import { supabase } from '../supabase'

const COUNT_PAGE_SIZE = 1000
const CUSTOMER_ID_CHUNK_SIZE = 300

// ==================== טיפוסים ====================

export interface CustomerWithDetails {
  id: string
  customer_type: 'private' | 'business'
  name: string
  id_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // שדות מורחבים:
  company_relation: {
    id: string
    payment_terms: 'immediate' | 'monthly'
    credit_limit: number | null
    is_active: boolean
  } | null
  total_tows: number
  open_balance: number
}

export interface CustomerListItem {
  id: string
  customer_type: 'private' | 'business'
  name: string
  id_number: string | null
  phone: string | null
  email: string | null
  address: string | null
}

// ==================== שליפת לקוחות ====================

export async function getCustomersLite(companyId: string): Promise<CustomerListItem[]> {
  const all: CustomerListItem[] = []
  let from = 0

  while (true) {
    const { data: customerCompanies, error } = await supabase
      .from('customer_company')
      .select(`
        customer:customers (
          id,
          customer_type,
          name,
          id_number,
          phone,
          email,
          address
        )
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name', { ascending: true, foreignTable: 'customers' })
      .range(from, from + COUNT_PAGE_SIZE - 1)

    if (error) {
      console.error('Error fetching customers (lite):', error)
      throw error
    }

    const rows = customerCompanies ?? []
    if (rows.length === 0) break

    for (const cc of rows) {
      all.push(cc.customer as any as CustomerListItem)
    }

    if (rows.length < COUNT_PAGE_SIZE) break
    from += COUNT_PAGE_SIZE
  }

  return all
}

async function loadTowCountsByCustomer(
  companyId: string,
  customerIds: string[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  if (customerIds.length === 0) return counts

  for (let i = 0; i < customerIds.length; i += CUSTOMER_ID_CHUNK_SIZE) {
    const chunk = customerIds.slice(i, i + CUSTOMER_ID_CHUNK_SIZE)
    const chunkIndex = Math.floor(i / CUSTOMER_ID_CHUNK_SIZE) + 1
    let from = 0

    while (true) {
      const { data, error } = await supabase
        .from('tows')
        .select('customer_id')
        .eq('company_id', companyId)
        .in('customer_id', chunk)
        .range(from, from + COUNT_PAGE_SIZE - 1)

      if (error) {
        console.error(
          `Error fetching tow counts (chunk ${chunkIndex}, range ${from}-${from + COUNT_PAGE_SIZE - 1}):`,
          error
        )
        break
      }

      const rows = data ?? []
      if (rows.length === 0) break

      for (const row of rows) {
        if (row.customer_id) {
          counts[row.customer_id] = (counts[row.customer_id] ?? 0) + 1
        }
      }

      if (rows.length < COUNT_PAGE_SIZE) break
      from += COUNT_PAGE_SIZE
    }
  }

  return counts
}

async function loadOpenBalancesByCustomer(
  companyId: string,
  customerIds: string[]
): Promise<Record<string, number>> {
  const balances: Record<string, number> = {}
  if (customerIds.length === 0) return balances

  for (let i = 0; i < customerIds.length; i += CUSTOMER_ID_CHUNK_SIZE) {
    const chunk = customerIds.slice(i, i + CUSTOMER_ID_CHUNK_SIZE)
    const chunkIndex = Math.floor(i / CUSTOMER_ID_CHUNK_SIZE) + 1
    let from = 0

    while (true) {
      const { data, error } = await supabase
        .from('invoices')
        .select('customer_id, total_amount')
        .eq('company_id', companyId)
        .in('customer_id', chunk)
        .in('status', ['draft', 'sent'])
        .range(from, from + COUNT_PAGE_SIZE - 1)

      if (error) {
        console.error(
          `Error fetching open balances (chunk ${chunkIndex}, range ${from}-${from + COUNT_PAGE_SIZE - 1}):`,
          error
        )
        break
      }

      const rows = data ?? []
      if (rows.length === 0) break

      for (const row of rows) {
        if (row.customer_id) {
          balances[row.customer_id] = (balances[row.customer_id] ?? 0) + row.total_amount
        }
      }

      if (rows.length < COUNT_PAGE_SIZE) break
      from += COUNT_PAGE_SIZE
    }
  }

  return balances
}

interface CompanyRelationFields {
  id: string
  payment_terms: 'immediate' | 'monthly'
  credit_limit: number | null
  is_active: boolean
}

interface CustomerFields {
  id: string
  customer_type: 'private' | 'business'
  name: string
  id_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

function toCustomerWithDetails(
  customer: CustomerFields,
  companyRelation: CompanyRelationFields,
  countByCustomer: Record<string, number>,
  balanceByCustomer: Record<string, number>
): CustomerWithDetails {
  return {
    ...customer,
    company_relation: companyRelation,
    total_tows: countByCustomer[customer.id] || 0,
    open_balance: balanceByCustomer[customer.id] || 0,
  }
}

export async function getCustomers(companyId: string): Promise<CustomerWithDetails[]> {
  // שליפת לקוחות עם הקשר לחברה
  const { data: customerCompanies, error } = await supabase
    .from('customer_company')
    .select(`
      id,
      payment_terms,
      credit_limit,
      is_active,
      customer:customers (
        id,
        customer_type,
        name,
        id_number,
        phone,
        email,
        address,
        notes,
        created_at,
        updated_at
      )
    `)
    .eq('company_id', companyId)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching customers:', error)
    throw error
  }

  if (!customerCompanies) return []

  const customerIds = customerCompanies.map((cc) => (cc.customer as any).id as string)

  const [countByCustomer, balanceByCustomer] = await Promise.all([
    loadTowCountsByCustomer(companyId, customerIds),
    loadOpenBalancesByCustomer(companyId, customerIds),
  ])

  return customerCompanies.map((cc) => {
    const customer = cc.customer as any as CustomerFields
    return toCustomerWithDetails(
      customer,
      {
        id: cc.id,
        payment_terms: cc.payment_terms,
        credit_limit: cc.credit_limit,
        is_active: cc.is_active,
      },
      countByCustomer,
      balanceByCustomer
    )
  })
}

export async function searchCustomers(
  companyId: string,
  term: string
): Promise<CustomerWithDetails[]> {
  const trimmed = term.trim()
  if (!trimmed) return []

  const pattern = `%${trimmed}%`
  const all: (CustomerFields & { customer_company: CompanyRelationFields | CompanyRelationFields[] })[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        id,
        customer_type,
        name,
        id_number,
        phone,
        email,
        address,
        notes,
        created_at,
        updated_at,
        customer_company!inner (
          id,
          payment_terms,
          credit_limit,
          is_active,
          company_id
        )
      `)
      .eq('customer_company.company_id', companyId)
      .eq('customer_company.is_active', true)
      .or(`name.ilike.${pattern},id_number.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
      .order('name', { ascending: true })
      .range(from, from + COUNT_PAGE_SIZE - 1)

    if (error) {
      console.error('Error searching customers:', error)
      throw error
    }

    const rows = (data ?? []) as (CustomerFields & {
      customer_company: CompanyRelationFields | CompanyRelationFields[]
    })[]
    if (rows.length === 0) break

    all.push(...rows)

    if (rows.length < COUNT_PAGE_SIZE) break
    from += COUNT_PAGE_SIZE
  }

  if (all.length === 0) return []

  const customerIds = all.map((row) => row.id)
  const [countByCustomer, balanceByCustomer] = await Promise.all([
    loadTowCountsByCustomer(companyId, customerIds),
    loadOpenBalancesByCustomer(companyId, customerIds),
  ])

  return all.map((row) => {
    const junction = row.customer_company
    const companyRelation = Array.isArray(junction) ? junction[0] : junction
    return toCustomerWithDetails(row, companyRelation, countByCustomer, balanceByCustomer)
  })
}

export interface CustomerListStats {
  total: number
  business: number
  private: number
}

async function countActiveCustomers(
  companyId: string,
  customerType?: 'business' | 'private'
): Promise<number> {
  let query = supabase
    .from('customers')
    .select('id, customer_company!inner(company_id, is_active)', { count: 'exact', head: true })
    .eq('customer_company.company_id', companyId)
    .eq('customer_company.is_active', true)

  if (customerType) {
    query = query.eq('customer_type', customerType)
  }

  const { count, error } = await query

  if (error) {
    console.error('Error counting customers:', error)
    throw error
  }

  return count ?? 0
}

/** Exact DB totals for customers list summary cards (not limited by list fetch). */
export async function getCustomerListStats(companyId: string): Promise<CustomerListStats> {
  const [total, business, privateCount] = await Promise.all([
    countActiveCustomers(companyId),
    countActiveCustomers(companyId, 'business'),
    countActiveCustomers(companyId, 'private'),
  ])

  return { total, business, private: privateCount }
}

// ==================== הוספת לקוח ====================

interface CreateCustomerInput {
  companyId: string
  customerType: 'private' | 'business'
  name: string
  idNumber?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  paymentTerms: 'immediate' | 'monthly'
  creditLimit?: number
}

export async function createCustomer(input: CreateCustomerInput) {
  // יצירת UUID מראש
  const customerId = crypto.randomUUID()

  // יצירת הלקוח (בלי select)
  const { error: customerError } = await supabase
    .from('customers')
    .insert({
      id: customerId,
      customer_type: input.customerType,
      name: input.name,
      id_number: input.idNumber || null,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      notes: input.notes || null
    })

  if (customerError) {
    console.error('Error creating customer:', JSON.stringify(customerError, null, 2))
    throw customerError
  }

  // יצירת הקשר לחברה
  const { error: relationError } = await supabase
    .from('customer_company')
    .insert({
      customer_id: customerId,
      company_id: input.companyId,
      payment_terms: input.paymentTerms,
      credit_limit: input.creditLimit || null,
      is_active: true
    })

  if (relationError) {
    // מחיקת הלקוח אם נכשל
    await supabase.from('customers').delete().eq('id', customerId)
    console.error('Error creating customer relation:', relationError)
    throw relationError
  }

  return { id: customerId }
}

// ==================== עריכת לקוח ====================

interface UpdateCustomerInput {
  customerId: string
  companyRelationId: string
  customerType?: 'private' | 'business'
  name?: string
  idNumber?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  paymentTerms?: 'immediate' | 'monthly'
  creditLimit?: number
}

export async function updateCustomer(input: UpdateCustomerInput) {
  // עדכון פרטי לקוח
  const { error: customerError } = await supabase
    .from('customers')
    .update({
      customer_type: input.customerType,
      name: input.name,
      id_number: input.idNumber || null,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      notes: input.notes || null
    })
    .eq('id', input.customerId)

  if (customerError) {
    console.error('Error updating customer:', customerError)
    throw customerError
  }

  // עדכון הקשר לחברה
  const { error: relationError } = await supabase
    .from('customer_company')
    .update({
      payment_terms: input.paymentTerms,
      credit_limit: input.creditLimit || null
    })
    .eq('id', input.companyRelationId)

  if (relationError) {
    console.error('Error updating customer relation:', relationError)
    throw relationError
  }

  return true
}

// ==================== מחיקת לקוח (ביטול קשר) ====================

export async function deleteCustomer(companyRelationId: string) {
  // לא מוחקים את הלקוח עצמו, רק מבטלים את הקשר לחברה
  const { error } = await supabase
    .from('customer_company')
    .update({ is_active: false })
    .eq('id', companyRelationId)

  if (error) {
    console.error('Error deactivating customer:', error)
    throw error
  }

  return true
}

// ==================== בדיקת כפילויות ====================

// ==================== בדיקת כפילויות ====================

export async function checkCustomerDuplicate(
  companyId: string,
  phone?: string,
  idNumber?: string,
  excludeCustomerId?: string
): Promise<{ phone: boolean; idNumber: boolean }> {
  let phoneExists = false
  let idNumberExists = false

  if (phone) {
    let query = supabase
      .from('customers')
      .select('id')
      .eq('phone', phone)
    
    if (excludeCustomerId) {
      query = query.neq('id', excludeCustomerId)
    }
    
    const { data } = await query.maybeSingle()
    phoneExists = !!data
  }

  if (idNumber) {
    let query = supabase
      .from('customers')
      .select('id')
      .eq('id_number', idNumber)
    
    if (excludeCustomerId) {
      query = query.neq('id', excludeCustomerId)
    }
    
    const { data } = await query.maybeSingle()
    idNumberExists = !!data
  }

  return { phone: phoneExists, idNumber: idNumberExists }
}
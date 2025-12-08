import { supabase } from '../supabase'

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

// ==================== שליפת לקוחות ====================

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

  // שליפת ספירת גרירות לכל לקוח
  const customerIds = customerCompanies.map(cc => (cc.customer as any).id)
  
  const { data: towCounts } = await supabase
    .from('tows')
    .select('customer_id')
    .eq('company_id', companyId)
    .in('customer_id', customerIds)

  // מיפוי ספירות
  const countByCustomer: Record<string, number> = {}
  towCounts?.forEach(tow => {
    if (tow.customer_id) {
      countByCustomer[tow.customer_id] = (countByCustomer[tow.customer_id] || 0) + 1
    }
  })

  // שליפת יתרות פתוחות (חשבוניות לא משולמות)
  const { data: openInvoices } = await supabase
    .from('invoices')
    .select('customer_id, total_amount')
    .eq('company_id', companyId)
    .in('customer_id', customerIds)
    .in('status', ['draft', 'sent'])

  const balanceByCustomer: Record<string, number> = {}
  openInvoices?.forEach(inv => {
    if (inv.customer_id) {
      balanceByCustomer[inv.customer_id] = (balanceByCustomer[inv.customer_id] || 0) + inv.total_amount
    }
  })

  return customerCompanies.map(cc => {
    const customer = cc.customer as any
    return {
      ...customer,
      company_relation: {
        id: cc.id,
        payment_terms: cc.payment_terms,
        credit_limit: cc.credit_limit,
        is_active: cc.is_active
      },
      total_tows: countByCustomer[customer.id] || 0,
      open_balance: balanceByCustomer[customer.id] || 0
    }
  })
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
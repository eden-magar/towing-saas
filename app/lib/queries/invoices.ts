import { supabase } from '../supabase'

// ==================== טיפוסים ====================

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled'

export interface InvoiceItem {
  id: string
  invoice_id: string
  tow_id: string | null
  description: string
  amount: number
}

export interface Invoice {
  id: string
  company_id: string
  customer_id: string | null
  tow_id: string | null
  invoice_number: string
  external_invoice_id: string | null
  amount: number
  vat_amount: number
  total_amount: number
  status: InvoiceStatus
  issued_at: string | null
  due_date: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceWithDetails extends Invoice {
  customer: {
    id: string
    name: string
    phone: string | null
    email: string | null
  } | null
  tow: {
    id: string
    status: string
  } | null
  items: InvoiceItem[]
}

// ==================== שליפת חשבוניות ====================

export async function getInvoices(companyId: string, filters?: {
  status?: InvoiceStatus
  customerId?: string
  fromDate?: string
  toDate?: string
}): Promise<InvoiceWithDetails[]> {
  let query = supabase
    .from('invoices')
    .select(`
      *,
      customer:customers (
        id,
        name,
        phone,
        email
      ),
      tow:tows (
        id,
        status
      ),
      items:invoice_items (*)
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId)
  }
  if (filters?.fromDate) {
    query = query.gte('issued_at', filters.fromDate)
  }
  if (filters?.toDate) {
    query = query.lte('issued_at', filters.toDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching invoices:', error)
    throw error
  }

  return (data || []).map(inv => ({
    ...inv,
    customer: inv.customer as any,
    tow: inv.tow as any,
    items: inv.items || []
  }))
}

export async function getInvoice(invoiceId: string): Promise<InvoiceWithDetails | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      customer:customers (
        id,
        name,
        phone,
        email
      ),
      tow:tows (
        id,
        status
      ),
      items:invoice_items (*)
    `)
    .eq('id', invoiceId)
    .single()

  if (error) {
    console.error('Error fetching invoice:', error)
    throw error
  }

  return {
    ...data,
    customer: data.customer as any,
    tow: data.tow as any,
    items: data.items || []
  }
}

// ==================== סטטיסטיקות ====================

export async function getInvoiceStats(companyId: string) {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('status, total_amount')
    .eq('company_id', companyId)

  if (error) {
    console.error('Error fetching invoice stats:', error)
    throw error
  }

  const stats = {
    total: invoices?.length || 0,
    draft: 0,
    sent: 0,
    paid: 0,
    cancelled: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0
  }

  invoices?.forEach(inv => {
    stats[inv.status as keyof typeof stats]++
    stats.totalAmount += inv.total_amount || 0
    if (inv.status === 'paid') {
      stats.paidAmount += inv.total_amount || 0
    } else if (inv.status === 'sent') {
      stats.pendingAmount += inv.total_amount || 0
    }
  })

  return stats
}

// ==================== יצירת חשבונית ====================

export async function generateInvoiceNumber(companyId: string): Promise<string> {
  // פורמט: YYMM-XXXX
  const now = new Date()
  const prefix = now.toISOString().slice(2, 4) + now.toISOString().slice(5, 7)
  
  // מציאת המספר הגבוה ביותר לחודש הנוכחי
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('company_id', companyId)
    .like('invoice_number', `${prefix}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1)

  let nextNum = 1
  if (data && data.length > 0) {
    const lastNum = parseInt(data[0].invoice_number.split('-')[1]) || 0
    nextNum = lastNum + 1
  }

  return `${prefix}-${String(nextNum).padStart(4, '0')}`
}

export async function createInvoice(data: {
  companyId: string
  customerId?: string
  towId?: string
  invoiceNumber?: string
  amount: number
  vatPercent?: number
  dueDate?: string
  items: { description: string; amount: number; towId?: string }[]
}): Promise<Invoice> {
  const invoiceNumber = data.invoiceNumber || await generateInvoiceNumber(data.companyId)
  const vatPercent = data.vatPercent ?? 17
  const vatAmount = data.amount * (vatPercent / 100)
  const totalAmount = data.amount + vatAmount

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      company_id: data.companyId,
      customer_id: data.customerId || null,
      tow_id: data.towId || null,
      invoice_number: invoiceNumber,
      amount: data.amount,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      status: 'draft',
      due_date: data.dueDate || null
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating invoice:', error)
    throw error
  }

  // הוספת פריטים
  if (data.items.length > 0) {
    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(data.items.map(item => ({
        invoice_id: invoice.id,
        tow_id: item.towId || null,
        description: item.description,
        amount: item.amount
      })))

    if (itemsError) {
      console.error('Error creating invoice items:', itemsError)
      throw itemsError
    }
  }

  return invoice
}

// ==================== יצירת חשבונית מגרירה ====================

export async function createInvoiceFromTow(
  companyId: string,
  towId: string,
  customerId: string | null,
  amount: number,
  description: string
): Promise<Invoice> {
  return createInvoice({
    companyId,
    customerId: customerId || undefined,
    towId,
    amount,
    items: [{ description, amount, towId }]
  })
}

// ==================== עדכון חשבונית ====================

export async function updateInvoice(
  invoiceId: string,
  updates: Partial<{
    customer_id: string | null
    amount: number
    vat_amount: number
    total_amount: number
    due_date: string | null
    status: InvoiceStatus
  }>
): Promise<Invoice> {
  const { data, error } = await supabase
    .from('invoices')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', invoiceId)
    .select()
    .single()

  if (error) {
    console.error('Error updating invoice:', error)
    throw error
  }

  return data
}

// ==================== עדכון סטטוס ====================

export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus
): Promise<Invoice> {
  const updates: Record<string, any> = {
    status,
    updated_at: new Date().toISOString()
  }

  if (status === 'sent') {
    updates.issued_at = new Date().toISOString()
  } else if (status === 'paid') {
    updates.paid_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', invoiceId)
    .select()
    .single()

  if (error) {
    console.error('Error updating invoice status:', error)
    throw error
  }

  return data
}

// ==================== מחיקת חשבונית ====================

export async function deleteInvoice(invoiceId: string): Promise<void> {
  // מחיקת פריטים תחילה
  await supabase
    .from('invoice_items')
    .delete()
    .eq('invoice_id', invoiceId)

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)

  if (error) {
    console.error('Error deleting invoice:', error)
    throw error
  }
}

// ==================== ניהול פריטי חשבונית ====================

export async function addInvoiceItem(
  invoiceId: string,
  item: { description: string; amount: number; towId?: string }
): Promise<InvoiceItem> {
  const { data, error } = await supabase
    .from('invoice_items')
    .insert({
      invoice_id: invoiceId,
      tow_id: item.towId || null,
      description: item.description,
      amount: item.amount
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding invoice item:', error)
    throw error
  }

  // עדכון סכומי החשבונית
  await recalculateInvoiceTotals(invoiceId)

  return data
}

export async function updateInvoiceItem(
  itemId: string,
  updates: Partial<{ description: string; amount: number }>
): Promise<InvoiceItem> {
  const { data, error } = await supabase
    .from('invoice_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single()

  if (error) {
    console.error('Error updating invoice item:', error)
    throw error
  }

  // עדכון סכומי החשבונית
  await recalculateInvoiceTotals(data.invoice_id)

  return data
}

export async function deleteInvoiceItem(itemId: string, invoiceId: string): Promise<void> {
  const { error } = await supabase
    .from('invoice_items')
    .delete()
    .eq('id', itemId)

  if (error) {
    console.error('Error deleting invoice item:', error)
    throw error
  }

  // עדכון סכומי החשבונית
  await recalculateInvoiceTotals(invoiceId)
}

// ==================== חישוב מחדש של סכומים ====================

async function recalculateInvoiceTotals(invoiceId: string): Promise<void> {
  // שליפת כל הפריטים
  const { data: items } = await supabase
    .from('invoice_items')
    .select('amount')
    .eq('invoice_id', invoiceId)

  const amount = items?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0
  const vatAmount = amount * 0.17
  const totalAmount = amount + vatAmount

  await supabase
    .from('invoices')
    .update({
      amount,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      updated_at: new Date().toISOString()
    })
    .eq('id', invoiceId)
}

// ==================== בדיקת חשבונית לגרירה ====================

export async function getInvoiceByTowId(towId: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('tow_id', towId)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    console.error('Error fetching invoice by tow:', error)
    throw error
  }

  return data || null
}

export async function towHasInvoice(towId: string): Promise<boolean> {
  const { data } = await supabase
    .from('invoices')
    .select('id')
    .eq('tow_id', towId)
    .limit(1)

  return data !== null && data.length > 0
}

// ==================== גרירות ללא חשבונית ====================

export async function getTowsWithoutInvoice(companyId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('tows')
    .select(`
      id,
      created_at,
      status,
      final_price,
      customer:customers (
        id,
        name
      )
    `)
    .eq('company_id', companyId)
    .eq('status', 'completed')
    .is('id', null) // לא קיים בחשבוניות - נצטרך לבדוק אחרת
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching tows without invoice:', error)
    throw error
  }

  return data || []
}
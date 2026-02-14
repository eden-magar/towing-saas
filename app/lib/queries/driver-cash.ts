import { supabase } from '../supabase'
import { DriverCashTransaction } from '../types'

// ==================== קופה קטנה — queries ====================

// שליפת יתרת מזומן של נהג (גביות - העברות מאושרות)
export async function getDriverCashBalance(driverId: string): Promise<number> {
  const { data, error } = await supabase
    .from('driver_cash_transactions')
    .select('amount, type')
    .eq('driver_id', driverId)

  if (error) {
    console.error('Error fetching cash balance:', error)
    throw error
  }

  if (!data) return 0

  let balance = 0
  for (const tx of data) {
    if (tx.type === 'collection') {
      balance += Number(tx.amount)
    } else if (tx.type === 'approval') {
      balance -= Number(tx.amount)
    }
  }

  return balance
}

// שליפת היסטוריית עסקאות של נהג
export async function getDriverCashTransactions(driverId: string): Promise<DriverCashTransaction[]> {
  const { data, error } = await supabase
    .from('driver_cash_transactions')
    .select(`
      *,
      tow:tows!driver_cash_transactions_tow_id_fkey(
        order_number,
        customer:customers!tows_customer_id_fkey(name)
      )
    `)
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching cash transactions:', error)
    throw error
  }

  return (data || []).map((tx: any) => ({
    ...tx,
    order_number: tx.tow?.order_number || null,
    customer_name: tx.tow?.customer?.name || null,
    tow: undefined
  }))
}

// יצירת רשומת גבייה (נהג גבה מזומן)
export async function createCashCollection(
  driverId: string,
  towId: string,
  amount: number,
  createdBy: string
): Promise<void> {
  const { error } = await supabase
    .from('driver_cash_transactions')
    .insert({
      driver_id: driverId,
      tow_id: towId,
      amount,
      type: 'collection',
      created_by: createdBy
    })

  if (error) {
    console.error('Error creating cash collection:', error)
    throw error
  }
}

// נהג מדווח שהעביר כסף לחברה
export async function createCashTransfer(
  driverId: string,
  amount: number,
  createdBy: string,
  notes?: string
): Promise<void> {
  const { error } = await supabase
    .from('driver_cash_transactions')
    .insert({
      driver_id: driverId,
      amount,
      type: 'transfer',
      notes: notes || null,
      created_by: createdBy
    })

  if (error) {
    console.error('Error creating cash transfer:', error)
    throw error
  }
}

// עדכון tow עם פרטי תשלום מזומן
export async function updateTowCashPayment(
  towId: string,
  paymentMethod: string,
  cashCollected: number | null
): Promise<void> {
  const { error } = await supabase
    .from('tows')
    .update({
      payment_method: paymentMethod,
      cash_collected: cashCollected
    })
    .eq('id', towId)

  if (error) {
    console.error('Error updating tow cash payment:', error)
    throw error
  }
}

// === פונקציות למנהל ===

// שליפת כל עסקאות החברה (למנהל)
export async function getCompanyCashTransactions(
  companyId: string,
  filters?: { driverId?: string; fromDate?: string; toDate?: string }
): Promise<(DriverCashTransaction & { driver_name?: string })[]> {
  let query = supabase
    .from('driver_cash_transactions')
    .select(`
      *,
      driver:drivers!driver_cash_transactions_driver_id_fkey(
        id,
        user:users!drivers_user_id_fkey(full_name)
      ),
      tow:tows!driver_cash_transactions_tow_id_fkey(
        order_number,
        customer:customers!tows_customer_id_fkey(name)
      )
    `)
    .order('created_at', { ascending: false })

  if (filters?.driverId) {
    query = query.eq('driver_id', filters.driverId)
  }
  if (filters?.fromDate) {
    query = query.gte('created_at', filters.fromDate)
  }
  if (filters?.toDate) {
    query = query.lte('created_at', filters.toDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching company cash transactions:', error)
    throw error
  }

  return (data || []).map((tx: any) => ({
    ...tx,
    driver_name: tx.driver?.user?.full_name || 'לא ידוע',
    order_number: tx.tow?.order_number || null,
    customer_name: tx.tow?.customer?.name || null,
    driver: undefined,
    tow: undefined
  }))
}

// מנהל מאשר העברה
export async function approveCashTransfer(
  driverId: string,
  amount: number,
  approvedBy: string,
  notes?: string
): Promise<void> {
  const { error } = await supabase
    .from('driver_cash_transactions')
    .insert({
      driver_id: driverId,
      amount,
      type: 'approval',
      notes: notes || null,
      created_by: approvedBy
    })

  if (error) {
    console.error('Error approving cash transfer:', error)
    throw error
  }
}

// שליפת יתרות כל הנהגים בחברה
export async function getAllDriversCashBalances(companyId: string): Promise<{
  driverId: string
  driverName: string
  balance: number
}[]> {
  // שליפת כל הנהגים בחברה
  const { data: drivers, error: driversError } = await supabase
    .from('drivers')
    .select('id, user:users!drivers_user_id_fkey(full_name)')
    .eq('company_id', companyId)

  if (driversError) {
    console.error('Error fetching drivers:', driversError)
    throw driversError
  }

  if (!drivers || drivers.length === 0) return []

  // שליפת כל העסקאות של נהגי החברה
  const driverIds = drivers.map((d: any) => d.id)
  const { data: transactions, error: txError } = await supabase
    .from('driver_cash_transactions')
    .select('driver_id, amount, type')
    .in('driver_id', driverIds)

  if (txError) {
    console.error('Error fetching transactions:', txError)
    throw txError
  }

  // חישוב יתרה לכל נהג
  const balanceMap: Record<string, number> = {}
  for (const tx of transactions || []) {
    if (!balanceMap[tx.driver_id]) balanceMap[tx.driver_id] = 0
    if (tx.type === 'collection') {
      balanceMap[tx.driver_id] += Number(tx.amount)
    } else if (tx.type === 'approval') {
      balanceMap[tx.driver_id] -= Number(tx.amount)
    }
  }

  return drivers.map((d: any) => ({
    driverId: d.id,
    driverName: d.user?.full_name || 'לא ידוע',
    balance: balanceMap[d.id] || 0
  }))
}
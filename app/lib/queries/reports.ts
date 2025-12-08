import { supabase } from '../supabase'

// ==================== TYPES ====================

export interface ReportsSummary {
  totalTows: number
  completedTows: number
  cancelledTows: number
  pendingTows: number
  completionRate: number
  totalRevenue: number
  collectedRevenue: number
  pendingRevenue: number
  avgRevenuePerTow: number
  newCustomers: number
  towsChange: number
  revenueChange: number
  avgChange: number
  customersChange: number
}

export interface PeriodData {
  period: string
  label: string
  tows: number
  revenue: number
}

export interface VehicleTypeBreakdown {
  vehicle_type: string
  count: number
  percentage: number
}

export interface TowReasonBreakdown {
  tow_reason: string
  count: number
  percentage: number
}

export interface CustomerTypeData {
  private: number
  business: number
  privatePercent: number
  businessPercent: number
  total: number
}

export interface TopDriver {
  driver_id: string
  driver_name: string
  initials: string
  total_tows: number
  total_revenue: number
  avg_rating?: number
}

export interface TopCustomer {
  customer_id: string
  customer_name: string
  customer_type: string
  total_tows: number
  total_revenue: number
}

export interface DriverReport {
  driver_id: string
  driver_name: string
  phone: string
  status: string
  license_number: string | null
  total_tows: number
  completed_tows: number
  cancelled_tows: number
  completion_rate: number
  total_revenue: number
  avg_revenue_per_tow: number
  current_truck: string | null
}

export interface CustomerReport {
  customer_id: string
  customer_name: string
  customer_type: string
  phone: string | null
  email: string | null
  total_tows: number
  total_revenue: number
  total_invoiced: number
  paid_amount: number
  pending_amount: number
  debt: number
}

export interface TowListItem {
  id: string
  created_at: string
  status: string
  from_address: string | null
  to_address: string | null
  final_price: number | null
  vehicle_plate: string | null
  customer_name?: string
  driver_name?: string
}

export interface ReportFilters {
  startDate: string
  endDate: string
}

// ==================== HELPER FUNCTIONS ====================

export function getDateRange(period: 'week' | 'month' | 'quarter' | 'year'): ReportFilters {
  const now = new Date()
  const endDate = now.toISOString().split('T')[0]
  let startDate: string

  switch (period) {
    case 'week':
      const weekAgo = new Date(now)
      weekAgo.setDate(now.getDate() - 7)
      startDate = weekAgo.toISOString().split('T')[0]
      break
    case 'month':
      const monthAgo = new Date(now)
      monthAgo.setMonth(now.getMonth() - 1)
      startDate = monthAgo.toISOString().split('T')[0]
      break
    case 'quarter':
      const quarterAgo = new Date(now)
      quarterAgo.setMonth(now.getMonth() - 3)
      startDate = quarterAgo.toISOString().split('T')[0]
      break
    case 'year':
      const yearAgo = new Date(now)
      yearAgo.setFullYear(now.getFullYear() - 1)
      startDate = yearAgo.toISOString().split('T')[0]
      break
  }

  return { startDate, endDate }
}

function formatPeriodLabel(dateStr: string, groupBy: 'day' | 'week' | 'month'): string {
  const date = new Date(dateStr)
  if (groupBy === 'day') {
    return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
  } else if (groupBy === 'month') {
    return date.toLocaleDateString('he-IL', { month: 'short' })
  }
  return dateStr
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// ==================== MAIN SUMMARY ====================
// חישוב תקופה קודמת
function getPreviousPeriod(filters: ReportFilters): ReportFilters {
  const start = new Date(filters.startDate)
  const end = new Date(filters.endDate)
  const duration = end.getTime() - start.getTime()
  
  const prevEnd = new Date(start.getTime() - 1) // יום לפני תחילת התקופה הנוכחית
  const prevStart = new Date(prevEnd.getTime() - duration)
  
  return {
    startDate: prevStart.toISOString().split('T')[0],
    endDate: prevEnd.toISOString().split('T')[0]
  }
}

// חישוב אחוז שינוי
function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}


export async function getReportsSummary(
  companyId: string, 
  filters: ReportFilters
): Promise<ReportsSummary> {
  const { startDate, endDate } = filters
  const prevFilters = getPreviousPeriod(filters)

  // === תקופה נוכחית ===
  const { data: tows, error: towsError } = await supabase
    .from('tows')
    .select('id, status, final_price, created_at')
    .eq('company_id', companyId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')

  if (towsError) throw towsError

  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id, status, total_amount')
    .eq('company_id', companyId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')

  if (invoicesError) throw invoicesError

  const { data: customers, error: customersError } = await supabase
    .from('customer_company')
    .select('id')
    .eq('company_id', companyId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')

  if (customersError) throw customersError

  // === תקופה קודמת ===
  const { data: prevTows } = await supabase
    .from('tows')
    .select('id, status, final_price')
    .eq('company_id', companyId)
    .gte('created_at', prevFilters.startDate)
    .lte('created_at', prevFilters.endDate + 'T23:59:59')

  const { data: prevCustomers } = await supabase
    .from('customer_company')
    .select('id')
    .eq('company_id', companyId)
    .gte('created_at', prevFilters.startDate)
    .lte('created_at', prevFilters.endDate + 'T23:59:59')

  // === חישובים - תקופה נוכחית ===
  const totalTows = tows?.length || 0
  const completedTows = tows?.filter(t => t.status === 'completed').length || 0
  const cancelledTows = tows?.filter(t => t.status === 'cancelled').length || 0
  const pendingTows = tows?.filter(t => ['pending', 'assigned', 'in_progress'].includes(t.status)).length || 0

  const totalRevenue = tows
    ?.filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + (t.final_price || 0), 0) || 0

  const collectedRevenue = invoices
    ?.filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + (i.total_amount || 0), 0) || 0

  const pendingRevenue = invoices
    ?.filter(i => i.status === 'sent')
    .reduce((sum, i) => sum + (i.total_amount || 0), 0) || 0

  const avgRevenuePerTow = completedTows > 0 ? Math.round(totalRevenue / completedTows) : 0
  const newCustomers = customers?.length || 0

  // === חישובים - תקופה קודמת ===
  const prevTotalTows = prevTows?.length || 0
  const prevCompletedTows = prevTows?.filter(t => t.status === 'completed').length || 0
  const prevTotalRevenue = prevTows
    ?.filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + (t.final_price || 0), 0) || 0
  const prevAvg = prevCompletedTows > 0 ? Math.round(prevTotalRevenue / prevCompletedTows) : 0
  const prevNewCustomers = prevCustomers?.length || 0

  return {
    totalTows,
    completedTows,
    cancelledTows,
    pendingTows,
    completionRate: totalTows > 0 ? Math.round((completedTows / totalTows) * 100) : 0,
    totalRevenue,
    collectedRevenue,
    pendingRevenue,
    avgRevenuePerTow,
    newCustomers,
    // אחוזי שינוי
    towsChange: calcChange(totalTows, prevTotalTows),
    revenueChange: calcChange(totalRevenue, prevTotalRevenue),
    avgChange: calcChange(avgRevenuePerTow, prevAvg),
    customersChange: calcChange(newCustomers, prevNewCustomers)
  }
}

// ==================== CHARTS DATA ====================

export async function getTowsOverTime(
  companyId: string,
  filters: ReportFilters,
  groupBy: 'day' | 'month' = 'day'
): Promise<PeriodData[]> {
  const { startDate, endDate } = filters

  const { data: tows, error } = await supabase
    .from('tows')
    .select('id, status, final_price, created_at')
    .eq('company_id', companyId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')
    .order('created_at', { ascending: true })

  if (error) throw error
  if (!tows || tows.length === 0) return []

  // Group by period
  const grouped: Record<string, { tows: number; revenue: number }> = {}

  tows.forEach(tow => {
    const date = new Date(tow.created_at)
    let period: string

    if (groupBy === 'day') {
      period = date.toISOString().split('T')[0]
    } else {
      period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
    }

    if (!grouped[period]) {
      grouped[period] = { tows: 0, revenue: 0 }
    }
    grouped[period].tows++
    if (tow.status === 'completed') {
      grouped[period].revenue += tow.final_price || 0
    }
  })

  return Object.entries(grouped)
    .map(([period, data]) => ({
      period,
      label: formatPeriodLabel(period, groupBy),
      tows: data.tows,
      revenue: data.revenue
    }))
    .sort((a, b) => a.period.localeCompare(b.period))
}

// ==================== BREAKDOWNS ====================

export async function getVehicleTypeBreakdown(
  companyId: string,
  filters: ReportFilters
): Promise<VehicleTypeBreakdown[]> {
  const { startDate, endDate } = filters

  const { data: tows, error: towsError } = await supabase
    .from('tows')
    .select('id')
    .eq('company_id', companyId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')

  if (towsError) throw towsError
  if (!tows || tows.length === 0) return []

  const towIds = tows.map(t => t.id)

  const { data: vehicles, error } = await supabase
    .from('tow_vehicles')
    .select('vehicle_type')
    .in('tow_id', towIds)

  if (error) throw error
  if (!vehicles || vehicles.length === 0) return []

  // Count by type
  const counts: Record<string, number> = {}
  vehicles.forEach(v => {
    const type = v.vehicle_type || 'unknown'
    counts[type] = (counts[type] || 0) + 1
  })

  const total = vehicles.length
  const typeLabels: Record<string, string> = {
    motorcycle: 'אופנוע',
    small: 'רכב פרטי',
    medium: 'ג\'יפ / SUV',
    large: 'מסחרי',
    truck: 'משאית',
    unknown: 'לא ידוע'
  }

  return Object.entries(counts)
    .map(([type, count]) => ({
      vehicle_type: typeLabels[type] || type,
      count,
      percentage: Math.round((count / total) * 100)
    }))
    .sort((a, b) => b.count - a.count)
}

export async function getTowReasonBreakdown(
  companyId: string,
  filters: ReportFilters
): Promise<TowReasonBreakdown[]> {
  const { startDate, endDate } = filters

  const { data: tows, error: towsError } = await supabase
    .from('tows')
    .select('id')
    .eq('company_id', companyId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')

  if (towsError) throw towsError
  if (!tows || tows.length === 0) return []

  const towIds = tows.map(t => t.id)

  const { data: vehicles, error } = await supabase
    .from('tow_vehicles')
    .select('tow_reason')
    .in('tow_id', towIds)

  if (error) throw error
  if (!vehicles || vehicles.length === 0) return []

  // Count by reason
  const counts: Record<string, number> = {}
  vehicles.forEach(v => {
    const reason = v.tow_reason || 'אחר'
    counts[reason] = (counts[reason] || 0) + 1
  })

  const total = vehicles.length

  return Object.entries(counts)
    .map(([reason, count]) => ({
      tow_reason: reason,
      count,
      percentage: Math.round((count / total) * 100)
    }))
    .sort((a, b) => b.count - a.count)
}

export async function getCustomerTypeBreakdown(
  companyId: string,
  filters: ReportFilters
): Promise<CustomerTypeData> {
  const { startDate, endDate } = filters

  const { data: tows, error } = await supabase
    .from('tows')
    .select(`
      id,
      customer:customers(customer_type)
    `)
    .eq('company_id', companyId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')
    .not('customer_id', 'is', null)

  if (error) throw error
  if (!tows || tows.length === 0) {
    return { private: 0, business: 0, privatePercent: 0, businessPercent: 0, total: 0 }
  }

  let privateCount = 0
  let businessCount = 0

  tows.forEach(tow => {
    const customerData = tow.customer as unknown
    const customer = Array.isArray(customerData) ? customerData[0] : customerData
    if (customer?.customer_type === 'private') {
      privateCount++
    } else if (customer?.customer_type === 'business') {
      businessCount++
    }
  })

  const total = privateCount + businessCount

  return {
    private: privateCount,
    business: businessCount,
    privatePercent: total > 0 ? Math.round((privateCount / total) * 100) : 0,
    businessPercent: total > 0 ? Math.round((businessCount / total) * 100) : 0,
    total
  }
}

// ==================== TOP LISTS ====================

export async function getTopDrivers(
  companyId: string,
  filters: ReportFilters,
  limit: number = 5
): Promise<TopDriver[]> {
  const { startDate, endDate } = filters

  // Get drivers
  const { data: drivers, error: driversError } = await supabase
    .from('drivers')
    .select(`
      id,
      user:users(full_name)
    `)
    .eq('company_id', companyId)

  if (driversError) throw driversError
  if (!drivers) return []

  // Get tows
  const { data: tows, error: towsError } = await supabase
    .from('tows')
    .select('id, driver_id, status, final_price')
    .eq('company_id', companyId)
    .eq('status', 'completed')
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')
    .not('driver_id', 'is', null)

  if (towsError) throw towsError

  // Aggregate by driver
  const driverStats: Record<string, { tows: number; revenue: number }> = {}

  tows?.forEach(tow => {
    if (!tow.driver_id) return
    if (!driverStats[tow.driver_id]) {
      driverStats[tow.driver_id] = { tows: 0, revenue: 0 }
    }
    driverStats[tow.driver_id].tows++
    driverStats[tow.driver_id].revenue += tow.final_price || 0
  })

  // Build result
  const results: TopDriver[] = []

  drivers.forEach(driver => {
    const stats = driverStats[driver.id]
    if (!stats) return

    const userData = driver.user as unknown
    const user = Array.isArray(userData) ? userData[0] : userData
    const name = user?.full_name || 'לא ידוע'

    results.push({
      driver_id: driver.id,
      driver_name: name,
      initials: getInitials(name),
      total_tows: stats.tows,
      total_revenue: stats.revenue
    })
  })

  return results
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, limit)
}

export async function getTopCustomers(
  companyId: string,
  filters: ReportFilters,
  limit: number = 5
): Promise<TopCustomer[]> {
  const { startDate, endDate } = filters

  const { data: tows, error } = await supabase
    .from('tows')
    .select(`
      id,
      status,
      final_price,
      customer:customers(id, name, customer_type)
    `)
    .eq('company_id', companyId)
    .eq('status', 'completed')
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')
    .not('customer_id', 'is', null)

  if (error) throw error
  if (!tows) return []

  // Aggregate by customer
  const customerStats: Record<string, {
    name: string
    type: string
    tows: number
    revenue: number
  }> = {}

  tows.forEach(tow => {
    const customerData = tow.customer as unknown
    const customer = Array.isArray(customerData) ? customerData[0] : customerData
    if (!customer) return

    if (!customerStats[customer.id]) {
      customerStats[customer.id] = {
        name: customer.name,
        type: customer.customer_type,
        tows: 0,
        revenue: 0
      }
    }
    customerStats[customer.id].tows++
    customerStats[customer.id].revenue += tow.final_price || 0
  })

  return Object.entries(customerStats)
    .map(([id, stats]) => ({
      customer_id: id,
      customer_name: stats.name,
      customer_type: stats.type,
      total_tows: stats.tows,
      total_revenue: stats.revenue
    }))
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, limit)
}

// ==================== DRIVER REPORT ====================

export async function getDriverReport(
  companyId: string,
  driverId: string,
  filters: ReportFilters
): Promise<DriverReport | null> {
  const { startDate, endDate } = filters

  // Get driver info
  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select(`
      id,
      status,
      license_number,
      user:users(full_name, phone)
    `)
    .eq('id', driverId)
    .eq('company_id', companyId)
    .single()

  if (driverError || !driver) return null

  // Get current truck
  const { data: assignment } = await supabase
    .from('driver_truck_assignments')
    .select('truck:tow_trucks(plate_number)')
    .eq('driver_id', driverId)
    .eq('is_current', true)
    .single()

  // Get tows
  const { data: tows, error: towsError } = await supabase
    .from('tows')
    .select('id, status, final_price')
    .eq('company_id', companyId)
    .eq('driver_id', driverId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')

  if (towsError) throw towsError

  const userData = driver.user as unknown
  const user = Array.isArray(userData) ? userData[0] : userData
  const truckData = assignment?.truck as unknown
  const truck = Array.isArray(truckData) ? truckData[0] : truckData

  const totalTows = tows?.length || 0
  const completedTows = tows?.filter(t => t.status === 'completed').length || 0
  const cancelledTows = tows?.filter(t => t.status === 'cancelled').length || 0
  const totalRevenue = tows
    ?.filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + (t.final_price || 0), 0) || 0

  return {
    driver_id: driver.id,
    driver_name: user?.full_name || 'לא ידוע',
    phone: user?.phone || '',
    status: driver.status,
    license_number: driver.license_number,
    total_tows: totalTows,
    completed_tows: completedTows,
    cancelled_tows: cancelledTows,
    completion_rate: totalTows > 0 ? Math.round((completedTows / totalTows) * 100) : 0,
    total_revenue: totalRevenue,
    avg_revenue_per_tow: completedTows > 0 ? Math.round(totalRevenue / completedTows) : 0,
    current_truck: truck?.plate_number || null
  }
}

export async function getDriverTowsOverTime(
  companyId: string,
  driverId: string,
  filters: ReportFilters
): Promise<PeriodData[]> {
  const { startDate, endDate } = filters

  const { data: tows, error } = await supabase
    .from('tows')
    .select('id, status, final_price, created_at')
    .eq('company_id', companyId)
    .eq('driver_id', driverId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')
    .order('created_at', { ascending: true })

  if (error) throw error
  if (!tows || tows.length === 0) return []

  const grouped: Record<string, { tows: number; revenue: number }> = {}

  tows.forEach(tow => {
    const date = new Date(tow.created_at)
    const period = date.toISOString().split('T')[0]

    if (!grouped[period]) {
      grouped[period] = { tows: 0, revenue: 0 }
    }
    grouped[period].tows++
    if (tow.status === 'completed') {
      grouped[period].revenue += tow.final_price || 0
    }
  })

  return Object.entries(grouped)
    .map(([period, data]) => ({
      period,
      label: formatPeriodLabel(period, 'day'),
      tows: data.tows,
      revenue: data.revenue
    }))
    .sort((a, b) => a.period.localeCompare(b.period))
}

export async function getDriverTows(
  companyId: string,
  driverId: string,
  filters: ReportFilters
): Promise<TowListItem[]> {
  const { startDate, endDate } = filters

  const { data: tows, error } = await supabase
    .from('tows')
    .select(`
      id,
      created_at,
      status,
      final_price,
      customer:customers(name),
      vehicles:tow_vehicles(plate_number),
      legs:tow_legs(from_address, to_address)
    `)
    .eq('company_id', companyId)
    .eq('driver_id', driverId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (tows || []).map(tow => {
    const customerData = tow.customer as unknown
    const customer = Array.isArray(customerData) ? customerData[0] : customerData
    const vehicles = tow.vehicles as { plate_number: string }[] | null
    const legs = tow.legs as { from_address: string; to_address: string }[] | null

    return {
      id: tow.id,
      created_at: tow.created_at,
      status: tow.status,
      final_price: tow.final_price,
      customer_name: customer?.name,
      vehicle_plate: vehicles?.[0]?.plate_number || null,
      from_address: legs?.[0]?.from_address || null,
      to_address: legs?.[legs.length - 1]?.to_address || null
    }
  })
}

// ==================== CUSTOMER REPORT ====================

export async function getCustomerReport(
  companyId: string,
  customerId: string,
  filters: ReportFilters
): Promise<CustomerReport | null> {
  const { startDate, endDate } = filters

  // Get customer info
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, name, customer_type, phone, email')
    .eq('id', customerId)
    .single()

  if (customerError || !customer) return null

  // Get tows
  const { data: tows, error: towsError } = await supabase
    .from('tows')
    .select('id, status, final_price')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')

  if (towsError) throw towsError

  // Get invoices
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id, status, total_amount')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')

  if (invoicesError) throw invoicesError

  const totalTows = tows?.length || 0
  const totalRevenue = tows
    ?.filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + (t.final_price || 0), 0) || 0

  const totalInvoiced = invoices?.reduce((sum, i) => sum + (i.total_amount || 0), 0) || 0
  const paidAmount = invoices
    ?.filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + (i.total_amount || 0), 0) || 0
  const pendingAmount = invoices
    ?.filter(i => i.status === 'sent')
    .reduce((sum, i) => sum + (i.total_amount || 0), 0) || 0

  return {
    customer_id: customer.id,
    customer_name: customer.name,
    customer_type: customer.customer_type,
    phone: customer.phone,
    email: customer.email,
    total_tows: totalTows,
    total_revenue: totalRevenue,
    total_invoiced: totalInvoiced,
    paid_amount: paidAmount,
    pending_amount: pendingAmount,
    debt: pendingAmount
  }
}

export async function getCustomerTowsOverTime(
  companyId: string,
  customerId: string,
  filters: ReportFilters
): Promise<PeriodData[]> {
  const { startDate, endDate } = filters

  const { data: tows, error } = await supabase
    .from('tows')
    .select('id, status, final_price, created_at')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')
    .order('created_at', { ascending: true })

  if (error) throw error
  if (!tows || tows.length === 0) return []

  const grouped: Record<string, { tows: number; revenue: number }> = {}

  tows.forEach(tow => {
    const date = new Date(tow.created_at)
    const period = date.toISOString().split('T')[0]

    if (!grouped[period]) {
      grouped[period] = { tows: 0, revenue: 0 }
    }
    grouped[period].tows++
    if (tow.status === 'completed') {
      grouped[period].revenue += tow.final_price || 0
    }
  })

  return Object.entries(grouped)
    .map(([period, data]) => ({
      period,
      label: formatPeriodLabel(period, 'day'),
      tows: data.tows,
      revenue: data.revenue
    }))
    .sort((a, b) => a.period.localeCompare(b.period))
}

export async function getCustomerTows(
  companyId: string,
  customerId: string,
  filters: ReportFilters
): Promise<TowListItem[]> {
  const { startDate, endDate } = filters

  const { data: tows, error } = await supabase
    .from('tows')
    .select(`
      id,
      created_at,
      status,
      final_price,
      driver:drivers(
        user:users(full_name)
      ),
      vehicles:tow_vehicles(plate_number),
      legs:tow_legs(from_address, to_address)
    `)
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (tows || []).map(tow => {
    const driverData = tow.driver as unknown
    const driverObj = Array.isArray(driverData) ? driverData[0] : driverData
    const userData = driverObj?.user as unknown
    const user = Array.isArray(userData) ? userData[0] : userData
    const driver = driverObj ? { user } : null
    const vehicles = tow.vehicles as { plate_number: string }[] | null
    const legs = tow.legs as { from_address: string; to_address: string }[] | null

    return {
      id: tow.id,
      created_at: tow.created_at,
      status: tow.status,
      final_price: tow.final_price,
      driver_name: driver?.user?.full_name,
      vehicle_plate: vehicles?.[0]?.plate_number || null,
      from_address: legs?.[0]?.from_address || null,
      to_address: legs?.[legs.length - 1]?.to_address || null
    }
  })
}
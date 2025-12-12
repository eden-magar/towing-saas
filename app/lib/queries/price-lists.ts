import { supabase } from '../supabase'

// ==================== טיפוסים ====================

export interface VehiclePrice {
  id: string
  label: string
  price: number
}

export interface DistanceTier {
  id: string
  company_id: string
  from_km: number
  to_km: number | null
  price_per_km: number
}

export interface TruckTypeSurcharge {
  id: string
  company_id: string
  truck_type: string
  surcharge: number
}

export interface TimeSurcharge {
  id: string
  company_id: string
  name: string
  label: string
  time_description: string | null
  time_start?: string | null      // optional
  time_end?: string | null        // optional
  surcharge_percent: number
  day_type?: string               // optional
  sort_order?: number             // optional
  is_active: boolean
}

export interface LocationSurcharge {
  id: string
  company_id: string
  label: string
  surcharge_percent: number
  is_active: boolean
}

export interface ServiceSurcharge {
  id: string
  company_id: string
  label: string
  price: number
  is_active: boolean
}

export interface CustomerPriceItem {
  id: string
  customer_company_id: string
  label: string
  price: number
}

export interface CustomerWithPricing {
  id: string
  customer_id: string
  company_id: string
  discount_percent: number
  customer: {
    id: string
    name: string
    customer_type: string
  }
  price_items: CustomerPriceItem[]
}

// מעודכן לפי מאגרי משרד התחבורה + נקודת בסיס
export interface BasePriceList {
  id: string
  company_id: string
  name: string
  base_price_private: number | null      // רכב פרטי
  base_price_motorcycle: number | null   // דו גלגלי
  base_price_heavy: number | null        // רכב כבד
  base_price_machinery: number | null    // צמ"ה
  price_per_km: number | null
  minimum_price: number | null
  night_surcharge_percent: number | null
  weekend_surcharge_percent: number | null
  is_active: boolean
  // נקודת בסיס לחישוב מרחק
  base_address: string | null
  base_lat: number | null
  base_lng: number | null
}

// ==================== מחירון בסיס ====================

export async function getBasePriceList(companyId: string): Promise<BasePriceList | null> {
  const { data, error } = await supabase
    .from('price_lists')
    .select('*')
    .eq('company_id', companyId)
    .is('customer_company_id', null)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('Error fetching base price list:', error)
    throw error
  }

  return data
}

export async function upsertBasePriceList(
  companyId: string,
  data: {
    base_price_private?: number      // רכב פרטי
    base_price_motorcycle?: number   // דו גלגלי
    base_price_heavy?: number        // רכב כבד
    base_price_machinery?: number    // צמ"ה
    price_per_km?: number
    minimum_price?: number
    // נקודת בסיס
    base_address?: string | null
    base_lat?: number | null
    base_lng?: number | null
  }
) {
  // בדיקה אם קיים מחירון בסיס
  const existing = await getBasePriceList(companyId)

  if (existing) {
    const { error } = await supabase
      .from('price_lists')
      .update(data)
      .eq('id', existing.id)

    if (error) throw error
  } else {
    const { error } = await supabase
      .from('price_lists')
      .insert({
        company_id: companyId,
        name: 'מחירון בסיס',
        is_active: true,
        ...data
      })

    if (error) throw error
  }

  return true
}

// ==================== מדרגות מרחק ====================

export async function getDistanceTiers(companyId: string): Promise<DistanceTier[]> {
  const { data, error } = await supabase
    .from('distance_tiers')
    .select('*')
    .eq('company_id', companyId)
    .order('from_km', { ascending: true })

  if (error) {
    console.error('Error fetching distance tiers:', error)
    throw error
  }

  return data || []
}

export async function saveDistanceTiers(companyId: string, tiers: Omit<DistanceTier, 'id' | 'company_id'>[]) {
  // מחיקת קיימים
  await supabase.from('distance_tiers').delete().eq('company_id', companyId)

  // הוספת חדשים
  if (tiers.length > 0) {
    const { error } = await supabase
      .from('distance_tiers')
      .insert(tiers.map(t => ({ ...t, company_id: companyId })))

    if (error) throw error
  }

  return true
}

// ==================== תוספות סוג גרר ====================

export async function getTruckTypeSurcharges(companyId: string): Promise<TruckTypeSurcharge[]> {
  const { data, error } = await supabase
    .from('truck_type_surcharges')
    .select('*')
    .eq('company_id', companyId)

  if (error) {
    console.error('Error fetching truck type surcharges:', error)
    throw error
  }

  return data || []
}

export async function saveTruckTypeSurcharges(
  companyId: string, 
  surcharges: { truck_type: string; surcharge: number }[]
) {
  // מחיקת קיימים
  await supabase.from('truck_type_surcharges').delete().eq('company_id', companyId)

  // הוספת חדשים
  if (surcharges.length > 0) {
    const { error } = await supabase
      .from('truck_type_surcharges')
      .insert(surcharges.map(s => ({ ...s, company_id: companyId })))

    if (error) throw error
  }

  return true
}

// ==================== תוספות זמן ====================

export async function getTimeSurcharges(companyId: string): Promise<TimeSurcharge[]> {
  const { data, error } = await supabase
    .from('time_surcharges')
    .select('*')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching time surcharges:', error)
    throw error
  }

  return data || []
}

export async function saveTimeSurcharges(companyId: string, surcharges: Omit<TimeSurcharge, 'id' | 'company_id'>[]) {
  // מחיקת קיימים
  await supabase.from('time_surcharges').delete().eq('company_id', companyId)

  // הוספת חדשים
  if (surcharges.length > 0) {
    const { error } = await supabase
      .from('time_surcharges')
      .insert(surcharges.map(s => ({ ...s, company_id: companyId })))

    if (error) throw error
  }

  return true
}

// ==================== תוספות מיקום ====================

export async function getLocationSurcharges(companyId: string): Promise<LocationSurcharge[]> {
  const { data, error } = await supabase
    .from('location_surcharges')
    .select('*')
    .eq('company_id', companyId)

  if (error) {
    console.error('Error fetching location surcharges:', error)
    throw error
  }

  return data || []
}

export async function saveLocationSurcharges(companyId: string, surcharges: Omit<LocationSurcharge, 'id' | 'company_id'>[]) {
  // מחיקת קיימים
  await supabase.from('location_surcharges').delete().eq('company_id', companyId)

  // הוספת חדשים
  if (surcharges.length > 0) {
    const { error } = await supabase
      .from('location_surcharges')
      .insert(surcharges.map(s => ({ ...s, company_id: companyId })))

    if (error) throw error
  }

  return true
}

// ==================== שירותים נוספים ====================

export async function getServiceSurcharges(companyId: string): Promise<ServiceSurcharge[]> {
  const { data, error } = await supabase
    .from('service_surcharges')
    .select('*')
    .eq('company_id', companyId)

  if (error) {
    console.error('Error fetching service surcharges:', error)
    throw error
  }

  return data || []
}

export async function saveServiceSurcharges(companyId: string, surcharges: Omit<ServiceSurcharge, 'id' | 'company_id'>[]) {
  // מחיקת קיימים
  await supabase.from('service_surcharges').delete().eq('company_id', companyId)

  // הוספת חדשים
  if (surcharges.length > 0) {
    const { error } = await supabase
      .from('service_surcharges')
      .insert(surcharges.map(s => ({ ...s, company_id: companyId })))

    if (error) throw error
  }

  return true
}

// ==================== מחירוני לקוחות ====================

export async function getCustomersWithPricing(companyId: string): Promise<CustomerWithPricing[]> {
  const { data, error } = await supabase
    .from('customer_company')
    .select(`
      id,
      customer_id,
      company_id,
      discount_percent,
      customer:customers (
        id,
        name,
        customer_type
      )
    `)
    .eq('company_id', companyId)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching customers with pricing:', error)
    throw error
  }

  if (!data || data.length === 0) return []

  // שליפת פריטי מחיר
  const customerCompanyIds = data.map(c => c.id)
  const { data: priceItems } = await supabase
    .from('customer_price_items')
    .select('*')
    .in('customer_company_id', customerCompanyIds)

  // מיפוי
  const itemsByCustomer: Record<string, CustomerPriceItem[]> = {}
  priceItems?.forEach(item => {
    if (!itemsByCustomer[item.customer_company_id]) {
      itemsByCustomer[item.customer_company_id] = []
    }
    itemsByCustomer[item.customer_company_id].push(item)
  })

  return data.map(c => ({
    ...c,
    discount_percent: c.discount_percent || 0,
    customer: c.customer as any,
    price_items: itemsByCustomer[c.id] || []
  }))
}

export async function updateCustomerPricing(
  customerCompanyId: string,
  discountPercent: number,
  priceItems: { label: string; price: number }[]
) {
  // עדכון הנחה
  const { error: discountError } = await supabase
    .from('customer_company')
    .update({ discount_percent: discountPercent })
    .eq('id', customerCompanyId)

  if (discountError) throw discountError

  // מחיקת פריטי מחיר קיימים
  await supabase.from('customer_price_items').delete().eq('customer_company_id', customerCompanyId)

  // הוספת חדשים
  if (priceItems.length > 0) {
    const { error } = await supabase
      .from('customer_price_items')
      .insert(priceItems.map(item => ({
        customer_company_id: customerCompanyId,
        label: item.label,
        price: item.price
      })))

    if (error) throw error
  }

  return true
}

// ==================== מחירון כללי (תעריפים קבועים) ====================

export interface FixedPriceItem {
  id: string
  company_id: string
  label: string
  description: string | null
  price: number
  is_active: boolean
  sort_order: number
}

export async function getFixedPriceItems(companyId: string): Promise<FixedPriceItem[]> {
  const { data, error } = await supabase
    .from('fixed_price_items')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching fixed price items:', error)
    throw error
  }

  return data || []
}

export async function saveFixedPriceItems(
  companyId: string, 
  items: { label: string; description?: string; price: number; sort_order?: number }[]
) {
  // מחיקת קיימים
  await supabase.from('fixed_price_items').delete().eq('company_id', companyId)

  // הוספת חדשים
  if (items.length > 0) {
    const { error } = await supabase
      .from('fixed_price_items')
      .insert(items.map((item, index) => ({
        company_id: companyId,
        label: item.label,
        description: item.description || null,
        price: item.price,
        sort_order: item.sort_order ?? index,
        is_active: true
      })))

    if (error) throw error
  }

  return true
}

// ==================== שליפת כל המחירון ====================

export async function getFullPriceList(companyId: string) {
  const [
    basePriceList,
    distanceTiers,
    truckTypeSurcharges,
    timeSurcharges,
    locationSurcharges,
    serviceSurcharges,
    customersWithPricing,
    fixedPriceItems
  ] = await Promise.all([
    getBasePriceList(companyId),
    getDistanceTiers(companyId),
    getTruckTypeSurcharges(companyId),
    getTimeSurcharges(companyId),
    getLocationSurcharges(companyId),
    getServiceSurcharges(companyId),
    getCustomersWithPricing(companyId),
    getFixedPriceItems(companyId)
  ])

  return {
    basePriceList,
    distanceTiers,
    truckTypeSurcharges,
    timeSurcharges,
    locationSurcharges,
    serviceSurcharges,
    customersWithPricing,
    fixedPriceItems
  }
}

// ==================== פונקציות עזר לחישוב תוספות זמן ====================

/**
 * בודק אם שעה נתונה נופלת בטווח זמן
 * תומך בטווחים שעוברים חצות (למשל 19:00 - 07:00)
 */
export function isTimeInRange(time: string, startTime: string | null, endTime: string | null): boolean {
  if (!startTime || !endTime) return false
  
  const [timeHours, timeMinutes] = time.split(':').map(Number)
  const [startHours, startMinutes] = startTime.split(':').map(Number)
  const [endHours, endMinutes] = endTime.split(':').map(Number)
  
  const timeValue = timeHours * 60 + timeMinutes
  const startValue = startHours * 60 + startMinutes
  const endValue = endHours * 60 + endMinutes
  
  // אם הטווח עובר חצות (למשל 19:00 - 07:00)
  if (startValue > endValue) {
    return timeValue >= startValue || timeValue < endValue
  }
  
  // טווח רגיל
  return timeValue >= startValue && timeValue < endValue
}

/**
 * בודק אם תאריך הוא יום שבת
 */
export function isSaturday(date: string): boolean {
  const d = new Date(date)
  return d.getDay() === 6
}

/**
 * בודק אם תאריך הוא ערב שבת (יום שישי)
 */
export function isFriday(date: string): boolean {
  const d = new Date(date)
  return d.getDay() === 5
}

/**
 * מחשב אילו תוספות זמן חלות על זמן ותאריך נתונים
 */
export function getActiveTimeSurcharges(
  timeSurcharges: TimeSurcharge[],
  time: string,
  date: string,
  isHoliday: boolean = false
): TimeSurcharge[] {
  return timeSurcharges.filter(surcharge => {
    if (!surcharge.is_active) return false
    
    // בדיקת סוג היום
    switch (surcharge.day_type) {
      case 'saturday':
        // תוספת שבת - רק בשבת
        if (!isSaturday(date)) return false
        break
      case 'friday':
        // תוספת ערב שבת - רק בשישי
        if (!isFriday(date)) return false
        break
      case 'holiday':
        // תוספת חג - רק אם סומן כחג
        if (!isHoliday) return false
        break
      case 'all':
      default:
        // תוספת רגילה - בודקים שעות
        break
    }
    
    // בדיקת טווח שעות (אם מוגדר)
    if (surcharge.time_start && surcharge.time_end) {
      return isTimeInRange(time, surcharge.time_start, surcharge.time_end)
    }
    
    // אם אין טווח שעות, התוספת תמיד חלה (לסוג היום הנכון)
    return true
  })
}

/**
 * מחשב את סכום אחוזי התוספות הפעילות
 */
export function calculateTimeSurchargePercent(
  timeSurcharges: TimeSurcharge[],
  time: string,
  date: string,
  isHoliday: boolean = false
): number {
  const activeSurcharges = getActiveTimeSurcharges(timeSurcharges, time, date, isHoliday)
  
  // מחזירים את הערך הגבוה ביותר (לא מצטבר)
  if (activeSurcharges.length === 0) return 0
  
  return Math.max(...activeSurcharges.map(s => s.surcharge_percent))
}
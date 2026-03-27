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
  price_type: 'fixed' | 'per_unit' | 'manual'
  unit_label?: string
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
  price_list: BasePriceList | null
  customer_time_surcharges: TimeSurcharge[]
  customer_location_surcharges: LocationSurcharge[]
  customer_service_surcharges: ServiceSurcharge[]
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
    .is('price_list_id', null)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

export async function saveTimeSurcharges(companyId: string, surcharges: Omit<TimeSurcharge, 'id' | 'company_id'>[]) {
  await supabase.from('time_surcharges').delete().eq('company_id', companyId).is('price_list_id', null)
  if (surcharges.length > 0) {
    const { error } = await supabase
      .from('time_surcharges')
      .insert(surcharges.map(s => ({ ...s, company_id: companyId, price_list_id: null })))
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
    .is('price_list_id', null)
  if (error) throw error
  return data || []
}

export async function saveLocationSurcharges(companyId: string, surcharges: Omit<LocationSurcharge, 'id' | 'company_id'>[]) {
  await supabase.from('location_surcharges').delete().eq('company_id', companyId).is('price_list_id', null)
  if (surcharges.length > 0) {
    const { error } = await supabase
      .from('location_surcharges')
      .insert(surcharges.map(s => ({ ...s, company_id: companyId, price_list_id: null })))
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
    .is('price_list_id', null)
  if (error) throw error
  return data || []
}

export async function saveServiceSurcharges(companyId: string, surcharges: Omit<ServiceSurcharge, 'id' | 'company_id'>[]) {
  await supabase.from('service_surcharges').delete().eq('company_id', companyId).is('price_list_id', null)
  if (surcharges.length > 0) {
    const { error } = await supabase
      .from('service_surcharges')
      .insert(surcharges.map(s => ({ ...s, company_id: companyId, price_list_id: null })))
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

  // שליפת מחירוני לקוח (price_lists) - מחירון מלא עם בסיס, מרחק וכו'
  const { data: priceLists } = await supabase
    .from('price_lists')
    .select('*')
    .in('customer_company_id', customerCompanyIds)
    .eq('is_active', true)

  const priceListByCustomer: Record<string, BasePriceList> = {}
  priceLists?.forEach(pl => {
    if (pl.customer_company_id) {
      priceListByCustomer[pl.customer_company_id] = pl as BasePriceList
    }
  })

  // שליפת תוספות לקוח
  const priceListIds = Object.values(priceListByCustomer).map(pl => pl.id)
  const customerSurchargesMap: Record<string, {
    time: TimeSurcharge[]
    location: LocationSurcharge[]
    service: ServiceSurcharge[]
  }> = {}

  if (priceListIds.length > 0) {
    const [timeSurcharges, locationSurcharges, serviceSurcharges] = await Promise.all([
      supabase.from('time_surcharges').select('*').in('price_list_id', priceListIds),
      supabase.from('location_surcharges').select('*').in('price_list_id', priceListIds),
      supabase.from('service_surcharges').select('*').in('price_list_id', priceListIds),
    ])

    Object.entries(priceListByCustomer).forEach(([customerCompanyId, pl]) => {
      customerSurchargesMap[customerCompanyId] = {
        time: (timeSurcharges.data || []).filter(s => s.price_list_id === pl.id),
        location: (locationSurcharges.data || []).filter(s => s.price_list_id === pl.id),
        service: (serviceSurcharges.data || []).filter(s => s.price_list_id === pl.id),
      }
    })
  }

  return data.map(c => ({
    ...c,
    discount_percent: c.discount_percent || 0,
    customer: c.customer as any,
    price_items: itemsByCustomer[c.id] || [],
    price_list: priceListByCustomer[c.id] || null,
    customer_time_surcharges: customerSurchargesMap[c.id]?.time || [],
    customer_location_surcharges: customerSurchargesMap[c.id]?.location || [],
    customer_service_surcharges: customerSurchargesMap[c.id]?.service || [],
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
 * תוספות ערב/לילה (יום ראשון–חמישי, וגם יום שישי כשלא חלה תוספת שישי ספציפית):
 * day_type שאינו שבת/שישי/חג, עם טווח שעות.
 */
function getWeekdayEveningNightSurcharges(
  timeSurcharges: TimeSurcharge[],
  time: string
): TimeSurcharge[] {
  return timeSurcharges.filter(surcharge => {
    if (!surcharge.is_active) return false

    if (surcharge.day_type === 'saturday' || surcharge.day_type === 'friday' || surcharge.day_type === 'holiday') {
      return false
    }

    if (surcharge.time_start && surcharge.time_end) {
      return isTimeInRange(time, surcharge.time_start, surcharge.time_end)
    }

    return false
  })
}

/**
 * מחשב אילו תוספות זמן חלות על זמן ותאריך נתונים
 * הלוגיקה:
 * - שבת: תוספת שבת בלבד (ללא בדיקת שעות)
 * - חג: תוספת חג בלבד (ללא בדיקת שעות)
 * - שישי: אם השעה >= time_start → תוספת שישי בלבד; אחרת תוספות ערב/לילה כמו בראשון–חמישי
 * - ראשון-חמישי: בדיקת תוספות ערב/לילה לפי שעות
 */
export function getActiveTimeSurcharges(
  timeSurcharges: TimeSurcharge[],
  time: string,
  date: string,
  isHoliday: boolean = false
): TimeSurcharge[] {
  const d = new Date(date)
  const dayOfWeek = d.getDay() // 0 = Sunday, 6 = Saturday
  
  const isSaturdayDay = dayOfWeek === 6
  const isFridayDay = dayOfWeek === 5
  
  // חג - רק תוספת חג
  if (isHoliday) {
    return timeSurcharges.filter(s => s.is_active && s.day_type === 'holiday')
  }
  
  // שבת - רק תוספת שבת (ללא בדיקת שעות)
  if (isSaturdayDay) {
    return timeSurcharges.filter(s => s.is_active && s.day_type === 'saturday')
  }
  
  // שישי - תוספת שישי לפי שעה; אם לא חלה — תוספות ערב/לילה כמו בראשון–חמישי
  if (isFridayDay) {
    const fridaySurcharge = timeSurcharges.find(s => s.is_active && s.day_type === 'friday')

    if (fridaySurcharge) {
      if (fridaySurcharge.time_start) {
        const [timeHours, timeMinutes] = time.split(':').map(Number)
        const [startHours, startMinutes] = fridaySurcharge.time_start.split(':').map(Number)

        const timeValue = timeHours * 60 + timeMinutes
        const startValue = startHours * 60 + startMinutes

        if (timeValue >= startValue) {
          return [fridaySurcharge]
        }
      } else {
        return [fridaySurcharge]
      }
    }

    return getWeekdayEveningNightSurcharges(timeSurcharges, time)
  }

  // ראשון-חמישי - בדיקת תוספות ערב/לילה לפי שעות
  return getWeekdayEveningNightSurcharges(timeSurcharges, time)
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

// ==================== מחירון לקוח מלא ====================

export async function getCustomerPriceList(customerCompanyId: string): Promise<BasePriceList | null> {
  const { data, error } = await supabase
    .from('price_lists')
    .select('*')
    .eq('customer_company_id', customerCompanyId)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return data || null
}

export async function upsertCustomerPriceList(
  companyId: string,
  customerCompanyId: string,
  data: {
    base_price_private?: number
    base_price_motorcycle?: number
    base_price_heavy?: number
    base_price_machinery?: number
    price_per_km?: number
    minimum_price?: number
  }
): Promise<string> {
  const existing = await getCustomerPriceList(customerCompanyId)
  if (existing) {
    const { error } = await supabase
      .from('price_lists')
      .update(data)
      .eq('id', existing.id)
    if (error) throw error
    return existing.id
  } else {
    const { data: newList, error } = await supabase
      .from('price_lists')
      .insert({
        company_id: companyId,
        customer_company_id: customerCompanyId,
        name: 'מחירון לקוח',
        is_active: true,
        ...data
      })
      .select()
      .single()
    if (error) throw error
    return newList.id
  }
}

export async function getCustomerSurcharges(priceListId: string) {
  const [time, location, service] = await Promise.all([
    supabase.from('time_surcharges').select('*').eq('price_list_id', priceListId).order('sort_order'),
    supabase.from('location_surcharges').select('*').eq('price_list_id', priceListId),
    supabase.from('service_surcharges').select('*').eq('price_list_id', priceListId),
  ])
  return {
    timeSurcharges: time.data || [],
    locationSurcharges: location.data || [],
    serviceSurcharges: service.data || [],
  }
}

export async function saveCustomerSurcharges(
  priceListId: string,
  companyId: string,
  surcharges: {
    time: Omit<TimeSurcharge, 'id' | 'company_id'>[]
    location: Omit<LocationSurcharge, 'id' | 'company_id'>[]
    service: Omit<ServiceSurcharge, 'id' | 'company_id'>[]
  }
) {
  await supabase.from('time_surcharges').delete().eq('price_list_id', priceListId)
  await supabase.from('location_surcharges').delete().eq('price_list_id', priceListId)
  await supabase.from('service_surcharges').delete().eq('price_list_id', priceListId)

  if (surcharges.time.length > 0) {
    await supabase.from('time_surcharges').insert(
      surcharges.time.map(s => ({ ...s, company_id: companyId, price_list_id: priceListId }))
    )
  }
  if (surcharges.location.length > 0) {
    await supabase.from('location_surcharges').insert(
      surcharges.location.map(s => ({ ...s, company_id: companyId, price_list_id: priceListId }))
    )
  }
  if (surcharges.service.length > 0) {
    await supabase.from('service_surcharges').insert(
      surcharges.service.map(s => ({ ...s, company_id: companyId, price_list_id: priceListId }))
    )
  }
  return true
}

export async function deleteCustomerPriceList(customerCompanyId: string) {
  const existing = await getCustomerPriceList(customerCompanyId)
  if (!existing) return true
  const { error } = await supabase
    .from('price_lists')
    .delete()
    .eq('id', existing.id)
  if (error) throw error
  return true
}
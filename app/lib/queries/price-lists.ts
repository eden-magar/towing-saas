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

export interface WeightBracket {
  id: string
  company_id: string
  min_kg: number
  max_kg: number | null
  base_price: number
  sort_order: number
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
  /** When true, line is added after VAT and is not taxed or customer-discounted. */
  is_vat_exempt?: boolean
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
  price_per_km_private: number | null
  price_per_km_motorcycle: number | null
  price_per_km_heavy: number | null
  price_per_km_machinery: number | null
  price_per_km_deadhead: number | null   // נסיעת סרק (deadhead return)
  minimum_price: number | null
  night_surcharge_percent: number | null
  weekend_surcharge_percent: number | null
  is_active: boolean
  customer_company_id?: string | null
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
    price_per_km_private?: number | null
    price_per_km_motorcycle?: number | null
    price_per_km_heavy?: number | null
    price_per_km_machinery?: number | null
    price_per_km_deadhead?: number | null
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

// ==================== מדרגות משקל (רכב מסחרי) ====================

export async function getWeightBrackets(companyId: string): Promise<WeightBracket[]> {
  const { data, error } = await supabase
    .from('weight_base_brackets')
    .select('*')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching weight brackets:', error)
    throw error
  }

  return data || []
}

export async function saveWeightBrackets(companyId: string, brackets: Omit<WeightBracket, 'id' | 'company_id'>[]) {
  // מחיקת קיימים
  await supabase.from('weight_base_brackets').delete().eq('company_id', companyId)

  // הוספת חדשים
  if (brackets.length > 0) {
    const { error } = await supabase
      .from('weight_base_brackets')
      .insert(brackets.map(b => ({ ...b, company_id: companyId })))

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
  return (data || []).map((s) => ({
    ...s,
    is_vat_exempt: s.is_vat_exempt === true,
  }))
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

const CUSTOMER_COMPANY_ID_CHUNK_SIZE = 50

const CUSTOMER_PRICING_SELECT = `
  id,
  customer_id,
  company_id,
  discount_percent,
  customer:customers (
    id,
    name,
    customer_type
  )
`

async function collectCustomerCompanyIdsWithPricing(companyId: string): Promise<string[]> {
  const [discountRes, priceListRes, priceItemRes] = await Promise.all([
    supabase
      .from('customer_company')
      .select('id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .gt('discount_percent', 0),
    supabase
      .from('price_lists')
      .select('customer_company_id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .not('customer_company_id', 'is', null),
    supabase
      .from('customer_price_items')
      .select('customer_company_id, customer_company!inner(company_id, is_active)')
      .eq('customer_company.company_id', companyId)
      .eq('customer_company.is_active', true),
  ])

  if (discountRes.error) throw discountRes.error
  if (priceListRes.error) throw priceListRes.error
  if (priceItemRes.error) throw priceItemRes.error

  const ids = new Set<string>()
  discountRes.data?.forEach(row => ids.add(row.id))
  priceListRes.data?.forEach(row => {
    if (row.customer_company_id) ids.add(row.customer_company_id)
  })
  priceItemRes.data?.forEach(row => ids.add(row.customer_company_id))
  return [...ids]
}

/** Customer IDs that have custom pricing (badges in tow form — no full price list load). */
export async function getCustomerIdsWithPersonalPricing(companyId: string): Promise<string[]> {
  const junctionIds = await collectCustomerCompanyIdsWithPricing(companyId)
  if (junctionIds.length === 0) return []

  const customerIds = new Set<string>()

  for (let i = 0; i < junctionIds.length; i += CUSTOMER_COMPANY_ID_CHUNK_SIZE) {
    const chunk = junctionIds.slice(i, i + CUSTOMER_COMPANY_ID_CHUNK_SIZE)
    const { data, error } = await supabase
      .from('customer_company')
      .select('customer_id')
      .in('id', chunk)

    if (error) throw error
    data?.forEach((row) => customerIds.add(row.customer_id))
  }

  return [...customerIds]
}

async function fetchPriceListsAndItemsForCompanyIds(customerCompanyIds: string[]): Promise<{
  priceItems: CustomerPriceItem[]
  priceLists: BasePriceList[]
}> {
  if (customerCompanyIds.length === 0) {
    return { priceItems: [], priceLists: [] }
  }

  if (customerCompanyIds.length === 1) {
    const customerCompanyId = customerCompanyIds[0]
    const [{ data: priceItems, error: itemsError }, { data: priceLists, error: listsError }] =
      await Promise.all([
        supabase
          .from('customer_price_items')
          .select('*')
          .eq('customer_company_id', customerCompanyId),
        supabase
          .from('price_lists')
          .select('*')
          .eq('customer_company_id', customerCompanyId)
          .eq('is_active', true),
      ])

    if (itemsError) throw itemsError
    if (listsError) throw listsError

    return {
      priceItems: priceItems ?? [],
      priceLists: (priceLists ?? []) as BasePriceList[],
    }
  }

  const priceItems: CustomerPriceItem[] = []
  const priceLists: BasePriceList[] = []

  for (let i = 0; i < customerCompanyIds.length; i += CUSTOMER_COMPANY_ID_CHUNK_SIZE) {
    const chunk = customerCompanyIds.slice(i, i + CUSTOMER_COMPANY_ID_CHUNK_SIZE)
    const [{ data: chunkItems, error: itemsError }, { data: chunkLists, error: listsError }] =
      await Promise.all([
        supabase.from('customer_price_items').select('*').in('customer_company_id', chunk),
        supabase
          .from('price_lists')
          .select('*')
          .in('customer_company_id', chunk)
          .eq('is_active', true),
      ])

    if (itemsError) throw itemsError
    if (listsError) throw listsError

    priceItems.push(...(chunkItems ?? []))
    priceLists.push(...((chunkLists ?? []) as BasePriceList[]))
  }

  return { priceItems, priceLists }
}

function indexPriceItemsByCustomer(
  priceItems: CustomerPriceItem[]
): Record<string, CustomerPriceItem[]> {
  const itemsByCustomer: Record<string, CustomerPriceItem[]> = {}
  priceItems.forEach((item) => {
    if (!itemsByCustomer[item.customer_company_id]) {
      itemsByCustomer[item.customer_company_id] = []
    }
    itemsByCustomer[item.customer_company_id].push(item)
  })
  return itemsByCustomer
}

function indexPriceListsByCustomer(priceLists: BasePriceList[]): Record<string, BasePriceList> {
  const priceListByCustomer: Record<string, BasePriceList> = {}
  priceLists.forEach((pl) => {
    if (pl.customer_company_id) {
      priceListByCustomer[pl.customer_company_id] = pl
    }
  })
  return priceListByCustomer
}

async function loadCustomerSurchargesMap(
  priceListByCustomer: Record<string, BasePriceList>
): Promise<
  Record<string, { time: TimeSurcharge[]; location: LocationSurcharge[]; service: ServiceSurcharge[] }>
> {
  const customerSurchargesMap: Record<
    string,
    { time: TimeSurcharge[]; location: LocationSurcharge[]; service: ServiceSurcharge[] }
  > = {}

  const priceListIds = Object.values(priceListByCustomer).map((pl) => pl.id)
  if (priceListIds.length === 0) return customerSurchargesMap

  const timeRows: TimeSurcharge[] = []
  const locationRows: LocationSurcharge[] = []
  const serviceRows: ServiceSurcharge[] = []

  for (let i = 0; i < priceListIds.length; i += CUSTOMER_COMPANY_ID_CHUNK_SIZE) {
    const chunk = priceListIds.slice(i, i + CUSTOMER_COMPANY_ID_CHUNK_SIZE)
    const [timeSurcharges, locationSurcharges, serviceSurcharges] = await Promise.all([
      supabase.from('time_surcharges').select('*').in('price_list_id', chunk),
      supabase.from('location_surcharges').select('*').in('price_list_id', chunk),
      supabase.from('service_surcharges').select('*').in('price_list_id', chunk),
    ])

    if (timeSurcharges.error) throw timeSurcharges.error
    if (locationSurcharges.error) throw locationSurcharges.error
    if (serviceSurcharges.error) throw serviceSurcharges.error

    timeRows.push(...((timeSurcharges.data ?? []) as TimeSurcharge[]))
    locationRows.push(...((locationSurcharges.data ?? []) as LocationSurcharge[]))
    serviceRows.push(...((serviceSurcharges.data ?? []) as ServiceSurcharge[]))
  }

  Object.entries(priceListByCustomer).forEach(([customerCompanyId, pl]) => {
    customerSurchargesMap[customerCompanyId] = {
      time: timeRows.filter((s) => (s as { price_list_id?: string }).price_list_id === pl.id),
      location: locationRows.filter((s) => (s as { price_list_id?: string }).price_list_id === pl.id),
      service: serviceRows.filter((s) => (s as { price_list_id?: string }).price_list_id === pl.id),
    }
  })

  return customerSurchargesMap
}

async function fetchCustomerCompanyPricingRows(
  companyId: string,
  customerCompanyIds: string[]
): Promise<Awaited<ReturnType<typeof fetchCustomerPricingBase>>['data']> {
  if (customerCompanyIds.length === 0) return []

  if (customerCompanyIds.length === 1) {
    const { data, error } = await supabase
      .from('customer_company')
      .select(CUSTOMER_PRICING_SELECT)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .eq('id', customerCompanyIds[0])

    if (error) throw error
    return data ?? []
  }

  const all: Awaited<ReturnType<typeof fetchCustomerPricingBase>>['data'] = []

  for (let i = 0; i < customerCompanyIds.length; i += CUSTOMER_COMPANY_ID_CHUNK_SIZE) {
    const chunk = customerCompanyIds.slice(i, i + CUSTOMER_COMPANY_ID_CHUNK_SIZE)
    const { data, error } = await supabase
      .from('customer_company')
      .select(CUSTOMER_PRICING_SELECT)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .in('id', chunk)

    if (error) throw error
    if (data?.length) all.push(...data)
  }

  return all
}

async function fetchCustomerPricingForCompanyIds(companyId: string, customerCompanyIds: string[]) {
  if (customerCompanyIds.length === 0) {
    return {
      data: [] as Awaited<ReturnType<typeof fetchCustomerPricingBase>>['data'],
      itemsByCustomer: {} as Record<string, CustomerPriceItem[]>,
      priceListByCustomer: {} as Record<string, BasePriceList>,
    }
  }

  const data = await fetchCustomerCompanyPricingRows(companyId, customerCompanyIds)

  if (data.length === 0) {
    return {
      data: [] as typeof data,
      itemsByCustomer: {} as Record<string, CustomerPriceItem[]>,
      priceListByCustomer: {} as Record<string, BasePriceList>,
    }
  }

  const ids = data.map((c) => c.id)
  const { priceItems, priceLists } = await fetchPriceListsAndItemsForCompanyIds(ids)

  return {
    data,
    itemsByCustomer: indexPriceItemsByCustomer(priceItems),
    priceListByCustomer: indexPriceListsByCustomer(priceLists),
  }
}

async function fetchCustomerPricingBase(companyId: string) {
  const { data, error } = await supabase
    .from('customer_company')
    .select(CUSTOMER_PRICING_SELECT)
    .eq('company_id', companyId)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching customers with pricing:', error)
    throw error
  }

  if (!data || data.length === 0) {
    return { data: [] as typeof data, itemsByCustomer: {} as Record<string, CustomerPriceItem[]>, priceListByCustomer: {} as Record<string, BasePriceList> }
  }

  const customerCompanyIds = data.map((c) => c.id)
  const { priceItems, priceLists } = await fetchPriceListsAndItemsForCompanyIds(customerCompanyIds)

  return {
    data,
    itemsByCustomer: indexPriceItemsByCustomer(priceItems),
    priceListByCustomer: indexPriceListsByCustomer(priceLists),
  }
}

function mapCustomerPricingRows(
  data: Awaited<ReturnType<typeof fetchCustomerPricingBase>>['data'],
  itemsByCustomer: Record<string, CustomerPriceItem[]>,
  priceListByCustomer: Record<string, BasePriceList>,
  customerSurchargesMap: Record<string, { time: TimeSurcharge[]; location: LocationSurcharge[]; service: ServiceSurcharge[] }>
): CustomerWithPricing[] {
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

/** Steps 1–3 only (no surcharge queries). For price-lists page list load. */
export async function getCustomersWithPricingLite(companyId: string): Promise<CustomerWithPricing[]> {
  const { data, itemsByCustomer, priceListByCustomer } = await fetchCustomerPricingBase(companyId)
  if (data.length === 0) return []
  return mapCustomerPricingRows(data, itemsByCustomer, priceListByCustomer, {})
}

/** Only customers with custom pricing (price_list, price_items, or discount). For price-lists page. */
export async function getCustomersWithPricingFiltered(companyId: string): Promise<CustomerWithPricing[]> {
  const customerCompanyIds = await collectCustomerCompanyIdsWithPricing(companyId)
  const { data, itemsByCustomer, priceListByCustomer } = await fetchCustomerPricingForCompanyIds(
    companyId,
    customerCompanyIds
  )
  if (data.length === 0) return []
  return mapCustomerPricingRows(data, itemsByCustomer, priceListByCustomer, {})
}

/** Load pricing for one customer (tow form, edit, close context). */
export async function getCustomerPricingByCustomerId(
  companyId: string,
  customerId: string
): Promise<CustomerWithPricing | null> {
  const { data: junction, error } = await supabase
    .from('customer_company')
    .select('id')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('Error resolving customer_company for pricing:', error)
    throw error
  }
  if (!junction) return null

  return getCustomerPricingByCompanyId(companyId, junction.id)
}

/** Load pricing summary for one customer (search → modal). */
export async function getCustomerPricingByCompanyId(
  companyId: string,
  customerCompanyId: string
): Promise<CustomerWithPricing | null> {
  const { data, itemsByCustomer, priceListByCustomer } = await fetchCustomerPricingForCompanyIds(
    companyId,
    [customerCompanyId]
  )
  if (data.length === 0) return null
  const customerSurchargesMap = await loadCustomerSurchargesMap(priceListByCustomer)
  return mapCustomerPricingRows(data, itemsByCustomer, priceListByCustomer, customerSurchargesMap)[0]
}

export interface CustomerPricingSearchHit {
  customer_id: string
  customer_company_id: string
  name: string
  customer_type: string
  phone: string | null
  discount_percent: number
}

/** Search active company customers by name or phone (price-lists page). */
export async function searchCustomersForPricing(
  companyId: string,
  searchText: string,
  limit = 20
): Promise<CustomerPricingSearchHit[]> {
  const q = searchText.trim()
  if (q.length < 2) return []

  const pattern = `%${q}%`
  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('id, name, customer_type, phone')
    .or(`name.ilike.${pattern},phone.ilike.${pattern}`)
    .limit(limit)

  if (customersError) {
    console.error('Error searching customers for pricing:', customersError)
    throw customersError
  }
  if (!customers?.length) return []

  const customerIds = customers.map(c => c.id)
  const { data: companyRows, error: companyError } = await supabase
    .from('customer_company')
    .select('id, customer_id, discount_percent')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .in('customer_id', customerIds)

  if (companyError) {
    console.error('Error fetching customer_company for pricing search:', companyError)
    throw companyError
  }
  if (!companyRows?.length) return []

  const customerById = new Map(customers.map(c => [c.id, c]))
  return companyRows
    .map(row => {
      const customer = customerById.get(row.customer_id)
      if (!customer) return null
      return {
        customer_id: row.customer_id,
        customer_company_id: row.id,
        name: customer.name,
        customer_type: customer.customer_type,
        phone: customer.phone,
        discount_percent: row.discount_percent || 0,
      }
    })
    .filter((row): row is CustomerPricingSearchHit => row !== null)
}

export async function getCustomersWithPricing(companyId: string): Promise<CustomerWithPricing[]> {
  const { data, itemsByCustomer, priceListByCustomer } = await fetchCustomerPricingBase(companyId)
  if (data.length === 0) return []

  const customerSurchargesMap = await loadCustomerSurchargesMap(priceListByCustomer)
  return mapCustomerPricingRows(data, itemsByCustomer, priceListByCustomer, customerSurchargesMap)
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
    getCustomersWithPricingFiltered(companyId),
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
 * Customer surcharge catalog OVERRIDES the company catalog when non-empty.
 * If the customer has no rows of that kind, the company catalog applies.
 * (Having a custom price_lists / km rate must not wipe all surcharges.)
 */
export function resolveSurchargeCatalog<T>(
  customerCatalog: T[] | null | undefined,
  companyCatalog: T[] | null | undefined,
): T[] {
  return (customerCatalog?.length ?? 0) > 0
    ? customerCatalog!
    : (companyCatalog ?? [])
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
    base_price_private?: number | null
    base_price_motorcycle?: number | null
    base_price_heavy?: number | null
    base_price_machinery?: number | null
    price_per_km?: number | null
    price_per_km_private?: number | null
    price_per_km_motorcycle?: number | null
    price_per_km_heavy?: number | null
    price_per_km_machinery?: number | null
    price_per_km_deadhead?: number | null
    minimum_price?: number | null
  }
): Promise<string> {
  const row = {
    base_price_private: data.base_price_private ?? null,
    base_price_motorcycle: data.base_price_motorcycle ?? null,
    base_price_heavy: data.base_price_heavy ?? null,
    base_price_machinery: data.base_price_machinery ?? null,
    price_per_km: data.price_per_km ?? null,
    price_per_km_private: data.price_per_km_private ?? null,
    price_per_km_motorcycle: data.price_per_km_motorcycle ?? null,
    price_per_km_heavy: data.price_per_km_heavy ?? null,
    price_per_km_machinery: data.price_per_km_machinery ?? null,
    price_per_km_deadhead: data.price_per_km_deadhead ?? null,
    minimum_price: data.minimum_price ?? null,
  }

  const existing = await getCustomerPriceList(customerCompanyId)
  if (existing) {
    const { error } = await supabase
      .from('price_lists')
      .update(row)
      .eq('id', existing.id)
    if (error) throw error
    return existing.id
  }

  const { data: newList, error } = await supabase
    .from('price_lists')
    .insert({
      company_id: companyId,
      customer_company_id: customerCompanyId,
      name: 'מחירון לקוח',
      is_active: true,
      ...row,
    })
    .select()
    .single()
  if (error) throw error
  return newList.id
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
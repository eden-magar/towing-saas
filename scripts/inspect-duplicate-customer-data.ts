// scripts/inspect-duplicate-customer-data.ts
// Read-only: per-record manual data counts for duplicate ח.פ groups
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const IMPORT_TARGET_COMPANY_ID = process.env.IMPORT_TARGET_COMPANY_ID

const PAGE_SIZE = 1000
const IN_CHUNK_SIZE = 500

interface CustomerCompanyJunction {
  id: string
  company_id: string
}

interface CustomerRow {
  id: string
  name: string
  id_number: string | null
  caspit_contact_id: string | null
  portal_settings: Record<string, unknown> | null
  customer_company: CustomerCompanyJunction | CustomerCompanyJunction[]
}

interface LoadedCustomer {
  id: string
  name: string
  id_number: string | null
  caspit_contact_id: string | null
  portal_settings: Record<string, unknown> | null
  customer_company_id: string
  normalized_id_number: string
}

interface InspectRecord {
  id_number: string
  customer_id: string
  name: string
  caspit_contact_id: 'yes' | 'no'
  contacts: number
  orderers: number
  tows: number
  events: number
  invoices: number
  stored_veh: number
  price_lists: number
  customer_users: number
  price_items: number
  portal_settings: number
  manual_score: number
}

function validateEnv(): void {
  const missing: string[] = []
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!SUPABASE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!IMPORT_TARGET_COMPANY_ID) missing.push('IMPORT_TARGET_COMPANY_ID')

  if (missing.length > 0) {
    console.error('Missing required environment variables in .env.local:')
    for (const key of missing) {
      console.error(`  - ${key}`)
    }
    process.exit(1)
  }
}

/** Trim + strip leading zeros (same as backfill / analyze scripts). */
function normalizeIdNumber(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/^0+/, '')
  return normalized || null
}

function junctionId(row: CustomerRow): string {
  const junction = row.customer_company
  if (Array.isArray(junction)) {
    const id = junction[0]?.id
    if (!id) throw new Error(`Customer ${row.id} missing customer_company junction`)
    return id
  }
  if (!junction?.id) {
    throw new Error(`Customer ${row.id} missing customer_company junction`)
  }
  return junction.id
}

/** 1 if portal_settings is non-null and not an empty object, else 0. */
function portalSettingsManualFlag(value: unknown): number {
  if (value == null) return 0
  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value as object).length > 0 ? 1 : 0
  }
  return 0
}

async function loadCompanyCustomers(
  supabase: SupabaseClient,
  companyId: string
): Promise<LoadedCustomer[]> {
  const all: LoadedCustomer[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('customers')
      .select(
        'id, name, id_number, caspit_contact_id, portal_settings, customer_company!inner(id, company_id)'
      )
      .eq('customer_company.company_id', companyId)
      .order('name', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      throw new Error(`Failed to load customers: ${error.message}`)
    }

    const rows = (data ?? []) as CustomerRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const normalized = normalizeIdNumber(row.id_number)
      if (!normalized) continue

      all.push({
        id: row.id,
        name: row.name?.trim() || '',
        id_number: row.id_number?.trim() || null,
        caspit_contact_id: row.caspit_contact_id,
        portal_settings: row.portal_settings ?? null,
        customer_company_id: junctionId(row),
        normalized_id_number: normalized,
      })
    }

    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return all
}

async function countRowsByForeignKey(
  supabase: SupabaseClient,
  table: string,
  fkColumn: string,
  fkValues: string[],
  companyId?: string
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (fkValues.length === 0) return counts

  const valueSet = new Set(fkValues)

  for (let i = 0; i < fkValues.length; i += IN_CHUNK_SIZE) {
    const chunk = fkValues.slice(i, i + IN_CHUNK_SIZE)
    let from = 0

    while (true) {
      let query = supabase.from(table).select(fkColumn).in(fkColumn, chunk)
      if (companyId) {
        query = query.eq('company_id', companyId)
      }

      const { data, error } = await query.range(from, from + PAGE_SIZE - 1)

      if (error) {
        throw new Error(`Failed counting ${table}.${fkColumn}: ${error.message}`)
      }

      const rows = data ?? []
      if (rows.length === 0) break

      for (const row of rows) {
        const record = row as unknown as Record<string, string | null>
        const key = record[fkColumn]
        if (key && valueSet.has(key)) {
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
      }

      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  return counts
}

function buildDuplicateGroups(
  customers: LoadedCustomer[]
): Map<string, LoadedCustomer[]> {
  const byIdNumber = new Map<string, LoadedCustomer[]>()

  for (const customer of customers) {
    const group = byIdNumber.get(customer.normalized_id_number) ?? []
    group.push(customer)
    byIdNumber.set(customer.normalized_id_number, group)
  }

  const duplicates = new Map<string, LoadedCustomer[]>()
  for (const [idNumber, group] of byIdNumber) {
    if (group.length > 1) {
      duplicates.set(idNumber, group)
    }
  }

  return duplicates
}

function buildInspectRecord(
  customer: LoadedCustomer,
  counts: {
    contacts: Map<string, number>
    orderers: Map<string, number>
    tows: Map<string, number>
    events: Map<string, number>
    invoices: Map<string, number>
    storedVehicles: Map<string, number>
    priceLists: Map<string, number>
    customerUsers: Map<string, number>
    priceItems: Map<string, number>
  }
): InspectRecord {
  const contacts = counts.contacts.get(customer.id) ?? 0
  const orderers = counts.orderers.get(customer.id) ?? 0
  const tows = counts.tows.get(customer.id) ?? 0
  const events = counts.events.get(customer.id) ?? 0
  const invoices = counts.invoices.get(customer.id) ?? 0
  const stored_veh = counts.storedVehicles.get(customer.id) ?? 0
  const price_lists = counts.priceLists.get(customer.customer_company_id) ?? 0
  const customer_users = counts.customerUsers.get(customer.id) ?? 0
  const price_items = counts.priceItems.get(customer.customer_company_id) ?? 0
  const portal_settings = portalSettingsManualFlag(customer.portal_settings)

  return {
    id_number: customer.normalized_id_number,
    customer_id: customer.id,
    name: customer.name,
    caspit_contact_id: customer.caspit_contact_id ? 'yes' : 'no',
    contacts,
    orderers,
    tows,
    events,
    invoices,
    stored_veh,
    price_lists,
    customer_users,
    price_items,
    portal_settings,
    manual_score:
      contacts +
      orderers +
      tows +
      events +
      invoices +
      stored_veh +
      price_lists +
      customer_users +
      price_items +
      portal_settings,
  }
}

async function main(): Promise<void> {
  validateEnv()

  const companyId = IMPORT_TARGET_COMPANY_ID!
  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!)

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .maybeSingle()

  if (companyError) {
    throw new Error(`Failed to load company: ${companyError.message}`)
  }

  console.log('=== Duplicate customer data inspection (read-only) ===')
  if (company) {
    console.log(`Company: ${company.id} — ${company.name}`)
  } else {
    console.log(`Company: ${companyId}`)
  }

  console.log('Loading company customers...')
  const customers = await loadCompanyCustomers(supabase, companyId)
  console.log(`Loaded ${customers.length} customers with non-blank ח.פ.`)

  const duplicateGroups = buildDuplicateGroups(customers)
  if (duplicateGroups.size === 0) {
    console.log('\nNo duplicate ח.פ groups found.')
    return
  }

  const duplicateCustomers = [...duplicateGroups.values()].flat()
  const customerIds = duplicateCustomers.map((c) => c.id)
  const customerCompanyIds = [...new Set(duplicateCustomers.map((c) => c.customer_company_id))]

  console.log(
    `Counting linked rows for ${customerIds.length} customers in ${duplicateGroups.size} duplicate groups...`
  )

  const [
    contacts,
    orderers,
    tows,
    events,
    invoices,
    storedVehicles,
    priceLists,
    customerUsers,
    priceItems,
  ] = await Promise.all([
      countRowsByForeignKey(supabase, 'customer_contacts', 'customer_id', customerIds, companyId),
      countRowsByForeignKey(supabase, 'customer_orderers', 'customer_id', customerIds, companyId),
      countRowsByForeignKey(supabase, 'tows', 'customer_id', customerIds, companyId),
      countRowsByForeignKey(supabase, 'events', 'customer_id', customerIds, companyId),
      countRowsByForeignKey(supabase, 'invoices', 'customer_id', customerIds, companyId),
      countRowsByForeignKey(supabase, 'stored_vehicles', 'customer_id', customerIds, companyId),
      countRowsByForeignKey(
        supabase,
        'price_lists',
        'customer_company_id',
        customerCompanyIds,
        companyId
      ),
      countRowsByForeignKey(supabase, 'customer_users', 'customer_id', customerIds),
      countRowsByForeignKey(
        supabase,
        'customer_price_items',
        'customer_company_id',
        customerCompanyIds
      ),
    ])

  const countMaps = {
    contacts,
    orderers,
    tows,
    events,
    invoices,
    storedVehicles,
    priceLists,
    customerUsers,
    priceItems,
  }

  const sortedGroups = [...duplicateGroups.entries()].sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length
    return a[0].localeCompare(b[0], 'he')
  })

  let totalDuplicateRecords = 0
  let totalSafeDeleteCandidates = 0

  for (const [normalizedId, members] of sortedGroups) {
    const records = members.map((m) => buildInspectRecord(m, countMaps))
    totalDuplicateRecords += records.length

    const safeCount = records.filter((r) => r.manual_score === 0).length
    const mustKeepCount = records.length - safeCount
    totalSafeDeleteCandidates += safeCount

    console.log(`\n--- ח.פ ${normalizedId} (${records.length} records) ---`)
    console.table(records)
    console.log(
      `Hint: ${safeCount} record(s) with manual_score=0 (safe-delete candidates), ` +
        `${mustKeepCount} record(s) with manual_score>0 (keep or merge first).`
    )
  }

  console.log('\n=== Totals ===')
  console.log(`Duplicate groups:                    ${duplicateGroups.size}`)
  console.log(`Total duplicate records:             ${totalDuplicateRecords}`)
  console.log(`Records with manual_score = 0:       ${totalSafeDeleteCandidates}`)
  console.log(
    `Records with manual_score > 0:       ${totalDuplicateRecords - totalSafeDeleteCandidates}`
  )
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(message)
  process.exit(1)
})

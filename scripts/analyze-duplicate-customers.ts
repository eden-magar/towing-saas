// scripts/analyze-duplicate-customers.ts
// Read-only report: duplicate customers by normalized ח.פ (id_number)
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const IMPORT_TARGET_COMPANY_ID = process.env.IMPORT_TARGET_COMPANY_ID

const PAGE_SIZE = 1000
const IN_CHUNK_SIZE = 500

interface CustomerRow {
  id: string
  name: string
  id_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  caspit_contact_id: string | null
}

interface EnrichedCustomer extends CustomerRow {
  normalizedIdNumber: string
  hasData: boolean
  towsCount: number
}

interface DuplicateGroupSummary {
  id_number: string
  group_size: number
  num_with_data: number
  num_empty: number
  total_tows: number
  sample_name: string
  members: EnrichedCustomer[]
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

function isNonEmpty(value: string | null | undefined): boolean {
  return value != null && value.trim() !== ''
}

/** Trim + strip leading zeros (same as backfill script). */
function normalizeIdNumber(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/^0+/, '')
  return normalized || null
}

function customerHasData(customer: CustomerRow): boolean {
  return (
    isNonEmpty(customer.phone) ||
    isNonEmpty(customer.email) ||
    isNonEmpty(customer.address) ||
    isNonEmpty(customer.notes)
  )
}

async function loadCompanyCustomers(
  supabase: SupabaseClient,
  companyId: string
): Promise<CustomerRow[]> {
  const all: CustomerRow[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('customers')
      .select(
        'id, name, id_number, phone, email, address, notes, caspit_contact_id, customer_company!inner(company_id)'
      )
      .eq('customer_company.company_id', companyId)
      .order('name', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      throw new Error(`Failed to load customers: ${error.message}`)
    }

    const rows = (data ?? []) as CustomerRow[]
    if (rows.length === 0) break

    all.push(...rows)

    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return all
}

async function loadTowCountsForCustomers(
  supabase: SupabaseClient,
  companyId: string,
  customerIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (customerIds.length === 0) return counts

  for (let i = 0; i < customerIds.length; i += IN_CHUNK_SIZE) {
    const chunk = customerIds.slice(i, i + IN_CHUNK_SIZE)
    let from = 0

    while (true) {
      const { data, error } = await supabase
        .from('tows')
        .select('customer_id')
        .eq('company_id', companyId)
        .in('customer_id', chunk)
        .range(from, from + PAGE_SIZE - 1)

      if (error) {
        throw new Error(`Failed to load tow counts: ${error.message}`)
      }

      const rows = data ?? []
      if (rows.length === 0) break

      for (const row of rows) {
        const customerId = (row as { customer_id: string | null }).customer_id
        if (!customerId) continue
        counts.set(customerId, (counts.get(customerId) ?? 0) + 1)
      }

      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  return counts
}

function buildDuplicateGroups(
  customers: CustomerRow[],
  towCounts: Map<string, number>
): DuplicateGroupSummary[] {
  const byIdNumber = new Map<string, EnrichedCustomer[]>()

  for (const customer of customers) {
    const normalizedIdNumber = normalizeIdNumber(customer.id_number)
    if (!normalizedIdNumber) continue

    const enriched: EnrichedCustomer = {
      ...customer,
      normalizedIdNumber,
      hasData: customerHasData(customer),
      towsCount: towCounts.get(customer.id) ?? 0,
    }

    const group = byIdNumber.get(normalizedIdNumber) ?? []
    group.push(enriched)
    byIdNumber.set(normalizedIdNumber, group)
  }

  const summaries: DuplicateGroupSummary[] = []

  for (const [idNumber, members] of byIdNumber) {
    if (members.length <= 1) continue

    const numWithData = members.filter((m) => m.hasData).length
    const numEmpty = members.length - numWithData
    const totalTows = members.reduce((sum, m) => sum + m.towsCount, 0)
    const sampleName =
      members.find((m) => m.hasData)?.name ??
      members.find((m) => isNonEmpty(m.name))?.name ??
      members[0].name

    summaries.push({
      id_number: idNumber,
      group_size: members.length,
      num_with_data: numWithData,
      num_empty: numEmpty,
      total_tows: totalTows,
      sample_name: sampleName,
      members,
    })
  }

  summaries.sort((a, b) => {
    if (b.group_size !== a.group_size) return b.group_size - a.group_size
    return b.total_tows - a.total_tows
  })

  return summaries
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

  console.log('=== Duplicate customer analysis (read-only) ===')
  if (company) {
    console.log(`Company: ${company.id} — ${company.name}`)
  } else {
    console.log(`Company: ${companyId}`)
  }

  console.log('Loading company customers...')
  const customers = await loadCompanyCustomers(supabase, companyId)
  console.log(`Loaded ${customers.length} customers.`)

  const withIdNumber = customers.filter((c) => normalizeIdNumber(c.id_number) !== null)
  console.log(`${withIdNumber.length} customers have a non-blank ח.פ.`)

  const provisionalGroups = new Map<string, CustomerRow[]>()
  for (const customer of withIdNumber) {
    const key = normalizeIdNumber(customer.id_number)!
    const group = provisionalGroups.get(key) ?? []
    group.push(customer)
    provisionalGroups.set(key, group)
  }

  const duplicateCustomerIds = [...provisionalGroups.values()]
    .filter((group) => group.length > 1)
    .flatMap((group) => group.map((c) => c.id))

  console.log(
    `Loading tow counts for ${duplicateCustomerIds.length} customers in duplicate groups...`
  )
  const towCounts = await loadTowCountsForCustomers(
    supabase,
    companyId,
    duplicateCustomerIds
  )

  const groups = buildDuplicateGroups(customers, towCounts)

  if (groups.length === 0) {
    console.log('\nNo duplicate ח.פ groups found.')
    return
  }

  console.log(`\n=== Summary (${groups.length} duplicate groups) ===`)
  console.table(
    groups.map((g) => ({
      id_number: g.id_number,
      group_size: g.group_size,
      num_with_data: g.num_with_data,
      num_empty: g.num_empty,
      total_tows: g.total_tows,
      sample_name: g.sample_name,
    }))
  )

  const totalRecords = groups.reduce((sum, g) => sum + g.group_size, 0)
  const safeDeleteCandidates = groups
    .flatMap((g) => g.members)
    .filter((m) => !m.hasData && m.towsCount === 0)

  console.log('\n=== Totals ===')
  console.log(`Duplicate groups:              ${groups.length}`)
  console.log(`Total records in groups:       ${totalRecords}`)
  console.log(
    `Empty + zero tows (candidates):  ${safeDeleteCandidates.length}`
  )
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(message)
  process.exit(1)
})

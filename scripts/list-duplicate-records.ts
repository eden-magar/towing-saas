// scripts/list-duplicate-records.ts
// Read-only: list all customer records for specific normalized ח.פ values
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const IMPORT_TARGET_COMPANY_ID = process.env.IMPORT_TARGET_COMPANY_ID

const PAGE_SIZE = 1000
const IN_CHUNK_SIZE = 300

/** Normalized ח.פ values to report (trim + strip leading zeros). */
const TARGET_ID_NUMBERS = new Set([
  '511143885',
  '514016153',
  '511809071',
  '512584996',
  '516008703',
  '23683824',
  '514446301',
  '61207528',
  '513286690',
])

interface CustomerRow {
  id: string
  name: string
  id_number: string | null
  phone: string | null
  address: string | null
}

interface CustomerRecord {
  normalized_id_number: string
  customer_id: string
  name: string
  address: string
  phone: string
  tow_count: number
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

/** Trim + strip leading zeros (same as analyze / inspect scripts). */
function normalizeIdNumber(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/^0+/, '')
  return normalized || null
}

async function loadMatchingCustomers(
  supabase: SupabaseClient,
  companyId: string
): Promise<CustomerRow[]> {
  const matches: CustomerRow[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, id_number, phone, address, customer_company!inner(company_id)')
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
      if (normalized && TARGET_ID_NUMBERS.has(normalized)) {
        matches.push(row)
      }
    }

    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return matches
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
    const chunkIndex = Math.floor(i / IN_CHUNK_SIZE) + 1
    let from = 0

    while (true) {
      const { data, error } = await supabase
        .from('tows')
        .select('customer_id')
        .eq('company_id', companyId)
        .in('customer_id', chunk)
        .range(from, from + PAGE_SIZE - 1)

      if (error) {
        console.error(
          `Error fetching tow counts (chunk ${chunkIndex}, range ${from}-${from + PAGE_SIZE - 1}):`,
          error
        )
        break
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

function groupRecords(records: CustomerRecord[]): Map<string, CustomerRecord[]> {
  const groups = new Map<string, CustomerRecord[]>()

  for (const record of records) {
    const group = groups.get(record.normalized_id_number) ?? []
    group.push(record)
    groups.set(record.normalized_id_number, group)
  }

  for (const [idNumber, members] of groups) {
    members.sort((a, b) => b.tow_count - a.tow_count)
    groups.set(idNumber, members)
  }

  return groups
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

  console.log('=== Duplicate record listing (read-only) ===')
  if (company) {
    console.log(`Company: ${company.id} — ${company.name}`)
  } else {
    console.log(`Company: ${companyId}`)
  }
  console.log(`Target id_numbers: ${[...TARGET_ID_NUMBERS].sort().join(', ')}`)

  const customers = await loadMatchingCustomers(supabase, companyId)
  const customerIds = customers.map((c) => c.id)
  const towCounts = await loadTowCountsForCustomers(supabase, companyId, customerIds)

  const records: CustomerRecord[] = customers.map((customer) => {
    const normalized = normalizeIdNumber(customer.id_number)!
    return {
      normalized_id_number: normalized,
      customer_id: customer.id,
      name: customer.name?.trim() || '',
      address: customer.address?.trim() || '',
      phone: customer.phone?.trim() || '',
      tow_count: towCounts.get(customer.id) ?? 0,
    }
  })

  const groups = groupRecords(records)
  const sortedIdNumbers = [...TARGET_ID_NUMBERS].sort((a, b) => a.localeCompare(b, 'he'))

  let totalRecords = 0

  for (const idNumber of sortedIdNumbers) {
    const members = groups.get(idNumber) ?? []
    totalRecords += members.length

    console.log(`\n--- ח.פ ${idNumber} (${members.length} record(s)) ---`)
    if (members.length === 0) {
      console.log('(no records found)')
      continue
    }
    console.table(members)
  }

  console.log('\n=== Totals ===')
  console.log(`Target id_numbers:     ${TARGET_ID_NUMBERS.size}`)
  console.log(`Records found:         ${totalRecords}`)
  console.log(
    `Id_numbers with hits:  ${sortedIdNumbers.filter((id) => (groups.get(id)?.length ?? 0) > 0).length}`
  )
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(message)
  process.exit(1)
})

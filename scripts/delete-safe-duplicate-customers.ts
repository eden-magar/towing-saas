// scripts/delete-safe-duplicate-customers.ts
// Delete empty duplicate customers (zero tows/contacts/orderers/price_lists)
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const IMPORT_TARGET_COMPANY_ID = process.env.IMPORT_TARGET_COMPANY_ID
const COMMIT = process.argv.includes('--commit')

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
  created_at: string
  customer_company: CustomerCompanyJunction | CustomerCompanyJunction[]
}

interface LoadedCustomer {
  id: string
  name: string
  id_number: string | null
  caspit_contact_id: string | null
  created_at: string
  customer_company_id: string
  normalized_id_number: string
}

interface MemberCounts {
  tows: number
  contacts: number
  orderers: number
  price_lists: number
}

interface EnrichedMember extends LoadedCustomer, MemberCounts {
  richness: number
}

interface GroupPlan {
  normalized_id_number: string
  keeper: EnrichedMember
  to_delete: EnrichedMember[]
  needs_manual_merge: EnrichedMember[]
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

/** Trim + strip leading zeros (same as inspect / analyze scripts). */
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

function compareCreatedAtAsc(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime()
}

function compareCreatedAtDesc(a: string, b: string): number {
  return new Date(b).getTime() - new Date(a).getTime()
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
        'id, name, id_number, caspit_contact_id, created_at, customer_company!inner(id, company_id)'
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
        created_at: row.created_at,
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

function enrichMember(
  customer: LoadedCustomer,
  counts: {
    tows: Map<string, number>
    contacts: Map<string, number>
    orderers: Map<string, number>
    priceLists: Map<string, number>
  }
): EnrichedMember {
  const tows = counts.tows.get(customer.id) ?? 0
  const contacts = counts.contacts.get(customer.id) ?? 0
  const orderers = counts.orderers.get(customer.id) ?? 0
  const price_lists = counts.priceLists.get(customer.customer_company_id) ?? 0

  return {
    ...customer,
    tows,
    contacts,
    orderers,
    price_lists,
    richness: tows + contacts + orderers + price_lists,
  }
}

/** Pick keeper: highest richness; tie caspit_contact_id; tie oldest created_at.
 *  When every member has richness 0, keep newest created_at instead. */
function pickKeeper(members: EnrichedMember[]): EnrichedMember {
  if (members.length === 0) {
    throw new Error('Cannot pick keeper from empty group')
  }

  const allZero = members.every((m) => m.richness === 0)
  if (allZero) {
    return [...members].sort((a, b) => compareCreatedAtDesc(a.created_at, b.created_at))[0]
  }

  return [...members].sort((a, b) => {
    if (b.richness !== a.richness) return b.richness - a.richness
    const aCaspit = a.caspit_contact_id ? 1 : 0
    const bCaspit = b.caspit_contact_id ? 1 : 0
    if (bCaspit !== aCaspit) return bCaspit - aCaspit
    return compareCreatedAtAsc(a.created_at, b.created_at)
  })[0]
}

function isSafeToDelete(member: EnrichedMember): boolean {
  return member.tows === 0 && member.contacts === 0 && member.orderers === 0 && member.price_lists === 0
}

function planGroup(normalizedId: string, members: EnrichedMember[]): GroupPlan {
  const keeper = pickKeeper(members)
  const others = members.filter((m) => m.id !== keeper.id)

  const to_delete = others.filter(isSafeToDelete)
  const needs_manual_merge = others.filter((m) => !isSafeToDelete(m))

  if (to_delete.some((m) => m.id === keeper.id)) {
    throw new Error(`Safety: keeper ${keeper.id} marked for deletion in group ${normalizedId}`)
  }
  if (to_delete.length >= members.length) {
    throw new Error(`Safety: would delete entire group ${normalizedId}`)
  }

  return {
    normalized_id_number: normalizedId,
    keeper,
    to_delete,
    needs_manual_merge,
  }
}

function formatMemberLine(member: EnrichedMember): string {
  return (
    `${member.id} — ${member.name} ` +
    `(tows=${member.tows}, contacts=${member.contacts}, orderers=${member.orderers}, price_lists=${member.price_lists})`
  )
}

function printGroupPlan(plan: GroupPlan): void {
  const groupSize =
    1 + plan.to_delete.length + plan.needs_manual_merge.length

  console.log(`\n--- ח.פ ${plan.normalized_id_number} (${groupSize} records) ---`)
  console.log(
    `Keeper: ${plan.keeper.id} — ${plan.keeper.name} (richness=${plan.keeper.richness})`
  )

  if (plan.to_delete.length === 0) {
    console.log('To delete: (none)')
  } else {
    console.log('To delete:')
    for (const member of plan.to_delete) {
      console.log(`  - ${formatMemberLine(member)}`)
    }
  }

  if (plan.needs_manual_merge.length === 0) {
    console.log('Needs manual merge: (none)')
  } else {
    console.log('Needs manual merge:')
    for (const member of plan.needs_manual_merge) {
      console.log(`  - ${formatMemberLine(member)}`)
    }
  }
}

async function deleteCustomers(
  supabase: SupabaseClient,
  customerIds: string[]
): Promise<number> {
  let deleted = 0

  for (let i = 0; i < customerIds.length; i += IN_CHUNK_SIZE) {
    const chunk = customerIds.slice(i, i + IN_CHUNK_SIZE)
    const { error } = await supabase.from('customers').delete().in('id', chunk)

    if (error) {
      throw new Error(`Failed deleting customers: ${error.message}`)
    }

    deleted += chunk.length
  }

  return deleted
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

  const mode = COMMIT ? 'COMMIT' : 'DRY RUN'
  console.log(`=== Delete safe duplicate customers (${mode}) ===`)
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
    `Counting tows, contacts, orderers, price_lists for ${customerIds.length} customers ` +
      `in ${duplicateGroups.size} duplicate groups...`
  )

  const [tows, contacts, orderers, priceLists] = await Promise.all([
    countRowsByForeignKey(supabase, 'tows', 'customer_id', customerIds, companyId),
    countRowsByForeignKey(supabase, 'customer_contacts', 'customer_id', customerIds, companyId),
    countRowsByForeignKey(supabase, 'customer_orderers', 'customer_id', customerIds, companyId),
    countRowsByForeignKey(
      supabase,
      'price_lists',
      'customer_company_id',
      customerCompanyIds,
      companyId
    ),
  ])

  const countMaps = { tows, contacts, orderers, priceLists }

  const sortedGroups = [...duplicateGroups.entries()].sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length
    return a[0].localeCompare(b[0], 'he')
  })

  const plans: GroupPlan[] = []
  for (const [normalizedId, members] of sortedGroups) {
    const enriched = members.map((m) => enrichMember(m, countMaps))
    plans.push(planGroup(normalizedId, enriched))
  }

  for (const plan of plans) {
    printGroupPlan(plan)
  }

  const idsToDelete = plans.flatMap((p) => p.to_delete.map((m) => m.id))
  const keeperIds = new Set(plans.map((p) => p.keeper.id))
  const manualMergeCount = plans.reduce((sum, p) => sum + p.needs_manual_merge.length, 0)

  if (idsToDelete.some((id) => keeperIds.has(id))) {
    throw new Error('Safety: a keeper id appears in the delete list')
  }

  console.log('\n=== Totals ===')
  console.log(`Duplicate groups:              ${plans.length}`)
  console.log(`Records to delete:             ${idsToDelete.length}`)
  console.log(`Records needing manual merge:  ${manualMergeCount}`)

  if (idsToDelete.length === 0) {
    console.log('\nNothing to delete.')
    return
  }

  if (!COMMIT) {
    console.log('\nRe-run with --commit to delete the listed customer rows.')
    return
  }

  console.log(`\nDeleting ${idsToDelete.length} customer row(s)...`)
  const deleted = await deleteCustomers(supabase, idsToDelete)
  console.log(`Deleted: ${deleted}`)
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(message)
  process.exit(1)
})

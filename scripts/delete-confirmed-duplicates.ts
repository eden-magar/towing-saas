// scripts/delete-confirmed-duplicates.ts
// Delete a fixed list of 40 confirmed duplicate customer rows
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const IMPORT_TARGET_COMPANY_ID = process.env.IMPORT_TARGET_COMPANY_ID
const COMMIT = process.argv.includes('--commit')

const PAGE_SIZE = 1000
const IN_CHUNK_SIZE = 300
const DELETE_CHUNK_SIZE = 500

const IDS_TO_DELETE = [
  // אביב (keep 2475b45a)
  '52b4e12b-af25-452c-afae-659f50fcbaf5',
  '765b5e5d-0c05-43c2-a7ae-7c7ac77db33d',
  '23edcd15-f304-45de-92b3-e37a5cb4c921',
  // מוסיק (keep b6b2ca2f)
  'a1cc7b40-3b7d-44b3-95b4-9f8f4b4605da',
  'd7a19329-70e7-4c0f-a38d-81da3a76afa6',
  '753f2ca8-d7ae-4100-acd0-eae507480e45',
  'b1af13e8-8a08-40d2-9817-52841f406b64',
  'ac86513d-96e5-4e89-ac15-fec6f4e6d05b',
  'b669e8f1-f5b9-4816-8de3-2854a67f29f5',
  '2ce6ab21-85f7-4ce1-921d-1bb87f83edee',
  '17c39dbe-1a20-4574-8343-875775c77b70',
  '06394e59-036b-4226-a355-cd5a02e02f7d',
  'e304fee7-77f7-45f0-b509-724b4a4fa13c',
  '3fc96cba-3066-4da6-84fb-90460238b0e4',
  '9ff71768-34ce-4cdd-8c14-26c8fb040dc2',
  'f37bfc12-cdad-490e-9b83-f057169ace1b',
  '400ca8dd-a065-42d5-9cfa-f8c0348a9f31',
  'e7b48532-156f-4904-856d-685d1bada573',
  // פתח תקווה (keep c8926670)
  'f4ebbbef-43bf-4ae9-a7aa-c5efe1e36f97',
  // אופרייט תאונות ריקה
  'f78a5c32-dfc1-463b-87a5-17631aeeb775',
  // סנדורי (keep fbd48a31)
  '2a7a62b3-f43d-4595-b551-986986e874df',
  'db06939a-36ae-443f-8110-bbb5da761db2',
  '41d264a5-b9ea-4002-8872-711adb702ae1',
  // יו.סי.אם (keep 22e8c66b)
  '35c5731a-bd89-4d62-a35a-640b267e237a',
  '9bc54603-5587-4a4e-a922-533a7f0e4308',
  'de0dc498-8b01-43ac-ac95-54987e4810ad',
  '1d01dd5d-5512-47c3-b7db-06f9a849c2bc',
  'ac6d465a-8558-43f7-95fe-be54625ab8f9',
  '77fd0756-b2dc-4b84-bbd4-938b0b4eafdb',
  'a6309b8f-86d9-45a9-a7fa-5ff61f56be18',
  '7bfd7824-6bbc-4ca0-bd8f-4ed043e96ee0',
  'e1445286-99ca-476e-908b-a1a4d903fd4c',
  '18ace18a-b21d-479b-bbf4-8818614563dd',
  '24e764c6-9dce-4bea-93c0-2273efb06469',
  // כרכם (keep 7d4b13f8)
  '9cd0c518-c535-483d-af1f-38c1b55098dd',
  'c109ce37-e9f3-4e3b-8030-5f46e6fc1a3b',
  'ae04d4ba-be3a-4b88-b2c5-646b68168125',
  // המדייק ריק
  '43f01e17-b187-4a04-8205-a2f6eb59edbe',
  // מוסך שי געש
  '77ac3943-284c-4f46-a3ff-18bdbe34e8eb',
  'b7724bda-d4e9-4f99-8026-f84cbdd6e5b4',
] as const

interface CustomerRow {
  id: string
  name: string
  address: string | null
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

function assertDeleteList(): void {
  if (IDS_TO_DELETE.length !== 40) {
    console.error(`Abort: IDS_TO_DELETE must contain exactly 40 ids (got ${IDS_TO_DELETE.length})`)
    process.exit(1)
  }

  const unique = new Set(IDS_TO_DELETE)
  if (unique.size !== IDS_TO_DELETE.length) {
    console.error('Abort: IDS_TO_DELETE contains duplicate ids')
    process.exit(1)
  }
}

async function fetchCustomersForCompany(
  supabase: SupabaseClient,
  companyId: string,
  customerIds: readonly string[]
): Promise<CustomerRow[]> {
  const found: CustomerRow[] = []

  for (let i = 0; i < customerIds.length; i += IN_CHUNK_SIZE) {
    const chunk = customerIds.slice(i, i + IN_CHUNK_SIZE)
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, address, customer_company!inner(company_id)')
      .eq('customer_company.company_id', companyId)
      .in('id', chunk)

    if (error) {
      throw new Error(`Failed to fetch customers: ${error.message}`)
    }

    found.push(...((data ?? []) as CustomerRow[]))
  }

  return found
}

async function loadTowCountsForCustomers(
  supabase: SupabaseClient,
  companyId: string,
  customerIds: readonly string[]
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
        throw new Error(
          `Failed to count tows (chunk ${chunkIndex}, range ${from}-${from + PAGE_SIZE - 1}): ${error.message}`
        )
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

async function deleteCustomers(
  supabase: SupabaseClient,
  customerIds: readonly string[]
): Promise<number> {
  let deleted = 0

  for (let i = 0; i < customerIds.length; i += DELETE_CHUNK_SIZE) {
    const chunk = customerIds.slice(i, i + DELETE_CHUNK_SIZE)
    const { error } = await supabase.from('customers').delete().in('id', chunk)

    if (error) {
      throw new Error(`Failed deleting customers: ${error.message}`)
    }

    deleted += chunk.length
  }

  return deleted
}

async function main(): Promise<void> {
  assertDeleteList()
  validateEnv()

  const companyId = IMPORT_TARGET_COMPANY_ID!
  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!)
  const mode = COMMIT ? 'COMMIT' : 'DRY RUN'

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .maybeSingle()

  if (companyError) {
    throw new Error(`Failed to load company: ${companyError.message}`)
  }

  console.log(`=== Delete confirmed duplicates (${mode}) ===`)
  if (company) {
    console.log(`Company: ${company.id} — ${company.name}`)
  } else {
    console.log(`Company: ${companyId}`)
  }
  console.log(`Ids to delete: ${IDS_TO_DELETE.length}`)

  const customers = await fetchCustomersForCompany(supabase, companyId, IDS_TO_DELETE)
  const foundIds = new Set(customers.map((c) => c.id))
  const missingIds = IDS_TO_DELETE.filter((id) => !foundIds.has(id))

  console.log(`\nFound ${customers.length} of ${IDS_TO_DELETE.length} ids in company`)

  if (missingIds.length > 0) {
    console.error('\nAbort: the following ids were NOT found for this company:')
    for (const id of missingIds) {
      console.error(`  - ${id}`)
    }
    process.exit(1)
  }

  const towCounts = await loadTowCountsForCustomers(supabase, companyId, IDS_TO_DELETE)
  const idsWithTows = IDS_TO_DELETE.filter((id) => (towCounts.get(id) ?? 0) > 0)

  if (idsWithTows.length > 0) {
    console.error('\nAbort: the following ids have tows > 0:')
    for (const id of idsWithTows) {
      const name = customers.find((c) => c.id === id)?.name ?? '(unknown)'
      console.error(`  - ${id} — ${name} (tows=${towCounts.get(id)})`)
    }
    process.exit(1)
  }

  const rows = customers
    .map((c) => ({
      customer_id: c.id,
      name: c.name?.trim() || '',
      address: c.address?.trim() || '',
      tow_count: towCounts.get(c.id) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'he'))

  console.log('\nCustomers to delete:')
  console.table(rows)

  if (!COMMIT) {
    console.log('\nRe-run with --commit to delete these 40 customer rows.')
    return
  }

  console.log(`\nDeleting ${IDS_TO_DELETE.length} customer row(s)...`)
  const deleted = await deleteCustomers(supabase, IDS_TO_DELETE)
  console.log(`Deleted: ${deleted}`)
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(message)
  process.exit(1)
})

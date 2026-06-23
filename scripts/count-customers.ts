// scripts/count-customers.ts
// Read-only customer counts for a company (caspit_contact_id breakdown)
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const IMPORT_TARGET_COMPANY_ID = process.env.IMPORT_TARGET_COMPANY_ID

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

async function countCompanyCustomers(
  companyId: string,
  caspitFilter: 'all' | 'linked' | 'unlinked'
): Promise<number> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!)

  let query = supabase
    .from('customers')
    .select('id, customer_company!inner(company_id)', { count: 'exact', head: true })
    .eq('customer_company.company_id', companyId)

  if (caspitFilter === 'linked') {
    query = query.not('caspit_contact_id', 'is', null)
  } else if (caspitFilter === 'unlinked') {
    query = query.is('caspit_contact_id', null)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(`Count query failed (${caspitFilter}): ${error.message}`)
  }

  return count ?? 0
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

  const [total, withCaspitId, withoutCaspitId] = await Promise.all([
    countCompanyCustomers(companyId, 'all'),
    countCompanyCustomers(companyId, 'linked'),
    countCompanyCustomers(companyId, 'unlinked'),
  ])

  console.log('=== Customer counts (read-only) ===')
  if (company) {
    console.log(`Company: ${company.id} — ${company.name}`)
  } else {
    console.log(`Company: ${companyId}`)
  }
  console.log(`Total linked to company:     ${total}`)
  console.log(`With caspit_contact_id:    ${withCaspitId}`)
  console.log(`Without caspit_contact_id: ${withoutCaspitId}`)
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(message)
  process.exit(1)
})

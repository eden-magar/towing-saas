// scripts/check-rpc.ts
// Read-only: verify get_customer_tow_counts / get_customer_open_balances RPCs
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient, type PostgrestError } from '@supabase/supabase-js'

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

function printRpcError(label: string, error: PostgrestError): void {
  console.log(`\n--- ${label} ---`)
  console.log('Status: ERROR')
  console.log('error.message:', error.message)
  console.log('error.code:', error.code)
  console.log('error.details:', error.details)
  console.log('error.hint:', error.hint)
  console.log('Full error object:', JSON.stringify(error, null, 2))
}

function printRpcSuccess(label: string, data: unknown[] | null): void {
  const rows = data ?? []
  console.log(`\n--- ${label} ---`)
  console.log('Status: SUCCESS')
  console.log(`Rows returned: ${rows.length}`)
  if (rows.length > 0) {
    console.log('First row:', JSON.stringify(rows[0], null, 2))
  } else {
    console.log('First row: (none)')
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

  console.log('=== RPC check (read-only) ===')
  if (company) {
    console.log(`Company: ${company.id} — ${company.name}`)
  } else {
    console.log(`Company: ${companyId}`)
  }
  console.log(`p_company_id: ${companyId}`)

  const [towCountsResult, openBalancesResult] = await Promise.all([
    supabase.rpc('get_customer_tow_counts', { p_company_id: companyId }),
    supabase.rpc('get_customer_open_balances', { p_company_id: companyId }),
  ])

  if (towCountsResult.error) {
    printRpcError('get_customer_tow_counts', towCountsResult.error)
  } else {
    printRpcSuccess('get_customer_tow_counts', towCountsResult.data)
  }

  if (openBalancesResult.error) {
    printRpcError('get_customer_open_balances', openBalancesResult.error)
  } else {
    printRpcSuccess('get_customer_open_balances', openBalancesResult.data)
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(message)
  process.exit(1)
})

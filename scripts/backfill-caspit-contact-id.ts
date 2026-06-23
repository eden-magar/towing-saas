// scripts/backfill-caspit-contact-id.ts
// One-time backfill of customers.caspit_contact_id from Caspit contacts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { input, password } from '@inquirer/prompts'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CASPIT_OSEK_MORSHE = process.env.CASPIT_OSEK_MORSHE
const IMPORT_TARGET_COMPANY_ID = process.env.IMPORT_TARGET_COMPANY_ID
const COMMIT = process.argv.includes('--commit')

const CASPIT_TOKEN_URL = 'https://app.caspit.biz/api/v1/token/'
const CASPIT_CONTACTS_URL = 'https://app.caspit.biz/api/v1/contacts'

// ==================== Types ====================

interface CaspitContact {
  ContactId: string | number
  ContactType: number
  OsekMorshe?: string | null
  BusinessName?: string | null
  Name?: string | null
}

interface CaspitContactsPage {
  CurrentPage: number
  TotalCount: number
  TotalPages: number
  Results: CaspitContact[]
}

interface CustomerRow {
  id: string
  name: string
  id_number: string | null
}

type MatchMethod = 'osek_morshe' | 'business_name'

interface ConfidentMatch {
  customerId: string
  customerName: string
  idNumber: string | null
  caspitContactId: string
  method: MatchMethod
}

interface UnmatchedCustomer {
  customerId: string
  customerName: string
  idNumber: string | null
  reason: string
}

interface AmbiguousMatch {
  customerId: string
  customerName: string
  idNumber: string | null
  method: MatchMethod
  lookupKey: string
  caspitContactIds: string[]
}

interface BackfillStats {
  caspitFetched: number
  caspitTypeZero: number
  customersScanned: number
  matched: number
  updated: number
  unmatched: UnmatchedCustomer[]
  ambiguous: AmbiguousMatch[]
  errors: { customerId: string; message: string }[]
}

// ==================== Env ====================

function validateEnv(): void {
  const missing: string[] = []
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!SUPABASE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!CASPIT_OSEK_MORSHE) missing.push('CASPIT_OSEK_MORSHE')
  if (!IMPORT_TARGET_COMPANY_ID) missing.push('IMPORT_TARGET_COMPANY_ID')

  if (missing.length > 0) {
    console.error('Missing required environment variables in .env.local:')
    for (const key of missing) {
      console.error(`  - ${key}`)
    }
    process.exit(1)
  }
}

// ==================== Helpers ====================

function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim() === ''
}

/** Strip leading zeros so e.g. "023683824" and "23683824" match. */
function normalizeIdNumber(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/^0+/, '')
  return normalized || null
}

function parseCaspitToken(body: string): string {
  const trimmed = body.trim()
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (typeof parsed === 'string' && parsed.length > 0) return parsed
  } catch {
    // fall through
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function addToLookupMap(map: Map<string, string[]>, key: string, contactId: string): void {
  const existing = map.get(key) ?? []
  if (!existing.includes(contactId)) {
    existing.push(contactId)
  }
  map.set(key, existing)
}

// ==================== Caspit API ====================

async function authCaspit(
  username: string,
  userPassword: string,
  osekMorshe: string
): Promise<string> {
  const body = new URLSearchParams({
    UserName: username,
    Password: userPassword,
    OsekMorshe: osekMorshe,
  })

  const res = await fetch(CASPIT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Caspit auth failed (${res.status}): ${text}`)
  }

  const token = parseCaspitToken(text)
  if (!token) {
    throw new Error('Caspit auth returned an empty token')
  }
  return token
}

async function fetchAllContacts(token: string): Promise<CaspitContact[]> {
  const all: CaspitContact[] = []
  let page = 0
  let totalPages = 1

  while (page < totalPages) {
    const url = `${CASPIT_CONTACTS_URL}?page=${page}`
    const res = await fetch(url, {
      headers: { 'Caspit-Token': token },
    })

    const text = await res.text()
    if (!res.ok) {
      throw new Error(`Caspit contacts fetch failed (${res.status}) page ${page}: ${text}`)
    }

    const data = JSON.parse(text) as CaspitContactsPage
    totalPages = data.TotalPages ?? 1
    const results = data.Results ?? []
    all.push(...results)

    console.log(
      `Fetched page ${data.CurrentPage ?? page} of ${totalPages} (${results.length} records, total: ${data.TotalCount ?? all.length})`
    )

    page += 1
  }

  return all
}

function filterTypeZero(contacts: CaspitContact[]): CaspitContact[] {
  const eligible = contacts.filter((c) => c.ContactType === 0)
  console.log(
    `Filtered ContactType=0: ${eligible.length} kept, ${contacts.length - eligible.length} discarded`
  )
  return eligible
}

function buildCaspitLookupMaps(contacts: CaspitContact[]): {
  byOsekMorshe: Map<string, string[]>
  byBusinessName: Map<string, string[]>
} {
  const byOsekMorshe = new Map<string, string[]>()
  const byBusinessName = new Map<string, string[]>()

  for (const contact of contacts) {
    const contactId = String(contact.ContactId)

    const osek = normalizeIdNumber(contact.OsekMorshe)
    if (osek) {
      addToLookupMap(byOsekMorshe, osek, contactId)
    }

    const businessName = contact.BusinessName?.trim()
    if (!isBlank(businessName)) {
      addToLookupMap(byBusinessName, businessName!, contactId)
    }
  }

  console.log(
    `Caspit lookup keys: ${byOsekMorshe.size} unique ח.פ., ${byBusinessName.size} unique BusinessName`
  )

  return { byOsekMorshe, byBusinessName }
}

// ==================== Supabase ====================

async function loadTargetCompany(
  supabase: SupabaseClient,
  companyId: string
): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load target company: ${error.message}`)
  }
  if (!data) {
    console.error(`Target company UUID not found in companies table: ${companyId}`)
    process.exit(1)
  }
  return data
}

async function loadCustomersNeedingBackfill(
  supabase: SupabaseClient,
  companyId: string
): Promise<CustomerRow[]> {
  const all: CustomerRow[] = []
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, id_number, customer_company!inner(company_id)')
      .eq('customer_company.company_id', companyId)
      .is('caspit_contact_id', null)
      .order('name', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      throw new Error(`Failed to load customers: ${error.message}`)
    }

    const rows = (data ?? []) as CustomerRow[]
    if (rows.length === 0) break

    all.push(...rows)

    if (rows.length < pageSize) break
    from += pageSize
  }

  return all
}

function resolveMatch(
  customer: CustomerRow,
  byOsekMorshe: Map<string, string[]>,
  byBusinessName: Map<string, string[]>
): ConfidentMatch | UnmatchedCustomer | AmbiguousMatch {
  const idNumberRaw = customer.id_number?.trim() || null
  const idNumberKey = normalizeIdNumber(customer.id_number)
  const customerName = customer.name?.trim() || ''

  if (idNumberKey) {
    const contactIds = byOsekMorshe.get(idNumberKey) ?? []
    if (contactIds.length === 1) {
      return {
        customerId: customer.id,
        customerName,
        idNumber: idNumberRaw,
        caspitContactId: contactIds[0],
        method: 'osek_morshe',
      }
    }
    if (contactIds.length > 1) {
      return {
        customerId: customer.id,
        customerName,
        idNumber: idNumberRaw,
        method: 'osek_morshe',
        lookupKey: idNumberKey,
        caspitContactIds: contactIds,
      }
    }
    return {
      customerId: customer.id,
      customerName,
      idNumber: idNumberRaw,
      reason: `no Caspit contact with OsekMorshe=${idNumberRaw ?? idNumberKey}`,
    }
  }

  if (isBlank(customerName)) {
    return {
      customerId: customer.id,
      customerName,
      idNumber: null,
      reason: 'customer has no id_number and no name',
    }
  }

  const contactIds = byBusinessName.get(customerName) ?? []
  if (contactIds.length === 1) {
    return {
      customerId: customer.id,
      customerName,
      idNumber: null,
      caspitContactId: contactIds[0],
      method: 'business_name',
    }
  }
  if (contactIds.length > 1) {
    return {
      customerId: customer.id,
      customerName,
      idNumber: null,
      method: 'business_name',
      lookupKey: customerName,
      caspitContactIds: contactIds,
    }
  }

  return {
    customerId: customer.id,
    customerName,
    idNumber: null,
    reason: `no Caspit contact with BusinessName="${customerName}"`,
  }
}

function isConfidentMatch(
  result: ConfidentMatch | UnmatchedCustomer | AmbiguousMatch
): result is ConfidentMatch {
  return 'caspitContactId' in result
}

function isAmbiguousMatch(
  result: ConfidentMatch | UnmatchedCustomer | AmbiguousMatch
): result is AmbiguousMatch {
  return 'caspitContactIds' in result
}

async function applyBackfill(
  supabase: SupabaseClient,
  matches: ConfidentMatch[],
  stats: BackfillStats
): Promise<void> {
  for (const match of matches) {
    if (!COMMIT) {
      continue
    }

    const { error } = await supabase
      .from('customers')
      .update({ caspit_contact_id: match.caspitContactId })
      .eq('id', match.customerId)
      .is('caspit_contact_id', null)

    if (error) {
      stats.errors.push({
        customerId: match.customerId,
        message: error.message,
      })
      continue
    }

    stats.updated += 1
  }
}

function printMatchTable(matches: ConfidentMatch[]): void {
  if (matches.length === 0) {
    console.log('\nNo confident matches.')
    return
  }

  console.log('\n=== Confident matches ===')
  console.table(
    matches.map((m) => ({
      customer_id: m.customerId,
      name: m.customerName,
      id_number: m.idNumber ?? '',
      caspit_contact_id: m.caspitContactId,
      method: m.method,
    }))
  )
}

function printUnmatchedList(unmatched: UnmatchedCustomer[]): void {
  if (unmatched.length === 0) {
    console.log('\nNo unmatched customers.')
    return
  }

  console.log('\n=== Unmatched customers ===')
  console.table(
    unmatched.map((u) => ({
      customer_id: u.customerId,
      name: u.customerName,
      id_number: u.idNumber ?? '',
      reason: u.reason,
    }))
  )
}

function printAmbiguousList(ambiguous: AmbiguousMatch[]): void {
  if (ambiguous.length === 0) {
    console.log('\nNo ambiguous matches.')
    return
  }

  console.log('\n=== Ambiguous matches (not updated) ===')
  console.table(
    ambiguous.map((a) => ({
      customer_id: a.customerId,
      name: a.customerName,
      id_number: a.idNumber ?? '',
      method: a.method,
      lookup_key: a.lookupKey,
      caspit_contact_ids: a.caspitContactIds.join(', '),
    }))
  )
}

function printSummary(stats: BackfillStats): void {
  const mode = COMMIT ? 'COMMIT' : 'DRY RUN'
  console.log(`\n=== Caspit contact ID backfill (${mode}) ===`)
  console.log(`Caspit contacts fetched:     ${stats.caspitFetched}`)
  console.log(`Caspit ContactType=0:        ${stats.caspitTypeZero}`)
  console.log(`Customers scanned:           ${stats.customersScanned}`)
  console.log(`Confident matches:           ${stats.matched}`)
  console.log(`Updated in DB:               ${stats.updated}`)
  console.log(`Unmatched:                   ${stats.unmatched.length}`)
  console.log(`Ambiguous:                   ${stats.ambiguous.length}`)
  console.log(`Errors:                      ${stats.errors.length}`)

  if (!COMMIT && stats.matched > 0) {
    console.log('\nRe-run with --commit to write caspit_contact_id for confident matches.')
  }

  if (stats.errors.length > 0) {
    console.log('\nErrors:')
    for (const err of stats.errors) {
      console.log(`  - ${err.customerId} → ${err.message}`)
    }
  }
}

// ==================== Main ====================

async function main(): Promise<void> {
  validateEnv()

  const companyId = IMPORT_TARGET_COMPANY_ID!
  const osekMorshe = CASPIT_OSEK_MORSHE!

  if (!COMMIT) {
    console.log('[DRY RUN] No DB writes will be performed. Pass --commit to apply updates.')
  } else {
    console.log('[COMMIT MODE] Will update customers.caspit_contact_id only.')
  }

  const caspitUsername = await input({ message: 'Caspit username:' })
  const caspitPassword = await password({ message: 'Caspit password:', mask: '*' })

  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!)

  const company = await loadTargetCompany(supabase, companyId)
  console.log(`Target company: ${company.id} — ${company.name}`)

  console.log('Authenticating with Caspit...')
  const token = await authCaspit(caspitUsername, caspitPassword, osekMorshe)
  console.log('Caspit authentication successful.')

  const allContacts = await fetchAllContacts(token)
  const typeZeroContacts = filterTypeZero(allContacts)
  const { byOsekMorshe, byBusinessName } = buildCaspitLookupMaps(typeZeroContacts)

  console.log('Loading customers with caspit_contact_id IS NULL...')
  const customers = await loadCustomersNeedingBackfill(supabase, companyId)
  console.log(`Found ${customers.length} customers to evaluate.`)

  const stats: BackfillStats = {
    caspitFetched: allContacts.length,
    caspitTypeZero: typeZeroContacts.length,
    customersScanned: customers.length,
    matched: 0,
    updated: 0,
    unmatched: [],
    ambiguous: [],
    errors: [],
  }

  const confidentMatches: ConfidentMatch[] = []

  for (const customer of customers) {
    const result = resolveMatch(customer, byOsekMorshe, byBusinessName)

    if (isConfidentMatch(result)) {
      confidentMatches.push(result)
      stats.matched += 1
    } else if (isAmbiguousMatch(result)) {
      stats.ambiguous.push(result)
    } else {
      stats.unmatched.push(result)
    }
  }

  printMatchTable(confidentMatches)
  printUnmatchedList(stats.unmatched)
  printAmbiguousList(stats.ambiguous)

  await applyBackfill(supabase, confidentMatches, stats)

  printSummary(stats)
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(message)
  process.exit(1)
})

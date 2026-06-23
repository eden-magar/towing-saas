// scripts/import-missing-caspit-customers.ts
// One-time insert of Caspit contacts not yet linked by caspit_contact_id
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
const SAMPLE_PREVIEW_LIMIT = 25

// ==================== Types ====================

interface CaspitContact {
  ContactId: string | number
  ContactType: number
  OsekMorshe?: string | null
  BusinessName?: string | null
  Name?: string | null
  Mobile?: string | null
  Phone?: string | null
  Email?: string | null
  Address1?: string | null
  Address2?: string | null
  City?: string | null
  Comments1?: string | null
  Comments2?: string | null
  Comments3?: string | null
}

interface CaspitContactsPage {
  CurrentPage: number
  TotalCount: number
  TotalPages: number
  Results: CaspitContact[]
}

interface InsertCandidate {
  name: string
  id_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  caspitContactId: string
}

interface BlankNameContact {
  caspitContactId: string
  nameFallback: string | null
  id_number: string | null
}

interface ImportError {
  caspitContactId: string
  name: string
  message: string
}

interface ImportStats {
  caspitFetched: number
  caspitTypeZero: number
  alreadyLinked: number
  missingEligible: number
  blankBusinessName: number
  inserted: number
  errors: ImportError[]
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

function buildAddress(contact: CaspitContact): string | null {
  const street = [contact.Address1, contact.Address2]
    .filter((s): s is string => Boolean(s && s.trim()))
    .map((s) => s.trim())
    .join(' ')
    .trim()
  const city = contact.City?.trim() || ''
  if (street && city) return `${street}, ${city}`
  return street || city || null
}

function buildNotes(contact: CaspitContact): string | null {
  const parts = [contact.Comments1, contact.Comments2, contact.Comments3]
    .filter((s): s is string => Boolean(s && s.trim()))
    .map((s) => s.trim())
  return parts.length > 0 ? parts.join('\n') : null
}

function buildInsertCandidate(contact: CaspitContact): InsertCandidate | null {
  const name = contact.BusinessName?.trim() || ''
  if (!name) return null

  const idNumber = contact.OsekMorshe?.trim() || null

  return {
    name,
    id_number: idNumber,
    phone: contact.Mobile?.trim() || contact.Phone?.trim() || null,
    email: contact.Email?.trim() || null,
    address: buildAddress(contact),
    notes: buildNotes(contact),
    caspitContactId: String(contact.ContactId),
  }
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

async function loadExistingCaspitContactIds(
  supabase: SupabaseClient,
  companyId: string
): Promise<Set<string>> {
  const ids = new Set<string>()
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('customers')
      .select('caspit_contact_id, customer_company!inner(company_id)')
      .eq('customer_company.company_id', companyId)
      .not('caspit_contact_id', 'is', null)
      .range(from, from + pageSize - 1)

    if (error) {
      throw new Error(`Failed to load existing caspit_contact_id values: ${error.message}`)
    }

    const rows = data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      const contactId = (row as { caspit_contact_id: string | null }).caspit_contact_id
      if (contactId) ids.add(String(contactId))
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  return ids
}

async function applyInsert(
  supabase: SupabaseClient,
  companyId: string,
  candidate: InsertCandidate,
  stats: ImportStats
): Promise<void> {
  const id = crypto.randomUUID()

  if (!COMMIT) {
    stats.inserted += 1
    return
  }

  const { error: customerError } = await supabase.from('customers').insert({
    id,
    customer_type: 'business',
    name: candidate.name,
    id_number: candidate.id_number,
    phone: candidate.phone,
    email: candidate.email,
    address: candidate.address,
    notes: candidate.notes,
    caspit_contact_id: candidate.caspitContactId,
  })

  if (customerError) {
    stats.errors.push({
      caspitContactId: candidate.caspitContactId,
      name: candidate.name,
      message: customerError.message,
    })
    return
  }

  const { error: relationError } = await supabase.from('customer_company').insert({
    customer_id: id,
    company_id: companyId,
    payment_terms: 'immediate',
    credit_limit: null,
    is_active: true,
  })

  if (relationError) {
    stats.errors.push({
      caspitContactId: candidate.caspitContactId,
      name: candidate.name,
      message: relationError.message,
    })
    return
  }

  stats.inserted += 1
}

function printInsertPreview(candidates: InsertCandidate[]): void {
  if (candidates.length === 0) {
    console.log('\nNo missing Caspit contacts eligible for insert.')
    return
  }

  const preview = candidates.slice(0, SAMPLE_PREVIEW_LIMIT)
  console.log(
    `\n=== Would insert (${candidates.length} total, showing first ${preview.length}) ===`
  )
  console.table(
    preview.map((c) => ({
      name: c.name,
      id_number: c.id_number ?? '',
      contact_id: c.caspitContactId,
    }))
  )

  if (candidates.length > preview.length) {
    console.log(`... and ${candidates.length - preview.length} more`)
  }
}

function printBlankBusinessNameList(contacts: BlankNameContact[]): void {
  if (contacts.length === 0) {
    console.log('\nNo missing Caspit contacts with blank BusinessName.')
    return
  }

  console.log(
    `\n=== Missing contacts with blank BusinessName (${contacts.length}) — not inserted ===`
  )
  console.table(
    contacts.map((c) => ({
      contact_id: c.caspitContactId,
      name_fallback: c.nameFallback ?? '',
      id_number: c.id_number ?? '',
    }))
  )
  console.log('Review these manually before deciding whether to import them.')
}

function printSummary(stats: ImportStats): void {
  const mode = COMMIT ? 'COMMIT' : 'DRY RUN'
  console.log(`\n=== Import missing Caspit customers (${mode}) ===`)
  console.log(`Caspit contacts fetched:       ${stats.caspitFetched}`)
  console.log(`Caspit ContactType=0:          ${stats.caspitTypeZero}`)
  console.log(`Already linked in DB:          ${stats.alreadyLinked}`)
  console.log(`Missing (eligible to insert):  ${stats.missingEligible}`)
  console.log(`Blank BusinessName (skipped):  ${stats.blankBusinessName}`)
  console.log(`Inserted:                      ${stats.inserted}`)
  console.log(`Errors:                        ${stats.errors.length}`)

  if (!COMMIT && stats.missingEligible > 0) {
    console.log('\nRe-run with --commit to insert missing customers.')
  }

  if (stats.errors.length > 0) {
    console.log('\nErrors:')
    for (const err of stats.errors) {
      console.log(`  - ${err.caspitContactId} "${err.name}" → ${err.message}`)
    }
  }
}

// ==================== Main ====================

async function main(): Promise<void> {
  validateEnv()

  const companyId = IMPORT_TARGET_COMPANY_ID!
  const osekMorshe = CASPIT_OSEK_MORSHE!

  if (!COMMIT) {
    console.log('[DRY RUN] No DB writes will be performed. Pass --commit to insert.')
  } else {
    console.log('[COMMIT MODE] Will INSERT new customers only (no updates).')
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

  console.log('Loading existing caspit_contact_id values for company...')
  const existingContactIds = await loadExistingCaspitContactIds(supabase, companyId)
  console.log(`Found ${existingContactIds.size} caspit_contact_id values already in DB.`)

  const stats: ImportStats = {
    caspitFetched: allContacts.length,
    caspitTypeZero: typeZeroContacts.length,
    alreadyLinked: 0,
    missingEligible: 0,
    blankBusinessName: 0,
    inserted: 0,
    errors: [],
  }

  const toInsert: InsertCandidate[] = []
  const blankBusinessNames: BlankNameContact[] = []

  for (const contact of typeZeroContacts) {
    const contactId = String(contact.ContactId)

    if (existingContactIds.has(contactId)) {
      stats.alreadyLinked += 1
      continue
    }

    const candidate = buildInsertCandidate(contact)
    if (!candidate) {
      stats.blankBusinessName += 1
      blankBusinessNames.push({
        caspitContactId: contactId,
        nameFallback: contact.Name?.trim() || null,
        id_number: contact.OsekMorshe?.trim() || null,
      })
      continue
    }

    toInsert.push(candidate)
    stats.missingEligible += 1
  }

  printInsertPreview(toInsert)
  printBlankBusinessNameList(blankBusinessNames)

  for (const candidate of toInsert) {
    await applyInsert(supabase, companyId, candidate, stats)
  }

  printSummary(stats)
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(message)
  process.exit(1)
})

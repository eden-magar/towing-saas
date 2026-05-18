// scripts/import-caspit-customers.ts
// One-time import of Caspit (כספית) contacts into customers + customer_company
import { config } from 'dotenv'
config({ path: '.env.local' })

import { input, password } from '@inquirer/prompts'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CASPIT_OSEK_MORSHE = process.env.CASPIT_OSEK_MORSHE
const IMPORT_TARGET_COMPANY_ID = process.env.IMPORT_TARGET_COMPANY_ID
const DRY_RUN =
  process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1'

const CASPIT_TOKEN_URL = 'https://app.caspit.biz/api/v1/token/'
const CASPIT_CONTACTS_URL = 'https://app.caspit.biz/api/v1/contacts'

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

interface ImportCandidate {
  name: string
  id_number: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  caspitContactId: string
}

interface ExistingCustomerRow {
  id: string
  name: string
  id_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  customer_company: {
    id: string
    company_id: string
    is_active: boolean
  }[]
}

interface ExistingEntry {
  customer: ExistingCustomerRow
  junction: { id: string; company_id: string; is_active: boolean }
}

interface ImportError {
  caspitContactId: string
  name: string
  message: string
}

interface ImportStats {
  fetched: number
  eligible: number
  skippedNoName: number
  inserted: number
  enriched: number
  reactivated: number
  skippedUnchanged: number
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

function actionLog(message: string): void {
  console.log(DRY_RUN ? `[DRY-RUN] ${message}` : message)
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

function buildCandidate(contact: CaspitContact): ImportCandidate | null {
  const name = (contact.BusinessName?.trim() || contact.Name?.trim() || '').trim()
  if (!name) return null

  return {
    name,
    id_number: contact.OsekMorshe!.trim(),
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

function filterEligible(contacts: CaspitContact[]): CaspitContact[] {
  const eligible = contacts.filter(
    (c) => c.ContactType === 0 && !isBlank(c.OsekMorshe)
  )
  const discarded = contacts.length - eligible.length
  console.log(
    `Filtered eligible contacts: ${eligible.length} kept, ${discarded} discarded (not type 0 or missing ח.פ.)`
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
    console.error(
      `Target company UUID not found in companies table: ${companyId}`
    )
    process.exit(1)
  }
  return data
}

async function loadExistingByIdNumber(
  supabase: SupabaseClient,
  companyId: string,
  idNumbers: string[]
): Promise<Map<string, ExistingEntry>> {
  const map = new Map<string, ExistingEntry>()
  if (idNumbers.length === 0) return map

  const { data, error } = await supabase
    .from('customers')
    .select(
      'id, name, id_number, phone, email, address, notes, customer_company!inner(id, company_id, is_active)'
    )
    .in('id_number', idNumbers)
    .eq('customer_company.company_id', companyId)

  if (error) {
    throw new Error(`Dedupe lookup failed: ${error.message}`)
  }

  for (const row of (data ?? []) as ExistingCustomerRow[]) {
    if (!row.id_number) continue
    const key = row.id_number
    const junctions = row.customer_company ?? []
    if (junctions.length === 0) continue

    if (map.has(key)) {
      console.warn(
        `Warning: multiple customers with id_number ${key} for company ${companyId}; using first match`
      )
      continue
    }

    map.set(key, {
      customer: row,
      junction: junctions[0],
    })
  }

  return map
}

function buildFillBlanksUpdate(
  existing: ExistingCustomerRow,
  candidate: ImportCandidate
): Record<string, string> {
  const updates: Record<string, string> = {}

  if (isBlank(existing.name) && candidate.name) {
    updates.name = candidate.name
  }
  if (isBlank(existing.phone) && candidate.phone) {
    updates.phone = candidate.phone
  }
  if (isBlank(existing.email) && candidate.email) {
    updates.email = candidate.email
  }
  if (isBlank(existing.address) && candidate.address) {
    updates.address = candidate.address
  }
  if (isBlank(existing.notes) && candidate.notes) {
    updates.notes = candidate.notes
  }

  return updates
}

async function applyExisting(
  supabase: SupabaseClient,
  existing: ExistingEntry,
  candidate: ImportCandidate,
  stats: ImportStats
): Promise<void> {
  const { customer, junction } = existing
  const fillUpdates = buildFillBlanksUpdate(customer, candidate)
  const needsReactivate = junction.is_active === false
  const fieldNames = Object.keys(fillUpdates)

  if (fieldNames.length === 0 && !needsReactivate) {
    stats.skippedUnchanged += 1
    return
  }

  if (DRY_RUN) {
    actionLog(
      `WOULD UPDATE customer ${customer.id}: fields=[${fieldNames.join(', ') || 'none'}] reactivate=${needsReactivate}`
    )
    if (fieldNames.length > 0) stats.enriched += 1
    if (needsReactivate) stats.reactivated += 1
    return
  }

  if (fieldNames.length > 0) {
    const { error } = await supabase
      .from('customers')
      .update(fillUpdates)
      .eq('id', customer.id)

    if (error) {
      stats.errors.push({
        caspitContactId: candidate.caspitContactId,
        name: candidate.name,
        message: error.message,
      })
      return
    }
    stats.enriched += 1
  }

  if (needsReactivate) {
    const { error } = await supabase
      .from('customer_company')
      .update({ is_active: true })
      .eq('id', junction.id)

    if (error) {
      stats.errors.push({
        caspitContactId: candidate.caspitContactId,
        name: candidate.name,
        message: error.message,
      })
      return
    }
    stats.reactivated += 1
  }
}

async function applyInsert(
  supabase: SupabaseClient,
  companyId: string,
  candidate: ImportCandidate,
  stats: ImportStats
): Promise<void> {
  const id = crypto.randomUUID()

  if (DRY_RUN) {
    actionLog(
      `WOULD INSERT customer name="${candidate.name}" id_number=${candidate.id_number}`
    )
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

function printSummary(stats: ImportStats): void {
  const prefix = DRY_RUN ? '[DRY-RUN] (no DB changes made)\n' : ''
  console.log(`${prefix}=== Caspit Import Results ===`)
  console.log(`Fetched from Caspit:           ${stats.fetched}`)
  console.log(`Eligible (type=0 + ח.פ.):      ${stats.eligible}`)
  console.log(`Skipped (no name):             ${stats.skippedNoName}`)
  console.log(`Inserted (new):                ${stats.inserted}`)
  console.log(`Enriched (filled blanks):      ${stats.enriched}`)
  console.log(`Reactivated junction:          ${stats.reactivated}`)
  console.log(`Skipped (unchanged):           ${stats.skippedUnchanged}`)
  console.log(`Errors:                        ${stats.errors.length}`)

  if (stats.errors.length > 0) {
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

  const caspitUsername = await input({ message: 'Caspit username:' })
  const caspitPassword = await password({ message: 'Caspit password:', mask: '*' })

  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!)

  const company = await loadTargetCompany(supabase, companyId)
  console.log(`Target company: ${company.id} — ${company.name}`)

  if (DRY_RUN) {
    console.log('[DRY-RUN MODE] No DB writes will be performed.')
  }

  console.log('Authenticating with Caspit...')
  const token = await authCaspit(caspitUsername, caspitPassword, osekMorshe)
  console.log('Caspit authentication successful.')

  const allContacts = await fetchAllContacts(token)

  const stats: ImportStats = {
    fetched: allContacts.length,
    eligible: 0,
    skippedNoName: 0,
    inserted: 0,
    enriched: 0,
    reactivated: 0,
    skippedUnchanged: 0,
    errors: [],
  }

  const eligible = filterEligible(allContacts)
  stats.eligible = eligible.length

  const candidates: ImportCandidate[] = []
  for (const contact of eligible) {
    const candidate = buildCandidate(contact)
    if (!candidate) {
      stats.skippedNoName += 1
      continue
    }
    candidates.push(candidate)
  }

  const idNumbers = [...new Set(candidates.map((c) => c.id_number))]
  console.log(`Loading existing customers for ${idNumbers.length} unique ח.פ. values...`)
  const existingMap = await loadExistingByIdNumber(supabase, companyId, idNumbers)

  for (const candidate of candidates) {
    const existing = existingMap.get(candidate.id_number)
    if (existing) {
      await applyExisting(supabase, existing, candidate, stats)
    } else {
      await applyInsert(supabase, companyId, candidate, stats)
    }
  }

  printSummary(stats)
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(message)
  process.exit(1)
})

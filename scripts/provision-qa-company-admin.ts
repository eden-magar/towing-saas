/**
 * One-off: provision a QA company_admin for גרר גולן בע"מ.
 *
 * Pattern matches app/api/users/route.ts and app/api/admin/create-company/route.ts:
 *   supabase.auth.admin.createUser({ email, password, email_confirm: true })
 *   then insert into public.users (id = auth user id, role, company_id, …).
 *
 * Env (from .env.local, same as other scripts / service-role API routes):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   npx tsx scripts/provision-qa-company-admin.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient, type SupabaseClient, type User as AuthUser } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const TARGET_EMAIL = 'Inbal.bleicher@gmail.com'
const TARGET_PASSWORD = '123456'
const TARGET_FULL_NAME = 'Inbal Bleicher'
/** Company-level dashboard admin (מנהל) — not dispatcher (מוקדן), not super_admin. */
const TARGET_ROLE = 'company_admin' as const
/** גרר גולן בע"מ — lookup by id (name contains quotes / בע"מ). */
const TARGET_COMPANY_ID = 'dc07595b-8dfc-4dea-ac72-3662b9d4c76a'

function validateEnv(): void {
  const missing: string[] = []
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!SUPABASE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')

  if (missing.length > 0) {
    console.error('Missing required environment variables in .env.local:')
    for (const key of missing) {
      console.error(`  - ${key}`)
    }
    process.exit(1)
  }
}

async function findAuthUserByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<AuthUser | null> {
  const normalized = email.toLowerCase()
  let page = 1
  const perPage = 200

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`)
    }

    const users = data.users ?? []
    const match = users.find((u) => (u.email ?? '').toLowerCase() === normalized)
    if (match) return match

    if (users.length < perPage) return null
    page += 1
  }
}

async function main(): Promise<void> {
  validateEnv()

  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!)

  // Resolve company by exact id — fail if missing
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', TARGET_COMPANY_ID)
    .maybeSingle()

  if (companyError) {
    throw new Error(`Failed to look up company: ${companyError.message}`)
  }

  if (!company) {
    throw new Error(
      `Company not found: id "${TARGET_COMPANY_ID}". Aborting.`
    )
  }

  let action: 'created' | 'updated' = 'created'
  let authUserId: string

  const { data: createdAuth, error: createAuthError } =
    await supabase.auth.admin.createUser({
      email: TARGET_EMAIL,
      password: TARGET_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: TARGET_FULL_NAME,
      },
    })

  if (createAuthError) {
    const msg = createAuthError.message ?? ''
    const alreadyExists =
      createAuthError.code === 'email_exists' ||
      msg.toLowerCase().includes('already been registered') ||
      msg.toLowerCase().includes('already exists')

    if (!alreadyExists) {
      throw new Error(`Auth createUser failed: ${msg}`)
    }

    const existingAuth = await findAuthUserByEmail(supabase, TARGET_EMAIL)
    if (!existingAuth) {
      throw new Error(
        `Auth reports email already registered, but listUsers could not find ${TARGET_EMAIL}`
      )
    }

    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(
      existingAuth.id,
      {
        password: TARGET_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: TARGET_FULL_NAME,
        },
      }
    )

    if (updateAuthError) {
      throw new Error(`Auth updateUserById failed: ${updateAuthError.message}`)
    }

    authUserId = existingAuth.id
    action = 'updated'
    console.log(`Auth user already existed — updated password / email_confirm for ${TARGET_EMAIL}`)
  } else {
    if (!createdAuth.user) {
      throw new Error('Auth createUser succeeded but returned no user')
    }
    authUserId = createdAuth.user.id
    console.log(`Auth user created: ${authUserId}`)
  }

  // public.users — same columns as /api/users and create-company
  const { data: existingRow } = await supabase
    .from('users')
    .select('id, email, role, company_id, is_active')
    .eq('id', authUserId)
    .maybeSingle()

  if (existingRow) {
    const { error: updateError } = await supabase
      .from('users')
      .update({
        email: TARGET_EMAIL,
        full_name: TARGET_FULL_NAME,
        role: TARGET_ROLE,
        company_id: company.id,
        is_active: true,
      })
      .eq('id', authUserId)

    if (updateError) {
      throw new Error(`public.users update failed: ${updateError.message}`)
    }
    action = 'updated'
    console.log('public.users row updated')
  } else {
    // Also check by email in case of orphan/mismatch
    const { data: byEmail } = await supabase
      .from('users')
      .select('id')
      .ilike('email', TARGET_EMAIL)
      .maybeSingle()

    if (byEmail && byEmail.id !== authUserId) {
      throw new Error(
        `public.users already has email ${TARGET_EMAIL} under id ${byEmail.id}, ` +
          `but auth user id is ${authUserId}. Resolve manually.`
      )
    }

    const { error: insertError } = await supabase.from('users').insert({
      id: authUserId,
      email: TARGET_EMAIL,
      full_name: TARGET_FULL_NAME,
      phone: null,
      role: TARGET_ROLE,
      company_id: company.id,
      is_active: true,
    })

    if (insertError) {
      throw new Error(`public.users insert failed: ${insertError.message}`)
    }
    console.log('public.users row inserted')
  }

  console.log('\n=== Summary ===')
  console.log(`email:          ${TARGET_EMAIL}`)
  console.log(`password:       (set to provided QA password)`)
  console.log(`role:           ${TARGET_ROLE}`)
  console.log(`company:        ${company.name}`)
  console.log(`company_id:     ${company.id}`)
  console.log(`auth user id:   ${authUserId}`)
  console.log(`action:         ${action}`)
  console.log('Login: /login → should land on /dashboard')
}

main().catch((err) => {
  console.error('\nFAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})

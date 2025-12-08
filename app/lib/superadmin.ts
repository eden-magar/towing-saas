import { supabase } from './supabase'

// ==================== Types ====================

export interface SubscriptionPlan {
  id: string
  name: string
  display_name: string
  price_monthly: number
  price_yearly: number | null
  max_users: number | null
  max_drivers: number | null
  max_trucks: number | null
  max_tows_per_month: number | null
  features: string[]
  is_active: boolean
  sort_order: number
}

export interface CompanyWithSubscription {
  id: string
  name: string
  business_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  logo_url: string | null
  website: string | null
  status: 'trial' | 'active' | 'suspended' | 'cancelled'
  is_active: boolean
  created_at: string
  subscription: {
    id: string
    status: string
    plan: SubscriptionPlan
    trial_ends_at: string | null
    next_billing_date: string | null
  } | null
  stats: {
    users_count: number
    drivers_count: number
    trucks_count: number
    tows_this_month: number
  }
}

export interface CompanyDetails extends CompanyWithSubscription {
  users: CompanyUser[]
  billing_history: BillingRecord[]
  recent_activity: ActivityLogEntry[]
}

export interface CompanyUser {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: string
  is_active: boolean
  last_sign_in_at: string | null
  created_at: string
}

export interface BillingRecord {
  id: string
  invoice_number: string
  amount: number
  total_amount: number
  status: string
  billing_period_start: string | null
  billing_period_end: string | null
  paid_at: string | null
  created_at: string
}

export interface ActivityLogEntry {
  id: string
  user_id: string
  user_name: string | null
  action: string
  table_name: string | null
  old_values: any
  new_values: any
  created_at: string
}

export interface DashboardStats {
  companies: {
    total: number
    active: number
    trial: number
    suspended: number
    new_this_month: number
  }
  users: {
    total: number
    active: number
  }
  tows: {
    total: number
    this_month: number
    last_month: number
  }
  revenue: {
    this_month: number
    last_month: number
    growth_percent: number
  }
}

export interface ImpersonationSession {
  id: string
  super_admin_id: string
  target_company_id: string
  target_user_id: string | null
  started_at: string
  ended_at: string | null
  actions_count: number
  reason: string | null
}

// ==================== Dashboard ====================

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()

  // Companies stats
  const { data: companies } = await supabase
    .from('companies')
    .select('id, status, created_at')

  const companiesStats = {
    total: companies?.length || 0,
    active: companies?.filter(c => c.status === 'active').length || 0,
    trial: companies?.filter(c => c.status === 'trial').length || 0,
    suspended: companies?.filter(c => c.status === 'suspended').length || 0,
    new_this_month: companies?.filter(c => c.created_at >= startOfMonth).length || 0
  }

  // Users stats
  const { count: totalUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .neq('role', 'super_admin')

  const { count: activeUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .neq('role', 'super_admin')
    .eq('is_active', true)

  // Tows stats
  const { count: totalTows } = await supabase
    .from('tows')
    .select('*', { count: 'exact', head: true })

  const { count: towsThisMonth } = await supabase
    .from('tows')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonth)

  const { count: towsLastMonth } = await supabase
    .from('tows')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfLastMonth)
    .lt('created_at', startOfMonth)

  // Revenue stats (from billing_history)
  const { data: revenueThisMonth } = await supabase
    .from('billing_history')
    .select('total_amount')
    .eq('status', 'paid')
    .gte('paid_at', startOfMonth)

  const { data: revenueLastMonth } = await supabase
    .from('billing_history')
    .select('total_amount')
    .eq('status', 'paid')
    .gte('paid_at', startOfLastMonth)
    .lt('paid_at', startOfMonth)

  const thisMonthRevenue = revenueThisMonth?.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0
  const lastMonthRevenue = revenueLastMonth?.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0
  const growthPercent = lastMonthRevenue > 0 
    ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
    : 0

  return {
    companies: companiesStats,
    users: {
      total: totalUsers || 0,
      active: activeUsers || 0
    },
    tows: {
      total: totalTows || 0,
      this_month: towsThisMonth || 0,
      last_month: towsLastMonth || 0
    },
    revenue: {
      this_month: thisMonthRevenue,
      last_month: lastMonthRevenue,
      growth_percent: growthPercent
    }
  }
}

export async function getRecentCompanies(limit: number = 5): Promise<CompanyWithSubscription[]> {
  const { data: companies, error } = await supabase
    .from('companies')
    .select(`
      *,
      subscription:company_subscriptions (
        id,
        status,
        trial_ends_at,
        next_billing_date,
        plan:subscription_plans (*)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching recent companies:', error)
    return []
  }

  // Add stats for each company
  const companiesWithStats = await Promise.all(
    (companies || []).map(async (company) => {
      const stats = await getCompanyStats(company.id)
      return {
        ...company,
        subscription: company.subscription?.[0] || null,
        stats
      }
    })
  )

  return companiesWithStats
}

export async function getTopCompanies(limit: number = 5) {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .eq('status', 'active')

  if (!companies) return []

  const companiesWithTows = await Promise.all(
    companies.map(async (company) => {
      const { count } = await supabase
        .from('tows')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .gte('created_at', startOfMonth)

      return {
        ...company,
        tows_this_month: count || 0
      }
    })
  )

  return companiesWithTows
    .sort((a, b) => b.tows_this_month - a.tows_this_month)
    .slice(0, limit)
}

// ==================== Companies ====================

export async function getCompanies(filters?: {
  status?: string
  plan?: string
  search?: string
}): Promise<CompanyWithSubscription[]> {
  let query = supabase
    .from('companies')
    .select(`
      *,
      subscription:company_subscriptions (
        id,
        status,
        trial_ends_at,
        next_billing_date,
        plan:subscription_plans (*)
      )
    `)
    .order('created_at', { ascending: false })

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`)
  }

  const { data: companies, error } = await query

  if (error) {
    console.error('Error fetching companies:', error)
    return []
  }

  // Filter by plan if needed
  let filteredCompanies = companies || []
  if (filters?.plan && filters.plan !== 'all') {
    filteredCompanies = filteredCompanies.filter(
      c => c.subscription?.[0]?.plan?.name === filters.plan
    )
  }

  // Add stats for each company
  const companiesWithStats = await Promise.all(
    filteredCompanies.map(async (company) => {
      const stats = await getCompanyStats(company.id)
      return {
        ...company,
        subscription: company.subscription?.[0] || null,
        stats
      }
    })
  )

  return companiesWithStats
}

export async function getCompanyStats(companyId: string) {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [users, drivers, trucks, tows] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('tow_trucks').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('tows').select('*', { count: 'exact', head: true }).eq('company_id', companyId).gte('created_at', startOfMonth)
  ])

  return {
    users_count: users.count || 0,
    drivers_count: drivers.count || 0,
    trucks_count: trucks.count || 0,
    tows_this_month: tows.count || 0
  }
}

export async function getCompanyById(companyId: string): Promise<CompanyDetails | null> {
  // Get company with subscription
  const { data: company, error } = await supabase
    .from('companies')
    .select(`
      *,
      subscription:company_subscriptions (
        id,
        status,
        trial_ends_at,
        trial_started_at,
        next_billing_date,
        billing_cycle,
        suspended_at,
        suspended_reason,
        plan:subscription_plans (*)
      )
    `)
    .eq('id', companyId)
    .single()

  if (error || !company) {
    console.error('Error fetching company:', error)
    return null
  }

  // Get users
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email, phone, role, is_active, last_sign_in_at, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  // Get billing history
  const { data: billing } = await supabase
    .from('billing_history')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(10)

  // Get recent activity
  const { data: activity } = await supabase
    .from('audit_log')
    .select(`
      id,
      user_id,
      action,
      table_name,
      old_values,
      new_values,
      created_at
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(20)

  // Add user names to activity
  const activityWithNames = await Promise.all(
    (activity || []).map(async (log) => {
      if (log.user_id) {
        const { data: user } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', log.user_id)
          .single()
        return { ...log, user_name: user?.full_name || null }
      }
      return { ...log, user_name: null }
    })
  )

  const stats = await getCompanyStats(companyId)

  return {
    ...company,
    subscription: company.subscription?.[0] || null,
    stats,
    users: users || [],
    billing_history: billing || [],
    recent_activity: activityWithNames
  }
}

// ==================== Company Management ====================

export async function createCompany(data: {
  name: string
  business_number?: string
  phone?: string
  email?: string
  address?: string
  website?: string
  plan_id: string
  admin_name: string
  admin_email: string
  admin_phone?: string
  send_invite: boolean
  admin_password?: string
}) {
  // 1. Create company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({
      name: data.name,
      business_number: data.business_number,
      phone: data.phone,
      email: data.email,
      address: data.address,
      website: data.website,
      status: 'trial',
      is_active: true
    })
    .select()
    .single()

  if (companyError || !company) {
    console.error('Error creating company:', companyError)
    throw new Error('שגיאה ביצירת החברה')
  }

  // 2. Create subscription
  const trialEnds = new Date()
  trialEnds.setDate(trialEnds.getDate() + 14)

  const { error: subError } = await supabase
    .from('company_subscriptions')
    .insert({
      company_id: company.id,
      plan_id: data.plan_id,
      status: 'trial',
      trial_started_at: new Date().toISOString(),
      trial_ends_at: trialEnds.toISOString()
    })

  if (subError) {
    console.error('Error creating subscription:', subError)
    // Rollback company creation
    await supabase.from('companies').delete().eq('id', company.id)
    throw new Error('שגיאה ביצירת המנוי')
  }

  // 3. Create admin user via Supabase Auth
  if (data.send_invite) {
    // Send magic link / invite
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(data.admin_email, {
      data: {
        full_name: data.admin_name,
        phone: data.admin_phone,
        company_id: company.id,
        role: 'company_admin'
      }
    })
    
    if (inviteError) {
      console.error('Error inviting admin:', inviteError)
      // Don't rollback - company is created, admin can be added later
    }
  } else if (data.admin_password) {
    // Create user with password
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: data.admin_email,
      password: data.admin_password,
      email_confirm: true,
      user_metadata: {
        full_name: data.admin_name,
        phone: data.admin_phone
      }
    })

    if (authError) {
      console.error('Error creating admin user:', authError)
    } else if (authUser.user) {
      // Create user record
      await supabase.from('users').insert({
        id: authUser.user.id,
        email: data.admin_email,
        full_name: data.admin_name,
        phone: data.admin_phone,
        company_id: company.id,
        role: 'company_admin',
        is_active: true
      })
    }
  }

  // 4. Create company_settings
  await supabase.from('company_settings').insert({
    company_id: company.id
  })

  return company
}

export async function updateCompany(companyId: string, data: Partial<{
  name: string
  business_number: string
  phone: string
  email: string
  address: string
  website: string
  status: string
}>) {
  const { error } = await supabase
    .from('companies')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', companyId)

  if (error) {
    console.error('Error updating company:', error)
    throw new Error('שגיאה בעדכון החברה')
  }

  return true
}

export async function suspendCompany(companyId: string, reason: string, userId: string) {
  // Update company status
  const { error: companyError } = await supabase
    .from('companies')
    .update({ status: 'suspended', updated_at: new Date().toISOString() })
    .eq('id', companyId)

  if (companyError) throw new Error('שגיאה בהשעיית החברה')

  // Update subscription
  const { error: subError } = await supabase
    .from('company_subscriptions')
    .update({
      status: 'suspended',
      suspended_at: new Date().toISOString(),
      suspended_reason: reason,
      suspended_by: userId
    })
    .eq('company_id', companyId)

  if (subError) throw new Error('שגיאה בעדכון המנוי')

  // Log action
  await supabase.from('audit_log').insert({
    user_id: userId,
    company_id: companyId,
    action: 'company_suspended',
    table_name: 'companies',
    record_id: companyId,
    new_values: { status: 'suspended', reason }
  })

  return true
}

export async function activateCompany(companyId: string, userId: string) {
  // Update company status
  const { error: companyError } = await supabase
    .from('companies')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', companyId)

  if (companyError) throw new Error('שגיאה בהפעלת החברה')

  // Update subscription
  const { error: subError } = await supabase
    .from('company_subscriptions')
    .update({
      status: 'active',
      suspended_at: null,
      suspended_reason: null,
      suspended_by: null
    })
    .eq('company_id', companyId)

  if (subError) throw new Error('שגיאה בעדכון המנוי')

  // Log action
  await supabase.from('audit_log').insert({
    user_id: userId,
    company_id: companyId,
    action: 'company_activated',
    table_name: 'companies',
    record_id: companyId,
    new_values: { status: 'active' }
  })

  return true
}

// ==================== Subscription Plans ====================

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching plans:', error)
    return []
  }

  return data || []
}

export async function updateSubscriptionPlan(planId: string, data: Partial<SubscriptionPlan>) {
  const { error } = await supabase
    .from('subscription_plans')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', planId)

  if (error) {
    console.error('Error updating plan:', error)
    throw new Error('שגיאה בעדכון החבילה')
  }

  return true
}

// ==================== Impersonation ====================

export async function startImpersonation(superAdminId: string, companyId: string, reason?: string) {
  const { data, error } = await supabase
    .from('impersonation_sessions')
    .insert({
      super_admin_id: superAdminId,
      target_company_id: companyId,
      reason,
      started_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    console.error('Error starting impersonation:', error)
    throw new Error('שגיאה בהתחלת ההתחזות')
  }

  // Log action
  await supabase.from('audit_log').insert({
    user_id: superAdminId,
    company_id: companyId,
    action: 'impersonation_started',
    table_name: 'impersonation_sessions',
    record_id: data.id,
    new_values: { reason }
  })

  return data
}

export async function endImpersonation(sessionId: string, superAdminId: string) {
  const { data, error } = await supabase
    .from('impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select()
    .single()

  if (error) {
    console.error('Error ending impersonation:', error)
    throw new Error('שגיאה בסיום ההתחזות')
  }

  // Log action
  await supabase.from('audit_log').insert({
    user_id: superAdminId,
    company_id: data.target_company_id,
    action: 'impersonation_ended',
    table_name: 'impersonation_sessions',
    record_id: sessionId,
    new_values: { actions_count: data.actions_count }
  })

  return data
}

export async function getActiveImpersonation(superAdminId: string) {
  const { data } = await supabase
    .from('impersonation_sessions')
    .select(`
      *,
      company:companies (id, name)
    `)
    .eq('super_admin_id', superAdminId)
    .is('ended_at', null)
    .maybeSingle()

  return data
}

// ==================== Audit Log ====================

export async function getAuditLog(filters?: {
  company_id?: string
  user_id?: string
  action?: string
  limit?: number
}) {
  let query = supabase
    .from('audit_log')
    .select(`
      *,
      user:users (full_name, email)
    `)
    .order('created_at', { ascending: false })

  if (filters?.company_id) {
    query = query.eq('company_id', filters.company_id)
  }
  if (filters?.user_id) {
    query = query.eq('user_id', filters.user_id)
  }
  if (filters?.action) {
    query = query.eq('action', filters.action)
  }
  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching audit log:', error)
    return []
  }

  return data || []
}

// ==================== Check Super Admin ====================

export async function checkIsSuperAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (error || !data) return false
  return data.role === 'super_admin'
}
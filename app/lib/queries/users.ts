import { supabase } from '../supabase'

// ==================== TYPES ====================

export type UserRole = 'super_admin' | 'company_admin' | 'dispatcher' | 'driver'
export type UserStatus = 'active' | 'pending' | 'disabled'

export interface SystemUser {
  id: string
  email: string
  phone: string | null
  full_name: string
  role: UserRole
  company_id: string | null
  is_active: boolean
  id_number: string | null
  address: string | null
  created_at: string
  updated_at: string
  // Computed fields
  last_sign_in_at?: string | null
  email_confirmed_at?: string | null
}

export interface UserWithDetails extends SystemUser {
  driver?: {
    id: string
    status: string
    license_number: string | null
  } | null
}

export interface UserStats {
  total: number
  active: number
  pending: number
  disabled: number
}

// ==================== GET USERS ====================

export async function getUsers(companyId: string): Promise<UserWithDetails[]> {
  const { data: users, error } = await supabase
    .from('users')
    .select(`
      *,
      driver:drivers(id, status, license_number)
    `)
    .eq('company_id', companyId)
    .neq('role', 'customer')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching users:', error)
    throw error
  }

  // Get auth data for last sign in
  // Note: This requires service_role key, so we'll skip it for now
  // and just return the users data

  return (users || []).map(user => {
    const driverData = user.driver as unknown
    const driver = Array.isArray(driverData) ? driverData[0] : driverData

    return {
      ...user,
      driver: driver || null,
      last_sign_in_at: null, // Will be populated when we have admin access
      email_confirmed_at: null
    }
  })
}

// ==================== GET SINGLE USER ====================

export async function getUser(userId: string): Promise<UserWithDetails | null> {
  const { data: user, error } = await supabase
    .from('users')
    .select(`
      *,
      driver:drivers(id, status, license_number)
    `)
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching user:', error)
    return null
  }

  const driverData = user.driver as unknown
  const driver = Array.isArray(driverData) ? driverData[0] : driverData

  return {
    ...user,
    driver: driver || null,
    last_sign_in_at: null,
    email_confirmed_at: null
  }
}

// ==================== GET USER STATS ====================

export async function getUserStats(companyId: string): Promise<UserStats> {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, is_active, role')
    .eq('company_id', companyId)
    .neq('role', 'customer')

  if (error) {
    console.error('Error fetching user stats:', error)
    throw error
  }

  const total = users?.length || 0
  const active = users?.filter(u => u.is_active).length || 0
  const disabled = users?.filter(u => !u.is_active).length || 0
  // For now, pending = 0 since we don't have email verification yet
  const pending = 0

  return { total, active, pending, disabled }
}

// ==================== CREATE USER ====================

interface CreateUserInput {
  email: string
  password: string
  full_name: string
  phone?: string
  role: UserRole
  company_id: string
  id_number?: string
  address?: string
}

export async function createUser(input: CreateUserInput): Promise<{ id: string }> {
  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.full_name,
        role: input.role
      }
    }
  })

  if (authError) {
    console.error('Error creating auth user:', authError)
    throw authError
  }

  if (!authData.user) {
    throw new Error('Failed to create user')
  }

  const userId = authData.user.id

  // 2. Insert into users table
  const { error: userError } = await supabase
    .from('users')
    .insert({
      id: userId,
      email: input.email,
      full_name: input.full_name,
      phone: input.phone || null,
      role: input.role,
      company_id: input.company_id,
      id_number: input.id_number || null,
      address: input.address || null,
      is_active: true
    })

  if (userError) {
    console.error('Error inserting user:', userError)
    // Try to clean up auth user
    // Note: This requires admin privileges
    throw userError
  }

  // 3. If role is driver, create driver record
  if (input.role === 'driver') {
    const { error: driverError } = await supabase
      .from('drivers')
      .insert({
        user_id: userId,
        company_id: input.company_id,
        status: 'available'
      })

    if (driverError) {
      console.error('Error creating driver:', driverError)
      // Don't throw, user is already created
    }
  }

  return { id: userId }
}

// ==================== UPDATE USER ====================

interface UpdateUserInput {
  full_name?: string
  phone?: string
  role?: UserRole
  id_number?: string
  address?: string
  is_active?: boolean
}

export async function updateUser(userId: string, input: UpdateUserInput): Promise<void> {
  const updates: Record<string, unknown> = {}

  if (input.full_name !== undefined) updates.full_name = input.full_name
  if (input.phone !== undefined) updates.phone = input.phone
  if (input.role !== undefined) updates.role = input.role
  if (input.id_number !== undefined) updates.id_number = input.id_number
  if (input.address !== undefined) updates.address = input.address
  if (input.is_active !== undefined) updates.is_active = input.is_active

  if (Object.keys(updates).length === 0) return

  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)

  if (error) {
    console.error('Error updating user:', error)
    throw error
  }
}

// ==================== TOGGLE USER STATUS ====================

export async function toggleUserStatus(userId: string): Promise<boolean> {
  // Get current status
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('is_active')
    .eq('id', userId)
    .single()

  if (fetchError) throw fetchError

  const newStatus = !user.is_active

  const { error } = await supabase
    .from('users')
    .update({ is_active: newStatus })
    .eq('id', userId)

  if (error) {
    console.error('Error toggling user status:', error)
    throw error
  }

  return newStatus
}

// ==================== DELETE USER ====================

export async function deleteUser(userId: string): Promise<void> {
  // Delete from users table (drivers will cascade or need manual delete)
  const { error: driverError } = await supabase
    .from('drivers')
    .delete()
    .eq('user_id', userId)

  if (driverError) {
    console.error('Error deleting driver:', driverError)
  }

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId)

  if (error) {
    console.error('Error deleting user:', error)
    throw error
  }

  // Note: Deleting from auth.users requires admin privileges
  // The user won't be able to log in since the users table record is gone
}

// ==================== RESET PASSWORD ====================

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  })

  if (error) {
    console.error('Error sending password reset:', error)
    throw error
  }
}

// ==================== HELPER FUNCTIONS ====================

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'super_admin': return 'מנהל על'
    case 'company_admin': return 'מנהל'
    case 'dispatcher': return 'מוקדן'
    case 'driver': return 'נהג'
    default: return role
  }
}

export function getRoleColor(role: UserRole): string {
  switch (role) {
    case 'super_admin': return 'bg-purple-100 text-purple-700'
    case 'company_admin': return 'bg-amber-100 text-amber-700'
    case 'dispatcher': return 'bg-blue-100 text-blue-700'
    case 'driver': return 'bg-emerald-100 text-emerald-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}
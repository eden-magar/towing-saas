import type { UserRole } from '../types'

export function canEditClosedTow(role: UserRole | null | undefined): boolean {
  return role === 'company_admin' || role === 'super_admin'
}

/** Approve quote → active tow/event (company admin or super admin only). */
export function canApproveQuote(role: UserRole | null | undefined): boolean {
  return role === 'company_admin' || role === 'super_admin'
}

export function isClosedTowStatus(status: string | null | undefined): boolean {
  return status === 'completed' || status === 'cancelled'
}

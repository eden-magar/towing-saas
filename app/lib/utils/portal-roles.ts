import type { CustomerUserRole } from '../types'

/** Display-only Hebrew labels. Stored DB values stay admin/manager/viewer/accountant. */
export const PORTAL_ROLE_DISPLAY: Record<
  CustomerUserRole,
  { label: string; description: string; color: string; bg: string }
> = {
  admin: {
    label: 'מנהל חשבון',
    description: 'מנהל משתמשים, מזמין גרירות, רואה מחירים ומוריד אקסל',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
  },
  manager: {
    label: 'מנהל הזמנות',
    description: 'מזמין גרירות ועורך אנשי קשר וכתובות',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
  },
  viewer: {
    label: 'צופה',
    description: 'צפייה בלבד',
    color: 'text-gray-700',
    bg: 'bg-gray-50 border-gray-200',
  },
  accountant: {
    label: 'הנהלת חשבונות',
    description: 'צפייה בגרירות, מחירים והורדת אקסל',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
  },
}

export const PORTAL_ROLES: CustomerUserRole[] = [
  'admin',
  'manager',
  'viewer',
  'accountant',
]

/** Roles a portal admin may assign when creating/updating users. */
export const PORTAL_ADMIN_ASSIGNABLE_ROLES: CustomerUserRole[] = [
  'viewer',
  'manager',
  'accountant',
]

/** Roles staff (company_admin / super_admin) may assign. */
export const STAFF_ASSIGNABLE_ROLES: CustomerUserRole[] = [
  'viewer',
  'manager',
  'accountant',
  'admin',
]

export function isCustomerUserRole(value: unknown): value is CustomerUserRole {
  return (
    value === 'admin' ||
    value === 'manager' ||
    value === 'viewer' ||
    value === 'accountant'
  )
}

/** Submit simple/exchange requests: admin | manager (also requires can_submit_orders). */
export function canSubmitPortalOrders(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'manager'
}

/** On-screen price: admin | accountant (also requires show_price). */
export function canSeePortalPrice(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'accountant'
}

/** Excel export: admin | accountant. */
export function canExportPortalTows(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'accountant'
}

/** Contacts/addresses write: admin | manager. */
export function canEditPortalOrgData(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'manager'
}

/** Expanded stop operational details (contacts / arrival times). */
export function canSeePortalExpandedStopDetails(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'manager'
}

export function canManagePortalUsers(role: string | null | undefined): boolean {
  return role === 'admin'
}

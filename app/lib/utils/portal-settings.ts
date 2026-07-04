/** Keys in customers.portal_settings JSONB (permissions / feature flags). */
export const PORTAL_CAN_SUBMIT_ORDERS_KEY = 'can_submit_orders' as const

export type CustomerPortalSettings = Record<string, boolean>

/** Opt-in: customer may submit tow order requests via portal only when explicitly true. */
export function canSubmitOrdersViaPortal(portalSettings: CustomerPortalSettings | null | undefined): boolean {
  return portalSettings?.[PORTAL_CAN_SUBMIT_ORDERS_KEY] === true
}

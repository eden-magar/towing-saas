import type { CustomerPortalContact } from '@/app/lib/types'
import { findMatchingPortalContact } from '@/app/lib/queries/customer-portal-contacts'

/**
 * When applying a saved contact to a form, only take the contact's phone if it
 * is non-empty. Otherwise keep whatever the user already typed — never wipe.
 */
export function phoneFromSelectedPortalContact(
  selectedPhone: string | null | undefined,
  currentPhone: string
): string {
  const trimmed = selectedPhone?.trim()
  return trimmed ? trimmed : currentPhone
}

export function isPortalContactAlreadySaved(
  name: string,
  phone: string,
  contacts: CustomerPortalContact[]
): boolean {
  return Boolean(findMatchingPortalContact(name, phone, contacts))
}

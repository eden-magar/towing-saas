import type { CustomerContact } from '@/app/lib/types'
import { findMatchingCustomerContact } from '@/app/lib/queries/customer-contacts'

/**
 * When applying a saved contact to a form, only take the contact's phone if it
 * is non-empty. Otherwise keep whatever the user already typed — never wipe.
 */
export function phoneFromSelectedContact(
  selectedPhone: string | null | undefined,
  currentPhone: string
): string {
  const trimmed = selectedPhone?.trim()
  return trimmed ? trimmed : currentPhone
}

export function shouldOfferSaveCustomerContact(
  selectedCustomerId: string | null | undefined,
  name: string,
  phone: string,
  savedContacts: CustomerContact[]
): boolean {
  return Boolean(
    selectedCustomerId &&
      name.trim() &&
      !findMatchingCustomerContact(name, phone, savedContacts)
  )
}

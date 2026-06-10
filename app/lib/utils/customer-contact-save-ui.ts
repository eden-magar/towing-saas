import type { CustomerContact } from '@/app/lib/types'
import { findMatchingCustomerContact } from '@/app/lib/queries/customer-contacts'

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

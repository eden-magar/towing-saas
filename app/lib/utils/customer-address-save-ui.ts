import type { CustomerAddress } from '@/app/lib/types'
import { findMatchingCustomerAddress } from '@/app/lib/queries/customer-addresses'

export function shouldOfferSaveCustomerAddress(
  selectedCustomerId: string | null | undefined,
  address: string,
  savedAddresses: CustomerAddress[]
): boolean {
  return Boolean(
    selectedCustomerId &&
      address.trim() &&
      !findMatchingCustomerAddress(address, savedAddresses)
  )
}

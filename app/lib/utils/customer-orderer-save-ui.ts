import type { CustomerOrderer } from '@/app/lib/types'
import { findMatchingCustomerOrderer } from '@/app/lib/queries/customer-orderers'

export function shouldOfferSaveCustomerOrderer(
  isBusinessCustomer: boolean,
  selectedCustomerId: string | null | undefined,
  department: string,
  name: string,
  savedOrderers: CustomerOrderer[]
): boolean {
  return Boolean(
    isBusinessCustomer &&
      selectedCustomerId &&
      name.trim() &&
      !findMatchingCustomerOrderer(department, name, savedOrderers)
  )
}

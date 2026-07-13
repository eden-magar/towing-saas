'use client'

import { useEffect, useState } from 'react'
import { getCustomerAddresses } from '@/app/lib/queries/customer-addresses'
import type { CustomerAddress } from '@/app/lib/types'

export function useCustomerAddresses(
  companyId: string | null | undefined,
  customerId: string | null | undefined
) {
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([])
  const [addressesLoading, setAddressesLoading] = useState(false)

  useEffect(() => {
    if (!companyId || !customerId) {
      setSavedAddresses([])
      return
    }

    let cancelled = false
    setAddressesLoading(true)

    getCustomerAddresses(companyId, customerId)
      .then((addresses) => {
        if (!cancelled) setSavedAddresses(addresses)
      })
      .catch((err) => {
        console.error('Error loading customer addresses:', err)
        if (!cancelled) setSavedAddresses([])
      })
      .finally(() => {
        if (!cancelled) setAddressesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [companyId, customerId])

  return { savedAddresses, addressesLoading, setSavedAddresses }
}

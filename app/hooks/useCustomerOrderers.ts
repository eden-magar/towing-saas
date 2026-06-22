'use client'

import { useEffect, useState } from 'react'
import { getCustomerOrderers } from '@/app/lib/queries/customer-orderers'
import type { CustomerOrderer } from '@/app/lib/types'

export function useCustomerOrderers(
  companyId: string | null | undefined,
  customerId: string | null | undefined
) {
  const [savedOrderers, setSavedOrderers] = useState<CustomerOrderer[]>([])
  const [orderersLoading, setOrderersLoading] = useState(false)

  useEffect(() => {
    if (!companyId || !customerId) {
      setSavedOrderers([])
      return
    }

    let cancelled = false
    setOrderersLoading(true)

    getCustomerOrderers(companyId, customerId)
      .then((orderers) => {
        if (!cancelled) setSavedOrderers(orderers)
      })
      .catch((err) => {
        console.error('Error loading customer orderers:', err)
        if (!cancelled) setSavedOrderers([])
      })
      .finally(() => {
        if (!cancelled) setOrderersLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [companyId, customerId])

  return { savedOrderers, orderersLoading, setSavedOrderers }
}

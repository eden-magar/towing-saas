'use client'

import { useEffect, useState } from 'react'
import { getCustomerContacts } from '@/app/lib/queries/customer-contacts'
import type { CustomerContact } from '@/app/lib/types'

export function useCustomerContacts(
  companyId: string | null | undefined,
  customerId: string | null | undefined
) {
  const [savedContacts, setSavedContacts] = useState<CustomerContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)

  useEffect(() => {
    if (!companyId || !customerId) {
      setSavedContacts([])
      return
    }

    let cancelled = false
    setContactsLoading(true)

    getCustomerContacts(companyId, customerId)
      .then((contacts) => {
        if (!cancelled) setSavedContacts(contacts)
      })
      .catch((err) => {
        console.error('Error loading customer contacts:', err)
        if (!cancelled) setSavedContacts([])
      })
      .finally(() => {
        if (!cancelled) setContactsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [companyId, customerId])

  return { savedContacts, contactsLoading, setSavedContacts }
}

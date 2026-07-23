'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/app/lib/AuthContext'
import {
  canEditPortalContacts,
  getPortalMembershipRole,
  listCustomerPortalAddresses,
} from '@/app/lib/queries/customer-portal-addresses'
import type { CustomerPortalAddress } from '@/app/lib/types'

/** Loads portal addresses + edit capability for a specific customer_id. */
export function usePortalSavedAddresses(customerId: string | null) {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState<CustomerPortalAddress[]>([])
  const [loading, setLoading] = useState(false)
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    if (!customerId || !user) {
      setAddresses([])
      setCanEdit(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const load = async () => {
      try {
        const [rows, role] = await Promise.all([
          listCustomerPortalAddresses(customerId),
          getPortalMembershipRole(user.id, customerId),
        ])
        if (cancelled) return
        setAddresses(rows)
        setCanEdit(canEditPortalContacts(role))
      } catch (err) {
        console.error('Error loading portal addresses:', err)
        if (!cancelled) {
          setAddresses([])
          setCanEdit(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [customerId, user])

  return {
    addresses,
    setAddresses,
    addressesLoading: loading,
    canEditAddresses: canEdit,
  }
}

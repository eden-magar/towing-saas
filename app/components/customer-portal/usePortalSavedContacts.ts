'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/app/lib/AuthContext'
import {
  canEditPortalContacts,
  getPortalMembershipRole,
  listCustomerPortalContacts,
} from '@/app/lib/queries/customer-portal-contacts'
import type { CustomerPortalContact } from '@/app/lib/types'

/**
 * Loads portal contacts + edit capability for a specific customer_id
 * (membership role scoped to that customer, matching RLS helpers).
 */
export function usePortalSavedContacts(customerId: string | null) {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<CustomerPortalContact[]>([])
  const [loading, setLoading] = useState(false)
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    if (!customerId || !user) {
      setContacts([])
      setCanEdit(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const load = async () => {
      try {
        const [rows, role] = await Promise.all([
          listCustomerPortalContacts(customerId),
          getPortalMembershipRole(user.id, customerId),
        ])
        if (cancelled) return
        setContacts(rows)
        setCanEdit(canEditPortalContacts(role))
      } catch (err) {
        console.error('Error loading portal contacts:', err)
        if (!cancelled) {
          setContacts([])
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

  return { contacts, setContacts, contactsLoading: loading, canEditContacts: canEdit }
}

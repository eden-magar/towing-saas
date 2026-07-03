'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTowForm } from './useTowForm'
import { useCustomerContacts } from './useCustomerContacts'
import {
  findMatchingCustomerContact,
  insertPendingCustomerContacts,
} from '../lib/queries/customer-contacts'
import { shouldOfferSaveCustomerContact } from '../lib/utils/customer-contact-save-ui'

type Form = ReturnType<typeof useTowForm>

export type ContactsSave = ReturnType<typeof useContactsSave>

/**
 * Save-to-customer contact flags + saved-contacts loading for the mobile wizard.
 * Mirrors create/page.tsx local contact-save state (savePickupContactToCustomer,
 * saveDropoffContactToCustomer, useCustomerContacts, showSave…Option, persist).
 */
export function useContactsSave(form: Form) {
  const [savePickupContactToCustomer, setSavePickupContactToCustomer] = useState(false)
  const [saveDropoffContactToCustomer, setSaveDropoffContactToCustomer] = useState(false)

  const { savedContacts, contactsLoading } = useCustomerContacts(
    form.companyId,
    form.selectedCustomerId
  )

  const showSavePickupContactOption = Boolean(
    form.selectedCustomerId &&
      form.pickupContactName.trim() &&
      !findMatchingCustomerContact(
        form.pickupContactName,
        form.pickupContactPhone,
        savedContacts
      )
  )

  const showSaveDropoffContactOption = shouldOfferSaveCustomerContact(
    form.selectedCustomerId,
    form.dropoffContactName,
    form.dropoffContactPhone,
    savedContacts
  )

  useEffect(() => {
    setSavePickupContactToCustomer(false)
    setSaveDropoffContactToCustomer(false)
  }, [form.selectedCustomerId])

  useEffect(() => {
    if (!showSavePickupContactOption) {
      setSavePickupContactToCustomer(false)
    }
  }, [showSavePickupContactOption])

  useEffect(() => {
    if (!showSaveDropoffContactOption) {
      setSaveDropoffContactToCustomer(false)
    }
  }, [showSaveDropoffContactOption])

  const persistTowCustomerContacts = useCallback(async () => {
    if (!form.companyId || !form.selectedCustomerId) return

    const pending: { name: string; phone: string | null }[] = []

    if (form.towType === 'single') {
      if (savePickupContactToCustomer && form.pickupContactName.trim()) {
        pending.push({
          name: form.pickupContactName.trim(),
          phone: form.pickupContactPhone.trim() || null,
        })
      }
      if (saveDropoffContactToCustomer && form.dropoffContactName.trim()) {
        pending.push({
          name: form.dropoffContactName.trim(),
          phone: form.dropoffContactPhone.trim() || null,
        })
      }
    }

    if (pending.length === 0) return
    await insertPendingCustomerContacts(
      form.companyId,
      form.selectedCustomerId,
      pending
    )
  }, [
    form.companyId,
    form.selectedCustomerId,
    form.towType,
    savePickupContactToCustomer,
    saveDropoffContactToCustomer,
    form.pickupContactName,
    form.pickupContactPhone,
    form.dropoffContactName,
    form.dropoffContactPhone,
  ])

  return {
    savedContacts,
    contactsLoading,
    savePickupContactToCustomer,
    setSavePickupContactToCustomer,
    saveDropoffContactToCustomer,
    setSaveDropoffContactToCustomer,
    showSavePickupContactOption,
    showSaveDropoffContactOption,
    persistTowCustomerContacts,
  }
}

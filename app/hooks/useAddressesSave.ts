'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTowForm } from './useTowForm'
import { useCustomerAddresses } from './useCustomerAddresses'
import {
  insertPendingCustomerAddresses,
  pendingAddressFromFields,
  type PendingCustomerAddress,
} from '../lib/queries/customer-addresses'
import { shouldOfferSaveCustomerAddress } from '../lib/utils/customer-address-save-ui'
import type { CustomerAddressPendingDraft } from '../components/customer-addresses/SaveCustomerAddressControl'
import type { AddressData } from '../components/tow-forms/routes/AddressInput'

type Form = ReturnType<typeof useTowForm>

export type AddressesSave = ReturnType<typeof useAddressesSave>

function pendingFromAddressData(
  draft: CustomerAddressPendingDraft,
  data: AddressData | null | undefined
): PendingCustomerAddress | null {
  return pendingAddressFromFields(draft.label, data?.address ?? '', {
    placeId: data?.placeId,
    lat: data?.lat,
    lng: data?.lng,
    notes: draft.notes || null,
  })
}

/**
 * Deferred save-to-customer address drafts for the mobile wizard / ColumnLayout.
 */
export function useAddressesSave(form: Form) {
  const [pendingPickupAddress, setPendingPickupAddress] =
    useState<CustomerAddressPendingDraft | null>(null)
  const [pendingDropoffAddress, setPendingDropoffAddress] =
    useState<CustomerAddressPendingDraft | null>(null)
  const [pendingStopAddresses, setPendingStopAddresses] = useState<
    Record<string, CustomerAddressPendingDraft>
  >({})

  const { savedAddresses, addressesLoading } = useCustomerAddresses(
    form.companyId,
    form.selectedCustomerId
  )

  const showSavePickupAddressOption = shouldOfferSaveCustomerAddress(
    form.selectedCustomerId,
    form.pickupAddress?.address ?? '',
    savedAddresses
  )

  const showSaveDropoffAddressOption = shouldOfferSaveCustomerAddress(
    form.selectedCustomerId,
    form.dropoffAddress?.address ?? '',
    savedAddresses
  )

  useEffect(() => {
    setPendingPickupAddress(null)
    setPendingDropoffAddress(null)
    setPendingStopAddresses({})
  }, [form.selectedCustomerId])

  useEffect(() => {
    if (!showSavePickupAddressOption) setPendingPickupAddress(null)
  }, [showSavePickupAddressOption])

  useEffect(() => {
    if (!showSaveDropoffAddressOption) setPendingDropoffAddress(null)
  }, [showSaveDropoffAddressOption])

  const setPendingStopAddress = useCallback(
    (stopId: string, draft: CustomerAddressPendingDraft | null) => {
      setPendingStopAddresses((prev) => {
        if (!draft) {
          const { [stopId]: _, ...rest } = prev
          return rest
        }
        return { ...prev, [stopId]: draft }
      })
    },
    []
  )

  const persistTowCustomerAddresses = useCallback(async () => {
    if (!form.companyId || !form.selectedCustomerId) return 0

    const pending: PendingCustomerAddress[] = []

    if (form.towType === 'single') {
      if (pendingPickupAddress) {
        const item = pendingFromAddressData(pendingPickupAddress, form.pickupAddress)
        if (item) pending.push(item)
      }
      if (pendingDropoffAddress) {
        const item = pendingFromAddressData(pendingDropoffAddress, form.dropoffAddress)
        if (item) pending.push(item)
      }
      for (const stop of form.routeStops) {
        if (stop.role !== 'stop') continue
        const draft = pendingStopAddresses[stop.id]
        if (!draft) continue
        const item = pendingFromAddressData(draft, stop.address)
        if (item) pending.push(item)
      }
    }

    if (pending.length === 0) return 0
    await insertPendingCustomerAddresses(
      form.companyId,
      form.selectedCustomerId,
      pending
    )
    return pending.length
  }, [
    form.companyId,
    form.selectedCustomerId,
    form.towType,
    pendingPickupAddress,
    pendingDropoffAddress,
    form.pickupAddress,
    form.dropoffAddress,
    form.routeStops,
    pendingStopAddresses,
  ])

  return {
    savedAddresses,
    addressesLoading,
    pendingPickupAddress,
    setPendingPickupAddress,
    pendingDropoffAddress,
    setPendingDropoffAddress,
    pendingStopAddresses,
    setPendingStopAddress,
    showSavePickupAddressOption,
    showSaveDropoffAddressOption,
    persistTowCustomerAddresses,
  }
}

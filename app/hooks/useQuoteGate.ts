'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTowForm } from './useTowForm'
import { createCustomer } from '../lib/queries/customers'
import { approveTowQuote, createTow, updateTow } from '../lib/queries/tows'
import {
  getVehiclesReservedForTow,
  reserveVehicleForTow,
  unreserveVehicleFromTow,
} from '../lib/queries/storage'
import {
  CUSTOM_TOW_EDIT_WIPE_BLOCKED_MESSAGE,
  isCustomTowEditWipeBlocked,
  prepareTowData,
} from '../lib/utils/tow-save-handler'
import { REQUIRED_TRUCK_TYPE_MESSAGE } from '../lib/utils/tow-save-blocking'
import { canApproveQuote, isClosedTowStatus } from '../lib/utils/can-edit-closed-tow'

type Form = ReturnType<typeof useTowForm>

export type QuoteGate = ReturnType<typeof useQuoteGate>

type QuoteGateOptions = {
  persistTowCustomerContacts?: () => Promise<void>
  persistTowCustomerAddresses?: () => Promise<number>
}

/**
 * Quote-approval gate state + handlers for the mobile tow wizard.
 * Mirrors create/page.tsx local quote state (quoteApproved, quoteDeclined,
 * quoteSavedId, approvingQuote) and handlers (handleQuoteApproveClick,
 * handleSaveAsQuote). Kept wizard-local — not in useTowForm — so desktop
 * create/page.tsx stays untouched.
 */
export function useQuoteGate(form: Form, options?: QuoteGateOptions) {
  const [quoteApproved, setQuoteApproved] = useState(false)
  const [quoteDeclined, setQuoteDeclined] = useState(false)
  const [quoteSavedId, setQuoteSavedId] = useState<string | null>(null)
  const [approvingQuote, setApprovingQuote] = useState(false)

  const editTowId = form.editTowId

  const isEditingClosedTow =
    !!editTowId && isClosedTowStatus(form.loadedTowStatus)

  useEffect(() => {
    if (form.loadedTowStatus !== null && form.loadedTowStatus !== 'quote') {
      setQuoteApproved(true)
    }
  }, [form.loadedTowStatus])

  const lockedOpacity = quoteApproved ? 1 : 0.35
  const lockedPointer = quoteApproved ? 'auto' : 'none'

  const handleQuoteApproveClick = useCallback(async () => {
    if (editTowId && form.loadedTowStatus === 'quote') {
      if (!canApproveQuote(form.user?.role)) {
        form.setError('אין הרשאה לאשר הצעות מחיר')
        return
      }
      setApprovingQuote(true)
      form.setError('')
      try {
        const result = await approveTowQuote(editTowId)
        if (!result.approved) {
          form.setError(
            result.reason === 'not_quote'
              ? 'ההצעה כבר אושרה או שאינה בהצעת מחיר'
              : 'הגרירה לא נמצאה'
          )
          return
        }
        form.setLoadedTowStatus(result.newStatus)
      } catch (err) {
        console.error('[handleQuoteApproveClick] approve failed:', err)
        form.setError('שגיאה באישור ההצעה')
        return
      } finally {
        setApprovingQuote(false)
      }
    }
    setQuoteApproved(true)
  }, [editTowId, form])

  const handleSaveAsQuote = useCallback(async () => {
    if (editTowId && isClosedTowStatus(form.loadedTowStatus)) return
    if (!form.companyId || !form.user || !form.towType) return
    if (form.requiredTruckTypes.length === 0) {
      form.setTruckTypeError(true)
      form.setError(REQUIRED_TRUCK_TYPE_MESSAGE)
      form.truckTypeSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      return
    }
    form.setTruckTypeError(false)
    if (
      isCustomTowEditWipeBlocked({
        editTowId,
        towType: form.towType,
        existingPointCount: form.editExistingPoints?.length ?? 0,
        routePointCount: form.routePoints.length,
      })
    ) {
      form.setError(CUSTOM_TOW_EDIT_WIPE_BLOCKED_MESSAGE)
      return
    }
    form.setSaving(true)
    form.setError('')
    try {
      await options?.persistTowCustomerContacts?.()
      await options?.persistTowCustomerAddresses?.()

      let finalCustomerId = form.selectedCustomerId
      if (!form.selectedCustomerId && form.customerName.trim()) {
        const result = await createCustomer({
          companyId: form.companyId,
          customerType: 'private',
          name: form.customerName.trim(),
          phone: form.customerPhone.trim() || undefined,
          paymentTerms: 'immediate',
        })
        finalCustomerId = result.id
      }
      const plate = form.vehiclePlate
      const vData = form.vehicleData
      const vType = form.vehicleType
      const towType = form.towType

      const towData = prepareTowData({
        companyId: form.companyId,
        userId: form.user.id,
        towType,
        customerOrderNumber: form.customerOrderNumber,
        customerId: finalCustomerId,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        towDate: form.towDate,
        towTime: form.towTime,
        towEndDate: form.towEndDate,
        towEndTime: form.towEndTime,
        preSelectedDriverId: null,
        vehiclePlate: plate,
        vehicleCode: form.vehicleCode,
        vehicleType: vType,
        vehicleData: vData,
        selectedDefects: form.selectedDefects,
        requiredTruckTypes: form.requiredTruckTypes,
        routeStops:
          towType === 'single'
            ? form.routeStops.map((s) => ({
                id: s.id,
                role: s.role,
                stopSubtype: s.stopSubtype,
                address: s.address,
                contactName: s.contactName,
                contactPhone: s.contactPhone,
                notes: s.notes,
                orderNotes: s.orderNotes,
              }))
            : undefined,
        existingTowVehicles: editTowId ? form.editExistingVehicles : undefined,
        existingTowPoints: editTowId ? form.editExistingPoints : undefined,
        distance:
          towType === 'custom'
            ? { distanceKm: form.customRouteData.totalDistanceKm, durationMinutes: 0 }
            : towType === 'exchange'
              ? form.exchangeTotalDistance ?? null
              : form.distance,
        startFromBase: form.startFromBase,
        baseToPickupDistance: form.baseToPickupDistance,
        routePoints: form.routePoints,
        customRouteData: form.customRouteData,
        priceMode: form.priceMode,
        finalPrice: form.finalPrice,
        customPrice: form.customPrice,
        customPriceIncludesVat: form.customPriceIncludesVat,
        vatPercent: form.vatPercent,
        manualAdjustmentPercent: (() => {
          const adj = parseFloat(form.manualAdjustmentPercent ?? '') || 0
          return form.manualAdjustmentType === 'discount' ? -adj : adj
        })(),
        basePriceList: form.basePriceList,
        selectedCustomerPricing: form.selectedCustomerPricing,
        activeTimeSurcharges: form.activeTimeSurchargesList,
        selectedLocationSurcharges: form.selectedLocationSurcharges,
        locationSurchargesData: form.locationSurchargesData,
        selectedServices:
          towType === 'exchange'
            ? [
                ...(form.workingSelectedServices ?? []),
                ...(form.defectiveSelectedServices ?? []),
              ]
            : form.selectedServices,
        towServiceSurcharges: form.towServiceSurcharges,
        manualSurcharges: form.manualSurcharges,
        serviceSurchargesData: form.serviceSurchargesData,
        notes: form.notes,
        paymentMethod: form.paymentMethod || undefined,
        invoiceName: form.invoiceName || undefined,
        dropoffToStorage: form.dropoffToStorage,
        selectedStoredVehicleId: form.selectedStoredVehicleId,
        workingVehiclePlate: towType === 'exchange' ? form.workingVehiclePlate : undefined,
        workingVehicleCode: towType === 'exchange' ? form.workingVehicleCode : undefined,
        workingVehicleData: towType === 'exchange' ? form.workingVehicleData : undefined,
        workingVehicleType: towType === 'exchange' ? form.workingVehicleType : undefined,
        defectiveVehicleType:
          towType === 'exchange' ? form.defectiveVehicleType || undefined : undefined,
        workingVehicleSourceAddress:
          towType === 'exchange' ? form.workingVehicleAddress : undefined,
        workingVehicleDestinationAddress:
          towType === 'exchange'
            ? form.exchangePointSplit
              ? form.workingVehicleDestinationAddress
              : form.exchangeAddress
            : undefined,
        workingVehicleContactName:
          towType === 'exchange' ? form.workingVehicleContact : undefined,
        workingVehicleContactPhone:
          towType === 'exchange' ? form.workingVehicleContactPhone : undefined,
        defectiveVehiclePlate:
          towType === 'exchange' ? form.defectiveVehiclePlate : undefined,
        defectiveVehicleCode:
          towType === 'exchange' ? form.defectiveVehicleCode : undefined,
        defectiveVehicleData:
          towType === 'exchange' ? form.defectiveVehicleData : undefined,
        exchangePointAddress: towType === 'exchange' ? form.exchangeAddress : undefined,
        exchangeContactName: towType === 'exchange' ? form.exchangeContactName : undefined,
        exchangeContactPhone: towType === 'exchange' ? form.exchangeContactPhone : undefined,
        workingDestinationContactName:
          towType === 'exchange' && form.exchangePointSplit
            ? form.workingDestinationContact
            : undefined,
        workingDestinationContactPhone:
          towType === 'exchange' && form.exchangePointSplit
            ? form.workingDestinationContactPhone
            : undefined,
        defectiveDestinationAddress:
          towType === 'exchange' ? form.defectiveDestinationAddress : undefined,
        defectiveDestinationContactName:
          towType === 'exchange' ? form.defectiveDestinationContact : undefined,
        defectiveDestinationContactPhone:
          towType === 'exchange' ? form.defectiveDestinationContactPhone : undefined,
        workingVehicleSource: towType === 'exchange' ? form.workingVehicleSource : undefined,
        workingVehicleDestinationIsStorage:
          towType === 'exchange' && form.exchangePointSplit
            ? form.workingVehicleDestinationIsStorage
            : undefined,
        defectiveDestination: towType === 'exchange' ? form.defectiveDestination : undefined,
        workingSelectedServices:
          towType === 'exchange' ? form.workingSelectedServices : undefined,
        defectiveSelectedServices:
          towType === 'exchange' ? form.defectiveSelectedServices : undefined,
        manualManufacturer: form.manualManufacturer,
        manualColor: form.manualColor,
        manualWeight: form.manualWeight,
        manualChassis: form.manualChassis,
        workingManualManufacturer:
          towType === 'exchange' ? form.workingManualManufacturer : undefined,
        workingManualColor: towType === 'exchange' ? form.workingManualColor : undefined,
        workingManualWeight: towType === 'exchange' ? form.workingManualWeight : undefined,
        workingManualChassis: towType === 'exchange' ? form.workingManualChassis : undefined,
        defectiveManualManufacturer:
          towType === 'exchange' ? form.defectiveManualManufacturer : undefined,
        defectiveManualColor: towType === 'exchange' ? form.defectiveManualColor : undefined,
        defectiveManualWeight:
          towType === 'exchange' ? form.defectiveManualWeight : undefined,
        defectiveManualChassis:
          towType === 'exchange' ? form.defectiveManualChassis : undefined,
        ...(editTowId && towType === 'exchange'
          ? {
              existingPriceBreakdown: form.editTowSnapshot?.price_breakdown ?? null,
              timeSurchargesData: form.timeSurchargesData,
              isHoliday: form.isHoliday,
              hasManualTimeSurchargeOverride: form.hasManualTimeSurchargeOverride,
              stopsBeforeExchange: form.stopsBeforeExchange,
              stopsAfterExchange: form.stopsAfterExchange,
              exchangeRouteLayout: form.getExchangeRouteLayout?.() ?? null,
              exchangeEditPriceBaselineSignature:
                form.getExchangeEditPriceBaselineSignature?.() ?? null,
              exchangeEditOriginalFinalPrice: form.editTowSnapshot?.final_price ?? null,
            }
          : {}),
      })

      if (editTowId) {
        await updateTow({ ...towData, towId: editTowId, status: 'quote', priceMode: form.priceMode })
        setQuoteSavedId(editTowId)
        try {
          const currentReservations = await getVehiclesReservedForTow(editTowId)
          const desiredIds = new Set<string>()
          if (towType === 'single' && form.selectedStoredVehicleId) {
            desiredIds.add(form.selectedStoredVehicleId)
          }
          if (
            towType === 'exchange' &&
            form.workingVehicleSource === 'storage' &&
            form.selectedWorkingVehicleId
          ) {
            desiredIds.add(form.selectedWorkingVehicleId)
          }
          for (const v of currentReservations) {
            if (!desiredIds.has(v.id)) {
              await unreserveVehicleFromTow({ storedVehicleId: v.id })
            }
          }
          for (const id of desiredIds) {
            if (!currentReservations.some((r) => r.id === id)) {
              await reserveVehicleForTow({ storedVehicleId: id, towId: editTowId })
            }
          }
        } catch (err) {
          console.error('[handleSaveAsQuote] sync storage reservations failed:', err)
        }
      } else {
        const quoteResult = await createTow({ ...towData, status: 'quote' as const })
        const quoteTowId = quoteResult.id
        if (quoteTowId) {
          try {
            if (towType === 'single' && form.selectedStoredVehicleId) {
              await reserveVehicleForTow({
                storedVehicleId: form.selectedStoredVehicleId,
                towId: quoteTowId,
              })
            }
            if (
              towType === 'exchange' &&
              form.workingVehicleSource === 'storage' &&
              form.selectedWorkingVehicleId
            ) {
              await reserveVehicleForTow({
                storedVehicleId: form.selectedWorkingVehicleId,
                towId: quoteTowId,
              })
            }
          } catch (err) {
            console.error('[handleSaveAsQuote] reserve storage failed:', err)
          }
        }
      }
      form.router.push('/dashboard')
    } catch (err) {
      console.error(err)
      form.setError('שגיאה בשמירת ההצעה')
    } finally {
      form.setSaving(false)
    }
  }, [editTowId, form, options?.persistTowCustomerContacts, options?.persistTowCustomerAddresses])

  return {
    quoteApproved,
    quoteDeclined,
    quoteSavedId,
    approvingQuote,
    isEditingClosedTow,
    lockedOpacity,
    lockedPointer,
    setQuoteDeclined,
    handleQuoteApproveClick,
    handleSaveAsQuote,
  }
}

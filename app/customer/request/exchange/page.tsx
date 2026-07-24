'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { type CustomerPortalStoredVehicle } from '@/app/lib/queries/customer-portal'
import { serializeDefects } from '@/app/lib/constants/defects'
import { createFullCustomerTowRequest } from '@/app/lib/queries/customer-tow-requests'
import { usePortalRequestBootstrap } from '@/app/components/customer-portal/PortalRequestBootstrap'
import { PortalRequestPageHeader } from '@/app/components/customer-portal/PortalRequestPageHeader'
import { PortalContactPairFields } from '@/app/components/customer-portal/PortalContactPairFields'
import { usePortalSavedContacts } from '@/app/components/customer-portal/usePortalSavedContacts'
import { SavePortalAddressControl } from '@/app/components/customer-portal/SavePortalAddressControl'
import { usePortalSavedAddresses } from '@/app/components/customer-portal/usePortalSavedAddresses'
import { portalAddressesAsCustomerAddresses } from '@/app/lib/queries/customer-portal-addresses'
import {
  PORTAL_CANCEL_LINK_CLASS,
  PORTAL_COLUMN_CARD_CLASS,
  PORTAL_DEFECTS_TRIGGER_CLASS,
  PORTAL_ERROR_BANNER_CLASS,
  PORTAL_FORM_FOOTER_CLASS,
  PORTAL_FORM_FOOTER_INNER_CLASS,
  PORTAL_FORM_STACK_CLASS,
  PORTAL_GRID_GAP_CLASS,
  PORTAL_PAGE_SHELL_CLASS,
  PORTAL_PAGE_SUBTITLE_CLASS,
  PORTAL_PAGE_TITLE_CLASS,
  PORTAL_SECTION_LABEL_CLASS,
  PORTAL_SEGMENT_ACTIVE_CLASS,
  PORTAL_SEGMENT_INACTIVE_CLASS,
  PORTAL_SEGMENT_WRAP_CLASS,
  PORTAL_STATUS_CARD_CLASS,
  PORTAL_STORAGE_BUTTON_CLASS,
  PORTAL_SUBMIT_CLASS,
  PORTAL_TEXTAREA_CLASS,
} from '@/app/components/customer-portal/portalRequestActionStyles'
import { StorageVehiclePickerModal } from '@/app/components/storage/StorageVehiclePickerModal'
import { TimeInStoragePill } from '@/app/components/storage/TimeInStoragePill'
import {
  Button,
  DateInput,
  FormCard,
  FormField,
  Input,
  TimeInput,
} from '@/app/components/ui'
import { PortalDefectSelector } from '@/app/components/customer-portal/PortalDefectSelector'
import { VehicleLookup } from '@/app/components/tow-forms/shared/VehicleLookup'
import { PinDropModal } from '@/app/components/tow-forms/shared/PinDropModal'
import {
  AddressInput,
  type AddressData,
  type StorageYardConfirmProp,
} from '@/app/components/tow-forms/routes/AddressInput'
import type { VehicleLookupResult, VehicleType } from '@/app/lib/types'
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPin,
  Package,
  Truck,
} from 'lucide-react'

function buildLookupResultFromStored(
  vehicle: CustomerPortalStoredVehicle
): VehicleLookupResult | null {
  if (!vehicle.vehicle_data) return null
  const vd = vehicle.vehicle_data
  return {
    found: true,
    source: (vd.source as VehicleLookupResult['source']) || 'private',
    sourceLabel: vd.sourceLabel || 'רכב פרטי',
    data: {
      plateNumber: vehicle.plate_number,
      manufacturer: vd.manufacturer || null,
      model: vd.model || null,
      year: vd.year ? parseInt(vd.year, 10) : null,
      color: vd.color || null,
      fuelType: null,
      totalWeight: vd.totalWeight ? parseInt(vd.totalWeight, 10) : null,
      vehicleType: null,
      driveType: vd.driveType || null,
      driveTechnology: null,
      gearType: vd.gearType || null,
      chassis: null,
      importType: null,
      curbWeightKg: null,
      machineryType: null,
      selfWeight: null,
      totalWeightTon: null,
    },
  }
}

type HeaderForm = {
  customerOrderNumber: string
  department: string
  orderer: string
  ordererPhone: string
  notes: string
}

type VehicleSide = {
  plateNumber: string
  vehicleCode: string
  vehicleData: VehicleLookupResult | null
  vehicleType: VehicleType | ''
  vehicleLookupNotFound: boolean
  manualManufacturer: string
  manualColor: string
  manualChassis: string
  manualWeight: string
  origin: AddressData
  originContactName: string
  originContactPhone: string
  destination: AddressData
  destinationContactName: string
  destinationContactPhone: string
}

const emptyAddress = (): AddressData => ({ address: '' })

const emptyVehicleSide = (): VehicleSide => ({
  plateNumber: '',
  vehicleCode: '',
  vehicleData: null,
  vehicleType: '',
  vehicleLookupNotFound: false,
  manualManufacturer: '',
  manualColor: '',
  manualChassis: '',
  manualWeight: '',
  origin: emptyAddress(),
  originContactName: '',
  originContactPhone: '',
  destination: emptyAddress(),
  destinationContactName: '',
  destinationContactPhone: '',
})

function defaultTowDate(): string {
  return new Date().toISOString().split('T')[0]
}

function defaultTowTime(): string {
  return new Date().toTimeString().slice(0, 5)
}

type FieldErrorKey =
  | keyof HeaderForm
  | 'scheduledAt'
  | 'workingPlate'
  | 'workingVehicleCode'
  | 'workingOrigin'
  | 'workingOriginContactName'
  | 'workingOriginContactPhone'
  | 'workingDestination'
  | 'workingDestinationContactName'
  | 'workingDestinationContactPhone'
  | 'faultyPlate'
  | 'faultyVehicleCode'
  | 'faultyDefects'
  | 'faultyOrigin'
  | 'faultyOriginContactName'
  | 'faultyOriginContactPhone'
  | 'faultyDestination'
  | 'faultyDestinationContactName'
  | 'faultyDestinationContactPhone'

const fieldLabels: Record<FieldErrorKey, string> = {
  customerOrderNumber: 'מספר הזמנת לקוח',
  scheduledAt: 'מועד ביצוע',
  department: 'מחלקה',
  orderer: 'מזמין',
  ordererPhone: 'טלפון מזמין',
  notes: 'הערות',
  workingPlate: 'מספר רישוי',
  workingVehicleCode: 'קוד רכב',
  workingOrigin: 'כתובת',
  workingOriginContactName: 'איש קשר',
  workingOriginContactPhone: 'טלפון',
  workingDestination: 'כתובת',
  workingDestinationContactName: 'איש קשר',
  workingDestinationContactPhone: 'טלפון',
  faultyPlate: 'מספר רישוי',
  faultyVehicleCode: 'קוד רכב',
  faultyDefects: 'תקלות',
  faultyOrigin: 'כתובת',
  faultyOriginContactName: 'איש קשר',
  faultyOriginContactPhone: 'טלפון',
  faultyDestination: 'כתובת',
  faultyDestinationContactName: 'איש קשר',
  faultyDestinationContactPhone: 'טלפון',
}

type PinField =
  | 'workingOrigin'
  | 'workingDestination'
  | 'faultyOrigin'
  | 'faultyDestination'

function buildVehiclePayload(
  side: VehicleSide,
  opts: { isWorking: boolean; towReason?: string; orderIndex: number }
) {
  const plate = side.plateNumber.trim()
  const parsedWeight = Number(side.manualWeight)
  const weightValue =
    side.manualWeight.trim() && Number.isFinite(parsedWeight) ? parsedWeight : null
  const chassisValue = side.manualChassis.trim() || null
  const base = {
    plateNumber: plate,
    vehicleCode: side.vehicleCode.trim() || null,
    isWorking: opts.isWorking,
    towReason: opts.towReason,
    orderIndex: opts.orderIndex,
  }

  if (side.vehicleData?.found && side.vehicleData.data) {
    const d = side.vehicleData.data
    const resolvedType = (side.vehicleType || side.vehicleData.source) as VehicleType | ''
    return {
      ...base,
      manufacturer: d.manufacturer,
      model: d.model,
      year: d.year,
      color: d.color,
      vehicleType: resolvedType || null,
      chassis: d.chassis?.trim() || chassisValue,
      totalWeight: d.totalWeight ?? weightValue,
    }
  }

  if (side.vehicleLookupNotFound) {
    return {
      ...base,
      manufacturer: side.manualManufacturer.trim() || null,
      color: side.manualColor.trim() || null,
      vehicleType: side.vehicleType ? (side.vehicleType as VehicleType) : null,
      chassis: chassisValue,
      totalWeight: weightValue,
    }
  }

  return base
}

export default function NewCustomerExchangeRequestPage() {
  const {
    canSubmit,
    customerId,
    companyId,
    baseAddress,
    storedVehicles,
    storageLoading,
    userId,
  } = usePortalRequestBootstrap()
  const {
    contacts: portalContacts,
    setContacts: setPortalContacts,
    contactsLoading: portalContactsLoading,
    canEditContacts,
  } = usePortalSavedContacts(customerId)
  const {
    addresses: portalAddresses,
    setAddresses: setPortalAddresses,
    canEditAddresses,
  } = usePortalSavedAddresses(customerId)
  const savedAddressesForInput = portalAddressesAsCustomerAddresses(portalAddresses)

  const [header, setHeader] = useState<HeaderForm>({
    customerOrderNumber: '',
    department: '',
    orderer: '',
    ordererPhone: '',
    notes: '',
  })
  const [towDate, setTowDate] = useState(defaultTowDate)
  const [towTime, setTowTime] = useState(defaultTowTime)
  const [useCustomTime, setUseCustomTime] = useState(false)

  const [working, setWorking] = useState<VehicleSide>(emptyVehicleSide)
  const [faulty, setFaulty] = useState<VehicleSide>(emptyVehicleSide)
  const [faultyDefects, setFaultyDefects] = useState<string[]>([])

  const [selectedWorkingStoredId, setSelectedWorkingStoredId] = useState<string | null>(null)
  const [faultyToStorage, setFaultyToStorage] = useState(false)
  /** Default hub (3 points). Split shows a distinct faulty origin (4 points). */
  const [exchangePointSplit, setExchangePointSplit] = useState(false)
  /** Same-session stash: מוצא התקול lost on collapse, restored on re-split. */
  const faultyOriginStashRef = useRef<{
    address: AddressData
    contactName: string
    contactPhone: string
  } | null>(null)

  const [storageModalOpen, setStorageModalOpen] = useState(false)

  const [pinDropModal, setPinDropModal] = useState<{
    isOpen: boolean
    field: PinField | null
  }>({ isOpen: false, field: null })

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldErrorKey, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(false)

  const operationalStoredVehicles = storedVehicles.filter(
    (v) => v.vehicle_condition === 'operational'
  )
  const selectedWorkingStored =
    operationalStoredVehicles.find((v) => v.id === selectedWorkingStoredId) ?? null
  /** Working origin is storage iff a yard vehicle was picked via מאחסנה. */
  const workingFromStorage = selectedWorkingStoredId !== null

  const clearFieldError = (key: FieldErrorKey) => {
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const updateHeader = (key: keyof HeaderForm, value: string) => {
    setHeader((prev) => ({ ...prev, [key]: value }))
    clearFieldError(key)
  }

  const patchWorking = (patch: Partial<VehicleSide>) => {
    setWorking((prev) => ({ ...prev, ...patch }))
  }

  const patchFaulty = (patch: Partial<VehicleSide>) => {
    setFaulty((prev) => ({ ...prev, ...patch }))
  }

  const applyYardToAddress = (): AddressData => {
    if (!baseAddress?.address) return emptyAddress()
    return {
      address: baseAddress.address,
      lat: baseAddress.lat ?? undefined,
      lng: baseAddress.lng ?? undefined,
    }
  }

  const handleNowClick = () => {
    const now = new Date()
    setTowDate(now.toISOString().split('T')[0])
    setTowTime(now.toTimeString().slice(0, 5))
    clearFieldError('scheduledAt')
  }

  const applyWorkingOriginFromYard = () => {
    patchWorking({
      origin: applyYardToAddress(),
      originContactName: '',
      originContactPhone: '',
    })
    clearFieldError('workingOrigin')
    clearFieldError('workingOriginContactName')
    clearFieldError('workingOriginContactPhone')
  }

  const clearWorkingOriginYard = () => {
    patchWorking({
      origin: emptyAddress(),
      originContactName: '',
      originContactPhone: '',
    })
    clearFieldError('workingOriginContactName')
    clearFieldError('workingOriginContactPhone')
  }

  const setFaultyDestinationToYard = (enabled: boolean) => {
    setFaultyToStorage(enabled)
    if (enabled) {
      patchFaulty({
        destination: applyYardToAddress(),
        destinationContactName: '',
        destinationContactPhone: '',
      })
      clearFieldError('faultyDestination')
      clearFieldError('faultyDestinationContactName')
      clearFieldError('faultyDestinationContactPhone')
    } else {
      patchFaulty({
        destination: emptyAddress(),
        destinationContactName: '',
        destinationContactPhone: '',
      })
      clearFieldError('faultyDestinationContactName')
      clearFieldError('faultyDestinationContactPhone')
    }
  }

  const portalYard =
    baseAddress?.address?.trim()
      ? {
          address: baseAddress.address,
          lat: baseAddress.lat ?? null,
          lng: baseAddress.lng ?? null,
        }
      : null
  /** Working origin: "מאחסנה" requires picking a stored vehicle — open that picker. */
  const workingOriginYardConfirm: StorageYardConfirmProp | null = portalYard
    ? {
        role: 'pickup',
        yard: portalYard,
        alreadyFlagged: workingFromStorage,
        onConfirm: () => setStorageModalOpen(true),
        fieldKey: 'portal-exchange-working-origin',
      }
    : null
  const faultyDestYardConfirm: StorageYardConfirmProp | null = portalYard
    ? {
        role: 'dropoff',
        yard: portalYard,
        alreadyFlagged: faultyToStorage,
        onConfirm: () => setFaultyDestinationToYard(true),
        fieldKey: 'portal-exchange-faulty-dest',
      }
    : null

  /** Non-storage address present → show contacts; empty or yard → hide. */
  const showWorkingOriginContacts =
    !workingFromStorage && working.origin.address.trim().length > 0
  const showFaultyDestinationContacts =
    !faultyToStorage && faulty.destination.address.trim().length > 0
  /** Hub: one contact pair on נקודת החלפה (working.destination). Split: dest + faulty origin. */
  const showHubOrWorkingDestContacts = working.destination.address.trim().length > 0

  const splitExchangePoint = () => {
    const stash = faultyOriginStashRef.current
    if (stash?.address?.address?.trim()) {
      patchFaulty({
        origin: stash.address,
        originContactName: stash.contactName,
        originContactPhone: stash.contactPhone,
      })
      faultyOriginStashRef.current = null
    } else {
      patchFaulty({
        origin: emptyAddress(),
        originContactName: '',
        originContactPhone: '',
      })
    }
    setExchangePointSplit(true)
  }

  const collapseExchangePoint = () => {
    const hubAddr = working.destination.address.trim()
    const faultyOriginAddress = faulty.origin.address.trim()
    const wouldLoseFaultyOrigin =
      (!!faultyOriginAddress && faultyOriginAddress !== hubAddr) ||
      (!!faulty.originContactName.trim() &&
        faulty.originContactName.trim() !== working.destinationContactName.trim())

    if (wouldLoseFaultyOrigin) {
      const ok = window.confirm(
        'איבוד כתובת מוצא התקול — להמשיך?\n(פיצול מחדש באותו מסך ישחזר את הכתובת)',
      )
      if (!ok) return
      faultyOriginStashRef.current = {
        address: faulty.origin,
        contactName: faulty.originContactName,
        contactPhone: faulty.originContactPhone,
      }
    } else {
      faultyOriginStashRef.current = null
    }

    patchFaulty({
      origin: emptyAddress(),
      originContactName: '',
      originContactPhone: '',
    })
    clearFieldError('faultyOrigin')
    clearFieldError('faultyOriginContactName')
    clearFieldError('faultyOriginContactPhone')
    setExchangePointSplit(false)
  }

  const clearWorkingStoredSelection = () => {
    setSelectedWorkingStoredId(null)
    patchWorking({
      plateNumber: '',
      vehicleCode: '',
      vehicleData: null,
      vehicleType: '',
      vehicleLookupNotFound: false,
      manualManufacturer: '',
      manualColor: '',
      manualChassis: '',
      manualWeight: '',
    })
    clearWorkingOriginYard()
    clearFieldError('workingPlate')
  }

  const handleSelectWorkingStored = (vehicle: CustomerPortalStoredVehicle) => {
    if (vehicle.current_status !== 'stored') return
    if (vehicle.vehicle_condition !== 'operational') return

    const lookup = buildLookupResultFromStored(vehicle)
    setSelectedWorkingStoredId(vehicle.id)
    patchWorking({
      plateNumber: vehicle.plate_number,
      vehicleCode: vehicle.vehicle_code || '',
      vehicleLookupNotFound: false,
      manualManufacturer: '',
      manualColor: '',
      manualChassis: '',
      manualWeight: '',
      vehicleData: lookup,
      vehicleType: lookup ? ((lookup.source as VehicleType) || 'private') : '',
    })
    clearFieldError('workingPlate')
    clearFieldError('workingVehicleCode')
    applyWorkingOriginFromYard()
  }

  const handlePinDropConfirm = (data: AddressData) => {
    const field = pinDropModal.field
    if (field === 'workingOrigin') {
      patchWorking({ origin: data })
      clearFieldError('workingOrigin')
    } else if (field === 'workingDestination') {
      patchWorking({ destination: data })
      clearFieldError('workingDestination')
    } else if (field === 'faultyOrigin') {
      patchFaulty({ origin: data })
      clearFieldError('faultyOrigin')
    } else if (field === 'faultyDestination') {
      patchFaulty({ destination: data })
      clearFieldError('faultyDestination')
    }
    setPinDropModal({ isOpen: false, field: null })
  }

  const pinInitialAddress = (): AddressData | undefined => {
    switch (pinDropModal.field) {
      case 'workingOrigin':
        return working.origin
      case 'workingDestination':
        return working.destination
      case 'faultyOrigin':
        return faulty.origin
      case 'faultyDestination':
        return faulty.destination
      default:
        return undefined
    }
  }

  const validate = (): boolean => {
    const errors: Partial<Record<FieldErrorKey, string>> = {}
    const require = (key: FieldErrorKey, value: string) => {
      if (!value.trim()) errors[key] = `${fieldLabels[key]} הוא שדה חובה`
    }

    require('customerOrderNumber', header.customerOrderNumber)
    require('department', header.department)
    require('orderer', header.orderer)
    require('ordererPhone', header.ordererPhone)
    if (!towDate.trim() || !towTime.trim()) {
      errors.scheduledAt = `${fieldLabels.scheduledAt} הוא שדה חובה`
    }

    require('workingPlate', working.plateNumber)
    if (working.vehicleLookupNotFound && !working.vehicleType) {
      errors.workingPlate = 'יש לבחור סוג רכב בהזנה ידנית'
    }
    if (!working.vehicleCode.trim()) {
      errors.workingVehicleCode = 'קוד רכב הוא שדה חובה'
    }
    require('workingOrigin', working.origin.address)
    if (showWorkingOriginContacts) {
      require('workingOriginContactName', working.originContactName)
      require('workingOriginContactPhone', working.originContactPhone)
    }
    require('workingDestination', working.destination.address)
    if (showHubOrWorkingDestContacts) {
      require('workingDestinationContactName', working.destinationContactName)
      require('workingDestinationContactPhone', working.destinationContactPhone)
    }

    require('faultyPlate', faulty.plateNumber)
    if (faulty.vehicleLookupNotFound && !faulty.vehicleType) {
      errors.faultyPlate = 'יש לבחור סוג רכב בהזנה ידנית'
    }
    if (!faulty.vehicleCode.trim()) {
      errors.faultyVehicleCode = 'קוד רכב הוא שדה חובה'
    }
    if (faultyDefects.length === 0) {
      errors.faultyDefects = 'יש לבחור לפחות תקלה אחת'
    }
    if (exchangePointSplit) {
      require('faultyOrigin', faulty.origin.address)
      require('faultyOriginContactName', faulty.originContactName)
      require('faultyOriginContactPhone', faulty.originContactPhone)
    }
    require('faultyDestination', faulty.destination.address)
    if (showFaultyDestinationContacts) {
      require('faultyDestinationContactName', faulty.destinationContactName)
      require('faultyDestinationContactPhone', faulty.destinationContactPhone)
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')

    if (!userId || !customerId || !companyId) {
      setSubmitError('לא ניתן לשלוח בקשה — חסרים פרטי לקוח או חברה')
      return
    }

    if (!validate()) return

    setSubmitting(true)
    try {
      await createFullCustomerTowRequest({
        companyId,
        customerId,
        submittedByUserId: userId,
        towType: 'exchange',
        customerOrderNumber: header.customerOrderNumber.trim(),
        scheduledAt: new Date(`${towDate}T${towTime}:00`).toISOString(),
        department: header.department.trim(),
        orderer: header.orderer.trim(),
        ordererPhone: header.ordererPhone.trim(),
        notes: header.notes.trim() || null,
        // Header deadhead flag — not "working pickup from storage". Keep isStorage on the pickup point.
        startFromBase: false,
        dropoffToStorage: faultyToStorage,
        vehicles: [
          {
            ...buildVehiclePayload(working, { isWorking: true, orderIndex: 0 }),
            storedVehicleId: selectedWorkingStoredId,
          },
          buildVehiclePayload(faulty, {
            isWorking: false,
            towReason: faultyDefects.length
              ? serializeDefects(faultyDefects)
              : undefined,
            orderIndex: 1,
          }),
        ],
        points: exchangePointSplit
          ? [
              {
                pointOrder: 0,
                pointType: 'pickup' as const,
                address: working.origin.address.trim(),
                lat: working.origin.lat ?? null,
                lng: working.origin.lng ?? null,
                contactName: showWorkingOriginContacts
                  ? working.originContactName.trim()
                  : '',
                contactPhone: showWorkingOriginContacts
                  ? working.originContactPhone.trim()
                  : '',
                isStorage: workingFromStorage,
              },
              {
                pointOrder: 1,
                pointType: 'dropoff' as const,
                address: working.destination.address.trim(),
                lat: working.destination.lat ?? null,
                lng: working.destination.lng ?? null,
                contactName: working.destinationContactName.trim(),
                contactPhone: working.destinationContactPhone.trim(),
                isStorage: false,
              },
              {
                pointOrder: 2,
                pointType: 'pickup' as const,
                address: faulty.origin.address.trim(),
                lat: faulty.origin.lat ?? null,
                lng: faulty.origin.lng ?? null,
                contactName: faulty.originContactName.trim(),
                contactPhone: faulty.originContactPhone.trim(),
                isStorage: false,
              },
              {
                pointOrder: 3,
                pointType: 'dropoff' as const,
                address: faulty.destination.address.trim(),
                lat: faulty.destination.lat ?? null,
                lng: faulty.destination.lng ?? null,
                contactName: showFaultyDestinationContacts
                  ? faulty.destinationContactName.trim()
                  : '',
                contactPhone: showFaultyDestinationContacts
                  ? faulty.destinationContactPhone.trim()
                  : '',
                isStorage: faultyToStorage,
              },
            ]
          : [
              {
                pointOrder: 0,
                pointType: 'pickup' as const,
                address: working.origin.address.trim(),
                lat: working.origin.lat ?? null,
                lng: working.origin.lng ?? null,
                contactName: showWorkingOriginContacts
                  ? working.originContactName.trim()
                  : '',
                contactPhone: showWorkingOriginContacts
                  ? working.originContactPhone.trim()
                  : '',
                isStorage: workingFromStorage,
              },
              {
                pointOrder: 1,
                pointType: 'exchange' as const,
                address: working.destination.address.trim(),
                lat: working.destination.lat ?? null,
                lng: working.destination.lng ?? null,
                contactName: working.destinationContactName.trim(),
                contactPhone: working.destinationContactPhone.trim(),
                isStorage: false,
              },
              {
                pointOrder: 2,
                pointType: 'dropoff' as const,
                address: faulty.destination.address.trim(),
                lat: faulty.destination.lat ?? null,
                lng: faulty.destination.lng ?? null,
                contactName: showFaultyDestinationContacts
                  ? faulty.destinationContactName.trim()
                  : '',
                contactPhone: showFaultyDestinationContacts
                  ? faulty.destinationContactPhone.trim()
                  : '',
                isStorage: faultyToStorage,
              },
            ],
        pointVehicles: exchangePointSplit
          ? [
              { vehicleIndex: 0, pointIndex: 0, action: 'pickup' as const },
              { vehicleIndex: 0, pointIndex: 1, action: 'dropoff' as const },
              { vehicleIndex: 1, pointIndex: 2, action: 'pickup' as const },
              { vehicleIndex: 1, pointIndex: 3, action: 'dropoff' as const },
            ]
          : [
              { vehicleIndex: 0, pointIndex: 0, action: 'pickup' as const },
              { vehicleIndex: 0, pointIndex: 1, action: 'exchange' as const },
              { vehicleIndex: 1, pointIndex: 1, action: 'exchange' as const },
              { vehicleIndex: 1, pointIndex: 2, action: 'dropoff' as const },
            ],
      })
      setSuccess(true)
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'שגיאה בשליחת הבקשה'
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!canSubmit) {
    return (
      <div className={PORTAL_STATUS_CARD_CLASS}>
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h1 className="text-lg font-bold text-gt-text-primary mb-2">תקין תקול</h1>
        <p className="text-gt-text-secondary">
          הרשאת הזמנת גרירות אינה פעילה — פנה לחברת הגרירה
        </p>
        <Link
          href="/customer"
          className="inline-block mt-6 text-sm text-gt-brand-text hover:text-gt-brand transition-colors"
        >
          חזרה לגרירות
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className={PORTAL_STATUS_CARD_CLASS}>
        <CheckCircle2 className="w-12 h-12 text-gt-success mx-auto mb-4" />
        <h1 className="text-lg font-bold text-gt-text-primary mb-2">הבקשה נשלחה</h1>
        <p className="text-gt-text-secondary mb-6">
          בקשת תקין תקול נקלטה וממתינה לטיפול.
        </p>
        <Link
          href="/customer"
          className="inline-flex items-center justify-center px-5 py-2.5 bg-gt-brand text-white rounded-lg text-sm font-medium hover:bg-gt-brand-hover transition-colors"
        >
          חזרה לגרירות
        </Link>
      </div>
    )
  }

  const columnCardClass = PORTAL_COLUMN_CARD_CLASS

  const columnBodyClass = 'space-y-2.5'

  const sectionLabelClass = PORTAL_SECTION_LABEL_CLASS

  const renderRouteStack = (
    state: VehicleSide,
    patch: (p: Partial<VehicleSide>) => void,
    opts: {
      kind: 'origin' | 'destination'
      routeTitle: string
      addressKey: FieldErrorKey
      nameKey: FieldErrorKey
      phoneKey: FieldErrorKey
      pin: PinField
      showContacts?: boolean
      /** When true, clearing the address also clears contact name/phone. */
      clearContactsWhenAddressEmpty?: boolean
      storageToggle?: { label: string; checked: boolean; onChange: (v: boolean) => void }
      storageYardConfirm?: StorageYardConfirmProp | null
    }
  ) => {
    const address = opts.kind === 'origin' ? state.origin : state.destination
    const contactName =
      opts.kind === 'origin' ? state.originContactName : state.destinationContactName
    const contactPhone =
      opts.kind === 'origin' ? state.originContactPhone : state.destinationContactPhone
    const showContacts = opts.showContacts !== false

    return (
      <div className="flex flex-col gap-1.5 min-w-0 h-full">
        <div className="flex items-center justify-between gap-2 min-h-[1.25rem]">
          <h4 className={`${sectionLabelClass} flex items-center gap-1.5`}>
            <MapPin size={12} className="text-gt-text-tertiary shrink-0" strokeWidth={1.75} />
            {opts.routeTitle}
          </h4>
          {opts.storageToggle && (
            <label className="inline-flex items-center gap-1.5 text-xs text-gt-text-tertiary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={opts.storageToggle.checked}
                onChange={(e) => opts.storageToggle!.onChange(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gt-border text-gt-brand focus:ring-gt-brand focus:ring-offset-0"
              />
              <span
                className={
                  opts.storageToggle.checked ? 'text-gt-text-secondary font-medium' : undefined
                }
              >
                {opts.storageToggle.label}
              </span>
            </label>
          )}
        </div>
        <FormField
          required
          error={fieldErrors[opts.addressKey]}
          className="w-full min-w-0"
        >
          <AddressInput
            hideLabel
            className="w-full"
            value={address}
            onChange={(data: AddressData) => {
              const next: Partial<VehicleSide> =
                opts.kind === 'origin' ? { origin: data } : { destination: data }
              if (opts.clearContactsWhenAddressEmpty && !data.address.trim()) {
                if (opts.kind === 'origin') {
                  next.originContactName = ''
                  next.originContactPhone = ''
                } else {
                  next.destinationContactName = ''
                  next.destinationContactPhone = ''
                }
                clearFieldError(opts.nameKey)
                clearFieldError(opts.phoneKey)
              }
              patch(next)
              clearFieldError(opts.addressKey)
            }}
            placeholder={
              opts.kind === 'origin' ? 'כתובת מוצא' : 'כתובת יעד'
            }
            required
            narrowColumn
            onPinDropClick={() => setPinDropModal({ isOpen: true, field: opts.pin })}
            storageYardConfirm={opts.storageYardConfirm}
            savedAddresses={savedAddressesForInput}
            extraActions={
              <SavePortalAddressControl
                variant="icon"
                addressData={address}
                addresses={portalAddresses}
                onAddressesChange={setPortalAddresses}
                companyId={companyId}
                customerId={customerId}
                userId={userId}
                canEdit={canEditAddresses}
              />
            }
          />
        </FormField>

        {/* Always reserve contact-pair height so storage / empty-address toggles do not reflow. */}
        <div
          className={`min-h-[4.75rem] transition-opacity duration-200 ease-out ${
            showContacts ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden={!showContacts}
          {...(!showContacts ? { inert: true } : {})}
        >
          <FormField
            required={showContacts}
            error={
              showContacts
                ? fieldErrors[opts.nameKey] || fieldErrors[opts.phoneKey]
                : undefined
            }
            className="min-w-0"
          >
            <PortalContactPairFields
              name={contactName}
              phone={contactPhone}
              onNameChange={(v) => {
                if (opts.kind === 'origin') patch({ originContactName: v })
                else patch({ destinationContactName: v })
                clearFieldError(opts.nameKey)
              }}
              onPhoneChange={(v) => {
                if (opts.kind === 'origin') patch({ originContactPhone: v })
                else patch({ destinationContactPhone: v })
                clearFieldError(opts.phoneKey)
              }}
              contacts={portalContacts}
              onContactsChange={setPortalContacts}
              contactsLoading={portalContactsLoading}
              companyId={companyId}
              customerId={customerId}
              userId={userId}
              canEdit={canEditContacts}
              namePlaceholder="שם איש קשר"
              phonePlaceholder="טלפון"
              nameHasError={!!fieldErrors[opts.nameKey]}
            />
          </FormField>
        </div>
      </div>
    )
  }

  return (
    <div className={PORTAL_PAGE_SHELL_CLASS} dir="rtl">
      <PortalRequestPageHeader>
        <h1 className={PORTAL_PAGE_TITLE_CLASS}>תקין תקול</h1>
        <p className={PORTAL_PAGE_SUBTITLE_CLASS}>
          רכב תקין נכנס + רכב תקול יוצא — הבקשה תמתין לטיפול החברה
        </p>
      </PortalRequestPageHeader>

      <form onSubmit={handleSubmit} className={PORTAL_FORM_STACK_CLASS}>
        {/* Full-width order band — matches simple form */}
        <FormCard
          icon={ClipboardList}
          title="פרטי הזמנה"
          step={1}
          density="compact"
          className="mb-0"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-x-3 gap-y-2 items-start">
            <FormField
              required
              error={fieldErrors.customerOrderNumber}
            >
              <Input
                type="text"
                value={header.customerOrderNumber}
                onChange={(e) => updateHeader('customerOrderNumber', e.target.value)}
                placeholder={fieldLabels.customerOrderNumber}
                hasError={!!fieldErrors.customerOrderNumber}
              />
            </FormField>

            <FormField required error={fieldErrors.scheduledAt}>
              <div className="flex flex-col gap-1.5" aria-label={fieldLabels.scheduledAt}>
                <div className={`${PORTAL_SEGMENT_WRAP_CLASS} h-9`}>
                  <button
                    type="button"
                    aria-pressed={!useCustomTime}
                    onClick={() => {
                      handleNowClick()
                      setUseCustomTime(false)
                    }}
                    className={`${
                      !useCustomTime
                        ? PORTAL_SEGMENT_ACTIVE_CLASS
                        : PORTAL_SEGMENT_INACTIVE_CLASS
                    } flex h-full items-center justify-center`}
                  >
                    עכשיו
                  </button>
                  <button
                    type="button"
                    aria-pressed={useCustomTime}
                    onClick={() => setUseCustomTime(true)}
                    className={`${
                      useCustomTime
                        ? PORTAL_SEGMENT_ACTIVE_CLASS
                        : PORTAL_SEGMENT_INACTIVE_CLASS
                    } flex h-full items-center justify-center`}
                  >
                    מועד אחר
                  </button>
                </div>
                {useCustomTime && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <DateInput
                      value={towDate}
                      onChange={(v) => {
                        setTowDate(v)
                        clearFieldError('scheduledAt')
                      }}
                      narrowColumn
                      hasError={!!fieldErrors.scheduledAt}
                      className="w-full"
                    />
                    <TimeInput
                      value={towTime}
                      onChange={(v) => {
                        setTowTime(v)
                        clearFieldError('scheduledAt')
                      }}
                      narrowColumn
                      hasError={!!fieldErrors.scheduledAt}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </FormField>

            <FormField required error={fieldErrors.department}>
              <Input
                type="text"
                value={header.department}
                onChange={(e) => updateHeader('department', e.target.value)}
                placeholder={fieldLabels.department}
                hasError={!!fieldErrors.department}
              />
            </FormField>

            <FormField required error={fieldErrors.orderer || fieldErrors.ordererPhone}>
              <PortalContactPairFields
                name={header.orderer}
                phone={header.ordererPhone}
                onNameChange={(v) => updateHeader('orderer', v)}
                onPhoneChange={(v) => updateHeader('ordererPhone', v)}
                contacts={portalContacts}
                onContactsChange={setPortalContacts}
                contactsLoading={portalContactsLoading}
                companyId={companyId}
                customerId={customerId}
                userId={userId}
                canEdit={canEditContacts}
                namePlaceholder={fieldLabels.orderer}
                phonePlaceholder={fieldLabels.ordererPhone}
                nameHasError={!!fieldErrors.orderer}
              />
            </FormField>

            <FormField optional>
              <textarea
                value={header.notes}
                onChange={(e) => updateHeader('notes', e.target.value)}
                rows={1}
                placeholder="הערות / פרטים נוספים"
                className={`${PORTAL_TEXTAREA_CLASS} min-h-9 py-2 resize-y`}
                aria-label={fieldLabels.notes}
              />
            </FormField>
          </div>
        </FormCard>

        {/* Two vehicle columns */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 ${PORTAL_GRID_GAP_CLASS} items-start`}>
          <FormCard
            icon={Truck}
            title="רכב תקין"
            description="רכב תקין שמגיע ללקוח"
            step={2}
            density="compact"
            className={columnCardClass}
          >
            <div className={columnBodyClass}>
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className={sectionLabelClass}>פרטי רכב</h4>
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
                    תקין
                  </span>
                </div>

                {selectedWorkingStored && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gt-text-secondary">
                    <span className="text-xs font-medium text-gt-brand-text">מאחסנה</span>
                    <span className="font-medium text-gt-text-primary">
                      {selectedWorkingStored.plate_number}
                    </span>
                    <TimeInStoragePill lastStoredAt={selectedWorkingStored.last_stored_at} />
                    <button
                      type="button"
                      onClick={clearWorkingStoredSelection}
                      className="text-xs text-gt-brand-text hover:text-gt-brand underline"
                    >
                      נקה בחירה
                    </button>
                  </div>
                )}

                <FormField
                  label="מספר רישוי"
                  required
                  error={fieldErrors.workingPlate}
                >
                  <VehicleLookup
                    narrowColumn
                    hideLabel
                    showVehicleCode
                    vehicleCode={working.vehicleCode}
                    onVehicleCodeChange={(code) => {
                      patchWorking({ vehicleCode: code })
                      clearFieldError('workingVehicleCode')
                    }}
                    manualEntryStyle="button"
                    manualEntryPlacement="inline"
                    manualEntryTrailing={
                      !storageLoading && operationalStoredVehicles.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setStorageModalOpen(true)}
                          title="בחר רכב תקין מאחסנה"
                          className={PORTAL_STORAGE_BUTTON_CLASS}
                        >
                          <Package size={13} className="shrink-0" strokeWidth={1.75} />
                          מאחסנה
                        </button>
                      ) : null
                    }
                    plateNumber={working.plateNumber}
                    onPlateChange={(plate) => {
                      patchWorking({ plateNumber: plate })
                      clearFieldError('workingPlate')
                      if (selectedWorkingStoredId) {
                        const selected = operationalStoredVehicles.find(
                          (v) => v.id === selectedWorkingStoredId
                        )
                        if (!selected || selected.plate_number !== plate) {
                          setSelectedWorkingStoredId(null)
                          clearWorkingOriginYard()
                        }
                      }
                    }}
                    vehicleData={working.vehicleData}
                    onVehicleDataChange={(data) => patchWorking({ vehicleData: data })}
                    vehicleType={working.vehicleType}
                    onVehicleTypeChange={(t) => patchWorking({ vehicleType: t })}
                    vehicleLookupNotFound={working.vehicleLookupNotFound}
                    onVehicleLookupNotFoundChange={(v) =>
                      patchWorking({ vehicleLookupNotFound: v })
                    }
                    manualManufacturer={working.manualManufacturer}
                    onManualManufacturerChange={(v) => patchWorking({ manualManufacturer: v })}
                    manualColor={working.manualColor}
                    onManualColorChange={(v) => patchWorking({ manualColor: v })}
                    manualChassis={working.manualChassis}
                    onManualChassisChange={(v) => patchWorking({ manualChassis: v })}
                    manualWeight={working.manualWeight}
                    onManualWeightChange={(v) => patchWorking({ manualWeight: v })}
                  />
                </FormField>
                {fieldErrors.workingVehicleCode && (
                  <p className="text-[11px] text-gt-danger">
                    {fieldErrors.workingVehicleCode}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                {renderRouteStack(working, patchWorking, {
                  kind: 'origin',
                  routeTitle: 'מוצא',
                  addressKey: 'workingOrigin',
                  nameKey: 'workingOriginContactName',
                  phoneKey: 'workingOriginContactPhone',
                  pin: 'workingOrigin',
                  showContacts: showWorkingOriginContacts,
                  clearContactsWhenAddressEmpty: true,
                  storageYardConfirm: workingFromStorage
                    ? null
                    : workingOriginYardConfirm,
                })}
                {renderRouteStack(working, patchWorking, {
                  kind: 'destination',
                  routeTitle: exchangePointSplit ? 'יעד' : 'נקודת החלפה',
                  addressKey: 'workingDestination',
                  nameKey: 'workingDestinationContactName',
                  phoneKey: 'workingDestinationContactPhone',
                  pin: 'workingDestination',
                  showContacts: showHubOrWorkingDestContacts,
                })}
              </div>
              <p
                className={`text-[11px] text-gt-text-tertiary min-h-[1rem] transition-opacity duration-200 ease-out ${
                  exchangePointSplit ? 'opacity-0' : 'opacity-100'
                }`}
                aria-hidden={exchangePointSplit}
              >
                התקין יורד כאן · התקול נאסף כאן
              </p>
            </div>
          </FormCard>

          <FormCard
            icon={Truck}
            title="רכב תקול"
            description="רכב תקול שנאסף מהלקוח"
            step={3}
            density="compact"
            className={columnCardClass}
          >
            <div className={columnBodyClass}>
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className={sectionLabelClass}>פרטי רכב</h4>
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                    תקול
                  </span>
                </div>

                <FormField
                  label="מספר רישוי"
                  required
                  error={fieldErrors.faultyPlate}
                >
                  <VehicleLookup
                    narrowColumn
                    hideLabel
                    showVehicleCode
                    vehicleCode={faulty.vehicleCode}
                    onVehicleCodeChange={(code) => {
                      patchFaulty({ vehicleCode: code })
                      clearFieldError('faultyVehicleCode')
                    }}
                    manualEntryStyle="button"
                    manualEntryPlacement="inline"
                    manualEntryEnd={
                      <PortalDefectSelector
                        triggerLabel="בחר תקלות"
                        label="תקלות"
                        triggerClassName={PORTAL_DEFECTS_TRIGGER_CLASS}
                        selectedDefects={faultyDefects}
                        onChange={(d) => {
                          setFaultyDefects(d)
                          clearFieldError('faultyDefects')
                        }}
                      />
                    }
                    plateNumber={faulty.plateNumber}
                    onPlateChange={(plate) => {
                      patchFaulty({ plateNumber: plate })
                      clearFieldError('faultyPlate')
                    }}
                    vehicleData={faulty.vehicleData}
                    onVehicleDataChange={(data) => patchFaulty({ vehicleData: data })}
                    vehicleType={faulty.vehicleType}
                    onVehicleTypeChange={(t) => patchFaulty({ vehicleType: t })}
                    vehicleLookupNotFound={faulty.vehicleLookupNotFound}
                    onVehicleLookupNotFoundChange={(v) =>
                      patchFaulty({ vehicleLookupNotFound: v })
                    }
                    manualManufacturer={faulty.manualManufacturer}
                    onManualManufacturerChange={(v) => patchFaulty({ manualManufacturer: v })}
                    manualColor={faulty.manualColor}
                    onManualColorChange={(v) => patchFaulty({ manualColor: v })}
                    manualChassis={faulty.manualChassis}
                    onManualChassisChange={(v) => patchFaulty({ manualChassis: v })}
                    manualWeight={faulty.manualWeight}
                    onManualWeightChange={(v) => patchFaulty({ manualWeight: v })}
                  />
                </FormField>
                {fieldErrors.faultyVehicleCode && (
                  <p className="text-[11px] text-gt-danger">
                    {fieldErrors.faultyVehicleCode}
                  </p>
                )}
                {fieldErrors.faultyDefects && (
                  <p className="text-[11px] text-gt-danger">{fieldErrors.faultyDefects}</p>
                )}
              </div>

              {/* Mode switch governs the address pair below — not a field-level action. */}
              <div className="space-y-2 min-w-0">
                <div
                  className={PORTAL_SEGMENT_WRAP_CLASS}
                  role="group"
                  aria-label="מבנה נקודת החלפה"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (exchangePointSplit) collapseExchangePoint()
                    }}
                    aria-pressed={!exchangePointSplit}
                    className={
                      !exchangePointSplit
                        ? PORTAL_SEGMENT_ACTIVE_CLASS
                        : PORTAL_SEGMENT_INACTIVE_CLASS
                    }
                  >
                    אחד נקודת החלפה
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!exchangePointSplit) splitExchangePoint()
                    }}
                    aria-pressed={exchangePointSplit}
                    className={
                      exchangePointSplit
                        ? PORTAL_SEGMENT_ACTIVE_CLASS
                        : PORTAL_SEGMENT_INACTIVE_CLASS
                    }
                  >
                    פצל נקודת החלפה
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0 items-stretch">
                  {/*
                    sm+: always two columns so dest does not slide when origin appears.
                    Mobile: collapse origin height in hub — a full-width empty block would be
                    a permanent large gap (called out in the report).
                  */}
                  <div
                    className={`relative min-w-0 transition-[max-height,opacity] duration-200 ease-out overflow-hidden sm:overflow-visible ${
                      exchangePointSplit
                        ? 'max-h-[40rem] opacity-100'
                        : 'max-h-0 opacity-0 pointer-events-none sm:max-h-none sm:opacity-100 sm:pointer-events-auto'
                    }`}
                    aria-hidden={!exchangePointSplit}
                    {...(!exchangePointSplit ? { inert: true } : {})}
                  >
                    <div
                      className={`h-full transition-opacity duration-200 ease-out ${
                        exchangePointSplit
                          ? 'opacity-100'
                          : 'opacity-0 sm:absolute sm:inset-0 sm:opacity-0'
                      }`}
                    >
                      {renderRouteStack(faulty, patchFaulty, {
                        kind: 'origin',
                        routeTitle: 'מוצא',
                        addressKey: 'faultyOrigin',
                        nameKey: 'faultyOriginContactName',
                        phoneKey: 'faultyOriginContactPhone',
                        pin: 'faultyOrigin',
                      })}
                    </div>
                    <div
                      className={`hidden sm:flex h-full min-h-[12.5rem] items-center justify-center rounded-lg border border-dashed border-gt-border-subtle bg-gt-surface-subtle/40 px-3 transition-opacity duration-200 ease-out ${
                        exchangePointSplit
                          ? 'opacity-0 pointer-events-none absolute inset-0'
                          : 'opacity-100'
                      }`}
                      aria-hidden={exchangePointSplit}
                    >
                      <p className="text-[11px] text-gt-text-tertiary text-center leading-snug">
                        מוצא התקול בנקודת ההחלפה
                      </p>
                    </div>
                  </div>

                  {renderRouteStack(faulty, patchFaulty, {
                    kind: 'destination',
                    routeTitle: 'יעד',
                    addressKey: 'faultyDestination',
                    nameKey: 'faultyDestinationContactName',
                    phoneKey: 'faultyDestinationContactPhone',
                    pin: 'faultyDestination',
                    showContacts: showFaultyDestinationContacts,
                    clearContactsWhenAddressEmpty: true,
                    storageToggle: {
                      label: 'לאחסנה',
                      checked: faultyToStorage,
                      onChange: setFaultyDestinationToYard,
                    },
                    storageYardConfirm: faultyDestYardConfirm,
                  })}
                </div>
              </div>
            </div>
          </FormCard>
        </div>

        {submitError && (
          <div className={PORTAL_ERROR_BANNER_CLASS}>
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" strokeWidth={1.75} />
            <span>{submitError}</span>
          </div>
        )}

        <div className={PORTAL_FORM_FOOTER_CLASS}>
          <div className={PORTAL_FORM_FOOTER_INNER_CLASS}>
            <Link href="/customer" className={PORTAL_CANCEL_LINK_CLASS}>
              ביטול
            </Link>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={submitting}
              className={PORTAL_SUBMIT_CLASS}
            >
              {submitting && <Loader2 size={18} className="animate-spin" />}
              שליחת בקשת תקין תקול
            </Button>
          </div>
        </div>
      </form>

      <StorageVehiclePickerModal
        isOpen={storageModalOpen}
        onClose={() => setStorageModalOpen(false)}
        vehicles={operationalStoredVehicles}
        onSelect={handleSelectWorkingStored}
        title="בחר רכב תקין מאחסנה"
      />

      <PinDropModal
        isOpen={pinDropModal.isOpen}
        onClose={() => setPinDropModal({ isOpen: false, field: null })}
        onConfirm={handlePinDropConfirm}
        initialAddress={pinInitialAddress()}
        title="בחר מיקום"
      />
    </div>
  )
}

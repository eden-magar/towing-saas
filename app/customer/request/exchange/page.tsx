'use client'

import { useState } from 'react'
import Link from 'next/link'
import { type CustomerPortalStoredVehicle } from '@/app/lib/queries/customer-portal'
import { createFullCustomerTowRequest } from '@/app/lib/queries/customer-tow-requests'
import { usePortalRequestBootstrap } from '@/app/components/customer-portal/PortalRequestBootstrap'
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
import { PhoneInput } from '@/app/components/ui/PhoneInput'
import { DefectSelector } from '@/app/components/tow-forms/shared/DefectSelector'
import { VehicleLookup } from '@/app/components/tow-forms/shared/VehicleLookup'
import { PinDropModal } from '@/app/components/tow-forms/shared/PinDropModal'
import {
  AddressInput,
  type AddressData,
} from '@/app/components/tow-forms/routes/AddressInput'
import type { VehicleLookupResult, VehicleType } from '@/app/lib/types'
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPin,
  MessageSquareText,
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
  | 'workingOrigin'
  | 'workingOriginContactName'
  | 'workingOriginContactPhone'
  | 'workingDestination'
  | 'workingDestinationContactName'
  | 'workingDestinationContactPhone'
  | 'faultyPlate'
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
  workingPlate: 'מספר רישוי (תקין)',
  workingOrigin: 'מוצא רכב תקין',
  workingOriginContactName: 'איש קשר מוצא (תקין)',
  workingOriginContactPhone: 'טלפון מוצא (תקין)',
  workingDestination: 'יעד רכב תקין',
  workingDestinationContactName: 'איש קשר יעד (תקין)',
  workingDestinationContactPhone: 'טלפון יעד (תקין)',
  faultyPlate: 'מספר רישוי (תקול)',
  faultyDefects: 'תקלות',
  faultyOrigin: 'מוצא רכב תקול',
  faultyOriginContactName: 'איש קשר מוצא (תקול)',
  faultyOriginContactPhone: 'טלפון מוצא (תקול)',
  faultyDestination: 'יעד רכב תקול',
  faultyDestinationContactName: 'איש קשר יעד (תקול)',
  faultyDestinationContactPhone: 'טלפון יעד (תקול)',
}

type PinField =
  | 'workingOrigin'
  | 'workingDestination'
  | 'faultyOrigin'
  | 'faultyDestination'

const textareaClassName =
  'w-full px-3 py-2 rounded-lg text-sm bg-white text-gt-text-primary border border-gt-border placeholder:text-gt-text-tertiary hover:border-gt-border-strong focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/15 transition-colors duration-150 resize-none'

function buildVehiclePayload(
  side: VehicleSide,
  opts: { isWorking: boolean; towReason?: string; orderIndex: number }
) {
  const plate = side.plateNumber.trim()
  const base = {
    plateNumber: plate,
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
    }
  }

  if (side.vehicleLookupNotFound) {
    return {
      ...base,
      manufacturer: side.manualManufacturer.trim() || null,
      color: side.manualColor.trim() || null,
      vehicleType: side.vehicleType ? (side.vehicleType as VehicleType) : null,
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

  const [workingFromStorage, setWorkingFromStorage] = useState(false)
  const [selectedWorkingStoredId, setSelectedWorkingStoredId] = useState<string | null>(null)
  const [faultyToStorage, setFaultyToStorage] = useState(false)

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

  const setWorkingOriginFromYard = (enabled: boolean) => {
    setWorkingFromStorage(enabled)
    if (enabled) {
      patchWorking({ origin: applyYardToAddress() })
      clearFieldError('workingOrigin')
    } else {
      patchWorking({ origin: emptyAddress() })
    }
  }

  const setFaultyDestinationToYard = (enabled: boolean) => {
    setFaultyToStorage(enabled)
    if (enabled) {
      patchFaulty({ destination: applyYardToAddress() })
      clearFieldError('faultyDestination')
    } else {
      patchFaulty({ destination: emptyAddress() })
    }
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
    })
    if (workingFromStorage) setWorkingOriginFromYard(false)
    clearFieldError('workingPlate')
  }

  const handleSelectWorkingStored = (vehicle: CustomerPortalStoredVehicle) => {
    if (vehicle.current_status !== 'stored') return
    if (vehicle.vehicle_condition !== 'operational') return

    const lookup = buildLookupResultFromStored(vehicle)
    setSelectedWorkingStoredId(vehicle.id)
    patchWorking({
      plateNumber: vehicle.plate_number,
      vehicleLookupNotFound: false,
      manualManufacturer: '',
      manualColor: '',
      vehicleData: lookup,
      vehicleType: lookup ? ((lookup.source as VehicleType) || 'private') : '',
    })
    clearFieldError('workingPlate')
    setWorkingOriginFromYard(true)
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
    require('workingOrigin', working.origin.address)
    require('workingOriginContactName', working.originContactName)
    require('workingOriginContactPhone', working.originContactPhone)
    require('workingDestination', working.destination.address)
    require('workingDestinationContactName', working.destinationContactName)
    require('workingDestinationContactPhone', working.destinationContactPhone)

    require('faultyPlate', faulty.plateNumber)
    if (faulty.vehicleLookupNotFound && !faulty.vehicleType) {
      errors.faultyPlate = 'יש לבחור סוג רכב בהזנה ידנית'
    }
    if (faultyDefects.length === 0) {
      errors.faultyDefects = 'יש לבחור לפחות תקלה אחת'
    }
    require('faultyOrigin', faulty.origin.address)
    require('faultyOriginContactName', faulty.originContactName)
    require('faultyOriginContactPhone', faulty.originContactPhone)
    require('faultyDestination', faulty.destination.address)
    require('faultyDestinationContactName', faulty.destinationContactName)
    require('faultyDestinationContactPhone', faulty.destinationContactPhone)

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
        startFromBase: workingFromStorage,
        dropoffToStorage: faultyToStorage,
        vehicles: [
          buildVehiclePayload(working, { isWorking: true, orderIndex: 0 }),
          buildVehiclePayload(faulty, {
            isWorking: false,
            towReason: faultyDefects.join(', ') || undefined,
            orderIndex: 1,
          }),
        ],
        points: [
          {
            pointOrder: 0,
            pointType: 'pickup',
            address: working.origin.address.trim(),
            lat: working.origin.lat ?? null,
            lng: working.origin.lng ?? null,
            contactName: working.originContactName.trim(),
            contactPhone: working.originContactPhone.trim(),
            isStorage: workingFromStorage,
          },
          {
            pointOrder: 1,
            pointType: 'dropoff',
            address: working.destination.address.trim(),
            lat: working.destination.lat ?? null,
            lng: working.destination.lng ?? null,
            contactName: working.destinationContactName.trim(),
            contactPhone: working.destinationContactPhone.trim(),
            isStorage: false,
          },
          {
            pointOrder: 2,
            pointType: 'pickup',
            address: faulty.origin.address.trim(),
            lat: faulty.origin.lat ?? null,
            lng: faulty.origin.lng ?? null,
            contactName: faulty.originContactName.trim(),
            contactPhone: faulty.originContactPhone.trim(),
            isStorage: false,
          },
          {
            pointOrder: 3,
            pointType: 'dropoff',
            address: faulty.destination.address.trim(),
            lat: faulty.destination.lat ?? null,
            lng: faulty.destination.lng ?? null,
            contactName: faulty.destinationContactName.trim(),
            contactPhone: faulty.destinationContactPhone.trim(),
            isStorage: faultyToStorage,
          },
        ],
        pointVehicles: [
          { vehicleIndex: 0, pointIndex: 0, action: 'pickup' },
          { vehicleIndex: 0, pointIndex: 1, action: 'dropoff' },
          { vehicleIndex: 1, pointIndex: 2, action: 'pickup' },
          { vehicleIndex: 1, pointIndex: 3, action: 'dropoff' },
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
      <div className="max-w-lg mx-auto bg-white rounded-xl border border-gt-border shadow-sm p-8 text-center">
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
      <div className="max-w-lg mx-auto bg-white rounded-xl border border-gt-border shadow-sm p-8 text-center">
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

  const renderRoutePair = (
    state: VehicleSide,
    patch: (p: Partial<VehicleSide>) => void,
    opts: {
      originKey: FieldErrorKey
      originNameKey: FieldErrorKey
      originPhoneKey: FieldErrorKey
      destKey: FieldErrorKey
      destNameKey: FieldErrorKey
      destPhoneKey: FieldErrorKey
      originPin: PinField
      destPin: PinField
      showOriginStorage?: boolean
      showDestStorage?: boolean
    }
  ) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div className="space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold text-gt-text-secondary">מוצא</h4>
          {opts.showOriginStorage && (
            <label className="inline-flex items-center gap-1.5 text-xs text-gt-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={workingFromStorage}
                onChange={(e) => setWorkingOriginFromYard(e.target.checked)}
                className="rounded border-gt-border text-gt-brand focus:ring-gt-brand"
              />
              מאחסנה
            </label>
          )}
        </div>
        <FormField label={fieldLabels[opts.originKey]} required error={fieldErrors[opts.originKey]}>
          <AddressInput
            hideLabel
            className="w-full"
            value={state.origin}
            onChange={(data: AddressData) => {
              patch({ origin: data })
              clearFieldError(opts.originKey)
            }}
            placeholder="הזן כתובת מוצא..."
            required
            narrowColumn
            onPinDropClick={() => setPinDropModal({ isOpen: true, field: opts.originPin })}
          />
        </FormField>
        <FormField
          label={fieldLabels[opts.originNameKey]}
          required
          error={fieldErrors[opts.originNameKey]}
        >
          <Input
            type="text"
            value={state.originContactName}
            onChange={(e) => {
              patch({ originContactName: e.target.value })
              clearFieldError(opts.originNameKey)
            }}
            hasError={!!fieldErrors[opts.originNameKey]}
          />
        </FormField>
        <FormField
          label={fieldLabels[opts.originPhoneKey]}
          required
          error={fieldErrors[opts.originPhoneKey]}
        >
          <PhoneInput
            value={state.originContactPhone}
            onChange={(phone) => {
              patch({ originContactPhone: phone })
              clearFieldError(opts.originPhoneKey)
            }}
          />
        </FormField>
      </div>

      <div className="space-y-3 min-w-0 border-t border-gt-border-subtle pt-3 lg:border-t-0 lg:pt-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold text-gt-text-secondary">יעד</h4>
          {opts.showDestStorage && (
            <label className="inline-flex items-center gap-1.5 text-xs text-gt-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={faultyToStorage}
                onChange={(e) => setFaultyDestinationToYard(e.target.checked)}
                className="rounded border-gt-border text-gt-brand focus:ring-gt-brand"
              />
              לאחסנה
            </label>
          )}
        </div>
        <FormField label={fieldLabels[opts.destKey]} required error={fieldErrors[opts.destKey]}>
          <AddressInput
            hideLabel
            className="w-full"
            value={state.destination}
            onChange={(data: AddressData) => {
              patch({ destination: data })
              clearFieldError(opts.destKey)
            }}
            placeholder="הזן כתובת יעד..."
            required
            narrowColumn
            onPinDropClick={() => setPinDropModal({ isOpen: true, field: opts.destPin })}
          />
        </FormField>
        <FormField
          label={fieldLabels[opts.destNameKey]}
          required
          error={fieldErrors[opts.destNameKey]}
        >
          <Input
            type="text"
            value={state.destinationContactName}
            onChange={(e) => {
              patch({ destinationContactName: e.target.value })
              clearFieldError(opts.destNameKey)
            }}
            hasError={!!fieldErrors[opts.destNameKey]}
          />
        </FormField>
        <FormField
          label={fieldLabels[opts.destPhoneKey]}
          required
          error={fieldErrors[opts.destPhoneKey]}
        >
          <PhoneInput
            value={state.destinationContactPhone}
            onChange={(phone) => {
              patch({ destinationContactPhone: phone })
              clearFieldError(opts.destPhoneKey)
            }}
          />
        </FormField>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-3" dir="rtl">
      <div className="mb-1">
        <h1 className="text-xl font-bold text-gt-text-primary">תקין תקול</h1>
        <p className="text-sm text-gt-text-tertiary mt-1">
          רכב תקין נכנס + רכב תקול יוצא — הבקשה תמתין לטיפול החברה
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <FormCard icon={ClipboardList} title="פרטי הזמנה" className="mb-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <FormField
              label={fieldLabels.customerOrderNumber}
              required
              error={fieldErrors.customerOrderNumber}
            >
              <Input
                type="text"
                value={header.customerOrderNumber}
                onChange={(e) => updateHeader('customerOrderNumber', e.target.value)}
                hasError={!!fieldErrors.customerOrderNumber}
              />
            </FormField>

            <FormField label={fieldLabels.scheduledAt} required error={fieldErrors.scheduledAt}>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={!useCustomTime}
                    onClick={() => {
                      handleNowClick()
                      setUseCustomTime(false)
                    }}
                    className={
                      !useCustomTime
                        ? 'min-h-[36px] rounded-lg border text-sm font-medium bg-gt-brand text-white border-gt-brand'
                        : 'min-h-[36px] rounded-lg border text-sm font-medium bg-white text-gt-text-secondary border-gt-border hover:bg-gt-surface-hover'
                    }
                  >
                    עכשיו
                  </button>
                  <button
                    type="button"
                    aria-pressed={useCustomTime}
                    onClick={() => setUseCustomTime(true)}
                    className={
                      useCustomTime
                        ? 'min-h-[36px] rounded-lg border text-sm font-medium bg-gt-brand text-white border-gt-brand'
                        : 'min-h-[36px] rounded-lg border text-sm font-medium bg-white text-gt-text-secondary border-gt-border hover:bg-gt-surface-hover'
                    }
                  >
                    מועד אחר
                  </button>
                </div>
                {useCustomTime && (
                  <div className="flex flex-col gap-2 sm:flex-row">
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

            <FormField label={fieldLabels.department} required error={fieldErrors.department}>
              <Input
                type="text"
                value={header.department}
                onChange={(e) => updateHeader('department', e.target.value)}
                hasError={!!fieldErrors.department}
              />
            </FormField>

            <FormField label={fieldLabels.orderer} required error={fieldErrors.orderer}>
              <Input
                type="text"
                value={header.orderer}
                onChange={(e) => updateHeader('orderer', e.target.value)}
                hasError={!!fieldErrors.orderer}
              />
            </FormField>

            <FormField label={fieldLabels.ordererPhone} required error={fieldErrors.ordererPhone}>
              <PhoneInput
                value={header.ordererPhone}
                onChange={(phone) => updateHeader('ordererPhone', phone)}
              />
            </FormField>
          </div>
        </FormCard>

        {/* Working vehicle — תקין נכנס */}
        <FormCard
          icon={Truck}
          title="רכב תקין נכנס"
          description="רכב תקין שמגיע ללקוח (ניתן לבחור מאחסנה)"
          className="mb-0"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                תקין
              </span>
            </div>

            {selectedWorkingStored && (
              <div className="rounded-lg border border-gt-brand bg-gt-brand-subtle px-3 py-2">
                <p className="text-xs font-medium text-gt-brand-text">נבחר מאחסנה</p>
                <div className="flex flex-wrap items-center gap-2 text-sm mt-1">
                  <span className="font-medium text-gt-text-primary">
                    {selectedWorkingStored.plate_number}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                    תקין
                  </span>
                </div>
                <TimeInStoragePill lastStoredAt={selectedWorkingStored.last_stored_at} />
                <button
                  type="button"
                  onClick={clearWorkingStoredSelection}
                  className="mt-1.5 text-sm text-gt-brand-text hover:text-gt-brand underline"
                >
                  נקה בחירה והזן ידנית
                </button>
              </div>
            )}

            <FormField label={fieldLabels.workingPlate} required error={fieldErrors.workingPlate}>
              <VehicleLookup
                narrowColumn
                showVehicleCode
                vehicleCode={working.vehicleCode}
                onVehicleCodeChange={(code) => patchWorking({ vehicleCode: code })}
                manualEntryStyle="button"
                manualEntryPlacement="afterSummary"
                manualEntryTrailing={
                  !storageLoading && operationalStoredVehicles.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setStorageModalOpen(true)}
                      title="בחר רכב תקין מאחסנה"
                      className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-lg border border-gray-200 text-gt-brand text-xs font-medium hover:bg-gt-brand-subtle transition-colors"
                    >
                      <Package size={14} className="shrink-0" />
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
                      if (workingFromStorage) setWorkingOriginFromYard(false)
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
              />
            </FormField>

            <div className="border-t border-gt-border-subtle pt-3">
              <div className="flex items-center gap-1.5 mb-3">
                <MapPin size={14} className="text-gt-text-tertiary" />
                <h3 className="text-sm font-semibold text-gt-text-primary">מוצא ויעד — רכב תקין</h3>
              </div>
              {renderRoutePair(working, patchWorking, {
                originKey: 'workingOrigin',
                originNameKey: 'workingOriginContactName',
                originPhoneKey: 'workingOriginContactPhone',
                destKey: 'workingDestination',
                destNameKey: 'workingDestinationContactName',
                destPhoneKey: 'workingDestinationContactPhone',
                originPin: 'workingOrigin',
                destPin: 'workingDestination',
                showOriginStorage: true,
              })}
            </div>
          </div>
        </FormCard>

        {/* Faulty vehicle — תקול יוצא */}
        <FormCard
          icon={Truck}
          title="רכב תקול יוצא"
          description="רכב תקול שנאסף מהלקוח (ניתן לשלוח לאחסנה)"
          className="mb-0"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                תקול
              </span>
            </div>

            <FormField label={fieldLabels.faultyPlate} required error={fieldErrors.faultyPlate}>
              <VehicleLookup
                narrowColumn
                showVehicleCode
                vehicleCode={faulty.vehicleCode}
                onVehicleCodeChange={(code) => patchFaulty({ vehicleCode: code })}
                manualEntryStyle="button"
                manualEntryPlacement="afterSummary"
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
              />
            </FormField>

            <FormField required error={fieldErrors.faultyDefects}>
              <DefectSelector
                variant="triggerOnly"
                triggerLabel="בחר תקלות"
                label="תקלות"
                selectedDefects={faultyDefects}
                onChange={(d) => {
                  setFaultyDefects(d)
                  clearFieldError('faultyDefects')
                }}
              />
            </FormField>

            <div className="border-t border-gt-border-subtle pt-3">
              <div className="flex items-center gap-1.5 mb-3">
                <MapPin size={14} className="text-gt-text-tertiary" />
                <h3 className="text-sm font-semibold text-gt-text-primary">מוצא ויעד — רכב תקול</h3>
              </div>
              {renderRoutePair(faulty, patchFaulty, {
                originKey: 'faultyOrigin',
                originNameKey: 'faultyOriginContactName',
                originPhoneKey: 'faultyOriginContactPhone',
                destKey: 'faultyDestination',
                destNameKey: 'faultyDestinationContactName',
                destPhoneKey: 'faultyDestinationContactPhone',
                originPin: 'faultyOrigin',
                destPin: 'faultyDestination',
                showDestStorage: true,
              })}
            </div>
          </div>
        </FormCard>

        <FormCard icon={MessageSquareText} title="הערות" className="mb-0">
          <FormField label={`${fieldLabels.notes} (אופציונלי)`}>
            <textarea
              value={header.notes}
              onChange={(e) => updateHeader('notes', e.target.value)}
              rows={3}
              placeholder="פרטים נוספים שיעזרו לחברה לטפל בבקשה..."
              className={textareaClassName}
            />
          </FormField>
        </FormCard>

        {submitError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-gt-danger-subtle border border-gt-danger/20 text-sm text-gt-danger">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 pt-1">
          <Link
            href="/customer"
            className="inline-flex items-center justify-center gap-1.5 font-medium rounded-lg border bg-transparent text-gt-text-secondary border-transparent hover:bg-gt-surface-hover px-5 py-2.5 text-sm transition-all duration-150"
          >
            ביטול
          </Link>
          <Button type="submit" variant="primary" size="lg" disabled={submitting}>
            {submitting && <Loader2 size={16} className="animate-spin" />}
            שליחת בקשת תקין תקול
          </Button>
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

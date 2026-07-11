'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  type CustomerPortalStoredVehicle,
} from '@/app/lib/queries/customer-portal'
import { usePortalRequestBootstrap } from '@/app/components/customer-portal/PortalRequestBootstrap'
import { PortalRequestPageHeader } from '@/app/components/customer-portal/PortalRequestPageHeader'
import {
  PORTAL_CANCEL_LINK_CLASS,
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
  PORTAL_STORAGE_BANNER_CLASS,
  PORTAL_STORAGE_BUTTON_CLASS,
  PORTAL_SUBMIT_CLASS,
  PORTAL_TEXTAREA_CLASS,
} from '@/app/components/customer-portal/portalRequestActionStyles'
import { createFullCustomerTowRequest } from '@/app/lib/queries/customer-tow-requests'
import { storedVehicleToCondition } from '@/app/lib/utils/storage-vehicle'
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
import { PortalDefectSelector } from '@/app/components/customer-portal/PortalDefectSelector'
import { VehicleLookup } from '@/app/components/tow-forms/shared/VehicleLookup'
import { PinDropModal } from '@/app/components/tow-forms/shared/PinDropModal'
import { SelectorModalShell } from '@/app/components/tow-forms/shared/SelectorModalShell'
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
  Package,
  Truck,
} from 'lucide-react'

/** Map a portal stored_vehicles row → VehicleLookupResult (mirrors dashboard hydrate). */
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

type FormState = {
  customerOrderNumber: string
  department: string
  orderer: string
  ordererPhone: string
  pickupContactName: string
  pickupContactPhone: string
  dropoffContactName: string
  dropoffContactPhone: string
  notes: string
}

const emptyForm: FormState = {
  customerOrderNumber: '',
  department: '',
  orderer: '',
  ordererPhone: '',
  pickupContactName: '',
  pickupContactPhone: '',
  dropoffContactName: '',
  dropoffContactPhone: '',
  notes: '',
}

const emptyAddress = (): AddressData => ({ address: '' })

function defaultTowDate(): string {
  return new Date().toISOString().split('T')[0]
}

function defaultTowTime(): string {
  return new Date().toTimeString().slice(0, 5)
}

type FieldErrorKey =
  | keyof FormState
  | 'scheduledAt'
  | 'defects'
  | 'plateNumber'
  | 'pickupAddress'
  | 'dropoffAddress'

const fieldLabels: Record<FieldErrorKey, string> = {
  customerOrderNumber: 'מספר הזמנת לקוח',
  scheduledAt: 'מועד ביצוע',
  department: 'מחלקה',
  orderer: 'מזמין',
  ordererPhone: 'טלפון מזמין',
  plateNumber: 'מספר רישוי',
  defects: 'תקלות',
  pickupAddress: 'כתובת מוצא',
  pickupContactName: 'שם איש קשר מוצא',
  pickupContactPhone: 'טלפון איש קשר מוצא',
  dropoffAddress: 'כתובת יעד',
  dropoffContactName: 'שם איש קשר יעד',
  dropoffContactPhone: 'טלפון איש קשר יעד',
  notes: 'הערות',
}

const requiredFields: (keyof FormState)[] = [
  'customerOrderNumber',
  'department',
  'orderer',
  'ordererPhone',
]

export default function NewCustomerTowRequestPage() {
  const {
    canSubmit,
    customerId,
    companyId,
    baseAddress,
    storedVehicles,
    storageLoading,
    userId,
  } = usePortalRequestBootstrap()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [towDate, setTowDate] = useState(defaultTowDate)
  const [towTime, setTowTime] = useState(defaultTowTime)
  const [useCustomTime, setUseCustomTime] = useState(false)
  const [plateNumber, setPlateNumber] = useState('')
  const [vehicleCode, setVehicleCode] = useState('')
  const [vehicleData, setVehicleData] = useState<VehicleLookupResult | null>(null)
  const [vehicleType, setVehicleType] = useState<VehicleType | ''>('')
  const [vehicleLookupNotFound, setVehicleLookupNotFound] = useState(false)
  const [manualManufacturer, setManualManufacturer] = useState('')
  const [manualColor, setManualColor] = useState('')
  const [selectedDefects, setSelectedDefects] = useState<string[]>([])
  const [isWorking, setIsWorking] = useState(false)
  const [pickupAddress, setPickupAddress] = useState<AddressData>(emptyAddress)
  const [dropoffAddress, setDropoffAddress] = useState<AddressData>(emptyAddress)
  const [pickupFromStorage, setPickupFromStorage] = useState(false)
  const [dropoffToStorage, setDropoffToStorage] = useState(false)
  const [selectedStoredVehicleId, setSelectedStoredVehicleId] = useState<string | null>(null)
  const [storageModalOpen, setStorageModalOpen] = useState(false)
  const [storageSearch, setStorageSearch] = useState('')
  const [pinDropModal, setPinDropModal] = useState<{
    isOpen: boolean
    field: 'pickup' | 'dropoff' | null
  }>({ isOpen: false, field: null })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldErrorKey, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!storageModalOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStorageModalOpen(false)
        setStorageSearch('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [storageModalOpen])

  const closeStorageModal = () => {
    setStorageModalOpen(false)
    setStorageSearch('')
  }

  const selectedStoredVehicle =
    storedVehicles.find((v) => v.id === selectedStoredVehicleId) ?? null
  const selectedStoredMakeModel = selectedStoredVehicle
    ? [selectedStoredVehicle.vehicle_data?.manufacturer, selectedStoredVehicle.vehicle_data?.model]
        .filter(Boolean)
        .join(' ')
    : ''

  const filteredStoredVehicles = (() => {
    const q = storageSearch.trim().toLowerCase()
    if (!q) return storedVehicles
    return storedVehicles.filter((vehicle) => {
      const plate = vehicle.plate_number.toLowerCase()
      const makeModel = [vehicle.vehicle_data?.manufacturer, vehicle.vehicle_data?.model]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return plate.includes(q) || makeModel.includes(q)
    })
  })()

  const clearFieldError = (key: FieldErrorKey) => {
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    clearFieldError(key)
  }

  const handleNowClick = () => {
    const now = new Date()
    setTowDate(now.toISOString().split('T')[0])
    setTowTime(now.toTimeString().slice(0, 5))
    clearFieldError('scheduledAt')
  }

  const handlePinDropConfirm = (data: AddressData) => {
    if (pinDropModal.field === 'pickup') {
      setPickupAddress(data)
      clearFieldError('pickupAddress')
    } else if (pinDropModal.field === 'dropoff') {
      setDropoffAddress(data)
      clearFieldError('dropoffAddress')
    }
    setPinDropModal({ isOpen: false, field: null })
  }

  const handlePickupFromStorageChange = (checked: boolean) => {
    setPickupFromStorage(checked)
    if (checked) {
      if (baseAddress?.address) {
        setPickupAddress({
          address: baseAddress.address,
          lat: baseAddress.lat ?? undefined,
          lng: baseAddress.lng ?? undefined,
        })
        clearFieldError('pickupAddress')
      }
      setForm((prev) => ({
        ...prev,
        pickupContactName: '',
        pickupContactPhone: '',
      }))
      clearFieldError('pickupContactName')
      clearFieldError('pickupContactPhone')
    } else {
      setPickupAddress(emptyAddress())
    }
  }

  const handleDropoffToStorageChange = (checked: boolean) => {
    setDropoffToStorage(checked)
    if (checked) {
      if (baseAddress?.address) {
        setDropoffAddress({
          address: baseAddress.address,
          lat: baseAddress.lat ?? undefined,
          lng: baseAddress.lng ?? undefined,
        })
        clearFieldError('dropoffAddress')
      }
      setForm((prev) => ({
        ...prev,
        dropoffContactName: '',
        dropoffContactPhone: '',
      }))
      clearFieldError('dropoffContactName')
      clearFieldError('dropoffContactPhone')
    } else {
      setDropoffAddress(emptyAddress())
    }
  }

  const clearStoredVehicleSelection = () => {
    setSelectedStoredVehicleId(null)
    setPlateNumber('')
    setVehicleCode('')
    setVehicleData(null)
    setVehicleType('')
    setVehicleLookupNotFound(false)
    setManualManufacturer('')
    setManualColor('')
    setSelectedDefects([])
    setIsWorking(false)
    clearFieldError('plateNumber')
    clearFieldError('defects')
    if (pickupFromStorage) {
      handlePickupFromStorageChange(false)
    }
  }

  const handleSelectStoredVehicle = (vehicle: CustomerPortalStoredVehicle) => {
    if (vehicle.current_status !== 'stored') return

    const { isFaulty, defects } = storedVehicleToCondition(vehicle)
    const lookup = buildLookupResultFromStored(vehicle)

    setSelectedStoredVehicleId(vehicle.id)
    setPlateNumber(vehicle.plate_number)
    setVehicleLookupNotFound(false)
    setManualManufacturer('')
    setManualColor('')
    if (lookup) {
      setVehicleData(lookup)
      setVehicleType((lookup.source as VehicleType) || 'private')
    } else {
      setVehicleData(null)
      setVehicleType('')
    }
    setIsWorking(!isFaulty)
    setSelectedDefects(isFaulty ? defects : [])
    clearFieldError('plateNumber')
    clearFieldError('defects')
    handlePickupFromStorageChange(true)
  }

  /** Non-storage address present → show contacts; empty or yard → hide. */
  const showPickupContacts =
    !pickupFromStorage && pickupAddress.address.trim().length > 0
  const showDropoffContacts =
    !dropoffToStorage && dropoffAddress.address.trim().length > 0

  const validate = (): boolean => {
    const errors: Partial<Record<FieldErrorKey, string>> = {}
    for (const key of requiredFields) {
      if (!form[key].trim()) {
        errors[key] = `${fieldLabels[key]} הוא שדה חובה`
      }
    }
    if (!towDate.trim() || !towTime.trim()) {
      errors.scheduledAt = `${fieldLabels.scheduledAt} הוא שדה חובה`
    }
    if (!isWorking && selectedDefects.length === 0) {
      errors.defects = 'יש לבחור לפחות תקלה אחת'
    }
    if (!plateNumber.trim()) {
      errors.plateNumber = `${fieldLabels.plateNumber} הוא שדה חובה`
    } else if (vehicleLookupNotFound && !vehicleType) {
      errors.plateNumber = 'יש לבחור סוג רכב בהזנה ידנית'
    }
    if (!pickupAddress.address.trim()) {
      errors.pickupAddress = `${fieldLabels.pickupAddress} הוא שדה חובה`
    }
    if (!dropoffAddress.address.trim()) {
      errors.dropoffAddress = `${fieldLabels.dropoffAddress} הוא שדה חובה`
    }
    if (showPickupContacts) {
      if (!form.pickupContactName.trim()) {
        errors.pickupContactName = `${fieldLabels.pickupContactName} הוא שדה חובה`
      }
      if (!form.pickupContactPhone.trim()) {
        errors.pickupContactPhone = `${fieldLabels.pickupContactPhone} הוא שדה חובה`
      }
    }
    if (showDropoffContacts) {
      if (!form.dropoffContactName.trim()) {
        errors.dropoffContactName = `${fieldLabels.dropoffContactName} הוא שדה חובה`
      }
      if (!form.dropoffContactPhone.trim()) {
        errors.dropoffContactPhone = `${fieldLabels.dropoffContactPhone} הוא שדה חובה`
      }
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const buildVehiclePayload = () => {
    const plate = plateNumber.trim()
    const base = {
      plateNumber: plate,
      towReason: selectedDefects.join(', ') || undefined,
      isWorking,
      orderIndex: 0,
    }

    if (vehicleData?.found && vehicleData.data) {
      const d = vehicleData.data
      const resolvedType = (vehicleType || vehicleData.source) as VehicleType | ''
      return {
        ...base,
        manufacturer: d.manufacturer,
        model: d.model,
        year: d.year,
        color: d.color,
        vehicleType: resolvedType || null,
      }
    }

    if (vehicleLookupNotFound) {
      return {
        ...base,
        manufacturer: manualManufacturer.trim() || null,
        color: manualColor.trim() || null,
        vehicleType: vehicleType ? (vehicleType as VehicleType) : null,
      }
    }

    return base
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
        towType: 'simple',
        customerOrderNumber: form.customerOrderNumber.trim(),
        scheduledAt: new Date(`${towDate}T${towTime}:00`).toISOString(),
        department: form.department.trim(),
        orderer: form.orderer.trim(),
        ordererPhone: form.ordererPhone.trim(),
        notes: form.notes.trim() || null,
        dropoffToStorage,
        vehicles: [buildVehiclePayload()],
        points: [
          {
            pointOrder: 0,
            pointType: 'pickup',
            address: pickupAddress.address.trim(),
            lat: pickupAddress.lat ?? null,
            lng: pickupAddress.lng ?? null,
            contactName: showPickupContacts ? form.pickupContactName.trim() : '',
            contactPhone: showPickupContacts ? form.pickupContactPhone.trim() : '',
            isStorage: pickupFromStorage,
          },
          {
            pointOrder: 1,
            pointType: 'dropoff',
            address: dropoffAddress.address.trim(),
            lat: dropoffAddress.lat ?? null,
            lng: dropoffAddress.lng ?? null,
            contactName: showDropoffContacts ? form.dropoffContactName.trim() : '',
            contactPhone: showDropoffContacts ? form.dropoffContactPhone.trim() : '',
            isStorage: dropoffToStorage,
          },
        ],
        pointVehicles: [
          { vehicleIndex: 0, pointIndex: 0, action: 'pickup' },
          { vehicleIndex: 0, pointIndex: 1, action: 'dropoff' },
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
        <h1 className="text-lg font-bold text-gt-text-primary mb-2">הזמנת גרירה</h1>
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
        <p className="text-gt-text-secondary mb-6">בקשת הגרירה נקלטה וממתינה לטיפול.</p>
        <Link
          href="/customer"
          className="inline-flex items-center justify-center px-5 py-2.5 bg-gt-brand text-white rounded-lg text-sm font-medium hover:bg-gt-brand-hover transition-colors"
        >
          חזרה לגרירות
        </Link>
      </div>
    )
  }

  return (
    <div className={PORTAL_PAGE_SHELL_CLASS} dir="rtl">
      <PortalRequestPageHeader>
        <h1 className={PORTAL_PAGE_TITLE_CLASS}>הזמנת גרירה</h1>
        <p className={PORTAL_PAGE_SUBTITLE_CLASS}>
          מילוי פרטי בקשת גרירה פשוטה (רכב אחד, מוצא ליעד)
        </p>
      </PortalRequestPageHeader>

      <form onSubmit={handleSubmit} className={PORTAL_FORM_STACK_CLASS}>
        {/*
          RTL 3-column row (right → left):
          1 פרטי הזמנה | 2 פרטי רכב | 3 מוצא ויעד
        */}
        <div
          className={`grid grid-cols-1 lg:grid-cols-12 ${PORTAL_GRID_GAP_CLASS} items-start`}
        >
          <div className="lg:col-span-4 min-w-0">
            <FormCard
              icon={ClipboardList}
              title="פרטי הזמנה"
              step={1}
              density="compact"
              className="mb-0"
            >
              <div className="grid grid-cols-1 gap-y-2">
                <FormField
                  required
                  error={fieldErrors.customerOrderNumber}
                >
                  <Input
                    type="text"
                    value={form.customerOrderNumber}
                    onChange={(e) => updateField('customerOrderNumber', e.target.value)}
                    placeholder={fieldLabels.customerOrderNumber}
                    hasError={!!fieldErrors.customerOrderNumber}
                  />
                </FormField>

                <FormField
                  label={fieldLabels.scheduledAt}
                  required
                  error={fieldErrors.scheduledAt}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className={PORTAL_SEGMENT_WRAP_CLASS}>
                      <button
                        type="button"
                        aria-pressed={!useCustomTime}
                        onClick={() => {
                          handleNowClick()
                          setUseCustomTime(false)
                        }}
                        className={
                          !useCustomTime
                            ? PORTAL_SEGMENT_ACTIVE_CLASS
                            : PORTAL_SEGMENT_INACTIVE_CLASS
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
                            ? PORTAL_SEGMENT_ACTIVE_CLASS
                            : PORTAL_SEGMENT_INACTIVE_CLASS
                        }
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
                    value={form.department}
                    onChange={(e) => updateField('department', e.target.value)}
                    placeholder={fieldLabels.department}
                    hasError={!!fieldErrors.department}
                  />
                </FormField>

                <FormField required error={fieldErrors.orderer}>
                  <Input
                    type="text"
                    value={form.orderer}
                    onChange={(e) => updateField('orderer', e.target.value)}
                    placeholder={fieldLabels.orderer}
                    hasError={!!fieldErrors.orderer}
                  />
                </FormField>

                <FormField required error={fieldErrors.ordererPhone}>
                  <PhoneInput
                    value={form.ordererPhone}
                    onChange={(phone) => updateField('ordererPhone', phone)}
                    placeholder={fieldLabels.ordererPhone}
                  />
                </FormField>

                <FormField optional>
                  <textarea
                    value={form.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                    rows={3}
                    placeholder="הערות — האם הרכב בחניון? חילוץ?"
                    className={PORTAL_TEXTAREA_CLASS}
                    aria-label={fieldLabels.notes}
                  />
                </FormField>
              </div>
            </FormCard>
          </div>

          <div className="lg:col-span-3 min-w-0">
            <FormCard
              icon={Truck}
              title="פרטי רכב"
              step={2}
              density="compact"
              className="mb-0"
            >
              <div className="space-y-2.5">
                {selectedStoredVehicle && (
                  <div className={PORTAL_STORAGE_BANNER_CLASS}>
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-medium text-gt-brand-text">נבחר מאחסנה</p>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium text-gt-text-primary">
                          {selectedStoredVehicle.plate_number}
                        </span>
                        {selectedStoredMakeModel && (
                          <span className="text-xs text-gt-text-tertiary">
                            {selectedStoredMakeModel}
                          </span>
                        )}
                        <span
                          className={
                            selectedStoredVehicle.vehicle_condition === 'faulty'
                              ? 'px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700'
                              : 'px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700'
                          }
                        >
                          {selectedStoredVehicle.vehicle_condition === 'faulty'
                            ? 'תקול'
                            : 'תקין'}
                        </span>
                      </div>
                      <TimeInStoragePill lastStoredAt={selectedStoredVehicle.last_stored_at} />
                    </div>
                    <button
                      type="button"
                      onClick={clearStoredVehicleSelection}
                      className="mt-1.5 text-xs text-gt-brand-text hover:text-gt-brand underline"
                    >
                      נקה בחירה והזן ידנית
                    </button>
                  </div>
                )}

                <SelectorModalShell
                  open={storageModalOpen}
                  onClose={closeStorageModal}
                  title="בחר רכב מאחסנה"
                  panelClassName="max-w-lg"
                >
                  <div className="space-y-3 p-4" dir="rtl">
                    <input
                      type="search"
                      value={storageSearch}
                      onChange={(e) => setStorageSearch(e.target.value)}
                      placeholder="חיפוש לפי מספר רכב או דגם"
                      className="w-full rounded-lg border border-gt-border-field bg-white px-3 py-2.5 text-sm text-gt-text-primary placeholder:text-gt-text-tertiary hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20"
                      autoFocus
                    />
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                      {filteredStoredVehicles.length === 0 ? (
                        <p className="py-6 text-center text-sm text-gt-text-tertiary">
                          לא נמצאו רכבים תואמים
                        </p>
                      ) : (
                        filteredStoredVehicles.map((vehicle) => {
                          const isReserved = vehicle.current_status === 'reserved_for_tow'
                          const isFaulty = vehicle.vehicle_condition === 'faulty'
                          const makeModel = [
                            vehicle.vehicle_data?.manufacturer,
                            vehicle.vehicle_data?.model,
                          ]
                            .filter(Boolean)
                            .join(' ')

                          return (
                            <button
                              key={vehicle.id}
                              type="button"
                              disabled={isReserved}
                              onClick={() => {
                                handleSelectStoredVehicle(vehicle)
                                closeStorageModal()
                              }}
                              className={
                                isReserved
                                  ? 'flex w-full flex-col items-start gap-1 rounded-xl bg-gt-surface-subtle/80 px-3 py-2.5 text-right text-sm text-gt-text-tertiary cursor-not-allowed opacity-70'
                                  : 'flex w-full flex-col items-start gap-1 rounded-xl bg-white px-3 py-2.5 text-right text-sm transition-colors hover:bg-gt-surface-hover shadow-[var(--gt-shadow-xs)]'
                              }
                            >
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-gt-text-primary">
                                  {vehicle.plate_number}
                                </span>
                                {makeModel && (
                                  <span className="text-xs text-gt-text-tertiary">
                                    {makeModel}
                                  </span>
                                )}
                                <span
                                  className={
                                    isFaulty
                                      ? 'px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700'
                                      : 'px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700'
                                  }
                                >
                                  {isFaulty ? 'תקול' : 'תקין'}
                                </span>
                              </span>
                              <TimeInStoragePill lastStoredAt={vehicle.last_stored_at} />
                              {isReserved && (
                                <span className="text-xs text-amber-700">ממתין לגרירה</span>
                              )}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                </SelectorModalShell>

                <FormField required error={fieldErrors.plateNumber}>
                  <VehicleLookup
                    narrowColumn
                    hideLabel
                    showVehicleCode
                    vehicleCode={vehicleCode}
                    onVehicleCodeChange={setVehicleCode}
                    manualEntryStyle="button"
                    manualEntryPlacement="withPlate"
                    manualEntryTrailing={
                      !storageLoading && storedVehicles.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setStorageModalOpen(true)}
                          title="בחר רכב מאחסנה"
                          className={PORTAL_STORAGE_BUTTON_CLASS}
                        >
                          <Package size={13} className="shrink-0" strokeWidth={1.75} />
                          מאחסנה
                        </button>
                      ) : null
                    }
                    manualEntryEnd={
                      <PortalDefectSelector
                        triggerLabel="בחר תקלות"
                        label="תקלות"
                        triggerClassName={PORTAL_DEFECTS_TRIGGER_CLASS}
                        selectedDefects={selectedDefects}
                        onChange={(d) => {
                          setSelectedDefects(d)
                          if (d.length > 0) {
                            setIsWorking(false)
                          } else if (
                            selectedStoredVehicleId &&
                            storedVehicles.find((v) => v.id === selectedStoredVehicleId)
                              ?.vehicle_condition === 'operational'
                          ) {
                            setIsWorking(true)
                          }
                          clearFieldError('defects')
                        }}
                      />
                    }
                    plateNumber={plateNumber}
                    onPlateChange={(plate) => {
                      setPlateNumber(plate)
                      clearFieldError('plateNumber')
                      if (selectedStoredVehicleId) {
                        const selected = storedVehicles.find(
                          (v) => v.id === selectedStoredVehicleId
                        )
                        if (!selected || selected.plate_number !== plate) {
                          setSelectedStoredVehicleId(null)
                          if (pickupFromStorage) {
                            handlePickupFromStorageChange(false)
                          }
                          setIsWorking(false)
                        }
                      }
                    }}
                    vehicleData={vehicleData}
                    onVehicleDataChange={setVehicleData}
                    vehicleType={vehicleType}
                    onVehicleTypeChange={setVehicleType}
                    vehicleLookupNotFound={vehicleLookupNotFound}
                    onVehicleLookupNotFoundChange={setVehicleLookupNotFound}
                    manualManufacturer={manualManufacturer}
                    onManualManufacturerChange={setManualManufacturer}
                    manualColor={manualColor}
                    onManualColorChange={setManualColor}
                  />
                </FormField>
                {fieldErrors.defects && (
                  <p className="text-[11px] text-gt-danger">{fieldErrors.defects}</p>
                )}
              </div>
            </FormCard>
          </div>

          <div className="lg:col-span-5 min-w-0">
            <FormCard
              icon={MapPin}
              title="מוצא ויעד"
              step={3}
              density="compact"
              className="mb-0"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 min-w-0">
                  <h4 className={PORTAL_SECTION_LABEL_CLASS}>מוצא</h4>
                  <FormField
                    required
                    error={fieldErrors.pickupAddress}
                    className="w-full min-w-0"
                  >
                    <AddressInput
                      hideLabel
                      className="w-full"
                      value={pickupAddress}
                      onChange={(data: AddressData) => {
                        setPickupAddress(data)
                        clearFieldError('pickupAddress')
                        if (!data.address.trim()) {
                          setForm((prev) => ({
                            ...prev,
                            pickupContactName: '',
                            pickupContactPhone: '',
                          }))
                          clearFieldError('pickupContactName')
                          clearFieldError('pickupContactPhone')
                          if (pickupFromStorage) {
                            handlePickupFromStorageChange(false)
                          }
                        }
                      }}
                      placeholder="כתובת מוצא"
                      required
                      narrowColumn
                      onPinDropClick={() => setPinDropModal({ isOpen: true, field: 'pickup' })}
                    />
                  </FormField>
                  {showPickupContacts && (
                    <div className="space-y-1.5">
                      <FormField
                        required
                        error={fieldErrors.pickupContactName}
                      >
                        <Input
                          type="text"
                          value={form.pickupContactName}
                          onChange={(e) => updateField('pickupContactName', e.target.value)}
                          placeholder="שם איש קשר"
                          hasError={!!fieldErrors.pickupContactName}
                        />
                      </FormField>
                      <FormField
                        required
                        error={fieldErrors.pickupContactPhone}
                      >
                        <PhoneInput
                          value={form.pickupContactPhone}
                          onChange={(phone) => updateField('pickupContactPhone', phone)}
                          placeholder="טלפון"
                        />
                      </FormField>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 min-w-0">
                  <h4 className={PORTAL_SECTION_LABEL_CLASS}>יעד</h4>
                  <FormField
                    required
                    error={fieldErrors.dropoffAddress}
                    className="w-full min-w-0"
                  >
                    <AddressInput
                      hideLabel
                      className="w-full"
                      value={dropoffAddress}
                      onChange={(data: AddressData) => {
                        setDropoffAddress(data)
                        clearFieldError('dropoffAddress')
                        if (!data.address.trim()) {
                          setForm((prev) => ({
                            ...prev,
                            dropoffContactName: '',
                            dropoffContactPhone: '',
                          }))
                          clearFieldError('dropoffContactName')
                          clearFieldError('dropoffContactPhone')
                          if (dropoffToStorage) {
                            handleDropoffToStorageChange(false)
                          }
                        }
                      }}
                      placeholder="כתובת יעד"
                      required
                      narrowColumn
                      onPinDropClick={() => setPinDropModal({ isOpen: true, field: 'dropoff' })}
                    />
                  </FormField>
                  {showDropoffContacts && (
                    <div className="space-y-1.5">
                      <FormField
                        required
                        error={fieldErrors.dropoffContactName}
                      >
                        <Input
                          type="text"
                          value={form.dropoffContactName}
                          onChange={(e) => updateField('dropoffContactName', e.target.value)}
                          placeholder="שם איש קשר"
                          hasError={!!fieldErrors.dropoffContactName}
                        />
                      </FormField>
                      <FormField
                        required
                        error={fieldErrors.dropoffContactPhone}
                      >
                        <PhoneInput
                          value={form.dropoffContactPhone}
                          onChange={(phone) => updateField('dropoffContactPhone', phone)}
                          placeholder="טלפון"
                        />
                      </FormField>
                    </div>
                  )}
                </div>
              </div>
            </FormCard>
          </div>
        </div>

        {submitError && (
          <div className={PORTAL_ERROR_BANNER_CLASS}>
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" strokeWidth={1.75} />
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
              שליחת בקשה
            </Button>
          </div>
        </div>
      </form>

      <PinDropModal
        isOpen={pinDropModal.isOpen}
        onClose={() => setPinDropModal({ isOpen: false, field: null })}
        onConfirm={handlePinDropConfirm}
        initialAddress={
          pinDropModal.field === 'pickup'
            ? pickupAddress
            : pinDropModal.field === 'dropoff'
              ? dropoffAddress
              : undefined
        }
        title={
          pinDropModal.field === 'pickup'
            ? 'בחר מיקום מוצא'
            : pinDropModal.field === 'dropoff'
              ? 'בחר מיקום יעד'
              : 'בחר מיקום'
        }
      />
    </div>
  )
}

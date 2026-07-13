'use client'

import { useState, type ReactNode } from 'react'
import { Search, Loader2, AlertTriangle, PenLine, Check } from 'lucide-react'
import { lookupVehicle, getVehicleTypeIcon } from '../../../lib/vehicle-lookup'
import { VehicleType, VehicleLookupResult } from '../../../lib/types'
import { normalizePlate } from '../../../lib/utils/plate-number'
import { shouldTriggerPlateLookupOnBlur } from '../../../lib/utils/plate-lookup-blur'
import { SelectorModalShell } from './SelectorModalShell'
import { vehicleActionTriggerClass } from './VehicleCardActions'

interface VehicleLookupProps {
  plateNumber: string
  onPlateChange: (plate: string) => void
  vehicleData: VehicleLookupResult | null
  onVehicleDataChange: (data: VehicleLookupResult | null) => void
  vehicleType: VehicleType | ''
  onVehicleTypeChange: (type: VehicleType | '') => void
  showVehicleCode?: boolean
  vehicleCode?: string
  onVehicleCodeChange?: (code: string) => void
  disabled?: boolean
  isMobile?: boolean
  /** Stacked plate/type layout for narrow desktop columns. */
  narrowColumn?: boolean
  /** Hide the built-in "מספר רכב" label (use when an outer section already names the field). */
  hideLabel?: boolean
  /** Manual-entry link style in stacked layout: subtle link vs bordered button. */
  manualEntryStyle?: 'link' | 'button'
  /** Where to render the manual-entry trigger in stacked layout. */
  manualEntryPlacement?: 'inline' | 'afterSummary' | 'withPlate'
  /** Optional sibling action(s) rendered next to the manual-entry trigger (e.g. storage picker). */
  manualEntryTrailing?: ReactNode
  /** Optional action(s) after the manual-entry control on the plate row (e.g. defects). */
  manualEntryEnd?: ReactNode
  /**
   * Manual entry (shared state, controlled by parent form). When
   * `onVehicleLookupNotFoundChange` is provided the component switches to
   * controlled "manual entry" mode (skip button + modal).
   * When omitted it falls back to legacy local not-found behavior.
   */
  vehicleLookupNotFound?: boolean
  onVehicleLookupNotFoundChange?: (val: boolean) => void
  manualManufacturer?: string
  onManualManufacturerChange?: (val: string) => void
  manualColor?: string
  onManualColorChange?: (val: string) => void
  manualWeight?: string
  onManualWeightChange?: (val: string) => void
  manualChassis?: string
  onManualChassisChange?: (val: string) => void
}

export function VehicleLookup({
  plateNumber,
  onPlateChange,
  vehicleData,
  onVehicleDataChange,
  vehicleType,
  onVehicleTypeChange,
  showVehicleCode = true,
  vehicleCode = '',
  onVehicleCodeChange,
  disabled = false,
  isMobile = false,
  narrowColumn = false,
  hideLabel = false,
  manualEntryStyle = 'link',
  manualEntryPlacement = 'inline',
  manualEntryTrailing,
  manualEntryEnd,
  vehicleLookupNotFound,
  onVehicleLookupNotFoundChange,
  manualManufacturer = '',
  onManualManufacturerChange,
  manualColor = '',
  onManualColorChange,
  manualWeight = '',
  onManualWeightChange,
  manualChassis = '',
  onManualChassisChange,
}: VehicleLookupProps) {
  const isNarrow = narrowColumn ?? false
  const isMobileSized = isMobile ?? false
  const stackLayout = isMobileSized || isNarrow
  const actionsWithPlate = isNarrow && manualEntryPlacement === 'withPlate'
  const [loading, setLoading] = useState(false)
  const [localNotFound, setLocalNotFound] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)

  // Controlled manual-entry mode only when the parent wires the shared state.
  const manualEnabled = typeof onVehicleLookupNotFoundChange === 'function'
  const notFound = manualEnabled ? !!vehicleLookupNotFound : localNotFound
  const setNotFound = (val: boolean) => {
    if (manualEnabled) onVehicleLookupNotFoundChange!(val)
    else setLocalNotFound(val)
  }

  const handleLookup = async () => {
    if (plateNumber.length < 5) return
    
    setLoading(true)
    setNotFound(false)
    onVehicleDataChange(null)
    
    try {
      const result = await lookupVehicle(plateNumber)
      
      if (result.found && result.data) {
        onVehicleDataChange(result)
        onVehicleTypeChange(result.source || 'private')
        setNotFound(false)
        const cachedCode = result.vehicleCode?.trim()
        if (
          cachedCode &&
          onVehicleCodeChange &&
          !(vehicleCode ?? '').trim()
        ) {
          onVehicleCodeChange(cachedCode)
        }
      } else {
        setNotFound(true)
        onVehicleDataChange(null)
        onVehicleTypeChange('')
        if (manualEnabled) setShowManualModal(true)
      }
    } catch (error) {
      console.error('Error looking up vehicle:', error)
      setNotFound(true)
      if (manualEnabled) setShowManualModal(true)
    } finally {
      setLoading(false)
    }
  }

  // "Skip to manual" — open modal; only reset fields when entering manual mode fresh
  const openManualEntry = () => {
    if (!notFound) {
      onVehicleDataChange(null)
      setNotFound(true)
      onVehicleTypeChange('')
      onManualManufacturerChange?.('')
      onManualColorChange?.('')
      onManualWeightChange?.('')
      onManualChassisChange?.('')
    }
    setShowManualModal(true)
  }

  const manualInputClass = isNarrow
    ? 'w-full px-3 h-9 border border-gt-border-field rounded-lg text-sm hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20'
    : isMobileSized
      ? 'w-full px-3 h-12 border border-gt-border-field rounded-lg text-sm hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20'
      : 'w-full px-3 py-2 border border-gt-border-field rounded-lg text-sm hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20'

  const manualSelectClass = isNarrow
    ? 'w-full px-3 h-9 border border-gt-border-field rounded-lg text-sm bg-white hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20'
    : isMobileSized
      ? 'w-full px-3 h-12 border border-gt-border-field rounded-lg text-sm bg-white hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20'
      : 'w-full px-3 py-2 border border-gt-border-field rounded-lg text-sm bg-white hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20'

  const renderManualEntryTrigger = (opts?: { compact?: boolean }) => {
    if (!manualEnabled || vehicleData?.found) return null
    const manualFilled =
      notFound &&
      (!!vehicleType ||
        !!manualManufacturer.trim() ||
        !!manualColor.trim() ||
        !!manualWeight.trim() ||
        !!manualChassis.trim())
    if (opts?.compact) {
      return (
        <button
          type="button"
          onClick={openManualEntry}
          disabled={disabled}
          title="פרטי רכב ידנית"
          aria-label="פרטי רכב ידנית"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gt-border-field text-gt-text-secondary transition-colors hover:border-gt-border hover:bg-gt-surface-hover hover:text-gt-text-primary disabled:opacity-50"
        >
          {manualFilled ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-gt-brand" />
          ) : (
            <PenLine className="h-3.5 w-3.5 shrink-0" />
          )}
        </button>
      )
    }
    return (
      <button
        type="button"
        onClick={openManualEntry}
        disabled={disabled}
        className={vehicleActionTriggerClass(manualFilled || notFound)}
      >
        {manualFilled || notFound ? (
          <Check className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <PenLine className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <span className="truncate">פרטי רכב ידנית</span>
      </button>
    )
  }

  const renderManualEntryRow = () => {
    const trigger = renderManualEntryTrigger()
    if (!trigger && !manualEntryTrailing && !manualEntryEnd) return null
    const cells = [manualEntryTrailing, manualEntryEnd, trigger].filter(Boolean)
    if (cells.length >= 2) {
      return (
        <div
          className={`grid w-full gap-2 ${
            cells.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'
          }`}
          dir="rtl"
          role="group"
          aria-label="פעולות רכב"
        >
          {cells}
        </div>
      )
    }
    return <div className="w-full">{cells[0]}</div>
  }

  const manualFieldLabelClass = (narrowManual = false) =>
    `block mb-1 ${
      isNarrow || narrowManual
        ? 'text-xs text-gray-500 font-medium'
        : 'text-xs text-gray-600'
    }`

  const handleManualPlateChange = (raw: string) => {
    // Stay in manual mode — do not clear notFound (outer plate onChange does that).
    onPlateChange(normalizePlate(raw))
  }

  const renderManualFields = (options?: { narrowManualLayout?: boolean }) => {
    const narrowManual = options?.narrowManualLayout ?? false

    if (narrowManual) {
      return (
        <div className="space-y-2">
          <div>
            <label className={manualFieldLabelClass(true)}>מספר רישוי *</label>
            <input
              type="text"
              value={plateNumber}
              onChange={(e) => handleManualPlateChange(e.target.value)}
              placeholder="מספר רישוי"
              disabled={disabled}
              className={`${manualInputClass} font-semibold font-mono`}
            />
          </div>
          <div>
            <label className={manualFieldLabelClass(true)}>סוג רכב *</label>
            <select
              value={vehicleType}
              onChange={(e) => onVehicleTypeChange(e.target.value as VehicleType | '')}
              className={manualSelectClass}
            >
              <option value="">בחר סוג רכב</option>
              <option value="private">פרטי</option>
              <option value="suv">ג&apos;יפ / SUV</option>
              <option value="truck">משאית</option>
              <option value="heavy">צמ&quot;ה</option>
              <option value="motorcycle">אופנוע</option>
              <option value="bus">אוטובוס / מיניבוס</option>
              <option value="van">רכב מסחרי</option>
              <option value="other">אחר</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label className={manualFieldLabelClass(true)}>יצרן</label>
              <input
                type="text"
                value={manualManufacturer}
                onChange={(e) => onManualManufacturerChange?.(e.target.value)}
                placeholder="למשל: טויוטה"
                className={manualInputClass}
              />
            </div>
            <div className="min-w-0">
              <label className={manualFieldLabelClass(true)}>צבע</label>
              <input
                type="text"
                value={manualColor}
                onChange={(e) => onManualColorChange?.(e.target.value)}
                placeholder="למשל: לבן"
                className={manualInputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label className={manualFieldLabelClass(true)}>מספר שלדה</label>
              <input
                type="text"
                value={manualChassis}
                onChange={(e) => onManualChassisChange?.(e.target.value)}
                placeholder="אופציונלי"
                className={`${manualInputClass} font-mono`}
              />
            </div>
            <div className="min-w-0">
              <label className={manualFieldLabelClass(true)}>
                {(vehicleType as string) === 'van' ? 'משקל (ק״ג) *' : 'משקל (ק"ג)'}
              </label>
              <input
                type="number"
                value={manualWeight}
                onChange={(e) => onManualWeightChange?.(e.target.value)}
                placeholder={(vehicleType as string) === 'van' ? 'חובה לרכב מסחרי' : 'אופציונלי'}
                className={manualInputClass}
              />
              {(vehicleType as string) === 'van' && (!manualWeight || Number(manualWeight) === 0) && (
                <p className="text-xs text-red-500 mt-1">יש להזין משקל כדי לחשב מחיר לרכב מסחרי</p>
              )}
            </div>
          </div>
        </div>
      )
    }

    return (
    <div className={stackLayout ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
      <div className={stackLayout ? undefined : 'sm:col-span-2'}>
        <label className={manualFieldLabelClass()}>מספר רישוי *</label>
        <input
          type="text"
          value={plateNumber}
          onChange={(e) => handleManualPlateChange(e.target.value)}
          placeholder="מספר רישוי"
          disabled={disabled}
          className={`${manualInputClass} font-semibold font-mono`}
        />
      </div>
      <div>
        <label className={manualFieldLabelClass()}>סוג רכב *</label>
        <select
          value={vehicleType}
          onChange={(e) => onVehicleTypeChange(e.target.value as VehicleType | '')}
          className={manualSelectClass}
        >
          <option value="">בחר סוג רכב</option>
          <option value="private">פרטי</option>
          <option value="suv">ג&apos;יפ / SUV</option>
          <option value="truck">משאית</option>
          <option value="heavy">צמ&quot;ה</option>
          <option value="motorcycle">אופנוע</option>
          <option value="bus">אוטובוס / מיניבוס</option>
          <option value="van">רכב מסחרי</option>
          <option value="other">אחר</option>
        </select>
      </div>
      <div>
        <label className={manualFieldLabelClass()}>יצרן</label>
        <input
          type="text"
          value={manualManufacturer}
          onChange={(e) => onManualManufacturerChange?.(e.target.value)}
          placeholder="למשל: טויוטה"
          className={manualInputClass}
        />
      </div>
      <div>
        <label className={manualFieldLabelClass()}>צבע</label>
        <input
          type="text"
          value={manualColor}
          onChange={(e) => onManualColorChange?.(e.target.value)}
          placeholder="למשל: לבן"
          className={manualInputClass}
        />
      </div>
      <div>
        <label className={manualFieldLabelClass()}>מספר שלדה</label>
        <input
          type="text"
          value={manualChassis}
          onChange={(e) => onManualChassisChange?.(e.target.value)}
          placeholder="אופציונלי"
          className={`${manualInputClass} font-mono`}
        />
      </div>
      <div>
        <label className={manualFieldLabelClass()}>
          {(vehicleType as string) === 'van' ? 'משקל (ק״ג) *' : 'משקל (ק"ג)'}
        </label>
        <input
          type="number"
          value={manualWeight}
          onChange={(e) => onManualWeightChange?.(e.target.value)}
          placeholder={(vehicleType as string) === 'van' ? 'חובה לרכב מסחרי' : 'אופציונלי'}
          className={manualInputClass}
        />
        {(vehicleType as string) === 'van' && (!manualWeight || Number(manualWeight) === 0) && (
          <p className="text-sm text-red-500 mt-1">יש להזין משקל כדי לחשב מחיר לרכב מסחרי</p>
        )}
      </div>
    </div>
    )
  }

  return (
    <div className="space-y-2">
      {stackLayout ? (
        <>
          {/* שורה 1: מספר רכב — השדה הראשי (בולט), עם תווית ואייקון חיפוש שקט בקצה */}
          <div>
            {!hideLabel && (
              <label className={`block mb-1 ${isNarrow ? 'text-xs font-medium text-gt-text-secondary' : 'text-sm font-semibold text-gray-700'}`}>מספר רכב</label>
            )}
            {/* narrow-column: plate + code on one row; type is hidden when found
                and provided by the manual panel when not found.
                withPlate: storage/manual actions stay on the SAME row. */}
            <div
              className={
                isNarrow
                  ? actionsWithPlate
                    ? 'flex flex-wrap items-center gap-3 min-w-0'
                    : 'flex flex-wrap items-center gap-2'
                  : 'relative'
              }
            >
              <div
                className={
                  isNarrow
                    ? actionsWithPlate
                      ? 'relative w-[6.75rem] shrink-0'
                      : 'relative flex-1 min-w-0'
                    : 'relative'
                }
              >
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => {
                    const newValue = normalizePlate(e.target.value)
                    onPlateChange(newValue)
                    setNotFound(false)
                    if (newValue.replace(/[^0-9]/g, '').length < 5) {
                      onVehicleDataChange(null)
                      onVehicleTypeChange('')
                    }
                  }}
                  placeholder="מספר רכב"
                  aria-label={hideLabel ? 'מספר רכב' : undefined}
                  disabled={disabled}
                  className={
                    isNarrow
                      ? 'w-full pl-9 pr-2 h-9 bg-white border border-gt-border-field rounded-lg text-sm font-semibold text-gray-900 placeholder:font-normal hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20 disabled:bg-gray-100'
                      : 'w-full pl-14 pr-3 h-12 bg-white border border-gt-border-field rounded-lg text-lg font-semibold text-gray-900 placeholder:font-normal hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20 disabled:bg-gray-100'
                  }
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  onBlur={() => {
                    if (
                      shouldTriggerPlateLookupOnBlur(plateNumber, {
                        hasFoundData: vehicleData?.found,
                        lookupAlreadyFailed: notFound,
                      })
                    ) {
                      void handleLookup()
                    }
                  }}
                />

                {/* כפתור חיפוש - אייקון שקט (ghost) בתוך השדה */}
                <button
                  type="button"
                  onClick={handleLookup}
                  disabled={loading || plateNumber.length < 5 || disabled}
                  aria-label="חפש רכב"
                  className={
                    isNarrow
                      ? 'absolute left-0 top-0 h-9 w-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200/70 hover:text-gray-700 transition-colors disabled:opacity-40'
                      : 'absolute left-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200/70 hover:text-gray-700 transition-colors disabled:opacity-40'
                  }
                >
                  {loading ? (
                    <Loader2 size={isNarrow ? 14 : 18} className="animate-spin" />
                  ) : (
                    <Search size={isNarrow ? 14 : 18} />
                  )}
                </button>
              </div>

              {isNarrow && showVehicleCode && onVehicleCodeChange && (
                <input
                  type="text"
                  value={vehicleCode}
                  onChange={(e) => onVehicleCodeChange(e.target.value)}
                  placeholder="קוד"
                  disabled={disabled}
                  className={
                    actionsWithPlate
                      ? 'w-14 shrink-0 px-1.5 h-9 border border-gt-border-field rounded-lg text-sm hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20 disabled:bg-gray-100'
                      : 'w-20 shrink-0 px-2 h-9 border border-gt-border-field rounded-lg text-sm hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20 disabled:bg-gray-100'
                  }
                />
              )}

              {actionsWithPlate && manualEntryTrailing}
              {actionsWithPlate && renderManualEntryTrigger({ compact: true })}
              {actionsWithPlate && manualEntryEnd}
            </div>
          </div>

          {/* שורה 2: סוג + קוד — שדות משניים (מובייל בלבד; ב-narrow column קוד עלה לשורת הרכב והסוג מוסתר עד מצב ידני) */}
          {!isNarrow && (
            <div className="flex gap-2">
              <select
                value={vehicleType}
                onChange={(e) => onVehicleTypeChange(e.target.value as VehicleType | '')}
                disabled={vehicleData?.found || disabled}
                className={`flex-[2] min-w-0 px-2 h-12 border rounded-lg text-sm focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20 bg-white ${
                  vehicleData?.found ? 'border-emerald-300 bg-emerald-50' : 'border-gt-border-field hover:border-gt-border'
                } disabled:bg-gray-100`}
              >
                <option value="">סוג</option>
                <option value="private">🚗 פרטי</option>
                <option value="motorcycle">🏍️ דו גלגלי</option>
                <option value="heavy">🚚 כבד</option>
                <option value="machinery">🚜 צמ״ה</option>
              </select>

              {showVehicleCode && onVehicleCodeChange && (
                <input
                  type="text"
                  value={vehicleCode}
                  onChange={(e) => onVehicleCodeChange(e.target.value)}
                  placeholder="קוד"
                  disabled={disabled}
                  className="flex-1 min-w-0 px-2 h-12 border border-gt-border-field rounded-lg text-sm hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20 disabled:bg-gray-100"
                />
              )}
            </div>
          )}

          {manualEntryPlacement === 'inline' && !actionsWithPlate && renderManualEntryRow()}
        </>
      ) : (
      <>
      {/* שורה ראשית: מספר רכב + חפש + סוג + קוד */}
      <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-2">
        {/* מספר רכב */}
        <input
          type="text"
          value={plateNumber}
          onChange={(e) => {
            const newValue = normalizePlate(e.target.value)
            onPlateChange(newValue)
            setNotFound(false)
            if (newValue.replace(/[^0-9]/g, '').length < 5) {
              onVehicleDataChange(null)
              onVehicleTypeChange('')
            }
          }}
          placeholder="מספר רכב"
          aria-label={hideLabel ? 'מספר רכב' : undefined}
          disabled={disabled}
          className={
            isMobile
              ? 'col-span-3 sm:flex-1 sm:min-w-0 px-3 h-12 border border-gt-border-field rounded-lg text-sm hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20 font-mono disabled:bg-gray-100'
              : 'col-span-3 sm:flex-1 sm:min-w-0 px-3 py-2 border border-gt-border-field rounded-lg text-sm hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20 font-mono disabled:bg-gray-100'
          }
          onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          onBlur={() => {
            if (
              shouldTriggerPlateLookupOnBlur(plateNumber, {
                hasFoundData: vehicleData?.found,
                lookupAlreadyFailed: notFound,
              })
            ) {
              void handleLookup()
            }
          }}
        />

        {/* כפתור חיפוש */}
        <button
          onClick={handleLookup}
          disabled={loading || plateNumber.length < 5 || disabled}
          className={
            isMobile
              ? 'col-span-1 px-3 min-h-[48px] min-w-[48px] bg-[#33d4ff] text-white rounded-lg text-sm font-medium hover:bg-[#21b8e6] transition-colors disabled:opacity-50 flex items-center justify-center'
              : 'col-span-1 px-3 py-2 bg-[#33d4ff] text-white rounded-lg text-sm font-medium hover:bg-[#21b8e6] transition-colors disabled:opacity-50 flex items-center justify-center'
          }
          >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </button>

        {/* סוג רכב */}
        <select
          value={vehicleType}
          onChange={(e) => onVehicleTypeChange(e.target.value as VehicleType | '')}
          disabled={vehicleData?.found || disabled}
          className={
            isMobile
              ? `col-span-2 sm:col-span-1 sm:min-w-[80px] px-2 h-12 border rounded-lg text-sm focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20 bg-white ${
                  vehicleData?.found ? 'border-emerald-300 bg-emerald-50' : 'border-gt-border-field hover:border-gt-border'
                } disabled:bg-gray-100`
              : `col-span-2 sm:col-span-1 sm:min-w-[80px] px-2 py-2 border rounded-lg text-sm focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20 bg-white ${
                  vehicleData?.found ? 'border-emerald-300 bg-emerald-50' : 'border-gt-border-field hover:border-gt-border'
                } disabled:bg-gray-100`
          }
        >
          <option value="">סוג</option>
          <option value="private">🚗 פרטי</option>
          <option value="motorcycle">🏍️ דו גלגלי</option>
          <option value="heavy">🚚 כבד</option>
          <option value="machinery">🚜 צמ״ה</option>
        </select>

        {/* קוד רכב */}
        {showVehicleCode && onVehicleCodeChange && (
          <input
            type="text"
            value={vehicleCode}
            onChange={(e) => onVehicleCodeChange(e.target.value)}
            placeholder="קוד"
            disabled={disabled}
            className={
              isMobile
                ? 'col-span-2 sm:col-span-1 sm:w-16 px-2 h-12 border border-gt-border-field rounded-lg text-sm hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20 disabled:bg-gray-100'
                : 'col-span-2 sm:col-span-1 sm:w-16 px-2 py-2 border border-gt-border-field rounded-lg text-sm hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20 disabled:bg-gray-100'
            }
            />
        )}
      </div>

      {/* דילוג להזנה ידנית - מוצג לפני/ללא חיפוש (רק במצב הזנה ידנית מבוקרת) */}
      {manualEnabled && !notFound && !vehicleData?.found && (
        <button
          type="button"
          onClick={openManualEntry}
          disabled={disabled}
          className={
            isMobile
              ? 'inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-gt-brand text-gt-brand text-sm font-medium hover:bg-gt-brand-subtle transition-colors disabled:opacity-50'
              : 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gt-brand text-gt-brand text-xs font-medium hover:bg-gt-brand-subtle transition-colors disabled:opacity-50'
          }
        >
          <PenLine className="w-3.5 h-3.5" />
          הזן פרטי רכב ידנית
        </button>
      )}
      </>
      )}

      {/* פרטי רכב - קומפקטי */}
      {vehicleData?.found && vehicleData.data && (
        <div className="px-3 py-2 bg-emerald-50/80 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <span>{getVehicleTypeIcon(vehicleData.source || 'private')}</span>
            <span className="font-medium text-gray-800">
              {vehicleData.data.manufacturer} {vehicleData.data.model}
            </span>
            {vehicleData.data.year && <span className="text-gray-600">{vehicleData.data.year}</span>}
            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">
              {vehicleData.sourceLabel}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-1">
            {vehicleData.data.color && <span>צבע: {vehicleData.data.color}</span>}
            {vehicleData.data.gearType && <span>גיר: {vehicleData.data.gearType}</span>}
            {vehicleData.data.driveType && <span>הנעה: {vehicleData.data.driveType}</span>}
            {vehicleData.data.driveTechnology && <span>טכנולוגיה: {vehicleData.data.driveTechnology}</span>}
            {vehicleData.data.totalWeight && <span>משקל: {vehicleData.data.totalWeight.toLocaleString()} ק״ג</span>}
            {/* משקל עצמי — רכב כבד (mishkal_azmi בק"ג; 0 לא מוצג) */}
            {vehicleData.source === 'heavy' && vehicleData.data.curbWeightKg != null && vehicleData.data.curbWeightKg > 0 && (
              <span>משקל עצמי: {vehicleData.data.curbWeightKg.toLocaleString()} ק״ג</span>
            )}
            {/* שדות לדו גלגלי */}
            {vehicleData.source === 'motorcycle' && vehicleData.data.vehicleType && (
              <span>סוג: {vehicleData.data.vehicleType}</span>
            )}
            {/* שדות לצמ"ה */}
            {vehicleData.source === 'machinery' && (
              <>
                {vehicleData.data.machineryType && <span>סוג צמ״ה: {vehicleData.data.machineryType}</span>}
                {vehicleData.data.selfWeight && <span>משקל עצמי: {vehicleData.data.selfWeight} טון</span>}
                {vehicleData.data.totalWeightTon && <span>משקל כולל: {vehicleData.data.totalWeightTon} טון</span>}
              </>
            )}
          </div>
        </div>
      )}

      {manualEntryPlacement === 'afterSummary' && !actionsWithPlate && renderManualEntryRow()}
      {manualEntryPlacement === 'withPlate' && !isNarrow && renderManualEntryRow()}

      {/* רכב לא נמצא / מצב הזנה ידנית */}
      {notFound && !vehicleData?.found && (
        !manualEnabled ? (
          /* legacy: אינדיקציה בלבד (ExchangeRoute וכו') */
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle size={14} className="text-amber-600" />
            <span className="text-xs text-amber-700">הרכב לא נמצא - יש לבחור סוג רכב ידנית</span>
          </div>
        ) : (
          /* Compact reopen — fields live in SelectorModalShell */
          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2 min-h-[36px] bg-amber-50 border border-amber-200 rounded-lg text-right"
          >
            <PenLine size={14} className="text-amber-600 shrink-0" />
            <span className="text-xs text-amber-700 flex-1">פרטי רכב ידניים — לחץ לעריכה</span>
          </button>
        )
      )}

      {manualEnabled && (
        <SelectorModalShell
          open={showManualModal}
          onClose={() => setShowManualModal(false)}
          title="פרטי רכב ידניים"
          panelClassName="max-w-md"
        >
          <div className="p-4" dir="rtl">
            {renderManualFields({ narrowManualLayout: isNarrow || isMobileSized })}
          </div>
        </SelectorModalShell>
      )}
    </div>
  )
}

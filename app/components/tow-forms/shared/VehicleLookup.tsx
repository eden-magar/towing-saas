'use client'

import { useState } from 'react'
import { Search, Loader2, AlertTriangle, PenLine } from 'lucide-react'
import { lookupVehicle, getVehicleTypeIcon } from '../../../lib/vehicle-lookup'
import { VehicleType, VehicleLookupResult } from '../../../lib/types'
import { normalizePlate } from '../../../lib/utils/plate-number'
import { shouldTriggerPlateLookupOnBlur } from '../../../lib/utils/plate-lookup-blur'

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
  /** Manual-entry link style in stacked layout: subtle link vs bordered button. */
  manualEntryStyle?: 'link' | 'button'
  /** Where to render the manual-entry trigger in stacked layout. */
  manualEntryPlacement?: 'inline' | 'afterSummary'
  /**
   * Manual entry (shared state, controlled by parent form). When
   * `onVehicleLookupNotFoundChange` is provided the component switches to
   * controlled "manual entry" mode (skip button + manual panel/modal).
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
  manualEntryStyle = 'link',
  manualEntryPlacement = 'inline',
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
      } else {
        setNotFound(true)
        onVehicleDataChange(null)
        onVehicleTypeChange('')
        if (manualEnabled && isMobile) setShowManualModal(true)
      }
    } catch (error) {
      console.error('Error looking up vehicle:', error)
      setNotFound(true)
      if (manualEnabled && isMobile) setShowManualModal(true)
    } finally {
      setLoading(false)
    }
  }

  // "Skip to manual" — proactively open manual entry without a lookup
  const openManualEntry = () => {
    onVehicleDataChange(null)
    setNotFound(true)
    onVehicleTypeChange('')
    onManualManufacturerChange?.('')
    onManualColorChange?.('')
    onManualWeightChange?.('')
    onManualChassisChange?.('')
    if (isMobile) setShowManualModal(true)
  }

  const manualInputClass = isNarrow
    ? 'w-full px-3 h-9 border border-gray-200 rounded-lg text-sm'
    : isMobileSized
      ? 'w-full px-3 h-12 border border-gray-300 rounded-xl text-sm'
      : 'w-full px-3 py-2 border border-gray-300 rounded-xl text-sm'

  const manualSelectClass = isNarrow
    ? 'w-full px-3 h-9 border border-gray-200 rounded-lg text-sm bg-white'
    : isMobileSized
      ? 'w-full px-3 h-12 border border-gray-300 rounded-xl text-sm bg-white'
      : 'w-full px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white'

  const renderManualEntryTrigger = () => {
    if (!manualEnabled || notFound || vehicleData?.found) return null
    return (
      <button
        type="button"
        onClick={openManualEntry}
        disabled={disabled}
        className={
          manualEntryStyle === 'button'
            ? isNarrow
              ? 'inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-lg border border-gray-200 text-gt-brand text-xs font-medium hover:bg-gt-brand-subtle transition-colors disabled:opacity-50'
              : 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gt-brand text-gt-brand text-xs font-medium hover:bg-gt-brand-subtle transition-colors disabled:opacity-50'
            : 'inline-flex items-center gap-1 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:underline underline-offset-2 transition-colors disabled:opacity-50'
        }
      >
        <PenLine className="w-3.5 h-3.5 shrink-0" />
        הזן פרטי רכב ידנית
      </button>
    )
  }

  const manualFieldLabelClass = (narrowManual = false) =>
    `block mb-1 ${
      isNarrow || narrowManual
        ? 'text-xs text-gray-500 font-medium'
        : 'text-xs text-gray-600'
    }`

  const renderManualFields = (options?: { narrowManualLayout?: boolean }) => {
    const narrowManual = options?.narrowManualLayout ?? false

    if (narrowManual) {
      return (
        <div className="space-y-2">
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
            <label className={`block mb-1 ${isNarrow ? 'text-xs text-gray-500 font-medium' : 'text-sm font-semibold text-gray-700'}`}>מספר רכב</label>
            {/* narrow-column: plate + code on one row; type is hidden when found
                and provided by the manual panel when not found. */}
            <div className={isNarrow ? 'flex gap-2' : 'relative'}>
              <div className={isNarrow ? 'relative flex-1 min-w-0' : 'relative'}>
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
                  placeholder="מספר רכב *"
                  disabled={disabled}
                  className={
                    isNarrow
                      ? 'w-full pl-12 pr-3 h-9 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-gt-brand/15 disabled:bg-gray-100'
                      : 'w-full pl-14 pr-3 h-12 bg-white border border-gray-300 rounded-lg text-lg font-semibold text-gray-900 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#33d4ff] disabled:bg-gray-100'
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
                      ? 'absolute left-0 top-0 h-9 w-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200/70 hover:text-gray-700 transition-colors disabled:opacity-40'
                      : 'absolute left-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200/70 hover:text-gray-700 transition-colors disabled:opacity-40'
                  }
                >
                  {loading ? (
                    <Loader2 size={isNarrow ? 16 : 18} className="animate-spin" />
                  ) : (
                    <Search size={isNarrow ? 16 : 18} />
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
                  className="w-20 shrink-0 px-2 h-9 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gt-brand/15 disabled:bg-gray-100"
                />
              )}
            </div>
          </div>

          {/* שורה 2: סוג + קוד — שדות משניים (מובייל בלבד; ב-narrow column קוד עלה לשורת הרכב והסוג מוסתר עד מצב ידני) */}
          {!isNarrow && (
            <div className="flex gap-2">
              <select
                value={vehicleType}
                onChange={(e) => onVehicleTypeChange(e.target.value as VehicleType | '')}
                disabled={vehicleData?.found || disabled}
                className={`flex-[2] min-w-0 px-2 h-12 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white ${
                  vehicleData?.found ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'
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
                  className="flex-1 min-w-0 px-2 h-12 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] disabled:bg-gray-100"
                />
              )}
            </div>
          )}

          {manualEntryPlacement === 'inline' && renderManualEntryTrigger()}
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
          placeholder="מספר רכב *"
          disabled={disabled}
          className={
            isMobile
              ? 'col-span-3 sm:flex-1 sm:min-w-0 px-3 h-12 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] font-mono disabled:bg-gray-100'
              : 'col-span-3 sm:flex-1 sm:min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] font-mono disabled:bg-gray-100'
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
              ? `col-span-2 sm:col-span-1 sm:min-w-[80px] px-2 h-12 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white ${
                  vehicleData?.found ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'
                } disabled:bg-gray-100`
              : `col-span-2 sm:col-span-1 sm:min-w-[80px] px-2 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white ${
                  vehicleData?.found ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'
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
                ? 'col-span-2 sm:col-span-1 sm:w-16 px-2 h-12 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] disabled:bg-gray-100'
                : 'col-span-2 sm:col-span-1 sm:w-16 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] disabled:bg-gray-100'
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
        <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
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

      {manualEntryPlacement === 'afterSummary' && renderManualEntryTrigger()}

      {/* רכב לא נמצא / מצב הזנה ידנית */}
      {notFound && !vehicleData?.found && (
        !manualEnabled ? (
          /* legacy: אינדיקציה בלבד (ExchangeRoute וכו') */
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle size={14} className="text-amber-600" />
            <span className="text-xs text-amber-700">הרכב לא נמצא - יש לבחור סוג רכב ידנית</span>
          </div>
        ) : isMobile ? (
          /* מובייל: אינדיקטור לחיץ שפותח מחדש את מודל ההזנה הידנית */
          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="w-full flex items-center gap-2 px-3 min-h-[48px] bg-amber-50 border border-amber-200 rounded-lg text-right"
          >
            <PenLine size={14} className="text-amber-600 shrink-0" />
            <span className="text-xs text-amber-700 flex-1">פרטי רכב ידניים — הקש לעריכה</span>
          </button>
        ) : isNarrow ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
            <p className="text-xs text-amber-600">הרכב לא נמצא במאגר — יש למלא ידנית</p>
            {renderManualFields({ narrowManualLayout: true })}
          </div>
        ) : (
          /* דסקטופ: פאנל אמבר inline עם השדות */
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
            <p className="text-sm text-amber-700 font-medium">הרכב לא נמצא במאגר — יש למלא ידנית</p>
            {renderManualFields()}
          </div>
        )
      )}

      {/* מובייל: מודל הזנה ידנית ממורכז */}
      {manualEnabled && isMobile && showManualModal && (
        <div
          className="sm:hidden fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowManualModal(false)}
        >
          <div
            className="bg-white w-full max-w-md max-h-[80vh] overflow-auto rounded-2xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">פרטי רכב ידניים</h3>
              <button type="button" onClick={() => setShowManualModal(false)} className="text-[#33d4ff] font-medium">סיום</button>
            </div>
            <div className="p-4">
              {renderManualFields()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

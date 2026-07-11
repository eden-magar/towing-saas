'use client'

import { useState } from 'react'
import { Car, Key, X, Search, Loader2, PenLine } from 'lucide-react'
import { VehicleData } from './VehicleInfoCard'
import { VehicleCoreLookupChips } from '../shared/VehicleCoreLookupChips'
import { lookupVehicle } from '../../../lib/vehicle-lookup'
import { VehicleLookupResult } from '../../../lib/types'
import { normalizePlate } from '../../../lib/utils/plate-number'
import { shouldTriggerPlateLookupOnBlur } from '../../../lib/utils/plate-lookup-blur'
import {
  DEFECT_OPTIONS,
  defectOptionClassName,
} from '../../../lib/constants/defects'

// ==================== Types ====================

export interface VehicleOnTruck {
  id: string
  plateNumber: string
  isWorking: boolean
  defects?: string[]
  vehicleCode?: string
  /** User-selected category (manual) or registry pricing bucket after lookup */
  vehicleType?: string
  /** Registry lookup source when plate was found — not the manual category dropdown */
  registrySource?: string | null
  vehicleData?: VehicleData
  isLoading?: boolean
  isFound?: boolean
  /** Set true after a lookup returned no vehicle (distinct from initial state). */
  vehicleNotFound?: boolean
  manualManufacturer?: string
  manualColor?: string
  manualWeight?: string
  // Storage integration
  fromStorage?: boolean
  storedVehicleId?: string
}

interface VehicleCardProps {
  vehicle: VehicleOnTruck
  onChange: (vehicle: VehicleOnTruck) => void
  onRemove: () => void
  onSearch?: (plateNumber: string) => Promise<void>
  storageWarning?: string | null
  className?: string
}

// ==================== Component ====================

export function VehicleCard({ 
  vehicle, 
  onChange, 
  onRemove,
  onSearch,
  storageWarning,
  className = '' 
}: VehicleCardProps) {
  const [isSearching, setIsSearching] = useState(false)
  const [showDefectsModal, setShowDefectsModal] = useState(false)
  const [otherDefectText, setOtherDefectText] = useState('')

  const openDefectsModal = () => {
    const defectOptionValues = new Set<string>(DEFECT_OPTIONS.map((o) => o.value))
    const custom = (vehicle.defects || []).find((d) => !defectOptionValues.has(d))
    if (custom) {
      setOtherDefectText(custom)
      const without = (vehicle.defects || []).filter((x) => x !== custom)
      const next = without.includes('אחר') ? without : [...without, 'אחר']
      onChange({ ...vehicle, defects: next })
    } else {
      setOtherDefectText('')
    }
    setShowDefectsModal(true)
  }

  const handleSkipToManualEntry = () => {
    if (vehicle.fromStorage) return
    onChange({
      ...vehicle,
      isLoading: false,
      isFound: false,
      vehicleNotFound: true,
      vehicleType: undefined,
      registrySource: null,
      vehicleData: undefined,
      manualManufacturer: undefined,
      manualColor: undefined,
      manualWeight: undefined,
    })
  }

  const handleSearch = async () => {
    if (vehicle.plateNumber.length < 5 || vehicle.fromStorage) return
    
    setIsSearching(true)
    onChange({ ...vehicle, isLoading: true })
    
    try {
      if (onSearch) {
        await onSearch(vehicle.plateNumber)
      } else {
        // Default search behavior
        const result: VehicleLookupResult = await lookupVehicle(vehicle.plateNumber)
        if (result.found && result.data) {
          const cachedCode = result.vehicleCode?.trim()
          onChange({
            ...vehicle,
            isLoading: false,
            isFound: true,
            vehicleNotFound: false,
            manualManufacturer: undefined,
            manualColor: undefined,
            manualWeight: undefined,
            vehicleType: result.source ?? 'private',
            registrySource: result.source ?? null,
            ...(cachedCode && !(vehicle.vehicleCode ?? '').trim()
              ? { vehicleCode: cachedCode }
              : {}),
            vehicleData: {
              manufacturer: result.data.manufacturer || undefined,
              model: result.data.model || undefined,
              year: result.data.year ? String(result.data.year) : undefined,
              color: result.data.color || undefined,
              gearType: result.data.gearType || undefined,
              driveType: result.data.driveType || undefined,
              totalWeight: result.data.totalWeight ? String(result.data.totalWeight) : undefined,
              curbWeightKg:
                result.data.curbWeightKg != null
                  ? String(result.data.curbWeightKg)
                  : undefined,
              fuelType: result.data.fuelType || undefined,
              machineryType: result.data.machineryType || undefined,
              selfWeight:
                result.data.selfWeight != null
                  ? String(result.data.selfWeight)
                  : undefined,
              totalWeightTon:
                result.data.totalWeightTon != null
                  ? String(result.data.totalWeightTon)
                  : undefined,
              chassis: result.data.chassis || undefined,
              importType: result.data.importType || undefined,
              ...(result.data.vehicleType
                ? { vehicleType: result.data.vehicleType }
                : {}),
            } as VehicleData & { vehicleType?: string }
          })
        } else {
          onChange({
            ...vehicle,
            isLoading: false,
            isFound: false,
            vehicleNotFound: true,
            vehicleType: vehicle.vehicleType ?? 'private',
            registrySource: null,
            vehicleData: undefined,
            manualManufacturer: undefined,
            manualColor: undefined,
            manualWeight: undefined,
          })
        }
      }
    } catch (error) {
      console.error('Vehicle lookup error:', error)
      onChange({
        ...vehicle,
        isLoading: false,
        isFound: false,
        vehicleNotFound: true,
        vehicleType: vehicle.vehicleType ?? 'private',
        registrySource: null,
        vehicleData: undefined,
        manualManufacturer: undefined,
        manualColor: undefined,
        manualWeight: undefined,
      })
    } finally {
      setIsSearching(false)
    }
  }

  const toggleWorking = () => {
    if (!vehicle.fromStorage) {
      onChange({ ...vehicle, isWorking: !vehicle.isWorking })
    }
  }

  return (
    <div className={`rounded-xl border-2 overflow-hidden ${
      vehicle.isWorking 
        ? 'border-green-200 bg-green-50/50' 
        : 'border-orange-200 bg-orange-50/50'
    } ${className}`}>
      {/* Header */}
      <div className={`px-3 py-2 flex items-center gap-2 ${
        vehicle.isWorking ? 'bg-green-100' : 'bg-orange-100'
      }`}>
        <span className={`w-3 h-3 rounded-full ${vehicle.isWorking ? 'bg-green-500' : 'bg-orange-500'}`} />
        <span className={`text-sm font-bold ${vehicle.isWorking ? 'text-green-700' : 'text-orange-700'}`}>
          רכב {vehicle.isWorking ? 'תקין' : 'תקול'}
          {vehicle.fromStorage && (
            <span className="mr-2 text-xs font-normal text-purple-600">
              (מאחסנה)
            </span>
          )}
        </span>
        {!vehicle.fromStorage && (
          <button
            type="button"
            onClick={toggleWorking}
            className="text-xs text-gray-500 hover:text-blue-600 hover:underline"
          >
            שנה
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="mr-auto text-gray-400 hover:text-red-500"
        >
          <X size={16} />
        </button>
      </div>
      
      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Plate number */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            <Car size={12} className="inline ml-1" />
            מספר רכב
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={vehicle.plateNumber}
              onChange={(e) =>
                onChange({
                  ...vehicle,
                  plateNumber: normalizePlate(e.target.value),
                  isFound: false,
                  vehicleNotFound: false,
                  vehicleData: undefined,
                  vehicleType: undefined,
                  registrySource: null,
                  manualManufacturer: undefined,
                  manualColor: undefined,
                  manualWeight: undefined,
                })
              }
              onBlur={() => {
                if (
                  shouldTriggerPlateLookupOnBlur(vehicle.plateNumber, {
                    hasFoundData: vehicle.isFound,
                    lookupAlreadyFailed: vehicle.vehicleNotFound,
                  })
                ) {
                  void handleSearch()
                }
              }}
              placeholder="12-345-67"
              readOnly={vehicle.fromStorage}
              className={`flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] ${
                vehicle.fromStorage ? 'bg-gray-50' : ''
              }`}
            />
            {!vehicle.fromStorage && (
              <button
                type="button"
                onClick={handleSearch}
                disabled={isSearching || vehicle.isLoading || vehicle.plateNumber.length < 5}
                className="px-3 py-2.5 bg-[#33d4ff] text-white rounded-lg hover:bg-[#21b8e6] disabled:opacity-50 flex items-center gap-1"
              >
                {(isSearching || vehicle.isLoading) ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
              </button>
            )}
          </div>
          {!vehicle.fromStorage && (
            <button
              type="button"
              onClick={handleSkipToManualEntry}
              className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gt-brand text-gt-brand text-xs font-medium hover:bg-gt-brand-subtle transition-colors"
            >
              <PenLine className="w-3.5 h-3.5" />
              הזן פרטי רכב ידנית
            </button>
          )}
          {(isSearching || vehicle.isLoading) && (
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              מחפש במאגר...
            </div>
          )}
          {storageWarning && (
            <p className="text-sm text-red-500 mt-1">{storageWarning}</p>
          )}
        </div>
        
        {/* נתוני רכב מהמאגר — same pill layout as exchange tow (create/page.tsx) */}
        {vehicle.isFound && vehicle.vehicleData && (
          <VehicleCoreLookupChips
            source={vehicle.registrySource ?? vehicle.vehicleType ?? null}
            data={vehicle.vehicleData}
            vehicleType={vehicle.vehicleType}
          />
        )}

        {/* שדות ידניים אם לא נמצא — same as exchange tow (create/page.tsx) */}
        {vehicle.vehicleNotFound && !vehicle.fromStorage && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
            <p className="text-sm text-amber-700 font-medium">הרכב לא נמצא במאגר — יש למלא ידנית</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  סוג רכב *
                </label>
                <select
                  value={vehicle.vehicleType ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...vehicle,
                      vehicleType: e.target.value || undefined,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                >
                  <option value="">בחר סוג רכב</option>
                  <option value="private">פרטי</option>
                  <option value="suv">ג&apos;יפ / SUV</option>
                  <option value="truck">משאית</option>
                  <option value="heavy">צמ&quot;ה</option>
                  <option value="motorcycle">אופנוע</option>
                  <option value="bus">אוטובוס</option>
                  <option value="van">רכב מסחרי</option>
                  <option value="other">אחר</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">יצרן</label>
                <input
                  type="text"
                  value={vehicle.manualManufacturer ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    onChange({
                      ...vehicle,
                      manualManufacturer: v || undefined,
                      vehicleData: {
                        ...(vehicle.vehicleData || {}),
                        manufacturer: v || undefined,
                      } as VehicleData,
                    })
                  }}
                  placeholder="למשל: טויוטה"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">צבע</label>
                <input
                  type="text"
                  value={vehicle.manualColor ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    onChange({
                      ...vehicle,
                      manualColor: v || undefined,
                      vehicleData: {
                        ...(vehicle.vehicleData || {}),
                        color: v || undefined,
                      } as VehicleData,
                    })
                  }}
                  placeholder="למשל: לבן"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  משקל (ק&quot;ג)
                </label>
                <input
                  type="number"
                  value={vehicle.manualWeight ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    onChange({
                      ...vehicle,
                      manualWeight: v || undefined,
                      vehicleData: {
                        ...(vehicle.vehicleData || {}),
                        totalWeight: v || undefined,
                      } as VehicleData,
                    })
                  }}
                  placeholder="אופציונלי"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Vehicle code */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            <Key size={12} className="inline ml-1" />
            קוד רכב
          </label>
          <input
            type="text"
            value={vehicle.vehicleCode || ''}
            onChange={(e) => onChange({ ...vehicle, vehicleCode: e.target.value })}
            placeholder="קוד לשחרור הרכב"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
          />
        </div>
        
        {/* Defects — button + modal (same pattern as exchange tow create/page.tsx) */}
        {!vehicle.isWorking && (
          <>
            <button
              type="button"
              onClick={openDefectsModal}
              className={`w-full py-2 rounded-xl border text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                (vehicle.defects || []).length > 0
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              🔧 פירוט התקלה
              {(vehicle.defects || []).length > 0 && (
                <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold leading-5 text-center">
                  {(vehicle.defects || []).length}
                </span>
              )}
            </button>
            {(vehicle.defects || []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(vehicle.defects || []).map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs border border-gray-200"
                  >
                    {d}
                  </span>
                ))}
              </div>
            )}

            {showDefectsModal && (
              <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800 text-base">בחר תקלות</h3>
                    <button
                      type="button"
                      onClick={() => setShowDefectsModal(false)}
                      className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-4 grid grid-cols-3 gap-3">
                    {DEFECT_OPTIONS.map((defect) => {
                      const Icon = defect.icon
                      const selected = (vehicle.defects || []).includes(defect.value)
                      return (
                      <button
                        key={defect.value}
                        type="button"
                        onClick={() => {
                          const prev = vehicle.defects || []
                          onChange({
                            ...vehicle,
                            defects: prev.includes(defect.value)
                              ? prev.filter((x) => x !== defect.value)
                              : [...prev, defect.value],
                          })
                        }}
                        className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm transition-colors ${defectOptionClassName(selected, defect.highlight, 'grid')}`}
                      >
                        <Icon className="h-6 w-6 shrink-0" aria-hidden />
                        <span className="text-xs font-medium text-center leading-tight">{defect.label}</span>
                      </button>
                      )
                    })}
                  </div>
                  {(vehicle.defects || []).includes('אחר') && (
                    <div className="mt-3 px-4">
                      <label className="block text-sm">תיאור התקלה:</label>
                      <input
                        type="text"
                        value={otherDefectText}
                        onChange={(e) => setOtherDefectText(e.target.value)}
                        placeholder="תאר את התקלה..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  <div className="px-4 pb-4 pt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const prev = vehicle.defects || []
                        if (!prev.includes('אחר')) {
                          setShowDefectsModal(false)
                          return
                        }
                        const trimmed = otherDefectText.trim()
                        if (!trimmed) {
                          onChange({ ...vehicle, defects: prev })
                          setShowDefectsModal(false)
                          return
                        }
                        onChange({
                          ...vehicle,
                          defects: [...prev.filter((v) => v !== 'אחר'), trimmed],
                        })
                        setShowDefectsModal(false)
                      }}
                      className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl font-medium text-sm"
                    >
                      אישור
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDefectsModal(false)}
                      className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm"
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        
      </div>
    </div>
  )
}

// ==================== Helper to create empty vehicle ====================

export function createEmptyVehicle(isWorking: boolean = true): VehicleOnTruck {
  return {
    id: `vehicle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    plateNumber: '',
    isWorking,
    defects: [],
    vehicleCode: '',
    isLoading: false,
    isFound: false,
    vehicleNotFound: false,
    fromStorage: false
  }
}
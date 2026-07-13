'use client'

import { useState } from 'react'
import { Car, Key, X, Search, Loader2 } from 'lucide-react'
import { VehicleData } from './VehicleInfoCard'
import { VehicleCoreLookupChips } from '../shared/VehicleCoreLookupChips'
import { DefectSelector } from '../shared/DefectSelector'
import { ManualVehicleEntryTrigger } from '../shared/ManualVehicleEntryModal'
import { VehicleCardActions } from '../shared/VehicleCardActions'
import { lookupVehicle } from '../../../lib/vehicle-lookup'
import { VehicleLookupResult, type VehicleType } from '../../../lib/types'
import { normalizePlate } from '../../../lib/utils/plate-number'
import { shouldTriggerPlateLookupOnBlur } from '../../../lib/utils/plate-lookup-blur'

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
          {(!vehicle.fromStorage || !vehicle.isWorking) && (
            <VehicleCardActions className="mt-1.5">
              {!vehicle.fromStorage && (
                <ManualVehicleEntryTrigger
                  active={Boolean(vehicle.vehicleNotFound)}
                  values={{
                    plateNumber: vehicle.plateNumber,
                    vehicleType: (vehicle.vehicleType as VehicleType | '') || '',
                    manufacturer: vehicle.manualManufacturer ?? '',
                    color: vehicle.manualColor ?? '',
                    chassis: '',
                    weight: vehicle.manualWeight ?? '',
                  }}
                  onSave={(v) => {
                    onChange({
                      ...vehicle,
                      plateNumber: v.plateNumber,
                      isLoading: false,
                      isFound: false,
                      vehicleNotFound: true,
                      vehicleType: v.vehicleType || undefined,
                      registrySource: null,
                      vehicleData: {
                        manufacturer: v.manufacturer || undefined,
                        color: v.color || undefined,
                        totalWeight: v.weight || undefined,
                        chassis: v.chassis || undefined,
                      } as VehicleData,
                      manualManufacturer: v.manufacturer || undefined,
                      manualColor: v.color || undefined,
                      manualWeight: v.weight || undefined,
                    })
                  }}
                />
              )}
              {!vehicle.isWorking && (
                <DefectSelector
                  variant="triggerOnly"
                  selectedDefects={vehicle.defects || []}
                  onChange={(defects) => onChange({ ...vehicle, defects })}
                />
              )}
            </VehicleCardActions>
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
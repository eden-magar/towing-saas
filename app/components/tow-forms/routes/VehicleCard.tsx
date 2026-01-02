'use client'

import { useState } from 'react'
import { Car, Key, X, AlertTriangle, Search, Loader2 } from 'lucide-react'
import { VehicleInfoCard, VehicleData } from './VehicleInfoCard'
import { lookupVehicle } from '../../../lib/vehicle-lookup'

// ==================== Types ====================

export interface VehicleOnTruck {
  id: string
  plateNumber: string
  isWorking: boolean
  defects?: string[]
  vehicleCode?: string
  vehicleData?: VehicleData
  isLoading?: boolean
  isFound?: boolean
  // Storage integration
  fromStorage?: boolean
  storedVehicleId?: string
}

interface VehicleCardProps {
  vehicle: VehicleOnTruck
  onChange: (vehicle: VehicleOnTruck) => void
  onRemove: () => void
  onSearch?: (plateNumber: string) => Promise<void>
  className?: string
}

// ==================== Constants ====================

export const DEFECT_OPTIONS = [
  { id: 'flat_tire', label: 'תקר' },
  { id: 'engine', label: 'מנוע' },
  { id: 'battery', label: 'מצבר' },
  { id: 'accident', label: 'תאונה' },
  { id: 'lockout', label: 'נעילה' },
  { id: 'other', label: 'אחר' },
]

// ==================== Component ====================

export function VehicleCard({ 
  vehicle, 
  onChange, 
  onRemove,
  onSearch,
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
        const result = await lookupVehicle(vehicle.plateNumber)
        if (result.found && result.data) {
          onChange({
            ...vehicle,
            isLoading: false,
            isFound: true,
            vehicleData: {
              manufacturer: result.data.manufacturer || undefined,
              model: result.data.model || undefined,
              year: result.data.year ? String(result.data.year) : undefined,
              color: result.data.color || undefined,
              gearType: result.data.gearType || undefined,
              driveType: result.data.driveType || undefined,
              totalWeight: result.data.totalWeight ? String(result.data.totalWeight) : undefined,
              fuelType: result.data.fuelType || undefined
            }
          })
        } else {
          onChange({ ...vehicle, isLoading: false, isFound: false })
        }
      }
    } catch (error) {
      console.error('Vehicle lookup error:', error)
      onChange({ ...vehicle, isLoading: false, isFound: false })
    } finally {
      setIsSearching(false)
    }
  }

  const toggleDefect = (defectLabel: string) => {
    const defects = vehicle.defects || []
    const newDefects = defects.includes(defectLabel)
      ? defects.filter(d => d !== defectLabel)
      : [...defects, defectLabel]
    onChange({ ...vehicle, defects: newDefects })
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
              onChange={(e) => onChange({ 
                ...vehicle, 
                plateNumber: e.target.value, 
                isFound: false, 
                vehicleData: undefined 
              })}
              onBlur={() => {
                if (vehicle.plateNumber.length >= 5 && !vehicle.vehicleData && !vehicle.fromStorage) {
                  handleSearch()
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
          {(isSearching || vehicle.isLoading) && (
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              מחפש במאגר...
            </div>
          )}
        </div>
        
        {/* Vehicle info */}
        {vehicle.vehicleData && (
          <VehicleInfoCard data={vehicle.vehicleData} isWorking={vehicle.isWorking} />
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
        
        {/* Defects - only for broken vehicles */}
        {!vehicle.isWorking && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              <AlertTriangle size={12} className="inline ml-1 text-orange-500" />
              פירוט התקלה
            </label>
            <div className="flex flex-wrap gap-2">
              {DEFECT_OPTIONS.map(defect => (
                <button
                  key={defect.id}
                  type="button"
                  onClick={() => toggleDefect(defect.label)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                    (vehicle.defects || []).includes(defect.label)
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-orange-300'
                  }`}
                >
                  {defect.label}
                </button>
              ))}
            </div>
          </div>
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
    fromStorage: false
  }
}
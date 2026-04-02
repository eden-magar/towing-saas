'use client'

import { useState } from 'react'
import { Search, Loader2, AlertTriangle } from 'lucide-react'
import { lookupVehicle, getVehicleTypeIcon } from '../../../lib/vehicle-lookup'
import { VehicleType, VehicleLookupResult } from '../../../lib/types'

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
  disabled = false
}: VehicleLookupProps) {
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

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
      }
    } catch (error) {
      console.error('Error looking up vehicle:', error)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      {/* שורה ראשית: מספר רכב + חפש + סוג + קוד */}
      <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-2">
        {/* מספר רכב */}
        <input
          type="text"
          value={plateNumber}
          onChange={(e) => {
            const newValue = e.target.value
            onPlateChange(newValue)
            if (newValue.replace(/[^0-9]/g, '').length < 5) {
              onVehicleDataChange(null)
              onVehicleTypeChange('')
            }
          }}
          placeholder="מספר רכב *"
          disabled={disabled}
          className="col-span-3 sm:flex-1 sm:min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] font-mono disabled:bg-gray-100"
          onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          onBlur={() => {
            if (!vehicleData?.found && plateNumber.replace(/[^0-9]/g, '').length >= 5) {
              handleLookup()
            }
          }}
        />

        {/* כפתור חיפוש */}
        <button
          onClick={handleLookup}
          disabled={loading || plateNumber.length < 5 || disabled}
          className="col-span-1 px-3 py-2 bg-[#33d4ff] text-white rounded-lg text-sm font-medium hover:bg-[#21b8e6] transition-colors disabled:opacity-50 flex items-center justify-center"
          >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </button>

        {/* סוג רכב */}
        <select
          value={vehicleType}
          onChange={(e) => onVehicleTypeChange(e.target.value as VehicleType | '')}
          disabled={vehicleData?.found || disabled}
          className={`col-span-2 sm:col-span-1 sm:min-w-[80px] px-2 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white ${
          vehicleData?.found ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'
          } disabled:bg-gray-100`}
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
            className="col-span-2 sm:col-span-1 sm:w-16 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] disabled:bg-gray-100"
            />
        )}
      </div>
      
      

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

      {/* רכב לא נמצא */}
      {notFound && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle size={14} className="text-amber-600" />
          <span className="text-xs text-amber-700">הרכב לא נמצא - יש לבחור סוג רכב ידנית</span>
        </div>
      )}
    </div>
  )
}
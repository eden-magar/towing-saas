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
    <div className="space-y-4">
      {/* מספר רכב */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          מספר רכב <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={plateNumber}
            onChange={(e) => {
            const newValue = e.target.value
            onPlateChange(newValue)
            // אם נמחק מספר הרכב - נקה את הנתונים
            if (newValue.replace(/[^0-9]/g, '').length < 5) {
              onVehicleDataChange(null)
              onVehicleTypeChange('')
            }
          }}
            placeholder="12-345-67"
            disabled={disabled}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] font-mono disabled:bg-gray-100"
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          />
          <button
            onClick={handleLookup}
            disabled={loading || plateNumber.length < 5 || disabled}
            className="px-4 py-2.5 bg-[#33d4ff] text-white rounded-xl text-sm font-medium hover:bg-[#21b8e6] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <Search size={18} />
                חפש
              </>
            )}
          </button>
        </div>

        {/* תוצאות חיפוש */}
        {vehicleData?.found && vehicleData.data && (
          <div className="mt-3 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm">
                {getVehicleTypeIcon(vehicleData.source || 'private')}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-gray-800">
                    {vehicleData.data.manufacturer} {vehicleData.data.model}
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                    {vehicleData.sourceLabel}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                  {vehicleData.data.year && (
                    <span>שנה: <strong>{vehicleData.data.year}</strong></span>
                  )}
                  {vehicleData.data.color && (
                    <span>צבע: <strong>{vehicleData.data.color}</strong></span>
                  )}
                  
                  {/* שדות לרכב רגיל */}
                  {vehicleData.source !== 'machinery' && (
                    <>
                      {/* סוג רכב לדו גלגלי */}
                      {vehicleData.source === 'motorcycle' && vehicleData.data.vehicleType && (
                        <span>סוג: <strong>{vehicleData.data.vehicleType}</strong></span>
                      )}
                      {vehicleData.data.driveType && (
                        <span>הנעה: <strong>{vehicleData.data.driveType}</strong></span>
                      )}
                      {vehicleData.data.driveTechnology && (
                        <span>טכנולוגיה: <strong>{vehicleData.data.driveTechnology}</strong></span>
                      )}
                      {vehicleData.data.totalWeight && (
                        <span>משקל: <strong>{vehicleData.data.totalWeight.toLocaleString()} ק״ג</strong></span>
                      )}
                      {vehicleData.data.gearType && (
                        <span>גיר: <strong>{vehicleData.data.gearType}</strong></span>
                      )}
                    </>
                  )}
                  {/* שדות לצמ"ה */}
                  {vehicleData.source === 'machinery' && (
                    <>
                      {vehicleData.data.machineryType && (
                        <span>סוג צמ״ה: <strong>{vehicleData.data.machineryType}</strong></span>
                      )}
                      {vehicleData.data.selfWeight && (
                        <span>משקל עצמי: <strong>{vehicleData.data.selfWeight} טון</strong></span>
                      )}
                      {vehicleData.data.totalWeightTon && (
                        <span>משקל כולל: <strong>{vehicleData.data.totalWeightTon} טון</strong></span>
                      )}
                      {vehicleData.data.driveType && (
                        <span>הנעה: <strong>{vehicleData.data.driveType}</strong></span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* רכב לא נמצא */}
        {notFound && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle size={18} />
              <span className="text-sm">הרכב לא נמצא במאגרי משרד התחבורה. יש לבחור סוג רכב ידנית.</span>
            </div>
          </div>
        )}
      </div>

      {/* סוג רכב + קוד */}
      <div className={`grid gap-4 ${showVehicleCode ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">סוג רכב</label>
          <select
            value={vehicleType}
            onChange={(e) => onVehicleTypeChange(e.target.value as VehicleType | '')}
            disabled={vehicleData?.found || disabled}
            className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white ${
              vehicleData?.found ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'
            } disabled:bg-gray-100`}
          >
            <option value="">בחר סוג</option>
            <option value="private">🚗 רכב פרטי</option>
            <option value="motorcycle">🏍️ דו גלגלי</option>
            <option value="heavy">🚚 רכב כבד</option>
            <option value="machinery">🚜 צמ״ה</option>
          </select>
          {vehicleData?.found && (
            <p className="text-xs text-emerald-600 mt-1">נקבע אוטומטית לפי מאגר משרד התחבורה</p>
          )}
        </div>

        {showVehicleCode && onVehicleCodeChange && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">קוד רכב</label>
            <input
              type="text"
              value={vehicleCode}
              onChange={(e) => onVehicleCodeChange(e.target.value)}
              placeholder="קוד פנימי (אופציונלי)"
              disabled={disabled}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] disabled:bg-gray-100"
            />
          </div>
        )}
      </div>
    </div>
  )
}

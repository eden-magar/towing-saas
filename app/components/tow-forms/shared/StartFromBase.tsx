'use client'

import { Loader2 } from 'lucide-react'

interface DistanceResult {
  distanceKm: number
  durationMinutes: number
}

interface StartFromBaseProps {
  baseAddress: string | null | undefined
  checked: boolean
  onChange: (checked: boolean) => void
  baseToPickupDistance: DistanceResult | null
  isLoading: boolean
  hasPickupAddress: boolean
}

export function StartFromBase({
  baseAddress,
  checked,
  onChange,
  baseToPickupDistance,
  isLoading,
  hasPickupAddress
}: StartFromBaseProps) {
  if (!baseAddress) return null

  return (
    <div className={`p-4 rounded-xl border-2 transition-all ${
      checked 
        ? 'bg-emerald-50 border-emerald-300' 
        : 'bg-gray-50 border-gray-200'
    }`}>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-5 h-5 text-emerald-500 rounded"
        />
        <div className="flex-1">
          <span className={`font-medium ${checked ? 'text-emerald-700' : 'text-gray-700'}`}>
            🏠 יציאה מהבסיס
          </span>
          <p className="text-xs text-gray-500 mt-0.5">
            {baseAddress}
          </p>
        </div>
      </label>
      
      {checked && (
        <div className="mt-3 pt-3 border-t border-emerald-200">
          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 size={16} className="animate-spin" />
              <span>מחשב מרחק מהבסיס...</span>
            </div>
          ) : baseToPickupDistance ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-emerald-700">מרחק בסיס → מוצא:</span>
              <span className="font-bold text-emerald-700">{baseToPickupDistance.distanceKm} ק״מ</span>
            </div>
          ) : hasPickupAddress ? (
            <p className="text-xs text-amber-600">לא ניתן לחשב מרחק</p>
          ) : (
            <p className="text-xs text-gray-500">הזן כתובת מוצא לחישוב</p>
          )}
        </div>
      )}
    </div>
  )
}

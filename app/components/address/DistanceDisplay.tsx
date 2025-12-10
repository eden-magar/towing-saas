'use client'

// ==================== DistanceDisplay Component ====================
// תצוגת מרחק, זמן נסיעה ומחיר משוער

import { Navigation, Clock, Banknote, ExternalLink } from 'lucide-react'
import { AddressData, DistanceResult, getWazeLink, getGoogleMapsLink } from './useGoogleMaps'

interface DistanceDisplayProps {
  origin?: AddressData
  destination?: AddressData
  distance: DistanceResult | null
  pricePerKm?: number
  basePrice?: number
  isLoading?: boolean
  className?: string
}

export default function DistanceDisplay({
  origin,
  destination,
  distance,
  pricePerKm = 12,
  basePrice = 180,
  isLoading = false,
  className = ''
}: DistanceDisplayProps) {
  if (isLoading) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-xl p-4 ${className}`}>
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          <span className="text-sm">מחשב מרחק...</span>
        </div>
      </div>
    )
  }

  if (!distance) {
    return null
  }

  // חישוב מחיר משוער
  const distancePrice = Math.round(distance.distanceKm * pricePerKm)
  const estimatedPrice = basePrice + distancePrice

  return (
    <div className={`bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl overflow-hidden ${className}`}>
      {/* כותרת */}
      <div className="px-4 py-2 bg-blue-100/50 border-b border-blue-200 flex items-center gap-2">
        <Navigation size={16} className="text-blue-600" />
        <span className="font-medium text-blue-800 text-sm">מידע מסלול</span>
      </div>

      {/* תוכן */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* מרחק */}
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">
              {distance.distanceKm}
              <span className="text-sm font-normal text-gray-500 mr-1">ק״מ</span>
            </div>
            <div className="text-xs text-gray-500">מרחק</div>
          </div>

          {/* זמן */}
          <div className="text-center border-x border-blue-200">
            <div className="text-2xl font-bold text-gray-800">
              {distance.durationMinutes}
              <span className="text-sm font-normal text-gray-500 mr-1">דק׳</span>
            </div>
            <div className="text-xs text-gray-500">זמן נסיעה</div>
          </div>

          {/* מחיר משוער */}
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">
              ₪{estimatedPrice}
            </div>
            <div className="text-xs text-gray-500">מחיר משוער</div>
          </div>
        </div>

        {/* פירוט מחיר */}
        <div className="text-xs text-gray-500 bg-white/50 rounded-lg p-2 space-y-1">
          <div className="flex justify-between">
            <span>מחיר בסיס:</span>
            <span>₪{basePrice}</span>
          </div>
          <div className="flex justify-between">
            <span>מרחק ({distance.distanceKm} ק״מ × ₪{pricePerKm}):</span>
            <span>₪{distancePrice}</span>
          </div>
          <div className="flex justify-between font-medium text-gray-700 pt-1 border-t border-gray-200">
            <span>סה״כ משוער:</span>
            <span>₪{estimatedPrice}</span>
          </div>
        </div>

        {/* קישורי ניווט */}
        {destination && (destination.lat || destination.address) && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-blue-200">
            <a
              href={getWazeLink(destination)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#33ccff] text-white rounded-lg text-sm font-medium hover:bg-[#28b8e8] transition-colors"
            >
              <ExternalLink size={14} />
              Waze
            </a>
            <a
              href={getGoogleMapsLink(destination)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
            >
              <ExternalLink size={14} />
              Google Maps
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== Distance Hook ====================
// Hook לחישוב מרחק אוטומטי

import { useState, useEffect } from 'react'
import { calculateDistance } from './useGoogleMaps'

export function useDistance(
  origin: AddressData | undefined,
  destination: AddressData | undefined
) {
  const [distance, setDistance] = useState<DistanceResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // ביטול אם אין מספיק נתונים
    if (!origin?.address || !destination?.address) {
      setDistance(null)
      return
    }

    // עדיפות לקואורדינטות
    const hasOriginCoords = !!(origin.lat && origin.lng)
    const hasDestCoords = !!(destination.lat && destination.lng)

    // אם אין קואורדינטות לאף אחד, לא מחשבים
    if (!hasOriginCoords && !hasDestCoords) {
      // אפשר לחשב גם עם כתובות טקסט, אבל פחות מדויק
    }

    const calculate = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await calculateDistance(origin, destination)
        setDistance(result)
        
        if (!result) {
          setError('לא ניתן לחשב מרחק')
        }
      } catch (err) {
        setError('שגיאה בחישוב מרחק')
        setDistance(null)
      } finally {
        setIsLoading(false)
      }
    }

    // debounce - המתנה קצרה לפני חישוב
    const timeout = setTimeout(calculate, 500)
    return () => clearTimeout(timeout)

  }, [
    origin?.address, origin?.lat, origin?.lng,
    destination?.address, destination?.lat, destination?.lng
  ])

  return { distance, isLoading, error }
}

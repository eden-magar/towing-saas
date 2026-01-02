'use client'

import { FileText } from 'lucide-react'
import { LocationSurcharge, ServiceSurcharge, TimeSurcharge, CustomerWithPricing } from '../../../lib/queries/price-lists'

interface DistanceResult {
  distanceKm: number
  durationMinutes: number
}

interface PriceItem {
  id: string
  label: string
  price: number
}

interface PriceSummaryProps {
  // תצוגה
  isMobile?: boolean
  hasTowType: boolean
  hasVehicleType: boolean
  vehicleType: string
  
  // מחירון בסיס
  basePriceList: Record<string, any> | null
  
  // מרחק
  distance: DistanceResult | null
  baseToPickupDistance?: DistanceResult | null
  startFromBase?: boolean
  
  // תוספות
  activeTimeSurcharges: TimeSurcharge[]
  selectedLocationSurcharges: string[]
  locationSurchargesData: LocationSurcharge[]
  selectedServiceSurcharges: string[]
  serviceSurchargesData: ServiceSurcharge[]
  waitingTimeUnits: number
  
  // לקוח
  selectedCustomerPricing: CustomerWithPricing | null
  
  // מצב מחיר
  priceMode: 'recommended' | 'fixed' | 'customer' | 'custom'
  selectedPriceItem: PriceItem | null
  customPrice: string
  
  // פעולות
  finalPrice: number
  onSave: () => void
  saving: boolean
  
  // מסלול מותאם אישית
  towType?: string
  customRouteVehicleCount?: number
}

export function PriceSummary({
  isMobile = false,
  hasTowType,
  hasVehicleType,
  vehicleType,
  basePriceList,
  distance,
  baseToPickupDistance,
  startFromBase = false,
  activeTimeSurcharges,
  selectedLocationSurcharges,
  locationSurchargesData,
  selectedServiceSurcharges,
  serviceSurchargesData,
  waitingTimeUnits,
  selectedCustomerPricing,
  priceMode,
  selectedPriceItem,
  customPrice,
  finalPrice,
  onSave,
  saving,
  towType,
  customRouteVehicleCount = 0
}: PriceSummaryProps) {
  
  const isCustomRoute = towType === 'custom'
  
  if (!hasTowType) {
    return (
      <div className={`text-center ${isMobile ? 'py-4' : 'py-8'} text-gray-400`}>
        {!isMobile && (
          <div className="w-12 h-12 mx-auto mb-3 opacity-50 bg-gray-100 rounded-xl flex items-center justify-center">
            <FileText size={24} />
          </div>
        )}
        <p className="text-sm">בחר סוג גרירה לחישוב מחיר</p>
      </div>
    )
  }

  // חישוב מפורט
  const vehicleTypeMap: Record<string, string> = {
    'private': 'base_price_private',
    'motorcycle': 'base_price_motorcycle',
    'heavy': 'base_price_heavy',
    'machinery': 'base_price_machinery'
  }
  
  const pricePerKm = basePriceList?.price_per_km || 12
  const distanceKm = distance?.distanceKm || 0
  
  // מחיר בסיס - שונה לפי סוג המסלול
  let basePrice = 0
  if (isCustomRoute) {
    // מסלול מותאם - מחיר בסיס לכל רכב (נניח פרטי)
    const basePricePerVehicle = basePriceList?.base_price_private || 180
    basePrice = basePricePerVehicle * customRouteVehicleCount
  } else {
    // גרירה רגילה
    const priceField = vehicleType ? vehicleTypeMap[vehicleType] : null
    basePrice = priceField ? (basePriceList?.[priceField] || 0) : 0
  }
  
  // מרחק
  const baseToPickupKm = (!isCustomRoute && startFromBase && baseToPickupDistance?.distanceKm) || 0
  const totalDistanceKm = distanceKm + baseToPickupKm
  const distancePrice = Math.round(totalDistanceKm * pricePerKm)
  
  const subtotal = basePrice + distancePrice
  
  // תוספות זמן (הגבוהה ביותר)
  let timePercent = 0
  let timeLabel = ''
  if (activeTimeSurcharges.length > 0) {
    const maxSurcharge = activeTimeSurcharges.reduce((max, s) => 
      s.surcharge_percent > max.surcharge_percent ? s : max
    , activeTimeSurcharges[0])
    timePercent = maxSurcharge.surcharge_percent
    timeLabel = maxSurcharge.label
  }
  const timeAmount = Math.round(subtotal * (timePercent / 100))
  
  // תוספות מיקום
  let locationPercent = 0
  const activeLocationSurcharges = selectedLocationSurcharges
    .map(id => locationSurchargesData.find(l => l.id === id))
    .filter(Boolean) as LocationSurcharge[]
  activeLocationSurcharges.forEach(s => { locationPercent += s.surcharge_percent })
  const locationAmount = Math.round(subtotal * locationPercent / 100)
  
  // תוספות שירותים
  let servicesTotal = 0
  const activeServices: { label: string; amount: number }[] = []
  selectedServiceSurcharges.forEach(id => {
    const surcharge = serviceSurchargesData.find(s => s.id === id)
    if (surcharge) {
      let amount = surcharge.price
      let label = surcharge.label
      if (surcharge.label.includes('המתנה') && waitingTimeUnits > 0) {
        amount = surcharge.price * waitingTimeUnits
        label = `${surcharge.label} (×${waitingTimeUnits})`
      } else if (surcharge.label.includes('המתנה') && waitingTimeUnits === 0) {
        return
      }
      servicesTotal += amount
      activeServices.push({ label, amount })
    }
  })
  
  const beforeDiscount = subtotal + timeAmount + locationAmount + servicesTotal
  
  const discountAmount = selectedCustomerPricing?.discount_percent 
    ? Math.round(beforeDiscount * selectedCustomerPricing.discount_percent / 100) 
    : 0
  
  const beforeVat = beforeDiscount - discountAmount
  const vatAmount = Math.round(beforeVat * 0.18)
  const total = beforeVat + vatAmount

  const getVehicleTypeLabel = (type: string) => {
    switch (type) {
      case 'private': return 'פרטי'
      case 'motorcycle': return 'דו גלגלי'
      case 'heavy': return 'כבד'
      case 'machinery': return 'צמ"ה'
      default: return ''
    }
  }

  // בדיקה אם יש מספיק נתונים להציג
  const hasDataForCalculation = isCustomRoute 
    ? (customRouteVehicleCount > 0 && distanceKm > 0)
    : hasVehicleType

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="space-y-2 text-sm">
        {priceMode === 'recommended' && (
          <>
            {!hasDataForCalculation ? (
              <div className="text-center py-2 text-gray-400 text-sm">
                {isCustomRoute 
                  ? 'הוסף נקודות ורכבים לחישוב מחיר'
                  : 'הזן מספר רכב לחישוב מחיר'
                }
              </div>
            ) : (
              <>
                {/* מחיר בסיס */}
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    {isCustomRoute 
                      ? `מחיר בסיס (${customRouteVehicleCount} רכבים)`
                      : `מחיר בסיס (${getVehicleTypeLabel(vehicleType)})`
                    }
                  </span>
                  <span className="text-gray-700">₪{basePrice}</span>
                </div>
                
                {/* מרחק */}
                {totalDistanceKm > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      מרחק ({totalDistanceKm} ק״מ × ₪{pricePerKm})
                    </span>
                    <span className="text-gray-700">₪{distancePrice}</span>
                  </div>
                )}
                
                {/* תוספת זמן */}
                {timeAmount > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>{timeLabel} (+{timePercent}%)</span>
                    <span>₪{timeAmount}</span>
                  </div>
                )}
                
                {/* תוספות מיקום */}
                {activeLocationSurcharges.map(s => (
                  <div key={s.id} className="flex justify-between text-amber-600">
                    <span>{s.label} (+{s.surcharge_percent}%)</span>
                    <span>₪{Math.round(subtotal * s.surcharge_percent / 100)}</span>
                  </div>
                ))}
                
                {/* תוספות שירותים */}
                {activeServices.map((s, i) => (
                  <div key={i} className="flex justify-between text-blue-600">
                    <span>{s.label}</span>
                    <span>₪{s.amount}</span>
                  </div>
                ))}
                
                {/* הנחת לקוח */}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>הנחת לקוח (-{selectedCustomerPricing?.discount_percent}%)</span>
                    <span>-₪{discountAmount}</span>
                  </div>
                )}
                
                {/* מע"מ */}
                {beforeVat > 0 && (
                  <div className="flex justify-between border-t border-gray-100 pt-2">
                    <span className="text-gray-500">מע״מ (18%)</span>
                    <span className="text-gray-700">₪{vatAmount}</span>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {priceMode === 'fixed' && selectedPriceItem && (
          <div className="flex justify-between">
            <span className="text-gray-500">{selectedPriceItem.label}</span>
            <span className="text-gray-700">₪{selectedPriceItem.price}</span>
          </div>
        )}

        {priceMode === 'customer' && selectedPriceItem && (
          <div className="flex justify-between">
            <span className="text-gray-500">{selectedPriceItem.label}</span>
            <span className="text-gray-700">₪{selectedPriceItem.price}</span>
          </div>
        )}

        {priceMode === 'custom' && customPrice && (
          <div className="flex justify-between">
            <span className="text-gray-500">מחיר ידני</span>
            <span className="text-gray-700">₪{customPrice}</span>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 pt-3">
        <div className="flex justify-between items-center">
          <span className="font-bold text-gray-800">סה״כ כולל מע״מ</span>
          <span className={`font-bold text-gray-800 ${isMobile ? 'text-xl' : 'text-2xl'}`}>
            ₪{priceMode === 'recommended' ? (hasDataForCalculation ? total : 0) : finalPrice}
          </span>
        </div>
      </div>

      <button 
        onClick={onSave}
        disabled={saving}
        className="w-full py-3 bg-[#33d4ff] text-white font-medium rounded-xl hover:bg-[#21b8e6] transition-colors disabled:bg-gray-300"
      >
        {saving ? 'שומר...' : 'שמור גרירה'}
      </button>
    </div>
  )
}
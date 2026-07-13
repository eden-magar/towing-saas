'use client'

import { FileText } from 'lucide-react'
import { LocationSurcharge, ServiceSurcharge, TimeSurcharge, CustomerWithPricing } from '../../../lib/queries/price-lists'
import { SelectedService } from '../shared'
import { manualSurchargesToCalcInput } from '../../../lib/utils/manual-surcharge'
import type { ManualSurcharge } from '../../../lib/utils/manual-surcharge'
import { calculateTowPrice, extractBasePrices, mergePriceLists, resolveDeadheadRate, customerDiscountForPriceMode } from '../../../lib/utils/price-calculator'
import { VehicleType } from '../../../lib/types'

function aggregateRouteServices(services: SelectedService[] | undefined): SelectedService[] {
  if (!services?.length) return []
  const map = new Map<string, SelectedService>()
  for (const s of services) {
    const existing = map.get(s.id)
    if (!existing) {
      map.set(s.id, { ...s })
    } else {
      map.set(s.id, {
        id: s.id,
        quantity: (existing.quantity ?? 1) + (s.quantity ?? 1),
        manualPrice: existing.manualPrice ?? s.manualPrice,
      })
    }
  }
  return Array.from(map.values())
}

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
  /** Deadhead (נסיעת סרק): return-leg toggle + last dropoff → base distance. */
  chargeDeadheadReturn?: boolean
  dropoffToBaseDistance?: DistanceResult | null
  
  // תוספות
  activeTimeSurcharges: TimeSurcharge[]
  selectedLocationSurcharges: string[]
  locationSurchargesData: LocationSurcharge[]
  selectedServices: SelectedService[]
  /** Whole-tow catalog selections (exchange/custom), priced/displayed on top of per-leg/per-point. */
  towServiceSurcharges?: SelectedService[]
  manualSurcharges?: ManualSurcharge[]
  serviceSurchargesData: ServiceSurcharge[]
  
  // לקוח
  selectedCustomerPricing: CustomerWithPricing | null
  
  // מצב מחיר
  priceMode: 'recommended' | 'recommended_customer' | 'fixed' | 'customer' | 'custom'
  selectedPriceItem: PriceItem | null
  customPrice: string
  
  // פעולות
  finalPrice: number
  onSave: () => void
  saving: boolean
  
  // מסלול מותאם אישית
  towType?: string
  customRouteVehicleCount?: number
  customRouteData?: {
    totalDistanceKm: number
    vehicles: { type: string; isWorking: boolean }[]
    services?: SelectedService[]
  }
  vatPercent?: number
  towDate?: string
  towTime?: string
  isHoliday?: boolean
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
  chargeDeadheadReturn = false,
  dropoffToBaseDistance = null,
  activeTimeSurcharges,
  selectedLocationSurcharges,
  locationSurchargesData,
  selectedServices,
  towServiceSurcharges = [],
  manualSurcharges = [],
  serviceSurchargesData,
  selectedCustomerPricing,
  priceMode,
  selectedPriceItem,
  customPrice,
  finalPrice,
  onSave,
  saving,
  towType,
  customRouteVehicleCount = 0,
  customRouteData,
  vatPercent = 0.18,
  towDate = '',
  towTime = '',
  isHoliday = false
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

  const activePriceList: any =
    priceMode === 'recommended_customer'
      ? mergePriceLists(basePriceList, selectedCustomerPricing?.price_list ?? null)
      : basePriceList

  const hasDataForCalculation = isCustomRoute
    ? (customRouteData
        ? (customRouteData.vehicles.length > 0 && (customRouteData.totalDistanceKm ?? 0) > 0)
        : (customRouteVehicleCount > 0 && (distance?.distanceKm ?? 0) > 0))
    : hasVehicleType

  const effectiveVatPercent = vatPercent ?? 0.18

  let priceResult: ReturnType<typeof calculateTowPrice> | null = null
  if ((priceMode === 'recommended' || priceMode === 'recommended_customer') && hasDataForCalculation) {
    const baseToPickupKm = (!isCustomRoute && startFromBase && baseToPickupDistance?.distanceKm) || 0
    const distanceKm = (distance?.distanceKm ?? 0) + baseToPickupKm
    // Deadhead (נסיעת סרק): last dropoff → base, priced separately. Custom skipped.
    const deadheadKm = (!isCustomRoute && chargeDeadheadReturn && dropoffToBaseDistance?.distanceKm) || 0
    const deadheadRate = resolveDeadheadRate(activePriceList)
    const basePrices = extractBasePrices(activePriceList)
    let basePriceOverride: number | undefined
    let calcVehicleType: VehicleType = (vehicleType as VehicleType) || 'private'
    if (isCustomRoute && customRouteData) {
      let totalBase = 0
      customRouteData.vehicles.forEach(v => {
        const vt = (v.type as VehicleType) || 'private'
        totalBase += basePrices[vt] ?? basePrices.private
      })
      basePriceOverride = totalBase
      calcVehicleType = 'private'
    } else if (isCustomRoute) {
      const basePerVehicle = basePrices.private
      basePriceOverride = basePerVehicle * customRouteVehicleCount
      calcVehicleType = 'private'
    }
    const locationSurcharges = selectedLocationSurcharges
      .map(id => locationSurchargesData.find(l => l.id === id))
      .filter(Boolean)
      .map(s => ({
        percent: s!.surcharge_percent,
        label: s!.label,
        id: s!.id,
      }))
    const routeServicesForPrice =
      isCustomRoute && customRouteData
        ? aggregateRouteServices(customRouteData.services ?? [])
        : selectedServices
    const serviceSurcharges = [
      ...[...routeServicesForPrice, ...towServiceSurcharges].map(selected => {
        const s = serviceSurchargesData.find(x => x.id === selected.id)
        if (!s) return { amount: 0 }
        const vatExempt = s.is_vat_exempt === true
        if (s.price_type === 'manual') {
          return {
            amount: selected.manualPrice || 0,
            label: s.label,
            ...(vatExempt ? { vatExempt: true as const } : {}),
          }
        }
        if (s.price_type === 'per_unit') {
          return {
            amount: s.price * (selected.quantity || 1),
            label: `${s.label} (×${selected.quantity || 1})`,
            ...(vatExempt ? { vatExempt: true as const } : {}),
          }
        }
        return {
          amount: s.price,
          label: s.label,
          ...(vatExempt ? { vatExempt: true as const } : {}),
        }
      }).filter(x => x.amount > 0),
      ...manualSurchargesToCalcInput(manualSurcharges),
    ]

    priceResult = calculateTowPrice({
      priceList: {
        base_prices: basePrices,
        price_per_km: activePriceList?.price_per_km ?? 12,
        minimum_price: activePriceList?.minimum_price ?? 250
      },
      vehicleType: calcVehicleType,
      distanceKm,
      deadheadKm,
      deadheadRate,
      ...(basePriceOverride !== undefined ? { basePriceOverride } : {}),
      timeSurcharges: activeTimeSurcharges,
      towDate,
      towTime,
      isHoliday,
      activeTimeSurchargeIds: activeTimeSurcharges.map(s => s.id),
      locationSurcharges,
      serviceSurcharges,
      priceMode: 'recommended',
      discountPercent: customerDiscountForPriceMode(
        priceMode,
        selectedCustomerPricing?.discount_percent,
      ),
      vatPercent: effectiveVatPercent
    })
  }

  const total = priceResult?.total ?? 0

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="space-y-2 text-sm">
        {(priceMode === 'recommended' || priceMode === 'recommended_customer') && (
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
                {priceResult?.breakdown
                  .filter((item) => item.amount !== 0 || item.bold)
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex justify-between ${
                        item.bold
                          ? 'font-bold text-gray-800 border-t border-gray-100 pt-2'
                          : item.type === 'discount'
                            ? 'text-emerald-600'
                            : item.type === 'vat_exempt'
                              ? 'text-slate-600'
                              : item.type === 'time' || item.type === 'location'
                                ? 'text-orange-600'
                                : item.type === 'service'
                                  ? 'text-blue-600'
                                  : 'text-gray-700'
                      }`}
                    >
                      <span className={item.bold ? undefined : 'text-gray-500'}>{item.label}</span>
                      <span>₪{item.amount.toFixed(2)}</span>
                    </div>
                  ))}
                {!isCustomRoute && startFromBase && baseToPickupDistance?.distanceKm ? (
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>
                      מתוכם יציאה מהחניון ({baseToPickupDistance.distanceKm.toFixed(1)} ק״מ)
                    </span>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}

        {priceMode === 'fixed' && selectedPriceItem && (
          <div className="flex justify-between">
            <span className="text-gray-500">{selectedPriceItem.label}</span>
            <span className="text-gray-700">₪{selectedPriceItem.price.toFixed(2)}</span>
          </div>
        )}

        {priceMode === 'customer' && selectedPriceItem && (
          <div className="flex justify-between">
            <span className="text-gray-500">{selectedPriceItem.label}</span>
            <span className="text-gray-700">₪{selectedPriceItem.price.toFixed(2)}</span>
          </div>
        )}

        {priceMode === 'custom' && customPrice && (
          <div className="flex justify-between">
            <span className="text-gray-500">מחיר ידני</span>
            <span className="text-gray-700">₪{Number(customPrice).toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 pt-3">
        <div className="flex justify-between items-center">
          <span className="font-bold text-gray-800">סה״כ כולל מע״מ</span>
          <span className={`font-bold text-gray-800 ${isMobile ? 'text-xl' : 'text-2xl'}`}>
            ₪{((priceMode === 'recommended' || priceMode === 'recommended_customer') ? (hasDataForCalculation ? total : 0) : finalPrice).toFixed(2)}
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

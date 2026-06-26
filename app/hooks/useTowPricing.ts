import { useEffect, useMemo } from 'react'
import { DistanceResult, PriceItem } from '../components/tow-forms/sections'
import { 
  CustomerWithPricing, 
  TimeSurcharge, 
  LocationSurcharge, 
  ServiceSurcharge, 
  getActiveTimeSurcharges,
  getCustomerPricingByCustomerId,
} from '../lib/queries/price-lists'
import { SelectedService } from '../components/tow-forms/shared'
import { manualSurchargesToCalcInput } from '../lib/utils/manual-surcharge'
import type { ManualSurcharge } from '../lib/utils/manual-surcharge'
import { TowType } from '../components/tow-forms/sections'
import { VehicleType } from '../lib/types'
import { calculateTowPrice, extractBasePrices, mergePriceLists, priceListForTowCalc, TowPriceResult } from '../lib/utils/price-calculator'

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

interface UseTowPricingParams {
  towType: TowType
  vehicleType: VehicleType | ''
  basePriceOverride?: number
  distance: DistanceResult | null
  startFromBase: boolean
  baseToPickupDistance: DistanceResult | null
  basePriceList: any
  activeTimeSurchargesList: TimeSurcharge[]
  selectedLocationSurcharges: string[]
  locationSurchargesData: LocationSurcharge[]
  selectedServices: SelectedService[]
  /** Whole-tow catalog selections (exchange/custom), priced on top of per-leg/per-point ones. */
  towServiceSurcharges?: SelectedService[]
  manualSurcharges?: ManualSurcharge[]
  serviceSurchargesData: ServiceSurcharge[]
  selectedCustomerPricing: CustomerWithPricing | null
  customRouteData: {
    totalDistanceKm: number
    vehicles: { type: string; isWorking: boolean }[]
    services: SelectedService[]
  }
  priceMode: 'recommended' | 'recommended_customer' | 'fixed' | 'customer' | 'custom'
  selectedPriceItem: PriceItem | null
  customPrice: string
  // For effects
  companyId: string | null
  selectedCustomerId: string | null
  setSelectedCustomerPricing: (v: CustomerWithPricing | null) => void
  setPriceMode: (mode: 'recommended' | 'recommended_customer' | 'fixed' | 'customer' | 'custom') => void
  setSelectedPriceItem: (item: PriceItem | null) => void
  setCustomPrice: (price: string) => void
  towDate: string
  towTime: string
  timeSurchargesData: TimeSurcharge[]
  isHoliday: boolean
  setActiveTimeSurchargesList: (list: TimeSurcharge[]) => void
  isEditMode?: boolean
  customPriceIncludesVat?: boolean
  vatPercent?: number
  setLocationSurchargesData?: (data: LocationSurcharge[]) => void
  setServiceSurchargesData?: (data: ServiceSurcharge[]) => void
  setSelectedLocationSurcharges?: (ids: string[]) => void
  setSelectedServices?: (services: SelectedService[]) => void
  companyLocationSurchargesData?: LocationSurcharge[]
  companyServiceSurchargesData?: ServiceSurcharge[]
  hasManualTimeSurchargeOverride?: boolean
  setHasManualTimeSurchargeOverride?: (v: boolean) => void
  manualAdjustmentPercent?: string
  manualAdjustmentType?: 'discount' | 'markup'
}

/** Map catalog selections to flat ₪ calc inputs (uniform with service surcharges), dropping ₪0 lines. */
function servicesToCalcInput(
  services: SelectedService[],
  serviceSurchargesData: ServiceSurcharge[],
): { amount: number; label?: string }[] {
  return services
    .map((selected) => {
      const surcharge = serviceSurchargesData.find((s) => s.id === selected.id)
      if (!surcharge) return { amount: 0 }
      if (surcharge.price_type === 'manual') return { amount: selected.manualPrice || 0, label: surcharge.label }
      if (surcharge.price_type === 'per_unit') {
        const qty = selected.quantity || 1
        return { amount: surcharge.price * qty, label: `${surcharge.label} (×${qty})` }
      }
      return { amount: surcharge.price, label: surcharge.label }
    })
    .filter((s) => s.amount > 0)
}

export function useTowPricing(params: UseTowPricingParams) {
  const {
    towType,
    vehicleType,
    basePriceOverride,
    distance,
    startFromBase,
    baseToPickupDistance,
    basePriceList,
    activeTimeSurchargesList,
    selectedLocationSurcharges,
    locationSurchargesData,
    selectedServices,
    towServiceSurcharges = [],
    manualSurcharges = [],
    serviceSurchargesData,
    selectedCustomerPricing,
    customRouteData,
    priceMode,
    selectedPriceItem,
    customPrice,
    selectedCustomerId,
    companyId,
    setSelectedCustomerPricing,
    setPriceMode,
    setSelectedPriceItem,
    setCustomPrice,
    towDate,
    towTime,
    timeSurchargesData,
    isHoliday,
    setActiveTimeSurchargesList,
    isEditMode,
    customPriceIncludesVat = true,
    vatPercent = 0.18,
    setLocationSurchargesData,
    setServiceSurchargesData,
    setSelectedLocationSurcharges,
    setSelectedServices,
    companyLocationSurchargesData,
    companyServiceSurchargesData,
    hasManualTimeSurchargeOverride = false,
    setHasManualTimeSurchargeOverride,
    manualAdjustmentPercent = '',
    manualAdjustmentType = 'discount',
  } = params

  const adjPercent = parseFloat(manualAdjustmentPercent) || 0
  const effectiveManualAdj = manualAdjustmentType === 'discount' ? -adjPercent : adjPercent

  const effectiveTimeSurcharges = useMemo((): TimeSurcharge[] => {
    return priceMode === 'recommended_customer' &&
      (selectedCustomerPricing?.customer_time_surcharges?.length ?? 0) > 0
        ? selectedCustomerPricing!.customer_time_surcharges!
        : timeSurchargesData
  }, [priceMode, selectedCustomerPricing?.customer_time_surcharges, timeSurchargesData])

  // Customer pricing — load only the selected customer (not all customers)
  useEffect(() => {
    if (!selectedCustomerId) {
      setSelectedCustomerPricing(null)
      if (!isEditMode) {
        setPriceMode('recommended')
        setSelectedPriceItem(null)
        setCustomPrice('')
      }
      return
    }

    let cancelled = false

    ;(async () => {
      if (!companyId) return
      try {
        const customerPricing = await getCustomerPricingByCustomerId(companyId, selectedCustomerId)
        if (cancelled) return

        setSelectedCustomerPricing(customerPricing)

        if (!isEditMode) {
          const isBusinessCustomer = customerPricing?.customer?.customer_type === 'business'
          const nextMode =
            selectedCustomerId && isBusinessCustomer ? 'recommended_customer' : 'recommended'
          setPriceMode(nextMode)
          setSelectedPriceItem(null)
          setCustomPrice('')
        }
      } catch (err) {
        console.error('Error loading customer pricing:', err)
        if (!cancelled) {
          setSelectedCustomerPricing(null)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedCustomerId, companyId, isEditMode])

  // החלפת תוספות כשמשתנה priceMode
  useEffect(() => {
    if (priceMode === 'recommended_customer' && selectedCustomerPricing?.price_list) {
      const customerTime = selectedCustomerPricing.customer_time_surcharges || []
      const activeCustomerTime = getActiveTimeSurcharges(customerTime, towTime, towDate, isHoliday)
      setActiveTimeSurchargesList(activeCustomerTime)
      if (setHasManualTimeSurchargeOverride) setHasManualTimeSurchargeOverride(false)
      if (setLocationSurchargesData) setLocationSurchargesData(selectedCustomerPricing.customer_location_surcharges || [])
      if (setServiceSurchargesData) setServiceSurchargesData(selectedCustomerPricing.customer_service_surcharges || [])
      if (!isEditMode) {
        if (setSelectedLocationSurcharges) setSelectedLocationSurcharges([])
        if (setSelectedServices) setSelectedServices([])
      }
    } else if (priceMode === 'recommended') {
      setActiveTimeSurchargesList(getActiveTimeSurcharges(timeSurchargesData, towTime, towDate, isHoliday))
      if (setHasManualTimeSurchargeOverride) setHasManualTimeSurchargeOverride(false)
      if (setLocationSurchargesData) setLocationSurchargesData(companyLocationSurchargesData || [])
      if (setServiceSurchargesData) setServiceSurchargesData(companyServiceSurchargesData || [])
      if (!isEditMode) {
        if (setSelectedLocationSurcharges) setSelectedLocationSurcharges([])
        if (setSelectedServices) setSelectedServices([])
      }
    }
  }, [priceMode, selectedCustomerPricing, isEditMode])

  // Time surcharges calculation
  useEffect(() => {
    if (!towDate || !towTime) {
      setActiveTimeSurchargesList([])
      if (setHasManualTimeSurchargeOverride) setHasManualTimeSurchargeOverride(false)
      return
    }
    if (effectiveTimeSurcharges.length === 0) {
      setActiveTimeSurchargesList([])
      if (setHasManualTimeSurchargeOverride) setHasManualTimeSurchargeOverride(false)
      return
    }
    const activeSurcharges = getActiveTimeSurcharges(effectiveTimeSurcharges, towTime, towDate, isHoliday)
    setActiveTimeSurchargesList(activeSurcharges)
    if (setHasManualTimeSurchargeOverride) setHasManualTimeSurchargeOverride(false)
  }, [towDate, towTime, effectiveTimeSurcharges, isHoliday, priceMode, selectedCustomerPricing])

  const activeTimeSurchargeIds = activeTimeSurchargesList.map((s) => s.id).join(',')
  const selectedLocationKey = selectedLocationSurcharges.join(',')
  const selectedServicesKey = JSON.stringify(selectedServices)
  const towServiceSurchargesKey = JSON.stringify(towServiceSurcharges)
  const manualSurchargesKey = JSON.stringify(manualSurcharges)
  const customRouteVehiclesKey = JSON.stringify(customRouteData.vehicles)
  const customRouteServicesKey = JSON.stringify(customRouteData.services)

  const recommendedResult = useMemo((): TowPriceResult | null => {
    const activePriceList =
      priceMode === 'recommended_customer'
        ? mergePriceLists(basePriceList, selectedCustomerPricing?.price_list ?? null)
        : basePriceList

    if (towType === 'custom') {
      // Custom multi-vehicle routes use global price_per_km only (per-type km does not apply).
      if (customRouteData.vehicles.length === 0 || customRouteData.totalDistanceKm === 0) return null
      const basePrices = extractBasePrices(activePriceList)
      let totalBasePrice = 0
      customRouteData.vehicles.forEach(v => {
        const vt = (v.type as VehicleType) || 'private'
        totalBasePrice += basePrices[vt] ?? basePrices.private
      })
      const locSurcharges = selectedLocationSurcharges
        .map(id => locationSurchargesData.find(l => l.id === id))
        .filter(Boolean)
        .map(s => ({ percent: s!.surcharge_percent }))
      const routeServices = aggregateRouteServices(customRouteData.services)
      const svcSurcharges = [
        ...routeServices
          .map((selected) => {
            const s = serviceSurchargesData.find((x) => x.id === selected.id)
            if (!s) return { amount: 0 }
            if (s.price_type === 'manual') return { amount: selected.manualPrice || 0, label: s.label }
            if (s.price_type === 'per_unit') {
              const qty = selected.quantity || 1
              return { amount: s.price * qty, label: `${s.label} (×${qty})` }
            }
            return { amount: s.price, label: s.label }
          })
          .filter((x) => x.amount > 0),
        ...servicesToCalcInput(towServiceSurcharges, serviceSurchargesData),
        ...manualSurchargesToCalcInput(manualSurcharges),
      ]

      const result = calculateTowPrice({
        priceList: priceListForTowCalc(activePriceList, { globalKmOnly: true }),
        vehicleType: 'private',
        distanceKm: customRouteData.totalDistanceKm,
        basePriceOverride: totalBasePrice,
        timeSurcharges: effectiveTimeSurcharges,
        towDate: towDate || '',
        towTime: towTime || '',
        isHoliday: isHoliday ?? false,
        activeTimeSurchargeIds: activeTimeSurchargesList.map(s => s.id),
        hasManualTimeSurchargeOverride,
        locationSurcharges: locSurcharges,
        serviceSurcharges: svcSurcharges,
        priceMode: 'recommended',
        discountPercent: selectedCustomerPricing?.discount_percent ?? 0,
        manualAdjustmentPercent: effectiveManualAdj,
        vatPercent: vatPercent
      })
      return result
    }

    if (!vehicleType) return null
    const pickupToDropoffKm = distance?.distanceKm || 0
    const baseToPickupKm = (startFromBase && baseToPickupDistance?.distanceKm) || 0
    const distanceKm = pickupToDropoffKm + baseToPickupKm

    const locationSurcharges = selectedLocationSurcharges
      .map(id => locationSurchargesData.find(l => l.id === id))
      .filter(Boolean)
      .map(s => ({ percent: s!.surcharge_percent }))

    const serviceSurcharges = [
      ...selectedServices.map(selected => {
        const surcharge = serviceSurchargesData.find(s => s.id === selected.id)
        if (!surcharge) return { amount: 0 }
        if (surcharge.price_type === 'manual') return { amount: selected.manualPrice || 0, label: surcharge.label }
        if (surcharge.price_type === 'per_unit') {
          const qty = selected.quantity || 1
          return { amount: surcharge.price * qty, label: `${surcharge.label} (×${qty})` }
        }
        return { amount: surcharge.price, label: surcharge.label }
      }).filter(s => s.amount > 0),
      ...servicesToCalcInput(towServiceSurcharges, serviceSurchargesData),
      ...manualSurchargesToCalcInput(manualSurcharges),
    ]

    const result = calculateTowPrice({
      priceList: priceListForTowCalc(activePriceList),
      vehicleType: vehicleType as VehicleType,
      ...(basePriceOverride !== undefined ? { basePriceOverride } : {}),
      distanceKm,
      timeSurcharges: effectiveTimeSurcharges,
      towDate: towDate || '',
      towTime: towTime || '',
      isHoliday: isHoliday ?? false,
      activeTimeSurchargeIds: activeTimeSurchargesList.map(s => s.id),
      hasManualTimeSurchargeOverride,
      locationSurcharges,
      serviceSurcharges,
      priceMode: 'recommended',
      discountPercent: selectedCustomerPricing?.discount_percent ?? 0,
      manualAdjustmentPercent: effectiveManualAdj,
      vatPercent: vatPercent,
    })
    return result
  }, [
    towType,
    vehicleType,
    basePriceOverride,
    distance?.distanceKm,
    distance?.durationMinutes,
    startFromBase,
    baseToPickupDistance?.distanceKm,
    basePriceList,
    activeTimeSurchargeIds,
    hasManualTimeSurchargeOverride,
    selectedLocationKey,
    locationSurchargesData,
    selectedServicesKey,
    towServiceSurchargesKey,
    manualSurchargesKey,
    serviceSurchargesData,
    selectedCustomerPricing,
    customRouteData.totalDistanceKm,
    customRouteVehiclesKey,
    customRouteServicesKey,
    priceMode,
    towDate,
    towTime,
    effectiveTimeSurcharges,
    isHoliday,
    effectiveManualAdj,
    vatPercent,
  ])

  const finalResult = useMemo((): TowPriceResult | null => {
    const activePriceList =
      priceMode === 'recommended_customer'
        ? mergePriceLists(basePriceList, selectedCustomerPricing?.price_list ?? null)
        : basePriceList

    if (priceMode === 'custom' && customPrice) {
      const price = parseFloat(customPrice)
      const result = calculateTowPrice({
        priceList: {
          base_prices: extractBasePrices(activePriceList),
          price_per_km: 12,
          minimum_price: 250
        },
        vehicleType: 'private',
        distanceKm: 0,
        timeSurcharges: [],
        towDate: '',
        towTime: '',
        isHoliday: false,
        locationSurcharges: [],
        serviceSurcharges: [],
        priceMode: 'custom',
        customPrice: price,
        customPriceIncludesVat: customPriceIncludesVat,
        discountPercent: 0,
        vatPercent: vatPercent
      })
      return result
    }
    if ((priceMode === 'fixed' || priceMode === 'customer') && selectedPriceItem) {
      const result = calculateTowPrice({
        priceList: {
          base_prices: extractBasePrices(activePriceList),
          price_per_km: activePriceList?.price_per_km ?? 0,
          minimum_price: activePriceList?.minimum_price ?? 0
        },
        vehicleType: 'private',
        distanceKm: 0,
        timeSurcharges: [],
        towDate: '',
        towTime: '',
        isHoliday: false,
        locationSurcharges: [],
        serviceSurcharges: [],
        priceMode: priceMode === 'fixed' ? 'fixed' : 'customer',
        fixedPrice: selectedPriceItem.price,
        discountPercent: (priceMode === 'fixed' && selectedCustomerPricing?.discount_percent) ? selectedCustomerPricing.discount_percent : 0,
        vatPercent: vatPercent
      })
      return result
    }
    return recommendedResult
  }, [
    priceMode,
    customPrice,
    customPriceIncludesVat,
    selectedPriceItem?.id,
    selectedPriceItem?.price,
    selectedCustomerPricing?.discount_percent,
    basePriceList,
    vatPercent,
    recommendedResult,
  ])

  return {
    recommendedPrice: recommendedResult?.total ?? 0,
    finalPrice: finalResult?.total ?? 0,
    priceResult: finalResult,
  }
}

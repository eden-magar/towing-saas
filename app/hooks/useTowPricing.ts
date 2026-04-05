import { useEffect } from 'react'
import { DistanceResult, PriceItem } from '../components/tow-forms/sections'
import { 
  CustomerWithPricing, 
  TimeSurcharge, 
  LocationSurcharge, 
  ServiceSurcharge, 
  getActiveTimeSurcharges 
} from '../lib/queries/price-lists'
import { SelectedService } from '../components/tow-forms/shared'
import { TowType } from '../components/tow-forms/sections'
import { VehicleType } from '../lib/types'
import { calculateTowPrice, extractBasePrices, TowPriceResult } from '../lib/utils/price-calculator'

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
  selectedCustomerId: string | null
  customersWithPricing: CustomerWithPricing[]
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
    serviceSurchargesData,
    selectedCustomerPricing,
    customRouteData,
    priceMode,
    selectedPriceItem,
    customPrice,
    selectedCustomerId,
    customersWithPricing,
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

  // Customer pricing
  useEffect(() => {
    if (selectedCustomerId) {
      const customerPricing = customersWithPricing.find(c => c.customer_id === selectedCustomerId)
      setSelectedCustomerPricing(customerPricing || null)
    } else {
      setSelectedCustomerPricing(null)
    }
    if (!isEditMode) {
      setPriceMode('recommended')
      setSelectedPriceItem(null)
      setCustomPrice('')
    }
  }, [selectedCustomerId, customersWithPricing])

  // החלפת תוספות כשמשתנה priceMode
  useEffect(() => {
    if (priceMode === 'recommended_customer' && selectedCustomerPricing?.price_list) {
      const customerTime = selectedCustomerPricing.customer_time_surcharges || []
      const activeCustomerTime = getActiveTimeSurcharges(customerTime, towTime, towDate, isHoliday)
      setActiveTimeSurchargesList(activeCustomerTime)
      if (setHasManualTimeSurchargeOverride) setHasManualTimeSurchargeOverride(false)
      if (setLocationSurchargesData) setLocationSurchargesData(selectedCustomerPricing.customer_location_surcharges || [])
      if (setServiceSurchargesData) setServiceSurchargesData(selectedCustomerPricing.customer_service_surcharges || [])
      if (setSelectedLocationSurcharges) setSelectedLocationSurcharges([])
      if (setSelectedServices) setSelectedServices([])
    } else if (priceMode === 'recommended') {
      setActiveTimeSurchargesList(getActiveTimeSurcharges(timeSurchargesData, towTime, towDate, isHoliday))
      if (setHasManualTimeSurchargeOverride) setHasManualTimeSurchargeOverride(false)
      if (setLocationSurchargesData) setLocationSurchargesData(companyLocationSurchargesData || [])
      if (setServiceSurchargesData) setServiceSurchargesData(companyServiceSurchargesData || [])
      if (setSelectedLocationSurcharges) setSelectedLocationSurcharges([])
      if (setSelectedServices) setSelectedServices([])
    }
  }, [priceMode, selectedCustomerPricing])

  // Time surcharges calculation
  useEffect(() => {
    if (!towDate || !towTime || timeSurchargesData.length === 0) {
      setActiveTimeSurchargesList([])
      if (setHasManualTimeSurchargeOverride) setHasManualTimeSurchargeOverride(false)
      return
    }
    const activeSurcharges = getActiveTimeSurcharges(timeSurchargesData, towTime, towDate, isHoliday)
    setActiveTimeSurchargesList(activeSurcharges)
    if (setHasManualTimeSurchargeOverride) setHasManualTimeSurchargeOverride(false)
  }, [towDate, towTime, timeSurchargesData, isHoliday])

  const calculateRecommendedPrice = (): TowPriceResult | null => {
    const activePriceList = (priceMode === 'recommended_customer' && selectedCustomerPricing?.price_list)
      ? selectedCustomerPricing.price_list
      : basePriceList

    if (towType === 'custom') {
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
      const svcSurcharges = routeServices
        .map((selected) => {
          const s = serviceSurchargesData.find((x) => x.id === selected.id)
          if (!s) return { amount: 0 }
          if (s.price_type === 'manual') return { amount: selected.manualPrice || 0 }
          if (s.price_type === 'per_unit') return { amount: s.price * (selected.quantity || 1) }
          return { amount: s.price }
        })
        .filter((x) => x.amount > 0)

      const result = calculateTowPrice({
        priceList: {
          base_prices: extractBasePrices(activePriceList),
          price_per_km: activePriceList?.price_per_km ?? 12,
          minimum_price: activePriceList?.minimum_price ?? 250
        },
        vehicleType: 'private',
        distanceKm: customRouteData.totalDistanceKm,
        basePriceOverride: totalBasePrice,
        timeSurcharges: timeSurchargesData,
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

    console.log('DEBUG location:', {
      selectedLocationSurcharges,
      locationSurchargesData: locationSurchargesData.map(l => ({ id: l.id, label: l.label, percent: l.surcharge_percent })),
      result: locationSurcharges
    })

    const serviceSurcharges = selectedServices.map(selected => {
      const surcharge = serviceSurchargesData.find(s => s.id === selected.id)
      if (!surcharge) return { amount: 0 }
      if (surcharge.price_type === 'manual') return { amount: selected.manualPrice || 0 }
      if (surcharge.price_type === 'per_unit') return { amount: surcharge.price * (selected.quantity || 1) }
      return { amount: surcharge.price }
    }).filter(s => s.amount > 0)

    const result = calculateTowPrice({
      priceList: {
        base_prices: extractBasePrices(activePriceList),
        price_per_km: activePriceList?.price_per_km ?? 12,
        minimum_price: activePriceList?.minimum_price ?? 250
      },
      vehicleType: vehicleType as VehicleType,
      ...(basePriceOverride !== undefined ? { basePriceOverride } : {}),
      distanceKm,
      timeSurcharges: timeSurchargesData,
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
  }

  const calculateFinalPrice = (): TowPriceResult | null => {
    const activePriceList = (priceMode === 'recommended_customer' && selectedCustomerPricing?.price_list)
      ? selectedCustomerPricing.price_list
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
    return calculateRecommendedPrice()
  }

  const recommendedResult = calculateRecommendedPrice()
  const finalResult = calculateFinalPrice()

  return {
    recommendedPrice: recommendedResult?.total ?? 0,
    finalPrice: finalResult?.total ?? 0,
    priceResult: finalResult,
  }
}

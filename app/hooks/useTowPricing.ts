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

interface UseTowPricingParams {
  towType: TowType
  vehicleType: VehicleType | ''
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
  customRouteData: { totalDistanceKm: number; vehicles: { type: string; isWorking: boolean }[] }
  priceMode: 'recommended' | 'fixed' | 'customer' | 'custom'
  selectedPriceItem: PriceItem | null
  customPrice: string
  // For effects
  selectedCustomerId: string | null
  customersWithPricing: CustomerWithPricing[]
  setSelectedCustomerPricing: (v: CustomerWithPricing | null) => void
  setPriceMode: (mode: 'recommended' | 'fixed' | 'customer' | 'custom') => void
  setSelectedPriceItem: (item: PriceItem | null) => void
  setCustomPrice: (price: string) => void
  towDate: string
  towTime: string
  timeSurchargesData: TimeSurcharge[]
  isHoliday: boolean
  setActiveTimeSurchargesList: (list: TimeSurcharge[]) => void
  isEditMode?: boolean
}

export function useTowPricing(params: UseTowPricingParams) {
  const {
    towType,
    vehicleType,
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
  } = params

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

  // Time surcharges calculation
  useEffect(() => {
    if (!towDate || !towTime || timeSurchargesData.length === 0) {
      setActiveTimeSurchargesList([])
      return
    }
    const activeSurcharges = getActiveTimeSurcharges(timeSurchargesData, towTime, towDate, isHoliday)
    setActiveTimeSurchargesList(activeSurcharges)
  }, [towDate, towTime, timeSurchargesData, isHoliday])

  const calculateRecommendedPrice = () => {
    // For custom routes
    if (towType === 'custom') {
      if (customRouteData.vehicles.length === 0 || customRouteData.totalDistanceKm === 0) {
        return 0
      }
      
      const pricePerKm = basePriceList?.price_per_km || 12
      const minimumPrice = basePriceList?.minimum_price || 250
      
      // Calculate base price for all vehicles
      let totalBasePrice = 0
      customRouteData.vehicles.forEach(v => {
        const vehicleTypeMap: Record<string, string> = {
          'private': 'base_price_private',
          'motorcycle': 'base_price_motorcycle',
          'heavy': 'base_price_heavy',
          'machinery': 'base_price_machinery'
        }
        const priceField = vehicleTypeMap[v.type] || 'base_price_private'
        totalBasePrice += basePriceList?.[priceField] || 180
      })
      
      // Distance price
      const distancePrice = customRouteData.totalDistanceKm * pricePerKm
      
      let subtotal = totalBasePrice + distancePrice
      
      // Time surcharges
      let timePercent = 0
      if (activeTimeSurchargesList.length > 0) {
        timePercent = Math.max(...activeTimeSurchargesList.map(s => s.surcharge_percent))
      }
      const timeAddition = subtotal * (timePercent / 100)
      
      // Customer discount
      const beforeDiscount = subtotal + timeAddition
      let afterDiscount = beforeDiscount
      if (selectedCustomerPricing?.discount_percent) {
        afterDiscount = beforeDiscount * (1 - selectedCustomerPricing.discount_percent / 100)
      }
      
      // VAT
      const vat = afterDiscount * 0.18
      const total = afterDiscount + vat
      
      return Math.max(Math.round(total), minimumPrice)
    }
    
    // For single tow
    if (!vehicleType) return 0
    
    const vehicleTypeMap: Record<string, string> = {
      'private': 'base_price_private',
      'motorcycle': 'base_price_motorcycle',
      'heavy': 'base_price_heavy',
      'machinery': 'base_price_machinery'
    }
    
    const priceField = vehicleTypeMap[vehicleType]
    const basePrice = basePriceList?.[priceField] || 0
    const pricePerKm = basePriceList?.price_per_km || 0
    const minimumPrice = basePriceList?.minimum_price || 0
    
    const pickupToDropoffKm = distance?.distanceKm || 0
    const baseToPickupKm = (startFromBase && baseToPickupDistance?.distanceKm) || 0
    const distanceKm = pickupToDropoffKm + baseToPickupKm
    const distancePrice = distanceKm * pricePerKm
    
    let subtotal = basePrice + distancePrice
    
    let timePercent = 0
    if (activeTimeSurchargesList.length > 0) {
      timePercent = Math.max(...activeTimeSurchargesList.map(s => s.surcharge_percent))
    }
    const timeAddition = subtotal * (timePercent / 100)
    
    let locationPercent = 0
    selectedLocationSurcharges.forEach(id => {
      const surcharge = locationSurchargesData.find(l => l.id === id)
      if (surcharge) locationPercent += surcharge.surcharge_percent
    })
    const locationAddition = subtotal * (locationPercent / 100)
    
    let servicesTotal = 0
    selectedServices.forEach(selected => {
      const surcharge = serviceSurchargesData.find(s => s.id === selected.id)
      if (surcharge) {
        if (surcharge.price_type === 'manual') {
          servicesTotal += selected.manualPrice || 0
        } else if (surcharge.price_type === 'per_unit') {
          servicesTotal += surcharge.price * (selected.quantity || 1)
        } else {
          servicesTotal += surcharge.price
        }
      }
    })
    
    const beforeDiscount = subtotal + timeAddition + locationAddition + servicesTotal
    
    let afterDiscount = beforeDiscount
    if (selectedCustomerPricing?.discount_percent) {
      afterDiscount = beforeDiscount * (1 - selectedCustomerPricing.discount_percent / 100)
    }
    
    const vat = afterDiscount * 0.18
    const total = afterDiscount + vat
    
    if (total > 0 && total < minimumPrice) return minimumPrice
    return Math.round(total)
  }

  const calculateFinalPrice = () => {
    if (priceMode === 'custom' && customPrice) return parseFloat(customPrice)
    if ((priceMode === 'fixed' || priceMode === 'customer') && selectedPriceItem) {
      let price = selectedPriceItem.price
      if (priceMode === 'fixed' && selectedCustomerPricing?.discount_percent) {
        price = price * (1 - selectedCustomerPricing.discount_percent / 100)
      }
      return Math.round(price)
    }
    return calculateRecommendedPrice()
  }

  const recommendedPrice = calculateRecommendedPrice()
  const finalPrice = calculateFinalPrice()

  return { recommendedPrice, finalPrice }
}

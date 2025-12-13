'use client'

/// <reference types="google.maps" />
declare global {
  interface Window {
    google: typeof google
  }
}

import { useState, useEffect, useRef, Suspense } from 'react'
import { ArrowRight, Check, Truck, Loader2, MapPin, Navigation, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../../../lib/AuthContext'
import { createTow } from '../../../lib/queries/tows'
import { getCustomers, CustomerWithDetails } from '../../../lib/queries/customers'
import { getDrivers } from '../../../lib/queries/drivers'
import { getTrucks } from '../../../lib/queries/trucks'
import { 
  getBasePriceList, 
  getCustomersWithPricing, 
  getFixedPriceItems, 
  getTimeSurcharges, 
  getLocationSurcharges, 
  getServiceSurcharges, 
  CustomerWithPricing, 
  FixedPriceItem, 
  TimeSurcharge, 
  LocationSurcharge, 
  ServiceSurcharge, 
  getActiveTimeSurcharges 
} from '../../../lib/queries/price-lists'
import { DriverWithDetails, TruckWithDetails, VehicleType, VehicleLookupResult } from '../../../lib/types'

// Import form components
import { CustomerSection, TowTypeSelector, TowType, PaymentSection, PriceSummary } from '../../../components/tow-forms/sections'
import { SingleRoute } from '../../../components/tow-forms/routes'

// ==================== Types ====================
interface AddressData {
  address: string
  placeId?: string
  lat?: number
  lng?: number
  isPinDropped?: boolean
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

// ==================== Google Maps Loading ====================
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

let isGoogleMapsLoaded = false
let isGoogleMapsLoading = false
let googleMapsCallbacks: Array<() => void> = []

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve) => {
    if (isGoogleMapsLoaded || (typeof window !== 'undefined' && window.google?.maps)) {
      isGoogleMapsLoaded = true
      resolve()
      return
    }
    googleMapsCallbacks.push(resolve)
    if (isGoogleMapsLoading) return
    isGoogleMapsLoading = true
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=he&region=IL`
    script.async = true
    script.defer = true
    script.onload = () => {
      isGoogleMapsLoaded = true
      isGoogleMapsLoading = false
      googleMapsCallbacks.forEach(cb => cb())
      googleMapsCallbacks = []
    }
    document.head.appendChild(script)
  })
}

async function calculateDistance(origin: AddressData, destination: AddressData): Promise<DistanceResult | null> {
  if (!window.google?.maps) return null
  const service = new window.google.maps.DistanceMatrixService()
  // תמיד להשתמש בכתובת הטקסטואלית לחישוב מדויק יותר
  const originLocation = origin.address
  const destLocation = destination.address

  return new Promise((resolve) => {
    service.getDistanceMatrix({
      origins: [originLocation],
      destinations: [destLocation],
      travelMode: window.google.maps.TravelMode.DRIVING,
      unitSystem: window.google.maps.UnitSystem.METRIC,
      region: 'IL'
    }, (response: google.maps.DistanceMatrixResponse | null, status: google.maps.DistanceMatrixStatus) => {
      if (status !== 'OK' || !response) { resolve(null); return }
      const result = response.rows[0]?.elements[0]
      if (result?.status !== 'OK') { resolve(null); return }
      resolve({
        distanceKm: Math.round(result.distance.value / 1000 * 10) / 10,
        durationMinutes: Math.round(result.duration.value / 60)
      })
    })
  })
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!window.google?.maps) return null
  const geocoder = new window.google.maps.Geocoder()
  return new Promise((resolve) => {
    geocoder.geocode({ location: { lat, lng } }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
      resolve(status === 'OK' && results?.[0] ? results[0].formatted_address : null)
    })
  })
}

// ==================== PinDropModal Component ====================
function PinDropModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  initialAddress, 
  title = 'בחר מיקום' 
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: AddressData) => void
  initialAddress?: AddressData
  title?: string
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const [currentAddress, setCurrentAddress] = useState('')
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return

    const initMap = async () => {
      await loadGoogleMaps()
      if (!mapContainerRef.current || !window.google?.maps) return
      setIsLoading(true)

      let pos = { lat: 32.0853, lng: 34.7818 }

      if (initialAddress?.lat && initialAddress?.lng) {
        pos = { lat: initialAddress.lat, lng: initialAddress.lng }
        if (initialAddress.address) setCurrentAddress(initialAddress.address)
      } else if (initialAddress?.address) {
        const geocoder = new window.google.maps.Geocoder()
        try {
          const result = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
            geocoder.geocode({ address: initialAddress.address, region: 'IL' }, (results, status) => {
              if (status === 'OK' && results) resolve(results)
              else reject(status)
            })
          })
          if (result[0]?.geometry?.location) {
            pos = { lat: result[0].geometry.location.lat(), lng: result[0].geometry.location.lng() }
            setCurrentAddress(initialAddress.address)
          }
        } catch (e) {
          console.log('Geocoding failed, using default location')
        }
      }

      mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
        center: pos,
        zoom: 15,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        gestureHandling: 'greedy',
        streetViewControl: false,
        fullscreenControl: false,
        mapTypeControl: false
      })

      markerRef.current = new window.google.maps.Marker({
        position: pos,
        map: mapRef.current,
        draggable: true,
        title: 'גרור למיקום הרצוי'
      })

      setCurrentPosition(pos)

      markerRef.current.addListener('dragend', async () => {
        const p = markerRef.current?.getPosition()
        if (p) {
          const lat = p.lat(), lng = p.lng()
          setCurrentPosition({ lat, lng })
          setCurrentAddress(await reverseGeocode(lat, lng) || 'מיקום מדויק')
        }
      })

      mapRef.current.addListener('click', async (e: google.maps.MapMouseEvent) => {
        if (e.latLng && markerRef.current) {
          markerRef.current.setPosition(e.latLng)
          const lat = e.latLng.lat(), lng = e.latLng.lng()
          setCurrentPosition({ lat, lng })
          setCurrentAddress(await reverseGeocode(lat, lng) || 'מיקום מדויק')
        }
      })

      if (!initialAddress?.lat && !initialAddress?.address && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const p = { lat: position.coords.latitude, lng: position.coords.longitude }
          mapRef.current?.setCenter(p)
          markerRef.current?.setPosition(p)
          setCurrentPosition(p)
          setCurrentAddress(await reverseGeocode(p.lat, p.lng) || 'מיקום מדויק')
        }, () => {})
      }

      setIsLoading(false)
    }

    initMap()
    return () => { mapRef.current = null; markerRef.current = null }
  }, [isOpen, initialAddress])

  const handleConfirm = () => {
    if (currentPosition) {
      onConfirm({
        address: currentAddress || 'מיקום מדויק',
        lat: currentPosition.lat,
        lng: currentPosition.lng,
        isPinDropped: true
      })
      onClose()
    }
  }

  const goToCurrentLocation = () => {
    navigator.geolocation?.getCurrentPosition(async (position) => {
      const p = { lat: position.coords.latitude, lng: position.coords.longitude }
      mapRef.current?.setCenter(p)
      mapRef.current?.setZoom(17)
      markerRef.current?.setPosition(p)
      setCurrentPosition(p)
      setCurrentAddress(await reverseGeocode(p.lat, p.lng) || 'מיקום מדויק')
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-2xl mx-4 overflow-hidden shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-[#33d4ff] text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <MapPin size={20} />
            <h2 className="font-bold text-lg">{title}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg text-xl">×</button>
        </div>

        <div className="relative flex-1" style={{ minHeight: '400px' }}>
          <div ref={mapContainerRef} className="absolute inset-0" />
          {isLoading && (
            <div className="absolute inset-0 bg-white flex items-center justify-center">
              <Loader2 size={32} className="animate-spin text-[#33d4ff]" />
            </div>
          )}
          <button onClick={goToCurrentLocation} className="absolute bottom-4 right-4 bg-white p-3 rounded-full shadow-lg hover:bg-gray-50" title="המיקום שלי">
            <Navigation size={20} className="text-[#33d4ff]" />
          </button>
          <div className="absolute top-4 left-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow text-sm text-gray-600 text-center">
            גרור את הסיכה או לחץ על המפה לבחירת מיקום
          </div>
        </div>

        {currentAddress && (
          <div className="px-5 py-3 bg-gray-50 border-t">
            <div className="flex items-start gap-2">
              <MapPin size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">{currentAddress}</p>
                {currentPosition && (
                  <p className="text-xs text-gray-500 font-mono">
                    {currentPosition.lat.toFixed(6)}, {currentPosition.lng.toFixed(6)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 px-5 py-4 border-t bg-white flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 font-medium">
            ביטול
          </button>
          <button onClick={handleConfirm} disabled={!currentPosition} className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            <MapPin size={18} />
            אישור מיקום
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== PriceSelector Component ====================
function PriceSelector({
  priceMode,
  setPriceMode,
  selectedPriceItem,
  setSelectedPriceItem,
  customPrice,
  setCustomPrice,
  recommendedPrice,
  distance,
  basePriceList,
  fixedPriceItems,
  selectedCustomerPricing
}: {
  priceMode: 'recommended' | 'fixed' | 'customer' | 'custom'
  setPriceMode: (mode: 'recommended' | 'fixed' | 'customer' | 'custom') => void
  selectedPriceItem: PriceItem | null
  setSelectedPriceItem: (item: PriceItem | null) => void
  customPrice: string
  setCustomPrice: (price: string) => void
  recommendedPrice: number
  distance: DistanceResult | null
  basePriceList: any
  fixedPriceItems: FixedPriceItem[]
  selectedCustomerPricing: CustomerWithPricing | null
}) {
  const hasCustomerPricing = selectedCustomerPricing && selectedCustomerPricing.price_items.length > 0
  const hasFixedPrices = fixedPriceItems.length > 0

  return (
    <div className="space-y-3">
      {/* מחיר מומלץ */}
      <button
        onClick={() => { setPriceMode('recommended'); setSelectedPriceItem(null); setCustomPrice('') }}
        className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
          priceMode === 'recommended' ? 'border-[#33d4ff] bg-[#33d4ff]/5' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              priceMode === 'recommended' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              📊
            </div>
            <div>
              <p className={`font-medium ${priceMode === 'recommended' ? 'text-[#33d4ff]' : 'text-gray-700'}`}>מחיר מומלץ</p>
              <p className="text-xs text-gray-500">
                {distance ? `${distance.distanceKm} ק״מ × ₪${basePriceList?.price_per_km || 12}` : 'חישוב אוטומטי לפי מחירון'}
              </p>
            </div>
          </div>
          <span className={`text-xl font-bold ${priceMode === 'recommended' ? 'text-[#33d4ff]' : 'text-gray-800'}`}>
            ₪{recommendedPrice}
          </span>
        </div>
      </button>

      {/* מחירון כללי */}
      {hasFixedPrices && (
        <div className={`rounded-xl border-2 transition-all overflow-hidden ${priceMode === 'fixed' ? 'border-emerald-500' : 'border-gray-200'}`}>
          <button
            onClick={() => { setPriceMode('fixed'); setSelectedPriceItem(null); setCustomPrice('') }}
            className={`w-full p-4 text-right ${priceMode === 'fixed' ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${priceMode === 'fixed' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                📋
              </div>
              <div>
                <p className={`font-medium ${priceMode === 'fixed' ? 'text-emerald-700' : 'text-gray-700'}`}>מחירון כללי</p>
                <p className="text-xs text-gray-500">תעריפים קבועים</p>
              </div>
            </div>
          </button>
          
          {priceMode === 'fixed' && (
            <div className="p-3 pt-0 space-y-2">
              {fixedPriceItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedPriceItem({ id: item.id, label: item.label, price: item.price })}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                    selectedPriceItem?.id === item.id ? 'border-emerald-500 bg-emerald-100' : 'border-gray-200 bg-white hover:border-emerald-300'
                  }`}
                >
                  <div className="text-right">
                    <span className={`font-medium ${selectedPriceItem?.id === item.id ? 'text-emerald-700' : 'text-gray-700'}`}>{item.label}</span>
                    {item.description && <p className="text-xs text-gray-500">{item.description}</p>}
                  </div>
                  <span className={`font-bold ${selectedPriceItem?.id === item.id ? 'text-emerald-700' : 'text-gray-800'}`}>₪{item.price}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* מחירון לקוח */}
      {hasCustomerPricing && (
        <div className={`rounded-xl border-2 transition-all overflow-hidden ${priceMode === 'customer' ? 'border-purple-500' : 'border-gray-200'}`}>
          <button
            onClick={() => { setPriceMode('customer'); setSelectedPriceItem(null); setCustomPrice('') }}
            className={`w-full p-4 text-right ${priceMode === 'customer' ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${priceMode === 'customer' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                🏷️
              </div>
              <div>
                <p className={`font-medium ${priceMode === 'customer' ? 'text-purple-700' : 'text-gray-700'}`}>
                  מחירון {selectedCustomerPricing?.customer?.name}
                </p>
                <p className="text-xs text-gray-500">
                  מחירון מותאם ללקוח
                  {(selectedCustomerPricing?.discount_percent ?? 0) > 0 && (
                    <span className="mr-2 text-purple-600">• הנחה {selectedCustomerPricing?.discount_percent}%</span>
                  )}
                </p>
              </div>
            </div>
          </button>
          
          {priceMode === 'customer' && selectedCustomerPricing && (
            <div className="p-3 pt-0 space-y-2">
              {selectedCustomerPricing.price_items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedPriceItem({ id: item.id, label: item.label, price: item.price })}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                    selectedPriceItem?.id === item.id ? 'border-purple-500 bg-purple-100' : 'border-gray-200 bg-white hover:border-purple-300'
                  }`}
                >
                  <span className={`font-medium ${selectedPriceItem?.id === item.id ? 'text-purple-700' : 'text-gray-700'}`}>{item.label}</span>
                  <span className={`font-bold ${selectedPriceItem?.id === item.id ? 'text-purple-700' : 'text-gray-800'}`}>₪{item.price}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* מחיר ידני */}
      <div className={`rounded-xl border-2 transition-all overflow-hidden ${priceMode === 'custom' ? 'border-amber-500' : 'border-gray-200'}`}>
        <button
          onClick={() => { setPriceMode('custom'); setSelectedPriceItem(null) }}
          className={`w-full p-4 text-right ${priceMode === 'custom' ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${priceMode === 'custom' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
              ✏️
            </div>
            <div>
              <p className={`font-medium ${priceMode === 'custom' ? 'text-amber-700' : 'text-gray-700'}`}>מחיר ידני</p>
              <p className="text-xs text-gray-500">הזן מחיר אחר</p>
            </div>
          </div>
        </button>
        
        {priceMode === 'custom' && (
          <div className="p-3 pt-0">
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
              <input
                type="number"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="הזן מחיר"
                className="w-full pr-8 pl-4 py-3 border border-amber-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white font-medium text-lg"
                autoFocus
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== Main Form Component ====================
function NewTowForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, companyId } = useAuth()
  
  // UI State
  const [showAssignNowModal, setShowAssignNowModal] = useState(false)
  const [savedTowId, setSavedTowId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  
  // Data from database
  const [customers, setCustomers] = useState<CustomerWithDetails[]>([])
  const [drivers, setDrivers] = useState<DriverWithDetails[]>([])
  const [trucks, setTrucks] = useState<TruckWithDetails[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [preSelectedDriverId, setPreSelectedDriverId] = useState<string | null>(null)
  
  // Price list
  const [basePriceList, setBasePriceList] = useState<any>(null)
  const [fixedPriceItems, setFixedPriceItems] = useState<FixedPriceItem[]>([])
  const [customersWithPricing, setCustomersWithPricing] = useState<CustomerWithPricing[]>([])
  const [selectedCustomerPricing, setSelectedCustomerPricing] = useState<CustomerWithPricing | null>(null)
  
  // Surcharges from database
  const [timeSurchargesData, setTimeSurchargesData] = useState<TimeSurcharge[]>([])
  const [locationSurchargesData, setLocationSurchargesData] = useState<LocationSurcharge[]>([])
  const [serviceSurchargesData, setServiceSurchargesData] = useState<ServiceSurcharge[]>([])
  
  // Selected surcharges
  const [selectedLocationSurcharges, setSelectedLocationSurcharges] = useState<string[]>([])
  const [selectedServiceSurcharges, setSelectedServiceSurcharges] = useState<string[]>([])
  const [waitingTimeUnits, setWaitingTimeUnits] = useState(0)
  const [isHoliday, setIsHoliday] = useState(false)
  const [activeTimeSurchargesList, setActiveTimeSurchargesList] = useState<TimeSurcharge[]>([])
  
  // Price selection
  const [priceMode, setPriceMode] = useState<'recommended' | 'fixed' | 'customer' | 'custom'>('recommended')
  const [selectedPriceItem, setSelectedPriceItem] = useState<PriceItem | null>(null)
  const [customPrice, setCustomPrice] = useState<string>('')
  
  // Customer info
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  
  // Date/Time
  const [towDate, setTowDate] = useState('')
  const [towTime, setTowTime] = useState('')
  const [isToday, setIsToday] = useState(true)
  
  // Tow type
  const [towType, setTowType] = useState<TowType>('')
  
  // Single tow - Vehicle
  const [vehiclePlate, setVehiclePlate] = useState('')
  const [vehicleCode, setVehicleCode] = useState('')
  const [vehicleData, setVehicleData] = useState<VehicleLookupResult | null>(null)
  const [vehicleType, setVehicleType] = useState<VehicleType | ''>('')
  const [selectedDefects, setSelectedDefects] = useState<string[]>([])
  
  // Single tow - Addresses
  const [pickupAddress, setPickupAddress] = useState<AddressData>({ address: '' })
  const [dropoffAddress, setDropoffAddress] = useState<AddressData>({ address: '' })
  
  // Distance
  const [distance, setDistance] = useState<DistanceResult | null>(null)
  const [distanceLoading, setDistanceLoading] = useState(false)
  
  // Start from base
  const [startFromBase, setStartFromBase] = useState(false)
  const [baseToPickupDistance, setBaseToPickupDistance] = useState<DistanceResult | null>(null)
  const [baseToPickupLoading, setBaseToPickupLoading] = useState(false)
  
  // Contacts
  const [pickupContactName, setPickupContactName] = useState('')
  const [pickupContactPhone, setPickupContactPhone] = useState('')
  const [dropoffContactName, setDropoffContactName] = useState('')
  const [dropoffContactPhone, setDropoffContactPhone] = useState('')
  const [notes, setNotes] = useState('')
  
  // Payment
  const [invoiceName, setInvoiceName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'invoice'>('cash')
  const [creditCardNumber, setCreditCardNumber] = useState('')
  const [creditCardExpiry, setCreditCardExpiry] = useState('')
  const [creditCardCvv, setCreditCardCvv] = useState('')
  const [creditCardId, setCreditCardId] = useState('')
  
  // Pin drop modal
  const [pinDropModal, setPinDropModal] = useState<{ isOpen: boolean; field: string | null }>({ isOpen: false, field: null })

  // ==================== Effects ====================
  
  // Load Google Maps
  useEffect(() => { loadGoogleMaps() }, [])

  // Calculate distance
  useEffect(() => {
    if (!pickupAddress.address || !dropoffAddress.address) {
      setDistance(null)
      return
    }
    const calc = async () => {
      setDistanceLoading(true)
      console.log('Calculating distance:', {
        pickup: pickupAddress,
        dropoff: dropoffAddress
      })
      try {
        const result = await calculateDistance(pickupAddress, dropoffAddress)
        console.log('Distance result:', result)

        setDistance(result)
      } catch (err) {
        console.error('Distance calculation error:', err)
        setDistance(null)
      } finally {
        setDistanceLoading(false)
      }
    }
    const timeout = setTimeout(calc, 500)
    return () => clearTimeout(timeout)
  }, [pickupAddress.address, pickupAddress.lat, dropoffAddress.address, dropoffAddress.lat])

  // Calculate base to pickup distance
  useEffect(() => {
    if (!startFromBase || !pickupAddress.address || !basePriceList?.base_lat || !basePriceList?.base_lng) {
      setBaseToPickupDistance(null)
      return
    }
    const calcBaseDistance = async () => {
      setBaseToPickupLoading(true)
      try {
        const baseAddress: AddressData = {
          address: basePriceList.base_address || '',
          lat: basePriceList.base_lat,
          lng: basePriceList.base_lng
        }
        const result = await calculateDistance(baseAddress, pickupAddress)
        setBaseToPickupDistance(result)
      } catch (err) {
        console.error('Base distance calculation error:', err)
        setBaseToPickupDistance(null)
      } finally {
        setBaseToPickupLoading(false)
      }
    }
    const timeout = setTimeout(calcBaseDistance, 500)
    return () => clearTimeout(timeout)
  }, [startFromBase, pickupAddress.address, pickupAddress.lat, basePriceList?.base_lat, basePriceList?.base_lng])

  // Read URL params
  useEffect(() => {
    const dateParam = searchParams.get('date')
    const timeParam = searchParams.get('time')
    const driverParam = searchParams.get('driver')
    
    if (dateParam) {
      setTowDate(dateParam)
      const today = new Date().toISOString().split('T')[0]
      setIsToday(dateParam === today)
    }
    if (timeParam) setTowTime(timeParam)
    if (driverParam) setPreSelectedDriverId(driverParam)
  }, [searchParams])

  // Load data
  useEffect(() => {
    if (companyId) loadData()
  }, [companyId])

  const loadData = async () => {
    if (!companyId) return
    try {
      const [customersData, driversData, trucksData, basePriceData, fixedPricesData, customersPricingData, timeSurchargesRes, locationSurchargesRes, serviceSurchargesRes] = await Promise.all([
        getCustomers(companyId),
        getDrivers(companyId),
        getTrucks(companyId),
        getBasePriceList(companyId),
        getFixedPriceItems(companyId),
        getCustomersWithPricing(companyId),
        getTimeSurcharges(companyId),
        getLocationSurcharges(companyId),
        getServiceSurcharges(companyId)
      ])
      setCustomers(customersData)
      setDrivers(driversData)
      setTrucks(trucksData)
      setBasePriceList(basePriceData)
      setFixedPriceItems(fixedPricesData)
      setCustomersWithPricing(customersPricingData)
      setTimeSurchargesData(timeSurchargesRes)
      setLocationSurchargesData(locationSurchargesRes)
      setServiceSurchargesData(serviceSurchargesRes)
    } catch (err) {
      console.error('Error loading data:', err)
    }
  }

  // Customer pricing
  useEffect(() => {
    if (selectedCustomerId) {
      const customerPricing = customersWithPricing.find(c => c.customer_id === selectedCustomerId)
      setSelectedCustomerPricing(customerPricing || null)
    } else {
      setSelectedCustomerPricing(null)
    }
    setPriceMode('recommended')
    setSelectedPriceItem(null)
    setCustomPrice('')
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

  // ==================== Price Calculations ====================
  
  const calculateRecommendedPrice = () => {
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
    selectedServiceSurcharges.forEach(id => {
      const surcharge = serviceSurchargesData.find(s => s.id === id)
      if (surcharge) {
        if (surcharge.label.includes('המתנה')) {
          servicesTotal += surcharge.price * waitingTimeUnits
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

  // ==================== Handlers ====================
  
  const handleCustomerSelect = (customerId: string | null, name: string, phone: string) => {
    setSelectedCustomerId(customerId)
    setCustomerName(name)
    setCustomerPhone(phone)
  }

  const handlePinDropConfirm = (data: AddressData) => {
    if (pinDropModal.field === 'pickup') setPickupAddress(data)
    else if (pinDropModal.field === 'dropoff') setDropoffAddress(data)
  }

  const copyFromCustomer = (target: 'pickup' | 'dropoff') => {
    if (target === 'pickup') {
      setPickupContactName(customerName)
      setPickupContactPhone(customerPhone)
    } else {
      setDropoffContactName(customerName)
      setDropoffContactPhone(customerPhone)
    }
  }

  const handleSave = async () => {
    if (!companyId || !user) return
    
    setSaving(true)
    setError('')
    
    try {
      // בניית פירוט המחיר
      const vehicleTypeMap: Record<string, string> = {
        'private': 'base_price_private',
        'motorcycle': 'base_price_motorcycle',
        'heavy': 'base_price_heavy',
        'machinery': 'base_price_machinery'
      }
      
      const priceField = vehicleType ? vehicleTypeMap[vehicleType] : null
      const basePrice = priceField ? (basePriceList?.[priceField] || 0) : 0
      const pricePerKm = basePriceList?.price_per_km || 0
      const pickupToDropoffKm = distance?.distanceKm || 0
      const baseToPickupKm = (startFromBase && baseToPickupDistance?.distanceKm) || 0
      const distanceKm = pickupToDropoffKm + baseToPickupKm
      const distancePrice = Math.round(distanceKm * pricePerKm)
      
      const subtotal = basePrice + distancePrice
      
      // תוספות זמן
      const timeSurchargesBreakdown = activeTimeSurchargesList.map(s => ({
        id: s.id,
        label: s.label,
        percent: s.surcharge_percent,
        amount: Math.round(subtotal * s.surcharge_percent / 100)
      }))
      const timeAmount = timeSurchargesBreakdown.reduce((sum, s) => Math.max(sum, s.amount), 0)
      
      // תוספות מיקום
      const locationSurchargesBreakdown = selectedLocationSurcharges
        .map(id => locationSurchargesData.find(l => l.id === id))
        .filter(Boolean)
        .map(s => ({
          id: s!.id,
          label: s!.label,
          percent: s!.surcharge_percent,
          amount: Math.round(subtotal * s!.surcharge_percent / 100)
        }))
      const locationAmount = locationSurchargesBreakdown.reduce((sum, s) => sum + s.amount, 0)
      
      // תוספות שירותים
      const serviceSurchargesBreakdown = selectedServiceSurcharges
        .map(id => serviceSurchargesData.find(s => s.id === id))
        .filter(Boolean)
        .map(s => {
          const isWaiting = s!.label.includes('המתנה')
          const units = isWaiting ? waitingTimeUnits : 1
          return {
            id: s!.id,
            label: s!.label,
            price: s!.price,
            units: isWaiting ? waitingTimeUnits : undefined,
            amount: s!.price * units
          }
        })
        .filter(s => s.amount > 0)
      const servicesTotal = serviceSurchargesBreakdown.reduce((sum, s) => sum + s.amount, 0)
      
      const beforeDiscount = subtotal + timeAmount + locationAmount + servicesTotal
      
      const discountPercent = selectedCustomerPricing?.discount_percent || 0
      const discountAmount = Math.round(beforeDiscount * discountPercent / 100)
      
      const beforeVat = beforeDiscount - discountAmount
      const vatAmount = Math.round(beforeVat * 0.18)
      const total = beforeVat + vatAmount

      const priceBreakdown = {
        base_price: basePrice,
        vehicle_type: vehicleType || '',
        distance_km: distanceKm,
        distance_price: distancePrice,
        time_surcharges: timeSurchargesBreakdown,
        location_surcharges: locationSurchargesBreakdown,
        service_surcharges: serviceSurchargesBreakdown,
        subtotal: beforeDiscount,
        discount_percent: discountPercent,
        discount_amount: discountAmount,
        vat_amount: vatAmount,
        total: total
      }

      const vehiclesData = [{
        plateNumber: vehiclePlate,
        vehicleType: vehicleType as any || undefined,
        manufacturer: vehicleData?.data?.manufacturer || undefined,
        model: vehicleData?.data?.model || undefined,
        year: vehicleData?.data?.year || undefined,
        color: vehicleData?.data?.color || undefined,
        driveType: vehicleData?.data?.driveType || undefined,
        fuelType: vehicleData?.data?.fuelType || undefined,
        totalWeight: vehicleData?.data?.totalWeight || undefined,
        gearType: vehicleData?.data?.gearType || undefined,
        driveTechnology: vehicleData?.data?.driveTechnology || undefined,
        isWorking: !selectedDefects.length,
        towReason: selectedDefects.join(', ') || undefined
      }]

      const legsData = [{ 
        legType: 'pickup' as const, 
        fromAddress: pickupAddress.address, 
        toAddress: dropoffAddress.address,
        fromLat: pickupAddress.lat,
        fromLng: pickupAddress.lng,
        toLat: dropoffAddress.lat,
        toLng: dropoffAddress.lng
      }]

      const result = await createTow({
        companyId,
        createdBy: user.id,
        customerId: selectedCustomerId || undefined,
        driverId: preSelectedDriverId || undefined,
        towType: 'simple',
        notes: notes || undefined,
        finalPrice: finalPrice || undefined,
        priceBreakdown: priceBreakdown,
        vehicles: vehiclesData,
        legs: legsData
      })

      setSavedTowId(result.id)
      setShowAssignNowModal(true)
    } catch (err) {
      console.error('Error creating tow:', err)
      setError('שגיאה ביצירת הגרירה')
    } finally {
      setSaving(false)
    }
  }

  // ==================== Render ====================
  
  return (
    <div className="min-h-screen bg-gray-50">
      {error && (
        <div className="fixed top-4 left-4 right-4 z-50 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
          {error}
        </div>
      )}
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/tows" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                <ArrowRight size={20} />
              </Link>
              <div>
                <h1 className="font-bold text-gray-800 text-base sm:text-lg">גרירה חדשה</h1>
                <p className="text-xs text-gray-500 hidden sm:block">מילוי פרטי הגרירה</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4 sm:py-6">
        {/* Driver Pre-Selected Banner */}
        {preSelectedDriverId && drivers.length > 0 && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                {drivers.find(d => d.id === preSelectedDriverId)?.user?.full_name?.charAt(0) || '?'}
              </div>
              <div>
                <p className="text-sm text-green-700">נהג משובץ:</p>
                <p className="font-medium text-green-800">
                  {drivers.find(d => d.id === preSelectedDriverId)?.user?.full_name || 'נהג לא נמצא'}
                </p>
              </div>
            </div>
            <button onClick={() => setPreSelectedDriverId(null)} className="p-2 text-green-600 hover:bg-green-100 rounded-lg" title="הסר נהג">
              <X size={18} />
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* Main Form */}
          <div className="flex-1 space-y-4 sm:space-y-6">
            
            {/* Section 1 - Customer */}
            <CustomerSection
              customers={customers}
              customersWithPricing={customersWithPricing}
              selectedCustomerId={selectedCustomerId}
              onCustomerSelect={handleCustomerSelect}
              customerName={customerName}
              customerPhone={customerPhone}
              onCustomerNameChange={setCustomerName}
              onCustomerPhoneChange={setCustomerPhone}
              towDate={towDate}
              towTime={towTime}
              isToday={isToday}
              onTowDateChange={setTowDate}
              onTowTimeChange={setTowTime}
              onIsTodayChange={setIsToday}
            />

            {/* Section 2 - Tow Type */}
            <TowTypeSelector selectedType={towType} onChange={setTowType} />

            {/* Section 3+4 - Route based on type */}
            {towType === 'single' && (
              <SingleRoute
                vehiclePlate={vehiclePlate}
                onVehiclePlateChange={setVehiclePlate}
                vehicleData={vehicleData}
                onVehicleDataChange={setVehicleData}
                vehicleType={vehicleType}
                onVehicleTypeChange={setVehicleType}
                vehicleCode={vehicleCode}
                onVehicleCodeChange={setVehicleCode}
                selectedDefects={selectedDefects}
                onDefectsChange={setSelectedDefects}
                pickupAddress={pickupAddress}
                onPickupAddressChange={setPickupAddress}
                dropoffAddress={dropoffAddress}
                onDropoffAddressChange={setDropoffAddress}
                onPinDropClick={(field) => setPinDropModal({ isOpen: true, field })}
                distance={distance}
                distanceLoading={distanceLoading}
                basePriceList={basePriceList}
                startFromBase={startFromBase}
                onStartFromBaseChange={setStartFromBase}
                baseToPickupDistance={baseToPickupDistance}
                baseToPickupLoading={baseToPickupLoading}
                activeTimeSurcharges={activeTimeSurchargesList}
                isHoliday={isHoliday}
                onIsHolidayChange={setIsHoliday}
                locationSurchargesData={locationSurchargesData}
                selectedLocationSurcharges={selectedLocationSurcharges}
                onLocationSurchargesChange={setSelectedLocationSurcharges}
                serviceSurchargesData={serviceSurchargesData}
                selectedServiceSurcharges={selectedServiceSurcharges}
                onServiceSurchargesChange={setSelectedServiceSurcharges}
                waitingTimeUnits={waitingTimeUnits}
                onWaitingTimeUnitsChange={setWaitingTimeUnits}
              />
            )}

            {towType === 'exchange' && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-8 text-center">
                <p className="text-gray-500">טופס תקין-תקול - בפיתוח</p>
              </div>
            )}

            {towType === 'multiple' && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-8 text-center">
                <p className="text-gray-500">טופס גרירה מרובה - בפיתוח</p>
              </div>
            )}

            {/* Section 5 - Price */}
            {towType && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                    <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">
                      {towType === 'single' ? '5' : '4'}
                    </span>
                    מחיר
                  </h2>
                </div>
                <div className="p-4 sm:p-5">
                  <PriceSelector
                    priceMode={priceMode}
                    setPriceMode={setPriceMode}
                    selectedPriceItem={selectedPriceItem}
                    setSelectedPriceItem={setSelectedPriceItem}
                    customPrice={customPrice}
                    setCustomPrice={setCustomPrice}
                    recommendedPrice={recommendedPrice}
                    distance={distance}
                    basePriceList={basePriceList}
                    fixedPriceItems={fixedPriceItems}
                    selectedCustomerPricing={selectedCustomerPricing}
                  />
                </div>
              </div>
            )}

            {/* Section 6 - Additional Details */}
            {towType && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                    <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">
                      {towType === 'single' ? '6' : '5'}
                    </span>
                    פרטים נוספים
                  </h2>
                </div>
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="font-medium text-gray-700 mb-3 text-sm">איש קשר במוצא</h4>
                      <div className="space-y-3">
                        <input type="text" value={pickupContactName} onChange={(e) => setPickupContactName(e.target.value)} placeholder="שם" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white" />
                        <div className="flex gap-2">
                          <input type="tel" value={pickupContactPhone} onChange={(e) => setPickupContactPhone(e.target.value)} placeholder="טלפון" className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white" />
                          <button onClick={() => copyFromCustomer('pickup')} className="px-3 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs hover:bg-gray-100 whitespace-nowrap">זהה ללקוח</button>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="font-medium text-gray-700 mb-3 text-sm">איש קשר ביעד</h4>
                      <div className="space-y-3">
                        <input type="text" value={dropoffContactName} onChange={(e) => setDropoffContactName(e.target.value)} placeholder="שם" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white" />
                        <div className="flex gap-2">
                          <input type="tel" value={dropoffContactPhone} onChange={(e) => setDropoffContactPhone(e.target.value)} placeholder="טלפון" className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white" />
                          <button onClick={() => copyFromCustomer('dropoff')} className="px-3 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs hover:bg-gray-100 whitespace-nowrap">זהה ללקוח</button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="הערות נוספות לגרירה..." className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] resize-none"></textarea>
                  </div>
                </div>
              </div>
            )}

            {/* Section 7 - Payment */}
            {towType && (
              <PaymentSection
                sectionNumber={towType === 'single' ? 7 : 6}
                invoiceName={invoiceName}
                onInvoiceNameChange={setInvoiceName}
                customerName={customerName}
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                creditCardNumber={creditCardNumber}
                creditCardExpiry={creditCardExpiry}
                creditCardCvv={creditCardCvv}
                creditCardId={creditCardId}
                onCreditCardNumberChange={setCreditCardNumber}
                onCreditCardExpiryChange={setCreditCardExpiry}
                onCreditCardCvvChange={setCreditCardCvv}
                onCreditCardIdChange={setCreditCardId}
              />
            )}

            {/* Mobile Price Summary */}
            <div className="lg:hidden">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-800 text-white">
                  <h3 className="font-bold text-sm">סיכום מחיר</h3>
                </div>
                <div className="p-4">
                  <PriceSummary
                    isMobile
                    hasTowType={!!towType}
                    hasVehicleType={!!vehicleType}
                    vehicleType={vehicleType}
                    basePriceList={basePriceList}
                    distance={distance}
                    baseToPickupDistance={baseToPickupDistance}
                    startFromBase={startFromBase}
                    activeTimeSurcharges={activeTimeSurchargesList}
                    selectedLocationSurcharges={selectedLocationSurcharges}
                    locationSurchargesData={locationSurchargesData}
                    selectedServiceSurcharges={selectedServiceSurcharges}
                    serviceSurchargesData={serviceSurchargesData}
                    waitingTimeUnits={waitingTimeUnits}
                    selectedCustomerPricing={selectedCustomerPricing}
                    priceMode={priceMode}
                    selectedPriceItem={selectedPriceItem}
                    customPrice={customPrice}
                    finalPrice={finalPrice}
                    onSave={handleSave}
                    saving={saving}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Price Summary */}
          <div className="hidden lg:block w-80 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-24">
              <div className="px-5 py-4 bg-gray-800 text-white">
                <h3 className="font-bold">סיכום מחיר</h3>
              </div>
              <div className="p-5">
                <PriceSummary
                  hasTowType={!!towType}
                  hasVehicleType={!!vehicleType}
                  vehicleType={vehicleType}
                  basePriceList={basePriceList}
                  distance={distance}
                  baseToPickupDistance={baseToPickupDistance}
                  startFromBase={startFromBase}
                  activeTimeSurcharges={activeTimeSurchargesList}
                  selectedLocationSurcharges={selectedLocationSurcharges}
                  locationSurchargesData={locationSurchargesData}
                  selectedServiceSurcharges={selectedServiceSurcharges}
                  serviceSurchargesData={serviceSurchargesData}
                  waitingTimeUnits={waitingTimeUnits}
                  selectedCustomerPricing={selectedCustomerPricing}
                  priceMode={priceMode}
                  selectedPriceItem={selectedPriceItem}
                  customPrice={customPrice}
                  finalPrice={finalPrice}
                  onSave={handleSave}
                  saving={saving}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pin Drop Modal */}
      <PinDropModal
        isOpen={pinDropModal.isOpen}
        onClose={() => setPinDropModal({ isOpen: false, field: null })}
        onConfirm={handlePinDropConfirm}
        initialAddress={pinDropModal.field === 'pickup' ? pickupAddress : pinDropModal.field === 'dropoff' ? dropoffAddress : undefined}
        title={pinDropModal.field === 'pickup' ? 'בחר מיקום מוצא' : pinDropModal.field === 'dropoff' ? 'בחר מיקום יעד' : 'בחר מיקום'}
      />

      {/* Success Modal */}
      {showAssignNowModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">הגרירה נשמרה בהצלחה!</h2>
              <p className="text-gray-500 mb-2">מחיר: <span className="font-bold">₪{finalPrice}</span></p>
              <p className="text-gray-600">האם לשבץ נהג עכשיו?</p>
            </div>
            
            <div className="flex gap-3 p-5 bg-gray-50 border-t border-gray-200">
              <button onClick={() => router.push('/dashboard/tows')} className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium">
                אחר כך
              </button>
              <button onClick={() => router.push(`/dashboard/tows/${savedTowId}`)} className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] transition-colors font-medium flex items-center justify-center gap-2">
                <Truck size={18} />
                שבץ נהג
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Wrapper with Suspense
export default function NewTowPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">טוען...</div>
      </div>
    }>
      <NewTowForm />
    </Suspense>
  )
}

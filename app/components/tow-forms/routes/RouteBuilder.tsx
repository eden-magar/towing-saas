'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  MapPin, Plus, ChevronDown, ChevronUp, GripVertical, Trash2, Home,
  ArrowDown, ArrowUp, User, Check, Package, Loader2, X
} from 'lucide-react'
import { getStoredVehicles, StoredVehicleWithCustomer } from '../../../lib/queries/storage'
import { getServiceSurcharges, type ServiceSurcharge } from '../../../lib/queries/price-lists'
import { calculateDistance } from '../../../lib/google-maps'

// Import extracted components
import { AddressInput, loadGoogleMaps, AddressData } from './AddressInput'
import { VehicleCard, VehicleOnTruck, createEmptyVehicle } from './VehicleCard'
import { StorageNotification } from './StorageVehicleSelector'
import { TowTruckTypeSelector, ServiceSurchargeSelector, type SelectedService } from '../shared'
import { PhoneInput } from '../../ui/PhoneInput'
import { ContactNameAutocomplete } from '../../customer-contacts/ContactNameAutocomplete'
import { SaveCustomerContactPill } from '../../customer-contacts/SaveCustomerContactPill'
import { shouldOfferSaveCustomerContact } from '../../../lib/utils/customer-contact-save-ui'
import type { CustomerContact } from '../../../lib/types'


// ==================== Types ====================

export interface RoutePoint {
  id: string
  type: 'base' | 'stop' | 'storage'
  isStopOnly: boolean
  address: string
  addressData?: {
    placeId?: string
    lat?: number
    lng?: number
  }
  contactName: string
  contactPhone: string
  notes: string
  vehiclesToPickup: VehicleOnTruck[]
  vehiclesToDropoff: string[]
  dropToStorage?: boolean
  services?: SelectedService[]
}

export interface RouteBuilderProps {
  companyId: string
  customerId: string | null
  customerName?: string
  customerPhone?: string
  baseAddress?: string
  baseLat?: number
  baseLng?: number
  onPointsChange?: (points: RoutePoint[]) => void
  onPinDropClick?: (pointId: string) => void
  onRouteDataChange?: (data: {
    totalDistanceKm: number
    vehicles: { type: string; isWorking: boolean }[]
    services: SelectedService[]
  }) => void
  pinDropResult?: { pointId: string; data: { address: string; lat?: number; lng?: number; placeId?: string } } | null
  onPinDropHandled?: () => void
  
  // סוג גרר
  requiredTruckTypes?: string[]
  onRequiredTruckTypesChange?: (types: string[]) => void
  truckTypeSectionRef?: React.RefObject<HTMLDivElement> | null
  truckTypeError?: boolean
  /** Edit-open only: seed internal route once on mount (or first non-empty arrival). */
  initialPoints?: RoutePoint[]
  /** Saved customer contacts for autocomplete (optional — omit for legacy plain inputs). */
  savedCustomerContacts?: CustomerContact[]
  customerContactsLoading?: boolean
  saveContactByPointId?: Record<string, boolean>
  onSaveContactToggle?: (pointId: string) => void
  onContactSelected?: (pointId: string) => void
}

// ==================== Helper Functions ====================

export function createEmptyPoint(type: RoutePoint['type'] = 'stop'): RoutePoint {
  return {
    id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    isStopOnly: false,
    address: '',
    contactName: '',
    contactPhone: '',
    notes: '',
    vehiclesToPickup: [],
    vehiclesToDropoff: [],
    services: []
  }
}

function serviceLabel(servicesCatalog: ServiceSurcharge[], id: string): string {
  return servicesCatalog.find((x) => x.id === id)?.label ?? id
}

// ==================== Main Component ====================

export function RouteBuilder({
  companyId,
  customerId,
  customerName = '',
  customerPhone = '',
  baseAddress = '',
  baseLat,
  baseLng,
  onPointsChange,
  onPinDropClick,
  onRouteDataChange,
  pinDropResult,
  onPinDropHandled,
  requiredTruckTypes = [],
  onRequiredTruckTypesChange,
  truckTypeSectionRef,
  truckTypeError = false,
  initialPoints,
  savedCustomerContacts,
  customerContactsLoading = false,
  saveContactByPointId = {},
  onSaveContactToggle,
  onContactSelected,
}: RouteBuilderProps) {
  const customerContactPickerEnabled = savedCustomerContacts !== undefined
  const [points, setPoints] = useState<RoutePoint[]>(() =>
    initialPoints?.length ? initialPoints.map((p) => ({ ...p })) : []
  )
  const hasAppliedInitialPointsRef = useRef((initialPoints?.length ?? 0) > 0)
  const isMountPointsNotifyRef = useRef(true)
  const isMountRouteDataNotifyRef = useRef(true)
  const [expandedPoint, setExpandedPoint] = useState<string | null>(null)
  const [startFromBase, setStartFromBase] = useState(false)
  const [storedVehicles, setStoredVehicles] = useState<StoredVehicleWithCustomer[]>([])
  const [storedVehiclesLoading, setStoredVehiclesLoading] = useState(false)
  const [totalDistance, setTotalDistance] = useState(0)
  const [distanceLoading, setDistanceLoading] = useState(false)
  const newPointAddressRef = useRef<HTMLInputElement>(null!)
  const [newlyAddedPointId, setNewlyAddedPointId] = useState<string | null>(null)
  const [serviceSurchargesData, setServiceSurchargesData] = useState<ServiceSurcharge[]>([])
  const [servicesModalPointId, setServicesModalPointId] = useState<string | null>(null)
  /** Per point: true = תקין, false = תקול when adding from storage (default true if unset) */
  const [storagePickupIsWorking, setStoragePickupIsWorking] = useState<Record<string, boolean>>({})

  // One-time seed when hydrated points arrive after mount (edit-open race).
  useEffect(() => {
    if (hasAppliedInitialPointsRef.current) return
    if (!initialPoints?.length) return
    hasAppliedInitialPointsRef.current = true
    setPoints(initialPoints.map((p) => ({ ...p })))
  }, [initialPoints])

  // Total driving distance (Google Distance Matrix), sequential legs between valid points
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (points.length < 2) {
        setTotalDistance(0)
        setDistanceLoading(false)
        return
      }

      const validPoints = points.filter((p) => p.address && p.addressData?.lat && p.addressData?.lng)
      if (validPoints.length < 2) {
        setTotalDistance(0)
        setDistanceLoading(false)
        return
      }

      setDistanceLoading(true)
      await loadGoogleMaps()
      if (cancelled) return

      let totalKm = 0
      for (let i = 0; i < validPoints.length - 1; i++) {
        const from = {
          address: validPoints[i].address,
          lat: validPoints[i].addressData?.lat,
          lng: validPoints[i].addressData?.lng,
        }
        const to = {
          address: validPoints[i + 1].address,
          lat: validPoints[i + 1].addressData?.lat,
          lng: validPoints[i + 1].addressData?.lng,
        }
        const leg = await calculateDistance(from, to)
        if (cancelled) return
        if (leg) totalKm += leg.distanceKm
      }

      if (!cancelled) {
        setTotalDistance(Math.round(totalKm * 10) / 10)
        setDistanceLoading(false)
      }
    }

    run()

    return () => {
      cancelled = true
      setDistanceLoading(false)
    }
  }, [points])

  // Notify parent of route data changes
  useEffect(() => {
    const vehicles = points.flatMap((p) =>
      p.vehiclesToPickup.map((v) => ({
        type: v.vehicleType ?? 'private',
        isWorking: v.isWorking
      }))
    )
    const services = points.flatMap((p) => p.services ?? [])

    if (isMountRouteDataNotifyRef.current) {
      isMountRouteDataNotifyRef.current = false
      const awaitingSeed =
        points.length === 0 && (initialPoints?.length ?? 0) > 0
      const awaitingDistanceAfterSeed =
        (initialPoints?.length ?? 0) > 0 && points.length > 0 && totalDistance === 0
      if (awaitingSeed || awaitingDistanceAfterSeed) {
        return
      }
    }

    onRouteDataChange?.({
      totalDistanceKm: totalDistance,
      vehicles,
      services
    })
  }, [totalDistance, points, onRouteDataChange, initialPoints])

  // Handle pin drop result from parent
  useEffect(() => {
    if (pinDropResult) {
      const { pointId, data } = pinDropResult
      setPoints(currentPoints => currentPoints.map(p => 
        p.id === pointId 
          ? { ...p, address: data.address, addressData: { lat: data.lat, lng: data.lng, placeId: data.placeId } }
          : p
      ))
      onPinDropHandled?.()
    }
  }, [pinDropResult, onPinDropHandled])

  // Focus on address input when new point is added
  useEffect(() => {
    if (newlyAddedPointId && newPointAddressRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        newPointAddressRef.current?.focus()
        setNewlyAddedPointId(null)
      }, 100)
    }
  }, [newlyAddedPointId, points])

  // Load Google Maps
  useEffect(() => {
    loadGoogleMaps()
  }, [])

  useEffect(() => {
    if (!companyId) {
      setServiceSurchargesData([])
      return
    }
    getServiceSurcharges(companyId)
      .then(setServiceSurchargesData)
      .catch(() => setServiceSurchargesData([]))
  }, [companyId])

  // Load stored vehicles when customer changes
  useEffect(() => {
    const loadStoredVehicles = async () => {
      if (!companyId || !customerId) {
        setStoredVehicles([])
        return
      }
      
      setStoredVehiclesLoading(true)
      try {
        const vehicles = await getStoredVehicles(companyId, customerId, 'stored')
        setStoredVehicles(vehicles)
      } catch (error) {
        console.error('Error loading stored vehicles:', error)
        setStoredVehicles([])
      } finally {
        setStoredVehiclesLoading(false)
      }
    }
    
    loadStoredVehicles()
  }, [companyId, customerId])

  // Notify parent of changes
  useEffect(() => {
    if (isMountPointsNotifyRef.current) {
      isMountPointsNotifyRef.current = false
      if (points.length === 0 && (initialPoints?.length ?? 0) > 0) {
        return
      }
    }
    onPointsChange?.(points)
  }, [points, onPointsChange, initialPoints])

  // Get all vehicles currently on truck up to a point
  const getVehiclesOnTruck = (upToPointIndex: number): VehicleOnTruck[] => {
    const vehicles: VehicleOnTruck[] = []
    for (let i = 0; i <= upToPointIndex; i++) {
      const point = points[i]
      point.vehiclesToPickup.forEach(v => vehicles.push(v))
      point.vehiclesToDropoff.forEach(id => {
        const idx = vehicles.findIndex(v => v.id === id)
        if (idx > -1) vehicles.splice(idx, 1)
      })
    }
    return vehicles
  }

  // Get all stored vehicle IDs already selected
  const getSelectedStorageIds = (): string[] => {
    const ids: string[] = []
    points.forEach(p => {
      p.vehiclesToPickup.forEach(v => {
        if (v.storedVehicleId) ids.push(v.storedVehicleId)
      })
    })
    return ids
  }

  const updatePoints = (newPoints: RoutePoint[]) => {
    setPoints(newPoints)
  }

  const updatePointFunctional = (id: string, updates: Partial<RoutePoint>) => {
    setPoints((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)))
  }

  const addPoint = () => {
    const newPoint = createEmptyPoint('stop')
    updatePoints([...points, newPoint])
    setExpandedPoint(newPoint.id)
    setNewlyAddedPointId(newPoint.id)
  }

  const removePoint = (id: string) => {
    const deletedPoint = points.find((p) => p.id === id)
    if (!deletedPoint) return
    const removedVehicleIds = new Set(deletedPoint.vehiclesToPickup.map((v) => v.id))
    const filtered = points
      .filter((p) => p.id !== id)
      .map((p) => ({
        ...p,
        vehiclesToDropoff: p.vehiclesToDropoff.filter((did) => !removedVehicleIds.has(did)),
      }))
    updatePoints(filtered)
  }

  const updatePoint = (id: string, updates: Partial<RoutePoint>) => {
    updatePointFunctional(id, updates)
  }

  const addVehicleToPickup = (pointId: string, isWorking: boolean = true) => {
    const newVehicle = createEmptyVehicle(isWorking)
    updatePoints(points.map(p => {
      if (p.id === pointId) {
        return { ...p, vehiclesToPickup: [...p.vehiclesToPickup, newVehicle] }
      }
      return p
    }))
  }

  const addVehicleFromStorage = (pointId: string, storedVehicle: StoredVehicleWithCustomer) => {
    const isWorking = storagePickupIsWorking[pointId] !== false
    const newVehicle: VehicleOnTruck = {
      id: `vehicle_${Date.now()}`,
      plateNumber: storedVehicle.plate_number,
      isWorking,
      vehicleCode: '',
      isLoading: false,
      isFound: true,
      fromStorage: true,
      storedVehicleId: storedVehicle.id,
      vehicleData: storedVehicle.vehicle_data || undefined
    }
    updatePoints(points.map(p => {
      if (p.id === pointId) {
        const newAddress = !p.address && baseAddress ? baseAddress : p.address
        const newAddressData = !p.address && baseLat ? { lat: baseLat, lng: baseLng } : p.addressData
        return { 
          ...p, 
          vehiclesToPickup: [...p.vehiclesToPickup, newVehicle],
          address: newAddress,
          addressData: newAddressData
        }
      }
      return p
    }))
  }

  const updateVehicle = (pointId: string, vehicleId: string, updates: Partial<VehicleOnTruck>) => {
    updatePoints(points.map(p => {
      if (p.id === pointId) {
        return {
          ...p,
          vehiclesToPickup: p.vehiclesToPickup.map(v => 
            v.id === vehicleId ? { ...v, ...updates } : v
          )
        }
      }
      return p
    }))
  }

  const removeVehicle = (pointId: string, vehicleId: string) => {
    updatePoints(points.map(p => {
      if (p.id === pointId) {
        return {
          ...p,
          vehiclesToPickup: p.vehiclesToPickup.filter(v => v.id !== vehicleId)
        }
      }
      return p
    }))
  }

  const toggleBase = () => {
    if (startFromBase) {
      updatePoints(points.filter(p => p.type !== 'base'))
    } else {
      const basePoint: RoutePoint = {
        id: 'base',
        type: 'base',
        isStopOnly: false,
        address: baseAddress || 'כתובת הבסיס',
        addressData: baseLat ? { lat: baseLat, lng: baseLng } : undefined,
        contactName: '',
        contactPhone: '',
        notes: '',
        vehiclesToPickup: [],
        vehiclesToDropoff: [],
        services: []
      }
      updatePoints([basePoint, ...points])
    }
    setStartFromBase(!startFromBase)
  }

  // Get point summary for collapsed view
  const getPointSummary = (point: RoutePoint, index: number) => {
    if (point.type === 'base') {
      return { typeLabel: 'בסיס', vehicles: '', icon: '🏠', color: 'blue' }
    }

    if (point.isStopOnly) {
      return { typeLabel: 'עצירה', vehicles: point.notes || '', icon: '✋', color: 'amber' }
    }

    const pickupCount = point.vehiclesToPickup.length
    const dropoffCount = point.vehiclesToDropoff.length
    const pickupPlates = point.vehiclesToPickup.map(v => v.plateNumber || '---').join(', ')

    const dropoffPlates = point.vehiclesToDropoff.map(id => {
      for (let i = 0; i < index; i++) {
        const v = points[i].vehiclesToPickup.find(v => v.id === id)
        if (v) return v.plateNumber || '---'
      }
      return '---'
    }).join(', ')

    let typeLabel = ''
    let icon = ''
    let vehicles = ''
    let color = 'gray'

    if (pickupCount > 0 && dropoffCount > 0) {
      typeLabel = 'איסוף + הורדה'
      icon = '🔄'
      vehicles = `⬆️ ${pickupPlates} | ⬇️ ${dropoffPlates}`
      color = 'purple'
    } else if (pickupCount > 0) {
      typeLabel = 'איסוף'
      icon = '🚗'
      vehicles = pickupPlates
      color = 'green'
    } else if (dropoffCount > 0) {
      typeLabel = point.dropToStorage ? 'הורדה לאחסנה' : 'הורדה'
      icon = '📍'
      vehicles = dropoffPlates
      color = point.dropToStorage ? 'indigo' : 'orange'
    } else {
      typeLabel = 'נקודה'
      icon = '📍'
      color = 'gray'
    }

    return { typeLabel, vehicles, icon, color }
  }

  const servicesModalPoint = servicesModalPointId
    ? points.find((p) => p.id === servicesModalPointId)
    : null

  return (
    <div className="space-y-4" dir="rtl">
      {/* Storage notification */}
      <StorageNotification count={storedVehicles.length} />
      
      {/* Start from base toggle */}
      {baseAddress && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={startFromBase}
            onChange={toggleBase}
            className="w-4 h-4 rounded border-gray-300 text-[#33d4ff] focus:ring-[#33d4ff]"
          />
          <span className="text-sm text-gray-700">יציאה מבסיס ({baseAddress})</span>
        </label>
      )}
      
      {/* Points list */}
      <div className="relative space-y-2">
        {points.map((point, index) => {
          const isExpanded = expandedPoint === point.id
          const isBase = point.type === 'base'
          const vehiclesOnTruck = getVehiclesOnTruck(index - 1)
          const summary = getPointSummary(point, index)
          const addrTrim = point.address?.trim() ?? ''
          const headerTitle = addrTrim
            ? addrTrim.length > 30
              ? `${addrTrim.slice(0, 30)}…`
              : addrTrim
            : summary.typeLabel
          const headerSubtitle = addrTrim ? summary.typeLabel : point.address || 'לא הוגדרה כתובת'
          
          return (
            <div key={point.id} className="relative">
              {/* Connector line */}
              {index > 0 && (
                <div className="absolute right-5 -top-1 w-0.5 h-1 bg-gray-300" />
              )}
              
              {/* Point card */}
              <div
                className={`rounded-xl border overflow-hidden transition-all bg-white border-gray-200 shadow-sm ${
                  isExpanded ? 'ring-2 ring-[#33d4ff]/35 shadow-md' : ''
                }`}
              >
                {/* Header */}
                <div
                  className={`flex items-center gap-3 p-3 cursor-pointer ${
                    isExpanded ? 'border-b border-gray-100' : ''
                  }`}
                  onClick={() => setExpandedPoint(isExpanded ? null : point.id)}
                >
                  {!isBase && <GripVertical size={18} className="shrink-0 text-gray-400" />}

                  <div
                    className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-lg ${
                      isBase
                        ? 'bg-blue-500 text-white'
                        : summary.color === 'green'
                          ? 'bg-green-100 text-green-700'
                          : summary.color === 'orange'
                            ? 'bg-orange-100 text-orange-700'
                            : summary.color === 'purple'
                              ? 'bg-purple-100 text-purple-700'
                              : summary.color === 'indigo'
                                ? 'bg-indigo-100 text-indigo-700'
                                : summary.color === 'amber'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {isBase ? <Home size={18} /> : <span aria-hidden>{summary.icon}</span>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800 text-sm">{headerTitle}</span>
                      {summary.vehicles && (
                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full truncate max-w-[200px]">
                          {summary.vehicles}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{headerSubtitle}</p>
                    {!isBase && (
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        {!point.isStopOnly &&
                          point.vehiclesToPickup.length + point.vehiclesToDropoff.length > 0 && (
                            <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                              🚗 {point.vehiclesToPickup.length + point.vehiclesToDropoff.length}
                            </span>
                          )}
                        {!point.isStopOnly && (point.services?.length ?? 0) > 0 && (
                          <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                            ⚙️ {point.services?.length}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isBase && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removePoint(point.id)
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    {isExpanded ? (
                      <ChevronUp size={18} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={18} className="text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="divide-y divide-gray-100">
                    {/* 1 — סוג נקודה + כתובת (שורה אחת) */}
                    <div className="flex items-center gap-2 p-3">
                      {!isBase && (
                        <div className="flex rounded-xl border border-gray-200 overflow-hidden shrink-0 divide-x divide-gray-200">
                          <button
                            type="button"
                            onClick={() =>
                              updatePoint(point.id, { isStopOnly: false, dropToStorage: false })
                            }
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                              !point.isStopOnly
                                ? 'bg-[#33d4ff] text-white'
                                : 'bg-white text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            איסוף / הורדה
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updatePoint(point.id, {
                                isStopOnly: true,
                                vehiclesToPickup: [],
                                vehiclesToDropoff: [],
                                dropToStorage: false,
                                services: []
                              })
                            }
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                              point.isStopOnly
                                ? 'bg-gray-600 text-white'
                                : 'bg-white text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            עצירה בלבד
                          </button>
                        </div>
                      )}
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <AddressInput
                          value={point.address}
                          onChange={(address: string) => updatePoint(point.id, { address })}
                          onAddressDataChange={(data) => updatePoint(point.id, { addressData: data })}
                          readOnly={isBase}
                          inputRef={point.id === newlyAddedPointId ? newPointAddressRef : undefined}
                        />
                        <button
                          type="button"
                          onClick={() => onPinDropClick?.(point.id)}
                          className="shrink-0 px-3 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
                        >
                          <MapPin size={16} className="text-red-500" />
                        </button>
                      </div>
                    </div>

                    {/* 2 — איש קשר */}
                    {!isBase && (
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-500 flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            איש קשר
                          </span>
                          {customerName && (
                            <button
                              type="button"
                              onClick={() =>
                                updatePoint(point.id, { contactName: customerName, contactPhone: customerPhone })
                              }
                              className="text-xs text-blue-600 hover:underline"
                            >
                              מלקוח
                            </button>
                          )}
                        </div>
                        {((index > 0 && points[index - 1]?.contactName) ||
                          (point.vehiclesToPickup.some((v) => !v.isWorking) &&
                            points.slice(0, index).some(
                              (p) => p.vehiclesToPickup.some((v) => v.isWorking) && p.contactName
                            ))) && (
                          <div className="flex gap-2 mb-2 flex-wrap">
                            {index > 0 && points[index - 1]?.contactName && (
                              <button
                                type="button"
                                onClick={() =>
                                  updatePoint(point.id, {
                                    contactName: points[index - 1].contactName,
                                    contactPhone: points[index - 1].contactPhone
                                  })
                                }
                                className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50"
                              >
                                מנקודה קודמת
                              </button>
                            )}
                            {point.vehiclesToPickup.some((v) => !v.isWorking) &&
                              (() => {
                                const workingPoint = points.slice(0, index).find(
                                  (p) => p.vehiclesToPickup.some((v) => v.isWorking) && p.contactName
                                )
                                return workingPoint ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updatePoint(point.id, {
                                        contactName: workingPoint.contactName,
                                        contactPhone: workingPoint.contactPhone
                                      })
                                    }
                                    className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50"
                                  >
                                    כמו בתקין
                                  </button>
                                ) : null
                              })()}
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">שם</label>
                            {customerContactPickerEnabled ? (
                              <ContactNameAutocomplete
                                value={point.contactName}
                                onChange={(contactName) =>
                                  updatePoint(point.id, { contactName })
                                }
                                onSelectContact={(contact) => {
                                  updatePoint(point.id, {
                                    contactName: contact.name,
                                    contactPhone: contact.phone ?? '',
                                  })
                                  onContactSelected?.(point.id)
                                }}
                                contacts={savedCustomerContacts}
                                loading={customerContactsLoading}
                                placeholder="שם איש קשר"
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                              />
                            ) : (
                              <input
                                type="text"
                                value={point.contactName}
                                onChange={(e) =>
                                  updatePoint(point.id, { contactName: e.target.value })
                                }
                                placeholder="שם איש קשר"
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                              />
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">טלפון</label>
                            <PhoneInput
                              value={point.contactPhone}
                              onChange={(phone) => updatePoint(point.id, { contactPhone: phone })}
                              placeholder="050-0000000"
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                            />
                          </div>
                        </div>
                        {customerContactPickerEnabled &&
                          shouldOfferSaveCustomerContact(
                            customerId,
                            point.contactName,
                            point.contactPhone,
                            savedCustomerContacts
                          ) &&
                          onSaveContactToggle && (
                            <SaveCustomerContactPill
                              className="mt-2"
                              visible
                              active={Boolean(saveContactByPointId[point.id])}
                              onToggle={() => onSaveContactToggle(point.id)}
                            />
                          )}
                      </div>
                    )}

                    {/* 3 — רכבים: שני טורים */}
                    {!isBase && !point.isStopOnly && (
                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-3 items-stretch">
                          {/* ימין — לאיסוף */}
                          <div className="rounded-xl border border-gray-200 p-3 flex flex-col gap-2 min-h-0">
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-gray-700">
                              <span className="text-sm font-medium flex items-center gap-1.5">
                                <ArrowUp size={14} className="text-gray-600 shrink-0" />
                                רכבים לאיסוף
                              </span>
                              <div className="flex gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => addVehicleToPickup(point.id, true)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.preventDefault()
                                  }}
                                  tabIndex={-1}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-green-500 text-white hover:bg-green-600"
                                >
                                  <Plus size={14} />
                                  תקין
                                </button>
                                <button
                                  type="button"
                                  onClick={() => addVehicleToPickup(point.id, false)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.preventDefault()
                                  }}
                                  tabIndex={-1}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-orange-500 text-white hover:bg-orange-600"
                                >
                                  <Plus size={14} />
                                  תקול
                                </button>
                              </div>
                            </div>
                            {storedVehicles.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium text-purple-700 mb-0 flex items-center gap-2">
                                    <Package size={16} />
                                    בחר רכב מאחסנה:
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setStoragePickupIsWorking((prev) => ({
                                        ...prev,
                                        [point.id]: true
                                      }))
                                    }
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      storagePickupIsWorking[point.id] !== false
                                        ? 'bg-green-500 text-white'
                                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                                  >
                                    תקין
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setStoragePickupIsWorking((prev) => ({
                                        ...prev,
                                        [point.id]: false
                                      }))
                                    }
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      storagePickupIsWorking[point.id] === false
                                        ? 'bg-orange-500 text-white'
                                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                                  >
                                    תקול
                                  </button>
                                </div>
                                {storedVehiclesLoading ? (
                                  <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                                    <Loader2 size={16} className="animate-spin" />
                                    טוען רכבים מאחסנה...
                                  </div>
                                ) : (
                                  (() => {
                                    const selectedIds = getSelectedStorageIds()
                                    const availableVehicles = storedVehicles.filter(
                                      (v) => !selectedIds.includes(v.id)
                                    )
                                    if (availableVehicles.length === 0) return null
                                    const pendingOk = storagePickupIsWorking[point.id] !== false
                                    return (
                                      <div className="border border-purple-200 rounded-lg p-3 bg-purple-50">
                                        <div className="flex flex-wrap gap-2">
                                          {availableVehicles.map((sv) => (
                                            <button
                                              key={sv.id}
                                              type="button"
                                              onClick={() => addVehicleFromStorage(point.id, sv)}
                                              className="px-3 py-2 border border-purple-300 rounded-lg bg-white hover:bg-purple-100 transition-colors text-sm flex items-center gap-2 flex-wrap"
                                            >
                                              <Package size={14} className="text-purple-500 shrink-0" />
                                              <span className="font-medium">{sv.plate_number}</span>
                                              <span
                                                className={
                                                  pendingOk
                                                    ? 'bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-md'
                                                    : 'bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-md'
                                                }
                                              >
                                                {pendingOk ? 'תקין' : 'תקול'}
                                              </span>
                                              {sv.vehicle_data && (
                                                <span className="text-xs text-gray-500">
                                                  {sv.vehicle_data.manufacturer} {sv.vehicle_data.model}
                                                </span>
                                              )}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )
                                  })()
                                )}
                              </div>
                            )}
                            <div className="flex flex-col gap-2 flex-1 min-h-0">
                              {point.vehiclesToPickup.map((vehicle) => (
                                <div key={vehicle.id} className="space-y-1">
                                  {vehicle.fromStorage && (
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={
                                          vehicle.isWorking
                                            ? 'bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-md'
                                            : 'bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-md'
                                        }
                                      >
                                        {vehicle.isWorking ? 'תקין' : 'תקול'}
                                      </span>
                                    </div>
                                  )}
                                  <VehicleCard
                                    vehicle={vehicle}
                                    onChange={(updatedVehicle) => updateVehicle(point.id, vehicle.id, updatedVehicle)}
                                    onRemove={() => removeVehicle(point.id, vehicle.id)}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* שמאל — להורדה */}
                          <div className="rounded-xl border border-gray-200 p-3 flex flex-col gap-2 min-h-0">
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-gray-700">
                              <span className="text-sm font-medium flex items-center gap-1.5">
                                <ArrowDown size={14} className="text-gray-600 shrink-0" />
                                רכבים להורדה
                              </span>
                              {!point.isStopOnly &&
                                point.vehiclesToDropoff.length > 0 &&
                                baseAddress && (
                                  <label className="inline-flex items-center gap-1.5 shrink-0 cursor-pointer rounded-lg border border-indigo-200 bg-white px-2 py-1 text-indigo-800">
                                    <input
                                      type="checkbox"
                                      checked={point.dropToStorage || false}
                                      onChange={(e) => {
                                        updatePoint(point.id, {
                                          dropToStorage: e.target.checked,
                                          address: e.target.checked ? baseAddress : point.address,
                                          addressData:
                                            e.target.checked && baseLat
                                              ? { lat: baseLat, lng: baseLng }
                                              : point.addressData,
                                        })
                                      }}
                                      className="w-3.5 h-3.5 rounded border-indigo-300 text-indigo-500 focus:ring-indigo-500"
                                    />
                                    <Package size={12} className="shrink-0" />
                                    <span className="text-xs font-medium whitespace-nowrap">הורדה לאחסנה</span>
                                  </label>
                                )}
                            </div>
                            {vehiclesOnTruck.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {vehiclesOnTruck.map((v) => {
                                  const selected = point.vehiclesToDropoff.includes(v.id)
                                  return (
                                    <div key={v.id} className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          updatePoint(point.id, {
                                            vehiclesToDropoff: selected
                                              ? point.vehiclesToDropoff.filter((id) => id !== v.id)
                                              : [...point.vehiclesToDropoff, v.id]
                                          })
                                        }}
                                        className="px-3 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-2 bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200/80"
                                      >
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${v.isWorking ? 'bg-green-400' : 'bg-red-400'}`} />
                                        {v.plateNumber || 'רכב חדש'}
                                        {selected && <Check size={14} className="shrink-0" />}
                                      </button>
                                      {selected && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            updatePoint(point.id, {
                                              vehiclesToDropoff: point.vehiclesToDropoff.filter((id) => id !== v.id)
                                            })
                                          }}
                                          className="shrink-0 p-1 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
                                          aria-label="הסר מהורדה"
                                        >
                                          <X size={14} />
                                        </button>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">אין רכבים להורדה</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4 — שירותים + הערות */}
                    {!isBase && (
                      <div className="grid grid-cols-2 gap-3 p-4">
                        {!point.isStopOnly && serviceSurchargesData.length > 0 && (
                          <div className="flex flex-col gap-2 min-w-0">
                            <span className="text-sm font-medium text-gray-500">שירותים נוספים</span>
                            <button
                              type="button"
                              onClick={() => setServicesModalPointId(point.id)}
                              className={`w-fit flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                                (point.services?.length ?? 0) > 0
                                  ? 'border-cyan-300 bg-cyan-50 text-cyan-800'
                                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                              }`}
                            >
                              ⚙️{' '}
                              {(point.services?.length ?? 0) > 0
                                ? `שירותים (${point.services?.length})`
                                : 'שירותים נוספים'}
                            </button>
                            {(point.services?.length ?? 0) > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {point.services!.map((s) => (
                                  <span
                                    key={s.id}
                                    className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs border border-gray-200"
                                  >
                                    {serviceLabel(serviceSurchargesData, s.id)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <div
                          className={`flex flex-col gap-2 min-w-0 ${
                            !point.isStopOnly && serviceSurchargesData.length > 0 ? '' : 'col-span-2'
                          }`}
                        >
                          <label className="block text-sm font-medium text-gray-500">הערות</label>
                          <textarea
                            value={point.notes}
                            onChange={(e) => updatePoint(point.id, { notes: e.target.value })}
                            placeholder="הערות לנקודה זו..."
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] resize-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        
        {/* Add point button */}
        <button
          type="button"
          onClick={addPoint}
          className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-[#33d4ff] hover:text-[#33d4ff] transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          <span className="font-medium">הוסף נקודה</span>
        </button>
      </div>

      {/* Truck Type Selector */}
      <div 
        ref={truckTypeSectionRef}
        className={`rounded-xl transition-all ${truckTypeError ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}
      >
        <TowTruckTypeSelector
          selectedTypes={requiredTruckTypes}
          onChange={onRequiredTruckTypesChange || (() => {})}
        />
        {truckTypeError && (
          <p className="text-red-500 text-sm mt-2 font-medium">⚠️ יש לבחור סוג גרר נדרש</p>
        )}
      </div>

      
      {/* Summary */}
      {points.length > 0 && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <h3 className="font-medium text-gray-800 mb-2">סיכום מסלול</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>📍 {points.filter(p => p.type !== 'base').length} נקודות</p>
            <p className="flex items-center gap-2 flex-wrap">
              <span>📏 מרחק נסיעה משוער:</span>
              {distanceLoading ? (
                <Loader2 size={16} className="animate-spin text-gray-500" aria-label="מחשב מרחק" />
              ) : (
                <span>{totalDistance} ק״מ</span>
              )}
            </p>
            <p>🚗 {points.reduce((sum, p) => sum + p.vehiclesToPickup.length, 0)} רכבים</p>
            {points.some(p => p.dropToStorage) && (
              <p>📦 כולל הורדה לאחסנה</p>
            )}
          </div>
        </div>
      )}

      {servicesModalPoint && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-gray-800 text-base">שירותים נוספים</h3>
              <button
                type="button"
                onClick={() => setServicesModalPointId(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              <ServiceSurchargeSelector
                services={serviceSurchargesData}
                selectedServices={servicesModalPoint.services ?? []}
                onChange={(next) => updatePoint(servicesModalPoint.id, { services: next })}
                label=" "
              />
            </div>
            <div className="px-4 pb-4 shrink-0">
              <button
                type="button"
                onClick={() => setServicesModalPointId(null)}
                className="w-full py-2.5 bg-[#33d4ff] text-white rounded-xl text-sm font-medium hover:bg-[#21b8e6]"
              >
                אישור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Re-export types and helpers
export type { VehicleOnTruck, AddressData }
export { createEmptyVehicle }
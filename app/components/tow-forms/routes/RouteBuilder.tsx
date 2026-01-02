'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  MapPin, Plus, ChevronDown, ChevronUp, GripVertical, Trash2, Home,
  ArrowDown, ArrowUp, User, Copy, Check, Package
} from 'lucide-react'
import { getStoredVehicles, StoredVehicleWithCustomer } from '../../../lib/queries/storage'

// Import extracted components
import { AddressInput, loadGoogleMaps, AddressData } from './AddressInput'
import { VehicleCard, VehicleOnTruck, createEmptyVehicle } from './VehicleCard'
import { StorageVehicleSelector, StorageNotification } from './StorageVehicleSelector'

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
  onRouteDataChange?: (data: { totalDistanceKm: number; vehicles: { type: string; isWorking: boolean }[] }) => void
  pinDropResult?: { pointId: string; data: { address: string; lat?: number; lng?: number; placeId?: string } } | null
  onPinDropHandled?: () => void
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
    vehiclesToDropoff: []
  }
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
  onPinDropHandled
}: RouteBuilderProps) {
  const [points, setPoints] = useState<RoutePoint[]>([])
  const [expandedPoint, setExpandedPoint] = useState<string | null>(null)
  const [startFromBase, setStartFromBase] = useState(false)
  const [storedVehicles, setStoredVehicles] = useState<StoredVehicleWithCustomer[]>([])
  const [storedVehiclesLoading, setStoredVehiclesLoading] = useState(false)
  const [totalDistance, setTotalDistance] = useState(0)
  const newPointAddressRef = useRef<HTMLInputElement>(null!)
  const [newlyAddedPointId, setNewlyAddedPointId] = useState<string | null>(null)

  // Calculate total distance between all points
  useEffect(() => {
    const calculateTotalDistance = async () => {
      if (points.length < 2) {
        setTotalDistance(0)
        return
      }

      // Filter points with valid addresses
      const validPoints = points.filter(p => p.address && p.addressData?.lat && p.addressData?.lng)
      if (validPoints.length < 2) {
        setTotalDistance(0)
        return
      }

      let total = 0
      
      // Calculate distance between consecutive points using Haversine formula
      for (let i = 0; i < validPoints.length - 1; i++) {
        const from = validPoints[i]
        const to = validPoints[i + 1]
        
        if (from.addressData?.lat && from.addressData?.lng && to.addressData?.lat && to.addressData?.lng) {
          const R = 6371 // Earth's radius in km
          const dLat = (to.addressData.lat - from.addressData.lat) * Math.PI / 180
          const dLon = (to.addressData.lng - from.addressData.lng) * Math.PI / 180
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(from.addressData.lat * Math.PI / 180) * Math.cos(to.addressData.lat * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
          const distance = R * c
          total += distance
        }
      }
      
      setTotalDistance(Math.round(total * 10) / 10)
    }

    calculateTotalDistance()
  }, [points])

  // Notify parent of route data changes
  useEffect(() => {
    const vehicles = points.flatMap(p => 
      p.vehiclesToPickup.map(v => ({
        type: 'private',
        isWorking: v.isWorking
      }))
    )
    
    onRouteDataChange?.({
      totalDistanceKm: totalDistance,
      vehicles
    })
  }, [totalDistance, points, onRouteDataChange])  

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
    onPointsChange?.(points)
  }, [points, onPointsChange])

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
    console.log('updatePoints:', newPoints.map((p: RoutePoint) => ({ id: p.id, address: p.address })))
    setPoints(newPoints)
    onPointsChange?.(newPoints)
  }

  const updatePointFunctional = (id: string, updates: Partial<RoutePoint>) => {
    setPoints(currentPoints => {
      const newPoints = currentPoints.map(p => p.id === id ? { ...p, ...updates } : p)
      console.log('updatePointFunctional:', newPoints.map((p: RoutePoint) => ({ id: p.id, address: p.address })))
      onPointsChange?.(newPoints)
      return newPoints
    })
  }

  const addPoint = () => {
    const newPoint = createEmptyPoint('stop')
    updatePoints([...points, newPoint])
    setExpandedPoint(newPoint.id)
    setNewlyAddedPointId(newPoint.id)
  }

  const removePoint = (id: string) => {
    updatePoints(points.filter(p => p.id !== id))
  }

  const updatePoint = (id: string, updates: Partial<RoutePoint>) => {
    console.log('updatePoint:', { id, updates })
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
    const newVehicle: VehicleOnTruck = {
      id: `vehicle_${Date.now()}`,
      plateNumber: storedVehicle.plate_number,
      isWorking: true,
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
        vehiclesToDropoff: []
      }
      updatePoints([basePoint, ...points])
    }
    setStartFromBase(!startFromBase)
  }

  // Get point summary for collapsed view
  const getPointSummary = (point: RoutePoint, index: number) => {
    if (point.type === 'base') {
      return { typeLabel: '🏠 בסיס', vehicles: '', icon: '🏠', color: 'blue' }
    }
    
    if (point.isStopOnly) {
      return { typeLabel: '📍 עצירה', vehicles: point.notes || '', icon: '📍', color: 'amber' }
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
      typeLabel = '🔄 העלאה + הורדה'
      icon = '🔄'
      vehicles = `⬆️ ${pickupPlates} | ⬇️ ${dropoffPlates}`
      color = 'purple'
    } else if (pickupCount > 0) {
      typeLabel = '⬆️ איסוף'
      icon = '⬆️'
      vehicles = pickupPlates
      color = 'green'
    } else if (dropoffCount > 0) {
      typeLabel = point.dropToStorage ? '📦 הורדה לאחסנה' : '⬇️ הורדה'
      icon = point.dropToStorage ? '📦' : '⬇️'
      vehicles = dropoffPlates
      color = point.dropToStorage ? 'indigo' : 'orange'
    } else {
      typeLabel = '📍 נקודה'
      icon = '📍'
      color = 'gray'
    }
    
    return { typeLabel, vehicles, icon, color }
  }

  return (
    <div className="space-y-4">
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
          
          return (
            <div key={point.id} className="relative">
              {/* Connector line */}
              {index > 0 && (
                <div className="absolute right-5 -top-1 w-0.5 h-1 bg-gray-300" />
              )}
              
              {/* Point card */}
              <div className={`border-2 rounded-xl overflow-hidden transition-all ${
                isExpanded ? 'border-[#33d4ff] shadow-md' : 'border-gray-200'
              } ${
                isBase ? 'bg-blue-50' : 
                point.isStopOnly ? 'bg-amber-50' : 
                point.dropToStorage ? 'bg-indigo-50' :
                'bg-white'
              }`}>
                
                {/* Header */}
                <div
                  className={`flex items-center gap-3 p-3 cursor-pointer ${
                    isExpanded ? 'border-b border-gray-200' : ''
                  }`}
                  onClick={() => setExpandedPoint(isExpanded ? null : point.id)}
                >
                  {!isBase && (
                    <GripVertical size={18} className="text-gray-400" />
                  )}
                  
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                    isBase ? 'bg-blue-500 text-white' : 
                    summary.color === 'green' ? 'bg-green-100 text-green-600' :
                    summary.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                    summary.color === 'purple' ? 'bg-purple-100 text-purple-600' :
                    summary.color === 'indigo' ? 'bg-indigo-100 text-indigo-600' :
                    summary.color === 'amber' ? 'bg-amber-100 text-amber-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {isBase ? <Home size={18} /> : summary.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800 text-sm">{summary.typeLabel}</span>
                      {summary.vehicles && (
                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full truncate max-w-[200px]">
                          {summary.vehicles}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {point.address || 'לא הוגדרה כתובת'}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {!isBase && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removePoint(point.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                  </div>
                </div>
                
                {/* Expanded content */}
                {isExpanded && (
                  <div className="p-4 space-y-4">
                    {/* Point type selector - not for base */}
                    {!isBase && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">סוג נקודה</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => updatePoint(point.id, { isStopOnly: false, dropToStorage: false })}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border-2 transition-all ${
                              !point.isStopOnly && !point.dropToStorage
                                ? 'border-[#33d4ff] bg-cyan-50 text-cyan-700' 
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            🚗 איסוף / הורדת רכבים
                          </button>
                          <button
                            type="button"
                            onClick={() => updatePoint(point.id, { isStopOnly: true, vehiclesToPickup: [], vehiclesToDropoff: [], dropToStorage: false })}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border-2 transition-all ${
                              point.isStopOnly 
                                ? 'border-amber-500 bg-amber-50 text-amber-700' 
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            📍 עצירה בלבד
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Address */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        <MapPin size={14} className="inline ml-1 text-gray-400" />
                        כתובת
                      </label>
                      <div className="flex gap-2">
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
                          className="px-3 py-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                        >
                          <MapPin size={16} className="text-red-500" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Contact - not for base */}
                    {!isBase && (
                      <div className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <User size={14} className="text-gray-400" />
                            איש קשר
                          </label>
                          <div className="flex gap-2">
                            {customerName && (
                              <button
                                type="button"
                                onClick={() => updatePoint(point.id, { contactName: customerName, contactPhone: customerPhone })}
                                className="px-2 py-1 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 flex items-center gap-1"
                              >
                                <Copy size={12} />
                                מלקוח
                              </button>
                            )}
                            {index > 0 && points[index - 1]?.contactName && (
                              <button
                                type="button"
                                onClick={() => updatePoint(point.id, { 
                                  contactName: points[index - 1].contactName,
                                  contactPhone: points[index - 1].contactPhone
                                })}
                                className="px-2 py-1 text-xs border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-1"
                              >
                                <Copy size={12} />
                                מנקודה קודמת
                              </button>
                            )}
                            {point.vehiclesToPickup.some(v => !v.isWorking) && (() => {
                              const workingPoint = points.slice(0, index).find(p => 
                                p.vehiclesToPickup.some(v => v.isWorking) && p.contactName
                              )
                              return workingPoint ? (
                                <button
                                  type="button"
                                  onClick={() => updatePoint(point.id, { 
                                    contactName: workingPoint.contactName,
                                    contactPhone: workingPoint.contactPhone
                                  })}
                                  className="px-2 py-1 text-xs border border-green-300 text-green-600 rounded-lg hover:bg-green-50 flex items-center gap-1"
                                >
                                  <Copy size={12} />
                                  כמו בתקין
                                </button>
                              ) : null
                            })()}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">שם</label>
                            <input
                              type="text"
                              value={point.contactName}
                              onChange={(e) => updatePoint(point.id, { contactName: e.target.value })}
                              placeholder="שם איש קשר"
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">טלפון</label>
                            <input
                              type="tel"
                              value={point.contactPhone}
                              onChange={(e) => updatePoint(point.id, { contactPhone: e.target.value })}
                              placeholder="050-0000000"
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Vehicles to dropoff */}
                    {!isBase && !point.isStopOnly && vehiclesOnTruck.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <ArrowDown size={14} className="inline ml-1 text-orange-500" />
                          רכבים להורדה
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {vehiclesOnTruck.map(v => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                const isSelected = point.vehiclesToDropoff.includes(v.id)
                                updatePoint(point.id, {
                                  vehiclesToDropoff: isSelected
                                    ? point.vehiclesToDropoff.filter(id => id !== v.id)
                                    : [...point.vehiclesToDropoff, v.id]
                                })
                              }}
                              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-2 ${
                                point.vehiclesToDropoff.includes(v.id)
                                  ? 'bg-orange-500 text-white border-orange-500'
                                  : 'bg-white text-gray-700 border-gray-300 hover:border-orange-300'
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${v.isWorking ? 'bg-green-400' : 'bg-red-400'}`} />
                              {v.plateNumber || 'רכב חדש'}
                              {point.vehiclesToDropoff.includes(v.id) && <Check size={14} />}
                            </button>
                          ))}
                        </div>
                        
                        {/* Drop to storage option */}
                        {point.vehiclesToDropoff.length > 0 && baseAddress && (
                          <label className="flex items-center gap-2 cursor-pointer text-sm text-indigo-600 bg-indigo-50 p-2 rounded-lg border border-indigo-200">
                            <input
                              type="checkbox"
                              checked={point.dropToStorage || false}
                              onChange={(e) => {
                                updatePoint(point.id, { 
                                  dropToStorage: e.target.checked,
                                  address: e.target.checked ? baseAddress : point.address,
                                  addressData: e.target.checked && baseLat ? { lat: baseLat, lng: baseLng } : point.addressData
                                })
                              }}
                              className="w-4 h-4 rounded border-indigo-300 text-indigo-500 focus:ring-indigo-500"
                            />
                            <Package size={14} />
                            הורדה לאחסנה (בסיס)
                          </label>
                        )}
                      </div>
                    )}
                    
                    {/* Vehicles to pickup */}
                    {!isBase && !point.isStopOnly && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <ArrowUp size={14} className="inline ml-1 text-green-500" />
                          רכבים לאיסוף
                        </label>
                        
                        {/* Storage vehicle selector */}
                        {storedVehicles.length > 0 && (
                          <div className="mb-3">
                            <StorageVehicleSelector
                              storedVehicles={storedVehicles}
                              onSelect={(sv) => addVehicleFromStorage(point.id, sv)}
                              loading={storedVehiclesLoading}
                              selectedIds={getSelectedStorageIds()}
                            />
                          </div>
                        )}
                        
                        {/* Vehicle cards */}
                        {point.vehiclesToPickup.map((vehicle) => (
                          <VehicleCard
                            key={vehicle.id}
                            vehicle={vehicle}
                            onChange={(updatedVehicle) => updateVehicle(point.id, vehicle.id, updatedVehicle)}
                            onRemove={() => removeVehicle(point.id, vehicle.id)}
                            className="mb-3"
                          />
                        ))}
                        
                        {/* Add vehicle buttons */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => addVehicleToPickup(point.id, true)}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                            tabIndex={-1}
                            className="flex-1 py-2.5 border-2 border-dashed border-green-300 rounded-xl text-sm text-green-600 hover:border-green-400 hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
                          >
                            <Plus size={16} />
                            רכב תקין
                          </button>
                          <button
                            type="button"
                            onClick={() => addVehicleToPickup(point.id, false)}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                            tabIndex={-1}
                            className="flex-1 py-2.5 border-2 border-dashed border-orange-300 rounded-xl text-sm text-orange-600 hover:border-orange-400 hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
                          >
                            <Plus size={16} />
                            רכב תקול
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Notes */}
                    {!isBase && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">הערות</label>
                        <textarea
                          value={point.notes}
                          onChange={(e) => updatePoint(point.id, { notes: e.target.value })}
                          placeholder="הערות לנקודה זו..."
                          rows={2}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] resize-none"
                        />
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
      
      {/* Summary */}
      {points.length > 0 && (
        <div className="p-4 bg-gray-100 rounded-xl">
          <h3 className="font-medium text-gray-800 mb-2">סיכום מסלול</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>📍 {points.filter(p => p.type !== 'base').length} נקודות</p>
            <p>🚗 {points.reduce((sum, p) => sum + p.vehiclesToPickup.length, 0)} רכבים</p>
            {points.some(p => p.dropToStorage) && (
              <p>📦 כולל הורדה לאחסנה</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Re-export types and helpers
export type { VehicleOnTruck, AddressData }
export { createEmptyVehicle }
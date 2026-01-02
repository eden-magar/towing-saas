'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin } from 'lucide-react'

// ==================== Google Maps Loading ====================

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
let isGoogleMapsLoaded = false
let isGoogleMapsLoading = false
let googleMapsCallbacks: Array<() => void> = []

export function loadGoogleMaps(): Promise<void> {
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

// ==================== Types ====================

export interface AddressData {
  address: string
  placeId?: string
  lat?: number
  lng?: number
  isPinDropped?: boolean
}

interface AddressInputProps {
  // Support both string and AddressData
  value: string | AddressData
  onChange: ((value: string) => void) | ((data: AddressData) => void)
  onAddressDataChange?: (data: { placeId?: string; lat?: number; lng?: number }) => void
  onAddressSelect?: (data: AddressData) => void
  placeholder?: string
  readOnly?: boolean
  className?: string
  // Props from old interface
  label?: string
  required?: boolean
  onPinDropClick?: () => void
  // External ref for focus control
  inputRef?: React.RefObject<HTMLInputElement>
}

// ==================== Component ====================

export function AddressInput({ 
  value, 
  onChange, 
  onAddressDataChange,
  onAddressSelect,
  placeholder = 'הזן כתובת',
  readOnly = false,
  className = '',
  label,
  required,
  onPinDropClick,
  inputRef: externalRef
}: AddressInputProps) {
  const internalRef = useRef<HTMLInputElement>(null)
  const inputRef = externalRef || internalRef
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  
  // Handle both string and AddressData value types
  const addressString = typeof value === 'string' ? value : (value?.address || '')
  const [localValue, setLocalValue] = useState(addressString)
  const isSelectingRef = useRef(false)
  
  // Detect if using old interface (AddressData) or new interface (string)
  const isAddressDataMode = typeof value === 'object'

  // Sync with parent value
  useEffect(() => {
    if (!isSelectingRef.current) {
      const newValue = typeof value === 'string' ? value : (value?.address || '')
      setLocalValue(newValue) // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [value])

  useEffect(() => {
    if (readOnly) return
    
    const initAutocomplete = async () => {
      await loadGoogleMaps()
      if (!inputRef.current || !window.google?.maps?.places || autocompleteRef.current) return
      
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'il' },
        fields: ['formatted_address', 'name', 'place_id', 'geometry'],
        types: ['establishment', 'geocode']
      })
      
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (!place.formatted_address && !place.name) return
        
        let selectedAddress = place.formatted_address || place.name || ''
        if (place.name && place.formatted_address && !place.formatted_address.startsWith(place.name)) {
          selectedAddress = `${place.name}, ${place.formatted_address}`
        }
        
        isSelectingRef.current = true
        setLocalValue(selectedAddress)
        console.log('AddressInput place_changed:', { selectedAddress, isAddressDataMode })

        
        const addressData: AddressData = {
          address: selectedAddress,
          placeId: place.place_id,
          lat: place.geometry?.location?.lat(),
          lng: place.geometry?.location?.lng()
        }
        
        // Call appropriate onChange based on mode
        if (isAddressDataMode) {
          (onChange as (data: AddressData) => void)(addressData)
        } else {
          (onChange as (value: string) => void)(selectedAddress)
          onAddressDataChange?.({
            placeId: place.place_id,
            lat: place.geometry?.location?.lat(),
            lng: place.geometry?.location?.lng()
          })
        }
        
        onAddressSelect?.(addressData)
        
        // Reset flag after a short delay
        setTimeout(() => {
          isSelectingRef.current = false
        }, 100)
      })
      
      autocompleteRef.current = autocomplete
    }
    
    initAutocomplete()
  }, [onChange, onAddressDataChange, onAddressSelect, readOnly, isAddressDataMode])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    
    if (isAddressDataMode) {
      // In AddressData mode, update with partial data
      const existingData = value as AddressData
      (onChange as (data: AddressData) => void)({
        ...existingData,
        address: newValue
      })
    } else {
      (onChange as (value: string) => void)(newValue)
    }
  }

  // Simple input without label (new style - used by RouteBuilder)
  if (!label) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] ${
          readOnly ? 'bg-gray-50' : ''
        } ${className}`}
      />
    )
  }

  // With label (old style - used by SingleRoute)
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 mr-1">*</span>}
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          readOnly={readOnly}
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
        />
        {onPinDropClick && (
          <button
            type="button"
            onClick={onPinDropClick}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-red-500 transition-colors"
            title="הנח סיכה על המפה"
          >
            <MapPin size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
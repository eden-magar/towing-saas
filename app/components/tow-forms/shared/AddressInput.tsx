'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin, Navigation } from 'lucide-react'

// Google Maps Types
export interface AddressData {
  address: string
  placeId?: string
  lat?: number
  lng?: number
  isPinDropped?: boolean
}

interface AddressInputProps {
  value: AddressData
  onChange: (data: AddressData) => void
  placeholder?: string
  label?: string
  required?: boolean
  onPinDropClick?: () => void
}

// Google Maps Loading (shared)
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

export function AddressInput({ 
  value, 
  onChange, 
  placeholder = 'הזן כתובת...', 
  label, 
  required, 
  onPinDropClick 
}: AddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState(value.address || '')
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  useEffect(() => {
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
      
      // נשתמש ב-formatted_address שכולל את העיר, או נשלב את שניהם
      let selectedAddress = place.formatted_address || place.name || ''

      // אם יש name שונה מ-formatted_address, נציג את שניהם
      if (place.name && place.formatted_address && !place.formatted_address.startsWith(place.name)) {
        selectedAddress = `${place.name}, ${place.formatted_address}`
      }

      setInputValue(selectedAddress)
      
      console.log('Address selected:', {
        address: selectedAddress,
        lat: place.geometry?.location?.lat(),
        lng: place.geometry?.location?.lng()
      })
      
      onChange({
        address: selectedAddress,
        placeId: place.place_id,
        lat: place.geometry?.location?.lat(),
        lng: place.geometry?.location?.lng(),
        isPinDropped: false
      })
    })

    autocompleteRef.current = autocomplete
    }

    initAutocomplete()
  }, [onChange])

  useEffect(() => {
    if (value.address !== inputValue) {
      setInputValue(value.address || '')
    }
  }, [value.address])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    onChange({ address: e.target.value, isPinDropped: false })
  }

  const hasCoords = !!(value.lat && value.lng)

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 mr-1">*</span>}
        </label>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder={placeholder}
            className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] ${
              hasCoords ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'
            }`}
          />
          {hasCoords && (
            <Navigation size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600" />
          )}
        </div>
        {onPinDropClick && (
          <button
            type="button"
            onClick={onPinDropClick}
            className={`px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              value.isPinDropped
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
            }`}
          >
            <MapPin size={16} />
            <span className="hidden sm:inline">{value.isPinDropped ? 'סיכה ✓' : 'הנח סיכה'}</span>
          </button>
        )}
      </div>
      {value.isPinDropped && (
        <p className="text-xs text-emerald-600 flex items-center gap-1">
          <Navigation size={12} />
          מיקום מדויק נבחר מהמפה
        </p>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { Link2, Loader2, MapPin } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

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
  /** When true, render input + optional pin row without a visible label (use with external label). */
  hideLabel?: boolean
  required?: boolean
  onPinDropClick?: () => void
  // External ref for focus control
  inputRef?: React.RefObject<HTMLInputElement>
  isMobile?: boolean
}

const LINK_RESOLVE_ERROR = 'לא הצלחנו לזהות מיקום מהקישור'

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
  hideLabel,
  required,
  onPinDropClick,
  inputRef: externalRef,
  isMobile = false,
}: AddressInputProps) {
  const internalRef = useRef<HTMLInputElement>(null)
  const inputRef = externalRef || internalRef
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  
  // Handle both string and AddressData value types
  const addressString = typeof value === 'string' ? value : (value?.address || '')
  const [localValue, setLocalValue] = useState(addressString)
  const isSelectingRef = useRef(false)

  const [linkPanelOpen, setLinkPanelOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  
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

  const applyResolvedAddress = (address: string, lat: number, lng: number) => {
    isSelectingRef.current = true
    setLocalValue(address)

    if (isAddressDataMode) {
      (onChange as (data: AddressData) => void)({
        address,
        lat,
        lng,
        isPinDropped: false,
      })
    } else {
      (onChange as (value: string) => void)(address)
      onAddressDataChange?.({ lat, lng })
    }

    onAddressSelect?.({ address, lat, lng, isPinDropped: false })

    setTimeout(() => {
      isSelectingRef.current = false
    }, 100)
  }

  const handleSubmitLink = async () => {
    const trimmed = linkUrl.trim()
    if (!trimmed) return

    setLinkLoading(true)
    setLinkError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        setLinkError(LINK_RESOLVE_ERROR)
        return
      }

      const res = await fetch('/api/resolve-map-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: trimmed }),
      })

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        address?: string
        lat?: number
        lng?: number
      }

      if (!res.ok || !data.ok || data.lat == null || data.lng == null || !data.address) {
        setLinkError(LINK_RESOLVE_ERROR)
        return
      }

      applyResolvedAddress(data.address, data.lat, data.lng)
      setLinkPanelOpen(false)
      setLinkUrl('')
      setLinkError(null)
    } catch {
      setLinkError(LINK_RESOLVE_ERROR)
    } finally {
      setLinkLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    
    if (isAddressDataMode) {
      // Drop stale coordinates until user picks from autocomplete / pin / link
      (onChange as (data: AddressData) => void)({
        address: newValue,
      })
    } else {
      (onChange as (value: string) => void)(newValue)
    }
  }

  const inputClassName = isMobile
    ? 'flex-1 min-w-0 px-4 h-12 border border-gt-border rounded-xl text-sm text-gt-text-primary placeholder:text-gt-text-tertiary hover:border-gt-border-strong focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/15'
    : 'flex-1 min-w-0 px-4 py-2.5 border border-gt-border rounded-xl text-sm text-gt-text-primary placeholder:text-gt-text-tertiary hover:border-gt-border-strong focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/15'

  const actionButtonClassName = isMobile
    ? 'shrink-0 px-3 min-h-[48px] min-w-[48px] flex items-center justify-center border border-gt-border rounded-xl text-gray-500 hover:bg-gray-50 hover:border-gt-border-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
    : 'shrink-0 px-3 py-2.5 border border-gt-border rounded-xl text-gray-500 hover:bg-gray-50 hover:border-gt-border-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  const renderLinkButton = () => {
    if (readOnly) return null
    return (
      <button
        type="button"
        onClick={() => {
          setLinkPanelOpen((open) => !open)
          setLinkError(null)
        }}
        disabled={linkLoading}
        className={`${actionButtonClassName} ${linkPanelOpen ? 'border-gt-brand text-gt-brand bg-gt-brand/5' : ''}`}
        title="הדבק קישור מ-Google Maps או Waze"
        aria-expanded={linkPanelOpen}
      >
        {linkLoading ? <Loader2 size={18} className="animate-spin" /> : <Link2 size={18} />}
      </button>
    )
  }

  const renderLinkPanel = () => {
    if (!linkPanelOpen || readOnly) return null
    return (
      <div className="mt-2 p-3 border border-gt-border rounded-xl bg-gray-50 space-y-2">
        <label className="block text-xs font-medium text-gray-600">
          הדבק קישור מ-Google Maps או Waze
        </label>
        <input
          type="url"
          value={linkUrl}
          onChange={(e) => {
            setLinkUrl(e.target.value)
            setLinkError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleSubmitLink()
            }
          }}
          placeholder="https://maps.app.goo.gl/... או https://waze.com/ul/..."
          dir="ltr"
          disabled={linkLoading}
          className="w-full px-3 py-2 border border-gt-border rounded-lg text-sm text-gt-text-primary placeholder:text-gt-text-tertiary focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/15 disabled:bg-gray-100"
        />
        {linkError && (
          <p className="text-xs text-red-600" role="alert">
            {linkError}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => {
              setLinkPanelOpen(false)
              setLinkUrl('')
              setLinkError(null)
            }}
            disabled={linkLoading}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={() => void handleSubmitLink()}
            disabled={linkLoading || !linkUrl.trim()}
            className="px-3 py-1.5 text-sm font-medium text-white bg-gt-brand rounded-lg hover:bg-[#21b8e6] disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {linkLoading && <Loader2 size={14} className="animate-spin" />}
            אישור
          </button>
        </div>
      </div>
    )
  }

  const renderInputRow = (inputClasses: string) => (
    <>
      <div className="flex gap-2 items-stretch min-w-0">
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          readOnly={readOnly}
          className={inputClasses}
        />
        {renderLinkButton()}
        {onPinDropClick && (
          <button
            type="button"
            onClick={onPinDropClick}
            className={`${actionButtonClassName} hover:text-red-500`}
            title="הנח סיכה על המפה"
          >
            <MapPin size={18} />
          </button>
        )}
      </div>
      {renderLinkPanel()}
    </>
  )

  // Simple input without label (new style - used by RouteBuilder)
  if (!label && !hideLabel) {
    return (
      <div className={`flex-1 min-w-0 ${className}`}>
        {renderInputRow(
          isMobile
            ? `flex-1 min-w-0 px-3 h-12 border border-gt-border rounded-lg text-sm text-gt-text-primary placeholder:text-gt-text-tertiary hover:border-gt-border-strong focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/15 ${
                readOnly ? 'bg-gray-50' : ''
              }`
            : `flex-1 min-w-0 px-3 py-2.5 border border-gt-border rounded-lg text-sm text-gt-text-primary placeholder:text-gt-text-tertiary hover:border-gt-border-strong focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/15 ${
                readOnly ? 'bg-gray-50' : ''
              }`
        )}
      </div>
    )
  }

  // With label (old style - used by SingleRoute) or hideLabel (create page stops)
  return (
    <div className={className ? `min-w-0 w-full ${className}` : 'min-w-0 w-full'}>
      {!hideLabel && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {required && <span className="text-red-500 mr-1">*</span>}
        </label>
      )}
      {renderInputRow(inputClassName)}
    </div>
  )
}

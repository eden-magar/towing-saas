'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { Link2, Loader2, MapPin } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { StorageYardConfirmDialog } from '../shared/StorageYardConfirmDialog'
import {
  matchesStorageYard,
  storageYardDismissKey,
  type YardAddressRef,
} from '../../../lib/utils/storage-yard-match'
import { installPacContainerViewportClamp } from '../../../lib/utils/clamp-pac-container'

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

/** Optional yard-match confirm when address equals company storage base. */
export type StorageYardConfirmProp = {
  role: 'pickup' | 'dropoff'
  yard: YardAddressRef | null | undefined
  /** True when the relevant storage flag is already set — never prompt. */
  alreadyFlagged: boolean
  onConfirm: () => void
  /** Stable field id so "לא, רק כתובת" sticks for this point+address. */
  fieldKey: string
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
  /**
   * Extra inline actions after map-pin + paste-link (e.g. save-address bookmark).
   * Layout slot only — does not affect Places / link resolve.
   */
  extraActions?: ReactNode
  // External ref for focus control
  inputRef?: React.RefObject<HTMLInputElement>
  isMobile?: boolean
  /** Compact desktop column layout — h-9 inputs, rounded-lg, border-gray-200. Does not affect isMobile. */
  narrowColumn?: boolean
  storageYardConfirm?: StorageYardConfirmProp | null
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
  extraActions,
  inputRef: externalRef,
  isMobile = false,
  narrowColumn = false,
  storageYardConfirm = null,
}: AddressInputProps) {
  const internalRef = useRef<HTMLInputElement>(null)
  const inputRef = externalRef || internalRef
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  const isNarrow = narrowColumn ?? false
  const isMobileSized = isMobile ?? false
  
  // Handle both string and AddressData value types
  const addressString = typeof value === 'string' ? value : (value?.address || '')
  const [localValue, setLocalValue] = useState(addressString)
  const isSelectingRef = useRef(false)
  const dismissedYardKeysRef = useRef<Set<string>>(new Set())
  const [yardConfirmOpen, setYardConfirmOpen] = useState(false)

  const maybeAskYardConfirm = useCallback(
    (entered: AddressData) => {
      const cfg = storageYardConfirm
      if (!cfg || cfg.alreadyFlagged) {
        setYardConfirmOpen(false)
        return
      }
      if (!matchesStorageYard(entered, cfg.yard)) return
      const key = storageYardDismissKey(cfg.fieldKey, entered.address)
      if (dismissedYardKeysRef.current.has(key)) return
      setYardConfirmOpen(true)
    },
    [storageYardConfirm],
  )
  const maybeAskYardConfirmRef = useRef(maybeAskYardConfirm)
  maybeAskYardConfirmRef.current = maybeAskYardConfirm

  useEffect(() => {
    if (storageYardConfirm?.alreadyFlagged) {
      setYardConfirmOpen(false)
    }
  }, [storageYardConfirm?.alreadyFlagged])

  // Pin-drop / parent-driven updates (coords present)
  useEffect(() => {
    if (!storageYardConfirm || storageYardConfirm.alreadyFlagged) return
    if (typeof value === 'string') return
    if (!value?.address?.trim()) return
    if (value.lat == null || value.lng == null) return
    maybeAskYardConfirm(value)
  }, [
    typeof value === 'string' ? value : value?.address,
    typeof value === 'string' ? undefined : value?.lat,
    typeof value === 'string' ? undefined : value?.lng,
    storageYardConfirm?.alreadyFlagged,
    storageYardConfirm?.fieldKey,
    maybeAskYardConfirm,
  ])

  const handleYardConfirm = () => {
    setYardConfirmOpen(false)
    storageYardConfirm?.onConfirm()
  }

  const handleYardDismiss = () => {
    const addr =
      typeof value === 'string' ? value : value?.address || localValue
    if (storageYardConfirm && addr.trim()) {
      dismissedYardKeysRef.current.add(
        storageYardDismissKey(storageYardConfirm.fieldKey, addr),
      )
    }
    setYardConfirmOpen(false)
  }

  const handleAddressBlur = () => {
    const entered: AddressData =
      typeof value === 'object' && value
        ? { ...value, address: localValue || value.address || '' }
        : { address: localValue }
    maybeAskYardConfirmRef.current(entered)
  }

  const yardConfirmDialog = storageYardConfirm ? (
    <StorageYardConfirmDialog
      open={yardConfirmOpen}
      role={storageYardConfirm.role}
      onConfirm={handleYardConfirm}
      onDismiss={handleYardDismiss}
    />
  ) : null

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
    return installPacContainerViewportClamp()
  }, [readOnly])

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
        maybeAskYardConfirmRef.current(addressData)

        // Reset flag after a short delay
        setTimeout(() => {
          isSelectingRef.current = false
        }, 100)
      })

      autocompleteRef.current = autocomplete
    }

    void initAutocomplete()
  }, [onChange, onAddressDataChange, onAddressSelect, readOnly, isAddressDataMode])

  const applyResolvedAddress = (address: string, lat: number, lng: number) => {
    isSelectingRef.current = true
    setLocalValue(address)

    const addressData: AddressData = {
      address,
      lat,
      lng,
      isPinDropped: false,
    }

    if (isAddressDataMode) {
      (onChange as (data: AddressData) => void)(addressData)
    } else {
      (onChange as (value: string) => void)(address)
      onAddressDataChange?.({ lat, lng })
    }

    onAddressSelect?.(addressData)
    maybeAskYardConfirmRef.current(addressData)

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

  const inputClassName = isNarrow
    ? 'flex-1 min-w-0 px-3 h-9 border border-gt-border-field rounded-lg text-sm text-gt-text-primary placeholder:text-gt-text-tertiary hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20'
    : isMobileSized
      ? 'flex-1 min-w-0 px-4 h-12 border border-gt-border-field rounded-lg text-sm text-gt-text-primary placeholder:text-gt-text-tertiary hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20'
      : 'flex-1 min-w-0 px-4 py-2.5 border border-gt-border-field rounded-lg text-sm text-gt-text-primary placeholder:text-gt-text-tertiary hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20'

  const actionButtonClassName = isNarrow
    ? 'shrink-0 h-9 w-9 flex items-center justify-center border border-gt-border-field rounded-lg text-gray-500 hover:bg-gray-50 hover:border-gt-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
    : isMobileSized
      ? 'shrink-0 px-3 min-h-[48px] min-w-[48px] flex items-center justify-center border border-gt-border-field rounded-lg text-gray-500 hover:bg-gray-50 hover:border-gt-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
      : 'shrink-0 px-3 py-2.5 border border-gt-border-field rounded-lg text-gray-500 hover:bg-gray-50 hover:border-gt-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  const actionIconSize = isNarrow ? 16 : 18

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
        {linkLoading ? <Loader2 size={actionIconSize} className="animate-spin" /> : <Link2 size={actionIconSize} />}
      </button>
    )
  }

  const renderLinkPanel = () => {
    if (!linkPanelOpen || readOnly) return null
    return (
      <div
        className={
          isNarrow
            ? 'mt-2 p-3 border border-gt-border-field rounded-lg bg-gray-50 space-y-2'
            : 'mt-2 p-3 border border-gt-border-field rounded-lg bg-gray-50 space-y-2'
        }
      >
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
          className={
            isNarrow
              ? 'w-full px-3 h-9 border border-gt-border-field rounded-lg text-sm text-gt-text-primary placeholder:text-gt-text-tertiary hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20 disabled:bg-gray-100'
              : 'w-full px-3 py-2 border border-gt-border-field rounded-lg text-sm text-gt-text-primary placeholder:text-gt-text-tertiary hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20 disabled:bg-gray-100'
          }
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
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleInputChange}
          onBlur={handleAddressBlur}
          placeholder={placeholder}
          readOnly={readOnly}
          className={inputClasses}
        />
        {/* Fixed order on every field: map pin → paste link → optional save bookmark */}
        {onPinDropClick && (
          <button
            type="button"
            onClick={onPinDropClick}
            className={`${actionButtonClassName} hover:text-red-500`}
            title="הנח סיכה על המפה"
          >
            <MapPin size={actionIconSize} />
          </button>
        )}
        {renderLinkButton()}
        {extraActions}
      </div>
      {renderLinkPanel()}
    </>
  )

  // Simple input without label (new style - used by RouteBuilder)
  if (!label && !hideLabel) {
    return (
      <div className={`flex-1 min-w-0 ${className}`}>
        {renderInputRow(
          isNarrow
            ? `flex-1 min-w-0 px-3 h-9 border border-gt-border-field rounded-lg text-sm text-gt-text-primary placeholder:text-gt-text-tertiary hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20 ${
                readOnly ? 'bg-gray-50' : ''
              }`
            : isMobileSized
              ? `flex-1 min-w-0 px-3 h-12 border border-gt-border-field rounded-lg text-sm text-gt-text-primary placeholder:text-gt-text-tertiary hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20 ${
                  readOnly ? 'bg-gray-50' : ''
                }`
              : `flex-1 min-w-0 px-3 py-2.5 border border-gt-border-field rounded-lg text-sm text-gt-text-primary placeholder:text-gt-text-tertiary hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20 ${
                  readOnly ? 'bg-gray-50' : ''
                }`
        )}
        {yardConfirmDialog}
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
      {yardConfirmDialog}
    </div>
  )
}

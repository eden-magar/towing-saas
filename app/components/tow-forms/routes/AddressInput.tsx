'use client'

import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react'
import { Bookmark, Link2, Loader2, MapPin } from 'lucide-react'
import {
  ADDRESS_FIELD_ACTION_BTN_CLASS,
  ADDRESS_FIELD_ACTION_ICON_SIZE,
} from './addressFieldActions'
import { supabase } from '../../../lib/supabase'
import { StorageYardConfirmDialog } from '../shared/StorageYardConfirmDialog'
import {
  matchesStorageYard,
  storageYardDismissKey,
  type YardAddressRef,
} from '../../../lib/utils/storage-yard-match'
import { PortalSuggestDropdown } from '../../shared/PortalSuggestDropdown'
import type { CustomerAddress } from '../../../lib/types'

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
      googleMapsCallbacks.forEach((cb) => cb())
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
  /**
   * Audit callback — yes / no / backdrop dismiss.
   * Does not change storage flags; parent owns form state + history.
   */
  onAnswer?: (
    outcome: 'yes' | 'no' | 'dismissed',
    address: string,
  ) => void
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
  /**
   * Optional saved customer addresses shown above Google predictions.
   * Omit / empty → Google-only (portal, no customer selected).
   */
  savedAddresses?: CustomerAddress[]
}

const LINK_RESOLVE_ERROR = 'לא הצלחנו לזהות מיקום מהקישור'
const PLACES_DEBOUNCE_MS = 250
const SAVED_SUGGEST_LIMIT = 5
const GOOGLE_SUGGEST_LIMIT = 5
const ROW_HEIGHT_ESTIMATE = 52

type GoogleSuggestion = {
  kind: 'google'
  placeId: string
  primary: string
  secondary: string
}

type SavedSuggestion = {
  kind: 'saved'
  id: string
  label: string
  address: string
  placeId: string | null
  lat: number | null
  lng: number | null
}

type Suggestion = SavedSuggestion | GoogleSuggestion

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
  savedAddresses = [],
}: AddressInputProps) {
  const internalRef = useRef<HTMLInputElement>(null)
  const inputRef = externalRef || internalRef
  const anchorRef = useRef<HTMLDivElement>(null)
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null)
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const placesReadyRef = useRef(false)

  const isNarrow = narrowColumn ?? false
  const isMobileSized = isMobile ?? false

  // Handle both string and AddressData value types
  const addressString = typeof value === 'string' ? value : value?.address || ''
  const [localValue, setLocalValue] = useState(addressString)
  const isSelectingRef = useRef(false)
  const dismissedYardKeysRef = useRef<Set<string>>(new Set())
  const [yardConfirmOpen, setYardConfirmOpen] = useState(false)

  const [isFocused, setIsFocused] = useState(false)
  const [googlePredictions, setGooglePredictions] = useState<GoogleSuggestion[]>([])
  const [placesLoading, setPlacesLoading] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [detailsLoading, setDetailsLoading] = useState(false)

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

  const currentAddressString = () => {
    if (typeof value === 'string') return value
    return value?.address || localValue
  }

  const rememberDismissKey = () => {
    const addr = currentAddressString()
    if (storageYardConfirm && addr.trim()) {
      dismissedYardKeysRef.current.add(
        storageYardDismissKey(storageYardConfirm.fieldKey, addr),
      )
    }
  }

  const handleYardConfirm = () => {
    setYardConfirmOpen(false)
    storageYardConfirm?.onAnswer?.('yes', currentAddressString())
    storageYardConfirm?.onConfirm()
  }

  const handleYardDecline = () => {
    rememberDismissKey()
    setYardConfirmOpen(false)
    storageYardConfirm?.onAnswer?.('no', currentAddressString())
  }

  const handleYardBackdropDismiss = () => {
    rememberDismissKey()
    setYardConfirmOpen(false)
    storageYardConfirm?.onAnswer?.('dismissed', currentAddressString())
  }

  const handleAddressBlur = () => {
    window.setTimeout(() => setIsFocused(false), 150)
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
      onDecline={handleYardDecline}
      onDismiss={handleYardBackdropDismiss}
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
      const newValue = typeof value === 'string' ? value : value?.address || ''
      setLocalValue(newValue) // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [value])

  const ensureSessionToken = useCallback(() => {
    if (!window.google?.maps?.places) return null
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken()
    }
    return sessionTokenRef.current
  }, [])

  const resetSessionToken = useCallback(() => {
    sessionTokenRef.current = null
  }, [])

  // Init Places services (no legacy Autocomplete widget)
  useEffect(() => {
    if (readOnly) return
    let cancelled = false

    const init = async () => {
      await loadGoogleMaps()
      if (cancelled || !window.google?.maps?.places) return
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
      const attribution = document.createElement('div')
      placesServiceRef.current = new window.google.maps.places.PlacesService(attribution)
      placesReadyRef.current = true
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [readOnly])

  const query = localValue.trim()
  const savedSuggestions: SavedSuggestion[] = useMemo(() => {
    if (query.length < 1 || savedAddresses.length === 0) return []
    const q = query.toLowerCase()
    return savedAddresses
      .filter(
        (a) =>
          a.label.toLowerCase().includes(q) || a.address.toLowerCase().includes(q),
      )
      .slice(0, SAVED_SUGGEST_LIMIT)
      .map((a) => ({
        kind: 'saved' as const,
        id: a.id,
        label: a.label,
        address: a.address,
        placeId: a.place_id,
        lat: a.lat,
        lng: a.lng,
      }))
  }, [query, savedAddresses])

  // Debounced Google predictions
  useEffect(() => {
    if (readOnly || !isFocused || query.length < 1) {
      setGooglePredictions([])
      setPlacesLoading(false)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      return
    }

    setPlacesLoading(true)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

    debounceTimerRef.current = setTimeout(() => {
      void (async () => {
        if (!placesReadyRef.current) {
          await loadGoogleMaps()
          if (window.google?.maps?.places) {
            autocompleteServiceRef.current =
              autocompleteServiceRef.current ??
              new window.google.maps.places.AutocompleteService()
            if (!placesServiceRef.current) {
              const attribution = document.createElement('div')
              placesServiceRef.current = new window.google.maps.places.PlacesService(
                attribution,
              )
            }
            placesReadyRef.current = true
          }
        }

        const service = autocompleteServiceRef.current
        if (!service) {
          setPlacesLoading(false)
          setGooglePredictions([])
          return
        }

        const token = ensureSessionToken()
        // AutocompleteService forbids mixing establishment + geocode (legacy widget allowed both).
        // Omit types so predictions cover both establishments and addresses.
        service.getPlacePredictions(
          {
            input: query,
            componentRestrictions: { country: 'il' },
            sessionToken: token ?? undefined,
          },
          (predictions, status) => {
            setPlacesLoading(false)
            if (
              status !== window.google.maps.places.PlacesServiceStatus.OK ||
              !predictions
            ) {
              setGooglePredictions([])
              return
            }
            setGooglePredictions(
              predictions.slice(0, GOOGLE_SUGGEST_LIMIT).map((p) => ({
                kind: 'google' as const,
                placeId: p.place_id,
                primary:
                  p.structured_formatting?.main_text ||
                  p.description.split(',')[0] ||
                  p.description,
                secondary:
                  p.structured_formatting?.secondary_text ||
                  p.description.replace(/^[^,]+,\s*/, ''),
              })),
            )
          },
        )
      })()
    }, PLACES_DEBOUNCE_MS)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [query, isFocused, readOnly, ensureSessionToken])

  const suggestions: Suggestion[] = useMemo(
    () => [...savedSuggestions, ...googlePredictions],
    [savedSuggestions, googlePredictions],
  )

  useEffect(() => {
    setHighlightIndex(-1)
  }, [suggestions])

  const showDropdown =
    !readOnly &&
    isFocused &&
    query.length >= 1 &&
    (placesLoading || detailsLoading || suggestions.length > 0 || (!placesLoading && query.length >= 1))

  const emitAddress = useCallback(
    (addressData: AddressData) => {
      isSelectingRef.current = true
      setLocalValue(addressData.address)
      setIsFocused(false)
      setGooglePredictions([])
      setHighlightIndex(-1)

      if (isAddressDataMode) {
        ;(onChange as (data: AddressData) => void)(addressData)
      } else {
        ;(onChange as (value: string) => void)(addressData.address)
        onAddressDataChange?.({
          placeId: addressData.placeId,
          lat: addressData.lat,
          lng: addressData.lng,
        })
      }

      onAddressSelect?.(addressData)
      maybeAskYardConfirmRef.current(addressData)

      setTimeout(() => {
        isSelectingRef.current = false
      }, 100)
    },
    [isAddressDataMode, onChange, onAddressDataChange, onAddressSelect],
  )

  const selectSaved = useCallback(
    (item: SavedSuggestion) => {
      resetSessionToken()
      emitAddress({
        address: item.address,
        placeId: item.placeId ?? undefined,
        lat: item.lat ?? undefined,
        lng: item.lng ?? undefined,
      })
    },
    [emitAddress, resetSessionToken],
  )

  const selectGoogle = useCallback(
    (item: GoogleSuggestion) => {
      const service = placesServiceRef.current
      if (!service) return

      setDetailsLoading(true)
      const token = ensureSessionToken()
      service.getDetails(
        {
          placeId: item.placeId,
          fields: ['formatted_address', 'name', 'place_id', 'geometry'],
          sessionToken: token ?? undefined,
        },
        (place, status) => {
          setDetailsLoading(false)
          resetSessionToken()
          if (
            status !== window.google.maps.places.PlacesServiceStatus.OK ||
            !place
          ) {
            return
          }

          let selectedAddress = place.formatted_address || place.name || item.primary
          if (
            place.name &&
            place.formatted_address &&
            !place.formatted_address.startsWith(place.name)
          ) {
            selectedAddress = `${place.name}, ${place.formatted_address}`
          }

          emitAddress({
            address: selectedAddress,
            placeId: place.place_id ?? item.placeId,
            lat: place.geometry?.location?.lat(),
            lng: place.geometry?.location?.lng(),
          })
        },
      )
    },
    [emitAddress, ensureSessionToken, resetSessionToken],
  )

  const selectSuggestionAt = useCallback(
    (index: number) => {
      const item = suggestions[index]
      if (!item) return
      if (item.kind === 'saved') selectSaved(item)
      else selectGoogle(item)
    },
    [suggestions, selectSaved, selectGoogle],
  )

  const applyResolvedAddress = (address: string, lat: number, lng: number) => {
    resetSessionToken()
    emitAddress({
      address,
      lat,
      lng,
      isPinDropped: false,
    })
  }

  const handleSubmitLink = async () => {
    const trimmed = linkUrl.trim()
    if (!trimmed) return

    setLinkLoading(true)
    setLinkError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
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
    setIsFocused(true)

    if (isAddressDataMode) {
      // Drop stale coordinates until user picks from autocomplete / pin / link
      ;(onChange as (data: AddressData) => void)({
        address: newValue,
      })
    } else {
      ;(onChange as (value: string) => void)(newValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown && e.key !== 'Escape') return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (suggestions.length === 0) return
      setHighlightIndex((i) => (i + 1) % suggestions.length)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (suggestions.length === 0) return
      setHighlightIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
      return
    }
    if (e.key === 'Enter') {
      if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
        e.preventDefault()
        selectSuggestionAt(highlightIndex)
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setIsFocused(false)
      setHighlightIndex(-1)
    }
  }

  const inputClassName = isNarrow
    ? 'flex-1 min-w-0 px-3 h-9 border border-gt-border-field rounded-lg text-sm text-gt-text-primary placeholder:text-gt-text-tertiary hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20'
    : isMobileSized
      ? 'flex-1 min-w-0 px-4 h-12 border border-gt-border-field rounded-lg text-sm text-gt-text-primary placeholder:text-gt-text-tertiary hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20'
      : 'flex-1 min-w-0 px-4 py-2.5 border border-gt-border-field rounded-lg text-sm text-gt-text-primary placeholder:text-gt-text-tertiary hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20'

  const actionButtonClassName = ADDRESS_FIELD_ACTION_BTN_CLASS
  const actionIconSize = ADDRESS_FIELD_ACTION_ICON_SIZE

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
        {linkLoading ? (
          <Loader2 size={actionIconSize} className="animate-spin" />
        ) : (
          <Link2 size={actionIconSize} />
        )}
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

  const renderSuggestDropdown = () => {
    if (!showDropdown) return null

    const itemCount =
      suggestions.length > 0
        ? suggestions.length
        : placesLoading || detailsLoading
          ? 1
          : 1

    return (
      <PortalSuggestDropdown
        anchorRef={anchorRef}
        open={showDropdown}
        itemCount={itemCount}
        rowHeightEstimate={ROW_HEIGHT_ESTIMATE}
      >
        {(placesLoading || detailsLoading) && suggestions.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-3 py-3 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-gt-brand" />
            <span>מחפש כתובות...</span>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="px-3 py-3 text-center text-xs text-gray-500">
            לא נמצאו תוצאות
          </div>
        ) : (
          suggestions.map((item, index) => {
            const active = index === highlightIndex
            if (item.kind === 'saved') {
              return (
                <button
                  key={`saved-${item.id}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSaved(item)}
                  onMouseEnter={() => setHighlightIndex(index)}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-right transition-colors ${
                    active ? 'bg-gt-brand-subtle' : 'hover:bg-gray-50'
                  }`}
                >
                  <Bookmark
                    size={14}
                    className="mt-0.5 shrink-0 text-gt-brand"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gt-text-primary">
                      {item.label}
                    </span>
                    <span className="block truncate text-xs text-gt-text-tertiary">
                      {item.address}
                    </span>
                  </span>
                </button>
              )
            }

            return (
              <button
                key={`google-${item.placeId}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectGoogle(item)}
                onMouseEnter={() => setHighlightIndex(index)}
                className={`flex w-full flex-col items-stretch gap-0.5 px-3 py-2 text-right transition-colors ${
                  active ? 'bg-gt-brand-subtle' : 'hover:bg-gray-50'
                }`}
              >
                <span className="truncate text-sm font-medium text-gt-text-primary">
                  {item.primary}
                </span>
                {item.secondary ? (
                  <span className="truncate text-xs text-gt-text-tertiary">
                    {item.secondary}
                  </span>
                ) : null}
              </button>
            )
          })
        )}
        {placesLoading && suggestions.length > 0 ? (
          <div className="flex items-center justify-end gap-1.5 border-t border-gray-100 px-3 py-1.5 text-[11px] text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            מעדכן...
          </div>
        ) : null}
      </PortalSuggestDropdown>
    )
  }

  const renderInputRow = (inputClasses: string) => {
    const showActionRow = !!(onPinDropClick || !readOnly || extraActions)
    return (
      <>
        <div ref={anchorRef} className="relative w-full min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={localValue}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={handleAddressBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            readOnly={readOnly}
            autoComplete="off"
            className={`${inputClasses} w-full`}
            role="combobox"
            aria-expanded={showDropdown}
            aria-autocomplete="list"
            aria-activedescendant={
              highlightIndex >= 0 ? `address-suggest-${highlightIndex}` : undefined
            }
          />
          {renderSuggestDropdown()}
        </div>
        {/* Actions on their own row under the field — full-width input above.
            Fixed order (RTL start/right → left): map pin → paste link → save bookmark */}
        {showActionRow && (
          <div className="mt-1.5 flex min-h-9 flex-wrap items-center justify-start gap-1.5">
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
        )}
        {renderLinkPanel()}
      </>
    )
  }

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
                }`,
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

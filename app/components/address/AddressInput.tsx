'use client'

// ==================== AddressInput Component ====================
// שדה כתובת עם Google Places Autocomplete וכפתור הנח סיכה

import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Navigation, Loader2, X } from 'lucide-react'
import { AddressData } from './useGoogleMaps'

interface AddressInputProps {
  value: AddressData
  onChange: (data: AddressData) => void
  placeholder?: string
  label?: string
  required?: boolean
  disabled?: boolean
  onPinDropClick?: () => void
  className?: string
}

export default function AddressInput({
  value,
  onChange,
  placeholder = 'הזן כתובת...',
  label,
  required = false,
  disabled = false,
  onPinDropClick,
  className = ''
}: AddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [isAutocompleteReady, setIsAutocompleteReady] = useState(false)
  const [inputValue, setInputValue] = useState(value.address || '')

  // אתחול Google Places Autocomplete
  useEffect(() => {
    if (!inputRef.current || !window.google?.maps?.places) {
      return
    }

    // אם כבר קיים, לא ליצור שוב
    if (autocompleteRef.current) {
      return
    }

    const options: google.maps.places.AutocompleteOptions = {
      componentRestrictions: { country: 'il' },
      fields: ['formatted_address', 'name', 'place_id', 'geometry', 'types'],
      types: ['establishment', 'geocode']
    }

    const autocomplete = new window.google.maps.places.Autocomplete(
      inputRef.current,
      options
    )

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      
      if (!place.formatted_address && !place.name) {
        return
      }

      // בחירת פורמט הכתובת הטוב ביותר
      let selectedAddress = ''
      if (place.name && place.formatted_address) {
        // אם זה עסק, להוסיף את השם
        const isBusinessQuery = checkIfBusinessQuery(inputValue)
        if (isBusinessQuery) {
          selectedAddress = `${place.name}, ${place.formatted_address}`
        } else {
          selectedAddress = place.formatted_address
        }
      } else {
        selectedAddress = place.formatted_address || place.name || ''
      }

      const newData: AddressData = {
        address: selectedAddress,
        placeId: place.place_id,
        lat: place.geometry?.location?.lat(),
        lng: place.geometry?.location?.lng(),
        isPinDropped: false
      }

      setInputValue(selectedAddress)
      onChange(newData)
    })

    autocompleteRef.current = autocomplete
    setIsAutocompleteReady(true)

    return () => {
      // ניקוי - Autocomplete לא צריך cleanup מיוחד
    }
  }, [onChange])

  // סנכרון עם value חיצוני
  useEffect(() => {
    if (value.address !== inputValue) {
      setInputValue(value.address || '')
    }
  }, [value.address])

  // בדיקה אם מחפשים עסק
  const checkIfBusinessQuery = (query: string): boolean => {
    const businessKeywords = [
      'מוסך', 'garage', 'שירות', 'service',
      'חנות', 'shop', 'store', 'מרכז', 'center',
      'בית עסק', 'עסק', 'business', 'חברה', 'company',
      'חניון', 'parking', 'גרר', 'towing'
    ]
    const lowerQuery = query.toLowerCase()
    return businessKeywords.some(keyword => lowerQuery.includes(keyword))
  }

  // עדכון ערך בעת הקלדה ידנית
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    
    // עדכון ה-state עם הטקסט בלבד (ללא קואורדינטות)
    onChange({
      address: newValue,
      placeId: undefined,
      lat: undefined,
      lng: undefined,
      isPinDropped: false
    })
  }

  // ניקוי השדה
  const handleClear = () => {
    setInputValue('')
    onChange({
      address: '',
      placeId: undefined,
      lat: undefined,
      lng: undefined,
      isPinDropped: false
    })
    inputRef.current?.focus()
  }

  // האם יש כתובת תקפה עם קואורדינטות
  const hasValidCoordinates = !!(value.lat && value.lng)

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 mr-1">*</span>}
        </label>
      )}
      
      <div className="flex gap-2">
        {/* שדה הכתובת */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder={placeholder}
            disabled={disabled}
            className={`
              w-full px-4 py-2.5 border rounded-xl text-sm
              focus:outline-none focus:ring-2 focus:ring-[#33d4ff]
              disabled:bg-gray-100 disabled:cursor-not-allowed
              ${hasValidCoordinates 
                ? 'border-emerald-300 bg-emerald-50 pr-10' 
                : 'border-gray-200'
              }
            `}
          />
          
          {/* אינדיקטור כתובת מאומתת */}
          {hasValidCoordinates && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Navigation size={14} className="text-emerald-600" />
            </div>
          )}
          
          {/* כפתור ניקוי */}
          {inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* כפתור הנח סיכה */}
        {onPinDropClick && (
          <button
            type="button"
            onClick={onPinDropClick}
            disabled={disabled}
            className={`
              px-3 py-2.5 rounded-xl text-sm font-medium
              flex items-center gap-1.5 whitespace-nowrap
              transition-colors
              ${value.isPinDropped
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <MapPin size={16} />
            <span className="hidden sm:inline">
              {value.isPinDropped ? 'סיכה הונחה' : 'הנח סיכה'}
            </span>
          </button>
        )}
      </div>

      {/* הודעה על מיקום מדויק */}
      {value.isPinDropped && (
        <p className="text-xs text-emerald-600 flex items-center gap-1">
          <Navigation size={12} />
          מיקום מדויק נבחר מהמפה
        </p>
      )}

      {/* אזהרה על כתובת ללא קואורדינטות */}
      {inputValue && !hasValidCoordinates && (
        <p className="text-xs text-amber-600">
          💡 בחר כתובת מהרשימה או הנח סיכה לדיוק מקסימלי
        </p>
      )}
    </div>
  )
}

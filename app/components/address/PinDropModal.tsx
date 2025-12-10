'use client'

// ==================== PinDropModal Component ====================
// מודאל מפה לבחירת מיקום עם הנחת סיכה

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, MapPin, Navigation, Loader2 } from 'lucide-react'
import { AddressData, reverseGeocode } from './useGoogleMaps'

interface PinDropModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: AddressData) => void
  initialAddress?: AddressData
  title?: string
}

export default function PinDropModal({
  isOpen,
  onClose,
  onConfirm,
  initialAddress,
  title = 'בחר מיקום'
}: PinDropModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  
  const [isLoading, setIsLoading] = useState(true)
  const [currentAddress, setCurrentAddress] = useState<string>('')
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null)

  // מרכז ברירת מחדל - ישראל
  const DEFAULT_CENTER = { lat: 32.0853, lng: 34.7818 }
  const DEFAULT_ZOOM = 14

  // אתחול המפה
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current || !window.google?.maps) {
      return
    }

    setIsLoading(true)

    // מיקום התחלתי
    let initialPosition = DEFAULT_CENTER
    
    if (initialAddress?.lat && initialAddress?.lng) {
      initialPosition = { lat: initialAddress.lat, lng: initialAddress.lng }
    }

    // יצירת המפה
    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: initialPosition,
      zoom: DEFAULT_ZOOM,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      gestureHandling: 'greedy',
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
      zoomControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    })

    // יצירת מרקר
    const marker = new window.google.maps.Marker({
      position: initialPosition,
      map: map,
      draggable: true,
      title: 'גרור אותי למיקום הרצוי',
      animation: window.google.maps.Animation.DROP
    })

    // עדכון מיקום בעת גרירה
    marker.addListener('dragend', async () => {
      const position = marker.getPosition()
      if (position) {
        const lat = position.lat()
        const lng = position.lng()
        setCurrentPosition({ lat, lng })
        
        // Reverse geocode
        const address = await reverseGeocode(lat, lng)
        setCurrentAddress(address || 'מיקום מדויק')
      }
    })

    // לחיצה על המפה מזיזה את המרקר
    map.addListener('click', async (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        marker.setPosition(e.latLng)
        const lat = e.latLng.lat()
        const lng = e.latLng.lng()
        setCurrentPosition({ lat, lng })
        
        // Reverse geocode
        const address = await reverseGeocode(lat, lng)
        setCurrentAddress(address || 'מיקום מדויק')
      }
    })

    mapRef.current = map
    markerRef.current = marker

    // קבלת מיקום נוכחי אם אין מיקום התחלתי
    if (!initialAddress?.lat && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
          map.setCenter(pos)
          marker.setPosition(pos)
          setCurrentPosition(pos)
          
          // Reverse geocode
          reverseGeocode(pos.lat, pos.lng).then(address => {
            setCurrentAddress(address || 'מיקום מדויק')
          })
        },
        () => {
          // אם אין הרשאה, נישאר במיקום ברירת מחדל
          setCurrentPosition(initialPosition)
        }
      )
    } else if (initialAddress?.lat && initialAddress?.lng) {
      setCurrentPosition(initialPosition)
      setCurrentAddress(initialAddress.address || '')
    }

    setIsLoading(false)

    return () => {
      mapRef.current = null
      markerRef.current = null
    }
  }, [isOpen, initialAddress])

  // Geocode כתובת התחלתית אם יש
  useEffect(() => {
    if (!isOpen || !initialAddress?.address || initialAddress?.lat) {
      return
    }

    // Geocode את הכתובת הטקסטואלית
    if (window.google?.maps && mapRef.current && markerRef.current) {
      const geocoder = new window.google.maps.Geocoder()
      geocoder.geocode(
        { 
          address: initialAddress.address,
          componentRestrictions: { country: 'IL' }
        },
        (results, status) => {
          if (status === 'OK' && results?.[0]?.geometry?.location) {
            const location = results[0].geometry.location
            const pos = { lat: location.lat(), lng: location.lng() }
            
            mapRef.current?.setCenter(pos)
            markerRef.current?.setPosition(pos)
            setCurrentPosition(pos)
            setCurrentAddress(results[0].formatted_address)
          }
        }
      )
    }
  }, [isOpen, initialAddress])

  // אישור הבחירה
  const handleConfirm = () => {
    if (!currentPosition) return

    onConfirm({
      address: currentAddress || 'מיקום מדויק',
      lat: currentPosition.lat,
      lng: currentPosition.lng,
      isPinDropped: true
    })
    onClose()
  }

  // מעבר למיקום הנוכחי
  const goToCurrentLocation = () => {
    if (!navigator.geolocation || !mapRef.current || !markerRef.current) return

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }
        mapRef.current?.setCenter(pos)
        mapRef.current?.setZoom(17)
        markerRef.current?.setPosition(pos)
        setCurrentPosition(pos)
        
        const address = await reverseGeocode(pos.lat, pos.lng)
        setCurrentAddress(address || 'מיקום מדויק')
      },
      (error) => {
        alert('לא ניתן לקבל מיקום נוכחי')
      }
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* רקע כהה */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* המודאל */}
      <div className="relative bg-white rounded-2xl w-full max-w-2xl mx-4 overflow-hidden shadow-xl max-h-[90vh] flex flex-col">
        {/* כותרת */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <MapPin size={20} />
            <h2 className="font-bold text-lg">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* המפה */}
        <div className="relative flex-1 min-h-[400px]">
          <div 
            ref={mapContainerRef} 
            className="w-full h-full"
          />
          
          {/* טעינה */}
          {isLoading && (
            <div className="absolute inset-0 bg-white flex items-center justify-center">
              <Loader2 size={32} className="animate-spin text-[#33d4ff]" />
            </div>
          )}

          {/* כפתור מיקום נוכחי */}
          <button
            onClick={goToCurrentLocation}
            className="absolute bottom-4 right-4 bg-white p-3 rounded-full shadow-lg hover:bg-gray-50 transition-colors"
            title="המיקום שלי"
          >
            <Navigation size={20} className="text-[#33d4ff]" />
          </button>

          {/* הוראות */}
          <div className="absolute top-4 left-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow text-sm text-gray-600 text-center">
            גרור את הסיכה או לחץ על המפה לבחירת מיקום
          </div>
        </div>

        {/* כתובת נבחרת */}
        {currentAddress && (
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-200">
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

        {/* כפתורים */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-white flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
          >
            ביטול
          </button>
          <button
            onClick={handleConfirm}
            disabled={!currentPosition}
            className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <MapPin size={18} />
            אישור מיקום
          </button>
        </div>
      </div>
    </div>
  )
}

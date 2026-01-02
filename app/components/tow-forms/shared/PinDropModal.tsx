'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin, Loader2, Navigation } from 'lucide-react'
import { loadGoogleMaps, AddressData } from '../routes/AddressInput'

// ==================== Helper Functions ====================

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!window.google?.maps) return null
  const geocoder = new window.google.maps.Geocoder()
  return new Promise((resolve) => {
    geocoder.geocode({ location: { lat, lng } }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
      resolve(status === 'OK' && results?.[0] ? results[0].formatted_address : null)
    })
  })
}

// ==================== Types ====================

interface PinDropModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: AddressData) => void
  initialAddress?: AddressData
  title?: string
}

// ==================== Component ====================

export function PinDropModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  initialAddress, 
  title = 'בחר מיקום' 
}: PinDropModalProps) {
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

      let pos = { lat: 32.0853, lng: 34.7818 } // Default: Tel Aviv

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

      // Try to get user's current location if no initial address
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
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-[#33d4ff] text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <MapPin size={20} />
            <h2 className="font-bold text-lg">{title}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg text-xl">×</button>
        </div>

        {/* Map */}
        <div className="relative flex-1" style={{ minHeight: '400px' }}>
          <div ref={mapContainerRef} className="absolute inset-0" />
          {isLoading && (
            <div className="absolute inset-0 bg-white flex items-center justify-center">
              <Loader2 size={32} className="animate-spin text-[#33d4ff]" />
            </div>
          )}
          <button 
            onClick={goToCurrentLocation} 
            className="absolute bottom-4 right-4 bg-white p-3 rounded-full shadow-lg hover:bg-gray-50" 
            title="המיקום שלי"
          >
            <Navigation size={20} className="text-[#33d4ff]" />
          </button>
          <div className="absolute top-4 left-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow text-sm text-gray-600 text-center">
            גרור את הסיכה או לחץ על המפה לבחירת מיקום
          </div>
        </div>

        {/* Address display */}
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

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4 border-t bg-white flex-shrink-0">
          <button 
            onClick={onClose} 
            className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 font-medium"
          >
            ביטול
          </button>
          <button 
            onClick={handleConfirm} 
            disabled={!currentPosition} 
            className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <MapPin size={18} />
            אישור מיקום
          </button>
        </div>
      </div>
    </div>
  )
}